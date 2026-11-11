import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getAdminClient, getUserFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeEqual(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function POST(req) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body || {};

  const db = getAdminClient();
  const { data: order } = await db
    .from('orders').select('id, user_id, razorpay_order_id, payment_status').eq('id', orderId).maybeSingle();
  if (!order || order.user_id !== user.id || order.razorpay_order_id !== razorpay_order_id)
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.payment_status === 'paid') return NextResponse.json({ ok: true });

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (!safeEqual(expected, razorpay_signature)) {
    await db.from('orders').update({ payment_status: 'failed' }).eq('id', order.id).eq('payment_status', 'pending');
    return NextResponse.json({ error: 'Payment could not be verified' }, { status: 400 });
  }

  await db.from('orders')
    .update({ payment_status: 'paid', razorpay_payment_id, status: 'confirmed' })
    .eq('id', order.id);
  return NextResponse.json({ ok: true });
}

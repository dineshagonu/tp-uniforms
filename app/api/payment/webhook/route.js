import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Razorpay Dashboard → Webhooks → URL: https://YOUR-DOMAIN/api/payment/webhook
// Events: payment.captured, payment.failed, order.paid
// This catches payments even if the customer closes the browser before returning.
export async function POST(req) {
  const raw = await req.text();
  const sig = req.headers.get('x-razorpay-signature') || '';
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '').update(raw).digest('hex');
  const a = Buffer.from(expected); const b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
    return NextResponse.json({ error: 'Bad signature' }, { status: 400 });

  let event;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Bad body' }, { status: 400 }); }
  const payment = event?.payload?.payment?.entity;
  const rzOrderId = payment?.order_id || event?.payload?.order?.entity?.id;
  if (!rzOrderId) return NextResponse.json({ ok: true });

  const db = getAdminClient();
  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    await db.from('orders')
      .update({ payment_status: 'paid', razorpay_payment_id: payment?.id ?? null, status: 'confirmed' })
      .eq('razorpay_order_id', rzOrderId).neq('payment_status', 'paid');
  } else if (event.event === 'payment.failed') {
    await db.from('orders').update({ payment_status: 'failed' })
      .eq('razorpay_order_id', rzOrderId).eq('payment_status', 'pending');
  }
  return NextResponse.json({ ok: true });
}

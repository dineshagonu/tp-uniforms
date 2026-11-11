import { NextResponse } from 'next/server';
import { getAdminClient, getUserFromRequest } from '@/lib/supabaseAdmin';
import { getStoreConfig, shippingFor } from '@/lib/storeConfig';
import { PINCODE_RE, PHONE_RE } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (msg, status = 400) => NextResponse.json({ error: msg }, { status });
const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

export async function POST(req) {
  const user = await getUserFromRequest(req);
  if (!user) return bad('Please log in to place your order.', 401);

  let body;
  try { body = await req.json(); } catch { return bad('Invalid request.'); }
  const { items, address = {}, paymentMethod } = body || {};

  if (!Array.isArray(items) || items.length === 0) return bad('Your cart is empty.');
  if (items.length > 50) return bad('Too many items in one order.');
  if (!['cod', 'online'].includes(paymentMethod)) return bad('Choose a payment method.');

  const a = {
    name: clean(address.name, 80), phone: clean(address.phone, 10), email: clean(address.email || user.email || '', 120),
    line: clean(address.line, 300), city: clean(address.city, 60), state: clean(address.state, 60),
    pincode: clean(address.pincode, 6),
  };
  if (!a.name || !a.line || !a.city || !a.state) return bad('Please fill the full delivery address.');
  if (!PHONE_RE.test(a.phone)) return bad('Enter a valid 10-digit mobile number.');
  if (!PINCODE_RE.test(a.pincode)) return bad('Enter a valid 6-digit pincode.');

  const cfg = getStoreConfig();
  const db = getAdminClient();

  // Always re-price from the database — never trust prices sent by the browser.
  const ids = [...new Set(items.map((i) => String(i.productId)))];
  const { data: products, error: pErr } = await db
    .from('products')
    .select('id, name, item_type, price, sizes, is_active, school:schools(name, is_active)')
    .in('id', ids);
  if (pErr) return bad('Could not load products. Please try again.', 500);
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines = [];
  let subtotalPaise = 0;
  for (const it of items) {
    const p = byId.get(String(it.productId));
    if (!p || !p.is_active || !p.school?.is_active) return bad('An item in your cart is no longer available. Please remove it.');
    const qty = parseInt(it.qty, 10);
    if (!Number.isInteger(qty) || qty < 1 || qty > 100) return bad('Invalid quantity for ' + p.name);
    const size = it.size ? clean(it.size, 20) : null;
    if (p.sizes?.length && !p.sizes.includes(size)) return bad('Please select a size for ' + p.name);
    const unitPaise = Math.round(Number(p.price) * 100);
    subtotalPaise += unitPaise * qty;
    lines.push({
      product_id: p.id, school_name: p.school?.name, product_name: p.name, item_type: p.item_type,
      class_name: it.className ? clean(it.className, 40) : null, size, qty,
      unit_price: unitPaise / 100, line_total: (unitPaise * qty) / 100,
    });
  }

  const subtotal = subtotalPaise / 100;
  const shipping = shippingFor(subtotal, cfg);
  const totalPaise = subtotalPaise + Math.round(shipping * 100);
  const total = totalPaise / 100;

  if (paymentMethod === 'cod') {
    if (!cfg.codEnabled) return bad('Cash on Delivery is not available right now.');
    if (cfg.codMaxAmount > 0 && total > cfg.codMaxAmount)
      return bad(`Cash on Delivery is available for orders up to ₹${cfg.codMaxAmount}. Please pay online.`);
  } else if (!cfg.onlineEnabled) {
    return bad('Online payment is not set up yet. Please choose Cash on Delivery.');
  }

  const { data: order, error: oErr } = await db
    .from('orders')
    .insert({
      user_id: user.id, customer_name: a.name, phone: a.phone, email: a.email || null,
      address: a.line, city: a.city, state: a.state, pincode: a.pincode,
      subtotal, shipping, total, payment_method: paymentMethod,
      payment_status: paymentMethod === 'cod' ? 'cod' : 'pending',
      status: 'placed',
    })
    .select('id, order_no')
    .single();
  if (oErr) return bad('Could not create the order. Please try again.', 500);

  const { error: iErr } = await db.from('order_items').insert(lines.map((l) => ({ ...l, order_id: order.id })));
  if (iErr) {
    await db.from('orders').delete().eq('id', order.id);
    return bad('Could not save order items. Please try again.', 500);
  }

  if (paymentMethod === 'cod') {
    return NextResponse.json({ orderId: order.id, orderNo: order.order_no, paymentMethod: 'cod' });
  }

  // Create the Razorpay order (amount in paise)
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const rzRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: totalPaise, currency: 'INR', receipt: `TP${order.order_no}`,
      notes: { order_id: order.id, order_no: String(order.order_no) },
    }),
  });
  if (!rzRes.ok) {
    await db.from('orders').update({ payment_status: 'failed', notes: 'Razorpay order creation failed' }).eq('id', order.id);
    return bad('Payment gateway is busy. Please try again or choose Cash on Delivery.', 502);
  }
  const rz = await rzRes.json();
  await db.from('orders').update({ razorpay_order_id: rz.id }).eq('id', order.id);

  return NextResponse.json({
    orderId: order.id, orderNo: order.order_no, paymentMethod: 'online',
    razorpay: { key: process.env.RAZORPAY_KEY_ID, orderId: rz.id, amount: totalPaise, currency: 'INR' },
    customer: { name: a.name, email: a.email, phone: a.phone },
  });
}

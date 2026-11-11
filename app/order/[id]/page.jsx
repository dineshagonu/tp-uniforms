'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase';
import { ORDER_STATUSES, formatINR, itemTypeLabel, statusLabel } from '@/lib/constants';

export default function OrderPage() {
  const { id } = useParams();
  const sb = getBrowserClient();
  const isNew = useSearchParams().get('new') === '1';
  const [order, setOrder] = useState(undefined);

  useEffect(() => {
    let tries = 0;
    async function load() {
      const { data } = await sb.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle();
      setOrder(data);
      // online payment may take a few seconds to confirm via webhook
      if (data && data.payment_method === 'online' && data.payment_status === 'pending' && tries++ < 5) setTimeout(load, 3000);
    }
    load();
  }, [id, sb]);

  if (order === undefined) return <div className="page center"><p className="muted">Loading…</p></div>;
  if (!order) return <div className="page center"><h2>Order not found</h2><Link href="/account" className="btn">My orders</Link></div>;

  const step = ORDER_STATUSES.indexOf(order.status);
  return (
    <div className="page">
      {isNew && (
        <section className="panel success">
          <h2>{order.payment_status === 'failed' ? 'Payment failed' : 'Order placed! 🎉'}</h2>
          <p>Order <b>#TP{order.order_no}</b>{order.payment_method === 'cod' ? ' — pay cash when it arrives.' : ''}</p>
        </section>
      )}
      <section className="panel">
        <div className="panel-head"><h2>Order #TP{order.order_no}</h2><span className="pill">{statusLabel(order.payment_status)}</span></div>
        <small className="muted">{new Date(order.created_at).toLocaleString('en-IN')}</small>
        {order.status !== 'cancelled' ? (
          <ol className="track">
            {ORDER_STATUSES.filter((s) => s !== 'cancelled').map((s, i) => (
              <li key={s} className={i <= step ? 'done' : ''}>{statusLabel(s)}</li>
            ))}
          </ol>
        ) : <p className="err">This order was cancelled.</p>}
      </section>
      <section className="panel">
        <h2>Items</h2>
        {order.order_items.map((it) => (
          <div key={it.id} className="list-row">
            <div><b>{it.product_name}</b>
              <small>{it.school_name}{it.class_name ? ' · ' + it.class_name : ''}{it.size ? ' · Size ' + it.size : ''} · {itemTypeLabel(it.item_type)} · Qty {it.qty}</small></div>
            <span>{formatINR(it.line_total)}</span>
          </div>
        ))}
        <div className="summary">
          <div><span>Items</span><span>{formatINR(order.subtotal)}</span></div>
          <div><span>Delivery</span><span>{Number(order.shipping) === 0 ? 'FREE' : formatINR(order.shipping)}</span></div>
          <div className="total"><span>Total</span><span>{formatINR(order.total)}</span></div>
        </div>
      </section>
      <section className="panel">
        <h2>Delivering to</h2>
        <p>{order.customer_name} · {order.phone}<br />{order.address}, {order.city}, {order.state} – {order.pincode}</p>
      </section>
      <Link href="/" className="btn ghost">Continue shopping</Link>
    </div>
  );
}

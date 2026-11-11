'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/supabase';
import { formatINR, statusLabel } from '@/lib/constants';

export default function Account() {
  const sb = getBrowserClient();
  const [session, setSession] = useState(undefined);
  const [orders, setOrders] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  useEffect(() => {
    if (!session) return;
    sb.from('orders').select('id, order_no, total, status, payment_status, created_at')
      .eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setOrders(data || []));
    sb.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => setIsAdmin(data?.role === 'admin'));
  }, [session, sb]);

  if (session === undefined) return <div className="page" />;
  if (!session) {
    return (
      <div className="page center">
        <h2>My account</h2>
        <p className="muted">Log in to see your orders.</p>
        <Link href="/login?next=/account" className="btn">Login / Sign up</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="panel">
        <div className="panel-head">
          <div><h2>My account</h2><small className="muted">{session.user.phone ? '+' + String(session.user.phone).replace(/^\+/, '') : session.user.email}</small></div>
          <button className="btn ghost" onClick={() => sb.auth.signOut()}>Logout</button>
        </div>
        {isAdmin && <Link href="/admin" className="btn" style={{ marginTop: 12 }}>Open admin panel</Link>}
      </section>
      <section className="panel">
        <h2>My orders</h2>
        {orders.length === 0 ? <p className="muted">No orders yet.</p> : (
          <div className="list">
            {orders.map((o) => (
              <Link key={o.id} href={'/order/' + o.id} className="list-row">
                <div><b>#TP{o.order_no}</b><small>{new Date(o.created_at).toLocaleDateString('en-IN')} · {statusLabel(o.status)} · {statusLabel(o.payment_status)}</small></div>
                <span>{formatINR(o.total)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

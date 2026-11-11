'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCart, cartKey } from '@/components/CartProvider';
import PincodePicker from '@/components/PincodePicker';
import { getBrowserClient } from '@/lib/supabase';
import { PHONE_RE, PINCODE_RE, formatINR, itemTypeLabel } from '@/lib/constants';

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function CartPage() {
  const router = useRouter();
  const sb = getBrowserClient();
  const { items, subtotal, updateQty, remove, clear, location, setLocation, ready } = useCart();
  const [session, setSession] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [pay, setPay] = useState('online');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [addr, setAddr] = useState({ name: '', phone: '', email: '', line: '' });
  const [loc, setLoc] = useState({});

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    fetch('/api/config').then((r) => r.json()).then((c) => {
      setCfg(c);
      if (!c.onlineEnabled && c.codEnabled) setPay('cod');
    }).catch(() => {});
    try {
      const saved = JSON.parse(localStorage.getItem('tp_addr') || 'null');
      if (saved) {
        setAddr((a) => ({ ...a, name: saved.name || '', phone: saved.phone || '', email: saved.email || '', line: saved.line || '' }));
        if (saved.pincode) setLoc({ pincode: saved.pincode, place: saved.place || '', mandal: saved.mandal || '', district: saved.district || '', state: saved.state || '' });
      }
    } catch {}
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  useEffect(() => { if (location?.pincode && !loc.pincode) setLoc(location); }, [location]); // eslint-disable-line
  useEffect(() => {
    const u = session?.user;
    if (!u) return;
    const ph = String(u.phone || '').replace(/\D/g, '').slice(-10);
    setAddr((a) => ({ ...a, phone: a.phone || ph, email: a.email || u.email || '' }));
    // fill from saved profile
    sb.from('profiles').select('*').eq('id', u.id).maybeSingle().then(({ data: p }) => {
      if (!p) return;
      setAddr((a) => ({
        name: a.name || p.full_name || '', phone: a.phone || String(p.phone || '').replace(/\D/g, '').slice(-10),
        email: a.email || p.email || '', line: a.line || p.address_line || '',
      }));
      if (p.pincode) setLoc((l) => (l.pincode ? l : { pincode: p.pincode, place: p.village || '', mandal: p.mandal || '', district: p.district || '', state: p.state || '' }));
    });
  }, [session]); // eslint-disable-line

  const shipping = !cfg || subtotal === 0 ? 0
    : cfg.freeShippingAbove > 0 && subtotal >= cfg.freeShippingAbove ? 0 : cfg.shippingFee;
  const total = subtotal + shipping;
  const codTooHigh = cfg && cfg.codMaxAmount > 0 && total > cfg.codMaxAmount;
  const set = (k) => (e) => setAddr((a) => ({ ...a, [k]: e.target.value }));

  async function placeOrder(e) {
    e.preventDefault();
    setErr('');
    if (!addr.name || !addr.line) return setErr('Please fill your name and house / street.');
    if (!loc.place || !loc.state) return setErr('Select your village / town for the pincode.');
    if (!PHONE_RE.test(addr.phone)) return setErr('Enter a valid 10-digit mobile number.');
    if (!PINCODE_RE.test(loc.pincode || '')) return setErr('Enter a valid 6-digit pincode.');
    if (pay === 'cod' && codTooHigh) return setErr(`Cash on Delivery is available up to ${formatINR(cfg.codMaxAmount)}.`);

    setBusy(true);
    try {
      localStorage.setItem('tp_addr', JSON.stringify({ ...addr, ...loc }));
      setLocation(loc);
      const { data: { session: s } } = await sb.auth.getSession();
      if (!s) { setBusy(false); return router.push('/login?next=/cart'); }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token },
        body: JSON.stringify({
          paymentMethod: pay,
          address: { ...addr, city: loc.place + (loc.mandal ? ', ' + loc.mandal + ' Mandal' : ''), district: loc.district, state: loc.state, pincode: loc.pincode },
          items: items.map((i) => ({ productId: i.productId, qty: i.qty, size: i.size, className: i.className })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not place order');

      if (data.paymentMethod === 'cod') {
        clear();
        return router.push('/order/' + data.orderId + '?new=1');
      }

      const ok = await loadRazorpay();
      if (!ok) throw new Error('Could not load payment page. Check your internet and try again.');
      const rzp = new window.Razorpay({
        key: data.razorpay.key,
        amount: data.razorpay.amount,
        currency: data.razorpay.currency,
        order_id: data.razorpay.orderId,
        name: 'T&P Uniforms',
        description: 'Order #TP' + data.orderNo,
        prefill: { name: data.customer.name, email: data.customer.email, contact: data.customer.phone },
        theme: { color: '#1f3c88' },
        handler: async (resp) => {
          const v = await fetch('/api/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token },
            body: JSON.stringify({ orderId: data.orderId, ...resp }),
          });
          clear();
          router.push('/order/' + data.orderId + (v.ok ? '?new=1' : ''));
        },
        modal: { ondismiss: () => { setBusy(false); setErr('Payment was not completed. You can try again.'); } },
      });
      rzp.on('payment.failed', () => setErr('Payment failed. Please try again or choose Cash on Delivery.'));
      rzp.open();
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  }

  if (!ready) return <div className="page" />;
  if (!items.length) {
    return (
      <div className="page center">
        <h2>Your cart is empty</h2>
        <p className="muted">Pick your school and add uniforms.</p>
        <Link href="/" className="btn">Select school</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="panel">
        <h2>My cart</h2>
        {items.map((i) => {
          const k = cartKey(i);
          return (
            <div key={k} className="citem">
              {i.image ? <img src={i.image} alt="" /> : <div className="citem-ph" />}
              <div className="citem-body">
                <b>{i.name}</b>
                <small>{i.schoolName}{i.className ? ' · ' + i.className : ''}{i.size ? ' · Size ' + i.size : ''} · {itemTypeLabel(i.itemType)}</small>
                <div className="price">{formatINR(i.price * i.qty)}</div>
                <div className="add-row">
                  <div className="qty">
                    <button onClick={() => updateQty(k, i.qty - 1)} aria-label="Less">−</button>
                    <span>{i.qty}</span>
                    <button onClick={() => updateQty(k, i.qty + 1)} aria-label="More">+</button>
                  </div>
                  <button className="link" onClick={() => remove(k)}>Remove</button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <form className="panel form" onSubmit={placeOrder}>
        <h2>Delivery address</h2>
        <input placeholder="Full name (parent)" value={addr.name} onChange={set('name')} autoComplete="name" />
        <input placeholder="Mobile number" inputMode="numeric" maxLength={10} value={addr.phone}
          onChange={(e) => setAddr((a) => ({ ...a, phone: e.target.value.replace(/\D/g, '') }))} autoComplete="tel" />
        <input placeholder="Email (optional)" type="email" value={addr.email} onChange={set('email')} autoComplete="email" />
        <textarea placeholder="House no, street, landmark" rows={3} value={addr.line} onChange={set('line')} />
        <PincodePicker value={loc} onChange={setLoc} />

        <h2>Payment</h2>
        {cfg?.onlineEnabled && (
          <label className={'payopt' + (pay === 'online' ? ' on' : '')}>
            <input type="radio" name="pay" checked={pay === 'online'} onChange={() => setPay('online')} />
            <div><b>Pay online</b><small>UPI, cards, net banking, wallets (Razorpay)</small></div>
          </label>
        )}
        {cfg?.codEnabled && (
          <label className={'payopt' + (pay === 'cod' ? ' on' : '') + (codTooHigh ? ' disabled' : '')}>
            <input type="radio" name="pay" checked={pay === 'cod'} disabled={codTooHigh} onChange={() => setPay('cod')} />
            <div><b>Cash on Delivery</b>
              <small>{codTooHigh ? `Available for orders up to ${formatINR(cfg.codMaxAmount)}` : 'Pay when the uniform arrives'}</small></div>
          </label>
        )}

        <div className="summary">
          <div><span>Items</span><span>{formatINR(subtotal)}</span></div>
          <div><span>Delivery</span><span>{shipping === 0 ? 'FREE' : formatINR(shipping)}</span></div>
          {cfg?.freeShippingAbove > 0 && shipping > 0 && (
            <small className="muted">Free delivery on orders above {formatINR(cfg.freeShippingAbove)}</small>
          )}
          <div className="total"><span>Total</span><span>{formatINR(total)}</span></div>
        </div>

        {err && <p className="err">{err}</p>}
        {!session && <p className="muted">You&apos;ll log in with mobile OTP or email & password to place the order.</p>}
        <button className="btn big" disabled={busy}>
          {busy ? 'Please wait…' : pay === 'cod' ? `Place order · ${formatINR(total)}` : `Pay ${formatINR(total)}`}
        </button>
      </form>
    </div>
  );
}

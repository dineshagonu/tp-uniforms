'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useCart } from './CartProvider';
import { CLASS_GROUPS, ITEM_TYPES, formatINR, itemTypeLabel } from '@/lib/constants';
import { IconBack } from './Icons';

function ProductCard({ p, school, cls, onAdded }) {
  const { add } = useCart();
  const [size, setSize] = useState(p.sizes?.length === 1 ? p.sizes[0] : '');
  const [qty, setQty] = useState(1);
  const [err, setErr] = useState('');
  const off = p.mrp && Number(p.mrp) > Number(p.price) ? Math.round((1 - p.price / p.mrp) * 100) : 0;

  const onAdd = () => {
    if (p.sizes?.length && !size) return setErr('Select a size');
    setErr('');
    add({
      productId: p.id, name: p.name, price: Number(p.price), image: p.image_url,
      schoolName: school.name, schoolSlug: school.slug, itemType: p.item_type,
      className: cls || null, size: size || null, qty,
    });
    onAdded(p.name);
    setQty(1);
  };

  return (
    <div className="pcard">
      <div className="pcard-img">
        {p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" /> : <span className="mono">{itemTypeLabel(p.item_type)}</span>}
        {off > 0 && <i className="off">↓{off}%</i>}
      </div>
      <div className="pcard-body">
        <small>{itemTypeLabel(p.item_type)}</small>
        <b>{p.name}</b>
        <div className="price">{formatINR(p.price)} {off > 0 && <s>{formatINR(p.mrp)}</s>}</div>
        {p.description && <p className="desc">{p.description}</p>}
        {p.sizes?.length > 0 && (
          <div className="chips sm">
            {p.sizes.map((s) => (
              <button key={s} className={'chip' + (size === s ? ' on' : '')} onClick={() => { setSize(s); setErr(''); }}>{s}</button>
            ))}
          </div>
        )}
        {err && <p className="err">{err}</p>}
        <div className="add-row">
          <div className="qty">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Less">−</button>
            <span>{qty}</span>
            <button onClick={() => setQty((q) => Math.min(100, q + 1))} aria-label="More">+</button>
          </div>
          <button className="btn" onClick={onAdd}>Add to cart</button>
        </div>
      </div>
    </div>
  );
}

export default function SchoolShop({ school, products }) {
  const { count, subtotal } = useCart();
  const usesClasses = products.some((p) => p.classes?.length);
  const offered = useMemo(() => new Set(products.flatMap((p) => p.classes || [])), [products]);
  const [cls, setCls] = useState(null);
  const [type, setType] = useState('all');
  const [toast, setToast] = useState('');

  const visible = products.filter((p) => !usesClasses || !p.classes?.length || (cls && p.classes.includes(cls)));
  const types = ITEM_TYPES.filter((t) => visible.some((p) => p.item_type === t.key));
  const list = visible.filter((p) => type === 'all' || p.item_type === type);

  const onAdded = (name) => { setToast(name + ' added to cart'); setTimeout(() => setToast(''), 2200); };

  return (
    <div className="page">
      <div className="school-hero">
        {school.banner_url && <img className="school-banner" src={school.banner_url} alt="" />}
        <div className="school-head">
          <Link href="/" className="back" aria-label="Back"><IconBack /></Link>
          {school.logo_url && <img className="school-logo" src={school.logo_url} alt="" />}
          <div><h1>{school.name}</h1>{school.city && <small>{school.city}</small>}</div>
        </div>
      </div>

      {usesClasses && (
        <section className="block">
          <h2>1. Select class</h2>
          {CLASS_GROUPS.map((g) => {
            const avail = g.classes.filter((c) => offered.has(c));
            if (!avail.length) return null;
            return (
              <div key={g.label} className="cgroup">
                <small>{g.label}</small>
                <div className="chips">
                  {avail.map((c) => (
                    <button key={c} className={'chip' + (cls === c ? ' on' : '')} onClick={() => { setCls(c); setType('all'); }}>{c}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {(!usesClasses || cls) && (
        <section className="block">
          <h2>{usesClasses ? `2. Choose uniform — ${cls}` : 'Choose uniform'}</h2>
          {types.length > 1 && (
            <div className="tabs">
              <button className={type === 'all' ? 'on' : ''} onClick={() => setType('all')}>All</button>
              {types.map((t) => (
                <button key={t.key} className={type === t.key ? 'on' : ''} onClick={() => setType(t.key)}>{t.label}</button>
              ))}
            </div>
          )}
          {list.length === 0 ? <p className="muted">No uniforms listed yet{cls ? ' for ' + cls : ''}.</p> : (
            <div className="pgrid">
              {list.map((p) => <ProductCard key={p.id} p={p} school={school} cls={cls} onAdded={onAdded} />)}
            </div>
          )}
        </section>
      )}
      {usesClasses && !cls && <p className="muted center">Select your child&apos;s class to see uniforms.</p>}

      {toast && <div className="toast">{toast}</div>}
      {count > 0 && (
        <Link href="/cart" className="cart-bar">
          <span>{count} item{count > 1 ? 's' : ''} · {formatINR(subtotal)}</span><b>View cart →</b>
        </Link>
      )}
    </div>
  );
}

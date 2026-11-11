'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { useCart } from './CartProvider';
import { IconPin, IconSearch } from './Icons';
import { PINCODE_RE, STORE_NAME } from '@/lib/constants';

function HeaderInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { pincode, setPincode } = useCart();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(false);
  const [pin, setPin] = useState('');
  const [pinErr, setPinErr] = useState('');

  useEffect(() => { setQ(params.get('q') || ''); }, [params]);

  const onSearch = (e) => {
    e.preventDefault();
    const term = q.trim();
    if (term) router.push('/search?q=' + encodeURIComponent(term));
  };
  const savePin = (e) => {
    e.preventDefault();
    if (!PINCODE_RE.test(pin)) return setPinErr('Enter a valid 6-digit pincode');
    setPincode(pin); setEditing(false); setPinErr('');
  };

  return (
    <header className="hdr">
      <div className="hdr-top">
        <Link href="/" className="brand"><span className="brand-mark">T&amp;P</span> {STORE_NAME.replace(/^T&P\s*/, '')}</Link>
      </div>
      <button className="pin-bar" onClick={() => { setPin(pincode); setEditing(true); }}>
        <IconPin size={18} />
        {pincode ? <><b>{pincode}</b><u>Change</u></> : <u>Add delivery pincode</u>}
      </button>
      <form className="search" onSubmit={onSearch} role="search">
        <IconSearch size={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search school, college or uniform" aria-label="Search" />
      </form>

      {editing && (
        <div className="modal-back" onClick={() => setEditing(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={savePin}>
            <h3>Delivery pincode</h3>
            <input inputMode="numeric" maxLength={6} autoFocus value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 524412" />
            {pinErr && <p className="err">{pinErr}</p>}
            <div className="row-end">
              <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn">Save</button>
            </div>
          </form>
        </div>
      )}
    </header>
  );
}

export default function Header() {
  return <Suspense fallback={<header className="hdr" />}><HeaderInner /></Suspense>;
}

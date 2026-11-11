'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { useCart } from './CartProvider';
import PincodePicker from './PincodePicker';
import { IconPin, IconSearch } from './Icons';
import { PINCODE_RE } from '@/lib/constants';

function HeaderInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { location, setLocation } = useCart();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [err, setErr] = useState('');

  useEffect(() => { setQ(params.get('q') || ''); }, [params]);

  const onSearch = (e) => {
    e.preventDefault();
    const term = q.trim();
    if (term) router.push('/search?q=' + encodeURIComponent(term));
  };
  const save = () => {
    if (!PINCODE_RE.test(draft.pincode || '')) return setErr('Enter a valid 6-digit pincode');
    setLocation(draft); setEditing(false); setErr('');
  };

  return (
    <header className="hdr">
      <div className="hdr-top">
        <Link href="/" className="brand" aria-label="T&P Uniforms home">
          <img src="/logo-white.png" alt="T&P" className="brand-logo" />
          <span className="brand-name">Uniforms</span>
        </Link>
      </div>
      <button className="pin-bar" onClick={() => { setDraft(location || {}); setErr(''); setEditing(true); }}>
        <IconPin size={18} />
        {location?.pincode
          ? <span>Deliver to <b>{location.place ? location.place + ', ' : ''}{location.pincode}</b> <u>Change</u></span>
          : <u>Select delivery location</u>}
      </button>
      <form className="search" onSubmit={onSearch} role="search">
        <IconSearch size={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search school, college or uniform" aria-label="Search" />
      </form>

      {editing && (
        <div className="modal-back" onClick={() => setEditing(false)}>
          <div className="modal form" onClick={(e) => e.stopPropagation()}>
            <h3>Delivery location</h3>
            <PincodePicker value={draft} onChange={setDraft} showDetails={false} />
            {draft.district && <small className="muted">{[draft.place, draft.mandal, draft.district, draft.state].filter(Boolean).join(', ')}</small>}
            {err && <p className="err">{err}</p>}
            <div className="row-end">
              <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
              <button type="button" className="btn" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default function Header() {
  return <Suspense fallback={<header className="hdr" />}><HeaderInner /></Suspense>;
}

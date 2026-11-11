'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase';
import { useCart } from '@/components/CartProvider';
import PincodePicker from '@/components/PincodePicker';
import { ALL_CLASSES, PHONE_RE, PINCODE_RE } from '@/lib/constants';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const blankChild = () => ({ key: crypto.randomUUID(), id: null, name: '', gender: '', school_id: '', class_name: '' });
const digits = (v) => String(v || '').replace(/\D/g, '').slice(-10);

function ProfileInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/account';
  const onboarding = params.get('onboard') === '1';
  const sb = getBrowserClient();
  const { setLocation } = useCart();

  const [user, setUser] = useState(undefined);
  const [schools, setSchools] = useState([]);
  const [f, setF] = useState({ full_name: '', phone: '', alt_phone: '', email: '', address_line: '' });
  const [loc, setLoc] = useState({});
  const [kids, setKids] = useState([]);
  const [removed, setRemoved] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/login?next=/account/profile'); return; }
      const u = session.user;
      setUser(u);
      const [{ data: p }, { data: c }, { data: s }] = await Promise.all([
        sb.from('profiles').select('*').eq('id', u.id).maybeSingle(),
        sb.from('children').select('*').eq('user_id', u.id).order('created_at'),
        sb.from('schools').select('id, name, city, category:categories(slug)').eq('is_active', true).order('name'),
      ]);
      setSchools(s || []);
      setF({
        full_name: p?.full_name || u.user_metadata?.full_name || '',
        phone: digits(p?.phone || u.phone),
        alt_phone: digits(p?.alt_phone),
        email: p?.email || u.email || '',
        address_line: p?.address_line || '',
      });
      setLoc({ pincode: p?.pincode || '', place: p?.village || '', mandal: p?.mandal || '', district: p?.district || '', state: p?.state || '' });
      setKids((c || []).map((k) => ({ ...k, key: k.id, gender: k.gender || '', school_id: k.school_id || '', class_name: k.class_name || '' })));
    })();
  }, [sb, router]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setPhone = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value.replace(/\D/g, '').slice(0, 10) }));
  const setKid = (key, field, val) => setKids((ks) => ks.map((k) => (k.key === key ? { ...k, [field]: val } : k)));

  async function save(e) {
    e.preventDefault();
    setErr(''); setOk('');
    if (f.full_name.trim().length < 2) return setErr('Enter your full name');
    if (!PHONE_RE.test(f.phone)) return setErr('Enter a valid 10-digit mobile number');
    if (f.alt_phone && !PHONE_RE.test(f.alt_phone)) return setErr('Alternate mobile number is not valid');
    if (f.email && !EMAIL_RE.test(f.email.trim())) return setErr('Email is not valid');
    if (!f.address_line.trim()) return setErr('Enter house no / street');
    if (!PINCODE_RE.test(loc.pincode || '')) return setErr('Enter a valid pincode');
    if (!loc.place) return setErr('Select your village / town');
    const badKid = kids.find((k) => !k.name.trim() && (k.school_id || k.class_name));
    if (badKid) return setErr("Enter the child's name");

    setBusy(true);
    try {
      const row = {
        id: user.id,
        full_name: f.full_name.trim(), phone: f.phone, alt_phone: f.alt_phone || null,
        email: f.email.trim().toLowerCase() || null, address_line: f.address_line.trim(),
        village: loc.place, mandal: loc.mandal || null, district: loc.district || null,
        state: loc.state || null, pincode: loc.pincode,
      };
      const { error } = await sb.from('profiles').upsert(row, { onConflict: 'id' });
      if (error) throw error;

      if (removed.length) {
        const { error: dErr } = await sb.from('children').delete().in('id', removed);
        if (dErr) throw dErr;
      }
      const toRow = (k) => ({ user_id: user.id, name: k.name.trim(), gender: k.gender || null,
        school_id: k.school_id || null, class_name: k.class_name || null });
      const named = kids.filter((k) => k.name.trim());
      const fresh = named.filter((k) => !k.id).map(toRow);
      if (fresh.length) {
        const { error: cErr } = await sb.from('children').insert(fresh);
        if (cErr) throw cErr;
      }
      for (const k of named.filter((x) => x.id)) {
        const { error: uErr } = await sb.from('children').update(toRow(k)).eq('id', k.id);
        if (uErr) throw uErr;
      }

      // remember as delivery location + checkout address on this phone
      setLocation(loc);
      try {
        localStorage.setItem('tp_addr', JSON.stringify({
          name: row.full_name, phone: row.phone, email: row.email || '', line: row.address_line,
          place: loc.place, mandal: loc.mandal, district: loc.district, state: loc.state, pincode: loc.pincode,
        }));
      } catch {}

      if (onboarding || params.get('next')) return router.replace(next);
      setRemoved([]); setOk('Profile saved');
      const { data: c } = await sb.from('children').select('*').eq('user_id', user.id).order('created_at');
      setKids((c || []).map((k) => ({ ...k, key: k.id, gender: k.gender || '', school_id: k.school_id || '', class_name: k.class_name || '' })));
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  if (!user) return <div className="page center"><p className="muted">Loading…</p></div>;
  const loggedByPhone = Boolean(user.phone);

  return (
    <div className="page">
      <form className="panel form narrow" onSubmit={save}>
        <h2>{onboarding ? 'Complete your profile' : 'My profile'}</h2>
        {onboarding && <p className="notice">Just once — we&apos;ll use these details for delivery and to show the right uniforms for your children.</p>}

        <h3 className="sub">Parent details</h3>
        <label>Full name <span className="req">*</span>
          <input value={f.full_name} onChange={set('full_name')} autoComplete="name" placeholder="e.g. Ravi Kumar" />
        </label>
        <label>Mobile number <span className="req">*</span>
          <div className="phone-in"><span>+91</span>
            <input inputMode="numeric" value={f.phone} onChange={setPhone('phone')} readOnly={loggedByPhone} autoComplete="tel-national" />
          </div>
        </label>
        <label>Alternate / WhatsApp number
          <div className="phone-in"><span>+91</span>
            <input inputMode="numeric" value={f.alt_phone} onChange={setPhone('alt_phone')} />
          </div>
        </label>
        <label>Email
          <input type="email" value={f.email} onChange={set('email')} readOnly={!loggedByPhone && Boolean(user.email)} autoComplete="email" placeholder="optional" />
        </label>

        <h3 className="sub">Delivery address</h3>
        <label>House no, street, landmark <span className="req">*</span>
          <textarea rows={2} value={f.address_line} onChange={set('address_line')} autoComplete="street-address" />
        </label>
        <PincodePicker value={loc} onChange={setLoc} />
        {loc.mandal && <small className="muted">Mandal: {loc.mandal}</small>}

        <h3 className="sub">Children <small className="muted">(optional)</small></h3>
        {kids.map((k, i) => (
          <div key={k.key} className="child-card">
            <div className="child-head"><b>Child {i + 1}</b>
              <button type="button" className="link danger" onClick={() => { if (k.id) setRemoved((r) => [...r, k.id]); setKids((ks) => ks.filter((x) => x.key !== k.key)); }}>Remove</button>
            </div>
            <input placeholder="Child's name" value={k.name} onChange={(e) => setKid(k.key, 'name', e.target.value)} />
            <div className="chips">
              {['boy', 'girl'].map((g) => (
                <button type="button" key={g} className={'chip' + (k.gender === g ? ' on' : '')} onClick={() => setKid(k.key, 'gender', g)}>
                  {g === 'boy' ? 'Boy' : 'Girl'}
                </button>
              ))}
            </div>
            <select value={k.school_id} onChange={(e) => setKid(k.key, 'school_id', e.target.value)}>
              <option value="">— School / College —</option>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}{s.city ? ' – ' + s.city : ''}</option>)}
            </select>
            <select value={k.class_name} onChange={(e) => setKid(k.key, 'class_name', e.target.value)}>
              <option value="">— Class —</option>
              {ALL_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        ))}
        <button type="button" className="btn ghost" onClick={() => setKids((ks) => [...ks, blankChild()])}>+ Add child</button>

        {err && <p className="err">{err}</p>}
        {ok && <p className="ok">{ok}</p>}
        <button className="btn big" disabled={busy}>{busy ? 'Saving…' : onboarding ? 'Save & continue' : 'Save profile'}</button>
      </form>
    </div>
  );
}

export default function ProfilePage() {
  return <Suspense fallback={<div className="page" />}><ProfileInner /></Suspense>;
}

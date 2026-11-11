'use client';
import { useEffect, useRef, useState } from 'react';
import { PINCODE_RE } from '@/lib/constants';
import { detectLocation, lookupPincode } from '@/lib/location';
import { IconPin } from './Icons';

/**
 * Pincode field that fills village/town, mandal, district and state.
 * value / onChange: { pincode, place, mandal, district, state }
 */
export default function PincodePicker({ value = {}, onChange, showDetails = true }) {
  const [pin, setPin] = useState(value.pincode || '');
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [err, setErr] = useState('');
  const [manual, setManual] = useState(false);
  const looked = useRef('');
  const latest = useRef(value);
  latest.current = value;

  async function lookup(p, preferPlace) {
    looked.current = p;
    setLoading(true); setErr('');
    try {
      const d = await lookupPincode(p);
      setPlaces(d.places);
      const cur = latest.current;
      const want = (preferPlace || (cur.pincode === p ? cur.place : '') || '').toLowerCase();
      const match = d.places.find((x) => x.name.toLowerCase() === want)
        || d.places.find((x) => want && x.name.toLowerCase().includes(want))
        || (d.places.length === 1 ? d.places[0] : null);
      setManual(Boolean(want && !match));
      onChange({
        ...cur, pincode: p, district: d.district, state: d.state,
        place: match ? match.name : (want ? cur.place || preferPlace : ''),
        mandal: match ? match.mandal : cur.mandal || '',
      });
    } catch (e) {
      setPlaces([]); setManual(true); setErr(e.message);
      onChange({ ...latest.current, pincode: p });
    }
    setLoading(false);
  }

  // keep in sync when parent fills the value (e.g. from saved profile)
  useEffect(() => { if (value.pincode && value.pincode !== pin) setPin(value.pincode); }, [value.pincode]); // eslint-disable-line
  useEffect(() => { if (PINCODE_RE.test(pin) && pin !== looked.current) lookup(pin); }, [pin]); // eslint-disable-line

  async function useMyLocation() {
    setLocating(true); setErr('');
    try {
      const loc = await detectLocation();
      if (!loc.pincode) throw new Error('Could not detect your pincode. Please type it.');
      setPin(loc.pincode);
      await lookup(loc.pincode, loc.place);
    } catch (e) { setErr(e.message); }
    setLocating(false);
  }

  const pickPlace = (name) => {
    if (name === '__other') { setManual(true); onChange({ ...value, place: '', mandal: '' }); return; }
    const p = places.find((x) => x.name === name);
    setManual(false);
    onChange({ ...value, place: name, mandal: p?.mandal || value.mandal || '' });
  };

  return (
    <div className="pinpick">
      <button type="button" className="locate-btn" onClick={useMyLocation} disabled={locating}>
        <IconPin size={18} /> {locating ? 'Finding your location…' : 'Use my current location'}
      </button>
      <div className="or"><span>or enter pincode</span></div>
      <input inputMode="numeric" maxLength={6} placeholder="6-digit pincode" value={pin}
        onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setPin(v); if (v.length < 6) { looked.current = ''; setPlaces([]); } }} />
      {loading && <small className="muted">Looking up pincode…</small>}
      {err && <p className="err">{err}</p>}

      {PINCODE_RE.test(pin) && !loading && (
        <>
          {places.length > 0 && !manual ? (
            <label>Village / Town
              <select value={value.place || ''} onChange={(e) => pickPlace(e.target.value)}>
                <option value="">— select your village / town —</option>
                {places.map((p) => <option key={p.name} value={p.name}>{p.name}{p.mandal ? ` (${p.mandal})` : ''}</option>)}
                <option value="__other">Other — type it</option>
              </select>
            </label>
          ) : (
            <label>Village / Town
              <input value={value.place || ''} placeholder="Type your village / town"
                onChange={(e) => onChange({ ...value, place: e.target.value })} />
              {places.length > 0 && <button type="button" className="link" onClick={() => setManual(false)}>Choose from list</button>}
            </label>
          )}
          {showDetails && (
            <div className="two">
              <label>District<input value={value.district || ''} onChange={(e) => onChange({ ...value, district: e.target.value })} /></label>
              <label>State<input value={value.state || ''} onChange={(e) => onChange({ ...value, state: e.target.value })} /></label>
            </div>
          )}
        </>
      )}
    </div>
  );
}

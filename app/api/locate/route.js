import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// GPS coordinates → pincode + village/town, via OpenStreetMap Nominatim (free, fair-use).
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
    return NextResponse.json({ error: 'Bad location' }, { status: 400 });
  // ~100 m precision is enough and lets nearby users share the cached answer
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=en&zoom=16&lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TandP-Uniforms/1.0 (support@tandp.co.in)' },
      next: { revalidate: 604800 }, signal: AbortSignal.timeout(8000),
    });
    const d = await res.json();
    const a = d.address || {};
    const pincode = String(a.postcode || '').replace(/\s/g, '');
    return NextResponse.json({
      pincode: /^[1-9][0-9]{5}$/.test(pincode) ? pincode : '',
      place: a.village || a.town || a.city || a.suburb || a.hamlet || '',
      district: a.state_district || a.county || '',
      state: a.state || '',
    });
  } catch {
    return NextResponse.json({ error: 'Location service busy' }, { status: 503 });
  }
}

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Pincode → list of villages/towns (post offices), mandal, district, state.
// Uses India Post's public pincode directory. Results cached 1 day at Vercel's edge.
export async function GET(_req, { params }) {
  const { pin } = await params;
  if (!/^[1-9][0-9]{5}$/.test(pin)) return NextResponse.json({ error: 'Invalid pincode' }, { status: 400 });
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
      next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    const offices = Array.isArray(data) && data[0]?.Status === 'Success' ? data[0].PostOffice || [] : [];
    if (!offices.length) return NextResponse.json({ error: 'Pincode not found' }, { status: 404 });
    const seen = new Set();
    const places = offices
      .map((o) => ({ name: o.Name, mandal: o.Block && o.Block !== 'NA' ? o.Block : '' }))
      .filter((p) => !seen.has(p.name) && seen.add(p.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json(
      { pincode: pin, district: offices[0].District, state: offices[0].State, places },
      { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } },
    );
  } catch {
    return NextResponse.json({ error: 'Pincode service busy. Please type your village/town.' }, { status: 503 });
  }
}

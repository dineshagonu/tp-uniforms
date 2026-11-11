import crypto from 'crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
  Supabase "Send SMS" Auth Hook.
  Supabase generates the 6-digit OTP and calls this URL; we deliver it through an
  Indian DLT-registered SMS provider (MSG91 or 2Factor). Supabase still verifies the code.

  Supabase Dashboard → Authentication → Hooks → Send SMS hook → HTTPS
    URL:    https://YOUR-DOMAIN/api/auth/sms-hook
    Secret: copy into SEND_SMS_HOOK_SECRET (keep the full "v1,whsec_..." value)
*/

const fail = (message, code = 500) =>
  NextResponse.json({ error: { http_code: code, message } }, { status: code });

// Standard Webhooks signature check (headers: webhook-id, webhook-timestamp, webhook-signature)
function verifySignature(raw, headers) {
  const secret = (process.env.SEND_SMS_HOOK_SECRET || '').replace(/^v1,whsec_/, '');
  const id = headers.get('webhook-id');
  const ts = headers.get('webhook-timestamp');
  const sigHeader = headers.get('webhook-signature') || '';
  if (!secret || !id || !ts) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // 5-minute window
  const expected = crypto
    .createHmac('sha256', Buffer.from(secret, 'base64'))
    .update(`${id}.${ts}.${raw}`)
    .digest('base64');
  return sigHeader.split(' ').some((part) => {
    const sig = part.split(',')[1] || '';
    const a = Buffer.from(sig); const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

async function sendViaMsg91(mobile, otp) {
  // MSG91 OTP API — template must be DLT-approved and contain ##OTP##
  const url = new URL('https://control.msg91.com/api/v5/otp');
  url.searchParams.set('template_id', process.env.MSG91_TEMPLATE_ID);
  url.searchParams.set('mobile', mobile);
  url.searchParams.set('otp', otp);
  url.searchParams.set('otp_expiry', '10');
  const res = await fetch(url, {
    method: 'POST',
    headers: { authkey: process.env.MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.type === 'error') throw new Error('MSG91: ' + (data.message || res.status));
}

async function sendVia2Factor(mobile, otp) {
  // 2Factor.in — sends your OTP with a DLT-approved template
  const tpl = process.env.TWOFACTOR_TEMPLATE || 'OTP1';
  const url = `https://2factor.in/API/V1/${process.env.TWOFACTOR_API_KEY}/SMS/${mobile}/${otp}/${encodeURIComponent(tpl)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.Status !== 'Success') throw new Error('2Factor: ' + (data.Details || res.status));
}

export async function POST(req) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers)) return fail('Invalid signature', 401);

  let body;
  try { body = JSON.parse(raw); } catch { return fail('Bad payload', 400); }
  const otp = String(body?.sms?.otp || '');
  const digits = String(body?.user?.phone || '').replace(/\D/g, '');

  // Only Indian mobile numbers — blocks SMS-pumping abuse to foreign numbers
  if (!/^91[6-9]\d{9}$/.test(digits)) return fail('Only Indian mobile numbers are supported', 400);
  if (!/^\d{4,8}$/.test(otp)) return fail('Bad OTP', 400);

  try {
    if ((process.env.SMS_PROVIDER || 'msg91').toLowerCase() === '2factor') await sendVia2Factor(digits, otp);
    else await sendViaMsg91(digits, otp);
    return NextResponse.json({});
  } catch (e) {
    console.error('SMS send failed', e.message);
    return fail('Could not send SMS. Please try again.', 500);
  }
}

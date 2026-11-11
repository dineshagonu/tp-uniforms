'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase';
import { PHONE_RE } from '@/lib/constants';

// Which login tabs to show; first one opens by default.
// Vercel env NEXT_PUBLIC_LOGIN_METHODS: "email,mobile" | "mobile,email" | "mobile" | "email"
const METHODS = (process.env.NEXT_PUBLIC_LOGIN_METHODS || 'email,mobile')
  .split(',').map((m) => m.trim()).filter((m) => m === 'email' || m === 'mobile');
if (!METHODS.length) METHODS.push('email');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------------- Mobile: OTP by SMS ---------------- */
function MobileLogin({ sb, onDone }) {
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [wait, setWait] = useState(0);
  const phone = '+91' + mobile;

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function sendOtp(e) {
    e?.preventDefault();
    if (!PHONE_RE.test(mobile)) return setMsg('Enter a valid 10-digit mobile number');
    setBusy(true); setMsg('');
    const { error } = await sb.auth.signInWithOtp({ phone, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) {
      return setMsg(/rate|seconds|security|limit/i.test(error.message)
        ? 'Too many requests. Please wait a minute and try again.'
        : 'Could not send OTP. Please try again' + (METHODS.includes('email') ? ' or use Email login.' : '.'));
    }
    setSent(true); setCode(''); setWait(60);
  }

  async function verify(e) {
    e.preventDefault();
    setBusy(true); setMsg('');
    const { error } = await sb.auth.verifyOtp({ phone, token: code, type: 'sms' });
    setBusy(false);
    if (error) return setMsg('Wrong or expired OTP. Please try again.');
    onDone();
  }

  return !sent ? (
    <form onSubmit={sendOtp} className="form">
      <p className="muted">Enter your mobile number. We&apos;ll send a 6-digit OTP by SMS.</p>
      <div className="phone-in">
        <span>+91</span>
        <input inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="Mobile number"
          value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} />
      </div>
      {msg && <p className="err">{msg}</p>}
      <button className="btn big" disabled={busy || mobile.length !== 10}>{busy ? 'Sending…' : 'Get OTP'}</button>
    </form>
  ) : (
    <form onSubmit={verify} className="form">
      <p className="muted">OTP sent to <b>+91 {mobile}</b></p>
      <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Enter 6-digit OTP"
        className="otp-in" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
      {msg && <p className="err">{msg}</p>}
      <button className="btn big" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Verify & continue'}</button>
      <div className="row-between">
        <button type="button" className="link" onClick={() => { setSent(false); setMsg(''); }}>Change number</button>
        <button type="button" className="link" disabled={wait > 0 || busy} onClick={() => sendOtp()}>
          {wait > 0 ? `Resend in ${wait}s` : 'Resend OTP'}
        </button>
      </div>
    </form>
  );
}

/* ---------------- Email: password login / sign up ---------------- */
function EmailLogin({ sb, onDone }) {
  const [mode, setMode] = useState('login'); // login | signup | forgot
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [info, setInfo] = useState('');

  const go = (m) => { setMode(m); setMsg(''); setInfo(''); setPassword(''); setConfirm(''); };

  async function submit(e) {
    e.preventDefault();
    setMsg(''); setInfo('');
    const em = email.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) return setMsg('Enter a valid email address');

    if (mode === 'forgot') {
      setBusy(true);
      const { error } = await sb.auth.resetPasswordForEmail(em, { redirectTo: window.location.origin + '/reset-password' });
      setBusy(false);
      if (error) return setMsg(/rate|limit/i.test(error.message) ? 'Too many requests. Please try again later.' : error.message);
      return setInfo('If this email has an account, a password reset link has been sent. Check spam too.');
    }

    if (password.length < 6) return setMsg('Password must be at least 6 characters');

    if (mode === 'signup') {
      if (password !== confirm) return setMsg('Passwords do not match');
      setBusy(true);
      const { data, error } = await sb.auth.signUp({
        email: em, password, options: { data: { full_name: name.trim() } },
      });
      setBusy(false);
      if (error) {
        if (/registered|exists/i.test(error.message)) { go('login'); return setMsg('This email already has an account. Please log in.'); }
        return setMsg(error.message);
      }
      if (!data.session) return setInfo('Account created. Please confirm your email, then log in.');
      return onDone();
    }

    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email: em, password });
    setBusy(false);
    if (error) return setMsg(/confirm/i.test(error.message) ? 'Please confirm your email first.' : 'Wrong email or password.');
    onDone();
  }

  return (
    <form onSubmit={submit} className="form">
      {mode === 'signup' && (
        <input placeholder="Your name (parent)" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      )}
      <input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      {mode !== 'forgot' && (
        <div className="pw-in">
          <input type={show ? 'text' : 'password'} placeholder={mode === 'signup' ? 'Create password (min 6)' : 'Password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShow((s) => !s)}>{show ? 'Hide' : 'Show'}</button>
        </div>
      )}
      {mode === 'signup' && (
        <input type={show ? 'text' : 'password'} placeholder="Confirm password" autoComplete="new-password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      )}
      {msg && <p className="err">{msg}</p>}
      {info && <p className="ok">{info}</p>}
      <button className="btn big" disabled={busy}>
        {busy ? 'Please wait…' : mode === 'login' ? 'Login' : mode === 'signup' ? 'Create account' : 'Send reset link'}
      </button>
      <div className="row-between">
        {mode === 'login' && <>
          <button type="button" className="link" onClick={() => go('signup')}>New here? Create account</button>
          <button type="button" className="link" onClick={() => go('forgot')}>Forgot password?</button>
        </>}
        {mode !== 'login' && <button type="button" className="link" onClick={() => go('login')}>← Back to login</button>}
      </div>
    </form>
  );
}

function LoginInner() {
  const router = useRouter();
  const next = useSearchParams().get('next') || '/account';
  const sb = getBrowserClient();
  const [method, setMethod] = useState(METHODS[0]);
  const onDone = () => router.replace(next);

  return (
    <div className="page">
      <section className="panel form narrow">
        <h2>Login / Sign up</h2>
        {METHODS.length > 1 && (
          <div className="seg">
            {METHODS.map((m) => (
              <button key={m} type="button" className={method === m ? 'on' : ''} onClick={() => setMethod(m)}>
                {m === 'mobile' ? '📱 Mobile OTP' : '✉️ Email & password'}
              </button>
            ))}
          </div>
        )}
        {method === 'mobile' ? <MobileLogin sb={sb} onDone={onDone} /> : <EmailLogin sb={sb} onDone={onDone} />}
      </section>
    </div>
  );
}

export default function Login() {
  return <Suspense fallback={<div className="page" />}><LoginInner /></Suspense>;
}

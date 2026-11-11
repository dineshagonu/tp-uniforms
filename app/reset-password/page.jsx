'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase';

// Opened from the "reset password" email link. Supabase signs the user in from the link,
// then they choose a new password here.
export default function ResetPassword() {
  const router = useRouter();
  const sb = getBrowserClient();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => { if (s) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  async function save(e) {
    e.preventDefault();
    if (password.length < 6) return setMsg('Password must be at least 6 characters');
    if (password !== confirm) return setMsg('Passwords do not match');
    setBusy(true); setMsg('');
    const { error } = await sb.auth.updateUser({ password });
    setBusy(false);
    if (error) return setMsg(error.message);
    router.replace('/account');
  }

  return (
    <div className="page">
      <form className="panel form narrow" onSubmit={save}>
        <h2>Set a new password</h2>
        {!ready ? <p className="muted">Open this page from the reset link in your email. If the link expired, request a new one from Login → Forgot password.</p> : <>
          <input type="password" placeholder="New password (min 6)" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <input type="password" placeholder="Confirm new password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {msg && <p className="err">{msg}</p>}
          <button className="btn big" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
        </>}
      </form>
    </div>
  );
}

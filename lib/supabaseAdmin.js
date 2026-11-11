import 'server-only';
import { createClient } from '@supabase/supabase-js';

let adminClient;

/** Service-role client. Server only — bypasses RLS. */
export function getAdminClient() {
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return adminClient;
}

/** Reads "Authorization: Bearer <token>" and returns the Supabase user, or null. */
export async function getUserFromRequest(req) {
  const header = req.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await getAdminClient().auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export async function isAdminUser(userId) {
  const { data } = await getAdminClient().from('profiles').select('role').eq('id', userId).maybeSingle();
  return data?.role === 'admin';
}

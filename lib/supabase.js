import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient;

/** Browser client — keeps the customer's / admin's login session. */
export function getBrowserClient() {
  if (!browserClient) browserClient = createClient(url, anon);
  return browserClient;
}

/** Server-side public reads (home, school pages). RLS limits it to active data. */
export function getPublicServerClient() {
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

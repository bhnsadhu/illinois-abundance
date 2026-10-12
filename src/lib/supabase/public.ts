import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { hasDatabase } from '@/lib/config';
/** Dedicated anonymous client. Never attach request cookies or a service key. */
export function publicDatabase() {
  if (!hasDatabase()) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (url, init) => fetch(url, { ...init, next: { revalidate: 60, tags: ['public-content'] } }) } });
}

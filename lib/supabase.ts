import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CLIENT_CONFIG_VERSION = 2;

// Fast Refresh can evaluate this module repeatedly. Keep one browser auth client
// so refresh timers, BroadcastChannels and session subscribers share an owner.
const browser = typeof window !== 'undefined' ? window as Window & {
  __infinitySupabase?: { url: string; key: string; client: SupabaseClient; configVersion?: number };
} : undefined;
const cached = browser?.__infinitySupabase;
export const supabase = cached?.configVersion === CLIENT_CONFIG_VERSION && cached.url === supabaseUrl && cached.key === supabaseAnonKey
  ? cached.client
  : createClient(supabaseUrl, supabaseAnonKey, {
  // New SDKs also retry POST RPCs. Only explicit read queries may auto-retry;
  // an ambiguous mutation must not adjust stock or collect money twice.
  db: { retry: false },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // SDK >= 2.107 coordinates refreshes and protects session commits itself.
  },
});

if (browser) {
  if (cached && cached.client !== supabase) cached.client.auth.dispose();
  browser.__infinitySupabase = { url: supabaseUrl, key: supabaseAnonKey, client: supabase, configVersion: CLIENT_CONFIG_VERSION };
}

export const createSecondaryClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    db: { retry: false },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};

import { createClient } from '@supabase/supabase-js';
import { env } from './env';

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Custom lock handler bypasses Navigator Locks API to prevent LockAcquireTimeoutError on visibility changes
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
      return await fn();
    },
  },
});

export const createSecondaryClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
        return await fn();
      },
    },
  });
};

import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error('Configure the Supabase URL and server service-role key before running this check.');
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.from('muscles').select('id, name, muscle_group');
if (error) {
  console.error(`Muscle catalog check failed (${error.code || 'DATABASE_ERROR'}).`);
  process.exitCode = 1;
} else {
  console.log('Database muscles:', data.map(muscle => muscle.name));
}

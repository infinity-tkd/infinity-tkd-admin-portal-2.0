import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = Object.fromEntries(
  envFile.split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => line.split('='))
    .map(([k, ...v]) => [k.trim(), v.join('=').trim()])
);

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Anon key exists:', !!anonKey);
console.log('Service role key exists:', !!serviceRoleKey);

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
const publicSupabase = createClient(supabaseUrl, anonKey);

async function test() {
  console.log('\n--- 1. Testing profiles query with service role ---');
  const { data: profiles, error: profileErr } = await adminSupabase
    .from('profiles')
    .select('id, username, email, role, is_active');
  
  if (profileErr) {
    console.error('Profile query error:', profileErr);
  } else {
    console.log('Profiles found:', profiles?.length);
    console.log('Profiles sample:', profiles);
  }

  console.log('\n--- 2. Testing username-to-email lookup ---');
  if (profiles && profiles.length > 0) {
    const testUsername = profiles[0].username;
    console.log('Testing username:', testUsername);
    const { data: lookupData, error: lookupErr } = await adminSupabase
      .from('profiles')
      .select('email')
      .ilike('username', testUsername.trim())
      .maybeSingle();
    console.log('Lookup result:', lookupData, lookupErr);
  }
}

test();

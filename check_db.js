const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
let supabaseUrl = '';
let supabaseAnonKey = '';
try {
  const envPath = path.join(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const parts = line.trim().split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = val;
      if (key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') supabaseAnonKey = val;
    }
  }
} catch (e) {
  console.error('Error parsing .env.local:', e);
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing env vars!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('Testing profile_picture_path column in students table...');
  const { data: stData, error: stErr } = await supabase.from('students').select('profile_picture_path').limit(1);
  if (stErr) {
    console.log('Students column test failed:', stErr.message);
  } else {
    console.log('Students column test succeeded! Column exists.');
  }

  console.log('Testing profile_picture_path column in members table...');
  const { data: memData, error: memErr } = await supabase.from('members').select('profile_picture_path').limit(1);
  if (memErr) {
    console.log('Members column test failed:', memErr.message);
  } else {
    console.log('Members column test succeeded! Column exists.');
  }
}

main().catch(console.error);

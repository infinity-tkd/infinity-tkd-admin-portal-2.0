import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = Object.fromEntries(
  envFile.split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => line.split('='))
    .map(([k, ...v]) => [k.trim(), v.join('=').trim()])
);

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

async function testFetch() {
  console.log('Fetching from Supabase REST API...');
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id,username,email,role,is_active`, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });
    console.log('HTTP Status:', res.status);
    const data = await res.json();
    console.log('Profiles returned:', data);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testFetch();

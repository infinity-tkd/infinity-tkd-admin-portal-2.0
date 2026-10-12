import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Configure Supabase URL and service role key before checking database readiness.');
// Read metadata only: no login attempts, credentials, row data or database writes.
const response = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' },
  signal: AbortSignal.timeout(15000),
});
if (!response.ok) throw new Error(`Database metadata request failed (${response.status}).`);
const schema = await response.json();
const loginOnly = process.argv.includes('--login-only');
const authOnly = process.argv.includes('--auth-only');
const startupOnly = process.argv.includes('--startup-only');
const functions = loginOnly || authOnly ? ['portal_take_rate_slot'] : ['portal_take_rate_slot', 'portal_record_payments', 'portal_delete_class', 'portal_record_body_composition', 'portal_record_household_payment', 'portal_save_library_asset', 'portal_save_achievements'];
const checks = startupOnly ? {} : Object.fromEntries(functions.map(name => [name, Boolean(schema.paths?.[`/rpc/${name}`])]));
if (!loginOnly && !startupOnly) checks['profiles.must_change_password'] = Boolean(schema.definitions?.profiles?.properties?.must_change_password);
if (startupOnly || (!loginOnly && !authOnly)) {
  const tables = ['profiles', 'members', 'students', 'branches', 'class_sessions', 'class_enrollments',
    'scholarships', 'attendance', 'payments', 'belt_histories', 'achievements', 'library_assets', 'lms_progress',
    'workout_templates', 'student_physical_evaluations', 'belt_techniques', 'muscles', 'library_asset_muscles',
    'student_body_compositions', 'academy_profile', 'role_permissions', 'user_permissions', 'staff_dan_history',
    'partners', 'payment_transactions'];
  const compound = {role_permissions:'role.asc,permission_key.asc', user_permissions:'user_id.asc,permission_key.asc', library_asset_muscles:'asset_id.asc,muscle_id.asc'};
  // Validate real query shapes, including joins and ordering, without downloading any rows.
  const results = await Promise.all(tables.map(async table => {
    const query = new URL(`${url}/rest/v1/${table}`);
    query.searchParams.set('select', table === 'members' ? '*,member_addresses(*)' : table === 'students' ? '*,student_addresses(*)' : '*');
    query.searchParams.set('limit', '0');
    if (table !== 'academy_profile') query.searchParams.set('order', compound[table] || (table === 'staff_dan_history' ? 'dan_level.asc,id.asc' : table === 'partners' ? 'created_at.desc,id.asc' : 'id.asc'));
    try {
      const result = await fetch(query, {headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000)});
      const body = await result.json();
      return {table,ok:result.ok,code:result.ok ? undefined : body.code || `HTTP_${result.status}`};
    } catch { return {table,ok:false,code:'NETWORK_FAILURE'}; }
  }));
  for (const result of results) checks[`startup:${result.table}`] = result.ok;
  console.log(JSON.stringify({ startupFailures: results.filter(result => !result.ok).map(({table,code}) => ({table,code})) }, null, 2));
}
console.log(JSON.stringify({ scope: startupOnly ? 'startup query schemas (service role; user access not checked)' : loginOnly ? 'login' : authOnly ? 'authenticated API' : 'portal', checks, ready: Object.values(checks).every(Boolean) }, null, 2));
if (Object.values(checks).some(value => !value)) process.exitCode = 1;

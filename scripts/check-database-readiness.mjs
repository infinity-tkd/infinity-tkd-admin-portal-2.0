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
const functions = loginOnly || authOnly ? ['portal_take_rate_slot'] : ['portal_take_rate_slot', 'portal_record_payments', 'portal_delete_class', 'portal_record_body_composition', 'portal_record_household_payment', 'portal_save_library_asset', 'portal_save_achievements', 'portal_create_student', 'portal_update_student_with_enrollment', 'portal_provision_user', 'portal_update_user'];
if(!loginOnly&&!authOnly)functions.push('portal_change_billing_schedule','portal_record_makeup','portal_void_makeup','portal_claim_notification_refresh','portal_claim_push');
if(!loginOnly&&!authOnly)functions.push('portal_operations_mutate','portal_claim_job','portal_process_membership_dates','portal_place_counter_order');
if(!loginOnly&&!authOnly)functions.push('portal_permission_default','portal_permission_allowed','portal_has_permission','portal_assert_actor');
if(!loginOnly&&!authOnly)functions.push('portal_adjust_inventory_once','portal_transition_order','portal_library_catalog','portal_save_workout_draft');
const checks = startupOnly ? {} : Object.fromEntries(functions.map(name => [name, Boolean(schema.paths?.[`/rpc/${name}`])]));
if (!loginOnly && !startupOnly) checks['profiles.must_change_password'] = Boolean(schema.definitions?.profiles?.properties?.must_change_password);
if (startupOnly || (!loginOnly && !authOnly)) {
  checks['students.telegram_username'] = Boolean(schema.definitions?.students?.properties?.telegram_username);
  checks['members.telegram_username'] = Boolean(schema.definitions?.members?.properties?.telegram_username);
  checks['students.membership_start_date'] = Boolean(schema.definitions?.students?.properties?.membership_start_date);
  checks['students.billing_schedule'] = Boolean(schema.definitions?.students?.properties?.billing_schedule);
  checks['students.approved_pause_id'] = Boolean(schema.definitions?.students?.properties?.approved_pause_id);
  for(const column of ['revision','published_revision','student_curriculum_id'])checks[`library_assets.${column}`]=Boolean(schema.definitions?.library_assets?.properties?.[column]);
  for(const column of ['content_type','content_category','learning_content'])checks[`curriculum.${column}`]=Boolean(schema.definitions?.curriculum?.properties?.[column]);
  checks['pos_orders.payment_recorded_at'] = Boolean(schema.definitions?.pos_orders?.properties?.payment_recorded_at);
  const tables = ['profiles', 'members', 'students', 'branches', 'class_sessions', 'class_enrollments',
    'scholarships', 'attendance', 'payments', 'belt_histories', 'achievements', 'library_assets', 'lms_progress',
    'workout_templates', 'student_physical_evaluations', 'belt_techniques', 'muscles', 'library_asset_muscles',
    'student_body_compositions', 'academy_profile', 'role_permissions', 'user_permissions', 'staff_dan_history',
    'partners', 'payment_transactions','membership_schedule_changes','makeup_attendance','portal_notifications','portal_notification_preferences','portal_push_subscriptions','portal_push_deliveries','portal_notification_refresh'];
  tables.push('portal_job_runs','portal_job_leases','academy_operations_policy','membership_pauses','class_enrollment_history','class_membership_periods','academy_holidays','class_occurrences','class_occurrence_roster','membership_invoices','membership_receipts','membership_allocations','membership_credits','membership_credit_uses','payment_reconciliation_lines','followup_tasks','student_activity_events','grading_events','grading_candidates','portal_performance_samples','data_quality_reviews','portal_operation_requests');
  tables.push('workout_template_drafts','portal_workout_commands','portal_workout_management','portal_inventory_requests');
  const compound = {role_permissions:'role.asc,permission_key.asc', user_permissions:'user_id.asc,permission_key.asc', library_asset_muscles:'asset_id.asc,muscle_id.asc',portal_notification_preferences:'user_id.asc',portal_push_deliveries:'notification_id.asc,subscription_id.asc',portal_notification_refresh:'user_id.asc',membership_allocations:'receipt_id.asc,invoice_id.asc',portal_job_leases:'job_name.asc',class_occurrence_roster:'occurrence_id.asc,student_id.asc',data_quality_reviews:'finding_key.asc',portal_operation_requests:'request_key.asc'};
  compound.portal_workout_commands='request_key.asc';compound.portal_inventory_requests='actor_id.asc,request_key.asc';
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

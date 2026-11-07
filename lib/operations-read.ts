import type { SupabaseClient } from '@supabase/supabase-js';
import { callerHasPermission, type CallerSecurityContext } from './backend-security';
import { academyDate, addCalendarDays, daysBetween, isCalendarDate } from './dates';
import { featureRows } from './operations-server';
import { invoiceOutstanding } from './operations-contract';
import { pushConfiguration } from './notifications-server';

export async function readOperations(client: SupabaseClient, actor: CallerSecurityContext, params: URLSearchParams) {
  const view = params.get('view') ?? 'today';
  const permission = ({ today: 'page:dashboard', tasks: 'page:dashboard', sessions: 'page:schedule', billing: 'page:financials', reconciliation: 'page:financials', timeline: 'page:directory', grading: 'page:lms', health: 'page:settings', quality: 'page:settings', performance: 'page:settings', policy: 'page:settings' } as Record<string, string>)[view];
  if (!permission || !(await callerHasPermission(client, actor, permission) || view === 'sessions' && await callerHasPermission(client, actor, 'page:attendance'))) throw { code: '42501', message: 'Operation access denied.' };
  const administrator = ['Root', 'Super Root', 'Admin'].includes(actor.role);
  if (view === 'quality' && !administrator) throw { code: '42501', message: 'Administrator access required.' };
  const today = academyDate();
  const from = params.get('from') ?? addCalendarDays(today, -7), to = params.get('to') ?? addCalendarDays(today, 30);
  if (!isCalendarDate(from) || !isCalendarDate(to) || from > to || daysBetween(from, to) > 93) throw { code: '22023', message: 'Choose a range up to 93 days.' };
  const studentId = params.get('studentId');
  if (['billing', 'timeline'].includes(view) && !/^STU-[MF]-\d+$/.test(studentId ?? '')) throw { code: '22023', message: 'Choose a student.' };
  const limited = async (query: any) => { const result = await query.abortSignal(AbortSignal.timeout(15000)); if (result.error) throw result.error; return result.data ?? []; };
  if (view === 'policy') return limited(client.from('academy_operations_policy').select('*').eq('id', 'default'));
  if (view === 'health') {
    const [runs, leases, failures] = await Promise.all([
      limited(client.from('portal_job_runs').select('*').order('started_at', { ascending: false }).limit(50)),
      limited(client.from('portal_job_leases').select('*')),
      limited(client.from('portal_push_deliveries').select('attempts,next_attempt_at,last_error_code').is('sent_at', null).gt('attempts', 0).limit(100)),
    ]);
    return { serverTime: new Date().toISOString(), runs, leases, failures, workerConfigured: Boolean((process.env.NOTIFICATION_JOB_SECRET?.length ?? 0) >= 32 && process.env.APP_URL), pushConfigured: pushConfiguration().ready };
  }
  if (view === 'tasks' || view === 'today') {
    const allowed = new Set(['general']);
    for (const [category, key] of [['billing', 'page:financials'], ['attendance', 'page:attendance'], ['orders', 'page:pos']]) if (await callerHasPermission(client, actor, key)) allowed.add(category);
    let query = client.from('followup_tasks').select('*').in('category', [...allowed]).order('due_date').order('id').limit(200);
    if (params.get('includeClosed') !== 'true') query = query.in('status', ['open', 'in_progress']);
    if (!administrator) query = query.eq('assigned_to', actor.userId);
    const tasks = (await limited(query)).filter((row: any) => allowed.has(row.category));
    const notices = await limited(client.from('portal_notifications').select('id,title,body,href,category,permission_key,created_at').eq('user_id', actor.userId).is('resolved_at', null).is('dismissed_at', null).is('read_at', null).order('created_at', { ascending: false }).limit(50));
    const filtered = [];
    for (const row of notices) if (!row.permission_key || await callerHasPermission(client, actor, row.permission_key)) filtered.push(row);
    return { tasks, notices: filtered, today };
  }
  if (view === 'sessions') {
    const sessions = await limited(client.from('class_occurrences').select('*').gte('starts_at', from + 'T00:00:00+07:00').lt('starts_at', addCalendarDays(to, 1) + 'T00:00:00+07:00').order('starts_at').limit(200));
    const ids = sessions.map((row: any) => row.id);
    const [roster, attendance, holidays] = await Promise.all([
      ids.length ? featureRows(client.from('class_occurrence_roster').select('*').in('occurrence_id', ids)) : [],
      await callerHasPermission(client,actor,'page:attendance')?featureRows(client.from('attendance').select('id,student_id,class_id,date,status,occurrence_id').gte('date', from).lte('date', to)):[],
      limited(client.from('academy_holidays').select('*').is('voided_at', null).gte('end_date', from).lte('start_date', to).limit(100)),
    ]);
    return { sessions, roster, attendance, holidays };
  }
  if (view === 'billing') {
    const [invoices, receipts, credits, pauses, policy] = await Promise.all([
      limited(client.from('membership_invoices').select('*').eq('student_id', studentId).order('cycle_month', { ascending: false }).limit(120)),
      limited(client.from('membership_receipts').select('*').eq('student_id', studentId).order('created_at', { ascending: false }).limit(200)),
      featureRows(client.from('membership_credits').select('*').eq('student_id', studentId)),
      featureRows(client.from('membership_pauses').select('*').eq('student_id', studentId)),
      limited(client.from('academy_operations_policy').select('*').eq('id', 'default')),
    ]);
    const ids = invoices.map((row: any) => row.id), creditIds = credits.map(row => row.id);
    const [allocations, uses] = await Promise.all([
      ids.length ? featureRows(client.from('membership_allocations').select('*').in('invoice_id', ids)) : [],
      creditIds.length ? featureRows(client.from('membership_credit_uses').select('*').in('credit_id', creditIds)) : [],
    ]);
    return { invoices: invoices.map((row: any) => ({ ...row, balance: invoiceOutstanding(row, allocations, uses) })), receipts, credits: credits.map(row => ({ ...row, balance: (Math.round(Number(row.amount_usd) * 100) - uses.filter(use => use.credit_id === row.id).reduce((sum, use) => sum + Math.round(Number(use.amount_usd) * 100), 0)) / 100 })), pauses, policy: policy[0], allocations, uses };
  }
  if (view === 'reconciliation') {
    const [lines, receipts, allReceipts, legacy, projected] = await Promise.all([
      limited(client.from('payment_reconciliation_lines').select('*').gte('transaction_date', from).lte('transaction_date', to).order('transaction_date', { ascending: false }).limit(500)),
      limited(client.from('membership_receipts').select('*').neq('payment_method', 'Cash').gte('payment_date', from).lte('payment_date', to).order('payment_date', { ascending: false }).limit(500)),
      featureRows(client.from('membership_receipts').select('id,amount_usd').gte('payment_date',from).lte('payment_date',to)),
      featureRows(client.from('payment_transactions').select('id,student_id,year,for_month,amount_usd').gte('payment_date',from).lte('payment_date',to)),
      featureRows(client.from('payments').select('id,student_id,year,for_month,amount_usd,notes').eq('status','Paid').gte('payment_date',from).lte('payment_date',to)),
    ]);
    const covered=new Set(legacy.map(row=>`${row.student_id}:${row.year}:${row.for_month}`));
    const historical=legacy.reduce((sum,row)=>sum+Number(row.amount_usd),0)+projected.filter(row=>!covered.has(`${row.student_id}:${row.year}:${row.for_month}`)&&!String(row.notes??'').startsWith('INV-')).reduce((sum,row)=>sum+Number(row.amount_usd),0);
    const newCash=allReceipts.reduce((sum,row)=>sum+Number(row.amount_usd),0);
    return { lines, receipts,collections:{total:Math.round((historical+newCash)*100)/100,legacy:historical,receipts:newCash} };
  }
  if (view === 'timeline') {
    const categories = ['profile', 'enrollment'];
    if (await callerHasPermission(client, actor, 'page:attendance')) categories.push('attendance');
    if (await callerHasPermission(client, actor, 'page:financials')) categories.push('billing');
    if (await callerHasPermission(client, actor, 'page:lms')) categories.push('grading');
    const [events, enrollmentHistory] = await Promise.all([
      limited(client.from('student_activity_events').select('*').eq('student_id', studentId).in('category', categories).order('created_at', { ascending: false }).limit(100)),
      limited(client.from('class_enrollment_history').select('id,class_id,event_type,recorded_by,created_at').eq('student_id', studentId).order('created_at', { ascending: false }).limit(100)),
    ]); return { events, enrollmentHistory };
  }
  if (view === 'grading') return {
    events: await limited(client.from('grading_events').select('*,belts(belt_name),candidates:grading_candidates(*)').order('exam_date', { ascending: false }).limit(50)),
    belts: await limited(client.from('belts').select('*').order('belt_order')),
  };
  if (view === 'performance') {
    const rows = await limited(client.from('portal_performance_samples').select('page,metric,value,device,recorded_at').gte('recorded_at', from + 'T00:00:00+07:00').lt('recorded_at', addCalendarDays(to, 1) + 'T00:00:00+07:00').order('recorded_at', { ascending: false }).limit(1000));
    const groups = new Map<string, number[]>();
    for (const row of rows) { const key = `${row.page}|${row.device}|${row.metric}`; groups.set(key, [...groups.get(key) ?? [], Number(row.value)]); }
    return [...groups].map(([key, values]) => { values.sort((a, b) => a - b); const [page, device, metric] = key.split('|'); return { page, device, metric, samples: values.length, p75: values[Math.max(0, Math.ceil(values.length * 0.75) - 1)] }; });
  }
  if (view === 'quality') {
    const [students, payments, classes, enrollments, profiles, reviews] = await Promise.all([
      featureRows(client.from('students').select('id,profile_id,student_status,deleted_at')),
      featureRows(client.from('payments').select('id,student_id,status,payment_date')),
      featureRows(client.from('class_sessions').select('id,class_name,capacity')),
      featureRows(client.from('class_enrollments').select('id,student_id,class_id')),
      featureRows(client.from('profiles').select('id,student_id,is_active')),
      featureRows(client.from('data_quality_reviews').select('*')),
    ]);
    const findings: { key: string; title: string; record: string; explanation: string }[] = [];
    for (const row of payments) if (['Paid', 'Waived'].includes(row.status) && !row.payment_date) findings.push({ key: `payment_date:${row.id}`, title: 'Missing historical settlement date', record: row.student_id, explanation: 'Reconcile using original evidence. Do not invent a payment date.' });
    for (const lesson of classes) { const count = enrollments.filter(e => e.class_id === lesson.id && students.some(s => s.id === e.student_id && s.student_status === 'Active' && !s.deleted_at)).length; if (count > lesson.capacity) findings.push({ key: `capacity:${lesson.id}`, title: lesson.class_name, record: String(lesson.id), explanation: `${count} active enrollments exceed capacity ${lesson.capacity}. Review the roster.` }); }
    for (const row of students) if (row.profile_id && profiles.some(p => p.id === row.profile_id && p.student_id && p.student_id !== row.id)) findings.push({ key: `account_link:${row.id}`, title: 'Conflicting account link', record: row.id, explanation: 'The account points to another student. Verify identity before correcting it.' });
    return { findings: findings.map(row => ({ ...row, review: reviews.find(review => review.finding_key === row.key) ?? null })), checkedAt: new Date().toISOString() };
  }
  throw { code: '22023', message: 'Unknown operations view.' };
}

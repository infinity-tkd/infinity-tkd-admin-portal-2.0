import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';
import type { beltTestViewSchema } from './belt-test-contract';
import { libraryUsageRows, studentTestRows } from './belt-test-links';

type View = z.infer<typeof beltTestViewSchema>;
const numeric = (value: unknown) => value == null ? null : Number(value);
const asRows = <T>(result: { data: T[] | null; error: unknown }) => { if (result.error) throw result.error; return result.data ?? []; };

/** Numeric columns arrive from PostgREST as strings; normalise once here. */
function syllabusRow(row: Record<string, any>) {
  return { ...row, pass_mark: numeric(row.pass_mark), distinction_mark: numeric(row.distinction_mark), section_minimum: numeric(row.section_minimum), critical_minimum: numeric(row.critical_minimum) };
}
async function syllabusDetail(client: SupabaseClient, id: string) {
  const syllabus = await client.from('belt_test_syllabi').select('*').eq('id', id).maybeSingle();
  if (syllabus.error) throw syllabus.error;
  if (!syllabus.data) throw Object.assign(new Error('The belt test syllabus was not found.'), { code: 'P0002' });
  const sections = asRows(await client.from('belt_test_sections').select('*').eq('syllabus_id', id).order('position'));
  const items = sections.length ? asRows(await client.from('belt_test_items').select('*').in('section_id', sections.map(row => row.id)).order('position')) : [];
  return {
    syllabus: syllabusRow(syllabus.data),
    sections: sections.map(row => ({ ...row, weight: numeric(row.weight), minimum: numeric(row.minimum) })),
    items: items.map(row => ({ ...row, weight: Number(row.weight) })),
  };
}

export async function readBeltTests(client: SupabaseClient, view: View) {
  if (view.view === 'overview') {
    const [belts, syllabi, events, candidates] = await Promise.all([
      client.from('belts').select('id,belt_name,belt_order,belt_type').order('belt_order'),
      client.from('belt_test_syllabi').select('*').order('target_belt_id').order('version', { ascending: false }).limit(200),
      client.from('grading_events').select('id,title,kind,exam_date,start_time,location,branch_id,target_belt_id,syllabus_id,published_at,cancelled_at,results_published_at').not('syllabus_id', 'is', null).order('exam_date', { ascending: false }).limit(100),
      client.from('grading_candidates').select('event_id,status,grading_events!inner(syllabus_id)').not('grading_events.syllabus_id', 'is', null).limit(5000),
    ]);
    const counts = new Map<string, Record<string, number>>();
    for (const row of asRows(candidates) as { event_id: string; status: string }[]) {
      const entry = counts.get(row.event_id) ?? {}; entry[row.status] = (entry[row.status] ?? 0) + 1; counts.set(row.event_id, entry);
    }
    return { belts: asRows(belts), syllabi: asRows(syllabi).map(syllabusRow), events: asRows(events).map(row => ({ ...row, counts: counts.get(row.id) ?? {} })) };
  }
  if (view.view === 'syllabus') return syllabusDetail(client, view.id);
  if (view.view === 'eligibility') {
    const { data, error } = await client.rpc('portal_belt_test_eligibility_list', { p_syllabus: view.syllabusId });
    if (error) throw error;
    return { students: data ?? [] };
  }
  if (view.view === 'library_usage') {
    const syllabi = asRows(await client.from('belt_test_syllabi').select('id,target_belt_id,track,status,version').in('status', ['draft', 'published']).limit(100));
    if (!syllabi.length) return { usage: [] };
    const sections = asRows(await client.from('belt_test_sections').select('id,syllabus_id,title').in('syllabus_id', syllabi.map(row => row.id)));
    const items = sections.length ? asRows(await client.from('belt_test_items').select('section_id,title,library_asset_id').in('section_id', sections.map(row => row.id)).not('library_asset_id', 'is', null)) : [];
    const belts = asRows(await client.from('belts').select('id,belt_name'));
    return { usage: libraryUsageRows(syllabi, sections, items, belts) };
  }
  if (view.view === 'student_tests') {
    const rows = asRows(await client.from('grading_candidates')
      .select('id,event_id,status,result,overall_percent,section_results,poom_or_dan,certificate_no,grading_events!inner(title,kind,exam_date,syllabus_id,results_published_at,cancelled_at,belts(belt_name))')
      .eq('student_id', view.studentId).not('grading_events.syllabus_id', 'is', null).neq('status', 'withdrawn').limit(50));
    return { tests: studentTestRows(rows as Record<string, any>[]) };
  }
  if (view.view === 'eligibility_all') {
    // One published syllabus per belt, so each student appears at most once (for their next belt).
    const published = asRows(await client.from('belt_test_syllabi').select('id').eq('status', 'published').limit(20));
    const entries: Record<string, unknown> = {};
    for (const syllabus of published) {
      const { data, error } = await client.rpc('portal_belt_test_eligibility_list', { p_syllabus: syllabus.id });
      if (error) throw error;
      for (const row of (data ?? []) as { studentId: string; eligibility: unknown }[]) entries[row.studentId] = row.eligibility;
    }
    return { entries };
  }
  const event = await client.from('grading_events').select('id,title,kind,exam_date,start_time,location,branch_id,target_belt_id,syllabus_id,published_at,cancelled_at,results_published_at').eq('id', view.id).not('syllabus_id', 'is', null).maybeSingle();
  if (event.error) throw event.error;
  if (!event.data) throw Object.assign(new Error('The test day was not found.'), { code: 'P0002' });
  const detail = await syllabusDetail(client, event.data.syllabus_id);
  const belt = await client.from('belts').select('belt_name').eq('id', event.data.target_belt_id).maybeSingle();
  if (belt.error) throw belt.error;
  const candidates = asRows(await client.from('grading_candidates').select('*,student:students(english_name,khmer_name,current_belt)').eq('event_id', view.id).order('registered_at'));
  const scores = candidates.length ? asRows(await client.from('grading_item_scores').select('*').in('candidate_id', candidates.map(row => row.id))) : [];
  const examinerIds = [...new Set(scores.map(row => row.scored_by))];
  const examiners = examinerIds.length ? asRows(await client.from('profiles').select('id,display_name').in('id', examinerIds)) : [];
  return {
    ...detail, event: event.data, targetBelt: belt.data?.belt_name ?? '',
    candidates: candidates.map(row => ({ ...row, overall_percent: numeric(row.overall_percent), score: numeric(row.score) })),
    scores: scores.map(row => ({ ...row, score: Number(row.score) })),
    examiners: Object.fromEntries(examiners.map(row => [row.id, row.display_name])),
  };
}

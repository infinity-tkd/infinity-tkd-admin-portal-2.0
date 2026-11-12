import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

// The Coaching route's read views, on an in-memory stand-in for the Supabase
// query builder (filters, ordering with Postgres null placement, limits).
function fakeClient(tables, log) {
  return {
    from(table) {
      let rows = [...(tables[table] ?? [])];
      const request = { table, filters: [] };
      const builder = {
        select: () => builder,
        eq(column, value) { rows = rows.filter(row => row[column] === value); request.filters.push(['eq', column, value]); return builder; },
        in(column, values) { rows = rows.filter(row => values.includes(row[column])); request.filters.push(['in', column, values.length]); return builder; },
        order(column, { ascending = true, nullsFirst } = {}) {
          const nullFirst = nullsFirst ?? !ascending; // Postgres: ASC NULLS LAST, DESC NULLS FIRST
          rows.sort((a, b) => {
            const x = a[column], y = b[column];
            if (x == null || y == null) return x == null && y == null ? 0 : (x == null) === nullFirst ? -1 : 1;
            return (x < y ? -1 : x > y ? 1 : 0) * (ascending ? 1 : -1);
          });
          return builder;
        },
        limit(n) { rows = rows.slice(0, n); return builder; },
        then(resolve, reject) { log.push(request); return Promise.resolve({ data: rows, error: null }).then(resolve, reject); },
      };
      return builder;
    },
  };
}

function routeWith(tables, log) {
  return loadTs('app/api/admin/lms/route.ts', {
    '@/lib/backend-security': { verifyCaller: async () => ({ context: { userId: 'coach', role: 'Coach' }, adminSupabase: fakeClient(tables, log) }), validateRequestBody: async () => ({}) },
    '@/lib/operations-errors': { operationsError: () => Response.json({ success: false, error: { message: 'GENERIC' } }, { status: 500 }) },
  });
}

const day = (n, base = '2026-11-01') => new Date(Date.parse(`${base}T00:00:00Z`) + n * 60000).toISOString();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('review: waiting work is never pushed off by newer reviewed work, and the longest-waiting comes first', async () => {
  const submission = (n, status, at) => ({ id: id(n), student_id: `STU-${n}`, assignment_id: null, status, submitted_at: at, kind: 'video', video_path: `stu/${n}.mp4` });
  const student_submissions = [
    submission(1, 'submitted', '2026-10-01T03:00:00Z'), submission(2, 'submitted', '2026-11-10T03:00:00Z'), submission(3, 'submitted', '2026-11-05T03:00:00Z'),
    // A busy month: 300 reviewed and returned submissions, all newer than the oldest one still waiting.
    ...Array.from({ length: 300 }, (_, i) => submission(100 + i, i % 3 ? 'reviewed' : 'returned', day(i))),
    submission(999, 'withdrawn', day(500)),
  ];
  const submission_reviews = student_submissions.filter(s => s.status !== 'submitted').map((s, i) => ({ id: id(5000 + i), submission_id: s.id, created_at: s.submitted_at }));
  const form = (n, status, requested, reviewed) => ({ student_id: `STU-${n}`, form_id: id(n), status, review_requested_at: requested, reviewed_at: reviewed });
  const student_form_progress = [
    form(1, 'ready_for_review', '2026-09-20T00:00:00Z', null),
    ...Array.from({ length: 400 }, (_, i) => form(10 + i, 'mastered', day(i, '2026-10-01'), day(i + 1, '2026-10-01'))),
    form(2, 'learning', null, null),
  ];
  const log = [];
  const route = routeWith({ student_submissions, submission_reviews, student_form_progress }, log);
  const response = await route.GET(new Request('http://portal.test/api/admin/lms?view=review'));
  assert.equal(response.status, 200);
  const { data } = await response.json();

  // All three waiting submissions, oldest first, then the 100 most recent reviewed ones.
  assert.deepEqual(data.submissions.slice(0, 3).map(s => s.id), [id(1), id(3), id(2)]);
  assert.equal(data.submissions.length, 103);
  assert.ok(data.submissions.slice(3).every(s => ['reviewed', 'returned'].includes(s.status)));
  assert.equal(data.submissions[3].submitted_at, day(299), 'reviewed work is newest first');
  // The storage path never reaches the browser; reviews are attached to their submission.
  assert.ok(data.submissions.every(s => !('video_path' in s) && s.hasVideo === true));
  assert.equal(data.submissions[3].reviews.length, 1);
  // Review ids go in the URL: asked for in batches of at most 100.
  const reviewReads = log.filter(r => r.table === 'submission_reviews');
  assert.deepEqual(reviewReads.map(r => r.filters.find(f => f[0] === 'in')[2]), [100, 3]);

  // The form check asked for in September is first, ahead of 400 newer mastered forms.
  assert.equal(data.forms[0].form_id, id(1));
  assert.equal(data.forms[0].status, 'ready_for_review');
  assert.equal(data.forms.length, 101);
  assert.ok(!data.forms.some(f => f.status === 'learning'));
});

test('review: an empty queue reads no reviews', async () => {
  const log = [];
  const route = routeWith({}, log);
  const { data } = await (await route.GET(new Request('http://portal.test/api/admin/lms?view=review'))).json();
  assert.deepEqual(data, { submissions: [], forms: [] });
  assert.equal(log.filter(r => r.table === 'submission_reviews').length, 0);
});

test('an unknown view is refused before any read', async () => {
  const log = [];
  const route = routeWith({}, log);
  const response = await route.GET(new Request('http://portal.test/api/admin/lms?view=everything'));
  assert.equal(response.status, 422);
  assert.equal(log.length, 0);
});

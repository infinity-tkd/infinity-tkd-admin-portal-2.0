import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as zod from 'zod';
import { loadTs } from './load-ts.mjs';

// The schema the student portal team pastes (docs/student-portal/library-v2-contract.example.ts.txt)
// must accept every sample response the admin portal produces.
const dir = 'docs/student-portal/library-v2-samples';
function studentContract() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'library-v2-')), 'library-v2-contract.ts');
  fs.writeFileSync(file, fs.readFileSync('docs/student-portal/library-v2-contract.example.ts.txt', 'utf8'));
  return loadTs(file, { zod });
}
const strip = envelope => { const { subjectStudentId: _subject, contractVersion: _version, ...data } = envelope.data; return data; };

test('handoff: the student portal schema accepts every sample response, keeping every section', () => {
  const contract = studentContract();
  const files = fs.readdirSync(dir).filter(name => name.endsWith('.json'));
  assert.ok(files.length >= 7);
  for (const name of files) {
    const envelope = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    assert.equal(envelope.success, true);
    assert.equal(envelope.data.contractVersion, 'library-v2');
    const data = strip(envelope);
    const parsed = (name.startsWith('page') ? contract.libraryPageSchema : contract.libraryLessonResponseSchema).safeParse(data);
    assert.ok(parsed.success, `${name}: ${JSON.stringify(parsed.error?.issues?.slice(0, 2))}`);
    if (!name.startsWith('page')) assert.equal(parsed.data.lesson.sections.length, data.lesson.sections.length, `${name}: no section is dropped`);
  }
});

test('handoff: unknown section types and new fields never fail a lesson', () => {
  const contract = studentContract();
  const data = strip(JSON.parse(fs.readFileSync(path.join(dir, 'lesson-taegeuk-1-il-jang-en.json'), 'utf8')));
  const lesson = { ...data.lesson, sections: [...data.lesson.sections, { id: 'future', type: 'quiz', title: 'A later type', questions: [] }], futureField: true };
  const parsed = contract.libraryLessonResponseSchema.parse({ lang: 'en', lesson });
  assert.equal(parsed.lesson.sections.length, data.lesson.sections.length);
  assert.ok(parsed.lesson.sections.some(section => section.type === 'diagram'), 'the poomsae diagram is kept');
});

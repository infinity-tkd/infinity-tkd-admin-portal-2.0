import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { studentPortalOrigin, studentPasswordResetUrl } = loadTs('lib/student-portal-url.ts');

test('student password reset links open the configured student portal only', () => {
  assert.equal(studentPasswordResetUrl('https://students.example.com/some/path'), 'https://students.example.com/reset-password');
  assert.equal(studentPasswordResetUrl('http://localhost:3000'), 'http://localhost:3000/reset-password');
  assert.equal(studentPortalOrigin('http://students.example.com'), null, 'plain HTTP is refused outside local development');
  assert.equal(studentPortalOrigin('javascript:alert(1)'), null);
  assert.equal(studentPortalOrigin('not a url'), null);
  assert.equal(studentPasswordResetUrl(''), null);
});

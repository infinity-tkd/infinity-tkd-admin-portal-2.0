import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { normalizeTelegramUsername, contactLinks } = loadTs('lib/contacts.ts');
const { telegramUsernameSchema } = loadTs('lib/contact-validation.ts');
test('Telegram accepts usernames and profile links, and rejects unsafe or non-profile destinations', () => {
  for (const value of ['Fixture_Athlete', '@Fixture_Athlete', ' https://t.me/Fixture_Athlete/ ', 'https://telegram.me/Fixture_Athlete']) assert.equal(normalizeTelegramUsername(value), 'fixture_athlete');
  for (const value of ['javascript:alert(1)', 'https://evil.example/name', 'https://t.me/username?text=spoofed', 'https://t.me/joinchat/invite', 'https://t.me/share', 'https://t.me/user/message', '<script>bad</script>', 'abc', 12]) assert.equal(normalizeTelegramUsername(value), undefined, String(value));
  assert.equal(telegramUsernameSchema.parse(undefined), undefined, 'an omitted field must not clear a saved contact');
  assert.equal(telegramUsernameSchema.parse(' '), null); assert.equal(telegramUsernameSchema.parse('@Fixture_Athlete'), 'fixture_athlete');
});
test('finance and profile contact links preserve safe fallbacks and encoded renewal subjects', () => {
  assert.deepEqual(contactLinks({ telegramUsername: '@Fixture_Athlete', email: 'fixture@example.test', phone: '+855 (12) 345-678' }, 'Tuition renewal & follow-up'), [
    { kind: 'telegram', label: 'Telegram', href: 'https://t.me/fixture_athlete' },
    { kind: 'email', label: 'Email', href: 'mailto:fixture@example.test?subject=Tuition%20renewal%20%26%20follow-up' },
    { kind: 'phone', label: 'Call', href: 'tel:+85512345678' },
  ]);
  assert.deepEqual(contactLinks({ telegramUsername: 'javascript:bad', email: 'a@example.test?bcc=bad', phone: 'javascript:bad' }), []);
  assert.deepEqual(contactLinks({}), []);
});

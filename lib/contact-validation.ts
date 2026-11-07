import { z } from 'zod';
import { normalizeTelegramUsername } from './contacts';

export const telegramUsernameSchema = z.string().max(120).nullable().optional()
  .refine(value => normalizeTelegramUsername(value) !== undefined, 'Use a Telegram username (5–32 letters, numbers or underscores), @username, or https://t.me/username.')
  .transform(value => value === undefined ? undefined : normalizeTelegramUsername(value));

export const optionalContactAddressSchema = z.object({
  line1: z.string().max(100).optional().nullable(),
  line2: z.string().max(100).optional().nullable(),
  city: z.string().max(50).optional().nullable(),
  stateProvince: z.string().max(50).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  country: z.string().max(50).optional().nullable(),
}).transform(address => {
  // A default country alone is not an address. Contact-only saves must not
  // insert empty address records for staff with no recorded address.
  const entered = [address.line1, address.line2, address.city, address.stateProvince, address.postalCode]
    .some(value => typeof value === 'string' && value.trim() !== '');
  return entered ? address : null;
}).optional().nullable();

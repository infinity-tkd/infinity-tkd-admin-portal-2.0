import { z } from 'zod';
import { isCalendarDate } from './dates';
import { POS_ORDER_STATUSES, POS_PAYMENT_STATUSES } from './pos-order';

const search = z.string().trim().max(100).optional().transform(value => value?.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || undefined);
const day = z.string().refine(isCalendarDate, 'Choose a valid date.').optional();
const limit = z.coerce.number().int().min(1).max(100);
const offset = z.coerce.number().int().min(0).max(100000);
const orderQuery = z.object({
  status: z.enum(['All', ...POS_ORDER_STATUSES]).optional(),
  channel: z.enum(['All', 'ADMIN_POS', 'STUDENT_PORTAL']).optional(),
  payment: z.enum(['All', ...POS_PAYMENT_STATUSES]).optional(),
  search, from: day, to: day, limit: limit.default(50), offset: offset.default(0),
}).strict().refine(value => !value.from || !value.to || value.from <= value.to, {message:'The end date must follow the start date.'});
const productQuery = z.object({
  category: z.string().trim().max(50).optional(), search,
  include_inactive: z.enum(['true', 'false']).default('false'),
  limit: limit.optional(), offset: offset.optional(),
}).strict();
function values(params: URLSearchParams) {
  const result = Object.fromEntries(params);
  if ([...params.keys()].some(key => params.getAll(key).length !== 1)) result.__duplicate = 'Duplicate query fields';
  return result;
}
export const parseOrderQuery = (params: URLSearchParams) => orderQuery.safeParse(values(params));
export const parseProductQuery = (params: URLSearchParams) => productQuery.safeParse(values(params));
export const shopPrivateHeaders = {'Cache-Control':'private, no-store', Vary:'Authorization, Cookie', 'X-Portal-Contract':'shop-admin-v1'};

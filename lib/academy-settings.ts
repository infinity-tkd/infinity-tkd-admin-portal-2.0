import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const webUrl = z.string().trim().max(500).refine(value => {
  if (!value) return true;
  try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
}, 'Enter a complete http:// or https:// URL.').optional().nullable();

// Shared by the form and API so field errors match server validation.
export const academySettingsSchema = z.object({
  academyName: z.string().trim().min(1, 'Academy name is required.').max(255).optional(),
  legalName: optionalText(255), tagline: optionalText(255), taxId: optionalText(100),
  logoUrl: z.string().trim().max(500).refine(value => !value || (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) || webUrl.safeParse(value).success, 'Use a local /path or an http:// or https:// URL.').optional().nullable(),
  websiteUrl: webUrl, portalUrl: webUrl, facebookUrl: webUrl, telegramChannel: webUrl, instagramUrl: webUrl,
  contactPhone: optionalText(50), supportEmail: z.string().trim().email('Enter a valid email address.').or(z.literal('')).optional().nullable(),
  primaryAddress: optionalText(500), defaultBranchId: z.union([z.number().int().positive(), z.literal('all')]).optional().nullable(),
  currency: z.enum(['USD', 'KHR']).optional(), currencySymbol: z.string().trim().min(1).max(10).optional(),
  earlyGroupTuitionUsd: z.number().min(0).max(10000).optional(), standardTuitionUsd: z.number().min(0).max(10000).optional(),
  tuitionGracePeriodDays: z.number().int().min(0).max(60).optional(), taxRatePercentage: z.number().min(0).max(100).optional(),
  dateFormat: z.enum(['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY']).optional(),
  defaultClassDurationMins: z.number().int().min(15).max(360).optional(), examPassingScore: z.number().int().min(50).max(100).optional(),
  minAttendanceExamPct: z.number().int().min(0).max(100).optional(), allowStudentPortalLogin: z.boolean().optional(), enableAudioChimes: z.boolean().optional(),
}).strict();

export const academySettingsRequestSchema = academySettingsSchema.extend({ expectedUpdatedAt: z.string().datetime({ offset: true }).optional() });

export function changedAcademyFields<T extends object>(draft: T, baseline: T): Partial<T> {
  return Object.fromEntries(Object.entries(draft).filter(([key, value]) => value !== (baseline as Record<string, unknown>)[key])) as Partial<T>;
}

// Keep local edits while accepting unrelated remote updates. Same-field edits require review.
export function rebaseAcademyDraft<T extends object>(draft: T, baseline: T, latest: T): { draft: T; conflicts: string[] } {
  const changes = changedAcademyFields(draft, baseline);
  const conflicts = Object.keys(changes).filter(key => {
    const field = key as keyof T;
    return latest[field] !== baseline[field] && latest[field] !== draft[field];
  });
  return { draft: { ...latest, ...changes }, conflicts };
}

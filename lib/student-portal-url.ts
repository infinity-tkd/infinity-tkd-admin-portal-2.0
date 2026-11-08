/**
 * Address of the separate student portal (NEXT_PUBLIC_STUDENT_PORTAL_URL).
 * Student password-reset emails must open the student portal's own reset page:
 * students cannot sign in to this staff portal, which has no reset page.
 * Returns null when unset or unsafe, so callers can hide the action.
 */
export function studentPortalOrigin(value: string | undefined = process.env.NEXT_PUBLIC_STUDENT_PORTAL_URL): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    return url.protocol === 'https:' || (local && url.protocol === 'http:') ? url.origin : null;
  } catch {
    return null;
  }
}

export function studentPasswordResetUrl(value?: string): string | null {
  const origin = studentPortalOrigin(value);
  return origin ? `${origin}/reset-password` : null;
}

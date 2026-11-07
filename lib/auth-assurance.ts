const administrators = new Set(['Root', 'Super Root', 'Admin']);

/** Only use a token's claims for authorization after the identity provider verifies it. */
function tokenClaim(token: string, name: string): string | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claim = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')))?.[name];
    return typeof claim === 'string' ? claim : null;
  } catch { return null; }
}

export function tokenAssurance(token: string): string | null {
  return tokenClaim(token, 'aal');
}

export function tokenSessionId(token: string): string | null {
  return tokenClaim(token, 'session_id');
}

export function needsAdministratorMfa(role: string, verifiedToken: string): boolean {
  return administrators.has(role) && tokenAssurance(verifiedToken) !== 'aal2';
}

/** Supabase's TOTP data URI contains raw SVG, including trailing newlines. */
export function totpQrImageSource(qrCode: string): string {
  const prefix = 'data:image/svg+xml;utf-8,';
  const payload = qrCode.slice(prefix.length);
  return qrCode.startsWith(prefix) && payload.trimStart().startsWith('<')
    ? `${prefix}${encodeURIComponent(payload)}`
    : qrCode.trim();
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { needsAdministratorMfa, totpQrImageSource } from '@/lib/auth-assurance';
import Image from 'next/image';

function mfaErrorMessage(error: unknown, action: 'setup' | 'verify'): string {
  const failure = error && typeof error === 'object' ? error as { code?: string; status?: number } : {};
  if (failure.code === 'mfa_factor_not_found') return 'This authenticator was removed. Retry verification to load your current authenticators, or set up again.';
  if (failure.code === 'over_request_rate_limit' || failure.status === 429) return 'Too many authenticator attempts. Wait a few minutes, then try a fresh code.';
  if (failure.code === 'mfa_challenge_expired') return 'The verification challenge expired. Enter a fresh code and select Verify and continue again.';
  if (failure.code === 'mfa_ip_address_mismatch') return 'Your network changed during setup. Return to the network used to start setup, then try a fresh code.';
  if (failure.code === 'mfa_totp_enroll_not_enabled' || failure.code === 'mfa_totp_verify_not_enabled') return 'Authenticator access is disabled for this academy. Contact the academy owner to restore it.';
  if (failure.code === 'mfa_verification_rejected') return 'Authenticator verification was not approved. Contact the academy owner for help.';
  if (failure.status === 401 || failure.code === 'session_expired' || failure.code === 'session_not_found') return 'Your sign-in session expired. Sign out, then sign in again to continue.';
  if (action === 'verify' && failure.code !== 'mfa_verification_failed' && (failure.status ?? 0) >= 500) return 'The authenticator service is temporarily unavailable. Please retry shortly.';
  return action === 'setup'
    ? 'Authenticator setup failed. Retry, or contact the academy owner if your account needs recovery.'
    : 'Verification was not confirmed. Use a fresh code from the correct Infinity TKD account in your authenticator, check that your phone uses automatic date and time, and retry.';
}

export function AdminMfaBoundary({ children }: { children: React.ReactNode }) {
  const { state } = useAppStore();
  const user = state.currentUser;
  // A new identity must never render the previous account's QR or ready state.
  return <AdministratorMfa key={`${user?.id}:${user?.role}:${user?.mustChangePassword}`}>{children}</AdministratorMfa>;
}

function AdministratorMfa({ children }: { children: React.ReactNode }) {
  const { state, logout } = useAppStore();
  const user = state.currentUser;
  const userId = user?.id;
  const [ready, setReady] = useState(false);
  const [factor, setFactor] = useState('');
  const [authenticators, setAuthenticators] = useState<{ id: string; name: string }[]>([]);
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [qrFailed, setQrFailed] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const working = useRef(false);
  const epoch = useRef(0);
  const pendingFactor = useRef('');
  const clearSetup = useCallback(() => {
    pendingFactor.current = '';
    setQr(''); setSecret(''); setCode('');
    setQrFailed(false); setCopyStatus('');
  }, []);
  const cancelInspection = useCallback(() => { epoch.current++; }, []);
  const privileged = ['Root', 'Super Root', 'Admin'].includes(user?.role ?? '');
  const inspect = useCallback(async () => {
    const version=++epoch.current;
    setChecking(true); setError('');
    try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if(version!==epoch.current)return;
    if (error) throw error;
    if (!session || session.user.id !== userId) throw new Error('Session changed.');
    if (!needsAdministratorMfa(user?.role ?? '', session?.access_token ?? '')) { clearSetup(); setReady(true); return; }
    const factors = await supabase.auth.mfa.listFactors();
    if(version!==epoch.current)return;
    if (factors.error) throw factors.error;
    const verified = factors.data.totp.find(item => item.status === 'verified');
    if (verified) {
      clearSetup();
      setAuthenticators(factors.data.totp.map((item, index) => ({ id: item.id, name: item.friendly_name || `Authenticator ${index + 1}` })));
      setFactor(current => factors.data.totp.some(item => item.id === current) ? current : verified.id);
    } else if (pendingFactor.current && factors.data.all.some(item => item.id === pendingFactor.current && item.factor_type === 'totp' && item.status === 'unverified')) {
      // Retrying status must not discard the setup key already added on the phone.
      setFactor(pendingFactor.current);
    } else {
      clearSetup(); setFactor(''); setAuthenticators([]);
    }
    } catch {
      if (version === epoch.current) setError('Security verification could not load. Retry to continue.');
    } finally { if (version === epoch.current) setChecking(false); }
  }, [userId, user?.role, clearSetup]);
  useEffect(() => {
    setReady(false); setFactor(''); clearSetup(); setError('');
    if (userId && privileged) void inspect();
    return cancelInspection;
  }, [userId, privileged, inspect, cancelInspection, clearSetup]);
  if (!user || !privileged || user.mustChangePassword || ready) return <>{children}</>;
  const enroll = async () => {
    if (working.current || checking) return;
    const version = ++epoch.current;
    const isCurrent = () => version === epoch.current;
    working.current = true; setBusy(true); setError(''); clearSetup();
    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (!isCurrent()) return;
      if (factors.error) throw factors.error;
      const existing = factors.data.totp.find(item => item.status === 'verified');
      if (existing) {
        setAuthenticators(factors.data.totp.map((item, index) => ({ id: item.id, name: item.friendly_name || `Authenticator ${index + 1}` })));
        setFactor(existing.id); return;
      }
      for (const item of factors.data.all.filter(item => item.status === 'unverified' && item.factor_type === 'totp')) {
        const removed = await supabase.auth.mfa.unenroll({ factorId: item.id });
        if (!isCurrent()) return;
        if (removed.error) throw removed.error;
      }
      const result = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Infinity TKD administrator', issuer: 'Infinity TKD' });
      if (!isCurrent()) return;
      if (result.error) throw result.error;
      pendingFactor.current = result.data.id;
      setAuthenticators([]);
      setFactor(result.data.id); setQr(totpQrImageSource(result.data.totp.qr_code)); setSecret(result.data.totp.secret);
    } catch (error) { if (isCurrent()) setError(mfaErrorMessage(error, 'setup')); }
    finally { if (isCurrent()) { working.current = false; setBusy(false); } }
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault(); if (working.current || checking || !factor || !/^[0-9]{6}$/.test(code)) return;
    const version = ++epoch.current;
    const isCurrent = () => version === epoch.current;
    working.current = true; setBusy(true); setError('');
    try {
      const result = await supabase.auth.mfa.challengeAndVerify({ factorId: factor, code });
      if (!isCurrent()) return;
      if (result.error) throw result.error;
      clearSetup();
      // observePortalSession reloads data after the SDK's MFA session event.
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!isCurrent()) return;
      if (sessionError || !session || session.user.id !== userId || needsAdministratorMfa(user.role, session.access_token)) throw new Error('Verification was not confirmed.');
      setReady(true);
    } catch (error) {
      if (isCurrent()) {
        setCode('');
        if (error && typeof error === 'object' && 'code' in error && error.code === 'mfa_factor_not_found') {
          clearSetup(); setFactor(''); setAuthenticators([]);
        }
        setError(mfaErrorMessage(error, 'verify'));
      }
    }
    finally { if (isCurrent()) { working.current = false; setBusy(false); } }
  };
  const copySetupKey = async () => {
    const version = epoch.current;
    try {
      await navigator.clipboard.writeText(secret);
      if (version === epoch.current) setCopyStatus('Setup key copied.');
    } catch {
      if (version === epoch.current) setCopyStatus('Copy is unavailable. Select the key above and copy it manually.');
    }
  };
  return <main className="flex min-h-dvh items-center justify-center bg-neutral-50 p-4 dark:bg-neutral-950">
    <section aria-labelledby="mfa-title" className="w-full max-w-md space-y-4 rounded-2xl border bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white">
      <h1 id="mfa-title" className="text-lg font-semibold">Administrator verification</h1>
      <p className="text-sm text-neutral-500">Protect academy records with an authenticator app. Administrator access requires a verified code after sign-in.</p>
      <p className="break-all text-sm">Signing in as <strong>{user.email || user.username}</strong></p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
      {!factor ? <button disabled={busy || checking} onClick={() => void enroll()} className="min-h-11 w-full rounded-lg bg-red-600 px-4 text-sm font-semibold text-white">{checking ? 'Checking authenticator…' : 'Set up authenticator'}</button> : <>
        {qr && <div className="space-y-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">Use Google Authenticator, Microsoft Authenticator, or another app that supports time-based codes.</p>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li><strong>Google Authenticator:</strong> tap <strong>+</strong>, then <strong>Scan a QR code</strong>.</li>
            <li><strong>Microsoft Authenticator:</strong> tap <strong>+</strong>, choose <strong>Other account (Google, Facebook, etc.)</strong>, then scan this code.</li>
          </ul>
          <p className="text-xs text-neutral-500">Keep this page open until verification is complete.</p>
          <div className="mx-auto w-full max-w-80 rounded-lg bg-white p-3">
            <Image src={qr} unoptimized width={320} height={320} alt="Scan this code using your authenticator app" className="h-auto w-full" style={{ imageRendering: 'pixelated' }} onError={() => setQrFailed(true)}/>
          </div>
          {qrFailed && <p role="status" className="text-sm text-neutral-600 dark:text-neutral-300">The QR image could not load. Use the manual setup key below.</p>}
          <details open={qrFailed || undefined}>
            <summary className="min-h-11 cursor-pointer text-sm">Enter setup key manually</summary>
            <p className="mb-2 text-sm"><strong>Google:</strong> use <strong>Enter a setup key</strong> in the add-account menu. <strong>Microsoft:</strong> choose <strong>Other account</strong>, then <strong>Enter code manually</strong> on the scanner screen.</p>
            <p className="text-sm">Account name: <strong className="break-all">Infinity TKD ({user.email || user.username})</strong>. Key type: <strong>Time based</strong>.</p>
            <p className="mt-2 text-xs text-neutral-500">Your setup key:</p>
            <p className="select-all break-all rounded border p-3 font-mono text-sm">{secret}</p>
            <button type="button" disabled={busy} onClick={() => void copySetupKey()} className="mt-2 min-h-11 rounded-lg border px-3 text-sm">Copy setup key</button>
            {copyStatus && <p role="status" className="mt-2 text-xs text-neutral-500">{copyStatus}</p>}
            <p className="mt-2 text-xs text-neutral-500">Keep this key private. It is only displayed during setup.</p>
          </details>
        </div>}
        {!qr && <p className="text-sm text-neutral-600 dark:text-neutral-300">Open the saved Infinity TKD account in Google Authenticator, Microsoft Authenticator, or your other authenticator app to get the current code.</p>}
        {authenticators.length > 1 && <div className="space-y-2">
          <label htmlFor="mfa-factor" className="block text-sm">Choose authenticator</label>
          <select id="mfa-factor" disabled={busy || checking} value={factor} onChange={event => { setFactor(event.target.value); setCode(''); setError(''); }} className="min-h-11 w-full rounded-lg border bg-transparent p-3 text-sm">
            {authenticators.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>}
        <form onSubmit={verify} className="space-y-3">
          <label htmlFor="mfa-code" className="block text-sm">Authenticator code</label>
          <p id="mfa-code-help" className="text-xs text-neutral-500">Enter the six-digit code shown for Infinity TKD in your authenticator app.</p>
          <input id="mfa-code" aria-describedby="mfa-code-help" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required disabled={busy || checking} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} onPaste={event => {
            // Authenticator apps may copy codes as "123 456". Normalize before
            // the browser's maxLength truncates away the sixth digit.
            const digits = event.clipboardData.getData('text').replace(/\D/g, '');
            if (digits.length === 6) { event.preventDefault(); setCode(digits); }
          }} className="min-h-11 w-full rounded-lg border bg-transparent p-3 tracking-widest"/>
          <button disabled={busy || checking} className="min-h-11 w-full rounded-lg bg-red-600 px-4 text-sm font-semibold text-white">{busy ? 'Verifying…' : 'Verify and continue'}</button>
        </form>
      </>}
      <div className="flex gap-3"><button disabled={busy || checking} onClick={() => void inspect()} className="min-h-11 rounded-lg border px-3 text-sm">Retry verification</button><button disabled={busy} onClick={() => void logout()} className="min-h-11 px-3 text-sm">Sign out</button></div>
      <p className="text-xs text-neutral-500">Lost your authenticator? The academy owner must verify your identity and recover your factor through the provider dashboard.</p>
    </section>
  </main>;
}

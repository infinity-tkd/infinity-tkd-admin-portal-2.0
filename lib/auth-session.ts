import type { SupabaseClient } from '@supabase/supabase-js';
import { tokenAssurance, tokenSessionId } from './auth-assurance';

export const SESSION_VERIFICATION_TIMEOUT_MS = 20000;

/** Keep network work outside auth callbacks and discard obsolete verification. */
export function observePortalSession(
  auth: SupabaseClient['auth'],
  handlers: {
    onIdentityChange: () => void;
    onSession: (userId: string) => void;
    onSignedOut: () => void;
    onError: (error: unknown) => void;
  },
) {
  let disposed = false;
  let revision = 0;
  let identity: string | null = null;
  let assurance: string | null = null;
  let sessionId: string | null = null;
  let verifiedIdentity: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The SDK applies no request timeout. A stalled verification would otherwise
  // leave the portal on its loading screen until the browser gives up.
  const deadlines = new Set<ReturnType<typeof setTimeout>>();
  const verifyUser = (token: string) => new Promise<Awaited<ReturnType<typeof auth.getUser>>>((resolve, reject) => {
    const deadline = setTimeout(() => {
      deadlines.delete(deadline);
      reject(new Error('Session verification timed out.'));
    }, SESSION_VERIFICATION_TIMEOUT_MS);
    deadlines.add(deadline);
    auth.getUser(token).then(resolve, reject).finally(() => { clearTimeout(deadline); deadlines.delete(deadline); });
  });
  const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
    if (disposed) return;
    const nextAssurance = tokenAssurance(session?.access_token ?? '');
    const nextSessionId = tokenSessionId(session?.access_token ?? '');
    const nextIdentity = session?.user.id ?? null;
    if (event === 'MFA_CHALLENGE_VERIFIED' && (!nextIdentity || nextIdentity !== identity || nextSessionId !== sessionId)) {
      // The SDK may persist a verify response after another tab signed out or
      // started a different session. It must never restore that old account.
      const current = ++revision;
      clearTimeout(timer);
      identity = null; sessionId = null; assurance = null; verifiedIdentity = null;
      handlers.onIdentityChange();
      timer = setTimeout(() => {
        void (async () => {
          try {
            const { data: { session: stored }, error } = await auth.getSession();
            if (disposed || current !== revision) return;
            if (error) throw error;
            const storedSessionId = tokenSessionId(stored?.access_token ?? '');
            if (stored && (stored.access_token === session?.access_token || (stored.user.id === nextIdentity && nextSessionId && storedSessionId === nextSessionId))) {
              const result = await auth.signOut({ scope: 'local' });
              if (result.error) throw result.error;
            } else if (stored) {
              // A newer login won the race. Verify and retain it rather than
              // letting cleanup of the old factor interrupt the new account.
              const { data: { user }, error } = await verifyUser(stored.access_token);
              if (disposed || current !== revision) return;
              if (error || !user || user.id !== stored.user.id) throw error ?? new Error('Session verification failed.');
              identity = user.id; verifiedIdentity = user.id;
              assurance = tokenAssurance(stored.access_token); sessionId = storedSessionId;
              handlers.onSession(user.id);
              return;
            }
            if (!disposed && current === revision) handlers.onSignedOut();
          } catch (error) {
            if (disposed || current !== revision) return;
            handlers.onSignedOut(); handlers.onError(error);
          }
        })();
      }, 0);
      return;
    }
    // Ordinary refreshes need no reload. An MFA upgrade/downgrade must replace
    // the previous data snapshot, including when it originated in another tab.
    if (event === 'TOKEN_REFRESHED' && session?.user.id === verifiedIdentity && nextAssurance === assurance && nextSessionId === sessionId) return;
    const current = ++revision;
    clearTimeout(timer);
    if (nextIdentity !== identity || nextAssurance !== assurance || nextSessionId !== sessionId || !nextIdentity) {
      identity = nextIdentity;
      assurance = nextAssurance;
      sessionId = nextSessionId;
      verifiedIdentity = null;
      handlers.onIdentityChange();
    }
    if (!session) {
      handlers.onSignedOut();
      return;
    }
    timer = setTimeout(() => {
      void (async () => {
        try {
          const { data: { user }, error } = await verifyUser(session.access_token);
          if (disposed || current !== revision) return;
          if (error || !user || user.id !== nextIdentity) throw error ?? new Error('Session verification failed.');
          if (verifiedIdentity === user.id && event !== 'USER_UPDATED') return;
          verifiedIdentity = user.id;
          handlers.onSession(user.id);
        } catch (error) {
          if (disposed || current !== revision) return;
          verifiedIdentity = null;
          handlers.onIdentityChange();
          handlers.onSignedOut();
          handlers.onError(error);
        }
      })();
    }, 0);
  });
  return () => {
    disposed = true;
    ++revision;
    clearTimeout(timer);
    for (const deadline of deadlines) clearTimeout(deadline);
    deadlines.clear();
    subscription.unsubscribe();
  };
}

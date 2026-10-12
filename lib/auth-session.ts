import type { SupabaseClient } from '@supabase/supabase-js';

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
  let verifiedIdentity: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
    if (disposed) return;
    // Refreshes do not require downloading all academy tables again.
    if (event === 'TOKEN_REFRESHED' && session?.user.id === verifiedIdentity) return;
    const current = ++revision;
    clearTimeout(timer);
    const nextIdentity = session?.user.id ?? null;
    if (nextIdentity !== identity || !nextIdentity) {
      identity = nextIdentity;
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
          const { data: { user }, error } = await auth.getUser(session.access_token);
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
    subscription.unsubscribe();
  };
}

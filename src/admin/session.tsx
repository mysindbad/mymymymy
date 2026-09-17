// Who is allowed to see this console, and how they get here.
//
// The answer comes from the server: `GET /api/admin/session` verifies the bearer token with
// Supabase and asks the database for the caller's role. Nothing in this file decides access -
// it only renders what the API reported, and every admin data request carries the token again
// so a bypassed UI still cannot read or write anything.
/* eslint-disable react-refresh/only-export-components */
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { adminFetch, signOutOfAdmin, AdminApiError } from './api';
import { invalidateAdminCache } from './useAdminData';
import { supabase } from '../lib/supabase';
import { useAdminLocale } from './locale-context';
import type { AdminRole, AdminSession } from './types';

const AuthFlowModal = lazy(() => import('../components/AuthFlowModal').then((module) => ({ default: module.AuthFlowModal })));

export type AdminSessionStatus = 'probing' | 'granted' | 'anonymous' | 'denied' | 'unavailable' | 'error';

interface AdminSessionValue {
  status: AdminSessionStatus;
  role: AdminRole | null;
  /** Increments every time the answer changes, so screens can refetch from a known state. */
  revision: number;
  /** The signed-in account's own email, shown only to the person already signed in with it. */
  ownEmail: string | null;
  isConfigured: boolean;
  signIn: () => void;
  signOut: () => Promise<void>;
  refresh: () => void;
}

const SessionContext = createContext<AdminSessionValue | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const { language } = useAdminLocale();
  const [status, setStatus] = useState<AdminSessionStatus>('probing');
  const [role, setRole] = useState<AdminRole | null>(null);
  const [isConfigured, setIsConfigured] = useState(true);
  const [revision, setRevision] = useState(0);
  const [ownEmail, setOwnEmail] = useState<string | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);

  const probe = useCallback(async () => {
    try {
      const session = await adminFetch<AdminSession>('/api/admin/session');
      setStatus(session.status === 'granted' ? 'granted' : session.status);
      setRole(session.role ?? null);
      setIsConfigured(Boolean(session.isConfigured));
      setRevision((value) => value + 1);
    } catch (error) {
      // A 403 here means the token is valid but the roster is not reachable; anything else
      // is a transport or server fault. Both are shown instead of pretending "not signed in".
      if (error instanceof AdminApiError && error.isForbidden) {
        setStatus('denied');
        setRevision((value) => value + 1);
        return;
      }
      setStatus('error');
      setRevision((value) => value + 1);
    }
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setOwnEmail(data.session?.user?.email ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setOwnEmail(session?.user?.email ?? null);
      invalidateAdminCache();
      void probe();
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [probe]);

  const signIn = useCallback(() => setSignInOpen(true), []);

  const signOut = useCallback(async () => {
    try {
      await signOutOfAdmin();
    } catch {
      // A provider that refuses the sign-out must still close the console: the privileged session
      // is held by the server and expires on its own, and an unhandled rejection here would replace
      // an honest "signed out" screen with a broken one.
    }
    invalidateAdminCache();
    setOwnEmail(null);
    await probe();
  }, [probe]);

  const value = useMemo<AdminSessionValue>(
    () => ({ status, role, revision, ownEmail, isConfigured, signIn, signOut, refresh: () => { invalidateAdminCache(); void probe(); } }),
    [status, role, revision, ownEmail, isConfigured, signIn, signOut, probe],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
      {signInOpen ? (
        <Suspense fallback={null}>
          <AuthFlowModal
            isOpen
            // An operator who clicked "Sign in" has already decided to authenticate: opening on
            // the welcome screen made them click "Get Started" first, which hid the Google option
            // behind an onboarding step that is meaningless for staff. Land on the method screen
            // so Continue with Google / email / create account are visible immediately. The
            // traveller onboarding flow is unaffected - it still opens on 'welcome'.
            initialScreen="sign-in-method"
            language={language}
            onClose={() => setSignInOpen(false)}
            onAuthSuccess={() => {
              setSignInOpen(false);
              invalidateAdminCache();
              void probe();
            }}
          />
        </Suspense>
      ) : null}
    </SessionContext.Provider>
  );
}

export function useAdminSession(): AdminSessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useAdminSession must be used inside AdminSessionProvider');
  return context;
}

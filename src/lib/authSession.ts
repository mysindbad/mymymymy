import { useSyncExternalStore } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type AuthStatus = 'restoring' | 'authed' | 'anonymous';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
};

export type AuthSession = {
  status: AuthStatus;
  user: AuthUser | null;
};

const listeners = new Set<() => void>();
let snapshot: AuthSession = { status: 'restoring', user: null };

function getMetadataString(metadata: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function userFromSession(session: Session | null): AuthUser | null {
  const user = session?.user;
  if (!user) return null;
  const metadata = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email || '',
    name: getMetadataString(metadata, 'full_name', 'name') || user.email?.split('@')[0] || 'Traveler',
    avatarUrl: getMetadataString(metadata, 'avatar_url', 'picture'),
  };
}

function setSession(session: Session | null) {
  snapshot = session
    ? { status: 'authed', user: userFromSession(session) }
    : { status: 'anonymous', user: null };
  listeners.forEach((listener) => listener());
}

export function subscribeAuthSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAuthSessionSnapshot(): AuthSession {
  return snapshot;
}

// There is intentionally one initial session read and one auth-state subscription.
export const readyPromise: Promise<void> = supabase.auth.getSession()
  .then(({ data, error }) => {
    if (error) throw new Error(error.message);
    setSession(data.session);
  })
  .catch((error) => {
    console.error('Initial auth session restore failed:', error);
    setSession(null);
  });

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'INITIAL_SESSION'
    || event === 'SIGNED_IN'
    || event === 'SIGNED_OUT'
    || event === 'TOKEN_REFRESHED') {
    setSession(session);
  }
});

export function waitForSessionReady(): Promise<void> {
  return readyPromise;
}

export function useAuthSession(): AuthSession {
  return useSyncExternalStore(subscribeAuthSession, getAuthSessionSnapshot, getAuthSessionSnapshot);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}
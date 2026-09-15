import { createClient } from '@supabase/supabase-js';

// Supabase is optional at runtime: the app must still render (search, browse,
// map) when SUPABASE_* env vars are absent (e.g. a fresh preview/sandbox with
// no secrets configured yet). Auth-dependent features degrade to "signed out"
// instead of crashing the whole React tree at import time.
export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL?.trim() && import.meta.env.VITE_SUPABASE_ANON_KEY?.trim(),
);

function normalizeSupabaseUrl(rawValue: string | undefined): string {
  if (!rawValue) return 'https://supabase-not-configured.invalid';

  let value = rawValue.trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    console.error('Invalid VITE_SUPABASE_URL; authentication and cloud sync are disabled.');
    return 'https://supabase-not-configured.invalid';
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    console.error('VITE_SUPABASE_URL must use http or https; authentication and cloud sync are disabled.');
    return 'https://supabase-not-configured.invalid';
  }

  return parsed.origin;
}

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). '
    + 'The app will run with search/browse/map available, but sign-in, trips, and saved data will not work '
    + 'until these are set.',
  );
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || 'not-configured-placeholder-key';
const configuredAuthRedirectUrl = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();


export const AUTH_CALLBACK_PATH = '/auth/callback';

export function getAuthRedirectUrl(): string {
  if (configuredAuthRedirectUrl) return configuredAuthRedirectUrl;
  return new URL(AUTH_CALLBACK_PATH, window.location.origin).toString();
}

export function getPasswordRecoveryRedirectUrl(): string {
  const redirect = new URL(getAuthRedirectUrl());
  redirect.searchParams.set('mode', 'recovery');
  return redirect.toString();
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

export async function getAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session?.access_token || null;
}

export async function updateUserLocation(lat: number, lng: number, accuracy?: number) {
  const token = await getAccessToken();
  if (!token) return;
  return fetch('/api/user/location', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ latitude: lat, longitude: lng, accuracy }),
  });
}

import { createClient } from '@supabase/supabase-js';

function normalizeSupabaseUrl(rawValue: string | undefined): string {
  if (!rawValue) throw new Error('Missing VITE_SUPABASE_URL');

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
    throw new Error('Invalid VITE_SUPABASE_URL');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('VITE_SUPABASE_URL must use http or https');
  }

  return parsed.origin;
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const configuredAuthRedirectUrl = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY');
}

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

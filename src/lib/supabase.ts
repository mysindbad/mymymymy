import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configuredAuthRedirectUrl = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const AUTH_CALLBACK_PATH = '/auth/callback';

export function getAuthRedirectUrl(): string {
  if (configuredAuthRedirectUrl) return configuredAuthRedirectUrl;
  return new URL(AUTH_CALLBACK_PATH, window.location.origin).toString();
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

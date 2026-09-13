import { createClient } from '@supabase/supabase-js';

function config() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) throw new Error('Supabase server configuration is missing');
  return { url, anonKey, serviceRoleKey };
}

function authClient() {
  const { url, anonKey } = config();
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function adminClient() {
  const { url, serviceRoleKey } = config();
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function bearerToken(req: any): string | null {
  const value = String(req.headers?.authorization || '');
  if (!value.startsWith('Bearer ')) return null;
  const token = value.slice(7).trim();
  return token || null;
}

export default async function handler(req: any, res: any) {
  if (String(req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required', code: 'TOKEN_MISSING' });

  try {
    const { data: authData, error: authError } = await authClient().auth.getUser(token);
    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Session expired', code: 'TOKEN_INVALID' });
    }

    const { count, error } = await adminClient()
      .from('traces')
      .select('id', { count: 'exact', head: true });
    if (error) throw error;

    return res.status(200).json({ totalTraces: Number(count || 0) });
  } catch (error) {
    console.error('Trace summary failed', {
      message: error instanceof Error ? error.message.slice(0, 250) : 'unknown error',
    });
    return res.status(500).json({ error: 'Trace summary temporarily unavailable' });
  }
}

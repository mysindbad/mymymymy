import { createClient } from '@supabase/supabase-js';

function normalizedSupabaseUrl() {
  const raw = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!raw) throw new Error('Supabase configuration is missing');

  let value = raw.trim();
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
    throw new Error('Supabase URL is invalid');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Supabase URL must use http or https');
  }
  return parsed.origin;
}

function adminClient() {
  const url = normalizedSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error('Supabase server configuration is missing');
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req: any, res: any) {
  if (String(req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { count, error } = await adminClient()
      .from('traces')
      .select('id', { count: 'exact', head: true });
    if (error) throw error;

    // Preserve the historical response shape without exposing coordinates,
    // timestamps, speed, nearby-place IDs, or pseudonymous identifiers.
    return res.status(200).json({ totalTraces: Number(count || 0), recent: [] });
  } catch (error) {
    console.error('Trace summary failed', {
      message: error instanceof Error ? error.message.slice(0, 250) : 'unknown error',
    });
    return res.status(500).json({ error: 'Trace summary temporarily unavailable' });
  }
}

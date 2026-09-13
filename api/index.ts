import { createClient } from '@supabase/supabase-js';

let appPromise: Promise<any> | null = null;
let authClient: ReturnType<typeof createClient> | null = null;

function getApp() {
  appPromise ??= import('../server.ts').then((module) => module.default);
  return appPromise;
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase auth configuration is missing');
  return { url, anonKey };
}

function getAuthClient() {
  if (authClient) return authClient;
  const { url, anonKey } = supabaseConfig();
  authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return authClient;
}

function bearerToken(req: any): string | null {
  const value = String(req.headers?.authorization || '');
  if (!value.startsWith('Bearer ')) return null;
  const token = value.slice(7).trim();
  return token || null;
}

async function verifiedToken(req: any, res: any): Promise<string | null> {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required', code: 'TOKEN_MISSING' });
    return null;
  }
  try {
    const { data, error } = await getAuthClient().auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: 'Session expired', code: 'TOKEN_INVALID' });
      return null;
    }
    return token;
  } catch {
    res.status(503).json({ error: 'Authentication service unavailable' });
    return null;
  }
}

function userClient(token: string) {
  const { url, anonKey } = supabaseConfig();
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function handleCheckin(req: any, res: any, placeId: string) {
  const token = await verifiedToken(req, res);
  if (!token) return;

  const { data, error } = await userClient(token).rpc('record_place_checkin', {
    place_id_input: placeId,
    cooldown_seconds: 60,
  });

  if (error) {
    const message = String(error.message || '');
    if (message.includes('check_in_rate_limited')) {
      return res.status(429).json({
        error: 'Please wait before checking in to this place again',
        retryAfterSeconds: 60,
      });
    }
    if (message.toLowerCase().includes('place not found')) {
      return res.status(404).json({ error: 'Place not found' });
    }
    throw error;
  }

  return res.status(200).json({ success: true, checkInsCount: data });
}

export default async function handler(req: any, res: any) {
  try {
    const requestUrl = String(req.url || '');
    const method = String(req.method || 'GET').toUpperCase();

    const checkinMatch = requestUrl.match(/^\/api\/places\/([^/?#]+)\/checkin(?:[?#]|$)/);
    if (method === 'POST' && checkinMatch) {
      return await handleCheckin(req, res, decodeURIComponent(checkinMatch[1]));
    }

    // Gemini-backed chat consumes quota-limited compute. Production requires a
    // verified Supabase session before the request reaches Express.
    if (requestUrl.startsWith('/api/ai/chat')) {
      const contentLength = Number(req.headers?.['content-length'] || 0);
      if (Number.isFinite(contentLength) && contentLength > 16_384) {
        return res.status(413).json({ error: 'Request too large' });
      }
      if (!(await verifiedToken(req, res))) return;
    }

    const app = await getApp();
    return app(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const safeMessage = message
      .replace(/https?:\/\/[^\s]+/gi, '[url]')
      .replace(/eyJ[A-Za-z0-9._-]+/g, '[secret]')
      .replace(/[A-Za-z0-9_-]{32,}/g, '[token]')
      .slice(0, 500);
    console.error('API handler failed', { message: safeMessage });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

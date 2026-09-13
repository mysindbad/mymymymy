import { createClient } from '@supabase/supabase-js';

let appPromise: Promise<any> | null = null;
let authClient: ReturnType<typeof createClient> | null = null;

function getApp() {
  appPromise ??= import('../server.ts').then((module) => module.default);
  return appPromise;
}

function getAuthClient() {
  if (authClient) return authClient;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase auth configuration is missing');
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

async function requireVerifiedUser(req: any, res: any): Promise<boolean> {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required', code: 'TOKEN_MISSING' });
    return false;
  }
  try {
    const { data, error } = await getAuthClient().auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: 'Session expired', code: 'TOKEN_INVALID' });
      return false;
    }
    return true;
  } catch {
    res.status(503).json({ error: 'Authentication service unavailable' });
    return false;
  }
}

export default async function handler(req: any, res: any) {
  try {
    const requestUrl = String(req.url || '');

    // Gemini-backed chat consumes paid/quota-limited compute. Production now
    // requires a verified Supabase session before the request reaches Express.
    if (requestUrl.startsWith('/api/ai/chat')) {
      const contentLength = Number(req.headers?.['content-length'] || 0);
      if (Number.isFinite(contentLength) && contentLength > 16_384) {
        return res.status(413).json({ error: 'Request too large' });
      }
      if (!(await requireVerifiedUser(req, res))) return;
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
    return res.status(500).json({ error: 'Server initialization failed', detail: safeMessage });
  }
}

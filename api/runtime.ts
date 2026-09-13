import { normalizeSupabaseServerEnv } from './supabase-url.js';

// Normalize deployment environment values before loading api/index.ts.
// api/index.ts can lazy-load server.ts/server/dal.ts, so doing this here
// ensures every generic Vercel API route sees the same canonical base URL.
normalizeSupabaseServerEnv();

export default async function handler(req: any, res: any) {
  const { default: indexHandler } = await import('./index.js');
  return indexHandler(req, res);
}

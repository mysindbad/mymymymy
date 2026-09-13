from pathlib import Path


def replace_exact(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


api = Path('api/index.ts')
api_text = api.read_text(encoding='utf-8')
if 'VERCEL_RUNTIME_FIX_20260913' not in api_text:
    replace_exact(
        api,
        "import { GoogleGenAI } from '@google/genai';\nimport { createClient } from '@supabase/supabase-js';\n",
        "import { createHmac } from 'node:crypto';\nimport { GoogleGenAI } from '@google/genai';\nimport { createClient } from '@supabase/supabase-js';\n\n// VERCEL_RUNTIME_FIX_20260913\n",
        'api crypto import',
    )

    replace_exact(
        api,
        '''async function verifiedToken(req: any, res: any): Promise<string | null> {
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
''',
        '''async function verifiedUserId(req: any, res: any): Promise<string | null> {
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
    return data.user.id;
  } catch {
    res.status(503).json({ error: 'Authentication service unavailable' });
    return null;
  }
}
''',
        'verified user id',
    )

    replace_exact(
        api,
        '''async function consumeAiQuota(token: string, endpoint: 'chat' | 'plan_trip', maxRequests: number) {
  const { data, error } = await userClient(token).rpc('consume_ai_quota', {
    endpoint_input: endpoint,
    max_requests: maxRequests,
    window_seconds: 3600,
  });
  if (error) {
    if (String(error.message || '').includes('ai_rate_limited')) {
      const rateError = new Error('AI request limit reached') as Error & { status?: number };
      rateError.status = 429;
      throw rateError;
    }
    throw error;
  }
  return Number(data ?? 0);
}
''',
        '''async function consumeServerRateLimit(scope: string, userId: string, limit: number, windowSeconds: number) {
  const { serviceRoleKey } = supabaseConfig();
  const salt = process.env.RATE_LIMIT_SALT || serviceRoleKey;
  if (!salt) throw new Error('Rate-limit configuration is missing');
  const keyHash = createHmac('sha256', salt).update(`${scope}:user:${userId}`).digest('hex');
  const { data, error } = await getAdminClient().rpc('consume_api_rate_limit', {
    p_key_hash: keyHash,
    p_scope: scope,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) {
    throw Object.assign(new Error('AI request limit reached'), {
      status: 429,
      retryAfterSeconds: Math.max(1, Number(row?.retry_after_seconds || 1)),
    });
  }
}
''',
        'server rate limiter',
    )

    old_checkin = '''async function handleCheckin(req: any, res: any, placeId: string) {
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
'''
    new_checkin = '''async function handleCheckin(req: any, res: any, placeId: string) {
  const userId = await verifiedUserId(req, res);
  if (!userId) return;

  const { data, error } = await getAdminClient().rpc('record_place_checkin_server', {
    p_user_id: userId,
    p_place_id: placeId,
  });

  if (error) {
    const message = String(error.message || '');
    if (message.includes('check_in_rate_limited')) {
      res.setHeader('Retry-After', '60');
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

  return res.status(200).json({ success: true, checkInsCount: Number(data || 0) });
}
'''
    replace_exact(api, old_checkin, new_checkin, 'server-only check-in')

    replace_exact(
        api,
        '''  const token = await verifiedToken(req, res);
  if (!token) return;

  const message = text(req.body?.message, 2000);''',
        '''  const userId = await verifiedUserId(req, res);
  if (!userId) return;

  const message = text(req.body?.message, 2000);''',
        'chat verified user',
    )
    replace_exact(
        api,
        "  const remaining = await consumeAiQuota(token, 'chat', 30);\n",
        "  await consumeServerRateLimit('ai-chat', userId, 30, 3600);\n",
        'chat rate limit',
    )
    replace_exact(
        api,
        "  return res.status(200).json({ text: response.text, fallback: false, quotaRemaining: remaining });\n",
        "  return res.status(200).json({ text: response.text, fallback: false });\n",
        'chat response',
    )

    replace_exact(
        api,
        '''  const token = await verifiedToken(req, res);
  if (!token) return;

  const body = req.body || {};''',
        '''  const userId = await verifiedUserId(req, res);
  if (!userId) return;

  const body = req.body || {};''',
        'planner verified user',
    )
    replace_exact(
        api,
        "  const remaining = await consumeAiQuota(token, 'plan_trip', 10);\n",
        "  await consumeServerRateLimit('ai-plan-trip', userId, 10, 3600);\n",
        'planner rate limit',
    )
    replace_exact(
        api,
        '''    aiGenerated: true,
    quotaRemaining: remaining,
  });''',
        '''    aiGenerated: true,
  });''',
        'planner response',
    )

    replace_exact(
        api,
        "    if (status === 429) return res.status(429).json({ error: 'AI request limit reached. Try again later.' });\n",
        "    if (status === 429) {\n      const retryAfterSeconds = Math.max(1, Number(error?.retryAfterSeconds || 1));\n      res.setHeader('Retry-After', String(retryAfterSeconds));\n      return res.status(429).json({ error: 'AI request limit reached. Try again later.', retryAfterSeconds });\n    }\n",
        '429 response',
    )

server = Path('server.ts')
server_text = server.read_text(encoding='utf-8')
if "app.post('/api/ai/chat', requireAuth" not in server_text:
    replace_exact(
        server,
        '''const AI_CHAT_RATE_LIMIT = 12;
const AI_CHAT_WINDOW_SECONDS = 60;
const AI_PLAN_RATE_LIMIT = 6;
const AI_PLAN_WINDOW_SECONDS = 600;''',
        '''const AI_CHAT_RATE_LIMIT = 30;
const AI_CHAT_WINDOW_SECONDS = 3600;
const AI_PLAN_RATE_LIMIT = 10;
const AI_PLAN_WINDOW_SECONDS = 3600;''',
        'server AI limits',
    )
    replace_exact(
        server,
        '''function requestIp(req: Request): string {
  const forwarded = req.header('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
}

''',
        '',
        'remove IP limiter helper',
    )
    replace_exact(
        server,
        "app.post('/api/ai/chat', async (req, res, next) => {",
        "app.post('/api/ai/chat', requireAuth, async (req, res, next) => {",
        'server chat auth',
    )
    replace_exact(
        server,
        "    const identity = req.user ? `user:${req.user.id}` : `ip:${requestIp(req)}`;\n",
        "    const identity = `user:${req.user!.id}`;\n",
        'server chat identity',
    )
    replace_exact(
        server,
        "        code: 'TRANSIT_NOT_SUPPORTED',\n",
        "        code: 'TRANSIT_NOT_SUPPORTED',\n",
        'server transit code marker',
    )

navigation = Path('api/navigation.ts')
nav_text = navigation.read_text(encoding='utf-8')
if "code: 'TRANSIT_NOT_SUPPORTED'" not in nav_text:
    replace_exact(
        navigation,
        "        code: 'TRANSIT_PROVIDER_UNAVAILABLE',\n",
        "        code: 'TRANSIT_NOT_SUPPORTED',\n",
        'navigation transit code',
    )

print('Applied Vercel runtime contract fix')

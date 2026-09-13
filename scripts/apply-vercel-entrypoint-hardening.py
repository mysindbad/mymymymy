from pathlib import Path

path = Path('api/index.ts')
text = path.read_text(encoding='utf-8')


def replace_exact(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    text = text.replace(old, new, 1)


replace_exact(
    "import { GoogleGenAI } from '@google/genai';\n",
    "import { createHmac } from 'node:crypto';\nimport { GoogleGenAI } from '@google/genai';\n",
    'crypto import',
)

replace_exact(
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
'''async function verifiedSession(req: any, res: any): Promise<{ token: string; userId: string } | null> {
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
    return { token, userId: data.user.id };
  } catch {
    res.status(503).json({ error: 'Authentication service unavailable' });
    return null;
  }
}
''',
    'verified session',
)

replace_exact(
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
'''async function consumeAiQuota(userId: string, scope: 'ai-chat' | 'ai-plan-trip', maxRequests: number, windowSeconds: number) {
  const { serviceRoleKey } = supabaseConfig();
  const salt = process.env.RATE_LIMIT_SALT || serviceRoleKey;
  if (!salt) throw new Error('AI rate-limit configuration is missing');
  const keyHash = createHmac('sha256', salt).update(`${scope}:user:${userId}`).digest('hex');
  const admin = getAdminClient();
  const { data, error } = await admin.rpc('consume_api_rate_limit', {
    p_key_hash: keyHash,
    p_scope: scope,
    p_limit: maxRequests,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) {
    const rateError = new Error('AI request limit reached') as Error & { status?: number; retryAfterSeconds?: number };
    rateError.status = 429;
    rateError.retryAfterSeconds = Math.max(1, Number(row?.retry_after_seconds || 1));
    throw rateError;
  }
  const { data: state, error: stateError } = await admin
    .from('api_rate_limits')
    .select('request_count')
    .eq('key_hash', keyHash)
    .eq('scope', scope)
    .maybeSingle();
  if (stateError) throw stateError;
  return Math.max(0, maxRequests - Number(state?.request_count || 0));
}
''',
    'AI quota',
)

replace_exact(
'''async function handleCheckin(req: any, res: any, placeId: string) {
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
''',
'''async function handleCheckin(req: any, res: any, placeId: string) {
  const session = await verifiedSession(req, res);
  if (!session) return;

  const { data, error } = await getAdminClient().rpc('record_place_checkin_server', {
    p_user_id: session.userId,
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
''',
    'check-in handler',
)

replace_exact(
'''async function handleAiChat(req: any, res: any) {
  if (jsonBodySize(req) > 16_384) return res.status(413).json({ error: 'Request too large' });
  const token = await verifiedToken(req, res);
  if (!token) return;

  const message = text(req.body?.message, 2000);
  const requestedLanguage = text(req.body?.language, 8).toLowerCase();
  const language = requestedLanguage === 'ar' ? 'Arabic' : requestedLanguage === 'fr' ? 'French' : 'English';
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const remaining = await consumeAiQuota(token, 'chat', 30);
''',
'''async function handleAiChat(req: any, res: any) {
  if (jsonBodySize(req) > 16_384) return res.status(413).json({ error: 'Request too large' });
  const session = await verifiedSession(req, res);
  if (!session) return;

  const rawMessage = typeof req.body?.message === 'string' ? req.body.message : '';
  if (!rawMessage.trim()) return res.status(400).json({ error: 'Message is required' });
  if (rawMessage.length > 2000) return res.status(400).json({ error: 'Message must be 2000 characters or fewer' });
  const message = text(rawMessage, 2000);
  const requestedLanguage = text(req.body?.language, 8).toLowerCase();
  const language = requestedLanguage === 'ar' ? 'Arabic' : requestedLanguage === 'fr' ? 'French' : 'English';

  const remaining = await consumeAiQuota(session.userId, 'ai-chat', 12, 60);
''',
    'AI chat session/quota',
)

replace_exact(
'''async function handlePlanTrip(req: any, res: any) {
  if (jsonBodySize(req) > 24_576) return res.status(413).json({ error: 'Request too large' });
  const token = await verifiedToken(req, res);
  if (!token) return;
''',
'''async function handlePlanTrip(req: any, res: any) {
  if (jsonBodySize(req) > 24_576) return res.status(413).json({ error: 'Request too large' });
  const session = await verifiedSession(req, res);
  if (!session) return;
''',
    'planner session',
)

replace_exact(
    "  const remaining = await consumeAiQuota(token, 'plan_trip', 10);\n",
    "  const remaining = await consumeAiQuota(session.userId, 'ai-plan-trip', 6, 600);\n",
    'planner quota',
)

replace_exact(
'''    if (status === 429) return res.status(429).json({ error: 'AI request limit reached. Try again later.' });
''',
'''    if (status === 429) {
      const retryAfterSeconds = Math.max(1, Number(error?.retryAfterSeconds || 1));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: 'AI request limit reached. Try again later.', retryAfterSeconds });
    }
''',
    '429 response',
)

path.write_text(text, encoding='utf-8')
print('Applied Vercel entrypoint hardening to api/index.ts')

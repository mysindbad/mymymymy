from pathlib import Path

path = Path('server.ts')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    text = text.replace(old, new, 1)

replace_once(
'''function requestIp(req: Request): string {
  const forwarded = req.header('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
}

''',
'',
'remove anonymous IP AI identity',
)

replace_once(
'''app.get('/api/traces/summary', requireAuth, async (_req, res, next) => {
  try {
    const summary = await createDal().getSummary();
    res.json({ totalTraces: summary.totalTraces });
  } catch (error) {
    next(error);
  }
});''',
'''app.get('/api/traces/summary', async (_req, res, next) => {
  try {
    const summary = await createDal().getSummary();
    res.json({ totalTraces: summary.totalTraces, recent: [] });
  } catch (error) {
    next(error);
  }
});''',
'public aggregate-only trace summary',
)

replace_once(
"app.post('/api/ai/chat', async (req, res, next) => {",
"app.post('/api/ai/chat', requireAuth, async (req, res, next) => {",
'AI chat auth parity',
)

replace_once(
"    const identity = req.user ? `user:${req.user.id}` : `ip:${requestIp(req)}`;",
"    const identity = `user:${req.user!.id}`;",
'AI chat user rate-limit identity',
)

replace_once(
'''        code: 'TRANSIT_NOT_SUPPORTED',
      });''',
'''        code: 'TRANSIT_PROVIDER_UNAVAILABLE',
        supportedModes: ['driving', 'walking', 'taxi'],
      });''',
'transit contract parity',
)

path.write_text(text, encoding='utf-8')
print('Applied runtime parity patch')

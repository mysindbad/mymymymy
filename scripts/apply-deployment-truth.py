from pathlib import Path

path = Path('server.ts')
text = path.read_text(encoding='utf-8')
old = '''app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});'''
new = '''app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    revision: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null,
  });
});'''
count = text.count(old)
if count != 1:
    raise RuntimeError(f'health route: expected one match, found {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Added deployment revision marker')

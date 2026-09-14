process.env.VITE_SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.VITE_SUPABASE_ANON_KEY ||= 'e2e-anon-key';
process.env.DISABLE_HMR = 'true';

const { createServer } = await import('vite');

const server = await createServer({
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  logLevel: 'error',
});

await server.listen();
console.log('E2E web server listening on http://127.0.0.1:4173');

let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await server.close();
  process.exit(0);
};

process.on('SIGINT', () => void close());
process.on('SIGTERM', () => void close());

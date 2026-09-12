let appPromise = import('../server.ts').then((module) => module.default);

export default async function handler(req: any, res: any) {
  try {
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const category = /supabase/i.test(message)
      ? 'supabase-config'
      : /vite/i.test(message)
        ? 'vite-runtime'
        : /module|import|require/i.test(message)
          ? 'module-init'
          : 'unknown-init';
    console.error('API_BOOT_FAILURE', category, message);
    return res.status(500).json({ error: 'Server initialization failed', category });
  }
}

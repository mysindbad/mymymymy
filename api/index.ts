let appPromise: Promise<any> | undefined;

export default async function handler(req: any, res: any) {
  try {
    appPromise ??= import('../server.ts').then((module) => module.default);
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error('Failed to initialize Express app', error);
    return res.status(500).json({
      error: 'API initialization failed',
      reason: error instanceof Error ? error.message : 'Unknown error',
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasSupabaseAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
    });
  }
}

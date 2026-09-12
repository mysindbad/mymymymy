let appPromise: Promise<any> | null = null;

function getApp() {
  appPromise ??= import('../server.ts').then((module) => module.default);
  return appPromise;
}

export default async function handler(req: any, res: any) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const safeMessage = message.replace(/https?:\/\/[^\s]+/gi, '[url]').replace(/eyJ[A-Za-z0-9._-]+/g, '[secret]').replace(/[A-Za-z0-9_-]{32,}/g, '[token]').slice(0, 500);
    return res.status(500).json({ error: 'Server initialization failed', detail: safeMessage });
  }
}

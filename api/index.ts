let appPromise: Promise<any> | null = null;

function getApp() {
  appPromise ??= import('../server').then((module) => module.default);
  return appPromise;
}

export default async function handler(req: any, res: any) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const detail = /cannot find module|err_module_not_found/i.test(message)
      ? 'module-not-found'
      : /unknown file extension/i.test(message)
        ? 'unknown-file-extension'
        : /err_require_esm|must use import/i.test(message)
          ? 'esm-interop'
          : /invalid supabaseurl/i.test(message)
            ? 'invalid-supabase-url'
            : /missing supabase/i.test(message)
              ? 'missing-supabase-config'
              : 'other-module-error';
    console.error('API_BOOT_FAILURE', detail, message);
    const safeMessage = message.replace(/https?:\/\/[^\s]+/gi, '[url]').replace(/eyJ[A-Za-z0-9._-]+/g, '[secret]').replace(/[A-Za-z0-9_-]{32,}/g, '[token]').slice(0, 240);
    return res.status(500).json({ error: 'Server initialization failed', category: 'module-init', detail, message: safeMessage });
  }
}

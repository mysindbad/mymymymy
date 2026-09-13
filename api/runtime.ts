import indexHandler from './index.js';

function normalizeSupabaseUrl(rawValue: string, label: string) {
  let value = rawValue.trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`${label} must use http or https`);
  }
  return parsed.origin;
}

for (const name of ['SUPABASE_URL', 'VITE_SUPABASE_URL'] as const) {
  const raw = process.env[name];
  if (raw) process.env[name] = normalizeSupabaseUrl(raw, name);
}

export default function handler(req: any, res: any) {
  return indexHandler(req, res);
}

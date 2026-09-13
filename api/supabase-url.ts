export function normalizeSupabaseUrl(rawValue: string, label = 'Supabase URL') {
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

  // Supabase JS expects the project/base origin. Paths such as /rest/v1,
  // query strings, and fragments cause its internal API paths to be malformed.
  return parsed.origin;
}

export function getNormalizedSupabaseUrl() {
  const raw = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!raw) throw new Error('Supabase configuration is missing');
  return normalizeSupabaseUrl(raw);
}

export function normalizeSupabaseServerEnv() {
  for (const name of ['SUPABASE_URL', 'VITE_SUPABASE_URL'] as const) {
    const raw = process.env[name];
    if (raw) process.env[name] = normalizeSupabaseUrl(raw, name);
  }
}

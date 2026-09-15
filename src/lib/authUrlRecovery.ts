const AUTH_ERROR_CODES = new Set(['bad_oauth_state', 'oauth_callback_error', 'provider_error']);
const AUTH_ERROR_VALUES = new Set(['invalid_request', 'access_denied', 'server_error']);

export function stripOAuthErrorUrl(value: string): { url: string; code: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(value, 'http://localhost');
  } catch {
    return null;
  }

  const error = parsed.searchParams.get('error') || '';
  const errorCode = parsed.searchParams.get('error_code') || '';
  const isOAuthError = AUTH_ERROR_CODES.has(errorCode)
    || (AUTH_ERROR_VALUES.has(error) && Boolean(parsed.searchParams.get('error_description')));
  if (!isOAuthError) return null;

  for (const key of ['error', 'error_code', 'error_description', 'error_uri']) parsed.searchParams.delete(key);
  const search = parsed.searchParams.toString();
  return {
    url: `${parsed.pathname}${search ? `?${search}` : ''}${parsed.hash}`,
    code: errorCode || error,
  };
}

export function cleanOAuthErrorFromCurrentUrl() {
  if (typeof window === 'undefined') return null;
  const result = stripOAuthErrorUrl(window.location.href);
  if (!result) return null;
  window.history.replaceState({}, document.title, result.url);
  return result.code;
}

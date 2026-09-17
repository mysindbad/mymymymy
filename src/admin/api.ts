// Data layer for the Admin Control Center.
//
// Rules this file exists to enforce:
//  - the Bearer token is read at call time and is never stored here;
//  - a 401 refreshes the session once and retries once, then reports honestly;
//  - failures keep the HTTP status and the server's error code so callers can tell
//    "not allowed" (403) from "backend not configured" (503) from "bad input" (400);
//  - no request is ever sent without a timeout and an abort signal, so a slow upstream
//    cannot leave a screen spinning forever.
import { getAccessToken, isSupabaseConfigured, supabase } from '../lib/supabase';
import { getAdminLocale, type AdminLocale } from './locale';

export type AdminErrorCode =
  | 'ADMIN_AUTH_REQUIRED'
  | 'ADMIN_NOT_AUTHORIZED'
  | 'ADMIN_NOT_CONFIGURED'
  | 'ADMIN_VALIDATION_FAILED'
  | 'ADMIN_NOT_FOUND'
  | 'ADMIN_MUTATION_LIMIT'
  | 'NETWORK'
  | 'UNKNOWN';

export class AdminApiError extends Error {
  readonly status: number;
  readonly code: AdminErrorCode;

  constructor(status: number, code: AdminErrorCode, message: string) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
  }

  get isUnauthorized() { return this.status === 401 || this.code === 'ADMIN_AUTH_REQUIRED'; }
  get isForbidden() { return this.status === 403 || this.code === 'ADMIN_NOT_AUTHORIZED'; }
  get isUnavailable() { return this.status === 503; }
  get isNotFound() { return this.status === 404; }
  /** 401 after we already refreshed: the stored session is no longer usable. */
  get isSessionExpired() { return this.status === 401 && this.code !== 'ADMIN_NOT_CONFIGURED'; }
}

export interface AdminQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  dir?: 'asc' | 'desc';
  [key: string]: string | number | boolean | undefined | null;
}

export function buildQuery(query?: AdminQuery): string {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  const search = params.toString();
  return search ? `?${search}` : '';
}

function localeHeader(locale: AdminLocale): string {
  if (locale === 'ar') return 'ar;q=1.0, fr;q=0.4, en;q=0.3';
  if (locale === 'fr') return 'fr;q=1.0, en;q=0.6, ar;q=0.3';
  if (locale === 'en') return 'en;q=1.0, fr;q=0.6, ar;q=0.3';
  return 'ar;q=0.9, fr;q=0.6, en;q=0.5';
}

const ERROR_COPY: Record<string, { en: string; ar: string; fr: string }> = {
  ADMIN_AUTH_REQUIRED: {
    en: 'Your session is no longer valid. Sign in again to continue.',
    ar: 'لم تعد جلستك صالحة. سجّل الدخول من جديد للمتابعة.',
    fr: 'Votre session nest plus valide. Reconnectez-vous pour continuer.',
  },
  ADMIN_NOT_AUTHORIZED: {
    en: 'This account is not on the administrators roster, so the platform refused the request.',
    ar: 'هذا الحساب ليس ضمن قائمة المشرفين، لذلك رفضت المنصة الطلب.',
    fr: 'Ce compte ne figure pas dans la liste des administrateurs ; la plateforme a refusé la requête.',
  },
  ADMIN_NOT_CONFIGURED: {
    en: 'The admin data service is not configured on this deployment.',
    ar: 'خدمة بيانات المشرفين غير مضبوطة على هذا النشر.',
    fr: 'Le service de données administrateur nest pas configuré sur ce déploiement.',
  },
  ADMIN_MUTATION_LIMIT: {
    en: 'You are making changes very quickly. Wait a moment before the next one.',
    ar: 'تُجري التغييرات بسرعة كبيرة. انتظر لحظة قبل التغيير التالي.',
    fr: 'Vous effectuez des changements très vite. Patientez un instant avant le prochain.',
  },
  ADMIN_PLACE_NOT_FOUND: {
    en: 'That place no longer exists in the database.',
    ar: 'لم يعد هذا المكان موجودًا في قاعدة البيانات.',
    fr: 'Ce lieu nexiste plus dans la base de données.',
  },
  ADMIN_REVIEW_NOT_FOUND: {
    en: 'That review no longer exists in the database.',
    ar: 'لم يعد هذا التقييم موجودًا في قاعدة البيانات.',
    fr: 'Cet avis nexiste plus dans la base de données.',
  },
  ADMIN_TRAVELER_NOT_FOUND: {
    en: 'No traveler record matches that identifier.',
    ar: 'لا يوجد سجل مسافر يطابق هذا المعرّف.',
    fr: 'Aucun voyageur ne correspond à cet identifiant.',
  },
};

export function describeAdminError(error: unknown, locale: AdminLocale = getAdminLocale()): string {
  if (!(error instanceof AdminApiError)) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return locale === 'ar' ? 'تم إيقاف الطلب.' : locale === 'fr' ? 'Requête interrompue.' : 'Request cancelled.';
    }
    return locale === 'ar'
      ? 'لم يستجب الخادم. تحقّق من الشبكة ثم أعد المحاولة.'
      : locale === 'fr'
        ? 'Le serveur na pas répondu. Vérifiez le réseau et réessayez.'
        : 'The server did not answer. Check the connection and try again.';
  }
  const copy = ERROR_COPY[error.code];
  if (copy) return copy[locale] ?? copy.en;
  if (error.message) return error.message;
  return locale === 'ar'
    ? `رفض الخادم الطلب (${error.status}).`
    : locale === 'fr'
      ? `Le serveur a refusé la requête (${error.status}).`
      : `The server rejected the request (${error.status}).`;
}

const REQUEST_TIMEOUT_MS = 12_000;

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Compose the request URL exactly once. Callers hand over an admin path that may already carry
 * the API prefix (`/api/admin/places`, which is how the cache and invalidation keys are named) or
 * may not (`/admin/places`); guessing here is how a whole module silently starts requesting
 * `/api/api/...`, so the prefix is added only when it is missing.
 */
function adminApiPath(path: string): string {
  return path.startsWith('/api/') || path.startsWith('http') ? path : `/api${path}`;
}

async function rawFetch(path: string, options: FetchOptions, token: string | null): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    return await fetch(adminApiPath(path), {
      method: options.method ?? 'GET',
      signal: controller.signal,
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        'Accept-Language': localeHeader(getAdminLocale()),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

async function readError(response: Response, fallbackCode: AdminErrorCode): Promise<AdminApiError> {
  let code = fallbackCode;
  let message = '';
  try {
    const payload = (await response.json()) as { code?: string; error?: string; message?: string };
    if (payload.code) code = payload.code as AdminErrorCode;
    message = payload.error ?? payload.message ?? '';
  } catch {
    message = response.statusText || '';
  }
  return new AdminApiError(response.status, code, message);
}

/** Refresh once on a 401, then report. Never silently succeeds. */
export async function adminFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const token = await getAccessToken();
  let response: Response;
  try {
    response = await rawFetch(path, options, token);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new AdminApiError(0, 'NETWORK', error instanceof Error ? error.message : 'network error');
  }

  if (response.status === 401) {
    const fresh = await forceRefresh();
    if (fresh && fresh !== token) {
      try {
        response = await rawFetch(path, options, fresh);
      } catch (error) {
        if (options.signal?.aborted) throw error;
        throw new AdminApiError(0, 'NETWORK', error instanceof Error ? error.message : 'network error');
      }
    }
  }

  if (!response.ok) {
    throw await readError(response, response.status === 401 ? 'ADMIN_AUTH_REQUIRED'
      : response.status === 403 ? 'ADMIN_NOT_AUTHORIZED'
        : response.status === 503 ? 'ADMIN_NOT_CONFIGURED'
          : response.status === 404 ? 'ADMIN_NOT_FOUND'
            : response.status === 429 ? 'ADMIN_MUTATION_LIMIT'
              : 'ADMIN_VALIDATION_FAILED');
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Drops the local session without touching other tabs of the consumer app more than
 *  Supabase's own storage events already would. */
export async function signOutOfAdmin() {
  // With no Supabase client there is nothing here to revoke, and the caller clears the console's
  // own session. Rejecting would put a console error on a screen that already says, truthfully,
  // that the backend is not configured.
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw new Error(error.message);
}

async function forceRefresh(): Promise<string | null> {
  const { error } = await supabase.auth.refreshSession();
  if (error) return null;
  return getAccessToken();
}

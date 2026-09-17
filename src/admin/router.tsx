// The route the admin console is on. Kept in the address bar (path plus query string) so a
// filtered list, a page number or an open record can be pasted into a colleague's chat and
// survives a reload. No router library: this surface has a fixed, small route table.
/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export const ADMIN_BASE = '/admin';

interface RouterValue {
  pathname: string;
  params: URLSearchParams;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  setParams: (updates: Record<string, string | null>, options?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

function currentPath() {
  return `${window.location.pathname}${window.location.search}`;
}

export function AdminRouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onPop = () => setPath(currentPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string, options: { replace?: boolean } = {}) => {
    const next = to.startsWith('/') ? to : `${ADMIN_BASE}/${to.replace(/^\//, '')}`;
    if (next === `${window.location.pathname}${window.location.search}`) return;
    if (options.replace) window.history.replaceState({}, '', next);
    else window.history.pushState({}, '', next);
    setPath(next);
  }, []);

  const value = useMemo<RouterValue>(() => {
    const [pathname, search = ''] = path.split('?');
    const params = new URLSearchParams(search);
    return {
      pathname,
      params,
      navigate,
      setParams: (updates, options) => {
        const next = new URLSearchParams(params);
        Object.keys(updates).forEach((key) => {
          const value = updates[key];
          if (value === null || value === '') next.delete(key);
          else next.set(key, String(value));
        });
        const query = next.toString();
        navigate(`${pathname}${query ? `?${query}` : ''}`, { replace: options?.replace });
      },
    };
  }, [path, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useAdminRouter(): RouterValue {
  const router = useContext(RouterContext);
  if (!router) throw new Error('useAdminRouter must be used inside AdminRouterProvider');
  return router;
}

/** Reads one string from the URL, so every list screen is shareable by construction. */
export function useParam(key: string, fallback = ''): string {
  const { params } = useAdminRouter();
  return params.get(key) ?? fallback;
}

export function paramValue(params: URLSearchParams, key: string, fallback = ''): string {
  return params.get(key) ?? fallback;
}

/** `/admin/places/<uuid>` → `['places', '<uuid>']`. The route table is tiny, so segments beat
 *  a matcher: every module knows its own single optional id. */
export function useAdminSegments(): string[] {
  const { pathname } = useAdminRouter();
  return pathname
    .replace(/^\/admin\/?/, '')
    .split('/')
    .filter(Boolean);
}

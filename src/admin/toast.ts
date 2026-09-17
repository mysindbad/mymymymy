// A small event bus so a successful write can be announced from anywhere without prop
// drilling a toast API through every module. Toasts are cosmetic only - every mutation screen
// still renders its own inline result, so a blocked toast never hides an outcome.
export type AdminToastTone = 'ok' | 'bad' | 'neutral';

export interface AdminToast {
  id: number;
  tone: AdminToastTone;
  title: string;
  message?: string;
}

let nextId = 1;
// Immutable snapshot: getSnapshot must return the same reference until something changes,
// otherwise useSyncExternalStore would re-render forever.
let snapshot: readonly AdminToast[] = [];
const listeners = new Set<() => void>();

const toasts: AdminToast[] = [];

function publish() {
  snapshot = Object.freeze(toasts.slice());
  listeners.forEach((listener) => listener());
}

export function pushAdminToast(toast: { tone?: AdminToastTone; title: string; message?: string }) {
  const entry: AdminToast = { id: nextId, tone: toast.tone ?? 'neutral', title: toast.title, message: toast.message };
  nextId += 1;
  toasts.push(entry);
  while (toasts.length > 4) toasts.shift();
  publish();
  window.setTimeout(() => dismissAdminToast(entry.id), 6000);
}

export function dismissAdminToast(id: number) {
  const index = toasts.findIndex((toast) => toast.id === id);
  if (index < 0) return;
  toasts.splice(index, 1);
  publish();
}

export function subscribeAdminToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function currentAdminToasts(): readonly AdminToast[] {
  return snapshot;
}

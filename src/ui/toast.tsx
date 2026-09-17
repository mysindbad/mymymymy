import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useMediaQuery } from './Sheet';

export type ToastTone = 'success' | 'info' | 'error';

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
}

type Listener = (toasts: ToastItem[]) => void;

let sequence = 0;
let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener(toasts));
}

function dismiss(id: number) {
  const next = toasts.filter((toast) => toast.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

/** Transient confirmation for user actions (saved, removed, sent). Never used for data errors. */
export function toast(message: string, options: { tone?: ToastTone; action?: ToastItem['action']; duration?: number } = {}) {
  sequence += 1;
  const id = sequence;
  toasts = [...toasts.slice(-2), { id, message, tone: options.tone ?? 'success', action: options.action }];
  emit();
  window.setTimeout(() => dismiss(id), options.duration ?? 2600);
  return id;
}

const TONE_STYLE: Record<ToastTone, { className: string; icon: React.ReactNode }> = {
  success: { className: 'text-positive', icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> },
  info: { className: 'text-brand-accent', icon: <Info className="h-4 w-4" aria-hidden="true" /> },
  error: { className: 'text-negative', icon: <TriangleAlert className="h-4 w-4" aria-hidden="true" /> },
};

export function ToastRegion() {
  const [items, setItems] = useState<ToastItem[]>(toasts);
  const isDesktop = useMediaQuery('(min-width: 640px)');

  useEffect(() => {
    const listener: Listener = (next) => setItems([...next]);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      className={`pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-3 ${
        isDesktop ? 'bottom-6' : 'bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))]'
      }`}
    >
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
            className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full border border-line bg-surface/95 px-3.5 py-2 text-caption font-bold text-ink shadow-float backdrop-blur"
          >
            <span className={TONE_STYLE[item.tone].className}>{TONE_STYLE[item.tone].icon}</span>
            <span className="min-w-0 truncate">{item.message}</span>
            {item.action && (
              <button
                type="button"
                onClick={() => {
                  item.action?.onClick();
                  dismiss(item.id);
                }}
                className="shrink-0 rounded-full px-2 py-0.5 text-micro font-extrabold text-brand-accent hover:bg-brand-soft"
              >
                {item.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss"
              className="-me-1 shrink-0 rounded-full p-1 text-muted hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

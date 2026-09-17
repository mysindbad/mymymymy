import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react';
import { X } from 'lucide-react';
import { IconButton } from './Button';
import { useLocale } from '../lib/i18n';

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SIZE_CLASS = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
} as const;

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  /** Sticky footer with the sheet's primary action(s). */
  footer?: React.ReactNode;
  /** Header content shown instead of the title block (photo headers etc). */
  header?: React.ReactNode;
  size?: keyof typeof SIZE_CLASS;
  /** `sheet` slides from the bottom edge, `dialog` centres. Auto by breakpoint. */
  variant?: 'auto' | 'sheet' | 'dialog';
  /** Header chrome for photo/immersive surfaces: keeps the close control legible. */
  tone?: 'default' | 'onPhoto';
  dismissible?: boolean;
  language?: string;
  className?: string;
  bodyClassName?: string;
}

/**
 * One overlay primitive for the whole product: a drag-dismissible bottom sheet on
 * phones, a centred dialog from `sm` up. Handles Escape, backdrop, focus trap,
 * focus restoration and background scroll lock.
 */
export function Sheet({
  open,
  onClose,
  children,
  title,
  subtitle,
  footer,
  header,
  size = 'md',
  variant = 'auto',
  tone = 'default',
  dismissible = true,
  language = 'en',
  className = '',
  bodyClassName = '',
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const locale = useLocale(language);
  const isDesktop = useMediaQuery('(min-width: 640px)');
  const mode = variant === 'auto' ? (isDesktop ? 'dialog' : 'sheet') : variant;
  const [pendingClose, setPendingClose] = useState(false);
  const dragControls = useDragControls();

  useEffect(() => {
    if (!open) return undefined;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')
        || panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
        || panelRef.current;
      target?.focus({ preventScroll: true });
    }, 40);
    return () => {
      window.clearTimeout(timer);
      restoreFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (!dismissible) return;
      event.stopPropagation();
      onClose();
      return;
    }
    const panel = panelRef.current as HTMLElement | null;
    if (event.key !== 'Tab' || !panel) return;
    const focusables: HTMLElement[] = Array.from(panel.querySelectorAll(FOCUSABLE) as NodeListOf<HTMLElement>)
      .filter((element) => element.offsetParent !== null || element === document.activeElement);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, [dismissible, onClose]);

  const handleDragEnd = useCallback((_event: unknown, info: PanInfo) => {
    if (!dismissible) return;
    if (info.offset.y > 110 || info.velocity.y > 620) {
      setPendingClose(true);
      window.setTimeout(() => {
        setPendingClose(false);
        onClose();
      }, 130);
      return;
    }
    setPendingClose(false);
  }, [dismissible, onClose]);

  const panel = (
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      initial={mode === 'sheet' ? { y: '100%' } : { opacity: 0, y: 12, scale: 0.98 }}
      animate={pendingClose ? { opacity: 0, y: 24 } : mode === 'sheet' ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
      exit={mode === 'sheet' ? { y: '100%' } : { opacity: 0, y: 8, scale: 0.985 }}
      transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
      drag={mode === 'sheet' && dismissible ? 'y' : false}
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.4 }}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      className={`${mode === 'sheet'
        ? 'fixed inset-x-0 bottom-0 z-50 flex max-h-[93dvh] flex-col overflow-hidden rounded-t-2xl border-t border-line bg-surface shadow-sheet'
        : 'relative z-50 flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg'
      } ${SIZE_CLASS[size]}${className ? ` ${className}` : ''}`}
    >
      {mode === 'sheet' && (
        <div
          className="flex shrink-0 touch-none justify-center pt-2.5"
          aria-hidden="true"
          onPointerDown={(event) => {
            if (mode === 'sheet' && dismissible) dragControls.start(event);
          }}
        >
          <span className="h-1 w-10 rounded-full bg-line-strong" />
        </div>
      )}

      {header ?? (
        <div
          className="flex shrink-0 items-start gap-3 border-b border-line px-4 py-3"
          onPointerDown={(event) => {
            if (mode === 'sheet' && dismissible && !(event.target as HTMLElement).closest('button')) dragControls.start(event);
          }}
        >
          <div className="min-w-0 flex-1">
            {title && (
              <h2 id={titleId} className="text-title font-bold tracking-tight text-ink">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 text-caption leading-snug text-muted">{subtitle}</p>}
          </div>
          {dismissible && (
            <IconButton
              label={locale.t('Close', 'إغلاق', 'Fermer')}
              onClick={onClose}
              size="sm"
              variant={tone === 'onPhoto' ? 'onPhoto' : 'ghost'}
              className="-me-1 -mt-0.5"
            >
              <X className="h-4 w-4" />
            </IconButton>
          )}
        </div>
      )}

      <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${bodyClassName}`}>
        {children}
      </div>

      {footer && (
        <div className="sindbad-safe-bottom shrink-0 border-t border-line bg-surface-muted px-4 py-3">
          {footer}
        </div>
      )}
    </motion.div>
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            className="absolute inset-0 bg-scrim/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={dismissible ? onClose : undefined}
            aria-hidden="true"
          />
          {panel}
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

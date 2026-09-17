import React from 'react';
import { AlertTriangle, CheckCircle2, Inbox, Info, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} aria-hidden="true" />;
}

/** Skeletons mirror the shape of the content they replace, never a spinner island. */
export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <span className={`sindbad-skeleton block rounded-md ${className}`} aria-hidden="true" />;
}

export function SkeletonList({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <ul className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
          <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
          <span className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </span>
        </li>
      ))}
    </ul>
  );
}

export type AlertTone = 'info' | 'success' | 'warning' | 'error';

const ALERT_TONES: Record<AlertTone, string> = {
  info: 'border-brand-line bg-brand-soft text-brand-accent',
  success: 'border-positive-line bg-positive-soft text-positive-strong',
  warning: 'border-caution-line bg-caution-soft text-caution-strong',
  error: 'border-negative-line bg-negative-soft text-negative-strong',
};

const ALERT_ICONS: Record<AlertTone, React.ReactNode> = {
  info: <Info className="h-4 w-4" aria-hidden="true" />,
  success: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
  warning: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
  error: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
};

export function Alert({
  tone = 'info',
  icon = true,
  title,
  children,
  action,
  className = '',
}: {
  tone?: AlertTone;
  icon?: boolean;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-caption ${ALERT_TONES[tone]} ${className}`}
    >
      {icon && <span className="mt-px shrink-0">{ALERT_ICONS[tone]}</span>}
      <div className="min-w-0 flex-1 space-y-0.5">
        {title && <strong className="block text-body font-bold">{title}</strong>}
        <div className="font-medium leading-snug">{children}</div>
      </div>
      {action && <div className="flex shrink-0 items-center">{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'neutral',
  className = '',
  titleAs = 'h3',
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: 'neutral' | 'dashed';
  className?: string;
  /** Heading level so the component never creates a skipped heading rank inside a screen. */
  titleAs?: 'h2' | 'h3';
}) {
  const Title = titleAs as 'h2';
  return (
    <div
      className={`${tone === 'dashed' ? 'border border-dashed border-line-strong' : ''} flex flex-col items-center justify-center gap-2 rounded-xl bg-surface-muted px-5 py-9 text-center ${className}`}
    >
      {icon && (
        <span className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-brand-accent shadow-xs">
          {icon}
        </span>
      )}
      <Title className="text-title font-bold text-ink">{title}</Title>
      {description && <p className="max-w-sm text-caption leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = 'Retry',
  children,
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-negative-line bg-negative-soft px-4 py-5 text-center">
      <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-negative">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="text-title font-bold text-negative-strong">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-sm text-caption leading-relaxed text-negative-strong/85">{description}</p>}
      {children}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry} icon={<RefreshCw className="h-3.5 w-3.5" />}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

export function LoadingRow({ label, className = '' }: { label: string; className?: string }) {
  return (
    <p className={`flex items-center justify-center gap-2 py-6 text-caption font-semibold text-muted ${className}`}>
      <Spinner className="h-3.5 w-3.5 text-brand-accent" />
      <span>{label}</span>
    </p>
  );
}

export function NoResultsIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return <Inbox className={className} aria-hidden="true" />;
}

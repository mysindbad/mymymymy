import React from 'react';

/**
 * Surfaces. A container is only allowed when it separates content the user
 * compares side by side; everything else is spaced, not boxed.
 */

export type PanelPadding = 'none' | 'sm' | 'md' | 'lg';

const PADDING: Record<PanelPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

export function Panel({
  as: Tag = 'div',
  padded = 'md',
  interactive = false,
  className = '',
  children,
  ...rest
}: {
  as?: 'div' | 'section' | 'article' | 'li';
  padded?: PanelPadding;
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      data-surface="card"
      className={`rounded-xl border border-line bg-surface shadow-sm ${PADDING[padded]}${
        interactive ? ' transition-colors duration-150 hover:border-line-strong' : ''
      }${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function SectionHeading({
  title,
  eyebrow,
  description,
  action,
  size = 'md',
  className = '',
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const titleClass = size === 'lg' ? 'text-h1' : size === 'sm' ? 'text-body' : 'text-h2';
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-label font-bold uppercase tracking-[0.08em] text-muted">{eyebrow}</p>
        )}
        <h2 className={`${titleClass} font-bold tracking-tight text-ink`}>{title}</h2>
        {description && <p className="mt-1 max-w-lg text-caption leading-relaxed text-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
    </div>
  );
}

export function Divider({ className = '', label }: { className?: string; label?: string }) {
  if (!label) return <hr className={`border-0 border-t border-line ${className}`} />;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="h-px flex-1 bg-line" />
      <span className="text-micro font-semibold uppercase tracking-wider text-muted">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Stat used where a number genuinely earns attention (budget, distance, rating). */
export function Stat({
  label,
  value,
  hint,
  tone = 'default',
  className = '',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'brand' | 'warning' | 'positive';
  className?: string;
}) {
  const valueTone = tone === 'brand'
    ? 'text-brand-accent'
    : tone === 'warning'
      ? 'text-caution-strong'
      : tone === 'positive'
        ? 'text-positive'
        : 'text-ink';
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-micro font-semibold uppercase tracking-[0.06em] text-muted">{label}</p>
      <p className={`mt-0.5 truncate text-title font-extrabold tabular-nums ${valueTone}`}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-micro text-muted">{hint}</p>}
    </div>
  );
}

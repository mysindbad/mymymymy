import React from 'react';

export type ChipTone = 'neutral' | 'brand' | 'positive' | 'caution' | 'negative' | 'onPhoto';

const CHIP_TONES: Record<ChipTone, string> = {
  neutral: 'border-line bg-surface-muted text-ink-soft',
  brand: 'border-brand-line bg-brand-soft text-brand-accent',
  positive: 'border-positive-line bg-positive-soft text-positive-strong',
  caution: 'border-caution-line bg-caution-soft text-caution-strong',
  negative: 'border-negative-line bg-negative-soft text-negative-strong',
  onPhoto: 'border-white/20 bg-scrim/55 text-white backdrop-blur-sm',
};

/** Read-only label. Used sparingly: only for trust, category and state facts. */
export function Chip({
  tone = 'neutral',
  icon,
  children,
  className = '',
}: {
  tone?: ChipTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-micro font-bold ${
        CHIP_TONES[tone]
      }${className ? ` ${className}` : ''}`}
    >
      {icon && <span className="shrink-0" aria-hidden="true">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Filter control used in horizontal scrollers. */
export function FilterChip({
  selected = false,
  onClick,
  children,
  count,
  icon,
  className = '',
}: {
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-label font-bold pointer-coarse:min-h-11 pointer-coarse:px-3.5 transition-colors duration-150 ${
        selected
          ? 'border-brand-600 bg-brand-fill text-on-brand shadow-xs'
          : 'border-line-strong bg-surface text-ink-soft hover:bg-surface-muted'
      }${className ? ` ${className}` : ''}`}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
      {typeof count === 'number' && (
        <span className={`tabular-nums ${selected ? 'text-on-brand/80' : 'text-muted'}`}>{count}</span>
      )}
    </button>
  );
}

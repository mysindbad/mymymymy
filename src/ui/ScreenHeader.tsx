import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { IconButton } from './Button';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  /** Renders the standard leading back control. */
  onBack?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
  /** Sticky translucent bar — the one header pattern used by every screen. */
  sticky?: boolean;
  className?: string;
}

export function ScreenHeader({ title, subtitle, leading, actions, onBack, backLabel = 'Back', sticky = true, className = '' }: ScreenHeaderProps) {
  return (
    <header
      className={`${sticky ? 'sticky top-0 z-30 lg:top-14' : ''} border-b border-line bg-surface/92 backdrop-blur-md ${className}`}
    >
      <div className="sindbad-safe-top mx-auto flex min-h-14 flex-wrap items-center gap-x-2.5 gap-y-1 px-2.5 py-2 sm:px-4">
        {onBack && (
          <IconButton
            icon={<ChevronLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />}
            label={backLabel}
            onClick={onBack}
          />
        )}
        {leading}
        <div className="min-w-0 flex-1 basis-40">
          <h1 className="truncate text-title font-bold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="truncate text-micro font-medium text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="ms-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">{actions}</div>}
      </div>
    </header>
  );
}

export function ScreenBody({
  children,
  className = '',
  width = 'content',
}: {
  children: React.ReactNode;
  className?: string;
  /** `content` reads best for lists, `wide` for grids and split views. */
  width?: 'content' | 'wide' | 'full';
}) {
  const max = width === 'content' ? 'max-w-2xl' : width === 'wide' ? 'max-w-6xl' : 'max-w-none';
  return (
    <div className={`mx-auto w-full ${max} px-3 pb-8 pt-4 sm:px-5 ${className}`}>{children}</div>
  );
}

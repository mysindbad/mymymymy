import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'destructive' | 'positive' | 'onPhoto';
export type ButtonSize = 'sm' | 'md' | 'lg';

const CONTROL_BASE =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-bold whitespace-nowrap select-none '
  + 'transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-150 '
  + 'active:translate-y-px disabled:pointer-events-none disabled:opacity-45';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-fill text-on-brand shadow-sm hover:bg-brand-fill-hover active:bg-brand-fill-active',
  secondary: 'border border-line-strong bg-surface text-ink shadow-xs hover:bg-surface-muted active:bg-surface-sunken',
  ghost: 'text-ink-soft hover:bg-surface-sunken hover:text-ink',
  quiet: 'text-brand-accent hover:bg-brand-soft',
  destructive: 'bg-negative-fill text-negative-ink shadow-sm hover:brightness-110 active:brightness-95',
  positive: 'bg-positive-fill text-positive-ink shadow-sm hover:brightness-110 active:brightness-95',
  onPhoto: 'border border-white/20 bg-scrim/55 text-white backdrop-blur-sm hover:bg-scrim/75',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-label pointer-coarse:min-h-[44px]',
  md: 'h-11 px-4 text-body',
  lg: 'h-12 px-5 text-body',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  full?: boolean;
}

/** Every action in the product renders through this one component. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  trailingIcon,
  full = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}, ref) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${CONTROL_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]}${full ? ' w-full' : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
});

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Mandatory: icon-only controls must announce themselves. */
  label: string;
  /** Icon content — accepted as `icon` or as children. */
  icon?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: 'round' | 'square';
  loading?: boolean;
  active?: boolean;
}

const ICON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 w-9 pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px]',
  md: 'h-11 w-11',
  lg: 'h-12 w-12',
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  shape = 'round',
  loading = false,
  active = false,
  className = '',
  children,
  icon,
  type = 'button',
  ...rest
}, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={active || undefined}
      aria-busy={loading || undefined}
      title={label}
      className={`${CONTROL_BASE} ${shape === 'round' ? 'rounded-full' : 'rounded-lg'} ${BUTTON_VARIANTS[variant]} ${ICON_SIZES[size]} p-0${
        size === 'sm' ? ' sindbad-hit-expand' : ''
      }${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : (children ?? icon)}
    </button>
  );
});

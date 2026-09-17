import React from 'react';
import { Check, ChevronDown } from 'lucide-react';

const FIELD_BASE =
  'w-full rounded-lg border bg-surface text-body text-ink placeholder:text-muted transition-colors duration-150 '
  + 'focus:outline-none focus-visible:outline-none';

const FIELD_STATE = {
  idle: 'border-line-strong focus:border-brand-500 focus:ring-3 focus:ring-brand-soft',
  error: 'border-negative focus:border-negative focus:ring-3 focus:ring-negative-soft',
};

export function FieldLabel({
  htmlFor,
  children,
  hint,
  required = false,
  className = '',
}: {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`mb-1.5 flex items-baseline justify-between gap-3 ${className}`}>
      <label htmlFor={htmlFor} className="text-label font-bold text-ink-soft">
        {children}
        {required && <span className="ms-1 text-negative" aria-hidden="true">*</span>}
      </label>
      {hint && <span className="text-micro text-muted">{hint}</span>}
    </div>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-micro font-semibold leading-snug text-negative">
      <span aria-hidden="true" className="mt-px h-1 w-1 shrink-0 rounded-full bg-negative" />
      {children}
    </p>
  );
}

/**
 * `Record<string, any>` carries the native input attributes through to the element.
 * The repo compiles without `@types/react`, so the DOM attribute types are not
 * available to extend here; the passthrough keeps the component honest instead.
 */
type FieldPassthrough = Record<string, any>;

export interface TextInputProps extends FieldPassthrough {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  trailing?: React.ReactNode;
  id: string;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(function TextInput({
  label,
  hint,
  error,
  leadingIcon,
  trailing,
  id,
  className = '',
  required,
  ...rest
}, ref) {
  return (
    <div className={className}>
      {label && (
        <FieldLabel htmlFor={id} hint={hint} required={required}>
          {label}
        </FieldLabel>
      )}
      <div className="relative">
        {leadingIcon && (
          <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-muted" aria-hidden="true">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${FIELD_BASE} ${error ? FIELD_STATE.error : FIELD_STATE.idle} h-11 ${
            leadingIcon ? 'ps-10' : 'ps-3.5'
          } ${trailing ? 'pe-11' : 'pe-3.5'}`}
          {...rest}
        />
        {trailing && <span className="absolute inset-y-0 end-0 flex items-center pe-1.5">{trailing}</span>}
      </div>
      {error && <div id={`${id}-error`}><FieldError>{error}</FieldError></div>}
    </div>
  );
});

export interface TextAreaProps extends FieldPassthrough {
  label?: string;
  hint?: string;
  error?: string;
  id: string;
  rows?: number;
}

export function TextArea({ label, hint, error, id, className = '', rows = 3, required, ...rest }: TextAreaProps) {
  return (
    <div className={className}>
      {label && (
        <FieldLabel htmlFor={id} hint={hint} required={required}>
          {label}
        </FieldLabel>
      )}
      <textarea
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${FIELD_BASE} ${error ? FIELD_STATE.error : FIELD_STATE.idle} px-3.5 py-2.5 leading-relaxed`}
        {...rest}
      />
      {error && <div id={`${id}-error`}><FieldError>{error}</FieldError></div>}
    </div>
  );
}

export interface SelectProps extends FieldPassthrough {
  label?: string;
  error?: string;
  id: string;
}

export function Select({ label, error, id, className = '', children, ...rest }: SelectProps) {
  return (
    <div className={className}>
      {label && <FieldLabel htmlFor={id}>{label}</FieldLabel>}
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          className={`${FIELD_BASE} ${error ? FIELD_STATE.error : FIELD_STATE.idle} h-11 appearance-none ps-3.5 pe-9 font-semibold`}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 end-2.5 my-auto h-4 w-4 text-muted"
        />
      </div>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  id,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  id: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="min-w-0">
        <label htmlFor={id} className="block text-body font-bold text-ink">
          {label}
        </label>
        {description && <span className="mt-0.5 block text-caption leading-snug text-muted">{description}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full border transition-colors duration-150 disabled:opacity-50 ${
          checked ? 'border-brand-600 bg-brand-fill' : 'border-line-strong bg-surface-sunken'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5.5 w-5.5 rounded-full bg-surface shadow-sm transition-[inset-inline-start] duration-150 ease-glide ${
            checked ? 'start-5.5' : 'start-0.5'
          }`}
          style={{ height: '1.375rem', width: '1.375rem' }}
        />
        <span className="sr-only">{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}

export function CheckboxRow({
  checked,
  onChange,
  label,
  id,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: React.ReactNode;
  id: string;
  description?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface-muted p-3 text-caption transition-colors hover:border-line-strong"
    >
      <span className="relative mt-px flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer h-5 w-5 appearance-none rounded-md border border-line-strong bg-surface transition-colors checked:border-brand-600 checked:bg-brand-fill focus-visible:ring-3 focus-visible:ring-brand-soft"
        />
        <Check
          aria-hidden="true"
          className="pointer-events-none absolute h-3.5 w-3.5 scale-75 text-on-brand opacity-0 transition peer-checked:scale-100 peer-checked:opacity-100"
          strokeWidth={3}
        />
      </span>
      <span className="min-w-0 flex-1 leading-snug text-ink-soft">
        {label}
        {description && <span className="mt-0.5 block text-micro text-muted">{description}</span>}
      </span>
    </label>
  );
}

/** Selectable tile used by pickers (trip preferences, place category, role). */
export function OptionCard({
  selected,
  onSelect,
  label,
  description,
  icon,
  className = '',
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex min-h-12 items-center gap-2.5 rounded-lg border p-3 text-start transition-colors duration-150 ${
        selected
          ? 'border-brand-600 bg-brand-soft text-brand-accent shadow-xs'
          : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:bg-surface-muted'
      }${className ? ` ${className}` : ''}`}
    >
      {icon && <span className={`shrink-0 ${selected ? 'text-brand-accent' : 'text-muted'}`} aria-hidden="true">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-body font-bold [text-wrap:balance]">{label}</span>
        {description && <span className="block text-micro text-muted [text-wrap:balance]">{description}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
          selected ? 'border-brand-600 bg-brand-fill text-on-brand' : 'border-line-strong text-transparent'
        }`}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    </button>
  );
}

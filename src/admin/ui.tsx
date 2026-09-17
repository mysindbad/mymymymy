// Shared building blocks for the Admin Control Center.
//
// These are deliberately plain CSS + semantic HTML rather than a component kit: the console
// needs tables, toolbars, inspectors and confirmations, and each of those has to behave
// correctly for a keyboard and a screen reader without a library deciding the semantics.
/* eslint-disable react-refresh/only-export-components */
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type RefObject,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Inbox,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useAdminLocale } from './locale-context';
import { useAdminSession } from './session';
import { AdminApiError, describeAdminError } from './api';
import { currentAdminToasts, dismissAdminToast, subscribeAdminToasts, type AdminToast } from './toast';

export type Tone = 'ok' | 'warn' | 'bad' | 'unknown' | 'neutral';

export function Pill({ state = 'neutral', children, title }: { state?: Tone; children: ReactNode; title?: string }) {
  return (
    <span className="adm-pill" data-state={state} title={title}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'ghost'; size?: 'sm' | 'md' };

export function Button({ variant, size = 'md', className = '', type = 'button', ...rest }: ButtonProps) {
  return <button {...rest} type={type} data-variant={variant} data-size={size} className={`adm-btn ${className}`.trim()} />;
}

export function IconButton({ label, children, className = '', ...rest }: ButtonProps & { label: string }) {
  return (
    <button {...rest} type="button" aria-label={label} title={label} className={`adm-btn adm-btn-icon ${className}`.trim()}>
      {children}
    </button>
  );
}

export function RefreshButton({ onClick, busy, label }: { onClick: () => void; busy?: boolean; label?: string }) {
  const { t } = useAdminLocale();
  return (
    <Button onClick={onClick} data-variant="ghost" disabled={busy} aria-label={label ?? t('Refresh data', 'تحديث البيانات', 'Rafraîchir les données')}>
      <RefreshCw size={13} aria-hidden="true" style={busy ? { animation: 'adm-spin 900ms linear infinite' } : undefined} />
      {t('Refresh', 'تحديث', 'Rafraîchir')}
    </Button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string; tone?: Tone }>;
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div className="adm-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          {option.tone && option.tone !== 'neutral' ? <span className="adm-pill" data-state={option.tone} aria-hidden="true" style={{ padding: 0, border: 0, background: 'none' }}><i /></span> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface FieldShell {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children?: ReactNode;
}

function useFieldIds(error?: string | null, hint?: ReactNode) {
  const id = useId();
  return {
    id,
    labelId: `${id}-label`,
    describedBy: [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined,
    invalid: error ? true : undefined,
  };
}

export function TextInput({
  label,
  hint,
  error,
  className = '',
  inputRef,
  ...rest
}: FieldShell & InputHTMLAttributes<HTMLInputElement> & { inputRef?: RefObject<HTMLInputElement | null> }) {
  const ids = useFieldIds(error, hint);
  return (
    <div className={`adm-field ${className}`.trim()}>
      <label htmlFor={rest.id ?? ids.id}>{label}</label>
      <input
        {...rest}
        ref={inputRef}
        id={rest.id ?? ids.id}
        className="adm-input"
        aria-invalid={ids.invalid}
        aria-describedby={ids.describedBy}
      />
      {error ? <span className="adm-error-text" id={`${ids.id}-error`} role="alert">{error}</span> : null}
      {!error && hint ? <span className="adm-hint" id={`${ids.id}-hint`}>{hint}</span> : null}
    </div>
  );
}

export function Textarea({
  label,
  hint,
  error,
  rows = 4,
  className = '',
  textAreaRef,
  ...rest
}: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement> & { textAreaRef?: RefObject<HTMLTextAreaElement | null> }) {
  const ids = useFieldIds(error, hint);
  return (
    <div className={`adm-field ${className}`.trim()}>
      <label htmlFor={rest.id ?? ids.id}>{label}</label>
      <textarea
        {...rest}
        rows={rows}
        ref={textAreaRef}
        id={rest.id ?? ids.id}
        className="adm-textarea"
        aria-invalid={ids.invalid}
        aria-describedby={ids.describedBy}
      />
      {error ? <span className="adm-error-text" id={`${ids.id}-error`} role="alert">{error}</span> : null}
      {!error && hint ? <span className="adm-hint" id={`${ids.id}-hint`}>{hint}</span> : null}
    </div>
  );
}

export function Select({
  label,
  hint,
  error,
  options,
  className = '',
  ...rest
}: FieldShell & SelectHTMLAttributes<HTMLSelectElement> & { options: Array<{ value: string; label: string }> }) {
  const ids = useFieldIds(error, hint);
  return (
    <div className={`adm-field ${className}`.trim()}>
      <label htmlFor={rest.id ?? ids.id}>{label}</label>
      <select {...rest} id={rest.id ?? ids.id} className="adm-select" aria-invalid={ids.invalid} aria-describedby={ids.describedBy}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="adm-error-text" id={`${ids.id}-error`} role="alert">{error}</span> : null}
      {!error && hint ? <span className="adm-hint" id={`${ids.id}-hint`}>{hint}</span> : null}
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  inputRef,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  label: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const attached = inputRef ?? ref;
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
        event.preventDefault();
        attached.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [attached]);

  return (
    <form
      className="adm-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <Search aria-hidden="true" />
      <input
        ref={attached}
        id={id}
        type="search"
        value={value}
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
    </form>
  );
}

export function Panel({
  title,
  level = 2,
  note,
  actions,
  children,
  footer,
  flush = false,
  className = '',
}: {
  title: string;
  level?: 2 | 3;
  note?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  const headingId = useId();
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section className={`adm-panel ${className}`.trim()} aria-labelledby={headingId}>
      <header className="adm-panel-head">
        <Heading id={headingId}>{title}</Heading>
        {note ? <span className="adm-note">{note}</span> : null}
        {actions ? <div style={{ marginInlineStart: 'auto', display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>{actions}</div> : null}
      </header>
      {flush ? children : <div className="adm-panel-body">{children}</div>}
      {footer ? <div className="adm-pager">{footer}</div> : null}
    </section>
  );
}

export function Metric({
  label,
  value,
  unit,
  note,
  tone,
}: {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  note?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="adm-metric" data-tone={tone}>
      <dt>{label}</dt>
      <dd>
        {value}
        {unit ? <small> {unit}</small> : null}
      </dd>
      {note ? <span className="adm-metric-source">{note}</span> : null}
    </div>
  );
}

/** A figure and the query it came from. Invented trends are not part of this console. */
export function Distribution({
  items,
  emptyLabel,
}: {
  items: Array<{ key: string; label: string; value: number; note?: string }>;
  emptyLabel?: string;
}) {
  const max = items.reduce((best, item) => Math.max(best, item.value), 0);
  if (!items.length) {
    return <p className="adm-note">{emptyLabel ?? 'No rows recorded.'}</p>;
  }
  return (
    <ul className="adm-dist">
      {items.map((item) => (
        <li key={item.key}>
          <span className="adm-dist-key" title={item.note ?? item.label}>{item.label}</span>
          <span className="adm-dist-bar" aria-hidden="true">
            <i style={{ width: max > 0 ? `${Math.max(2, Math.round((item.value / max) * 100))}%` : '0%' }} />
          </span>
          <span className="adm-dist-val adm-num">{new Intl.NumberFormat().format(item.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export function DayBars({ days }: { days: Array<{ date: string; count: number }> }) {
  const max = days.reduce((best, day) => Math.max(best, day.count), 0);
  return (
    <ul className="adm-days" aria-hidden="true">
      {days.map((day) => (
        <li key={day.date} title={`${day.date}: ${day.count}`}>
          <b style={{ ['--adm-bar-h' as string]: `${Math.max(2, Math.round((day.count / (max || 1)) * 60))}px` }} />
          <span>{day.date.slice(8)}</span>
        </li>
      ))}
    </ul>
  );
}

export interface Column<Row> {
  id: string;
  label: string;
  render: (row: Row) => ReactNode;
  sortKey?: string;
  align?: 'start' | 'end';
  width?: string;
  hideBelow?: number;
}

interface DataTableProps<Row> {
  caption: string;
  columns: Array<Column<Row>>;
  rows: Row[];
  rowKey: (row: Row) => string;
  onRowSelect?: (row: Row) => void;
  activeKey?: string | null;
  sort?: { key: string; dir: 'asc' | 'desc' } | null;
  onSortChange?: (key: string) => void;
  isLoading?: boolean;
  skeletonRows?: number;
  empty?: ReactNode;
  error?: ReactNode;
}

/**
 * The table is the primary instrument here, so its behaviour is explicit: real caption,
 * aria-sort on sortable headers, a focusable button inside the first cell of each row (which
 * gives Tab/Enter/j-k for free), and no attempt to make the whole page scroll for it.
 */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  onRowSelect,
  activeKey,
  sort,
  onSortChange,
  isLoading,
  skeletonRows = 6,
  empty,
  error,
}: DataTableProps<Row>) {
  const { t } = useAdminLocale();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.tagName !== 'BUTTON' || !target.hasAttribute('data-adm-row')) return;
      const index = Number(target.getAttribute('data-adm-row'));
      const delta = event.key === 'ArrowDown' || event.key === 'j' ? 1 : event.key === 'ArrowUp' || event.key === 'k' ? -1 : 0;
      if (!delta) return;
      const next = container.querySelector<HTMLElement>(`[data-adm-row="${index + delta}"]`);
      if (next) {
        event.preventDefault();
        next.focus();
      }
    };
    container.addEventListener('keydown', onKeyDown);
    return () => container.removeEventListener('keydown', onKeyDown);
  }, [rows.length, isLoading]);

  return (
    <div className="adm-table-wrap" ref={containerRef}>
      <table className="adm-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const sortable = Boolean(column.sortKey && onSortChange);
              const isSorted = sortable && sort?.key === column.sortKey;
              return (
                <th
                  key={column.id}
                  scope="col"
                  style={{ textAlign: column.align ?? 'start', minWidth: column.width }}
                  aria-sort={isSorted ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => onSortChange?.(column.sortKey as string)}
                      title={t('Sort by this column', 'فرز حسب هذا العمود', 'Trier par cette colonne')}
                    >
                      {column.label}
                      {isSorted ? (
                        <span aria-hidden="true" style={{ transform: sort?.dir === 'asc' ? 'rotate(180deg)' : undefined, display: 'inline-flex' }}>
                          <ChevronDown size={11} />
                        </span>
                      ) : null}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {error ? (
            <tr>
              <td colSpan={columns.length}>{error}</td>
            </tr>
          ) : isLoading ? (
            Array.from({ length: skeletonRows }).map((_, index) => (
              <tr key={`skeleton-${index}`} aria-hidden="true">
                {columns.map((column) => (
                  <td key={column.id}><span className="adm-skeleton" style={{ display: 'block', inlineSize: column.align === 'end' ? '3rem' : '80%' }} /></td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{empty ?? <EmptyState title={t('Nothing matches these filters', 'لا شيء يطابق هذه المرشحات', 'Aucun résultat avec ces filtres')} />}</td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const key = rowKey(row);
              return (
                <tr key={key} data-active={activeKey === key ? 'true' : undefined}>
                  {columns.map((column, cellIndex) => (
                    <td key={column.id} style={{ textAlign: column.align ?? 'start' }}>
                      {cellIndex === 0 && onRowSelect ? (
                        <button type="button" className="adm-rowbtn" data-adm-row={index} onClick={() => onRowSelect(row)}>
                          {column.render(row)}
                        </button>
                      ) : (
                        column.render(row)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      <span className="adm-sr-only" role="status" aria-live="polite">
        {isLoading
          ? t('Loading rows', 'جارٍ تحميل الصفوف', 'Chargement des lignes')
          : t(`${rows.length} rows on this page`, `${rows.length} صفا في هذه الصفحة`, `${rows.length} lignes sur cette page`)}
      </span>
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
  onPageSize,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (next: number) => void;
  onPageSize?: (next: number) => void;
}) {
  const { t, n } = useAdminLocale();
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <>
      <span className="adm-pager-count adm-num">
        {t(`Rows ${from}–${to} of ${n(total)}`, `الصفوف ${from}–${to} من ${n(total)}`, `Lignes ${from}–${to} sur ${n(total)}`)}
      </span>
      <span style={{ marginInlineStart: 'auto', display: 'inline-flex', gap: '0.375rem', alignItems: 'center' }}>
        {onPageSize ? (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
            <span>{t('Rows', 'عدد الصفوف', 'Lignes')}</span>
            <select className="adm-select" value={String(pageSize)} onChange={(event) => onPageSize(Number(event.target.value))} aria-label={t('Rows per page', 'عدد الصفوف في الصفحة', 'Lignes par page')}>
              {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        ) : null}
        <Button size="sm" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}>
          {t('Previous', 'السابق', 'Précédent')}
        </Button>
        <span className="adm-num">{t(`Page ${page} of ${Math.max(1, pageCount)}`, `صفحة ${page} من ${Math.max(1, pageCount)}`, `Page ${page} sur ${Math.max(1, pageCount)}`)}</span>
        <Button size="sm" onClick={() => onPage(Math.min(pageCount, page + 1))} disabled={page >= pageCount}>
          {t('Next', 'التالي', 'Suivant')}
        </Button>
      </span>
    </>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="adm-empty">
      <Inbox size={18} aria-hidden="true" />
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  onRetry,
  retryLabel,
}: {
  title: string;
  body?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const { t } = useAdminLocale();
  return (
    <div className="adm-empty" role="alert">
      <AlertTriangle size={18} aria-hidden="true" style={{ color: 'var(--adm-bad)' }} />
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
      {onRetry ? (
        <Button onClick={onRetry} size="sm">
          {retryLabel ?? t('Try again', 'إعادة المحاولة', 'Réessayer')}
        </Button>
      ) : null}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = (): HTMLElement[] => (panel
      ? Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select,textarea,[href],[tabindex]:not([tabindex="-1"])'))
      : []);
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    panel?.addEventListener('keydown', onKeyDown);
    return () => {
      panel?.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div className="adm-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="adm-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panelRef} data-size={size}>
        <header>
          <h2 id={titleId}>{title}</h2>
          <IconButton
            label="Close"
            onClick={onClose}
            style={{ marginInlineStart: 'auto' }}
            data-adm-close
          >
            <X size={14} aria-hidden="true" />
          </IconButton>
        </header>
        <div className="adm-modal-body">{children}</div>
        {footer ? <footer>{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Destructive confirmations name the exact entity and require typing that name back. There is
 * no "delete everything" anywhere in this console; the only reversible action (hiding a place
 * from the public feed) still asks for the place name because it is still a real change.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  expect,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy,
  validationError,
  children,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  expect: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  validationError?: string | null;
  children?: ReactNode;
}) {
  const [text, setText] = useState('');
  const { t } = useAdminLocale();
  useEffect(() => { if (open) setText(''); }, [open]);
  if (!open) return null;
  const matches = text.trim() === expect.trim();
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={(
        <>
          <Button onClick={onCancel} data-variant="ghost">{cancelLabel}</Button>
          <Button onClick={onConfirm} disabled={!matches || busy} data-variant="danger">
            {busy ? t('Working…', 'جارٍ التنفيذ…', 'Traitement…') : confirmLabel}
          </Button>
        </>
      )}
    >
      <div className="adm-danger-note" role="alert">
        {t('This is a privileged change. Type the target name to confirm.', 'هذا تغيير بصلاحيات. اكتب اسم العنصر للتأكيد.', 'Ceci est une modification privilégiée. Saisissez le nom de la cible pour confirmer.')}
      </div>
      <div>{body}</div>
      <p className="adm-confirm-target">{expect}</p>
      <TextInput
        label={t('Confirm by typing the name above', 'أكّد بكتابة الاسم أعلاه', 'Confirmez en saisissant le nom ci-dessus')}
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      {children}
      {validationError ? <span className="adm-error-text" role="alert">{validationError}</span> : null}
    </Modal>
  );
}

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const { t } = useAdminLocale();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied by policy; the value is still visible and selectable.
      setCopied(false);
    }
  };
  return (
    <Button size="sm" data-variant="ghost" onClick={copy} aria-label={label ?? t('Copy value', 'نسخ القيمة', 'Copier la valeur')}>
      {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
      {copied ? t('Copied', 'تم النسخ', 'Copié') : value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value}
    </Button>
  );
}

export function DefinitionList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="adm-dl">
      {items.map((item) => (
        <div key={item.label} style={{ display: 'contents' }}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Keeps a section title in the accessibility tree even when the value is empty. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="adm-section-title">{children}</h3>;
}

export function InspectorSkeleton() {
  return (
    <div className="adm-inspector" aria-busy="true">
      {Array.from({ length: 5 }).map((_, index) => <span key={index} className="adm-skeleton" style={{ display: 'block', inlineSize: `${88 - index * 9}%` }} />)}
    </div>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="adm-field">
      <span className="adm-label">{label}</span>
      <span style={{ fontSize: '0.8125rem' }}>{children}</span>
    </div>
  );
}

export function Toaster() {
  const [toasts, setToasts] = useState<readonly AdminToast[]>(currentAdminToasts());
  useEffect(() => subscribeAdminToasts(() => setToasts(currentAdminToasts())), []);
  if (toasts.length === 0) return null;
  return (
    <div className="adm-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button key={toast.id} type="button" className="adm-toast" data-tone={toast.tone} onClick={() => dismissAdminToast(toast.id)} style={{ textAlign: 'start', cursor: 'pointer', border: undefined }}>
          <strong>{toast.title}</strong>
          {toast.message ? <span>{toast.message}</span> : null}
        </button>
      ))}
    </div>
  );
}

/**
 * Every failure the console can hit has its own honest wording: refused, expired, unavailable,
 * not found, or a validation complaint from the database. None of them become an empty table.
 */
export function ErrorNotice({ error, onRetry, onReloadLabel }: { error: AdminApiError; onRetry?: () => void; onReloadLabel?: string }) {
  const { t } = useAdminLocale();
  const session = useAdminSession();
  const body = describeAdminError(error);

  if (error.isForbidden) {
    return (
      <div className="adm-empty" role="alert">
        <AlertTriangle size={18} aria-hidden="true" style={{ color: 'var(--adm-warn)' }} />
        <h3>{t('This account is not on the administrators roster', 'هذا الحساب ليس ضمن قائمة المشرفين', 'Ce compte ne figure pas dans la liste des administrateurs')}</h3>
        <p>{body}</p>
        <p className="adm-note">
          {t('Authorization is checked against the database on every request, so this screen cannot be unlocked from the browser.',
              'يُتحقق من صلاحية الوصول في كل طلب على مستوى قاعدة البيانات، لذلك لا يمكن فتح هذه الشاشة من المتصفح.',
              'L’autorisation est vérifiée côté base à chaque requête ; cet écran ne peut pas être débloqué depuis le navigateur.')}
        </p>
      </div>
    );
  }

  if (error.isUnauthorized) {
    return (
      <div className="adm-empty" role="alert">
        <AlertTriangle size={18} aria-hidden="true" style={{ color: 'var(--adm-warn)' }} />
        <h3>{t('The session expired', 'انتهت الجلسة', 'La session a expiré')}</h3>
        <p>{body}</p>
        <Button onClick={session.signIn} data-variant="primary" size="sm">
          {t('Sign in again', 'تسجيل الدخول من جديد', 'Se reconnecter')}
        </Button>
      </div>
    );
  }

  if (error.isUnavailable) {
    return (
      <div className="adm-empty" role="alert">
        <AlertTriangle size={18} aria-hidden="true" style={{ color: 'var(--adm-unknown)' }} />
        <h3>{t('The admin data service is not configured here', 'خدمة بيانات المشرفين غير مضبوطة على هذا النشر', 'Le service de données administrateur n’est pas configuré ici')}</h3>
        <p>{body}</p>
      </div>
    );
  }

  if (error.status === 400) {
    return <ErrorState title={t('The request was refused', 'رُفض الطلب', 'La requête a été refusée')} body={body} onRetry={onRetry} retryLabel={onReloadLabel} />;
  }

  return (
    <ErrorState
      title={error.code === 'NETWORK'
        ? t('The API could not be reached', 'لم يتم الوصول إلى واجهة البرمجة', 'Impossible de joindre l’API')
        : t('The server reported a problem', 'أبلغ الخادم عن مشكلة', 'Le serveur a signalé un problème')}
      body={<>{body}{error.status ? <span className="adm-note"> · {t('status', 'حالة', 'statut')} {error.status}{error.code ? ` · ${error.code}` : ''}</span> : null}</>}
      onRetry={onRetry}
      retryLabel={onReloadLabel}
    />
  );
}

/** A refresh failed while older data is still on screen. Shown, not hidden. */
export function StaleNotice({ at, onRetry }: { at: number | null; onRetry: () => void }) {
  const { t, time } = useAdminLocale();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.375rem 0.75rem', background: 'var(--adm-warn-soft)', color: 'var(--adm-warn)', fontSize: '0.75rem', fontWeight: 600 }} role="status">
      <AlertTriangle size={13} aria-hidden="true" />
      <span>{t('Live refresh is failing. Showing the last good read', 'فشل التحديث المباشر. يُعرض آخر قراءة ناجحة', 'Actualisation impossible : dernière lecture valide conservée')}{at ? ` · ${time(new Date(at).toISOString())}` : ''}</span>
      <Button size="sm" onClick={onRetry} style={{ marginInlineStart: 'auto' }}>{t('Retry now', 'إعادة المحاولة الآن', 'Réessayer')}</Button>
    </div>
  );
}

/**
 * Keyboard layer for the console. Only fires when nothing is being typed into, and every
 * screen decides its own subset - `?` opens the same help the help button shows, so the
 * shortcuts are discoverable rather than tribal knowledge.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(node.isContentEditable);
}

export function useHotkeys(handler: (event: KeyboardEvent) => void, enabled = true) {
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; }, [handler]);
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => ref.current(event);
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled]);
}

/** Arrow-key roving for the rail: Home/End plus Up/Down without leaving the menubar. */
export function useRovingFocus<Item extends HTMLElement>(getItem: (index: number) => Item | null, count: number) {
  return useCallback((index: number, event: KeyboardEvent) => {
    let next = index;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = Math.min(count - 1, index + 1);
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = count - 1;
    else return index;
    getItem(next)?.focus();
    return next;
  }, [count, getItem]);
}
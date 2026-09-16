import React from 'react';
import { Heart } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from './toast';
import { useLocale } from '../lib/i18n';

export interface SaveButtonProps {
  saved: boolean;
  onToggle: () => void;
  placeName: string;
  language?: string;
  /** `overlay` sits on imagery, `inline` in a row, `button` in a footer bar. */
  variant?: 'overlay' | 'inline' | 'button';
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The one save control used everywhere. Announces its result out loud (toast) so a
 * tap on a card never leaves the user guessing, and mirrors the persisted state.
 */
export function SaveButton({
  saved,
  onToggle,
  placeName,
  language = 'en',
  variant = 'overlay',
  size = 'md',
  className = '',
}: SaveButtonProps) {
  const locale = useLocale(language);
  const label = saved ? locale.t('Remove from saved', 'إزالة من المحفوظات', 'Retirer des favoris') : locale.t('Save place', 'حفظ المكان', 'Enregistrer le lieu');

  const handleToggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    onToggle();
    toast(saved
      ? locale.t(`Removed ${placeName}`, `أُزيل ${placeName}`, `${placeName} retiré`)
      : locale.t(`Saved ${placeName}`, `حُفظ ${placeName}`, `${placeName} enregistré`),
      { tone: saved ? 'info' : 'success' });
  };

  const icon = (
    <motion.span
      key={saved ? 'saved' : 'unsaved'}
      initial={{ scale: 0.72 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 620, damping: 22 }}
      className="flex"
    >
      <Heart className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} aria-hidden="true" />
    </motion.span>
  );

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={saved}
        className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3.5 text-label font-bold transition-colors duration-150 ${
          saved
            ? 'border-negative-line bg-negative-soft text-negative-strong'
            : 'border-line-strong bg-surface text-ink-soft hover:bg-surface-muted'
        }${className ? ` ${className}` : ''}`}
      >
        {icon}
        <span>{saved ? locale.t('Saved', 'محفوظ', 'Enregistré') : locale.t('Save', 'حفظ', 'Enregistrer')}</span>
      </button>
    );
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={saved}
        aria-label={label}
        title={label}
        className={`sindbad-hit-expand inline-flex items-center justify-center rounded-full p-2 transition-colors duration-150 ${
          size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'
        } ${saved ? 'bg-negative-soft text-negative' : 'text-muted hover:bg-surface-sunken hover:text-ink-soft'}${
          className ? ` ${className}` : ''
        }`}
      >
        {icon}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={`sindbad-hit-expand inline-flex items-center justify-center rounded-full border border-white/20 backdrop-blur-sm transition-colors duration-150 ${
        size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'
      } ${saved ? 'bg-negative-fill text-negative-ink' : 'bg-scrim/45 text-white hover:bg-scrim/70'}${
        className ? ` ${className}` : ''
      }`}
    >
      {icon}
    </button>
  );
}

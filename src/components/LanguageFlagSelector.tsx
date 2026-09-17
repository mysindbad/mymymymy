import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { SupportedLanguage } from '../data/translations';
import { useLocale } from '../lib/i18n';

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  englishName: string;
}

/** Language names are shown in their own script — no flags, which would tie a
 *  language to a nationality this product does not assume. */
export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'ar', label: 'العربية', englishName: 'Arabic' },
  { code: 'en', label: 'English', englishName: 'English' },
  { code: 'fr', label: 'Français', englishName: 'French' },
];

interface LanguageFlagSelectorProps {
  currentLanguage: SupportedLanguage;
  onSelectLanguage: (lang: SupportedLanguage) => void;
  /** `onDark` sits above photo chrome; `default` is for light surfaces. */
  variant?: 'default' | 'auth' | 'hero' | 'inline' | 'onDark';
  className?: string;
  label?: string;
}

export const LanguageFlagSelector: React.FC<LanguageFlagSelectorProps> = ({
  currentLanguage,
  onSelectLanguage,
  variant = 'default',
  className = '',
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const locale = useLocale(currentLanguage);
  const t = locale.t;
  const onDark = variant === 'auth' || variant === 'hero' || variant === 'onDark';
  const active = LANGUAGE_OPTIONS.find((option) => option.code === currentLanguage) || LANGUAGE_OPTIONS[1];

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const select = (code: SupportedLanguage) => {
    onSelectLanguage(code);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={label || t('Language', 'اللغة', 'Langue')}
        onClick={() => setIsOpen((open) => !open)}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-label font-bold transition-colors pointer-coarse:min-h-11 ${
          onDark
            ? 'border-white/25 bg-scrim/45 text-white hover:bg-scrim/60'
            : 'border-line-strong bg-surface text-ink-soft hover:bg-surface-muted'
        }`}
      >
        <Globe className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
        <span>{active.label}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 opacity-70 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t('App language', 'لغة التطبيق', 'Langue de l’application')}
          className="absolute end-0 z-50 mt-1.5 w-44 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
        >
          {LANGUAGE_OPTIONS.map((option) => {
            const selected = option.code === currentLanguage;
            return (
              <button
                key={option.code}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => select(option.code)}
                className={`flex min-h-11 w-full items-center gap-2 px-3 text-start text-body transition-colors ${
                  selected ? 'bg-brand-soft font-bold text-brand-accent' : 'font-semibold text-ink-soft hover:bg-surface-muted'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {selected
                  ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  : <span className="shrink-0 text-micro text-muted">{option.englishName}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

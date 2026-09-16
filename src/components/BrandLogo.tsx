import React from 'react';
import { SupportedLanguage } from '../data/translations';

const MY_SINDBAD_LOGO_URL = '/brand/my-sindbad-logo-v7.png';

export type BrandLogoVariant = 'illustrated' | 'lockup' | 'mark';
type BrandTone = 'ink' | 'onDark';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSlogan?: boolean;
  language?: SupportedLanguage;
  /**
   * `illustrated` — the user-supplied brand artwork (home hero, auth, onboarding).
   * `lockup` — compact glyph + wordmark for app bars.
   * `mark` — glyph only, for tight chrome.
   */
  variant?: BrandLogoVariant;
  tone?: string;
}

const SLOGAN: Record<SupportedLanguage, string> = {
  en: 'Travel further, knowing more',
  ar: 'سافر أبعد، وتعرف أكثر',
  fr: 'Voyager plus loin, savoir plus',
};

const ILLUSTRATED_SIZE = {
  sm: 'w-28',
  md: 'w-36 sm:w-40',
  lg: 'w-44 sm:w-52 md:w-56',
};

/**
 * The sail glyph used across app chrome. Kept deliberately simple so it stays
 * legible at 16px: one sail, one waterline, one warm accent from the brand sun.
 */
export function SindbadMark({ className = 'h-6 w-6', tone = 'ink' }: { className?: string; tone?: string }) {
  const onDark = tone === 'onDark';
  const hull = onDark ? '#ffffff' : 'var(--color-brand-600)';
  const sail = onDark ? 'rgba(255,255,255,0.92)' : 'var(--color-brand-500)';
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true" focusable="false">
      <path d="M14.6 3.2c3.9 2.7 6.4 6.7 7.2 11.5h-7.2z" fill={sail} />
      <path d="M12.6 6.1c-2.4 2.3-4 5.5-4.4 8.6h4.4z" fill="var(--color-sand-400)" opacity="0.95" />
      <path
        d="M4 18.2c2.2 1.1 4.4 1.1 6.6 0 2.2 1.4 4.8 1.4 7 0 2 1.1 4 1.1 6 0-1 3.1-3.8 5.2-8.4 5.2H11.9C8 23.4 5 21.3 4 18.2z"
        fill={hull}
      />
      <path d="M13.6 2.4v13.3" stroke={hull} strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
  showSlogan = false,
  language = 'en',
  variant = 'illustrated',
  tone = 'ink',
}) => {
  const onDark = tone === 'onDark';
  if (variant === 'mark') {
    return (
      <span className={`inline-flex items-center select-none ${className}`} role="img" aria-label="My Sindbad">
        <SindbadMark className="h-7 w-7" tone={tone} />
      </span>
    );
  }

  if (variant === 'lockup') {
    return (
      <span className={`inline-flex items-center gap-2 select-none ${className}`}>
        <SindbadMark className={size === 'sm' ? 'h-5 w-5' : 'h-7 w-7'} tone={tone} />
        <span
          className={`${size === 'sm' ? 'text-[15px]' : 'text-[17px]'} font-extrabold tracking-tight ${
            tone === 'onDark' ? 'text-white' : 'text-ink'
          }`}
        >
          My Sindbad
        </span>
      </span>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`} aria-label="My Sindbad">
      <img
        src={MY_SINDBAD_LOGO_URL}
        alt="My Sindbad"
        width={256}
        height={256}
        loading="eager"
        decoding="async"
        fetchPriority="high"
        draggable={false}
        className={`${ILLUSTRATED_SIZE[size]} h-auto max-w-full object-contain pointer-events-none`}
      />
      {showSlogan && (
        <p className={`mt-1.5 text-center text-micro font-semibold text-muted ${tone === 'onDark' ? 'text-white/70' : ''}`}>
          {SLOGAN[language] ?? SLOGAN.en}
        </p>
      )}
    </div>
  );
};

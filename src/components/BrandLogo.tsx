import React from 'react';
import { SupportedLanguage } from '../data/translations';

const MY_SINDBAD_LOGO_URL = '/brand/my-sindbad-logo-v7.png';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'icon';
  showSlogan?: boolean;
  language?: SupportedLanguage;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'lg',
  showSlogan = true,
  language = 'en',
}) => {
  const slogan = language === 'ar'
    ? 'رحلتك، أكثر ذكاءً مع الذكاء الاصطناعي'
    : language === 'fr'
      ? 'Votre voyage, plus intelligent avec l’IA'
      : 'Your trip, smarter with AI';

  const imageSize = size === 'icon'
    ? 'h-full w-full'
    : size === 'sm'
      ? 'w-24 sm:w-28'
      : size === 'md'
        ? 'w-32 sm:w-36'
        : 'w-44 sm:w-52 md:w-56';

  return (
    <div
      className={`flex flex-col items-center justify-center select-none ${className}`}
      aria-label="My Sindbad"
    >
      <img
        src={MY_SINDBAD_LOGO_URL}
        alt="My Sindbad"
        loading="eager"
        decoding="async"
        fetchPriority="high"
        draggable={false}
        className={`${imageSize} h-auto max-w-full object-contain pointer-events-none drop-shadow-[0_6px_14px_rgba(30,58,138,0.18)]`}
      />

      {showSlogan && size !== 'icon' && (
        <p className="mt-1 text-center text-xs font-semibold tracking-wide text-slate-600">
          {slogan}
        </p>
      )}
    </div>
  );
};

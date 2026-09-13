import React from 'react';
import mySindbadTransparent from '../assets/images/my_sindbad_logo_transparent.png';
import { SupportedLanguage } from '../data/translations';

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
  const slogan = language === 'ar' ? 'رحلتك، أكثر ذكاءً مع الذكاء الاصطناعي' : language === 'fr' ? 'Votre voyage, plus intelligent avec l’IA' : 'Your trip, smarter with AI';
  const aiTravel = language === 'ar' ? 'سفر ذكي' : language === 'fr' ? 'Voyage IA' : 'AI Travel';
  if (size === 'icon') {
    return (
      <div className={`relative flex items-center justify-center ${className}`}>
        <img
          src={mySindbadTransparent}
          alt="My Sindbad"
          className="w-full h-full object-contain filter drop-shadow-sm"
        />
      </div>
    );
  }

  if (size === 'sm') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-8 h-8 flex items-center justify-center shrink-0">
          <img
            src={mySindbadTransparent}
            alt="My Sindbad"
            className="w-full h-full object-contain filter drop-shadow-sm"
          />
        </div>
        <div>
          <span className="text-sm font-black tracking-tight text-blue-900 block leading-none">
            My Sindbad
          </span>
          <span className="text-[9px] font-bold text-blue-600 uppercase">{aiTravel}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Standalone 3D Official Logo - 100% Transparent without any background box or borders */}
      <div className="relative group transition transform hover:scale-[1.01] flex items-center justify-center">
        <img
          src={mySindbadTransparent}
          alt="My Sindbad"
          className="w-44 sm:w-52 md:w-56 h-auto max-h-40 sm:max-h-48 object-contain filter drop-shadow-[0_6px_14px_rgba(30,58,138,0.16)] pointer-events-none"
        />
      </div>

      {/* Slogan */}
      {showSlogan && (
        <p className="text-xs font-semibold text-slate-600 mt-1 tracking-wide text-center">
          {slogan}
        </p>
      )}
    </div>
  );
};

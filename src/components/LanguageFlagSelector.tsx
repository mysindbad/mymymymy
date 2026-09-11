import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Globe } from 'lucide-react';
import { SupportedLanguage } from '../data/translations';

interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  country: string;
  flagEmoji: string;
  flagSvg: React.ReactNode;
}

// Crisp Vector Flags for pixel-perfect luxury display
const FlagSaudi = () => (
  <svg viewBox="0 0 640 480" className="w-5 h-3.5 rounded-xs shadow-xs object-cover">
    <path fill="#006c35" d="M0 0h640v480H0z" />
    <path
      fill="#fff"
      d="M320 220c-45 0-90-5-130-15v-10c40 10 85 15 130 15s90-5 130-15v10c-40 10-85 15-130 15zm-150 50h300v12H170zm300 20H170v-8h300z"
    />
    <path
      d="M170 290l40-10v8l-40 2zm300 0l-40-10v8l40 2z"
      fill="#fff"
    />
  </svg>
);

const FlagUK = () => (
  <svg viewBox="0 0 640 480" className="w-5 h-3.5 rounded-xs shadow-xs object-cover">
    <path fill="#012169" d="M0 0h640v480H0z" />
    <path
      fill="#FFF"
      d="m75 0 245 180L565 0h75v60L435 240l205 180v60h-75L320 300 75 480H0v-60l205-180L0 60V0h75z"
    />
    <path
      fill="#C8102E"
      d="m424 288 216 156v36L392 288h32zM640 36 392 216h32L640 60V36zM0 444l248-180h-32L0 420v24zM0 36l248 180h-32L0 12V36z"
    />
    <path fill="#FFF" d="M240 0h160v480H240zM0 160h640v160H0z" />
    <path fill="#C8102E" d="M266 0h108v480H266zM0 186h640v108H0z" />
  </svg>
);

const FlagFrance = () => (
  <svg viewBox="0 0 640 480" className="w-5 h-3.5 rounded-xs shadow-xs object-cover">
    <path fill="#fff" d="M0 0h640v480H0z" />
    <path fill="#002654" d="M0 0h213.3v480H0z" />
    <path fill="#ce1126" d="M426.7 0H640v480H426.7z" />
  </svg>
);

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    country: 'المملكة العربية السعودية • الشرق الأوسط',
    flagEmoji: '🇸🇦',
    flagSvg: <FlagSaudi />,
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    country: 'Global • International',
    flagEmoji: '🇬🇧',
    flagSvg: <FlagUK />,
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    country: 'France • Europe',
    flagEmoji: '🇫🇷',
    flagSvg: <FlagFrance />,
  },
];

interface LanguageFlagSelectorProps {
  currentLanguage: SupportedLanguage;
  onSelectLanguage: (lang: SupportedLanguage) => void;
  variant?: 'header' | 'auth' | 'inline' | 'hero';
  className?: string;
}

export const LanguageFlagSelector: React.FC<LanguageFlagSelectorProps> = ({
  currentLanguage,
  onSelectLanguage,
  variant = 'header',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeOption =
    LANGUAGE_OPTIONS.find((opt) => opt.code === currentLanguage) || LANGUAGE_OPTIONS[0];

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code: SupportedLanguage) => {
    onSelectLanguage(code);
    setIsOpen(false);
  };

  // Auth / Welcome variant: Highly visible on top of dark/photo background
  const isAuthOrHero = variant === 'auth' || variant === 'hero';

  return (
    <div className={`relative inline-block text-left z-50 ${className}`} ref={dropdownRef}>
      {/* Trigger Button with Country Flag */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition active:scale-95 shadow-sm border ${
          isAuthOrHero
            ? 'bg-slate-900/80 hover:bg-slate-900 text-white border-white/20 backdrop-blur-md'
            : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 backdrop-blur-md'
        }`}
        title="تغيير لغة التطبيق / Change App Language"
        aria-label="Change Language"
      >
        <span className="flex items-center justify-center shrink-0">
          {activeOption.flagSvg}
        </span>
        <span className="text-xs font-bold tracking-tight">
          {activeOption.nativeName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          } ${isAuthOrHero ? 'text-slate-300' : 'text-slate-400'}`}
        />
      </button>

      {/* Dropdown Menu with Flags and Country Names */}
      {isOpen && (
        <div
          className="absolute end-0 mt-2 w-64 rounded-2xl bg-white shadow-2xl border border-slate-200/90 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 z-50 text-slate-800"
          dir={currentLanguage === 'ar' ? 'rtl' : 'ltr'}
        >
          <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>{currentLanguage === 'ar' ? 'اختر لغة التطبيق' : 'Select Language'}</span>
            </span>
            <span className="text-[10px] text-blue-600 font-semibold lowercase">
              {currentLanguage === 'ar' ? 'أعلام الدول' : 'National flags'}
            </span>
          </div>

          <div className="py-1">
            {LANGUAGE_OPTIONS.map((opt) => {
              const isSelected = opt.code === currentLanguage;
              return (
                <button
                  key={opt.code}
                  onClick={() => handleSelect(opt.code)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-start transition ${
                    isSelected
                      ? 'bg-blue-50/80 text-blue-700 font-bold'
                      : 'hover:bg-slate-50 text-slate-700 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-5 rounded-xs overflow-hidden shadow-xs shrink-0 flex items-center justify-center border border-slate-200/60">
                      {opt.flagSvg}
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                        <span>{opt.nativeName}</span>
                        {opt.code !== 'ar' && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({opt.name})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        {opt.country}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

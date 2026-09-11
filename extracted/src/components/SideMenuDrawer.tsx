import React from 'react';
import {
  X,
  MapPin,
  Compass,
  Radio,
  Building2,
  Calendar,
  Sparkles,
  ShieldCheck,
  Globe2,
  Heart,
  ChevronRight,
  Info
} from 'lucide-react';
import { SupportedLanguage } from '../data/translations';
import { MascotSindbad } from './MascotSindbad';
import { LanguageFlagSelector } from './LanguageFlagSelector';

interface SideMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: 'home' | 'explore' | 'map' | 'trips' | 'community') => void;
  onOpenAddPlace: () => void;
  onOpenPassiveGps: () => void;
  onOpenAIChat: () => void;
  onOpenAuth?: (screen?: any) => void;
  userXp: number;
  language: SupportedLanguage;
  onToggleLanguage: (lang: SupportedLanguage) => void;
}

export const SideMenuDrawer: React.FC<SideMenuDrawerProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenAddPlace,
  onOpenPassiveGps,
  onOpenAIChat,
  onOpenAuth,
  userXp,
  language,
  onToggleLanguage,
}) => {
  if (!isOpen) return null;
  const isAr = language === 'ar';

  return (
    <div className="fixed inset-0 z-50 flex animate-in fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-80 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-300">
        {/* Header with Mascot */}
        <div className="p-5 bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MascotSindbad size="md" mood="happy" showBadge={true} />
            <div>
              <h2 className="font-black text-lg tracking-tight">My Sindbad</h2>
              <p className="text-xs text-blue-100">
                {isAr ? 'رحلتك أذكى مع الذكاء الاصطناعي' : 'Your trip, smarter with AI'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-xs">
                🧔
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">
                  {isAr ? 'مرحباً، أيها المسافر!' : 'Hello, Traveler!'}
                </div>
                <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Level 2 • {userXp} XP</span>
                </div>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Explorer
            </span>
          </div>

          {onOpenAuth && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenAuth('welcome');
                }}
                className="flex-1 py-1.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-xs shadow-xs text-center hover:from-blue-700 hover:to-sky-600 transition"
              >
                {isAr ? 'تسجيل الدخول / الحساب' : 'Sign In / Account'}
              </button>
            </div>
          )}
        </div>

        {/* Navigation Menu Links */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 text-sm text-slate-700">
          <button
            onClick={() => {
              onNavigateTab('home');
              onClose();
            }}
            className="w-full p-3 rounded-2xl hover:bg-blue-50 hover:text-blue-600 flex items-center justify-between transition text-left rtl:text-right"
          >
            <span className="font-semibold">{isAr ? 'الرئيسية' : 'Home'}</span>
            <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />
          </button>

          <button
            onClick={() => {
              onNavigateTab('map');
              onClose();
            }}
            className="w-full p-3 rounded-2xl hover:bg-blue-50 hover:text-blue-600 flex items-center justify-between transition text-left rtl:text-right"
          >
            <span className="font-semibold">{isAr ? 'الخريطة التفاعلية الحية' : 'Interactive Live Map'}</span>
            <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />
          </button>

          <button
            onClick={() => {
              onNavigateTab('explore');
              onClose();
            }}
            className="w-full p-3 rounded-2xl hover:bg-blue-50 hover:text-blue-600 flex items-center justify-between transition text-left rtl:text-right"
          >
            <span className="font-semibold">{isAr ? 'استكشاف الأماكن والذاكرة' : 'Explore & AI Memory'}</span>
            <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />
          </button>

          <button
            onClick={() => {
              onNavigateTab('trips');
              onClose();
            }}
            className="w-full p-3 rounded-2xl hover:bg-blue-50 hover:text-blue-600 flex items-center justify-between transition text-left rtl:text-right"
          >
            <span className="font-semibold">{isAr ? 'مخطط الرحلات والأماكن المحفوظة' : 'Trips & Offline Saved'}</span>
            <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />
          </button>

          <button
            onClick={() => {
              onNavigateTab('community');
              onClose();
            }}
            className="w-full p-3 rounded-2xl hover:bg-blue-50 hover:text-blue-600 flex items-center justify-between transition text-left rtl:text-right"
          >
            <span className="font-semibold">{isAr ? 'بوابة المجتمع وأصحاب الأعمال' : 'Community & Business Hub'}</span>
            <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />
          </button>

          <div className="pt-2 border-t border-slate-100 my-2" />

          {/* Quick Actions */}
          <button
            onClick={() => {
              onOpenAddPlace();
              onClose();
            }}
            className="w-full p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 flex items-center gap-2.5 text-slate-800 transition"
          >
            <Building2 className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold">{isAr ? '+ إضافة نشاط تجاري / مكان' : '+ Add Business / Place'}</span>
          </button>

          <button
            onClick={() => {
              onOpenPassiveGps();
              onClose();
            }}
            className="w-full p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 flex items-center gap-2.5 text-emerald-800 transition"
          >
            <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span className="text-xs font-bold">{isAr ? 'مشاركة الموقع المجهول' : 'Passive GPS Sharing'}</span>
          </button>
        </div>

        {/* Language selector footer with national flags */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
            <Globe2 className="w-4 h-4 text-slate-600" />
            <span>{isAr ? 'اللغة' : 'Language'}</span>
          </div>
          <LanguageFlagSelector
            currentLanguage={language}
            onSelectLanguage={onToggleLanguage}
            variant="compact"
          />
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import {
  Building2,
  CalendarDays,
  Compass,
  Download,
  Home,
  LogOut,
  Map,
  Radio,
  Users,
  X,
} from 'lucide-react';
import { SupportedLanguage } from '../data/translations';
import { AuthStatus, AuthUser } from '../lib/authSession';
import { UserAvatar } from './UserAvatar';

interface SideMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: 'home' | 'explore' | 'map' | 'trips' | 'community') => void;
  onOpenAddPlace: () => void;
  onOpenPassiveGps: () => void;
  onOpenAIChat: () => void;
  onOpenAuth?: (screen?: any) => void;
  onSignOut?: () => void;
  authStatus?: AuthStatus;
  authUser?: AuthUser | null;
  userXp: number;
  language: SupportedLanguage;
  canInstall?: boolean;
  onInstall?: () => void;
  showIosInstallHint?: boolean;
  onDismissIosInstallHint?: () => void;
}

export const SideMenuDrawer: React.FC<SideMenuDrawerProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenAddPlace,
  onOpenPassiveGps,
  onOpenAuth,
  onSignOut,
  authStatus = 'anonymous',
  authUser = null,
  userXp,
  language,
  canInstall = false,
  onInstall,
  showIosInstallHint = false,
  onDismissIosInstallHint,
}) => {
  if (!isOpen) return null;
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const localize = (english: string, arabic: string, french: string) => isAr ? arabic : isFr ? french : english;
  const userLevel = Math.max(1, Math.floor(userXp / 200) + 1);
  const navItems = [
    { key: 'home' as const, label: localize('Home', 'الرئيسية', 'Accueil'), icon: <Home className="h-5 w-5" /> },
    { key: 'map' as const, label: localize('Map', 'الخريطة', 'Carte'), icon: <Map className="h-5 w-5" /> },
    { key: 'explore' as const, label: localize('Explore', 'استكشاف', 'Explorer'), icon: <Compass className="h-5 w-5" /> },
    { key: 'trips' as const, label: localize('My trips', 'رحلاتي', 'Mes voyages'), icon: <CalendarDays className="h-5 w-5" /> },
    { key: 'community' as const, label: localize('Community', 'المجتمع', 'Communauté'), icon: <Users className="h-5 w-5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex animate-in fade-in" dir={isAr ? 'rtl' : 'ltr'}>
      <button type="button" aria-label={localize('Close menu', 'إغلاق القائمة', 'Fermer le menu')} className="fixed inset-0 cursor-default bg-black/45 backdrop-blur-xs" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-[292px] max-w-[86vw] flex-col bg-white shadow-2xl animate-in slide-in-from-left duration-300 rtl:slide-in-from-right">
        <div className="flex items-center justify-between bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-600 p-4 text-white">
          <div className="min-w-0">
            <h2 className="truncate text-base font-black tracking-tight">My Sindbad</h2>
            <p className="mt-0.5 truncate text-[11px] text-blue-100">{localize('Your travel guide', 'دليلك للسفر', 'Votre guide de voyage')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={localize('Close menu', 'إغلاق القائمة', 'Fermer le menu')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white transition hover:bg-white/30">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-slate-50 p-3">
          <div className="flex items-center gap-2.5">
            <UserAvatar name={authUser?.name} avatarUrl={authUser?.avatarUrl} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold text-slate-800">
                {authStatus === 'authed' && authUser?.name ? authUser.name : localize('Hello, traveler', 'مرحباً، أيها المسافر', 'Bonjour, voyageur')}
              </div>
              <div className="truncate text-[11px] text-slate-500">
                {authStatus === 'authed' && authUser?.email ? authUser.email : localize('Level ' + userLevel + ' · ' + userXp + ' XP', 'المستوى ' + userLevel + ' · ' + userXp + ' نقطة', 'Niveau ' + userLevel + ' · ' + userXp + ' XP')}
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-blue-100 px-2 py-1 text-[10px] font-black text-blue-800">{localize('Explorer', 'مستكشف', 'Explorateur')}</span>
            {authStatus === 'authed' && onSignOut && (
              <button type="button" onClick={onSignOut} aria-label={localize('Sign out', 'تسجيل الخروج', 'Déconnexion')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-rose-50 hover:text-rose-600">
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
          {authStatus !== 'authed' && onOpenAuth && (
            <button type="button" onClick={() => { onClose(); onOpenAuth('welcome'); }} className="mt-3 h-9 w-full rounded-xl bg-blue-600 text-xs font-bold text-white transition hover:bg-blue-700">
              {localize('Sign in', 'تسجيل الدخول', 'Se connecter')}
            </button>
          )}
        </div>

        <nav className="flex-1 px-3 py-3">
          <div className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => { onNavigateTab(item.key); onClose(); }}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
              >
                <span className="text-slate-500">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => { onOpenAddPlace(); onClose(); }} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-50 px-3 text-[11px] font-bold text-blue-700 transition hover:bg-blue-100">
              <Building2 className="h-4 w-4" />
              {localize('Add place', 'إضافة مكان', 'Ajouter un lieu')}
            </button>
            <button type="button" onClick={() => { onOpenPassiveGps(); onClose(); }} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100">
              <Radio className="h-4 w-4" />
              {localize('Optional GPS', 'GPS اختياري', 'GPS facultatif')}
            </button>
            {canInstall && onInstall && (
              <button type="button" onClick={onInstall} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-[11px] font-bold text-slate-700 transition hover:bg-slate-200">
                <Download className="h-4 w-4" />
                {localize('Install', 'تثبيت', 'Installer')}
              </button>
            )}
          </div>
          {showIosInstallHint && onDismissIosInstallHint && (
            <div className="mt-3 rounded-xl bg-blue-50 p-2.5 text-[11px] text-blue-800">
              <div className="flex items-start gap-2">
                <span className="flex-1">{localize('In Safari: Share, then Add to Home Screen', 'في Safari: مشاركة ثم إضافة إلى الشاشة الرئيسية', 'Dans Safari : Partager, puis Ajouter à l’écran d’accueil')}</span>
                <button type="button" onClick={onDismissIosInstallHint} aria-label={localize('Dismiss', 'إغلاق', 'Fermer')} className="shrink-0">×</button>
              </div>
            </div>
          )}
        </nav>
      </aside>
    </div>
  );
};

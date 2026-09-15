import React from 'react';
import {
  Building2,
  CalendarDays,
  Compass,
  Download,
  Home,
  Map,
  Radio,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { SupportedLanguage } from '../data/translations';
import { AuthStatus, AuthUser } from '../lib/authSession';
import { BrandLogo } from './BrandLogo';
import { UserAvatar } from './UserAvatar';

interface SideMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: 'home' | 'explore' | 'map' | 'trips' | 'community') => void;
  onOpenAccount: () => void;
  onOpenAddPlace: () => void;
  onOpenPassiveGps: () => void;
  onOpenAuth?: (screen?: any) => void;
  authStatus?: AuthStatus;
  authUser?: AuthUser | null;
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
  onOpenAccount,
  onOpenAddPlace,
  onOpenPassiveGps,
  onOpenAuth,
  authStatus = 'anonymous',
  authUser = null,
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
  const navItems = [
    { key: 'explore' as const, label: localize('Explore', 'استكشاف', 'Explorer'), icon: <Compass className="h-4 w-4" /> },
    { key: 'map' as const, label: localize('Map', 'الخريطة', 'Carte'), icon: <Map className="h-4 w-4" /> },
    { key: 'trips' as const, label: localize('My trips', 'رحلاتي', 'Mes voyages'), icon: <CalendarDays className="h-4 w-4" /> },
    { key: 'community' as const, label: localize('Community', 'المجتمع', 'Communauté'), icon: <Users className="h-4 w-4" /> },
  ];

  return (
    <div className={`fixed inset-0 z-50 flex ${isAr ? 'justify-end' : 'justify-start'}`} dir={isAr ? 'rtl' : 'ltr'}>
      <button type="button" aria-label={localize('Close menu', 'إغلاق القائمة', 'Fermer le menu')} className="fixed inset-0 bg-black/45 backdrop-blur-[1px]" onClick={onClose} />
      <aside className={`relative z-10 flex h-full w-[256px] max-w-[78vw] flex-col bg-white shadow-2xl animate-in duration-200 ${isAr ? 'slide-in-from-right' : 'slide-in-from-left'}`}>
        <header className="flex items-center justify-between bg-gradient-to-br from-blue-600 to-indigo-700 px-3 py-3 text-white">
          <div className="flex min-w-0 items-center gap-2">
            <BrandLogo size="icon" showSlogan={false} language={language} className="h-10 w-10 shrink-0" />
            <strong className="truncate text-sm">My Sindbad</strong>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15" aria-label={localize('Close menu', 'إغلاق القائمة', 'Fermer le menu')}><X className="h-4 w-4" /></button>
        </header>

        <button
          type="button"
          onClick={() => {
            onClose();
            if (authStatus === 'authed') onOpenAccount();
            else onOpenAuth?.('welcome');
          }}
          className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50 px-3 py-3 text-start hover:bg-slate-100"
        >
          <UserAvatar name={authUser?.name} avatarUrl={authUser?.avatarUrl} className="h-10 w-10 shrink-0" />
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-xs text-slate-900">{authStatus === 'authed' && authUser?.name ? authUser.name : localize('Sign in', 'تسجيل الدخول', 'Se connecter')}</strong>
            <small className="block truncate text-[10px] text-slate-500">{authStatus === 'authed' ? localize('Account settings', 'إعدادات الحساب', 'Paramètres du compte') : localize('Open your account', 'افتح حسابك', 'Ouvrir votre compte')}</small>
          </span>
          <Settings className="h-4 w-4 shrink-0 text-slate-400" />
        </button>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          <div className="space-y-1">
            {navItems.map((item) => (
              <button key={item.key} type="button" onClick={() => { onNavigateTab(item.key); onClose(); }} className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-start text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                <span className="text-slate-500">{item.icon}</span><span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="my-3 border-t border-slate-100" />
          <div className="space-y-1">
            <button type="button" onClick={() => { onOpenAddPlace(); onClose(); }} className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-start text-xs font-bold text-slate-700 hover:bg-slate-50"><Building2 className="h-4 w-4 text-blue-600" />{localize('Add place', 'إضافة مكان', 'Ajouter un lieu')}</button>
            <button type="button" onClick={() => { onOpenPassiveGps(); onClose(); }} className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-start text-xs font-bold text-slate-700 hover:bg-slate-50"><Radio className="h-4 w-4 text-emerald-600" />{localize('Location sharing', 'مشاركة الموقع', 'Partage de localisation')}</button>
            {canInstall && onInstall && <button type="button" onClick={() => { onInstall(); onClose(); }} className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-start text-xs font-bold text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" />{localize('Install app', 'تثبيت التطبيق', 'Installer l’application')}</button>}
          </div>
          {showIosInstallHint && onDismissIosInstallHint && <div className="mt-3 rounded-xl bg-blue-50 p-2.5 text-[10px] text-blue-800"><div className="flex items-start gap-2"><span className="flex-1">{localize('Safari: Share → Add to Home Screen', 'Safari: مشاركة ← إضافة إلى الشاشة الرئيسية', 'Safari : Partager → Ajouter à l’écran d’accueil')}</span><button type="button" onClick={onDismissIosInstallHint} aria-label={localize('Dismiss', 'إغلاق', 'Fermer')}>×</button></div></div>}
        </nav>

        <footer className="border-t border-slate-200 bg-white p-2.5">
          <button type="button" onClick={() => { onNavigateTab('home'); onClose(); }} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-black text-white shadow-sm hover:bg-blue-700">
            <Home className="h-4 w-4" />{localize('Home', 'الرئيسية', 'Accueil')}
          </button>
        </footer>
      </aside>
    </div>
  );
};

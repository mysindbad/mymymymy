import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Building2,
  CalendarDays,
  Compass,
  Download,
  Home,
  Map,
  Radio,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import { SupportedLanguage } from '../data/translations';
import { AuthStatus, AuthUser } from '../lib/authSession';
import { SindbadMark } from './BrandLogo';
import { UserAvatar } from './UserAvatar';
import { useLocale } from '../lib/i18n';

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
  const locale = useLocale(language);
  const localize = locale.t;
  const isSignedIn = authStatus === 'authed';

  const navItems = [
    { key: 'explore' as const, label: localize('Explore', 'استكشاف', 'Explorer'), icon: Compass },
    { key: 'map' as const, label: localize('Map', 'الخريطة', 'Carte'), icon: Map },
    { key: 'trips' as const, label: localize('My trips', 'رحلاتي', 'Mes voyages'), icon: CalendarDays },
    { key: 'community' as const, label: localize('Community', 'المجتمع', 'Communauté'), icon: Users },
  ];

  const actions = [
    { label: localize('Add place', 'إضافة مكان', 'Ajouter un lieu'), icon: Building2, onClick: onOpenAddPlace },
    { label: localize('Location sharing', 'مشاركة الموقع', 'Partage de localisation'), icon: Radio, onClick: onOpenPassiveGps },
    ...(canInstall && onInstall ? [{ label: localize('Install app', 'تثبيت التطبيق', 'Installer l’application'), icon: Download, onClick: onInstall }] : []),
  ];

  const go = (action: () => void) => {
    action();
    onClose();
  };

  if (typeof document === 'undefined') return null;

  // The portal must stay outside AnimatePresence: framer-motion clones its
  // direct children, and cloning a portal drops its content.
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="side-menu-drawer"
          className={`fixed inset-0 z-[60] flex ${locale.isArabic ? 'justify-end' : 'justify-start'}`}
          role="dialog"
          aria-modal="true"
          aria-label={localize('Menu', 'القائمة', 'Menu')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            role="presentation"
            aria-hidden="true"
            className="fixed inset-0 bg-scrim/50 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: locale.isArabic ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: locale.isArabic ? '100%' : '-100%' }}
            transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
            className="relative z-10 flex h-full w-[256px] max-w-[78vw] flex-col border-e border-line bg-surface shadow-lg"

          >
            <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-3">
              <span className="flex min-w-0 items-center gap-2">
                <SindbadMark className="h-6 w-6 shrink-0" />
                <strong className="truncate text-body font-extrabold tracking-tight text-ink">My Sindbad</strong>
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label={localize('Close menu', 'إغلاق القائمة', 'Fermer le menu')}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-ink pointer-coarse:h-11 pointer-coarse:w-11"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <button
              type="button"
              onClick={() => go(() => (isSignedIn ? onOpenAccount() : onOpenAuth?.('welcome')))}
              className="flex items-center gap-2.5 border-b border-line px-3 py-3 text-start transition-colors hover:bg-surface-muted"
            >
              <UserAvatar name={authUser?.name} avatarUrl={authUser?.avatarUrl} className="h-9 w-9 shrink-0" />
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-caption font-bold text-ink">
                  {isSignedIn && authUser?.name ? authUser.name : localize('Sign in', 'تسجيل الدخول', 'Se connecter')}
                </strong>
                <small className="block truncate text-micro text-muted">
                  {isSignedIn ? localize('Account settings', 'إعدادات الحساب', 'Paramètres du compte') : localize('Open your account', 'افتح حسابك', 'Ouvrir votre compte')}
                </small>
              </span>
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            </button>

            <nav className="flex-1 overflow-y-auto px-2.5 py-3">
              <ul className="space-y-0.5">
                {navItems.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => go(() => onNavigateTab(item.key))}
                      className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-start text-body font-semibold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
                    >
                      <item.icon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="my-3 h-px bg-line" />

              <ul className="space-y-0.5">
                {actions.map((action) => (
                  <li key={action.label}>
                    <button
                      type="button"
                      onClick={() => go(action.onClick)}
                      className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-start text-body font-semibold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
                    >
                      <action.icon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                      <span className="truncate">{action.label}</span>
                    </button>
                  </li>
                ))}
              </ul>

              {showIosInstallHint && onDismissIosInstallHint && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-brand-line bg-brand-soft px-2.5 py-2">
                  <p className="min-w-0 flex-1 text-micro leading-snug text-brand-accent">
                    {localize('Safari: Share → Add to Home Screen', 'Safari: مشاركة ← إضافة إلى الشاشة الرئيسية', 'Safari : Partager → Ajouter à l’écran d’accueil')}
                  </p>
                  <button
                    type="button"
                    onClick={onDismissIosInstallHint}
                    aria-label={localize('Dismiss', 'إغلاق', 'Fermer')}
                    className="-me-0.5 -mt-0.5 shrink-0 rounded p-1 text-brand-accent hover:bg-surface"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              )}
            </nav>

            <footer className="border-t border-line p-2.5">
              <button
                type="button"
                onClick={() => go(() => onNavigateTab('home'))}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-fill px-3 text-body font-bold text-on-brand transition-colors hover:bg-brand-500"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                {localize('Home', 'الرئيسية', 'Accueil')}
              </button>
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

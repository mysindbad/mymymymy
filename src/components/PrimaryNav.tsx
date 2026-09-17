import React from 'react';
import { Bot, CalendarDays, Compass, Home as HomeIcon, UserRound, Users } from 'lucide-react';
import { SindbadMark } from './BrandLogo';
import { IconButton } from '../ui/Button';
import { UserAvatar } from './UserAvatar';
import { useLocale } from '../lib/i18n';

export type PrimaryNavTab = 'home' | 'explore' | 'map' | 'trips' | 'community' | 'account' | 'assistant';

export interface PrimaryNavProps {
  activeTab: PrimaryNavTab;
  language?: string;
  onSelectTab: (tab: PrimaryNavTab) => void;
  onOpenMenu: () => void;
  authUser?: { name: string; avatarUrl: string } | null;
  isSignedIn?: boolean;
  onOpenAuth?: () => void;
}

/**
 * One navigation surface for every viewport: thumb-reachable tabs pinned to the
 * bottom on phones, the same tabs as a top bar on wide screens. Single source of
 * truth for tab ids, labels and active state — nothing is duplicated in the DOM.
 */
export function PrimaryNav({ activeTab, language = 'en', onSelectTab, onOpenMenu, authUser, isSignedIn, onOpenAuth }: PrimaryNavProps) {
  const locale = useLocale(language);
  const t = locale.t;

  return (
    <nav
      aria-label={t('Primary navigation', 'التنقل الرئيسي', 'Navigation principale')}
      className="sindbad-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-sm lg:sticky lg:top-0 lg:bottom-auto lg:h-14 lg:border-t-0 lg:border-b lg:bg-surface/92 lg:backdrop-blur-md"
    >
      <div className="mx-auto flex w-full max-w-[1400px] items-stretch gap-1 px-1.5 lg:h-full lg:gap-2 lg:px-4">
        <span className="hidden shrink-0 items-center gap-2 pe-2 lg:flex">
          <SindbadMark className="h-6 w-6" />
          <span className="text-[15px] font-extrabold tracking-tight text-ink">My Sindbad</span>
        </span>

        <ul className="flex min-w-0 flex-1 items-stretch lg:items-center lg:gap-0.5">
          <TabShell id="tab-home" active={activeTab === 'home'} label={t('Home', 'الرئيسية', 'Accueil')} onSelectTab={onSelectTab} tab="home" icon={<HomeIcon className="h-5 w-5" strokeWidth={2.1} />} />
          <TabShell id="tab-explore" active={activeTab === 'explore'} label={t('Explore', 'استكشف', 'Explorer')} onSelectTab={onSelectTab} tab="explore" icon={<Compass className="h-5 w-5" strokeWidth={2.1} />} />
          <li className="flex min-w-0 flex-1 justify-center lg:flex-none">
            <button
              id="tab-ai-assistant"
              type="button"
              onClick={() => onSelectTab('assistant')}
              aria-current={activeTab === 'assistant' ? 'page' : undefined}
              className={`relative flex w-full flex-col items-center gap-1 rounded-lg pb-1.5 pt-0 lg:h-10 lg:w-auto lg:flex-row lg:gap-2 lg:px-3 lg:py-0 ${
                activeTab === 'assistant' ? 'font-bold text-blue-600 lg:bg-brand-soft' : 'font-medium text-muted hover:text-ink-soft'
              }`}
            >
              <span className="-mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-brand-fill text-on-brand shadow-float ring-4 ring-canvas transition-transform duration-150 active:scale-95 lg:hidden">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </span>
              <Bot className="hidden h-[18px] w-[18px] lg:block" aria-hidden="true" />
              <span className="text-[11px] leading-none lg:text-body lg:font-bold">{t('Sindbad', 'سندباد', 'Sindbad')}</span>
            </button>
          </li>
          <TabShell id="tab-trips" active={activeTab === 'trips'} label={t('Trips', 'رحلاتي', 'Voyages')} onSelectTab={onSelectTab} tab="trips" icon={<CalendarDays className="h-5 w-5" strokeWidth={2.1} />} />
          <TabShell id="tab-profile" active={activeTab === 'account'} label={t('Profile', 'حسابي', 'Compte')} onSelectTab={onSelectTab} tab="account" icon={<UserRound className="h-5 w-5" strokeWidth={2.1} />} />
          <li className="hidden lg:flex lg:flex-none lg:items-center">
            <button
              id="tab-community"
              type="button"
              onClick={() => onSelectTab('community')}
              aria-current={activeTab === 'community' ? 'page' : undefined}
              className={`flex h-10 items-center gap-2 rounded-lg px-3 text-body transition-colors duration-150 ${
                activeTab === 'community' ? 'bg-brand-soft font-bold text-blue-600' : 'font-semibold text-muted hover:bg-surface-muted hover:text-ink'
              }`}
            >
              <Users className="h-[18px] w-[18px]" aria-hidden="true" />
              {t('Community', 'المجتمع', 'Communauté')}
            </button>
          </li>
        </ul>

        <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
          <button
            type="button"
            onClick={() => (isSignedIn ? onSelectTab('account') : onOpenAuth?.())}
            className="flex h-10 items-center gap-2 rounded-full border border-line px-2.5 text-label font-bold text-ink transition-colors hover:bg-surface-muted"
          >
            <UserAvatar name={authUser?.name} avatarUrl={authUser?.avatarUrl} className="h-6 w-6" textClassName="text-micro" />
            <span className="max-w-28 truncate">
              {isSignedIn && authUser?.name ? authUser.name.split(' ')[0] : t('Account', 'الحساب', 'Compte')}
            </span>
          </button>
          <IconButton label={t('More', 'المزيد', 'Plus')} size="sm" variant="ghost" onClick={onOpenMenu}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h10" />
            </svg>
          </IconButton>
        </div>
      </div>
    </nav>
  );
}

const TabShell: React.FC<{
  id: string;
  tab: PrimaryNavTab;
  label: string;
  active: boolean;
  icon: React.ReactNode;
  onSelectTab: (tab: PrimaryNavTab) => void;
}> = ({ id, tab, label, active, icon, onSelectTab }) => (
  <li className="flex min-w-0 flex-1 lg:flex-none lg:items-center">
    <button
      id={id}
      type="button"
      onClick={() => onSelectTab(tab)}
      aria-current={active ? 'page' : undefined}
      className={`relative flex w-full flex-col items-center gap-1 rounded-lg px-1 pb-1.5 pt-1 transition-colors duration-150 lg:h-10 lg:w-auto lg:flex-row lg:gap-2 lg:px-3 lg:py-0 ${
        active ? 'font-bold text-blue-600 lg:bg-brand-soft' : 'font-medium text-muted hover:text-ink-soft'
      }`}
    >
      <span className={active ? '' : 'text-muted'} aria-hidden="true">
        {icon}
      </span>
      <span className="max-w-full truncate text-[11px] leading-none lg:text-body lg:font-bold">{label}</span>
    </button>
  </li>
);

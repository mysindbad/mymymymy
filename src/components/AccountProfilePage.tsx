import React, { useState } from 'react';
import { Clock3, Download, LogOut, MapPin, Monitor, Moon, Navigation, Radio, Sun } from 'lucide-react';
import { SupportedLanguage } from '../data/translations';
import type { GeolocationPermission, UserLocation } from '../hooks/useGeolocation';
import type { AuthStatus, AuthUser } from '../lib/authSession';
import { getThemePreference, setThemePreference, type ThemePreference } from '../lib/dayNightTheme';
import { UserAvatar } from './UserAvatar';
import { useLocale } from '../lib/i18n';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Alert, ErrorState, LoadingRow } from '../ui/Feedback';
import { Button } from '../ui/Button';
import { Divider, SectionHeading } from '../ui/Panel';
import { OptionCard } from '../ui/Field';
import { toast } from '../ui/toast';

interface AccountProfilePageProps {
  language: SupportedLanguage;
  onLanguageChange: (language: SupportedLanguage) => void;
  authStatus: AuthStatus;
  authUser: AuthUser | null;
  userLocation: UserLocation | null;
  locationPermission: GeolocationPermission;
  onRequestLocation: () => Promise<UserLocation | null>;
  isPassiveOptedIn: boolean;
  onOpenPassiveGps: () => void;
  savedPlacesCount: number;
  canInstall: boolean;
  onInstall: () => void;
  onOpenAuth: () => void;
  onSignOut: () => Promise<void>;
  onBack: () => void;
  onOpenSaved?: () => void;
}

export const AccountProfilePage: React.FC<AccountProfilePageProps> = ({
  language,
  onLanguageChange,
  authStatus,
  authUser,
  userLocation,
  locationPermission,
  onRequestLocation,
  isPassiveOptedIn,
  onOpenPassiveGps,
  savedPlacesCount,
  canInstall,
  onInstall,
  onOpenAuth,
  onSignOut,
  onBack,
  onOpenSaved,
}) => {
  const locale = useLocale(language);
  const t = locale.t;
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [appearance, setAppearance] = useState<ThemePreference>(() => getThemePreference());
  const authed = authStatus === 'authed' && Boolean(authUser);

  const requestLocation = async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const position = await onRequestLocation();
      if (!position) {
        setLocationError(t(
          'The browser did not grant access. Allow location for this site, then try again.',
          'لم يمنح المتصفح الوصول. اسمح بالوصول إلى الموقع لهذا الموقع ثم أعد المحاولة.',
          'Le navigateur n’a pas autorisé l’accès. Autorisez la position pour ce site, puis réessayez.',
        ));
      }
    } finally {
      setLocating(false);
    }
  };

  const confirmSignOutAction = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
      setConfirmSignOut(false);
      toast(t('Signed out.', 'تم تسجيل الخروج.', 'Déconnecté.'), { tone: 'success' });
    } catch {
      toast(t('Could not sign out. Try again.', 'تعذر تسجيل الخروج. أعد المحاولة.', 'Déconnexion impossible. Réessayez.'), { tone: 'error' });
    } finally {
      setSigningOut(false);
    }
  };

  const chooseAppearance = (value: ThemePreference) => {
    setAppearance(value);
    setThemePreference(value);
  };

  const locationLabel = userLocation
    ? t('Location available', 'الموقع متاح', 'Localisation disponible')
    : locationPermission === 'denied'
      ? t('Location blocked by the browser', 'المتصفح منع الوصول إلى الموقع', 'Position bloquée par le navigateur')
      : locationPermission === 'unsupported'
        ? t('This browser has no location support', 'هذا المتصفح لا يدعم تحديد الموقع', 'Ce navigateur ne gère pas la position')
        : t('Location not shared yet', 'لم تتم مشاركة الموقع بعد', 'Position non partagée');

  const appearanceOptions: Array<{ value: ThemePreference; icon: React.ReactNode; label: string; detail: string }> = [
    { value: 'auto', icon: <Clock3 className="h-4 w-4" />, label: t('Automatic', 'تلقائي', 'Automatique'), detail: t('Day and night schedule', 'حسب النهار والليل', 'Selon le jour et la nuit') },
    { value: 'system', icon: <Monitor className="h-4 w-4" />, label: t('Device', 'الجهاز', 'Appareil'), detail: t('Follow the device theme', 'يتبع مظهر الجهاز', 'Suit le thème de l’appareil') },
    { value: 'light', icon: <Sun className="h-4 w-4" />, label: t('Light', 'فاتح', 'Clair'), detail: t('Always light', 'فاتح دائماً', 'Toujours clair') },
    { value: 'dark', icon: <Moon className="h-4 w-4" />, label: t('Dark', 'مظلم', 'Sombre'), detail: t('Always dark', 'مظلم دائماً', 'Toujours sombre') },
  ];

  return (
    <div className="min-h-full pb-24">
      <ScreenHeader
        title={t('Account', 'الحساب', 'Compte')}
        onBack={onBack}
        backLabel={t('Back', 'رجوع', 'Retour')}
      />

      <div className="mx-auto w-full max-w-[44rem] px-4 pt-4 sm:px-6">
        <section className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
          <UserAvatar name={authUser?.name} avatarUrl={authUser?.avatarUrl} className="h-14 w-14" textClassName="text-h2" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-h2 font-bold tracking-tight text-ink">
              {authed ? authUser?.name : t('Traveler', 'مسافر', 'Voyageur')}
            </h2>
            <p className="mt-0.5 truncate text-caption text-muted">
              {authed && authUser?.email ? authUser.email : t('Not signed in', 'غير مسجّل الدخول', 'Non connecté')}
            </p>
          </div>
          {!authed && (
            <Button size="sm" onClick={onOpenAuth} className="shrink-0">
              {t('Sign in', 'تسجيل الدخول', 'Se connecter')}
            </Button>
          )}
        </section>

        <Divider className="my-5" />

        <SectionHeading
          className="px-0 pb-2"
          title={t('Appearance', 'المظهر', 'Apparence')}
          action={appearance !== 'auto' ? (
            <button type="button" onClick={() => chooseAppearance('auto')} className="inline-flex min-h-11 items-center px-1 text-caption font-bold text-brand-accent">
              {t('Reset', 'إعادة ضبط', 'Réinitialiser')}
            </button>
          ) : undefined}
        />
        <div className="grid-cols-1 grid gap-2.5 sm:grid-cols-2">
          {appearanceOptions.map((option) => (
            <OptionCard
              key={option.value}
              selected={appearance === option.value}
              onSelect={() => chooseAppearance(option.value)}
              label={option.label}
              description={option.detail}
              icon={option.icon}
            />
          ))}
        </div>

        <Divider className="my-5" />

        <SectionHeading
          size="sm"
          className="px-0 pb-2"
          title={t('Language', 'اللغة', 'Langue')}
          description={t('Applies to the whole app', 'تنطبق على التطبيق كله', 'S’applique à toute l’application')}
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('App language', 'لغة التطبيق', 'Langue de l’application')}>
          {([['en', 'English'], ['ar', 'العربية'], ['fr', 'Français']] as const).map(([value, label]) => {
            const selected = language === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => onLanguageChange(value as SupportedLanguage)}
                className={`min-h-11 rounded-lg border px-3.5 text-body font-bold transition-colors ${
                  selected
                    ? 'border-brand-600 bg-brand-fill text-on-brand'
                    : 'border-line-strong bg-surface text-ink-soft hover:bg-surface-muted'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <Divider className="my-5" />

        <SectionHeading size="sm" className="px-0 pb-2" title={t('Location', 'الموقع', 'Localisation')} />
        <div className="overflow-hidden rounded-lg border border-line bg-surface" data-surface="card">
          <div className="sindbad-list-row w-full rounded-none">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${userLocation ? 'bg-positive/12 text-positive' : 'bg-surface-muted text-muted'}`}>
              <Navigation className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body font-bold text-ink">{locationLabel}</span>
              <span className="block text-micro text-muted">
                {t('Used to rank nearby places.', 'يُستخدم لترتيب الأماكن القريبة.', 'Utilisé pour classer les lieux proches.')}
              </span>
            </span>
            {!userLocation && locationPermission !== 'unsupported' && (
              <Button size="sm" variant="secondary" onClick={() => void requestLocation()} loading={locating} className="shrink-0">
                {t('Share', 'مشاركة', 'Partager')}
              </Button>
            )}
          </div>
          {(locationError || locationPermission === 'denied' || locationPermission === 'unsupported') && !userLocation && (
            <div className="border-t border-line px-3.5 py-3">
              {locationPermission === 'unsupported' ? (
                <ErrorState
                  title={t('No location in this browser', 'لا يوجد تحديد موقع في هذا المتصفح', 'Pas de position dans ce navigateur')}
                  description={t('Places near you cannot be listed. Browsing by city still works.', 'لا يمكن عرض الأماكن القريبة. التصفح حسب المدينة يعمل.', 'Les lieux proches sont indisponibles. La recherche par ville fonctionne.')}
                />
              ) : (
                <Alert
                  tone="warning"
                  title={t('Location is blocked', 'الوصول إلى الموقع محظور', 'La position est bloquée')}
                  action={
                    <Button size="sm" variant="secondary" onClick={() => void requestLocation()} loading={locating}>
                      {t('Try again', 'أعد المحاولة', 'Réessayer')}
                    </Button>
                  }
                >
                  {locationError || t('Allow location access in the browser settings for this site, then try again.', 'اسمح بالوصول إلى الموقع في إعدادات المتصفح لهذا الموقع ثم أعد المحاولة.', 'Autorisez la position dans les réglages du navigateur pour ce site, puis réessayez.')}
                </Alert>
              )}
            </div>
          )}
          <div className="sindbad-list-row w-full rounded-none border-t border-line">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isPassiveOptedIn ? 'bg-positive/12 text-positive' : 'bg-surface-muted text-muted'}`}>
              <Radio className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body font-bold text-ink">{t('Location contributions', 'مساهمات الموقع', 'Contributions de position')}</span>
              <span className="block text-micro text-muted">
                {isPassiveOptedIn ? t('On', 'مفعّلة', 'Activée') : t('Off', 'متوقفة', 'Désactivée')}
              </span>
            </span>
            <Button size="sm" variant="quiet" onClick={onOpenPassiveGps} className="shrink-0">
              {t('Manage', 'إدارة', 'Gérer')}
            </Button>
          </div>
        </div>

        <Divider className="my-5" />

        <div className="overflow-hidden rounded-lg border border-line bg-surface" data-surface="card">
          <button
            type="button"
            onClick={savedPlacesCount > 0 ? onOpenSaved : undefined}
            disabled={!onOpenSaved || savedPlacesCount === 0}
            className="sindbad-list-row w-full rounded-none border-b border-line disabled:cursor-default disabled:opacity-100"
          >
            <MapPin className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-start">
              <span className="block text-body font-bold text-ink">{t('Saved places', 'الأماكن المحفوظة', 'Lieux enregistrés')}</span>
            </span>
            <span className="shrink-0 text-body font-extrabold tabular-nums text-ink">{savedPlacesCount}</span>
          </button>
          {canInstall && (
            <button type="button" onClick={onInstall} className="sindbad-list-row w-full rounded-none">
              <Download className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-start">
                <span className="block text-body font-bold text-ink">{t('Install app', 'تثبيت التطبيق', 'Installer l’application')}</span>
              </span>
            </button>
          )}
        </div>

        {authed && (
          <div className="mt-5 rounded-lg border border-line bg-surface p-3.5" data-surface="card">
            {confirmSignOut ? (
              <div className="space-y-3">
                <p className="text-body text-ink">
                  {t('Sign out of My Sindbad?', 'تسجيل الخروج من My Sindbad؟', 'Se déconnecter de My Sindbad ?')}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => void confirmSignOutAction()}
                    loading={signingOut}
                    icon={!signingOut ? <LogOut className="h-4 w-4" /> : undefined}
                  >
                    {t('Sign out', 'تسجيل الخروج', 'Se déconnecter')}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setConfirmSignOut(false)} disabled={signingOut}>
                    {t('Keep me signed in', 'إبقاء تسجيلي', 'Rester connecté')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="min-w-0 flex-1 text-caption text-muted">
                  {t('Trips and saved places stay on this device.', 'تبقى رحلتك وأماكنك المحفوظة على هذا الجهاز.', 'Vos voyages et lieux enregistrés restent sur cet appareil.')}
                </p>
                <Button size="sm" variant="tertiary" onClick={() => setConfirmSignOut(true)} className="shrink-0">
                  {t('Sign out', 'تسجيل الخروج', 'Se déconnecter')}
                </Button>
              </div>
            )}
          </div>
        )}

        {signingOut && <div className="mt-3"><LoadingRow label={t('Signing out…', 'جارٍ تسجيل الخروج…', 'Déconnexion…')} /></div>}
      </div>
    </div>
  );
};

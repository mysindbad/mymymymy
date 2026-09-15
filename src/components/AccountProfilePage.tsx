import React, { useState } from 'react';
import { ChevronLeft, Download, Globe2, LogOut, MapPin, Radio, UserRound } from 'lucide-react';
import { SupportedLanguage } from '../data/translations';
import type { GeolocationPermission, UserLocation } from '../hooks/useGeolocation';
import type { AuthStatus, AuthUser } from '../lib/authSession';
import { UserAvatar } from './UserAvatar';

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
}) => {
  const [locating, setLocating] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const t = (en: string, ar: string, fr: string) => isAr ? ar : isFr ? fr : en;
  const authed = authStatus === 'authed' && Boolean(authUser);

  const requestLocation = async () => {
    setLocating(true);
    try {
      await onRequestLocation();
    } finally {
      setLocating(false);
    }
  };

  const confirmSignOut = async () => {
    if (!window.confirm(t('Sign out of My Sindbad?', 'تسجيل الخروج من My Sindbad؟', 'Se déconnecter de My Sindbad ?'))) return;
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  const locationLabel = userLocation
    ? t('Location available', 'الموقع متاح', 'Localisation disponible')
    : locationPermission === 'denied'
      ? t('Location blocked', 'الموقع محظور', 'Localisation bloquée')
      : locationPermission === 'unsupported'
        ? t('Location unavailable', 'الموقع غير متاح', 'Localisation indisponible')
        : t('Location not shared', 'لم تتم مشاركة الموقع', 'Localisation non partagée');

  return (
    <div className="min-h-full bg-slate-50 pb-24" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <button type="button" onClick={onBack} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100" aria-label={t('Back', 'رجوع', 'Retour')}>
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        <h1 className="text-base font-black text-slate-900">{t('Account', 'الحساب', 'Compte')}</h1>
      </header>

      <div className="mx-auto max-w-xl space-y-4 p-4 sm:p-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <UserAvatar name={authUser?.name} avatarUrl={authUser?.avatarUrl} className="h-14 w-14 rounded-2xl" textClassName="text-xl" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-black text-slate-900">{authed ? authUser?.name : t('Traveler', 'مسافر', 'Voyageur')}</h2>
              {authed && authUser?.email ? <p className="truncate text-sm text-slate-500">{authUser.email}</p> : <p className="text-sm text-slate-500">{t('Not signed in', 'غير مسجل الدخول', 'Non connecté')}</p>}
            </div>
          </div>
          {!authed && (
            <button type="button" onClick={onOpenAuth} className="mt-4 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700">
              {t('Sign in', 'تسجيل الدخول', 'Se connecter')}
            </button>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Globe2 className="h-5 w-5 text-blue-600" /><h2 className="font-black text-slate-900">{t('Language', 'اللغة', 'Langue')}</h2></div>
          <div className="grid grid-cols-3 gap-2">
            {([['en', 'English'], ['ar', 'العربية'], ['fr', 'Français']] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => onLanguageChange(value)} className={`rounded-2xl border px-3 py-2.5 text-sm font-bold ${language === value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>{label}</button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2"><MapPin className="h-5 w-5 text-blue-600" /><h2 className="font-black text-slate-900">{t('Location', 'الموقع', 'Localisation')}</h2></div>
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-sm font-bold text-slate-800">{locationLabel}</p><p className="mt-0.5 text-xs text-slate-500">{t('Used to show nearby places.', 'يُستخدم لعرض الأماكن القريبة.', 'Utilisée pour afficher les lieux proches.')}</p></div>
            {!userLocation && locationPermission !== 'unsupported' && (
              <button type="button" disabled={locating} onClick={() => void requestLocation()} className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{locating ? t('Locating…', 'جارٍ التحديد…', 'Localisation…') : t('Share', 'مشاركة', 'Partager')}</button>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <button type="button" onClick={onOpenPassiveGps} className="flex w-full items-center justify-between gap-3 text-start">
            <span className="flex items-center gap-3"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Radio className="h-4 w-4" /></span><span><strong className="block text-sm text-slate-900">{t('Location contribution', 'مساهمة الموقع', 'Contribution de localisation')}</strong><small className="text-slate-500">{isPassiveOptedIn ? t('On', 'مفعّلة', 'Activée') : t('Off', 'متوقفة', 'Désactivée')}</small></span></span>
            <ChevronLeft className="h-4 w-4 rotate-180 text-slate-400 rtl:rotate-0" />
          </button>
          <div className="my-4 border-t border-slate-100" />
          <div className="flex items-center gap-3"><span className="rounded-xl bg-rose-50 p-2 text-rose-600"><UserRound className="h-4 w-4" /></span><div><strong className="block text-sm text-slate-900">{t('Saved places', 'الأماكن المحفوظة', 'Lieux enregistrés')}</strong><small className="text-slate-500">{savedPlacesCount}</small></div></div>
          {canInstall && <><div className="my-4 border-t border-slate-100" /><button type="button" onClick={onInstall} className="flex w-full items-center gap-3 text-start"><span className="rounded-xl bg-slate-100 p-2 text-slate-700"><Download className="h-4 w-4" /></span><strong className="text-sm text-slate-900">{t('Install app', 'تثبيت التطبيق', 'Installer l’application')}</strong></button></>}
        </section>

        {authed && (
          <section className="rounded-3xl border border-rose-200 bg-white p-4">
            <button type="button" disabled={signingOut} onClick={() => void confirmSignOut()} className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><LogOut className="h-4 w-4" />{signingOut ? t('Signing out…', 'جارٍ الخروج…', 'Déconnexion…') : t('Sign out', 'تسجيل الخروج', 'Se déconnecter')}</button>
          </section>
        )}
      </div>
    </div>
  );
};

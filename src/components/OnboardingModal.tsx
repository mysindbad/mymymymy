import React, { useState } from 'react';
import { Globe2, MapPin } from 'lucide-react';
import { SupportedLanguage, TRANSLATIONS } from '../data/translations';
import type { UserLocation, GeolocationPermission } from '../hooks/useGeolocation';
import { BrandLogo } from './BrandLogo';

interface OnboardingModalProps {
  userId: string;
  language: SupportedLanguage;
  onLanguageChange: (language: SupportedLanguage) => void;
  userLocation: UserLocation | null;
  permission: GeolocationPermission;
  requestPermission: () => Promise<UserLocation | null>;
  onComplete: () => void;
}

function onboardingKey(userId: string) {
  return `sindbad_onboarding_complete:${userId}`;
}

export function hasCompletedOnboarding(userId: string): boolean {
  try {
    return localStorage.getItem(onboardingKey(userId)) === 'true';
  } catch {
    return false;
  }
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  userId,
  language,
  onLanguageChange,
  userLocation,
  permission,
  requestPermission,
  onComplete,
}) => {
  const [step, setStep] = useState(1);
  const [locationError, setLocationError] = useState<string | null>(null);
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const localize = (en: string, ar: string, fr: string) => isAr ? ar : isFr ? fr : en;

  const complete = () => {
    try {
      localStorage.setItem(onboardingKey(userId), 'true');
    } catch {
      // Continue even when local storage is unavailable.
    }
    onComplete();
  };

  const handleRequestLocation = async () => {
    setLocationError(null);
    const location = await requestPermission();
    if (!location) setLocationError(localize('Could not get your location.', 'تعذر تحديد موقعك.', 'Impossible de déterminer votre position.'));
  };

  const languageOptions: Array<{ value: SupportedLanguage; label: string }> = [
    { value: 'ar', label: 'العربية' },
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'Français' },
  ];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-500 px-6 py-7 text-white">
          <div className="mx-auto mb-3 flex justify-center"><BrandLogo size="md" showSlogan={false} language={language} className="drop-shadow-xl" /></div>
          <h2 className="text-center text-2xl font-black tracking-tight">{localize('Welcome to My Sindbad', 'مرحباً بك في My Sindbad', 'Bienvenue sur My Sindbad')}</h2>
          <p className="mt-2 text-center text-sm font-medium text-white/90">{localize('Choose your language and location.', 'اختر لغتك وموقعك.', 'Choisissez votre langue et votre position.')}</p>
        </div>

        <div className="p-6">
          <div className="mb-6 flex items-center justify-center gap-2" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((item) => <span key={item} className={`h-2 rounded-full transition-all ${item === step ? 'w-10 bg-blue-600' : 'w-2 bg-slate-200'}`} />)}
          </div>

          {step === 1 && (
            <section>
              <div className="mb-5 flex items-start gap-3">
                <Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <div><h3 className="text-lg font-black text-slate-900">{localize('Language', 'اللغة', 'Langue')}</h3><p className="mt-1 text-sm text-slate-500">{localize('You can change it later.', 'يمكن تغييرها لاحقاً.', 'Vous pourrez la modifier plus tard.')}</p></div>
              </div>
              <div className="grid gap-2">
                {languageOptions.map((option) => (
                  <button key={option.value} type="button" onClick={() => onLanguageChange(option.value)} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold transition ${language === option.value ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                    <span>{option.label}</span>{language === option.value && <span className="text-xs">✓</span>}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setStep(2)} className="mt-6 w-full rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-black text-white hover:bg-slate-800">{localize('Continue', 'متابعة', 'Continuer')}</button>
            </section>
          )}

          {step === 2 && (
            <section>
              <div className="mb-5 flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <div><h3 className="text-lg font-black text-slate-900">{localize('Location', 'الموقع', 'Localisation')}</h3><p className="mt-1 text-sm text-slate-500">{localize('Use your location to see nearby places.', 'استخدم موقعك لعرض الأماكن القريبة.', 'Utilisez votre position pour voir les lieux proches.')}</p></div>
              </div>
              {userLocation && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{localize('Location found.', 'تم تحديد موقعك.', 'Position trouvée.')}</div>}
              {permission === 'denied' && !userLocation && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">{localize('Location is blocked in your browser.', 'إذن الموقع محظور في المتصفح.', 'La localisation est bloquée dans votre navigateur.')}</div>}
              {locationError && <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{locationError}</div>}
              <div className="mt-6 flex gap-2">
                <button type="button" onClick={() => setStep(3)} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3.5 text-sm font-black text-slate-700 hover:bg-slate-50">{localize('Skip', 'تخطي', 'Ignorer')}</button>
                <button type="button" onClick={() => void handleRequestLocation().then(() => setStep(3))} className="flex-1 rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-black text-white hover:bg-blue-700">{userLocation ? localize('Continue', 'متابعة', 'Continuer') : localize('Use my location', 'استخدم موقعي', 'Utiliser ma position')}</button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="text-center">
              <div className="mx-auto flex justify-center"><BrandLogo size="icon" showSlogan={false} language={language} className="h-20 w-20" /></div>
              <h3 className="mt-4 text-xl font-black text-slate-900">{localize('Ready to explore', 'جاهز للاستكشاف', 'Prêt à explorer')}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{userLocation ? localize('Nearby places are ready.', 'سنبدأ بالأماكن القريبة.', 'Les lieux proches sont prêts.') : localize('You can enable location later.', 'يمكنك تفعيل الموقع لاحقاً.', 'Vous pourrez activer la localisation plus tard.')}</p>
              <button type="button" onClick={complete} className="mt-7 w-full rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700">{t.startNavigation === 'Start Navigation' ? 'Start exploring' : localize('Start exploring', 'ابدأ الاستكشاف', 'Commencer à explorer')}</button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

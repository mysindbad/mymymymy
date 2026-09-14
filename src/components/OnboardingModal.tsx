import React, { useState } from 'react';
import { Globe2, MapPin, ShieldCheck } from 'lucide-react';
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

  const complete = () => {
    try {
      localStorage.setItem(onboardingKey(userId), 'true');
    } catch {
      // Keep the completion state in memory even when storage is unavailable.
    }
    onComplete();
  };

  const handleRequestLocation = async () => {
    setLocationError(null);
    const location = await requestPermission();
    if (!location) {
      setLocationError(isAr ? 'تعذر الحصول على موقعك. يمكنك المتابعة بدون الموقع.' : 'We could not get your location. You can continue without it.');
    }
  };

  const languageOptions: Array<{ value: SupportedLanguage; label: string }> = [
    { value: 'ar', label: 'العربية' },
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'Français' },
  ];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-500 px-6 py-7 text-white">
          <div className="mx-auto mb-3 flex justify-center">
            <BrandLogo size="md" showSlogan={false} language={language} className="drop-shadow-xl" />
          </div>
          <h2 className="text-center text-2xl font-black tracking-tight">{isAr ? 'مرحباً بك في My Sindbad' : 'Welcome to My Sindbad'}</h2>
          <p className="mt-2 text-center text-sm font-medium text-white/90">
            {isAr ? 'لنجهّز تجربتك بسرعة، ثم ابدأ اكتشاف الأماكن.' : 'Let us personalize your experience, then start exploring.'}
          </p>
        </div>

        <div className="p-6">
          <div className="mb-6 flex items-center justify-center gap-2" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((item) => (
              <span key={item} className={`h-2 rounded-full transition-all ${item === step ? 'w-10 bg-blue-600' : 'w-2 bg-slate-200'}`} />
            ))}
          </div>

          {step === 1 && (
            <section>
              <div className="mb-5 flex items-start gap-3">
                <Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <div>
                  <h3 className="text-lg font-black text-slate-900">{isAr ? 'اختر لغتك المفضلة' : 'Choose your preferred language'}</h3>
                  <p className="mt-1 text-sm text-slate-500">{isAr ? 'يمكنك تغييرها لاحقاً من داخل التطبيق.' : 'You can change it later from the app.'}</p>
                </div>
              </div>

              <div className="grid gap-2">
                {languageOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onLanguageChange(option.value)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                      language === option.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{option.label}</span>
                    {language === option.value && <span className="text-xs">✓</span>}
                  </button>
                ))}
              </div>

              <button type="button" onClick={() => setStep(2)} className="mt-6 w-full rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-black text-white hover:bg-slate-800">
                {t.startNavigation === 'Start Navigation' ? 'Continue' : isAr ? 'متابعة' : 'Continue'}
              </button>
            </section>
          )}

          {step === 2 && (
            <section>
              <div className="mb-5 flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <div>
                  <h3 className="text-lg font-black text-slate-900">{isAr ? 'اسمح بالوصول إلى موقعك' : 'Allow location access'}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    {isAr ? 'سنستخدم موقعك الحالي لعرض الأماكن الأقرب. لا يلزم السماح بالوصول للاستمرار.' : 'We use your current position to show nearby places. Location access is optional.'}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{isAr ? 'يتم إرسال آخر موقع معروف فقط عند موافقتك، وبموافقة الحساب المسجل.' : 'Your last known location is only synced after you grant permission while signed in.'}</span>
                </div>
              </div>

              {userLocation && (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                  {isAr ? 'تم تحديد موقعك بنجاح.' : 'Your location was detected successfully.'}
                </div>
              )}

              {permission === 'denied' && !userLocation && (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                  {isAr ? 'تم رفض إذن الموقع. يمكنك تفعيله من إعدادات المتصفح.' : 'Location permission is denied. You can enable it from your browser settings.'}
                </div>
              )}

              {locationError && (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{locationError}</div>
              )}

              <div className="mt-6 flex gap-2">
                <button type="button" onClick={() => setStep(3)} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3.5 text-sm font-black text-slate-700 hover:bg-slate-50">
                  {isAr ? 'تخطي' : 'Skip'}
                </button>
                <button type="button" onClick={() => void handleRequestLocation().then(() => setStep(3))} className="flex-1 rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-black text-white hover:bg-blue-700">
                  {userLocation ? (isAr ? 'متابعة' : 'Continue') : (isAr ? 'السماح بالموقع' : 'Allow location')}
                </button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <div className="mx-auto flex justify-center">
                <BrandLogo size="icon" showSlogan={false} language={language} className="h-20 w-20" />
              </div>
              <h3 className="mt-4 text-center text-xl font-black text-slate-900">{isAr ? 'أنت جاهز للاستكشاف' : 'You are ready to explore'}</h3>
              <p className="mx-auto mt-2 max-w-md text-center text-sm leading-relaxed text-slate-500">
                {userLocation
                  ? (isAr ? 'سنرتب لك الأماكن الأقرب إلى موقعك الحقيقي عندما تكون البيانات متاحة.' : 'We will prioritize nearby places using your real position when available.')
                  : (isAr ? 'يمكنك استخدام My Sindbad بدون مشاركة الموقع، ثم تفعيلها لاحقاً.' : 'You can use My Sindbad without sharing your location and enable it later.')}
              </p>
              <button type="button" onClick={complete} className="mt-7 w-full rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700">
                {isAr ? 'ابدأ الاستكشاف' : 'Start exploring'}
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

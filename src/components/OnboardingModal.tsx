import React, { useState } from 'react';
import { Check, MapPin, ShieldCheck } from 'lucide-react';
import { SupportedLanguage } from '../data/translations';
import type { UserLocation, GeolocationPermission } from '../hooks/useGeolocation';
import { SindbadMark } from './BrandLogo';
import { useLocale } from '../lib/i18n';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Feedback';
import { OptionCard } from '../ui/Field';

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

const TOTAL_STEPS = 3;

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  userId,
  language,
  onLanguageChange,
  userLocation,
  permission,
  requestPermission,
  onComplete,
}) => {
  const locale = useLocale(language);
  const t = locale.t;
  const [step, setStep] = useState(1);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

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
    setIsLocating(true);
    const location = await requestPermission();
    setIsLocating(false);
    if (!location) {
      setLocationError(t(
        'We could not get your location. You can continue without it.',
        'تعذر الحصول على موقعك. يمكنك المتابعة بدونه.',
        'Impossible de récupérer votre position. Vous pouvez continuer sans.',
      ));
      return;
    }
    setStep(TOTAL_STEPS);
  };

  const languageOptions: Array<{ value: SupportedLanguage; label: string; note: string }> = [
    { value: 'ar', label: 'العربية', note: 'Arabic' },
    { value: 'en', label: 'English', note: 'English' },
    { value: 'fr', label: 'Français', note: 'French' },
  ];

  return (
    <Sheet
      open
      onClose={complete}
      dismissible={false}
      variant="dialog"
      size="sm"
      language={language}
      title={t('Set up My Sindbad', 'تهيئة My Sindbad', 'Préparation de My Sindbad')}
      subtitle={t('Step {n} of {total}', 'الخطوة {n} من {total}', 'Étape {n} sur {total}')
        .replace('{n}', String(step))
        .replace('{total}', String(TOTAL_STEPS))}
      footer={
        step === 1 ? (
          <Button full onClick={() => setStep(2)}>
            {t('Continue', 'متابعة', 'Continuer')}
          </Button>
        ) : step === 2 ? (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStep(3)}>
              {t('Skip', 'تخطٍّ', 'Passer')}
            </Button>
            <Button className="flex-1" loading={isLocating} onClick={() => void handleRequestLocation()}>
              {userLocation
                ? t('Continue', 'متابعة', 'Continuer')
                : t('Allow location', 'السماح بالموقع', 'Autoriser la position')}
            </Button>
          </div>
        ) : (
          <Button full onClick={complete}>
            {t('Start exploring', 'ابدأ الاستكشاف', 'Commencer l’exploration')}
          </Button>
        )
      }
    >
      <div className="px-4 pb-6 pt-4 sm:px-5">
        <div className="mb-5 flex items-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuenow={step}>
          {[1, 2, 3].map((item) => (
            <span
              key={item}
              className={`h-1 flex-1 rounded-full transition-colors duration-200 ${item <= step ? 'bg-brand-fill' : 'bg-line-strong'}`}
            />
          ))}
        </div>

        {step === 1 && (
          <section>
            <h3 className="text-title font-bold tracking-tight text-ink">
              {t('Choose your language', 'اختر لغتك', 'Choisissez votre langue')}
            </h3>
            <p className="mt-1 text-caption text-muted">
              {t('You can change it later in Account.', 'يمكنك تغييرها لاحقاً من الحساب.', 'Vous pouvez la modifier plus tard dans le compte.')}
            </p>
            <div className="mt-3.5 space-y-2">
              {languageOptions.map((option) => (
                <OptionCard
                  key={option.value}
                  selected={language === option.value}
                  onSelect={() => onLanguageChange(option.value)}
                  label={option.label}
                  description={option.note}
                />
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-accent">
                <MapPin className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="text-title font-bold tracking-tight text-ink">
                  {t('Nearby places', 'الأماكن القريبة', 'Lieux à proximité')}
                </h3>
                <p className="mt-1 text-caption leading-relaxed text-muted">
                  {t(
                    'Your position is used to rank places near you. It is optional.',
                    'يُستخدم موقعك لترتيب الأماكن القريبة. الأمر اختياري.',
                    'Votre position sert à classer les lieux proches. Elle est facultative.',
                  )}
                </p>
              </div>
            </div>

            <div className="mt-3.5">
              <Alert tone="info" icon={false}>
                <span className="flex items-start gap-2">
                  <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t(
                    'Nothing is sent to our servers unless you are signed in and share it yourself.',
                    'لا يُرسل شيء إلى خوادمنا إلا إذا كنت مسجّلاً وشاركت موقعك بنفسك.',
                    'Rien n’est envoyé tant que vous n’êtes pas connecté et que vous ne partagez pas votre position.',
                  )}
                </span>
              </Alert>
            </div>

            {userLocation && (
              <div className="mt-2.5">
                <Alert tone="success">{t('Your location is active.', 'موقعك مفعّل.', 'Votre position est active.')}</Alert>
              </div>
            )}

            {permission === 'denied' && !userLocation && (
              <div className="mt-2.5">
                <Alert tone="warning" title={t('Location is blocked', 'الموقع محظور', 'La position est bloquée')}>
                  {t(
                    'Enable it in your browser settings for this site.',
                    'فعّله من إعدادات المتصفح لهذا الموقع.',
                    'Activez-la dans les réglages du navigateur pour ce site.',
                  )}
                </Alert>
              </div>
            )}

            {locationError && (
              <div className="mt-2.5">
                <Alert tone="error">{locationError}</Alert>
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="text-start">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-soft">
              <SindbadMark className="h-7 w-7" />
            </span>
            <h3 className="mt-3 text-h2 font-bold tracking-tight text-ink">
              {t('Ready when you are', 'أنت جاهز', 'Vous êtes prêt')}
            </h3>
            <p className="mt-1.5 max-w-md text-caption leading-relaxed text-muted">
              {userLocation
                ? t(
                    'Nearby places will be ranked by distance whenever location data is available.',
                    'تُرتَّب الأماكن القريبة حسب المسافة متى توفرت بيانات الموقع.',
                    'Les lieux proches seront classés par distance dès que la position est disponible.',
                  )
                : t(
                    'You can keep using My Sindbad by city or region, and turn location on later.',
                    'يمكنك استخدام My Sindbad حسب المدينة أو المنطقة، وتفعيل الموقع لاحقاً.',
                    'Vous pouvez utiliser My Sindbad par ville ou région, et activer la position plus tard.',
                  )}
            </p>
            <ul className="mt-3.5 space-y-1.5">
              {[
                t('Search and save places', 'ابحث عن الأماكن واحفظها', 'Rechercher et enregistrer des lieux'),
                t('Plan a trip with days and budget', 'خطِّط رحلة بالأيام والميزانية', 'Préparer un voyage avec jours et budget'),
                t('Get turn-by-turn guidance', 'إرشادات تنقّل خطوة بخطوة', 'Obtenir un guidage étape par étape'),
              ].map((line) => (
                <li key={line} className="flex items-start gap-2 text-caption text-ink-soft">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Sheet>
  );
};

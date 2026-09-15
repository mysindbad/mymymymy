import React, { useState } from 'react';
import { Navigation, Radio, X } from 'lucide-react';
import { submitPassiveTrace } from '../services/api';
import { getAuthSessionSnapshot } from '../lib/authSession';
import { SupportedLanguage } from '../data/translations';

interface PassiveDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOptedIn: boolean;
  onToggleOptIn: (optedIn: boolean) => void;
  language?: SupportedLanguage;
}

type SendStatus = { type: 'success' | 'error'; message: string };

function requestCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GEOLOCATION_UNAVAILABLE'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  });
}

function createContributionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `contribution_${crypto.randomUUID()}`;
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const values = new Uint32Array(4);
    crypto.getRandomValues(values);
    return `contribution_${Array.from(values, (value) => value.toString(16).padStart(8, '0')).join('')}`;
  }
  throw new Error('SECURE_RANDOM_UNAVAILABLE');
}

export const PassiveDataModal: React.FC<PassiveDataModalProps> = ({
  isOpen,
  onClose,
  isOptedIn,
  onToggleOptIn,
  language = 'en',
}) => {
  const [isSendingSample, setIsSendingSample] = useState(false);
  const [sendStatus, setSendStatus] = useState<SendStatus | null>(null);
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const localize = (en: string, ar: string, fr: string) => isAr ? ar : isFr ? fr : en;

  if (!isOpen) return null;

  const handleSendCurrentLocation = async () => {
    setSendStatus(null);
    if (getAuthSessionSnapshot().status !== 'authed') {
      setSendStatus({ type: 'error', message: localize('Sign in first.', 'سجّل الدخول أولاً.', 'Connectez-vous d’abord.') });
      return;
    }
    setIsSendingSample(true);
    try {
      const position = await requestCurrentPosition();
      const success = await submitPassiveTrace({
        coordinates: [position.coords.latitude, position.coords.longitude],
        mode: 'manual_sample',
        anonymousUserId: createContributionId(),
      });
      setSendStatus(success
        ? { type: 'success', message: localize('Your current-location sample was recorded successfully.', 'تم إرسال موقعك الحالي بنجاح.', 'Votre position actuelle a été envoyée.') }
        : { type: 'error', message: localize('Could not send your location. Try again.', 'تعذر إرسال موقعك. حاول مجدداً.', 'Impossible d’envoyer votre position. Réessayez.') });
    } catch {
      setSendStatus({ type: 'error', message: localize('Could not access your location.', 'تعذر الوصول إلى موقعك.', 'Impossible d’accéder à votre position.') });
    } finally {
      setIsSendingSample(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white">
          <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20"><Radio className="h-4 w-4" /></span><div><h2 className="font-black">{localize('Location contribution', 'مشاركة الموقع', 'Partage de localisation')}</h2><p className="text-xs text-emerald-100">{localize('Share only when you choose.', 'شارك موقعك فقط عندما تختار ذلك.', 'Partagez uniquement quand vous le souhaitez.')}</p></div></div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20" aria-label={localize('Close', 'إغلاق', 'Fermer')}><X className="h-4 w-4" /></button>
        </header>

        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div><strong className="block text-sm text-slate-900">{localize('Manual location sharing', 'مشاركة الموقع يدوياً', 'Partage manuel')}</strong><small className="text-slate-500">{localize('No background tracking.', 'لا يوجد تتبع في الخلفية.', 'Aucun suivi en arrière-plan.')}</small></div>
            <label className="relative inline-flex shrink-0 cursor-pointer items-center">
              <input type="checkbox" checked={isOptedIn} onChange={(event) => onToggleOptIn(event.target.checked)} className="peer sr-only" />
              <div className="h-6 w-11 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white rtl:peer-checked:after:-translate-x-full" />
            </label>
          </div>

          <button type="button" onClick={() => void handleSendCurrentLocation()} disabled={isSendingSample || !isOptedIn} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40">
            <Navigation className="h-4 w-4" />
            {isSendingSample ? localize('Getting location…', 'جارٍ تحديد الموقع…', 'Localisation…') : localize('Send Current Location Sample', 'إرسال موقعي الحالي', 'Envoyer ma position actuelle')}
          </button>

          {sendStatus && <div className={`rounded-2xl px-3 py-2 text-center text-xs font-bold ${sendStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>{sendStatus.message}</div>}
        </div>
      </div>
    </div>
  );
};

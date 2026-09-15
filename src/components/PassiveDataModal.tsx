import React, { useState } from 'react';
import { MapPin, Navigation, Radio, X } from 'lucide-react';
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
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

function createContributionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `contribution_${crypto.randomUUID()}`;
  }
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
  const localize = (english: string, arabic: string, french: string) => isAr ? arabic : isFr ? french : english;

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
        ? { type: 'success', message: localize('Location sent.', 'تم إرسال الموقع.', 'Localisation envoyée.') }
        : { type: 'error', message: localize('Could not send location.', 'تعذر إرسال الموقع.', 'Impossible d’envoyer la localisation.') });
    } catch {
      setSendStatus({ type: 'error', message: localize('Location permission is required.', 'يلزم السماح بالوصول إلى الموقع.', 'L’autorisation de localisation est requise.') });
    } finally {
      setIsSendingSample(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><MapPin className="h-4 w-4" /></span>
            <h2 className="text-base font-black">{localize('Location Contribution', 'مشاركة الموقع', 'Partage de localisation')}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={localize('Close', 'إغلاق', 'Fermer')} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15"><X className="h-4 w-4" /></button>
        </header>

        <div className="space-y-4 p-5">
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <span className="flex items-center gap-3"><Radio className="h-4 w-4 text-emerald-600" /><strong className="text-sm text-slate-900">{localize('Share a location sample', 'مشاركة عينة من الموقع', 'Partager un échantillon de localisation')}</strong></span>
            <input type="checkbox" checked={isOptedIn} onChange={(event) => onToggleOptIn(event.target.checked)} className="h-5 w-5 accent-emerald-600" />
          </label>

          <p className="text-xs text-slate-500">{localize('Your location is sent only when you tap Send.', 'يُرسل موقعك فقط عندما تضغط على إرسال.', 'Votre position est envoyée uniquement lorsque vous appuyez sur Envoyer.')}</p>

          <button type="button" onClick={() => void handleSendCurrentLocation()} disabled={isSendingSample || !isOptedIn} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
            <Navigation className="h-4 w-4" />
            {isSendingSample ? localize('Sending…', 'جارٍ الإرسال…', 'Envoi…') : localize('Send location', 'إرسال الموقع', 'Envoyer la localisation')}
          </button>

          {sendStatus && <div className={`rounded-xl px-3 py-2 text-xs font-bold ${sendStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>{sendStatus.message}</div>}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { X, ShieldCheck, Radio, Navigation } from 'lucide-react';
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

type SendStatus = {
  type: 'success' | 'error';
  message: string;
};

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

  if (!isOpen) return null;

  const localize = (english: string, arabic: string, french: string) =>
    isAr ? arabic : isFr ? french : english;

  const handleSendCurrentLocation = async () => {
    setSendStatus(null);

    if (getAuthSessionSnapshot().status !== 'authed') {
      setSendStatus({
        type: 'error',
        message: localize(
          'Sign in before sending a GPS contribution.',
          'سجّل الدخول قبل إرسال مساهمة GPS.',
          'Connectez-vous avant d’envoyer une contribution GPS.'
        ),
      });
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
        ? {
          type: 'success',
          message: localize(
            'Your current-location sample was recorded successfully.',
            'تم تسجيل عينة موقعك الحالي بنجاح.',
            'Votre échantillon de position actuelle a été enregistré.'
          ),
        }
        : {
          type: 'error',
          message: localize(
            'The contribution could not be recorded. Check your session or connection and try again.',
            'تعذر تسجيل المساهمة. تحقق من جلسة الدخول أو الاتصال ثم حاول مجدداً.',
            'La contribution n’a pas pu être enregistrée. Vérifiez votre session ou votre connexion puis réessayez.'
          ),
        });
    } catch {
      setSendStatus({
        type: 'error',
        message: localize(
          'Could not access your current location. Check location permission and try again.',
          'تعذر الوصول إلى موقعك الحالي. تحقق من إذن الموقع ثم حاول مجدداً.',
          'Impossible d’accéder à votre position actuelle. Vérifiez l’autorisation de localisation puis réessayez.'
        ),
      });
    } finally {
      setIsSendingSample(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-in zoom-in-95">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
              <Radio className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {localize('Optional GPS Contribution', 'مساهمة GPS اختيارية', 'Contribution GPS facultative')}
              </h2>
              <p className="text-xs text-emerald-100">
                {localize(
                  'Send your current location manually as a community contribution',
                  'أرسل موقعك الحالي يدوياً كمساهمة للمجتمع',
                  'Envoyez manuellement votre position actuelle comme contribution communautaire'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"
            aria-label={localize('Close', 'إغلاق', 'Fermer')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs text-slate-700">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="font-bold text-slate-900 text-sm">
                {localize('Allow manual GPS contributions', 'السماح بمساهمات GPS اليدوية', 'Autoriser les contributions GPS manuelles')}
              </span>
              <p className="text-[11px] text-slate-500">
                {localize(
                  'No periodic upload or background tracking is enabled. A location sample is requested only when you press the send button.',
                  'لا يوجد إرسال دوري أو تتبع في الخلفية. لا يُطلب موقعك إلا عندما تضغط زر الإرسال.',
                  'Aucun envoi périodique ni suivi en arrière-plan n’est activé. Votre position n’est demandée que lorsque vous appuyez sur le bouton d’envoi.'
                )}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={isOptedIn}
                onChange={(e) => onToggleOptIn(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-100 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{localize('How the contribution is handled', 'كيف يتم التعامل مع المساهمة', 'Traitement de la contribution')}</span>
            </div>
            <ul className="space-y-1 text-[11px] text-emerald-800 list-disc list-inside leading-relaxed">
              <li>{localize(
                'A signed-in session is required to authorize the submission.',
                'يلزم تسجيل الدخول للسماح بإرسال المساهمة.',
                'Une session connectée est requise pour autoriser l’envoi.'
              )}</li>
              <li>{localize(
                'The trace is submitted with a separate contribution identifier and does not include your account email in the trace payload.',
                'تُرسل نقطة التتبع بمعرّف مساهمة منفصل ولا يتضمن سجل التتبع بريد حسابك الإلكتروني.',
                'La trace est envoyée avec un identifiant de contribution distinct et ne contient pas l’adresse e-mail de votre compte.'
              )}</li>
              <li>{localize(
                'The public trace summary exposes aggregate totals, not individual raw coordinates.',
                'ملخص التتبع العام يعرض أرقاماً مجمعة، وليس الإحداثيات الخام الفردية.',
                'Le résumé public des traces expose des totaux agrégés, pas les coordonnées brutes individuelles.'
              )}</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {localize('Current capability', 'القدرة الحالية', 'Capacité actuelle')}
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-800 block text-xs">✦ {localize('One-time sample', 'عينة لمرة واحدة', 'Échantillon ponctuel')}</span>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {localize(
                    'Your browser requests the real current position only when you explicitly send a sample.',
                    'يطلب المتصفح موقعك الحالي الحقيقي فقط عندما ترسل عينة بشكل صريح.',
                    'Le navigateur demande votre position actuelle réelle uniquement lorsque vous envoyez explicitement un échantillon.'
                  )}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-800 block text-xs">✦ {localize('Not automatic', 'ليس تلقائياً', 'Non automatique')}</span>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {localize(
                    'Automatic background trail learning and a public live crowd heatmap are not enabled.',
                    'التعلم التلقائي للمسارات في الخلفية وخريطة الازدحام العامة الحية غير مفعّلين حالياً.',
                    'L’apprentissage automatique des parcours en arrière-plan et la carte publique de foule en direct ne sont pas activés.'
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-1 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSendCurrentLocation()}
              disabled={isSendingSample || !isOptedIn}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-40"
            >
              <Navigation className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {isSendingSample
                  ? localize('Getting current location…', 'جاري الحصول على الموقع الحالي…', 'Obtention de la position…')
                  : localize('Send Current Location Sample', 'إرسال عينة من موقعي الحالي', 'Envoyer un échantillon de ma position')}
              </span>
            </button>
            {sendStatus && (
              <span className={`text-[11px] font-bold ${sendStatus.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {sendStatus.type === 'success' ? '✓ ' : ''}{sendStatus.message}
              </span>
            )}
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
          >
            {localize('Close', 'إغلاق', 'Fermer')}
          </button>
        </div>
      </div>
    </div>
  );
};

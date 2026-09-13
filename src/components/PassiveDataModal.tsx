import React from 'react';
import { Radio, ShieldCheck, X } from 'lucide-react';
import { SupportedLanguage } from '../data/translations';

interface PassiveDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOptedIn: boolean;
  onToggleOptIn: (optedIn: boolean) => void;
  language?: SupportedLanguage;
}

export const PassiveDataModal: React.FC<PassiveDataModalProps> = ({
  isOpen,
  onClose,
  isOptedIn,
  onToggleOptIn,
  language = 'en',
}) => {
  const isAr = language === 'ar';
  const isFr = language === 'fr';

  if (!isOpen) return null;

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
                {isAr
                  ? 'مساهمة الموقع الاختيارية'
                  : isFr
                    ? 'Contribution de localisation facultative'
                    : 'Optional Location Contribution'}
              </h2>
              <p className="text-xs text-emerald-100">
                {isAr
                  ? 'احفظ موافقتك الآن — الإرسال الحقيقي للمسارات غير مفعّل بعد'
                  : isFr
                    ? 'Enregistrez votre consentement — l’envoi réel des traces n’est pas encore activé'
                    : 'Save your consent now — real trace uploading is not enabled yet'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs text-slate-700">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="font-bold text-slate-900 text-sm">
                {isAr ? 'الموافقة على مساهمة الموقع مستقبلاً' : isFr ? 'Autoriser une future contribution de localisation' : 'Allow future location contribution'}
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {isAr
                  ? 'هذا المفتاح يحفظ تفضيلك فقط على جهازك حالياً. لا يقوم التطبيق الآن بإرسال نقاط GPS دورية أو تشغيل تتبع في الخلفية.'
                  : isFr
                    ? 'Ce réglage enregistre uniquement votre préférence sur cet appareil. L’application n’envoie actuellement aucun point GPS périodique et ne suit pas votre position en arrière-plan.'
                    : 'This setting currently saves only your preference on this device. The app does not upload periodic GPS points or track you in the background.'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={isOptedIn}
                onChange={(event) => onToggleOptIn(event.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
            </label>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-100 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{isAr ? 'ما الذي يحدث الآن فعلياً؟' : isFr ? 'Que se passe-t-il réellement maintenant ?' : 'What actually happens right now?'} </span>
            </div>
            <ul className="space-y-1 text-[11px] text-emerald-800 list-disc list-inside leading-relaxed">
              <li>{isAr ? 'يتم حفظ اختيار التفعيل أو الإيقاف محلياً على جهازك.' : isFr ? 'Votre choix est enregistré localement sur votre appareil.' : 'Your opt-in preference is stored locally on your device.'}</li>
              <li>{isAr ? 'لا يتم إنشاء إحداثيات عشوائية أو إرسال عينات تجريبية إلى قاعدة البيانات.' : isFr ? 'Aucune coordonnée aléatoire ni trace de démonstration n’est envoyée à la base de données.' : 'No random coordinates or demo traces are sent to the database.'}</li>
              <li>{isAr ? 'لن يبدأ جمع مسارات حقيقية إلا بعد ربطه بموقع المستخدم الفعلي وموافقة واضحة ومسار خصوصية قابل للتحقق.' : isFr ? 'La collecte réelle ne sera activée qu’avec la position réelle, un consentement explicite et une politique de confidentialité vérifiable.' : 'Real trace collection should only be enabled with the user’s actual location, explicit consent, and a verifiable privacy path.'}</li>
            </ul>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
            <p className="font-bold mb-1">{isAr ? 'حالة الميزة' : isFr ? 'État de la fonctionnalité' : 'Feature status'}</p>
            <p className="text-[11px] leading-relaxed">
              {isAr
                ? 'مشاركة المسار الحقيقية ما زالت قيد التطوير. لن نعرض مسارات اصطناعية على أنها نشاط مجتمعي حقيقي.'
                : isFr
                  ? 'Le partage réel des traces est encore en développement. Aucune trace synthétique ne sera présentée comme une activité communautaire réelle.'
                  : 'Real trace sharing is still under development. Synthetic traces will not be presented as real community activity.'}
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
          >
            {isAr ? 'حفظ وإغلاق' : isFr ? 'Enregistrer et fermer' : 'Save & Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

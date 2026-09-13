import React, { useState } from 'react';
import { X, ShieldCheck, Radio, Check, MapPin, Activity, Sparkles, Navigation } from 'lucide-react';
import { submitPassiveTrace } from '../services/api';
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
  const [isSendingSample, setIsSendingSample] = useState(false);
  const [sampleSentStatus, setSampleSentStatus] = useState<string | null>(null);
  const isAr = language === 'ar';
  const isFr = language === 'fr';

  if (!isOpen) return null;

  const handleSimulateTraceSend = async () => {
    setIsSendingSample(true);
    setSampleSentStatus(null);

    // Send a sample breadcrumb near Chefchaouen
    const success = await submitPassiveTrace({
      coordinates: [35.1689 + (Math.random() - 0.5) * 0.01, -5.2633 + (Math.random() - 0.5) * 0.01],
      mode: 'walking',
      speedKmh: 3.6,
      anonymousUserId: `anon_${Math.random().toString(36).substring(2, 8)}`,
      region: 'Northern Morocco',
    });

    setIsSendingSample(false);
    if (success) {
      setSampleSentStatus(isAr ? 'تم إرسال إحداثية مجهولة تجريبية للخادم بنجاح!' : 'Sample anonymous trace recorded on server!');
      setTimeout(() => setSampleSentStatus(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-in zoom-in-95">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
              <Radio className="w-5 h-5 text-emerald-200 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {isAr
                  ? 'مساهمة GPS مجهولة اختيارية'
                  : isFr
                    ? 'Contribution GPS anonyme facultative'
                    : 'Optional Anonymous GPS Contribution'}
              </h2>
              <p className="text-xs text-emerald-100">
                {isAr
                  ? 'إرسال عينات يدوية لخريطة المجتمع'
                  : isFr
                    ? 'Envoyer des échantillons manuels à la carte communautaire'
                    : 'Send manual samples to the community map'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs text-slate-700">
          {/* Main Opt-in Switch */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="font-bold text-slate-900 text-sm">
                {isAr ? 'تفعيل مشاركة المسار المجهول أثناء التنقل' : 'Opt-in to Passive Location Sharing'}
              </span>
              <p className="text-[11px] text-slate-500">
                {isAr
                  ? 'بعد التفعيل، يمكنك إرسال عينة مجهولة يدوياً. لا يتم إرسال إحداثيات دورية أو تشغيل تتبع في الخلفية تلقائياً.'
                  : isFr
                    ? 'Après activation, vous pouvez envoyer un échantillon anonyme manuellement. Aucun envoi périodique ni suivi en arrière-plan n’est automatique.'
                    : 'After opting in, you can send an anonymous sample manually. Periodic uploads and background tracking are not automatic.'}
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

          {/* Privacy Guarantees */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-100 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{isAr ? 'ضمانات الخصوصية والأمان التام' : '100% Anonymous & Privacy First'}</span>
            </div>
            <ul className="space-y-1 text-[11px] text-emerald-800 list-disc list-inside leading-relaxed">
              <li>{isAr ? 'لا يتم ربط الإحداثيات بهويتك الشخصية أو بريدك الإلكتروني.' : 'Coordinates are never linked to personal identity or account email.'}</li>
               <li>{isAr ? 'لا يبدأ الإرسال إلا بعد موافقتك وضغطك على زر العينة.' : isFr ? 'L’envoi ne commence qu’après votre consentement et votre action sur le bouton d’échantillon.' : 'Nothing is sent until you consent and press the sample button.'}</li>
              <li>{isAr ? 'تساعد في كشف الممرات الجبلية غير المرصودة في المناطق النائية مثل جبال الريف.' : 'Directly aids local discovery in underserved regions like northern Morocco.'}</li>
            </ul>
          </div>

          {/* How It Trains the AI Map */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {isAr ? 'كيف يستفيد مجتمع المسافرين من هذه البيانات؟' : 'How this Powers Community Place Learning:'}
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-800 block text-xs">✦ {isAr ? 'كشف المسارات الجديدة' : 'Trail Discovery'}</span>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {isAr ? 'عندما يسير 5 مسافرين في درب ريفي، يتعرف الذكاء الاصطناعي عليه كمسار موثوق.' : 'When multiple hikers traverse a rural trail, Sindbad AI records it as a verified path.'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-800 block text-xs">✦ {isAr ? 'مؤشر ازدحام حي' : 'Live Heatmap'}</span>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {isAr ? 'تنبيهك لتجنب الحشود في أوقات الذروة واقتراح أوقات هادئة.' : 'Provides real-time crowd heatmaps so you can avoid crowded bottlenecks.'}
                </p>
              </div>
            </div>
          </div>

          {/* Test Live Breadcrumb Sending */}
          <div className="pt-1 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleSimulateTraceSend}
              disabled={isSendingSample || !isOptedIn}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-40"
            >
              <Navigation className="w-3.5 h-3.5 text-blue-600" />
              <span>{isAr ? 'إرسال نقطة تتبع تجريبية الآن' : 'Send Sample Anonymous Trace Now'}</span>
            </button>
            {sampleSentStatus && (
              <span className="text-[11px] font-bold text-emerald-600 animate-in fade-in">
                ✓ {sampleSentStatus}
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
          >
            {isAr ? 'حفظ وإغلاق' : 'Save & Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

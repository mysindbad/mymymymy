import React, { useEffect, useState } from 'react';
import { Sparkles, ShieldCheck, ArrowRight, Activity } from 'lucide-react';
import { fetchAiMemoryInsights, type AiMemoryInsights } from '../services/api';
import { SupportedLanguage } from '../data/translations';

interface NorthernMoroccoBannerProps {
  onExploreRegion: () => void;
  language?: SupportedLanguage;
}

type MetricsStatus = 'loading' | 'ready' | 'unavailable';

export const NorthernMoroccoBanner: React.FC<NorthernMoroccoBannerProps> = ({
  onExploreRegion,
  language = 'en',
}) => {
  const [insights, setInsights] = useState<AiMemoryInsights | null>(null);
  const [metricsStatus, setMetricsStatus] = useState<MetricsStatus>('loading');
  const isAr = language === 'ar';

  useEffect(() => {
    let cancelled = false;
    setMetricsStatus('loading');

    fetchAiMemoryInsights()
      .then((data) => {
        if (cancelled) return;
        setInsights(data);
        setMetricsStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setInsights(null);
        setMetricsStatus('unavailable');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const metricValue = (value: number | undefined) => (metricsStatus === 'ready' && value !== undefined ? value : '—');

  const statusText = metricsStatus === 'ready'
    ? (isAr ? 'مقاييس المجتمع متصلة' : 'Community metrics connected')
    : metricsStatus === 'unavailable'
      ? (isAr ? 'المقاييس الحية غير متاحة' : 'Live metrics unavailable')
      : (isAr ? 'جاري تحميل المقاييس' : 'Loading community metrics');

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white shadow-xl border border-slate-800 space-y-3 relative overflow-hidden">
      <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-amber-400">
          <Sparkles className="w-3.5 h-3.5 fill-current" />
          <span>{isAr ? 'تركيز العمق المحلي: شمال المغرب' : 'Local Depth Focus: Northern Morocco'}</span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
          <Activity className={`w-3 h-3 ${metricsStatus === 'loading' ? 'animate-pulse' : ''}`} />
          <span>{statusText}</span>
        </span>
      </div>

      <div>
        <h3 className="text-base sm:text-lg font-black text-white leading-snug">
          {isAr
            ? 'اكتشاف الأماكن المحلية في شفشاون وأقشور وجبال الريف'
            : 'Discovering Local Places in Chefchaouen, Akchour & the Rif'}
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed mt-1">
          {isAr
            ? 'يركز سندباد حالياً على تنظيم الأماكن المحلية وإشارات المجتمع في شمال المغرب. تُعرض الأرقام أدناه فقط عندما تصل من الخدمة الحية.'
            : 'Sindbad currently focuses on organizing local places and community signals across northern Morocco. The counts below are shown only when they come from the live service.'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 text-center">
        <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-sm font-black text-white">{metricValue(insights?.totalLearnedPlaces)}</div>
          <div className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">
            {isAr ? 'أماكن متعلمة' : 'Learned Places'}
          </div>
        </div>
        <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-sm font-black text-amber-300">{metricValue(insights?.hiddenGemsCount)}</div>
          <div className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">
            {isAr ? 'جواهر مخفية' : 'Hidden Gems'}
          </div>
        </div>
        <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-sm font-black text-emerald-400">{metricValue(insights?.totalPassiveGpsTraces)}</div>
          <div className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">
            {isAr ? 'مساهمات GPS' : 'GPS Contributions'}
          </div>
        </div>
      </div>

      <div className="pt-1 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            {metricsStatus === 'ready'
              ? (isAr ? 'مقاييس مستمدة من خدمة المجتمع' : 'Metrics sourced from the community service')
              : (isAr ? 'لا نعرض أرقاماً تقديرية عند غياب الخدمة' : 'No estimated metrics are shown when the service is unavailable')}
          </span>
        </span>

        <button
          onClick={onExploreRegion}
          className="px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition active:scale-95"
        >
          <span>{isAr ? 'عرض خريطة المنطقة' : 'Explore Region Map'}</span>
          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
};

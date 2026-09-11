import React, { useEffect, useState } from 'react';
import { Sparkles, MapPin, ShieldCheck, ArrowRight, Activity } from 'lucide-react';
import { fetchAiMemoryInsights } from '../services/api';
import { SupportedLanguage } from '../data/translations';

interface NorthernMoroccoBannerProps {
  onExploreRegion: () => void;
  language?: SupportedLanguage;
}

export const NorthernMoroccoBanner: React.FC<NorthernMoroccoBannerProps> = ({
  onExploreRegion,
  language = 'en',
}) => {
  const [insights, setInsights] = useState<any>(null);
  const isAr = language === 'ar';

  useEffect(() => {
    fetchAiMemoryInsights().then((data) => {
      if (data) setInsights(data);
    });
  }, []);

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white shadow-xl border border-slate-800 space-y-3 relative overflow-hidden">
      {/* Background soft glow */}
      <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-amber-400">
          <Sparkles className="w-3.5 h-3.5 fill-current" />
          <span>{isAr ? 'تركيز العمق المحلي: شمال المغرب' : 'Local Depth Focus: Northern Morocco'}</span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
          <Activity className="w-3 h-3 animate-pulse" />
          <span>{isAr ? 'ذاكرة نشطة ومحدثة' : 'Live Evolving Memory'}</span>
        </span>
      </div>

      <div>
        <h3 className="text-base sm:text-lg font-black text-white leading-snug">
          {isAr
            ? 'اكتشاف الأماكن والدروب غير المرصودة في شفشاون وأقشور وجبال الريف'
            : 'Uncovering Underserved Gems in Chefchaouen, Akchour & the Rif'}
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed mt-1">
          {isAr
            ? 'بينما تعاني الخرائط التقليدية من نقص التغطية في المناطق الجبلية والقرى النائية، يتعلم سندباد من مسارات المسافرين وتقييمات السكان المحليين لتوثيق شلالات الوادي، الرياضات العتيقة، ونقاط الطوارئ بدقة متناهية.'
            : 'Major map providers have sparse detail in rural Rif valleys. Sindbad continually learns from traveler check-ins and verified local business submissions to map hidden cascades, riverfront tagines, and mountain refuges.'}
        </p>
      </div>

      {/* Stats pill counter */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 text-center">
        <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-sm font-black text-white">{insights?.totalLearnedPlaces || 10}+</div>
          <div className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">
            {isAr ? 'أماكن متعلمة' : 'Learned Places'}
          </div>
        </div>
        <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-sm font-black text-amber-300">{insights?.hiddenGemsCount || 5}</div>
          <div className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">
            {isAr ? 'جواهر مخفية' : 'Hidden Gems'}
          </div>
        </div>
        <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-sm font-black text-emerald-400">96%</div>
          <div className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">
            {isAr ? 'دقة المجتمع' : 'AI Confidence'}
          </div>
        </div>
      </div>

      <div className="pt-1 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>{isAr ? 'بيانات معتمدة من السكان والمسافرين' : 'Community & owner-verified data'}</span>
        </span>

        <button
          onClick={onExploreRegion}
          className="px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition active:scale-95"
        >
          <span>{isAr ? 'عرض خريطة المنطقة' : 'Explore on Live Map'}</span>
          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
};

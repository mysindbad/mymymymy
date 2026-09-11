import React, { useState } from 'react';
import {
  Users,
  Radio,
  Building2,
  Star,
  Award,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Compass,
  MapPin,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { SupportedLanguage, TRANSLATIONS } from '../data/translations';

interface CommunityHubProps {
  onOpenAddModal: () => void;
  onOpenPassiveModal: () => void;
  isPassiveOptedIn: boolean;
  userXp: number;
  language?: SupportedLanguage;
}

export const CommunityHub: React.FC<CommunityHubProps> = ({
  onOpenAddModal,
  onOpenPassiveModal,
  isPassiveOptedIn,
  userXp,
  language = 'en',
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const isAr = language === 'ar';

  const contributors = [
    { name: 'Karim Tazi', role: 'Rif Mountain Trail Guide', points: 1420, verifiedCount: 28, badge: 'Pioneer' },
    { name: 'Fatima Zahra', role: 'Chefchaouen Heritage Architect', points: 1180, verifiedCount: 22, badge: 'Explorer' },
    { name: 'Youssef El Idrissi', role: 'Akchour Riad Host', points: 950, verifiedCount: 17, badge: 'Owner' },
    { name: 'Mehdi Bennani', role: 'Active Backpacker', points: 720, verifiedCount: 12, badge: 'Trailblazer' },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in pb-24 select-none">
      {/* Header Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white shadow-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-blue-200 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            <span>{isAr ? 'مجتمع سندباد التعاوني' : 'Sindbad Community Collective'}</span>
          </span>
          <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-black text-amber-300 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span>Level 2 • {userXp} XP</span>
          </div>
        </div>
        <h1 className="text-xl sm:text-2xl font-black">
          {isAr ? 'خريطة يصنعها المسافرون وأصحاب الأعمال معاً' : 'A Living Map Built by Travelers & Local Hosts'}
        </h1>
        <p className="text-xs sm:text-sm text-blue-100 max-w-2xl leading-relaxed">
          {isAr
            ? 'لا نعتمد على شركات الخرائط الاحتكارية البعيدة. سندباد يتعلم من خطواتك اليومية ومساهمات أصحاب المشاريع الصغيرة في أزقة شفشاون وجبال أقشور.'
            : 'Sindbad AI is not a static corporate lookup. Every step you walk and every review you write enriches the collective memory of northern Morocco and beyond.'}
        </p>
      </div>

      {/* Two Pillars: Local Business Owners & Passive Data (Feature 4 requirements) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pillar 1: Local Business Owners Portal */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {isAr ? 'بوابة أصحاب الأنشطة التجارية والمحلية' : 'Local Business Owners Portal'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {isAr
                ? 'هل تملك رياضاً، نزلاً ريفياً، مطعم طاجين في الوادي، أو خدمة نقل محلية؟ أضف مكانك بصوره وموقعه الجغرافي الدقيق ليدخل فوراً في خوارزميات الذكاء الاصطناعي وتوصيات المسافرين.'
                : 'Do you own a riad, rural guesthouse, riverfront cafe, or local guide service? Add your listing with verified GPS coordinates and photos directly to the shared database.'}
            </p>
          </div>

          <button
            onClick={onOpenAddModal}
            className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition active:scale-98"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{isAr ? 'إضافة نشاط تجاري جديد' : 'Register Your Business Listing'}</span>
          </button>
        </div>

        {/* Pillar 2: Passive GPS Contribution */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {isAr ? 'مشاركة المسار غير المباشرة (Passive GPS)' : 'Passive GPS Route Sharing'}
              </h3>
              <span
                className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                  isPassiveOptedIn
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {isPassiveOptedIn ? 'Active • Opted-In' : 'Paused'}
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {isAr
                ? 'بموافقتك الاختيارية، يرسل جهازك إحداثيات مشفرة مجهولة أثناء تنقلك. هذه البيانات ترسم خرائط المسارات الجبلية غير الموثقة وتكشف أوقات الازدحام لحماية الطبيعة.'
                : 'Opt-in to securely and anonymously stream GPS breadcrumbs while hiking or driving. Your traces map unchartered rural footpaths and detect trail popularity.'}
            </p>
          </div>

          <button
            onClick={onOpenPassiveModal}
            className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 transition active:scale-98"
          >
            <Radio className="w-4 h-4" />
            <span>{isAr ? 'إدارة إعدادات المشاركة' : 'Manage Passive Sharing'}</span>
          </button>
        </div>
      </div>

      {/* Community Leaderboard */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-900 text-base">
              {isAr ? 'رواد استكشاف وتوثيق شمال المغرب' : 'Top Regional Contributors'}
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">Updated live</span>
        </div>

        <div className="divide-y divide-slate-100">
          {contributors.map((contributor, idx) => (
            <div key={contributor.name} className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 text-center font-black text-slate-400 text-sm">
                  #{idx + 1}
                </span>
                <div>
                  <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <span>{contributor.name}</span>
                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-blue-50 text-blue-700 font-bold">
                      {contributor.badge}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">{contributor.role}</span>
                </div>
              </div>

              <div className="text-right rtl:text-left">
                <div className="text-xs sm:text-sm font-black text-slate-900">{contributor.points} XP</div>
                <span className="text-[10px] text-emerald-600 font-semibold">
                  {contributor.verifiedCount} places verified
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

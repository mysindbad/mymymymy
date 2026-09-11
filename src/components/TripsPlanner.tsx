import React, { useState } from 'react';
import {
  Calendar,
  MapPin,
  Clock,
  Sparkles,
  Navigation,
  Trash2,
  Plus,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Building2,
  Landmark
} from 'lucide-react';
import { Place } from '../types';
import { SupportedLanguage, TRANSLATIONS } from '../data/translations';

interface TripsPlannerProps {
  savedPlaces: Place[];
  onStartRoute: (place: Place) => void;
  onSelectPlace: (place: Place) => void;
  onRemoveSaved: (id: string) => void;
  language?: SupportedLanguage;
}

export const TripsPlanner: React.FC<TripsPlannerProps> = ({
  savedPlaces,
  onStartRoute,
  onSelectPlace,
  onRemoveSaved,
  language = 'en',
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const isAr = language === 'ar';

  const [activePlanDay, setActivePlanDay] = useState<'day1' | 'day2'>('day1');

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in pb-24 select-none">
      {/* Header */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
            <Calendar className="w-4 h-4" />
            <span>{isAr ? 'مخطط الرحلات الذكي' : 'AI Multi-Stop Trip Planner'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black mt-1">
            {isAr ? 'رحلاتك وأماكنك المحفوظة أوفلاين' : 'Saved Places & Multi-Stop Itineraries'}
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            {isAr
              ? 'يتم تخزين المحفوظات على جهازك للوصول إليها في الجبال بدون تغطية خلوية.'
              : 'Cached locally on your device for reliable offline navigation in remote mountain valleys.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Offline Ready</span>
          </span>
        </div>
      </div>

      {/* Suggested Curated Northern Morocco Day Route */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
              AI Smart Circuit
            </span>
            <h3 className="font-bold text-slate-900 text-base mt-1">
              {isAr ? 'مسار يوم كامل: أسرار شفشاون وشلالات أقشور' : 'Full-Day Circuit: Chefchaouen & Akchour Cascades'}
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-500">6.4 km total</span>
        </div>

        <div className="space-y-3 relative before:absolute before:left-3.5 rtl:before:right-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-100">
          {[
            {
              time: '08:30 AM',
              title: isAr ? 'فطور بلدي في ساحة وطاء الحمام' : 'Morning Tea at Outa el Hammam',
              desc: isAr ? 'بداية هادئة مع خبز تافنوت وجبن الماعز الجبلي' : 'Quiet start with fresh goat cheese & mint tea',
              type: 'Food',
            },
            {
              time: '10:00 AM',
              title: isAr ? 'جولة أزقة السويقة وممر رأس الماء' : 'Blue Alleys of Souika & Ras El Maa Spring',
              desc: isAr ? 'أفضل إضاءة تصوير وأقل أوقات الازدحام' : 'Best photography lighting and zero crowds',
              type: 'Sight',
            },
            {
              time: '01:30 PM',
              title: isAr ? 'نزهة وادي أقشور وقنطرة ربي' : 'Akchour River Trail & God\'s Bridge',
              desc: isAr ? 'طاجين في مجرى النهر ومياه عذبة نقية' : 'Riverfront tagine with natural limestone arch view',
              type: 'Nature',
            },
            {
              time: '06:45 PM',
              title: isAr ? 'غروب الشمس من المسجد الإسباني' : 'Sunset View at Spanish Mosque Hill',
              desc: isAr ? 'إطلالة بانورامية ساحرة على المدينة الزرقاء' : 'Panoramic twilight vista over the blue medina',
              type: 'Scenic',
            },
          ].map((step, idx) => (
            <div key={idx} className="flex items-start gap-4 pl-8 rtl:pl-0 rtl:pr-8 relative">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center absolute left-0 rtl:left-auto rtl:right-0 shadow-sm">
                {idx + 1}
              </div>
              <div className="flex-1 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs sm:text-sm">{step.title}</span>
                  <span className="text-[11px] font-mono text-slate-400">{step.time}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User's Saved Places List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            {isAr ? 'الأماكن التي قمت بحفظها' : 'Your Bookmarked Places'} ({savedPlaces.length})
          </h3>
        </div>

        {savedPlaces.length === 0 ? (
          <div className="p-8 rounded-3xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-600">
              {isAr ? 'لم تحفظ أي مكان بعد' : 'No saved places yet'}
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {isAr
                ? 'انقر على رمز القلب في أي بطاقة لحفظها هنا والوصول إليها بدون إنترنت.'
                : 'Tap the heart icon on any place card on the map or explore feed to save it for offline use.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {savedPlaces.map((place) => (
              <div
                key={place.id}
                className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3 justify-between"
              >
                <div
                  className="flex items-center gap-3 min-w-0 cursor-pointer"
                  onClick={() => onSelectPlace(place)}
                >
                  <img
                    src={place.photos[0]}
                    alt={place.name}
                    className="w-14 h-14 rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                      {isAr && place.arabicName ? place.arabicName : place.name}
                    </h4>
                    <span className="text-[11px] text-slate-400 block truncate">{place.area}</span>
                    <span className="text-[10px] text-blue-600 font-bold uppercase">{place.category}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onStartRoute(place)}
                    className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 transition"
                    title={t.startNavigation}
                  >
                    <Navigation className="w-4 h-4 fill-current" />
                  </button>
                  <button
                    onClick={() => onRemoveSaved(place.id)}
                    className="p-2 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

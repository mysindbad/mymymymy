import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  MapPin,
  Star,
  Navigation,
  Heart,
  Plus,
  Compass,
  Filter,
  TrendingUp,
  ShieldCheck,
  Building2,
  Landmark,
  Utensils,
  AlertTriangle,
  Tent,
  Radio
} from 'lucide-react';
import { Place, PlaceCategory } from '../types';
import { fetchPlaces, fetchAiMemoryInsights } from '../services/api';
import { SEED_PLACES } from '../data/mockData';
import { NorthernMoroccoBanner } from './NorthernMoroccoBanner';
import { SupportedLanguage, TRANSLATIONS } from '../data/translations';
import { formatPriceLevel } from '../data/currency';

interface ExploreFeedProps {
  onSelectPlace: (place: Place) => void;
  onStartRoute: (place: Place) => void;
  onOpenAddModal: () => void;
  onOpenPassiveModal: () => void;
  onOpenMapToRegion: (region: string) => void;
  savedPlaceIds: string[];
  onToggleSave: (id: string) => void;
  language?: SupportedLanguage;
  currency?: string;
}

export const ExploreFeed: React.FC<ExploreFeedProps> = ({
  onSelectPlace,
  onStartRoute,
  onOpenAddModal,
  onOpenPassiveModal,
  onOpenMapToRegion,
  savedPlaceIds,
  onToggleSave,
  language = 'en',
  currency = 'MAD',
}) => {
  const [places, setPlaces] = useState<Place[]>(SEED_PLACES);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'hidden_gems' | 'accommodations' | 'tourist' | 'emergency'>('all');
  const [insights, setInsights] = useState<any>(null);

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const isAr = language === 'ar';

  useEffect(() => {
    fetchPlaces().then((res) => {
      if (res && res.length > 0) setPlaces(res);
    });
    fetchAiMemoryInsights().then((data) => {
      if (data) setInsights(data);
    });
  }, []);

  const filteredPlaces = places.filter((p) => {
    if (selectedFilter === 'hidden_gems' && !p.isUnderDocumentedGem) return false;
    if (selectedFilter === 'accommodations' && p.category !== 'accommodation') return false;
    if (selectedFilter === 'tourist' && p.category !== 'tourist_poi') return false;
    if (selectedFilter === 'emergency' && p.category !== 'emergency') return false;
    if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in pb-24 select-none">
      {/* Feature 6: Northern Morocco Local Depth Focus Banner */}
      <NorthernMoroccoBanner
        onExploreRegion={() => onOpenMapToRegion('Northern Morocco')}
        language={language}
      />

      {/* Community Memory Engine Stats Card: Feature 1 */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Sparkles className="w-5 h-5 fill-current text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm">
                {isAr ? 'ذاكرة الأماكن الحية للمجتمع' : 'Community AI Place Memory'}
              </h3>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {isAr ? 'تتطور ذاتياً' : 'Self-Learning'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAr
                ? 'يتم تحديث المعالم ونقاط الإقامة تلقائياً عبر تقييماتكم ونقاط التتبع المجهولة.'
                : 'Places, riads & trails continuously enriched through traveler check-ins & anonymous traces.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={onOpenPassiveModal}
            className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1.5 transition"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>{isAr ? 'مشاركة الموقع' : 'Passive GPS'}</span>
          </button>

          <button
            onClick={onOpenAddModal}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>{isAr ? 'إضافة مكان' : 'Add Listing'}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs: Feature 2 (Distinct Accommodations vs Tourist POIs vs Hidden Gems) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-blue-600" />
            <span>{isAr ? 'استكشف وجهات مختارة وموثقة' : 'Curated Community Discoveries'}</span>
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            {filteredPlaces.length} {isAr ? 'مكان متاح' : 'Places Listed'}
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'all', label: isAr ? 'جميع الأماكن' : 'All Places' },
            { id: 'hidden_gems', label: isAr ? '✨ الجواهر المخفية' : '✨ Hidden Gems' },
            { id: 'accommodations', label: isAr ? '🛏️ رياض وإقامات' : '🛏️ Riads & Stays' },
            { id: 'tourist', label: isAr ? '🏛️ معالم ومزارات' : '🏛️ Sights & Trails' },
            { id: 'emergency', label: isAr ? '🚨 طوارئ وسلامة' : '🚨 Emergency Services' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedFilter(tab.id as any)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition border ${
                selectedFilter === tab.id
                  ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Place Cards Grid: Feature 1 & 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredPlaces.map((place) => {
          const isSaved = savedPlaceIds.includes(place.id);
          return (
            <div
              key={place.id}
              className="group bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-xs hover:shadow-md transition flex flex-col justify-between cursor-pointer"
              onClick={() => onSelectPlace(place)}
            >
              {/* Card Photo Header */}
              <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                <img
                  src={place.photos[0]}
                  alt={place.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* Top Badges */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase text-white shadow-xs backdrop-blur-md ${
                        place.category === 'accommodation'
                          ? 'bg-indigo-700/90'
                          : place.category === 'tourist_poi'
                          ? 'bg-emerald-700/90'
                          : place.category === 'emergency'
                          ? 'bg-rose-700/90'
                          : place.category === 'restaurant'
                          ? 'bg-amber-700/90'
                          : 'bg-green-800/90'
                      }`}
                    >
                      {place.category === 'accommodation'
                        ? '🛏️ Stay'
                        : place.category === 'tourist_poi'
                        ? '🏛️ Sights'
                        : place.category === 'emergency'
                        ? '🚨 Emergency'
                        : place.category === 'restaurant'
                        ? '🍽️ Food'
                        : '⛺ Campsite'}
                    </span>

                    {place.isUnderDocumentedGem && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-400 text-slate-950 flex items-center gap-0.5 shadow-xs">
                        <Sparkles className="w-2.5 h-2.5 fill-slate-950" />
                        <span>Hidden Gem</span>
                      </span>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSave(place.id);
                    }}
                    className={`p-2 rounded-full backdrop-blur-md transition ${
                      isSaved ? 'bg-rose-500 text-white' : 'bg-black/40 hover:bg-black/60 text-white'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {/* Bottom Photo Overlay Info */}
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-200">{place.area}</span>
                    <div className="flex items-center gap-1 text-amber-300 text-xs font-black">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>{place.rating.toFixed(1)}</span>
                      <span className="text-white/80 text-[10px] font-normal">({place.reviewCount})</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition">
                      {isAr && place.arabicName ? place.arabicName : place.name}
                    </h3>
                    <span className="text-xs font-bold text-slate-600 shrink-0">
                      {formatPriceLevel(place.priceLevel, currency)}
                    </span>
                  </div>

                  {/* Formation snippet (Feature 2) */}
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                    {place.formationInfo || place.description}
                  </p>
                </div>

                {/* Card Footer: Verified Owner tag & Navigate button */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                    {place.ownerVerified ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{isAr ? 'مالك موثق' : 'Verified Owner'}</span>
                      </span>
                    ) : (
                      <span className="text-blue-700 font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-blue-500" />
                        <span>{place.distanceKm || 1.2} km away</span>
                      </span>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartRoute(place);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition active:scale-95 shrink-0"
                  >
                    <Navigation className="w-3.5 h-3.5 fill-current" />
                    <span>{t.startNavigation}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

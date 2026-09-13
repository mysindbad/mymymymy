import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  MapPin,
  Star,
  Navigation,
  Heart,
  Plus,
  Compass,
  Search,
  Mic,
  X as ClearSearch,
  ShieldCheck,
  Radio
} from 'lucide-react';
import { Place } from '../types';
import { fetchPlaces } from '../services/api';
import { NorthernMoroccoBanner } from './NorthernMoroccoBanner';
import { SupportedLanguage, TRANSLATIONS } from '../data/translations';
import { formatPriceLevel } from '../data/currency';
import type { UserLocation } from '../hooks/useGeolocation';

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

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
  initialQuery?: string;
  userLocation?: UserLocation | null;
  isPassiveOptedIn?: boolean;
  onPassiveOptInChange?: (optedIn: boolean) => void;
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
  initialQuery = '',
  userLocation = null,
}) => {
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'hidden_gems' | 'accommodations' | 'tourist' | 'emergency'>('all');
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [nearestFirst, setNearestFirst] = useState(Boolean(userLocation));
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [isVoiceListening, setIsVoiceListening] = useState(false);

  useEffect(() => {
    setSearchQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (userLocation) setNearestFirst(true);
  }, [userLocation]);

  const loadExploreData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const nextPlaces = await fetchPlaces(userLocation ? { userLat: userLocation.latitude, userLng: userLocation.longitude } : undefined);
      setPlaces(nextPlaces);
    } catch (error) {
      setPlaces([]);
      setLoadError(error instanceof Error ? error.message : 'Failed to load places');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadExploreData();
  }, [userLocation?.latitude, userLocation?.longitude]);

  const filteredPlaces = useMemo(() => places.filter((p) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery = !query || [p.name, p.area, p.arabicName, p.description, p.formationInfo]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
    if (!matchesQuery) return false;
    if (selectedFilter === 'hidden_gems' && !p.isUnderDocumentedGem) return false;
    if (selectedFilter === 'accommodations' && p.category !== 'accommodation') return false;
    if (selectedFilter === 'tourist' && p.category !== 'tourist_poi') return false;
    if (selectedFilter === 'emergency' && p.category !== 'emergency') return false;
    return true;
  }), [places, searchQuery, selectedFilter]);

  const toggleVoiceSearch = () => {
    if (isVoiceListening) {
      recognitionRef.current?.stop();
      return;
    }
    const browserWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = isAr ? 'ar-MA' : isFr ? 'fr-FR' : 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) setSearchQuery(transcript);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsVoiceListening(false);
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      setIsVoiceListening(false);
    };
    recognitionRef.current = recognition;
    setIsVoiceListening(true);
    recognition.start();
  };

  const displayedPlaces = useMemo(() => {
    if (!nearestFirst || !userLocation) return filteredPlaces;
    return [...filteredPlaces].sort((a, b) => {
      const distanceA = typeof a.distanceKm === 'number' ? a.distanceKm : Number.POSITIVE_INFINITY;
      const distanceB = typeof b.distanceKm === 'number' ? b.distanceKm : Number.POSITIVE_INFINITY;
      return distanceA - distanceB;
    });
  }, [filteredPlaces, nearestFirst, userLocation]);

  const baselineLabel = isAr
    ? 'بيانات تأسيسية منسّقة'
    : isFr
      ? 'Base éditoriale'
      : 'Curated baseline';

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in pb-24 select-none">
      <NorthernMoroccoBanner
        onExploreRegion={() => onOpenMapToRegion('Northern Morocco')}
        language={language}
      />

      {isLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-xs font-bold text-slate-500">
          {isAr ? 'جاري تحميل الاستكشاف...' : 'Loading real discoveries...'}
        </div>
      )}
      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800">
          <span>{isAr ? 'تعذر تحميل بيانات الاستكشاف' : 'Could not load explore data'}</span>
          <button onClick={() => void loadExploreData()} className="rounded-lg bg-rose-600 px-3 py-1.5 text-white">
            {isAr ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Sparkles className="w-5 h-5 fill-current text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm">
                {isAr ? 'دليل الأماكن المحلي' : isFr ? 'Guide local' : 'Curated local guide'}
              </h3>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {isAr ? 'مختارات محلية' : isFr ? 'Sélection locale' : 'Local picks'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAr
                ? 'أماكن ومسارات مختارة لمساعدتك في التخطيط.'
                : isFr ? 'Des lieux et itinéraires choisis pour préparer votre voyage.' : 'Local places and routes selected for your next trip.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={onOpenPassiveModal}
            className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1.5 transition"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isAr ? 'مساهمة الموقع' : isFr ? 'Contribution GPS' : 'Location contribution'}</span>
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

      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-xs">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={isAr ? 'ابحث عن مدينة أو مكان...' : isFr ? 'Rechercher un lieu...' : 'Search cities and places...'}
          className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
          aria-label={isAr ? 'البحث عن مكان' : 'Search places'}
        />
        {searchQuery && (
          <button type="button" onClick={() => setSearchQuery('')} aria-label={isAr ? 'مسح البحث' : 'Clear search'} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <ClearSearch className="h-4 w-4" />
          </button>
        )}
        <button type="button" onClick={toggleVoiceSearch} aria-label={isAr ? 'البحث الصوتي' : 'Voice search'} aria-pressed={isVoiceListening} className={'rounded-lg p-1 transition ' + (isVoiceListening ? 'bg-rose-100 text-rose-600' : 'text-slate-400 hover:bg-slate-100 hover:text-blue-600')}>
          <Mic className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-blue-600" />
            <span>{isAr ? 'استكشف الأماكن المختارة' : isFr ? 'Découvertes sélectionnées' : 'Curated Discoveries'}</span>
          </h2>
          <span className="text-xs text-slate-400 font-medium shrink-0">
            {displayedPlaces.length} {isAr ? 'مكان متاح' : 'Places Listed'}
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
              onClick={() => setSelectedFilter(tab.id as typeof selectedFilter)}
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

        {userLocation && (
          <button
            type="button"
            onClick={() => setNearestFirst((current) => !current)}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-black transition ${
              nearestFirst
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            {nearestFirst ? (isAr ? 'عرض الأقرب أولاً: مفعّل' : 'Show nearest first: On') : (isAr ? 'عرض الأقرب أولاً: متوقف' : 'Show nearest first: Off')}
          </button>
        )}
      </div>

      {!isLoading && !loadError && displayedPlaces.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-bold text-slate-500">
          {searchQuery.trim() ? (
            <div className="flex items-center justify-center gap-3">
              <span>{isAr ? 'لا نتائج لـ «' + searchQuery.trim() + '»' : isFr ? 'Aucun résultat pour «' + searchQuery.trim() + '»' : 'No results for “' + searchQuery.trim() + '”'}</span>
              <button type="button" onClick={() => setSearchQuery('')} aria-label={isAr ? 'مسح البحث' : 'Clear search'} className="rounded-full bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200">
                <ClearSearch className="h-4 w-4" />
              </button>
            </div>
          ) : (isAr ? 'لا توجد أماكن متاحة حالياً.' : isFr ? 'Aucun lieu disponible pour le moment.' : 'No places are available right now.')}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {displayedPlaces.map((place) => {
          const isSaved = savedPlaceIds.includes(place.id);
          return (
            <div
              key={place.id}
              className="group bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-xs hover:shadow-md transition flex flex-col justify-between cursor-pointer"
              onClick={() => onSelectPlace(place)}
            >
              <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                <img
                  src={place.photos[0]}
                  alt={place.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

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

                    {place.seedData && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-sky-100/95 text-sky-900 border border-sky-200 shadow-xs">
                        {baselineLabel}
                      </span>
                    )}
                    {place.isUnderDocumentedGem && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-400 text-slate-950 flex items-center gap-0.5 shadow-xs">
                        <Sparkles className="w-2.5 h-2.5 fill-slate-950" />
                        <span>Hidden Gem</span>
                      </span>
                    )}
                    {typeof place.distanceKm === 'number' && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-white/90 text-blue-700 shadow-xs backdrop-blur-md">
                        {place.distanceKm >= 10 ? Math.round(place.distanceKm) : place.distanceKm.toFixed(1)} km
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

                  <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                    {place.formationInfo || place.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                    {place.ownerVerified ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{isAr ? 'مالك موثق' : isFr ? 'Propriétaire vérifié' : 'Verified owner'}</span>
                      </span>
                    ) : place.seedData ? (
                      <span className="text-sky-700 font-bold">{baselineLabel}</span>
                    ) : typeof place.distanceKm === 'number' ? (
                      <span className="text-blue-700 font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-blue-500" />
                        <span>{place.distanceKm >= 10 ? Math.round(place.distanceKm) : place.distanceKm.toFixed(1)} {isAr ? 'كم' : isFr ? 'km' : 'km away'}</span>
                      </span>
                    ) : null}
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
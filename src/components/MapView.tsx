import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Search,
  SlidersHorizontal,
  Navigation,
  Sparkles,
  Star,
  Crosshair,
  Building2,
  Landmark,
  Utensils,
  AlertTriangle,
  Tent,
  Plus,
  Radio,
  Layers,
  MapPin,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { Place, PlaceCategory, FilterSettings } from '../types';
import { fetchTracesSummary } from '../services/api';
import { SupportedLanguage, TRANSLATIONS } from '../data/translations';
import { formatPriceLevel } from '../data/currency';
import { AddPlaceModal } from './AddPlaceModal';
import { PassiveDataModal } from './PassiveDataModal';
import { RatePlaceModal } from './RatePlaceModal';

interface MapViewProps {
  places: Place[];
  onPlacesChange: React.Dispatch<React.SetStateAction<Place[]>>;
  onSelectPlace: (place: Place) => void;
  onStartRoute: (place: Place) => void;
  onOpenMultiStopPlanner: () => void;
  savedPlaceIds: string[];
  language?: SupportedLanguage;
  currency?: string;
  initialQuery?: string;
  initialCategory?: string;
  isPassiveOptedIn: boolean;
  onPassiveOptInChange: (optedIn: boolean) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  places,
  onPlacesChange,
  onSelectPlace,
  onStartRoute,
  onOpenMultiStopPlanner,
  savedPlaceIds,
  language = 'en',
  currency = 'MAD',
  initialQuery = '',
  initialCategory = 'All',
  isPassiveOptedIn,
  onPassiveOptInChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const tracesLayerRef = useRef<L.LayerGroup | null>(null);

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const isAr = language === 'ar';

  // State
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'All');
  const [selectedRegion, setSelectedRegion] = useState<string>('Northern Morocco');
  const [onlyHiddenGems, setOnlyHiddenGems] = useState<boolean>(false);
  const [showCrowdHeatmap, setShowCrowdHeatmap] = useState<boolean>(false);
  const [activeNearbyPlace, setActiveNearbyPlace] = useState<Place | null>(null);
  const [realTraces, setRealTraces] = useState<Array<{ coordinates: [number, number] }>>([]);
  const [tracesLoading, setTracesLoading] = useState(false);
  const [tracesError, setTracesError] = useState<string | null>(null);

  // Modals
  const [isAddPlaceOpen, setIsAddPlaceOpen] = useState(false);
  const [isPassiveDataOpen, setIsPassiveDataOpen] = useState(false);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [placeToRate, setPlaceToRate] = useState<Place | null>(null);

  useEffect(() => {
    setSearchQuery(initialQuery);
    setSelectedCategory(initialCategory || 'All');
  }, [initialQuery, initialCategory]);

  const visiblePlaces = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return places.filter((place) => {
      const matchesCategory = selectedCategory === 'All' || place.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!query) return true;
      return [place.name, place.area, place.arabicName, place.description, place.formationInfo]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [places, searchQuery, selectedCategory]);

  // Request location only after explicit passive GPS consent. There is no static user-location fallback.
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!isPassiveOptedIn || !navigator.geolocation) {
      setUserLocation(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setUserLocation([coords.latitude, coords.longitude]),
      () => setUserLocation(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, [isPassiveOptedIn]);

  useEffect(() => {
    if (!activeNearbyPlace || !visiblePlaces.some((place) => place.id === activeNearbyPlace.id)) {
      setActiveNearbyPlace(visiblePlaces[0] || null);
    }
  }, [visiblePlaces, activeNearbyPlace]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [35.175, -5.26],
        zoom: 12,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | Sindbad AI Map',
        maxZoom: 18,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      tracesLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 250);

    return () => clearTimeout(timer);
  }, []);

  // Update Region Center when region changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (selectedRegion === 'Northern Morocco') {
      mapInstanceRef.current.flyTo([35.175, -5.26], 12);
    } else if (selectedRegion === 'Marrakech') {
      mapInstanceRef.current.flyTo([31.625, -7.99], 13);
    } else if (selectedRegion === 'Santorini') {
      mapInstanceRef.current.flyTo([36.435, 25.41], 12);
    }
  }, [selectedRegion]);

  // Marker Styling Helper: FEATURE 2 (Visually distinguish categories of points)
  const getMarkerBadgeStyle = (category: PlaceCategory, isSelected: boolean) => {
    let bg = 'bg-blue-600';
    let iconChar = '📍';
    let border = 'border-blue-700';

    switch (category) {
      case 'accommodation':
        // Accommodation: Deep Indigo / Royal Purple Bed Marker
        bg = 'bg-gradient-to-r from-indigo-700 to-violet-800 text-white';
        border = 'border-indigo-900';
        iconChar = '🛏️';
        break;
      case 'tourist_poi':
        // Tourist & POI: Vibrant Emerald Landmark Marker
        bg = 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white';
        border = 'border-emerald-800';
        iconChar = '🏛️';
        break;
      case 'restaurant':
        // Food: Warm Amber / Terracotta Dining Marker
        bg = 'bg-gradient-to-r from-amber-600 to-orange-600 text-white';
        border = 'border-amber-700';
        iconChar = '🍽️';
        break;
      case 'emergency':
        // Emergency & Safety: High-Visibility Crimson Red Marker
        bg = 'bg-gradient-to-r from-rose-600 to-red-700 text-white';
        border = 'border-rose-800';
        iconChar = '🚨';
        break;
      case 'campsite':
        // Campsite / Outdoors: Forest Pine Green Marker
        bg = 'bg-gradient-to-r from-lime-700 to-green-800 text-white';
        border = 'border-green-900';
        iconChar = '⛺';
        break;
      default:
        bg = 'bg-blue-600 text-white';
        border = 'border-blue-700';
        iconChar = '📍';
    }

    return { bg, border, iconChar };
  };

  // Render Markers and Heatmap Traces
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Clear and re-render crowd heatmap traces if enabled
    if (tracesLayerRef.current) {
      tracesLayerRef.current.clearLayers();
      if (showCrowdHeatmap) {
        const coordinates = realTraces.map((trace) => trace.coordinates);
        if (coordinates.length > 1) {
          tracesLayerRef.current.addLayer(
            L.polyline(coordinates, { color: '#38bdf8', weight: 4, opacity: 0.75 })
              .bindTooltip(isAr ? 'مسارات حقيقية من المجتمع' : 'Real community traces', { sticky: true })
          );
        }
        coordinates.forEach((coordinate) => {
          tracesLayerRef.current?.addLayer(
            L.circleMarker(coordinate, {
              radius: 4,
              color: '#10b981',
              fillColor: '#10b981',
              fillOpacity: 0.8,
            })
          );
        });
      }
    }

    // Add a user marker only when the browser provided a real position.
    if (userLocation) {
      const userMarkerHtml = `
      <div class="relative flex items-center justify-center">
        <div class="w-7 h-7 rounded-full bg-blue-500/30 pulse-location absolute"></div>
        <div class="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-lg relative z-10 flex items-center justify-center text-[8px] text-white font-bold">▲</div>
      </div>
    `;
    const userIcon = L.divIcon({
      html: userMarkerHtml,
      className: 'custom-user-marker',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const userMarker = L.marker(userLocation, { icon: userIcon }).addTo(map);
      userMarker.bindTooltip(isAr ? 'موقعك الحالي' : 'Your Current Location', { direction: 'top' });
      markersRef.current.push(userMarker);
    }

    // Add Markers with Visual Distinction (Feature 2)
    visiblePlaces.forEach((place) => {
      const isSelected = activeNearbyPlace?.id === place.id;
      const { bg, border, iconChar } = getMarkerBadgeStyle(place.category, isSelected);

      const markerHtml = `
        <div class="flex flex-col items-center group cursor-pointer transition-transform duration-200 hover:scale-115 ${
          isSelected ? 'scale-115 z-30' : 'z-10'
        }">
          <div class="px-2.5 py-1 rounded-full shadow-lg text-[11px] font-extrabold flex items-center gap-1.5 border ${border} ${bg} ${
        isSelected ? 'ring-3 ring-amber-400' : ''
      }">
            <span>${iconChar}</span>
            <span>${place.name.slice(0, 18)}</span>
            <span class="text-amber-300 text-[10px] font-bold">★${place.rating.toFixed(1)}</span>
            ${place.isUnderDocumentedGem ? '<span class="text-[9px] bg-amber-400 text-slate-950 font-black px-1 rounded-xs">GEM</span>' : ''}
          </div>
          <div class="w-2.5 h-2.5 ${bg.split(' ')[0]} rotate-45 -mt-1 border-r border-b ${border}"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-map-pin',
        iconSize: [120, 36],
        iconAnchor: [60, 36],
      });

      const marker = L.marker(place.coordinates, { icon: customIcon }).addTo(map);

      marker.on('click', () => {
        setActiveNearbyPlace(place);
        map.panTo(place.coordinates, { animate: true });
      });

      markersRef.current.push(marker);
    });
  }, [visiblePlaces, activeNearbyPlace, userLocation, showCrowdHeatmap, realTraces, isAr]);

  const handleToggleTraces = async () => {
    if (showCrowdHeatmap) {
      setShowCrowdHeatmap(false);
      return;
    }
    setTracesLoading(true);
    setTracesError(null);
    try {
      const summary = await fetchTracesSummary();
      setRealTraces(summary.recent.map((trace) => ({ coordinates: trace.coordinates })));
      setShowCrowdHeatmap(true);
    } catch (error) {
      setTracesError(error instanceof Error ? error.message : 'Failed to load traces');
    } finally {
      setTracesLoading(false);
    }
  };

  const handleRecenter = () => {
    if (mapInstanceRef.current && userLocation) {
      mapInstanceRef.current.flyTo(userLocation, 13, { duration: 1.2 });
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-115px)] overflow-hidden flex flex-col select-none">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-slate-900" />

      {/* Top Floating Controls Bar */}
      <div className="absolute top-3 left-3 right-3 z-30 flex flex-col gap-2 max-w-xl mx-auto">
        {/* Search Bar + Region Dropdown */}
        <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/90 px-3.5 py-2">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.mapSearchPlaceholder}
            className="w-full bg-transparent text-xs sm:text-sm text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium"
          />

          {/* Region Switcher: Feature 6 */}
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="px-2 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold outline-none cursor-pointer shrink-0"
          >
            <option value="Northern Morocco">🇲🇦 Northern Morocco</option>
            <option value="Marrakech">🇲🇦 Marrakech</option>
            <option value="Santorini">🇬🇷 Santorini</option>
            <option value="All">🌍 All Regions</option>
          </select>

          {/* Add Business / Place Button (Feature 4) */}
          <button
            id="map-add-place-btn"
            onClick={() => setIsAddPlaceOpen(true)}
            className="p-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition active:scale-95 shrink-0"
            title={t.addListing}
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span className="hidden sm:inline">{isAr ? 'إضافة مكان' : 'Add Place'}</span>
          </button>
        </div>

        {/* Filter Categories Pills with Marker Legend Visuals (Feature 2) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {[
            { key: 'All', label: isAr ? 'الكل' : 'All', icon: '📍' },
            { key: 'accommodation', label: isAr ? '🛏️ إقامة ورياض' : '🛏️ Riads & Stays', badgeColor: 'bg-indigo-600 text-white' },
            { key: 'tourist_poi', label: isAr ? '🏛️ معالم وسياحة' : '🏛️ Sights & POIs', badgeColor: 'bg-emerald-600 text-white' },
            { key: 'restaurant', label: isAr ? '🍽️ مطاعم ومقاهي' : '🍽️ Dining & Food', badgeColor: 'bg-amber-600 text-white' },
            { key: 'emergency', label: isAr ? '🚨 طوارئ وأمن' : '🚨 Emergency & Police', badgeColor: 'bg-rose-600 text-white' },
            { key: 'campsite', label: isAr ? '⛺ مخيمات' : '⛺ Campsites', badgeColor: 'bg-green-700 text-white' },
          ].map((item) => {
            const isSelected = selectedCategory === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setSelectedCategory(item.key)}
                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap shadow-sm backdrop-blur-md transition border ${
                  isSelected
                    ? 'bg-slate-900 border-slate-900 text-white ring-2 ring-blue-500'
                    : 'bg-white/95 border-slate-200/90 text-slate-700 hover:bg-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}

          {/* Hidden Gems Toggle Button (Feature 1 & 6) */}
          <button
            onClick={() => setOnlyHiddenGems(!onlyHiddenGems)}
            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap shadow-sm backdrop-blur-md transition border flex items-center gap-1 shrink-0 ${
              onlyHiddenGems
                ? 'bg-amber-500 border-amber-600 text-slate-950 font-black ring-2 ring-amber-300'
                : 'bg-white/90 border-slate-200 text-slate-700 hover:bg-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            <span>{isAr ? 'الجواهر المخفية فقط' : 'Hidden Gems'}</span>
          </button>
        </div>
      </div>

      {/* Floating Side Tools: Recenter, Heatmap Toggle, Passive GPS Status */}
      <div className="absolute right-3 rtl:right-auto rtl:left-3 top-28 z-30 flex flex-col gap-2">
        <button
          onClick={handleRecenter}
          disabled={!userLocation}
          className="w-10 h-10 rounded-2xl bg-white shadow-lg border border-slate-200 flex items-center justify-center text-slate-700 hover:text-blue-600 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Recenter Map"
        >
          <Crosshair className="w-5 h-5" />
        </button>

        {/* Heatmap Trail Toggle */}
        <button
            onClick={() => void handleToggleTraces()}
          className={`w-10 h-10 rounded-2xl shadow-lg border flex items-center justify-center transition active:scale-95 ${
            showCrowdHeatmap
              ? 'bg-emerald-600 border-emerald-700 text-white shadow-emerald-500/25'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
          title={isAr ? 'عرض مسارات المجتمع الحية' : 'Toggle Crowdsourced GPS Trails'}
        >
          <Layers className={`w-5 h-5 ${tracesLoading ? 'animate-pulse' : ''}`} />
        </button>
        {tracesError && (
          <div className="max-w-[180px] rounded-xl bg-rose-50 px-2.5 py-2 text-[10px] font-bold text-rose-700 shadow-lg">
            {isAr ? 'تعذر تحميل المسارات الحقيقية' : 'Could not load real traces'}
          </div>
        )}

        {/* Passive GPS Opt-in Status Indicator (Feature 4) */}
        <button
          onClick={() => setIsPassiveDataOpen(true)}
          className="w-10 h-10 rounded-2xl bg-white shadow-lg border border-slate-200 flex items-center justify-center text-slate-700 hover:text-emerald-600 transition active:scale-95 relative"
          title={isAr ? 'مشاركة الموقع غير المباشرة' : 'Passive GPS Sharing Status'}
        >
          <Radio className={`w-5 h-5 ${isPassiveOptedIn ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
          {isPassiveOptedIn && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white" />
          )}
        </button>
      </div>

      {/* Underserved Region Depth Banner (Feature 6) */}
      <div className="absolute top-28 left-3 rtl:left-auto rtl:right-3 z-30 max-w-[210px] hidden sm:block">
        <div className="p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white shadow-lg space-y-1">
          <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
            <ShieldCheck className="w-3 h-3" />
            <span>{isAr ? 'عمق محلي فائق' : 'Deep Local Coverage'}</span>
          </div>
          <p className="text-[10px] text-slate-300 leading-tight">
            {isAr
              ? 'مناطق شمال المغرب (شفشاون، أقشور، الريف) مدعومة ببيانات مسارات متجددة.'
              : 'Northern Morocco (Chefchaouen, Akchour, Rif trails) enriched with live community data.'}
          </p>
        </div>
      </div>

      {/* Bottom Floating Info Card for Tapped Point: FEATURE 2 */}
      {activeNearbyPlace && (
        <div className="absolute bottom-3 left-3 right-3 z-30 max-w-xl mx-auto">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-3.5 shadow-2xl border border-slate-200/90 flex gap-3.5 items-center animate-in slide-in-from-bottom-4">
            <div className="relative w-22 h-22 rounded-2xl overflow-hidden shrink-0 bg-slate-100 cursor-pointer" onClick={() => onSelectPlace(activeNearbyPlace)}>
              <img
                src={activeNearbyPlace.photos[0]}
                alt={activeNearbyPlace.name}
                className="w-full h-full object-cover hover:scale-105 transition duration-300"
              />
              <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase text-white backdrop-blur-md bg-black/60">
                {activeNearbyPlace.category === 'accommodation'
                  ? 'Stay'
                  : activeNearbyPlace.category === 'tourist_poi'
                  ? 'Sights'
                  : activeNearbyPlace.category === 'emergency'
                  ? 'Safety'
                  : activeNearbyPlace.category === 'restaurant'
                  ? 'Food'
                  : 'Camp'}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {activeNearbyPlace.subCategory || activeNearbyPlace.category}
                </span>
                {activeNearbyPlace.isUnderDocumentedGem && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                    <span>{isAr ? 'جوهرة مخفية' : 'Hidden Gem'}</span>
                  </span>
                )}
                {activeNearbyPlace.ownerVerified && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                    ✓ {isAr ? 'مالك موثق' : 'Verified Owner'}
                  </span>
                )}
              </div>

              <h3
                onClick={() => onSelectPlace(activeNearbyPlace)}
                className="text-sm sm:text-base font-bold text-slate-900 truncate mt-0.5 cursor-pointer hover:text-blue-600 transition"
              >
                {isAr && activeNearbyPlace.arabicName ? activeNearbyPlace.arabicName : activeNearbyPlace.name}
              </h3>

              {/* Formation / History brief snippet (Feature 2) */}
              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                {activeNearbyPlace.formationInfo || activeNearbyPlace.description}
              </p>

              {/* Rating and Distance */}
              <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                <div className="flex items-center text-amber-500 font-bold">
                  <Star className="w-3.5 h-3.5 fill-current mr-0.5 rtl:mr-0 rtl:ml-0.5" />
                  <span>{activeNearbyPlace.rating.toFixed(1)}</span>
                  <span className="text-slate-400 font-normal ml-0.5">({activeNearbyPlace.reviewCount})</span>
                </div>
                <span>•</span>
                <span className="font-semibold text-slate-700">{formatPriceLevel(activeNearbyPlace.priceLevel, currency)}</span>
                <span>•</span>
                <span className="text-blue-600 font-medium">{activeNearbyPlace.distanceKm || 1.2} km</span>
              </div>
            </div>

            {/* Action Buttons: Navigate + Rate */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                id="map-navigate-active-btn"
                onClick={() => onStartRoute(activeNearbyPlace)}
                className="p-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 flex items-center justify-center transition active:scale-95"
                title={t.startNavigation}
              >
                <Navigation className="w-4 h-4 fill-current" />
              </button>

              <button
                onClick={() => {
                  setPlaceToRate(activeNearbyPlace);
                  setIsRateModalOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-bold transition text-center"
              >
                {t.ratePlace}
              </button>
            </div>
          </div>
        </div>
      )}
      {places.length === 0 && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="rounded-2xl bg-white/95 px-5 py-4 text-center text-xs font-bold text-slate-600 shadow-xl border border-slate-200">
            {isAr ? 'لا توجد أماكن متاحة بهذه الفلاتر' : 'No places match these filters'}
          </div>
        </div>
      )}

      {/* Add Place / Business Listing Modal (Feature 4) */}
      <AddPlaceModal
        isOpen={isAddPlaceOpen}
        onClose={() => setIsAddPlaceOpen(false)}
        onPlaceAdded={(newP) => {
          onPlacesChange((prev) => [newP, ...prev]);
          setActiveNearbyPlace(newP);
        }}
        initialCoordinates={userLocation || undefined}
        language={language}
      />

      {/* Passive Location Contribution Modal (Feature 4) */}
      <PassiveDataModal
        isOpen={isPassiveDataOpen}
        onClose={() => setIsPassiveDataOpen(false)}
        isOptedIn={isPassiveOptedIn}
        onToggleOptIn={onPassiveOptInChange}
        language={language}
      />

      {/* Rate & Review Modal (Feature 4) */}
      <RatePlaceModal
        isOpen={isRateModalOpen}
        onClose={() => {
          setIsRateModalOpen(false);
          setPlaceToRate(null);
        }}
        place={placeToRate}
        onReviewSuccess={(updated) => {
          onPlacesChange((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          setActiveNearbyPlace(updated);
        }}
        onUserEarnedXp={() => {}}
        language={language}
      />
    </div>
  );
};

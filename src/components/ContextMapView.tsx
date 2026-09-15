import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, Search } from 'lucide-react';
import { Place } from '../types';
import { SupportedLanguage } from '../data/translations';
import type { UserLocation } from '../hooks/useGeolocation';

interface ContextMapViewProps {
  places: Place[];
  onSelectPlace: (place: Place) => void;
  onStartRoute: (place: Place) => void;
  language?: SupportedLanguage;
  initialQuery?: string;
  initialCategory?: string;
  userLocation?: UserLocation | null;
}

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const CARTO_LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const CARTO_DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

function tileAttribution(provider: 'osm' | 'carto') {
  return provider === 'carto'
    ? '&copy; OpenStreetMap contributors &copy; CARTO'
    : '&copy; OpenStreetMap contributors';
}

export const ContextMapView: React.FC<ContextMapViewProps> = ({
  places,
  onSelectPlace,
  onStartRoute,
  language = 'en',
  initialQuery = '',
  initialCategory = 'All',
  userLocation = null,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const tileThemeRef = useRef<'light' | 'dark' | null>(null);
  const tileGenerationRef = useRef(0);
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory || 'All');
  const [activePlace, setActivePlace] = useState<Place | null>(null);
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const t = (en: string, ar: string, fr: string) => isAr ? ar : isFr ? fr : en;

  useEffect(() => {
    setQuery(initialQuery);
    setCategory(initialCategory || 'All');
  }, [initialQuery, initialCategory]);

  const visiblePlaces = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return places.filter((place) => {
      if (category !== 'All' && place.category !== category) return false;
      if (!term) return true;
      return [place.name, place.arabicName, place.frenchName, place.area, place.region]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(term));
    });
  }, [places, query, category]);

  const installTileLayer = (map: L.Map, theme: 'light' | 'dark', fallback = false) => {
    tileGenerationRef.current += 1;
    const generation = tileGenerationRef.current;
    tileLayerRef.current?.remove();

    const useCarto = theme === 'dark' ? !fallback : fallback;
    const url = useCarto ? (theme === 'dark' ? CARTO_DARK_TILES : CARTO_LIGHT_TILES) : OSM_TILES;
    let errorCount = 0;
    const layer = L.tileLayer(url, {
      attribution: tileAttribution(useCarto ? 'carto' : 'osm'),
      maxZoom: 19,
      crossOrigin: true,
      keepBuffer: 4,
      updateWhenIdle: false,
      className: theme === 'dark' && fallback ? 'sindbad-dark-osm-tile' : 'sindbad-map-tile',
    });
    layer.on('tileerror', () => {
      errorCount += 1;
      if (generation !== tileGenerationRef.current || fallback || errorCount < 3) return;
      installTileLayer(map, theme, true);
    });
    layer.addTo(map);
    tileLayerRef.current = layer;
    tileThemeRef.current = theme;
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [31.7917, -7.0926],
      zoom: 6,
      zoomControl: false,
    });
    const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    installTileLayer(map, theme);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const timer = window.setTimeout(() => map.invalidateSize(), 150);

    const observer = new MutationObserver(() => {
      const nextTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      if (nextTheme !== tileThemeRef.current) installTileLayer(map, nextTheme);
      window.setTimeout(() => map.invalidateSize(), 50);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      tileGenerationRef.current += 1;
      tileLayerRef.current = null;
      markerLayerRef.current = null;
      userMarkerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    if (!userLocation) return;
    const marker = L.circleMarker([userLocation.latitude, userLocation.longitude], {
      radius: 8,
      color: '#ffffff',
      weight: 3,
      fillColor: '#2563eb',
      fillOpacity: 1,
    }).addTo(map) as unknown as L.Marker;
    marker.bindTooltip(t('Your location', 'موقعك', 'Votre position'));
    userMarkerRef.current = marker;
    map.flyTo([userLocation.latitude, userLocation.longitude], 12, { duration: 0.8 });
  }, [userLocation?.latitude, userLocation?.longitude, language]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];
    visiblePlaces.forEach((place) => {
      bounds.push(place.coordinates);
      const marker = L.marker(place.coordinates).addTo(layer);
      marker.bindTooltip(isAr && place.arabicName ? place.arabicName : place.name);
      marker.on('click', () => {
        setActivePlace(place);
        map.panTo(place.coordinates, { animate: true });
      });
    });
    if (!userLocation && bounds.length > 0) {
      if (bounds.length === 1) map.flyTo(bounds[0], 13, { duration: 0.6 });
      else map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 13 });
    }
    if (activePlace && !visiblePlaces.some((place) => place.id === activePlace.id)) setActivePlace(null);
    window.setTimeout(() => map.invalidateSize(), 50);
  }, [visiblePlaces, userLocation?.latitude, userLocation?.longitude]);

  const categories = useMemo(() => Array.from(new Set(places.map((place) => place.category))), [places]);

  return (
    <div className="relative h-[calc(100vh-118px)] w-full overflow-hidden" dir={isAr ? 'rtl' : 'ltr'}>
      <div ref={mapContainerRef} className="h-full w-full bg-slate-200" data-map-tile-fallback="enabled" />
      <div className="absolute inset-x-3 top-3 z-[500] mx-auto flex max-w-xl gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
        <Search className="ms-1 mt-2 h-4 w-4 shrink-0 text-slate-400" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Search map', 'ابحث في الخريطة', 'Rechercher sur la carte')} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="max-w-32 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none">
          <option value="All">{t('All', 'الكل', 'Tous')}</option>
          {categories.map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
        </select>
      </div>

      {!userLocation && places.length === 0 && (
        <div className="absolute inset-x-4 top-24 z-[500] mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white/95 p-4 text-center text-sm font-bold text-slate-600 shadow-lg">
          <MapPin className="mx-auto mb-2 h-5 w-5 text-blue-600" />
          {t('Share your location or search for a destination first.', 'شارك موقعك أو ابحث عن وجهة أولاً.', 'Partagez votre localisation ou recherchez d’abord une destination.')}
        </div>
      )}

      {activePlace && (
        <div className="absolute inset-x-3 bottom-5 z-[500] mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3"><button type="button" onClick={() => onSelectPlace(activePlace)} className="min-w-0 flex-1 text-start"><strong className="block truncate text-slate-900">{isAr && activePlace.arabicName ? activePlace.arabicName : activePlace.name}</strong><span className="mt-1 block truncate text-xs text-slate-500">{activePlace.area} · {activePlace.region}</span></button><button type="button" onClick={() => onStartRoute(activePlace)} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white"><Navigation className="h-4 w-4" />{t('Go', 'اذهب', 'Aller')}</button></div>
        </div>
      )}
    </div>
  );
};

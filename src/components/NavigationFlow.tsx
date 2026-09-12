import React, { useState, useEffect } from 'react';
import L from 'leaflet';
import confetti from 'canvas-confetti';
import {
  Navigation,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  MapPin,
  Car,
  Footprints,
  Bus,
  Volume2,
  VolumeX,
  Camera,
  Heart,
  Share2,
  AlertTriangle,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { Place, TravelMode, NavigationStep, NavigationRouteData } from '../types';
import { fetchNavigationGuidance, submitPlaceCheckIn } from '../services/api';
import { MascotSindbad } from './MascotSindbad';
import { SupportedLanguage, TRANSLATIONS } from '../data/translations';

interface NavigationFlowProps {
  destination: Place;
  onClose: () => void;
  onArrivedExplore: (place: Place) => void;
  onSavePlace: (placeId: string) => void;
  isSaved?: boolean;
  language?: SupportedLanguage;
}

type NavStepState = 'route_selection' | 'active_nav' | 'arrived';

export const NavigationFlow: React.FC<NavigationFlowProps> = ({
  destination,
  onClose,
  onArrivedExplore,
  onSavePlace,
  isSaved = false,
  language = 'en',
}) => {
  const [navState, setNavState] = useState<NavStepState>('route_selection');
  const [travelMode, setTravelMode] = useState<TravelMode>('driving');
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<NavigationRouteData | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [speed, setSpeed] = useState<number | null>(null);
  const [showTurnList, setShowTurnList] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState<string | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number]>([35.1695, -5.2625]);
  const routeMapRef = React.useRef<HTMLDivElement | null>(null);
  const routeMapInstanceRef = React.useRef<L.Map | null>(null);
  const routePolylineRef = React.useRef<L.Polyline | null>(null);

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const isAr = language === 'ar';

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation([coords.latitude, coords.longitude]);
        setSpeed(coords.speed === null ? null : Math.round(coords.speed * 3.6));
      },
      () => setUserLocation([35.1695, -5.2625]),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, []);

  // Load the route from the backend using the current browser location.
  const loadRoute = async (mode: TravelMode) => {
    setIsLoadingRoute(true);
    setRouteError(null);
    setRouteData(null);
    try {
      const data = await fetchNavigationGuidance(destination.id, mode, language, userLocation[0], userLocation[1]);
      setRouteData(data);
    } catch (err) {
      setRouteData(null);
      setRouteError(isAr ? 'خدمة الملاحة غير متاحة مؤقتاً' : 'Navigation service temporarily unavailable');
    } finally {
      setIsLoadingRoute(false);
    }
  };

  useEffect(() => {
    void loadRoute(travelMode);
  }, [destination, travelMode, language, userLocation]);

  useEffect(() => {
    const geometry = (routeData as NavigationRouteData & {
      geometry?: { coordinates?: Array<[number, number]> };
    } | null)?.geometry;
    const coordinates = geometry?.coordinates;
    if (!routeMapRef.current || !coordinates?.length) return;

    if (!routeMapInstanceRef.current) {
      routeMapInstanceRef.current = L.map(routeMapRef.current, { zoomControl: false }).setView(coordinates[0].slice().reverse() as [number, number], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(routeMapInstanceRef.current);
      L.control.zoom({ position: 'bottomright' }).addTo(routeMapInstanceRef.current);
    }

    routePolylineRef.current?.remove();
    const leafletCoordinates = coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number]);
    routePolylineRef.current = L.polyline(leafletCoordinates, { color: '#3b82f6', weight: 6, opacity: 0.9 }).addTo(routeMapInstanceRef.current);
    routeMapInstanceRef.current.fitBounds(routePolylineRef.current.getBounds(), { padding: [24, 24] });
    routeMapInstanceRef.current.invalidateSize();
  }, [routeData, navState]);

  useEffect(() => {
    return () => {
      routePolylineRef.current?.remove();
      routeMapInstanceRef.current?.remove();
      routeMapInstanceRef.current = null;
    };
  }, []);

  // Voice Guidance with Web Speech API
  const speakInstruction = (text: string) => {
    if (!isVoiceEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (language === 'ar') utterance.lang = 'ar-SA';
      else if (language === 'fr') utterance.lang = 'fr-FR';
      else utterance.lang = 'en-US';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // safe fallback
    }
  };

  const steps = routeData?.steps || [];
  const currentStep = steps[currentStepIndex] || steps[0];

  useEffect(() => {
    if (navState === 'active_nav' && currentStep) speakInstruction(currentStep.instruction);
  }, [navState, currentStep]);

  const handleStartNav = () => {
    setNavState('active_nav');
    setCurrentStepIndex(0);
  };

  const handleAdvanceStep = () => {
    if (currentStepIndex < steps.length - 1) {
      const next = currentStepIndex + 1;
      setCurrentStepIndex(next);
      speakInstruction(steps[next].instruction);
      return;
    }
    setNavState('arrived');
    try {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } catch {
      // safe fallback
    }
  };

  const handleCheckIn = async () => {
    setIsCheckedIn(true);
    await submitPlaceCheckIn(destination.id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col text-white animate-in fade-in select-none">
      {/* 1. ROUTE SELECTION SCREEN */}
      {navState === 'route_selection' && (
        <div className="flex-1 flex flex-col justify-between max-w-xl mx-auto w-full p-4 sm:p-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition"
              >
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
              </button>
              <div>
                <h1 className="text-lg font-bold">{t.routePreview}</h1>
                <p className="text-xs text-slate-400 truncate max-w-[220px]">{destination.name}</p>
              </div>
            </div>
            <MascotSindbad size="sm" mood="navigating" />
          </div>

          {/* Destination Preview Card */}
          <div className="my-4 p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-4 shadow-xl">
            <img
              src={destination.photos[0]}
              alt={destination.name}
              className="w-20 h-20 rounded-2xl object-cover shrink-0"
            />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase text-blue-400 px-2 py-0.5 rounded-full bg-blue-950/80 border border-blue-800">
                {destination.subCategory || destination.category}
              </span>
              <h2 className="text-base font-bold text-white truncate mt-1">
                {isAr && destination.arabicName ? destination.arabicName : destination.name}
              </h2>
              <p className="text-xs text-slate-400 truncate mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{destination.address}</span>
              </p>
            </div>
          </div>

          {/* Travel Mode Selector: FEATURE 3 (Walking or Driving Tailoring) */}
          <div className="mb-4">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
              {t.travelMode}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { mode: 'driving' as const, label: t.modes.driving, icon: Car },
                { mode: 'walking' as const, label: t.modes.walking, icon: Footprints },
                { mode: 'transit' as const, label: t.modes.transit, icon: Bus },
                { mode: 'taxi' as const, label: t.modes.taxi, icon: Car },
              ].map((item) => {
                const isSelected = travelMode === item.mode;
                const Icon = item.icon;
                return (
                  <button
                    key={item.mode}
                    onClick={() => setTravelMode(item.mode)}
                    className={`p-2.5 rounded-2xl border flex flex-col items-center gap-1 transition ${
                      isSelected
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-500 text-white font-bold shadow-lg shadow-blue-500/25'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px] whitespace-nowrap">{item.label}</span>
                    <span className="text-[10px] text-slate-300 font-normal">
                       {isSelected && routeData?.travelMode === item.mode
                         ? (isAr ? `${routeData.durationMinutes} دقيقة` : `${routeData.durationMinutes} min`)
                         : '—'}
                     </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Tailored Route Summary Card */}
          {isLoadingRoute ? (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center gap-2 text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span>{isAr ? 'جاري حساب المسار الحقيقي...' : 'Calculating real route...'}</span>
            </div>
          ) : routeError ? (
            <div className="p-5 rounded-2xl bg-rose-950/60 border border-rose-800 flex items-center justify-between gap-3 text-xs text-rose-200">
              <span>{routeError}</span>
              <button onClick={() => void loadRoute(travelMode)} className="rounded-lg bg-rose-600 px-3 py-1.5 font-bold text-white">
                {isAr ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </div>
          ) : routeData ? (
            <div className="mb-4 p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-black text-white">{routeData.durationMinutes} min</span>
                  <span className="text-xs text-slate-400 ml-2">({routeData.totalDistanceKm} km)</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/40">
                  {routeData.trafficCondition}
                </span>
              </div>

              {/* AI Guidance Advisory */}
              <div className="p-3 rounded-2xl bg-blue-950/60 border border-blue-800/60 flex items-start gap-2.5 text-xs text-blue-200">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{routeData.aiSummary}</p>
              </div>

              {/* Offline Map Status */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{isAr ? 'تم استلام هندسة المسار من خدمة الملاحة' : 'Route geometry received from the navigation service'}</span>
                </span>
                <span className="text-[11px] font-bold text-emerald-400">LIVE</span>
              </div>
            </div>
          ) : null}

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              id="start-turn-by-turn-btn"
              onClick={handleStartNav}
              disabled={isLoadingRoute}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white font-bold text-base shadow-xl shadow-blue-500/30 flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-50"
            >
              <Navigation className="w-5 h-5 fill-current" />
              <span>{t.startNavigation}</span>
              <ArrowRight className="w-5 h-5 ml-1 rtl:rotate-180" />
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs font-semibold transition"
            >
              {t.closeNav}
            </button>
          </div>
        </div>
      )}

      {/* 2. ACTIVE REAL-TIME NAVIGATION SCREEN (Feature 3) */}
      {navState === 'active_nav' && (
        <div className="relative flex-1 flex flex-col">
          {/* Giant Directional Prompt Banner */}
          <div className="z-30 p-4 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 shadow-2xl border-b border-emerald-600">
            <div className="max-w-xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-13 h-13 rounded-2xl bg-emerald-900/90 flex items-center justify-center text-white shrink-0 border border-emerald-400/40 shadow-inner">
                  {currentStep.iconType === 'right' && <ArrowRight className="w-8 h-8 rtl:rotate-180" />}
                  {currentStep.iconType === 'left' && <ArrowLeft className="w-8 h-8 rtl:rotate-180" />}
                  {currentStep.iconType === 'straight' && <ArrowUp className="w-8 h-8" />}
                  {currentStep.iconType === 'arrive' && <MapPin className="w-8 h-8 text-amber-300" />}
                </div>
                <div>
                  <div className="text-xs text-emerald-200 font-bold tracking-wide">
                    {t.inMeters} {currentStep.distanceMeters}m
                  </div>
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-white leading-snug">
                    {currentStep.instruction}
                  </h2>
                  <span className="text-xs text-emerald-200/90 font-medium">{currentStep.roadName}</span>
                </div>
              </div>

              {/* Voice toggle */}
              <button
                onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                className="p-3 rounded-full bg-emerald-900/80 hover:bg-emerald-900 text-white transition shrink-0 shadow-xs"
                title={isVoiceEnabled ? 'Mute' : 'Unmute Voice'}
              >
                {isVoiceEnabled ? <Volume2 className="w-5 h-5 text-white" /> : <VolumeX className="w-5 h-5 text-emerald-300" />}
              </button>
            </div>

            {/* AI Real-time Tailored Condition Advisory (Feature 3 requirement) */}
            {currentStep.aiTip && (
              <div className="max-w-xl mx-auto mt-2.5 pt-2 border-t border-emerald-600/60 flex items-center gap-2 text-xs text-emerald-100">
                <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                <span className="font-semibold">{currentStep.aiTip}</span>
              </div>
            )}
          </div>

          {/* Real route geometry from OSRM rendered by Leaflet */}
          <div ref={routeMapRef} className="relative flex-1 bg-slate-950 overflow-hidden">

            {/* Speed & Speed Limit Widget */}
            <div className="absolute top-4 left-4 rtl:left-auto rtl:right-4 z-20 flex flex-col items-center bg-slate-900/90 backdrop-blur-md rounded-2xl p-2.5 border border-slate-800 shadow-xl">
              <div className="text-2xl font-black text-white">{speed === null ? '—' : speed}</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">{t.speedUnit}</div>
            </div>

            {/* Mascot Real-time Cheers */}
            <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4 z-20 max-w-[210px]">
              <div className="p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-xl flex items-center gap-2">
                <MascotSindbad size="sm" mood="navigating" />
                <p className="text-[11px] text-slate-200 font-medium leading-tight">
                  {isAr
                    ? 'يُعرض المسار وفق بيانات موقعك وهندسته الحقيقية.'
                    : 'Showing the real route geometry from your location.'}
                </p>
              </div>
            </div>

          </div>

          {/* Bottom Floating Control Bar */}
          <div className="z-30 bg-slate-900 border-t border-slate-800 p-4 shadow-2xl">
            <div className="max-w-xl mx-auto flex items-center justify-between">
              <div>
                <div className="text-2xl font-black text-white tracking-tight">
                  {Math.max(1, (routeData?.durationMinutes || 12) - currentStepIndex * 2)} min
                </div>
                <div className="text-xs text-slate-400 font-medium flex items-center gap-2">
                  <span>
                    {(
                      (routeData?.totalDistanceKm || 2.8) *
                      (1 - currentStepIndex / (steps.length || 1))
                    ).toFixed(1)}{' '}
                    km remaining
                  </span>
                  <span>•</span>
                  <span>Step {currentStepIndex + 1} of {steps.length}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTurnList(!showTurnList)}
                  className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="View Turn List"
                >
                  {showTurnList ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                </button>
                <button
                  onClick={handleAdvanceStep}
                  className="py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition active:scale-95"
                >
                  {currentStepIndex < steps.length - 1 ? (isAr ? 'التالي' : 'Next') : (isAr ? 'وصلت' : 'Arrived')}
                </button>
                <button
                  onClick={() => setNavState('route_selection')}
                  className="py-3 px-5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md transition active:scale-95"
                >
                  {t.endNavigation}
                </button>
              </div>
            </div>

            {/* Expandable Turn List */}
            {showTurnList && (
              <div className="max-w-xl mx-auto mt-3 pt-3 border-t border-slate-800 space-y-2 max-h-48 overflow-y-auto">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {isAr ? 'قائمة الخطوات المتبقية' : 'Remaining Step Prompts'}
                </div>
                {steps.map((s, idx) => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between text-xs p-2.5 rounded-xl ${
                      idx === currentStepIndex
                        ? 'bg-blue-950/80 border border-blue-800 text-blue-200 font-bold'
                        : 'text-slate-400 bg-slate-800/40'
                    }`}
                  >
                    <span>{s.instruction}</span>
                    <span className="font-mono text-[11px] shrink-0">{s.distanceMeters}m</span>
                  </div>
                ))}
              </div>
            )}
        </div>
        </div>
      )}

      {/* 4. YOU'VE ARRIVED! CELEBRATION & CHECK-IN SCREEN */}
      {navState === 'arrived' && (
        <div className="flex-1 flex flex-col justify-between max-w-xl mx-auto w-full p-4 sm:p-6 overflow-y-auto animate-in zoom-in-95">
          <div className="text-center pt-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mb-3">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-black text-white">{t.youveArrived}</h1>
            <p className="text-xs text-emerald-400 font-bold mt-0.5">
              {t.welcomeTo} {destination.name}
            </p>
          </div>

          {/* Destination Hero Card */}
          <div className="my-4 rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl relative">
            <img
              src={photoUploaded || destination.photos[0]}
              alt={destination.name}
              className="w-full h-52 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white">
              <div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-600">
                  {destination.rankText || destination.category}
                </span>
                <h3 className="text-lg font-bold mt-1">{destination.name}</h3>
                <p className="text-xs text-slate-300">{destination.area}</p>
              </div>
              <button
                onClick={() => onSavePlace(destination.id)}
                className={`p-3 rounded-full backdrop-blur-md transition ${
                  isSaved ? 'bg-rose-500 text-white' : 'bg-black/50 hover:bg-black/70 text-white'
                }`}
              >
                <Heart className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>

          {/* Community Check-in & Photo Contribution Buttons (Feature 1 & Feature 4) */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <button
              onClick={handleCheckIn}
              disabled={isCheckedIn}
              className={`p-3 rounded-2xl border flex flex-col items-center gap-1 transition text-center ${
                isCheckedIn
                  ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                  : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-200'
              }`}
            >
              <CheckCircle2 className={`w-5 h-5 ${isCheckedIn ? 'text-emerald-400' : 'text-blue-400'}`} />
              <span className="text-xs font-semibold">{isCheckedIn ? t.checkedIn : t.checkIn}</span>
            </button>

            <label className="p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex flex-col items-center gap-1 cursor-pointer transition text-center">
              <Camera className="w-5 h-5 text-blue-400" />
              <span className="text-xs font-semibold text-slate-200">Upload Photo</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    const url = URL.createObjectURL(e.target.files[0]);
                    setPhotoUploaded(url);
                  }
                }}
              />
            </label>

            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: destination.name,
                    text: `Just arrived at ${destination.name} via Sindbad AI Navigation!`,
                  });
                }
              }}
              className="p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex flex-col items-center gap-1 transition text-center"
            >
              <Share2 className="w-5 h-5 text-sky-400" />
              <span className="text-xs font-semibold text-slate-200">Share</span>
            </button>
          </div>

          {/* Sindbad Mascot Formation Briefing */}
          <div className="mb-4 p-3.5 rounded-2xl bg-blue-950/60 border border-blue-800/60 flex items-center gap-3">
            <MascotSindbad size="sm" mood="celebrating" />
            <p className="text-xs text-blue-200 leading-relaxed">
              <strong>{isAr ? 'معلومة سندباد التكوينية:' : 'Sindbad Formation Note:'}</strong>{' '}
              {destination.formationInfo || destination.description}
            </p>
          </div>

          {/* Bottom Primary Actions */}
          <div className="space-y-2">
            <button
              id="arrived-explore-btn"
              onClick={() => onArrivedExplore(destination)}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-md transition active:scale-98"
            >
              {t.exploreAroundHere}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs font-semibold transition"
            >
              {t.closeNav}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

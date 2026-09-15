import React, { useEffect, useState } from 'react';
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
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { Place, TravelMode, NavigationRouteData } from '../types';
import { fetchNavigationGuidance, submitPlaceCheckIn } from '../services/api';
import { MascotSindbad } from './MascotSindbad';
import { PlaceVisual } from './PlaceVisual';
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
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const routeMapRef = React.useRef<HTMLDivElement | null>(null);
  const routeMapInstanceRef = React.useRef<L.Map | null>(null);
  const routePolylineRef = React.useRef<L.Polyline | null>(null);

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  // Navigation is used live, in the field. French speakers must not be dropped
  // back to English mid-route, so every string resolves in all three languages.
  const text = (en: string, ar: string, fr: string) => (isAr ? ar : isFr ? fr : en);

  const requestCurrentLocation = () => {
    setIsLocating(true);
    setLocationError(null);
    setUserLocation(null);
    setRouteData(null);
    setRouteError(null);

    if (!navigator.geolocation) {
      setLocationError(text('Geolocation is not supported by this browser.', 'الموقع الجغرافي غير مدعوم في هذا المتصفح.', 'La géolocalisation n’est pas prise en charge par ce navigateur.'));
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation([coords.latitude, coords.longitude]);
        setSpeed(coords.speed === null ? null : Math.round(coords.speed * 3.6));
        setIsLocating(false);
      },
      () => {
        setUserLocation(null);
        setSpeed(null);
        setLocationError(text(
          'Could not get your current location. Allow location access and try again.',
          'تعذر الحصول على موقعك الحالي. اسمح بالوصول إلى الموقع ثم حاول مجدداً.',
          'Impossible d’obtenir votre position actuelle. Autorisez l’accès à la localisation puis réessayez.'));
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  useEffect(() => {
    requestCurrentLocation();
  }, []);

  const loadRoute = async (mode: TravelMode) => {
    if (mode === 'transit') {
      setRouteData(null);
      setRouteError(text('Public-transit routing is not available yet.', 'التوجيه عبر النقل العام غير متاح حالياً.', 'L’itinéraire en transport en commun n’est pas encore disponible.'));
      return;
    }
    if (!userLocation) {
      setRouteData(null);
      setRouteError(text('Your current location is required to calculate a route.', 'يلزم موقعك الحالي لحساب المسار.', 'Votre position actuelle est nécessaire pour calculer un itinéraire.'));
      return;
    }

    setIsLoadingRoute(true);
    setRouteError(null);
    setRouteData(null);
    try {
      const data = await fetchNavigationGuidance(destination.id, mode, language, userLocation[0], userLocation[1]);
      setRouteData(data);
    } catch {
      setRouteData(null);
      setRouteError(text('Route service temporarily unavailable', 'خدمة حساب المسار غير متاحة مؤقتاً', 'Service d’itinéraire temporairement indisponible'));
    } finally {
      setIsLoadingRoute(false);
    }
  };

  useEffect(() => {
    if (userLocation) void loadRoute(travelMode);
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
      // Speech is optional; route guidance remains usable without it.
    }
  };

  const steps = routeData?.steps || [];
  const currentStep = steps[currentStepIndex] || steps[0];

  useEffect(() => {
    if (navState === 'active_nav' && currentStep) speakInstruction(currentStep.instruction);
  }, [navState, currentStep]);

  const handleStartNav = () => {
    if (!routeData || steps.length === 0) return;
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
      // Celebration is optional.
    }
  };

  const handleCheckIn = async () => {
    if (isCheckingIn || isCheckedIn) return;
    setIsCheckingIn(true);
    setCheckInError(null);
    try {
      const success = await submitPlaceCheckIn(destination.id);
      if (success) {
        setIsCheckedIn(true);
      } else {
        setCheckInError(text(
          'Check-in could not be confirmed. Check your sign-in and connection.',
          'تعذر تأكيد تسجيل الوصول. تحقق من تسجيل الدخول والاتصال.',
          'Le check-in n’a pas pu être confirmé. Vérifiez votre connexion et votre compte.'));
      }
    } finally {
      setIsCheckingIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col text-white animate-in fade-in select-none">
      {navState === 'route_selection' && (
        <div className="flex-1 flex flex-col justify-between max-w-xl mx-auto w-full p-4 sm:p-6 overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                aria-label={text('Close', 'إغلاق', 'Fermer')}
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

          <div className="my-4 p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-4 shadow-xl">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-800">
              <PlaceVisual place={destination} language={language} className="h-full w-full" imageClassName="h-full w-full object-cover" showFallbackLabel={false} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase text-blue-400 px-2 py-0.5 rounded-full bg-blue-950/80 border border-blue-800">
                {destination.subCategory || destination.category}
              </span>
              <h2 className="text-base font-bold text-white truncate mt-1">
                {isAr && destination.arabicName ? destination.arabicName : isFr && destination.frenchName ? destination.frenchName : destination.name}
              </h2>
              <p className="text-xs text-slate-400 truncate mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{destination.address}</span>
              </p>
            </div>
          </div>

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
                const isUnavailable = item.mode === 'transit';
                const Icon = item.icon;
                return (
                  <button
                    key={item.mode}
                    disabled={isUnavailable}
                    onClick={() => {
                      if (!isUnavailable) setTravelMode(item.mode);
                    }}
                    className={`p-2.5 rounded-2xl border flex flex-col items-center gap-1 transition ${
                      isUnavailable
                        ? 'bg-slate-950 border-slate-800 text-slate-600 cursor-not-allowed opacity-70'
                        : isSelected
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-500 text-white font-bold shadow-lg shadow-blue-500/25'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px] whitespace-nowrap">{item.label}</span>
                    <span className="text-[10px] text-slate-300 font-normal">
                      {isUnavailable
                        ? text('Unavailable', 'غير متاح', 'Indisponible')
                        : isSelected && routeData?.travelMode === item.mode
                          ? text(`${routeData.durationMinutes} min`, `${routeData.durationMinutes} دقيقة`, `${routeData.durationMinutes} min`)
                          : '—'}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {text('Public-transit routing will be enabled here when a supported transit provider is connected.', 'التوجيه الحقيقي عبر النقل العام سيظهر هنا عند ربط مزود نقل يدعمه.', 'L’itinéraire en transport en commun sera activé ici dès qu’un fournisseur compatible sera connecté.')}
            </p>
          </div>

          {isLocating ? (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center gap-2 text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span>{text('Getting your current location...', 'جاري الحصول على موقعك الحالي...', 'Obtention de votre position actuelle…')}</span>
            </div>
          ) : locationError ? (
            <div className="p-5 rounded-2xl bg-amber-950/60 border border-amber-800 space-y-3 text-xs text-amber-100">
              <p>{locationError}</p>
              <button onClick={requestCurrentLocation} className="rounded-lg bg-amber-600 px-3 py-1.5 font-bold text-white">
                {text('Request location again', 'طلب الموقع مجدداً', 'Redemander la position')}
              </button>
            </div>
          ) : isLoadingRoute ? (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center gap-2 text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span>{text('Calculating route...', 'جاري حساب المسار...', 'Calcul de l’itinéraire…')}</span>
            </div>
          ) : routeError ? (
            <div className="p-5 rounded-2xl bg-rose-950/60 border border-rose-800 flex items-center justify-between gap-3 text-xs text-rose-200">
              <span>{routeError}</span>
              <button onClick={() => void loadRoute(travelMode)} className="rounded-lg bg-rose-600 px-3 py-1.5 font-bold text-white">
                {text('Retry', 'إعادة المحاولة', 'Réessayer')}
              </button>
            </div>
          ) : routeData ? (
            <div className="mb-4 p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-black text-white">{text(`${routeData.durationMinutes} min`, `${routeData.durationMinutes} دقيقة`, `${routeData.durationMinutes} min`)}</span>
                  <span className="text-xs text-slate-400 ml-2">({routeData.totalDistanceKm} km)</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-bold border border-slate-700">
                  {routeData.trafficCondition}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-blue-950/60 border border-blue-800/60 flex items-start gap-2.5 text-xs text-blue-200">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{routeData.aiSummary}</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{text('Route geometry received from the navigation service', 'تم استلام هندسة المسار من خدمة الملاحة', 'Tracé de l’itinéraire reçu du service de navigation')}</span>
                </span>
                <span className="text-[11px] font-bold text-blue-300">ROUTE DATA</span>
              </div>
            </div>
          ) : null}

          <div className="space-y-2 pt-2">
            <button
              id="start-turn-by-turn-btn"
              onClick={handleStartNav}
              disabled={isLoadingRoute || isLocating || !routeData || steps.length === 0}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white font-bold text-base shadow-xl shadow-blue-500/30 flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Navigation className="w-5 h-5 fill-current" />
              <span>{text('Start Route Guidance', 'بدء إرشادات المسار', 'Démarrer le guidage')}</span>
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

      {navState === 'active_nav' && currentStep && (
        <div className="relative flex-1 flex flex-col">
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

              <button
                onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                className="p-3 rounded-full bg-emerald-900/80 hover:bg-emerald-900 text-white transition shrink-0 shadow-xs"
                title={isVoiceEnabled ? 'Mute' : 'Unmute Voice'}
              >
                {isVoiceEnabled ? <Volume2 className="w-5 h-5 text-white" /> : <VolumeX className="w-5 h-5 text-emerald-300" />}
              </button>
            </div>

            <div className="max-w-xl mx-auto mt-2.5 pt-2 border-t border-emerald-600/60 text-[11px] text-emerald-100 font-medium">
              {text(
                'Manual step guidance: your position is not continuously tracked. Use Next to review route steps.',
                'إرشادات يدوية للخطوات: الموقع لا يُتتبّع باستمرار. استخدم «التالي» لمراجعة خطوات المسار.',
                'Guidage manuel par étapes : votre position n’est pas suivie en continu. Utilisez « Suivant » pour parcourir les étapes.')}
            </div>

            {currentStep.aiTip && (
              <div className="max-w-xl mx-auto mt-2.5 pt-2 border-t border-emerald-600/60 flex items-center gap-2 text-xs text-emerald-100">
                <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                <span className="font-semibold">{currentStep.aiTip}</span>
              </div>
            )}
          </div>

          <div ref={routeMapRef} className="relative flex-1 bg-slate-950 overflow-hidden">
            <div className="absolute top-4 left-4 rtl:left-auto rtl:right-4 z-20 flex flex-col items-center bg-slate-900/90 backdrop-blur-md rounded-2xl p-2.5 border border-slate-800 shadow-xl">
              <div className="text-2xl font-black text-white">{speed === null ? '—' : speed}</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">{text('GPS speed sample km/h', 'عينة سرعة GPS كم/س', 'Échantillon de vitesse GPS km/h')}</div>
            </div>

            <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4 z-20 max-w-[230px]">
              <div className="p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-xl flex items-center gap-2">
                <MascotSindbad size="sm" mood="navigating" />
                <p className="text-[11px] text-slate-200 font-medium leading-tight">
                  {text(
                    'This route geometry was calculated from your location sample when the route was requested.',
                    'هذه هندسة المسار المحسوبة من نقطة موقعك عند بدء الطلب.',
                    'Ce tracé a été calculé à partir de votre position au moment de la demande d’itinéraire.')}
                </p>
              </div>
            </div>
          </div>

          <div className="z-30 bg-slate-900 border-t border-slate-800 p-4 shadow-2xl">
            <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
              <div>
                <div className="text-xl font-black text-white tracking-tight">
                  {text(`Route estimate: ${routeData?.durationMinutes} min`, `تقدير المسار: ${routeData?.durationMinutes} دقيقة`, `Estimation : ${routeData?.durationMinutes} min`)}
                </div>
                <div className="text-xs text-slate-400 font-medium flex items-center gap-2">
                  <span>{routeData?.totalDistanceKm} km total</span>
                  <span>•</span>
                  <span>Step {currentStepIndex + 1} of {steps.length}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTurnList(!showTurnList)}
                  className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="View route steps"
                >
                  {showTurnList ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                </button>
                <button
                  onClick={handleAdvanceStep}
                  className="py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition active:scale-95"
                >
                  {currentStepIndex < steps.length - 1
                    ? text('Next', 'التالي', 'Suivant')
                    : text('Finish Guidance', 'إنهاء الإرشادات', 'Terminer le guidage')}
                </button>
                <button
                  onClick={() => setNavState('route_selection')}
                  className="py-3 px-5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md transition active:scale-95"
                >
                  {text('End', 'إنهاء', 'Terminer')}
                </button>
              </div>
            </div>

            {showTurnList && (
              <div className="max-w-xl mx-auto mt-3 pt-3 border-t border-slate-800 space-y-2 max-h-48 overflow-y-auto">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {text('Route Steps', 'خطوات المسار', 'Étapes de l’itinéraire')}
                </div>
                {steps.map((step, idx) => (
                  <div
                    key={step.id}
                    className={`flex items-center justify-between text-xs p-2.5 rounded-xl ${
                      idx === currentStepIndex
                        ? 'bg-blue-950/80 border border-blue-800 text-blue-200 font-bold'
                        : 'text-slate-400 bg-slate-800/40'
                    }`}
                  >
                    <span>{step.instruction}</span>
                    <span className="font-mono text-[11px] shrink-0">{step.distanceMeters}m</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {navState === 'arrived' && (
        <div className="flex-1 flex flex-col justify-between max-w-xl mx-auto w-full p-4 sm:p-6 overflow-y-auto animate-in zoom-in-95">
          <div className="text-center pt-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mb-3">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-black text-white">
              {text('Route Guidance Complete', 'اكتملت إرشادات المسار', 'Guidage terminé')}
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-1">
              {text(
                'This does not confirm physical arrival. Check in only if you are actually at the place.',
                'هذا لا يؤكد وصولك الفعلي. سجّل الوصول فقط إذا كنت في المكان.',
                'Cela ne confirme pas votre arrivée sur place. Enregistrez votre passage uniquement si vous y êtes vraiment.')}
            </p>
          </div>

          <div className="my-4 rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl relative">
            {photoUploaded ? (
              <img src={photoUploaded} alt={destination.name} className="w-full h-52 object-cover" />
            ) : (
              <PlaceVisual place={destination} language={language} className="h-52 w-full" imageClassName="h-full w-full object-cover" showFallbackLabel={false} />
            )}
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

          {checkInError && (
            <div className="mb-3 rounded-2xl border border-rose-800 bg-rose-950/60 px-3 py-2 text-xs font-bold text-rose-200">
              {checkInError}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 mb-4">
            <button
              onClick={() => void handleCheckIn()}
              disabled={isCheckedIn || isCheckingIn}
              className={`p-3 rounded-2xl border flex flex-col items-center gap-1 transition text-center ${
                isCheckedIn
                  ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                  : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-200 disabled:opacity-60'
              }`}
            >
              <CheckCircle2 className={`w-5 h-5 ${isCheckedIn ? 'text-emerald-400' : 'text-blue-400'}`} />
              <span className="text-xs font-semibold">
                {isCheckedIn ? t.checkedIn : isCheckingIn ? text('Confirming...', 'جاري التأكيد...', 'Confirmation…') : t.checkIn}
              </span>
            </button>

            <label className="p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex flex-col items-center gap-1 cursor-pointer transition text-center">
              <Camera className="w-5 h-5 text-blue-400" />
              <span className="text-xs font-semibold text-slate-200">{text('Preview Photo', 'معاينة صورة', 'Aperçu photo')}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  if (event.target.files?.[0]) {
                    const url = URL.createObjectURL(event.target.files[0]);
                    setPhotoUploaded(url);
                  }
                }}
              />
            </label>

            <button
              onClick={() => {
                if (navigator.share) {
                  void navigator.share({
                    title: destination.name,
                    text: `Route guidance for ${destination.name} in My Sindbad.`,
                  });
                }
              }}
              className="p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex flex-col items-center gap-1 transition text-center"
            >
              <Share2 className="w-5 h-5 text-sky-400" />
              <span className="text-xs font-semibold text-slate-200">Share</span>
            </button>
          </div>

          <div className="mb-4 p-3.5 rounded-2xl bg-blue-950/60 border border-blue-800/60 flex items-center gap-3">
            <MascotSindbad size="sm" mood="celebrating" />
            <p className="text-xs text-blue-200 leading-relaxed">
              <strong>{text('Place note:', 'معلومة عن المكان:', 'Note sur le lieu :')}</strong>{' '}
              {destination.formationInfo || destination.description}
            </p>
          </div>

          <div className="space-y-2">
            <button
              id="arrived-explore-btn"
              onClick={() => onArrivedExplore(destination)}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-md transition active:scale-98"
            >
              {text('Open Place Details', 'فتح تفاصيل المكان', 'Ouvrir les détails du lieu')}
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

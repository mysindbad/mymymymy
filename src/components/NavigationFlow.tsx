import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import confetti from 'canvas-confetti';
import {
  Navigation,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  MapPin,
  Car,
  Footprints,
  Bus,
  Volume2,
  VolumeX,
  Camera,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Loader2,
  List,
  X,
} from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { Place, TravelMode, NavigationRouteData } from '../types';
import { fetchNavigationGuidance, submitPlaceCheckIn } from '../services/api';
import { PlaceVisual } from './PlaceVisual';
import { SupportedLanguage, TRANSLATIONS } from '../data/translations';
import { useLocale } from '../lib/i18n';
import { Button, IconButton } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { toast } from '../ui/toast';

interface NavigationFlowProps {
  destination: Place;
  onClose: () => void;
  onArrivedExplore: (place: Place) => void;
  onSavePlace: (placeId: string) => void;
  isSaved?: boolean;
  language?: SupportedLanguage;
}

type NavStepState = 'route_selection' | 'active_nav' | 'arrived';

const MODE_ICONS: Record<TravelMode, React.ComponentType<{ className?: string }>> = {
  driving: Car,
  walking: Footprints,
  transit: Bus,
  taxi: Car,
};

const MODE_ORDER: Array<{ mode: TravelMode }> = [
  { mode: 'driving' },
  { mode: 'walking' },
  { mode: 'transit' },
  { mode: 'taxi' },
];

function turnIcon(iconType: string) {
  if (iconType === 'left') return ArrowLeft;
  if (iconType === 'right') return ArrowRight;
  if (iconType === 'arrive') return MapPin;
  return ArrowUp;
}

/** Dark, glanceable surfaces only: this screen is read while walking. */
const DARK_PANEL = 'rounded-xl border border-white/10 bg-white/[0.045]';
const DARK_MUTED = 'text-white/55';

export const NavigationFlow: React.FC<NavigationFlowProps> = ({
  destination,
  onClose,
  onArrivedExplore,
  onSavePlace,
  isSaved = false,
  language = 'en',
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const locale = useLocale(language);
  const localize = locale.t;
  const isAr = locale.isArabic;
  const reducedMotion = useReducedMotion();

  const [navState, setNavState] = useState<NavStepState>('route_selection');
  const [travelMode, setTravelMode] = useState<TravelMode>('driving');
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<NavigationRouteData | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [showTurnList, setShowTurnList] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState<string | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const routeMapRef = useRef<HTMLDivElement | null>(null);
  const routeMapInstanceRef = useRef<L.Map | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const photoUrlRef = useRef<string | null>(null);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
  }, []);

  const requestCurrentLocation = () => {
    setIsLocating(true);
    setLocationError(null);
    setUserLocation(null);
    setRouteData(null);
    setRouteError(null);

    if (!navigator.geolocation) {
      setLocationError(localize(
        'This browser cannot share a location.',
        'هذا المتصفح لا يشارك الموقع.',
        'Ce navigateur ne peut pas partager de position.',
      ));
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation([coords.latitude, coords.longitude]);
        setIsLocating(false);
      },
      () => {
        setUserLocation(null);
        setLocationError(localize(
          'Your current location is unavailable. Allow location access and try again.',
          'موقعك الحالي غير متاح. اسمح بالوصول إلى الموقع ثم أعد المحاولة.',
          'Votre position est indisponible. Autorisez l’accès à la position puis réessayez.',
        ));
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
      setRouteError(localize(
        'Public-transit routing is not available yet.',
        'التوجيه عبر النقل العام غير متاح حالياً.',
        'Le calcul d’itinéraire en transports en commun n’est pas encore disponible.',
      ));
      return;
    }
    if (!userLocation) {
      setRouteData(null);
      setRouteError(localize(
        'Your current location is required to calculate a route.',
        'يلزم موقعك الحالي لحساب المسار.',
        'Votre position est nécessaire pour calculer un itinéraire.',
      ));
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
      setRouteError(localize(
        'The route service is temporarily unavailable.',
        'خدمة حساب المسار غير متاحة مؤقتاً.',
        'Le service d’itinéraire est temporairement indisponible.',
      ));
    } finally {
      setIsLoadingRoute(false);
    }
  };

  useEffect(() => {
    if (userLocation) void loadRoute(travelMode);
  }, [destination, travelMode, language, userLocation]);

  useEffect(() => {
    const coordinates = (routeData as NavigationRouteData & {
      geometry?: { coordinates?: Array<[number, number]> };
    } | null)?.geometry?.coordinates;
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
    routePolylineRef.current = L.polyline(leafletCoordinates, { color: '#5b88f5', weight: 6, opacity: 0.95 }).addTo(routeMapInstanceRef.current);
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
      utterance.lang = isAr ? 'ar-SA' : locale.isFrench ? 'fr-FR' : 'en-US';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech is optional; route guidance remains usable without it.
    }
  };

  const steps = routeData?.steps || [];
  const currentStep = steps[currentStepIndex] || steps[0];
  const remainingMeters = useMemo(
    () => steps.slice(currentStepIndex).reduce((total, step) => total + (Number(step.distanceMeters) || 0), 0),
    [steps, currentStepIndex],
  );
  const arrivalLabel = useMemo(() => {
    const minutes = Number(routeData?.durationMinutes ?? 0);
    const remaining = navState === 'active_nav' ? Math.round(minutes * (remainingMeters / Math.max(1, steps.reduce((sum, step) => sum + (Number(step.distanceMeters) || 0), 0)))) : minutes;
    const arrival = new Date(now.getTime() + Math.max(0, remaining) * 60_000);
    return arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [routeData, navState, remainingMeters, steps, now]);

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
    if (!reducedMotion) {
      try {
        confetti({ particleCount: 90, spread: 68, origin: { y: 0.62 } });
      } catch {
        // Celebration is optional.
      }
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
        toast(localize('Arrival recorded', 'تم تسجيل الوصول', 'Arrivée enregistrée'), { tone: 'success' });
      } else {
        setCheckInError(localize(
          'Check-in could not be confirmed. Check your sign-in and connection.',
          'تعذر تأكيد تسجيل الوصول. تحقق من تسجيل الدخول والاتصال.',
          'Le check-in n’a pas pu être confirmé. Vérifiez votre connexion et votre session.',
        ));
      }
    } catch {
      setCheckInError(localize(
        'Check-in needs a connection. Try again.',
        'تسجيل الوصول يتطلب اتصالاً. أعد المحاولة.',
        'Le check-in nécessite une connexion. Réessayez.',
      ));
    } finally {
      setIsCheckingIn(false);
    }
  };

  const attachPhoto = (file: File | undefined) => {
    if (!file) return;
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    const url = URL.createObjectURL(file);
    photoUrlRef.current = url;
    setPhotoUploaded(url);
  };

  const destinationName = isAr && destination.arabicName ? destination.arabicName : destination.name;
  const progress = steps.length > 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0;
  const TurnIcon = currentStep ? turnIcon(currentStep.iconType) : MapPin;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white select-none" dir={locale.direction}>
      {navState === 'route_selection' && (
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-y-auto px-4 pb-5 pt-3 sm:px-6">
          <header className="flex items-center gap-3 border-b border-white/10 pb-3">
            <IconButton label={localize('Back', 'رجوع', 'Retour')} onClick={onClose} size="sm" variant="onPhoto">
              <ArrowLeft className={`h-4 w-4 ${isAr ? 'rotate-180' : ''}`} aria-hidden="true" />
            </IconButton>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-title font-bold tracking-tight">{t.routePreview}</h1>
              <p className="truncate text-micro text-white/55">{destinationName}</p>
            </div>
            <IconButton label={localize('Close', 'إغلاق', 'Fermer')} onClick={onClose} size="sm" variant="onPhoto">
              <X className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </header>

          <div className={`relative mt-4 overflow-hidden rounded-3xl ${DARK_PANEL}`}>
            <div className="h-32 w-full">
              <PlaceVisual
                place={destination}
                language={language}
                className="h-full w-full"
                imageClassName="h-full w-full object-cover"
                showFallbackLabel={false}
                eager
              />
            </div>
            <div className="sindbad-photo-scrim absolute inset-x-0 bottom-0 h-3/4" aria-hidden="true" />
            <div className="absolute inset-x-3.5 bottom-3">
              <span className="flex items-center gap-2">
                <Chip tone="onPhoto">{destination.subCategory || destination.category}</Chip>
                {destination.rankText && <Chip tone="onPhoto">{destination.rankText}</Chip>}
              </span>
              <h2 className="mt-1.5 text-h2 font-extrabold leading-tight tracking-tight text-white">{destinationName}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-micro text-white/80">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{destination.address}</span>
              </p>
            </div>
          </div>

          <section className="mt-5" aria-labelledby="nav-mode-heading">
            <h3 id="nav-mode-heading" className="mb-2 text-label font-bold uppercase tracking-wide text-white/55">
              {t.travelMode}
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {MODE_ORDER.map((item) => {
                const mode = item.mode;
                const Icon = MODE_ICONS[mode];
                const isSelected = travelMode === mode;
                const isUnavailable = item.mode === 'transit';
                return (
                  <button
                    key={mode}
                    type="button"
                    disabled={isUnavailable}
                    onClick={() => setTravelMode(mode)}
                    aria-pressed={isSelected}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2.5 transition-colors duration-150 ${
                      isUnavailable
                        ? 'border-white/5 bg-white/[0.02] text-white/25'
                        : isSelected
                          ? 'border-brand-400 bg-brand-fill text-on-brand'
                          : 'border-white/10 bg-white/[0.045] text-white/70 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="text-micro font-bold">{t.modes[mode]}</span>
                    <span className={`text-micro tabular-nums ${isSelected ? 'text-on-brand/80' : 'text-white/40'}`}>
                      {isUnavailable
                        ? localize('Soon', 'قريباً', 'Bientôt')
                        : isSelected && routeData?.travelMode === mode
                          ? localize(`${routeData.durationMinutes} min`, `${routeData.durationMinutes} دقيقة`, `${routeData.durationMinutes} min`)
                          : '—'}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className={`mt-2 text-micro leading-snug ${DARK_MUTED}`}>
              {localize(
                'Public-transit routing will be enabled here when a supported transit provider is connected.',
                'التوجيه الحقيقي عبر النقل العام سيظهر هنا عند ربط مزود نقل يدعمه.',
                'Le calcul en transports en commun apparaîtra ici lorsqu’un fournisseur compatible sera connecté.',
              )}
            </p>
          </section>

          <section className="mt-5 flex-1" aria-live="polite">
            {isLocating ? (
              <div className={`flex items-center gap-2.5 p-4 text-caption ${DARK_PANEL} ${DARK_MUTED}`}>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>{localize('Getting your current location…', 'جارٍ تحديد موقعك الحالي…', 'Obtention de votre position…')}</span>
              </div>
            ) : locationError ? (
              <div className={`space-y-3 ${DARK_PANEL}`}>
                <p className="text-caption leading-snug text-white/85">{locationError}</p>
                <Button size="sm" variant="onPhoto" onClick={requestCurrentLocation}>
                  {localize('Request location again', 'طلب الموقع مجدداً', 'Demander à nouveau la position')}
                </Button>
              </div>
            ) : isLoadingRoute ? (
              <div className={`space-y-2.5 p-4 ${DARK_PANEL}`} aria-busy="true">
                <span className="block h-6 w-28 animate-pulse rounded bg-white/10" />
                <span className="block h-4 w-full animate-pulse rounded bg-white/[0.07]" />
                <span className="block h-4 w-2/3 animate-pulse rounded bg-white/[0.07]" />
                <p className={`pt-1 text-micro ${DARK_MUTED}`}>{localize('Calculating route…', 'جارٍ حساب المسار…', 'Calcul de l’itinéraire…')}</p>
              </div>
            ) : routeError ? (
              <div className={`flex items-start justify-between gap-3 p-3.5 ${DARK_PANEL}`}>
                <p className="text-caption leading-snug text-white/85">{routeError}</p>
                {userLocation && (
                  <Button size="sm" variant="onPhoto" onClick={() => void loadRoute(travelMode)}>
                    {localize('Retry', 'إعادة المحاولة', 'Réessayer')}
                  </Button>
                )}
              </div>
            ) : routeData ? (
              <div className={`p-4 ${DARK_PANEL}`}>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-display font-extrabold leading-none tabular-nums">
                      {routeData.durationMinutes}
                      <span className="ms-1 text-title font-bold text-white/70">{localize('min', 'دقيقة', 'min')}</span>
                    </p>
                    <p className={`mt-1.5 text-caption tabular-nums ${DARK_MUTED}`}>
                      {routeData.totalDistanceKm} km · {localize('arrive', 'الوصول', 'arrivée')} {arrivalLabel}
                    </p>
                  </div>
                  {routeData.trafficCondition && <Chip tone="onPhoto">{routeData.trafficCondition}</Chip>}
                </div>
                {routeData.aiSummary && (
                  <p className="mt-3.5 border-s-2 border-brand-400 ps-3 text-caption leading-relaxed text-white/85">
                    {routeData.aiSummary}
                  </p>
                )}
              </div>
            ) : (
              <div className={`p-4 text-caption ${DARK_PANEL} ${DARK_MUTED}`}>
                {localize('No route to show yet.', 'لا يوجد مسار لعرضه بعد.', 'Aucun itinéraire à afficher pour le moment.')}
              </div>
            )}
          </section>

          <div className="mt-5 space-y-2">
            <Button
              id="start-turn-by-turn-btn"
              full
              size="lg"
              onClick={handleStartNav}
              disabled={isLoadingRoute || isLocating || !routeData || steps.length === 0}
              icon={<Navigation className="h-4 w-4" aria-hidden="true" />}
              trailingIcon={<ArrowRight className={`h-4 w-4 ${isAr ? 'rotate-180' : ''}`} aria-hidden="true" />}
            >
              {localize('Start Route Guidance', 'بدء إرشادات المسار', 'Démarrer le guidage')}
            </Button>
            <button
              type="button"
              onClick={onClose}
              className={`h-10 w-full rounded-lg text-caption font-semibold ${DARK_MUTED} transition-colors hover:bg-white/[0.06] hover:text-white`}
            >
              {t.closeNav}
            </button>
          </div>
        </div>
      )}

      {navState === 'active_nav' && currentStep && (
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-white/10 bg-slate-900/95 px-4 py-3.5 backdrop-blur">
            <div className="mx-auto flex max-w-xl items-center gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-fill text-on-brand">
                <TurnIcon className={`h-6 w-6 ${isAr && (currentStep.iconType === 'left' || currentStep.iconType === 'right') ? '-scale-x-100' : ''}`} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-caption font-bold tabular-nums text-brand-300">
                  {t.inMeters} {currentStep.distanceMeters}m
                </p>
                <h2 className="text-title font-bold leading-snug tracking-tight text-white">{currentStep.instruction}</h2>
                {currentStep.roadName && <p className={`truncate text-micro ${DARK_MUTED}`}>{currentStep.roadName}</p>}
              </div>
              <IconButton
                label={isVoiceEnabled ? localize('Mute voice', 'كتم الصوت', 'Couper la voix') : localize('Unmute voice', 'تشغيل الصوت', 'Activer la voix')}
                onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                size="sm"
                variant="onPhoto"
              >
                {isVoiceEnabled ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
              </IconButton>
            </div>
            {currentStep.aiTip && (
              <p className={`mx-auto mt-2.5 max-w-xl border-s-2 border-sand-400 ps-2.5 text-micro leading-snug text-white/75`}>
                {currentStep.aiTip}
              </p>
            )}
            <div className="mx-auto mt-3 h-1 max-w-xl overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-brand-400 transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
          </header>

          <div ref={routeMapRef} className="relative flex-1 overflow-hidden bg-slate-950">
            <div className={`absolute start-3 top-3 z-20 flex items-center gap-2.5 rounded-xl px-3 py-2 ${DARK_PANEL} backdrop-blur`}>
              <span className="text-body font-extrabold tabular-nums">{arrivalLabel}</span>
              <span className={`text-micro ${DARK_MUTED}`}>
                {remainingMeters >= 1000
                  ? localize(`${(remainingMeters / 1000).toFixed(1)} km left`, `${(remainingMeters / 1000).toFixed(1)} كم متبقٍ`, `${(remainingMeters / 1000).toFixed(1)} km restants`)
                  : localize(`${remainingMeters} m left`, `${remainingMeters} م متبقية`, `${remainingMeters} m restants`)}
              </span>
            </div>
            <span className={`absolute end-3 top-3 z-20 rounded-xl px-2.5 py-1.5 text-micro font-semibold ${DARK_PANEL} ${DARK_MUTED} backdrop-blur`}>
              {localize('Advance manually', 'التقدّم يدوياً', 'Avancement manuel')}
            </span>
          </div>

          <footer className="shrink-0 border-t border-white/10 bg-slate-900/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
            <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-body font-bold tabular-nums">
                  {localize(`Step ${currentStepIndex + 1} of ${steps.length}`, `الخطوة ${currentStepIndex + 1} من ${steps.length}`, `Étape ${currentStepIndex + 1} sur ${steps.length}`)}
                </p>
                <p className={`truncate text-micro tabular-nums ${DARK_MUTED}`}>
                  {routeData ? `${routeData.totalDistanceKm} km · ${routeData.durationMinutes} ${localize('min', 'دقيقة', 'min')}` : destinationName}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <IconButton
                  label={showTurnList ? localize('Hide steps', 'إخفاء الخطوات', 'Masquer les étapes') : localize('All steps', 'كل الخطوات', 'Toutes les étapes')}
                  onClick={() => setShowTurnList(!showTurnList)}
                  variant="onPhoto"
                  active={showTurnList}
                >
                  {showTurnList ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <List className="h-4 w-4" aria-hidden="true" />}
                </IconButton>
                <Button size="sm" variant="onPhoto" onClick={() => setNavState('route_selection')}>
                  {localize('End', 'إنهاء', 'Terminer')}
                </Button>
                <Button size="sm" onClick={handleAdvanceStep} trailingIcon={currentStepIndex < steps.length - 1 && <ArrowRight className={`h-3.5 w-3.5 ${isAr ? 'rotate-180' : ''}`} aria-hidden="true" />}>
                  {currentStepIndex < steps.length - 1
                    ? localize('Next', 'التالي', 'Suivant')
                    : localize('Finish', 'إنهاء الإرشادات', 'Terminer')}
                </Button>
              </div>
            </div>

            {showTurnList && (
              <ul className="mx-auto mt-3 max-h-44 max-w-xl space-y-1 overflow-y-auto border-t border-white/10 pt-2.5">
                {steps.map((step, index) => {
                  const Icon = turnIcon(step.iconType);
                  return (
                    <li
                      key={step.id}
                      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-caption ${
                        index === currentStepIndex ? 'bg-brand-soft text-brand-300' : index < currentStepIndex ? 'text-white/35' : 'text-white/70'
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${isAr && (step.iconType === 'left' || step.iconType === 'right') ? '-scale-x-100' : ''}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{step.instruction}</span>
                      <span className="shrink-0 tabular-nums">{step.distanceMeters}m</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </footer>
        </div>
      )}

      {navState === 'arrived' && (
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-y-auto px-4 pb-6 pt-8 sm:px-6">
          <div className="text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-positive/15 text-positive ring-1 ring-positive/30">
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </span>
            <h1 className="mt-3 text-h1 font-extrabold tracking-tight">
              {localize('Guidance complete', 'اكتملت الإرشادات', 'Guidage terminé')}
            </h1>
            <p className={`mx-auto mt-1.5 max-w-sm text-caption leading-relaxed ${DARK_MUTED}`}>
              {localize(
                'This does not confirm physical arrival. Check in only if you are at the place.',
                'هذا لا يؤكد وصولك الفعلي. سجّل الوصول فقط إذا كنت في المكان.',
                'Ceci ne confirme pas votre arrivée physique. Enregistrez-vous uniquement si vous êtes sur place.',
              )}
            </p>
          </div>

          <article className={`relative mt-5 overflow-hidden rounded-3xl ${DARK_PANEL}`}>
            <div className="h-40 w-full">
              {photoUploaded ? (
                <img src={photoUploaded} alt={destinationName} className="h-full w-full object-cover" />
              ) : (
                <PlaceVisual place={destination} language={language} className="h-full w-full" imageClassName="h-full w-full object-cover" showFallbackLabel={false} />
              )}
            </div>
            <div className="sindbad-photo-scrim absolute inset-x-0 bottom-0 h-2/3" aria-hidden="true" />
            <div className="absolute inset-x-3.5 bottom-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                {destination.rankText && <Chip tone="onPhoto" className="mb-1">{destination.rankText}</Chip>}
                <h2 className="truncate text-title font-bold text-white">{destinationName}</h2>
                <p className={`truncate text-micro ${DARK_MUTED}`}>{destination.area}</p>
              </div>
              <button
                type="button"
                onClick={() => onSavePlace(destination.id)}
                aria-pressed={isSaved}
                aria-label={isSaved ? localize('Remove from saved', 'إزالة من المحفوظات', 'Retirer des favoris') : localize('Save place', 'حفظ المكان', 'Enregistrer le lieu')}
                className={`sindbad-hit-expand flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 backdrop-blur transition-colors ${
                  isSaved ? 'bg-negative-fill text-negative-ink' : 'bg-scrim/55 text-white hover:bg-scrim/75'
                }`}
              >
                <svg viewBox="0 0 24 24" className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} stroke="currentColor" strokeWidth="2" fill="none" aria-hidden="true">
                  <path d="M12 20s-7-4.6-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5C19 15.4 12 20 12 20z" />
                </svg>
              </button>
            </div>
          </article>

          {checkInError && (
            <p className="mt-3 rounded-lg border border-negative-line/30 bg-negative-line/10 px-3 py-2 text-caption font-semibold text-negative-line" role="alert">
              {checkInError}
            </p>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => void handleCheckIn()}
              disabled={isCheckedIn || isCheckingIn}
              className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors ${
                isCheckedIn
                  ? 'border-positive/40 bg-positive/12 text-positive'
                  : 'border-white/10 bg-white/[0.045] text-white/85 hover:bg-white/[0.08]'
              }`}
            >
              {isCheckingIn ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
              <span className="text-micro font-bold leading-tight">
                {isCheckedIn ? t.checkedIn : isCheckingIn ? localize('Confirming…', 'جارٍ التأكيد…', 'Confirmation…') : t.checkIn}
              </span>
            </button>

            <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.045] px-2 py-3 text-center text-white/85 transition-colors hover:bg-white/[0.08]">
              <Camera className="h-5 w-5" aria-hidden="true" />
              <span className="text-micro font-bold leading-tight">{localize('Add photo', 'أضف صورة', 'Ajouter une photo')}</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => attachPhoto(event.target.files?.[0])}
              />
            </label>

            <button
              type="button"
              onClick={() => {
                if (!canShare) return;
                void navigator.share({
                  title: destinationName,
                  text: localize(
                    `Route guidance for ${destinationName} in My Sindbad.`,
                    `إرشادات الوصول إلى ${destinationName} في My Sindbad.`,
                    `Itinéraire vers ${destinationName} sur My Sindbad.`,
                  ),
                });
              }}
              disabled={!canShare}
              title={canShare ? undefined : localize('Sharing is not available in this browser.', 'المشاركة غير متاحة في هذا المتصفح.', 'Le partage n’est pas disponible dans ce navigateur.')}
              className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.045] px-2 py-3 text-center text-white/85 transition-colors hover:bg-white/[0.08] disabled:opacity-40"
            >
              <ArrowDown className="h-5 w-5 rotate-180" aria-hidden="true" />
              <span className="text-micro font-bold leading-tight">{localize('Share', 'مشاركة', 'Partager')}</span>
            </button>
          </div>

          {(destination.description || destination.formationInfo) && (
            <div className={`mt-4 p-3.5 ${DARK_PANEL}`}>
              <h3 className="text-label font-bold uppercase tracking-wide text-white/55">
                {localize('About this place', 'عن هذا المكان', 'À propos de ce lieu')}
              </h3>
              <p className="mt-1 text-caption leading-relaxed text-white/85">
                {isAr && destination.formationInfoAr
                  ? destination.formationInfoAr
                  : destination.formationInfo || destination.description}
              </p>
            </div>
          )}

          <div className="mt-5 space-y-2">
            <Button
              id="arrived-explore-btn"
              full
              size="lg"
              onClick={() => onArrivedExplore(destination)}
              trailingIcon={<ChevronUp className={`h-4 w-4 -rotate-90 ${isAr ? 'rotate-90' : ''}`} aria-hidden="true" />}
            >
              {localize('Open place details', 'فتح تفاصيل المكان', 'Voir le détail du lieu')}
            </Button>
            <button
              type="button"
              onClick={onClose}
              className={`h-10 w-full rounded-lg text-caption font-semibold ${DARK_MUTED} transition-colors hover:bg-white/[0.06] hover:text-white`}
            >
              {t.closeNav}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

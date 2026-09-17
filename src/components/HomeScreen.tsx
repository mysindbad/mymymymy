import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bed,
  CalendarDays,
  CloudSun,
  Compass,
  MapPin,
  Mic,
  Plane,
  Search,
  Utensils,
} from 'lucide-react';
import { Place } from '../types';
import { SupportedLanguage } from '../data/translations';
import { BrandLogo } from './BrandLogo';
import { PlaceCard } from '../ui/PlaceCard';
import { Button, IconButton } from '../ui/Button';
import { EmptyState } from '../ui/Feedback';
import { UserAvatar } from './UserAvatar';
import { useLocale } from '../lib/i18n';
import { formatDistance, placeDisplayName } from '../lib/placeView';
import heroBackdrop from '../assets/images/morocco_auth_bg.jpg';
import type { AssistantNavigationReply, AppNavigationAction } from '../lib/appNavigation';

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart: (() => void) | null;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface HomeScreenProps {
  onOpenAIChat: () => void;
  onNavigateTab: (tab: 'home' | 'explore' | 'map' | 'trips' | 'community') => void;
  onSelectCategory: (category: string) => void;
  onSelectDestination: (destinationName: string) => void;
  onOpenFlights: () => void;
  onOpenWeather: () => void;
  onOpenSideMenu: () => void;
  onOpenAccount: () => void;
  onSelectPlace: (place: Place) => void;
  onToggleSave: (placeId: string) => void;
  onVoiceCommand: (text: string) => Promise<AssistantNavigationReply>;
  onVoiceAction: (action: AppNavigationAction) => void;
  onRequestLocation: () => Promise<unknown>;
  places: Place[];
  savedPlaceIds: string[];
  hasLocation: boolean;
  locationPermission: string;
  language?: SupportedLanguage;
  onOpenAuth?: (screen?: 'welcome' | 'sign-in-email' | 'create-account' | 'forgot-password' | 'reset-password' | 'sign-in-method') => void;
  currentUser?: { name: string; email: string; avatarUrl: string; isLoggedIn?: boolean };
  placesLoading?: boolean;
  tripDestination?: Place | null;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenAIChat,
  onNavigateTab,
  onSelectCategory,
  onSelectDestination,
  onOpenFlights,
  onOpenWeather,
  onOpenSideMenu,
  onOpenAccount,
  onSelectPlace,
  onToggleSave,
  onVoiceCommand,
  onVoiceAction,
  onRequestLocation,
  places,
  savedPlaceIds,
  hasLocation,
  locationPermission,
  language = 'en',
  onOpenAuth,
  currentUser,
  placesLoading = false,
  tripDestination = null,
}) => {
  const locale = useLocale(language);
  const localize = locale.t;
  const [searchQuery, setSearchQuery] = useState('');
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [voicePending, setVoicePending] = useState(false);
  const [voiceReply, setVoiceReply] = useState<AssistantNavigationReply | null>(null);
  const [voiceError, setVoiceError] = useState('');
  const [clock, setClock] = useState(() => new Date());
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const featuredPlaces = useMemo(() => places.slice(0, 5), [places]);
  const savedPlaces = useMemo(
    () => places.filter((place) => savedPlaceIds.includes(place.id)),
    [places, savedPlaceIds],
  );
  const hour = clock.getHours();
  const greeting = hour >= 5 && hour < 12
    ? localize('Good morning', 'صباح الخير', 'Bonjour')
    : hour >= 12 && hour < 18
      ? localize('Good afternoon', 'نهارك سعيد', 'Bon après-midi')
      : localize('Good evening', 'مساء الخير', 'Bonsoir');
  const greetingName = currentUser?.isLoggedIn && currentUser.name?.trim() ? currentUser.name.trim().split(' ')[0] : '';
  const locationLabel = userLocationLabel(locale.language, hasLocation, tripDestination);

  useEffect(() => {
    const refreshClock = () => setClock(new Date());
    const timer = window.setInterval(refreshClock, 60_000);
    const onVisibility = () => { if (!document.hidden) refreshClock(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
    };
  }, []);

  const processVoiceResult = async (transcript: string) => {
    setSearchQuery(transcript);
    setVoicePending(true);
    setVoiceError('');
    setVoiceReply(null);
    try {
      setVoiceReply(await onVoiceCommand(transcript));
    } catch {
      setVoiceError(localize('Could not process that request.', 'تعذر معالجة الطلب.', 'Impossible de traiter cette demande.'));
    } finally {
      setVoicePending(false);
    }
  };

  const handleMicClick = () => {
    if (isListeningMic) {
      recognitionRef.current?.stop();
      return;
    }
    const browserWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError(localize('Voice input is not supported on this browser.', 'الإدخال الصوتي غير مدعوم في هذا المتصفح.', 'La saisie vocale n’est pas prise en charge par ce navigateur.'));
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = locale.isArabic ? 'ar-MA' : locale.isFrench ? 'fr-FR' : 'en-US';
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onstart = () => {
        setVoiceError('');
        setIsListeningMic(true);
      };
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (transcript) void processVoiceResult(transcript);
      };
      recognition.onerror = (event) => {
        const message = event.error === 'not-allowed'
          ? localize('Microphone permission is blocked.', 'إذن الميكروفون محظور.', 'L’autorisation du microphone est bloquée.')
          : event.error === 'no-speech'
            ? localize('No speech was detected. Try again.', 'لم يتم سماع كلام. حاول مجدداً.', 'Aucune parole détectée. Réessayez.')
            : localize('Voice input stopped. Try again.', 'توقف الإدخال الصوتي. حاول مجدداً.', 'La saisie vocale s’est arrêtée. Réessayez.');
        setVoiceError(message);
        setIsListeningMic(false);
      };
      recognition.onend = () => {
        recognitionRef.current = null;
        setIsListeningMic(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListeningMic(false);
      setVoiceError(localize('Could not start the microphone.', 'تعذر تشغيل الميكروفون.', 'Impossible de démarrer le microphone.'));
    }
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query) onSelectDestination(query);
    else searchRef.current?.focus();
  };

  return (
    <div className="min-h-dvh w-full pb-2">
      {/* ---- Hero: brand, greeting and the one primary action (search) ---- */}
      <section className="relative overflow-hidden bg-slate-950">
        <img
          src={heroBackdrop}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-75 brightness-[0.9]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-scrim/70 via-scrim/55 to-canvas" aria-hidden="true" />

        <div className="relative z-10 mx-auto w-full max-w-3xl px-3 pb-5 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
          <header className="flex items-center justify-between gap-3">
            <IconButton
              id="home-side-menu-btn"
              label={localize('Menu', 'القائمة', 'Menu')}
              onClick={onOpenSideMenu}
              variant="onPhoto"
              size="sm"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h10" />
              </svg>
            </IconButton>
            <div className="flex items-center gap-2.5">
              <span className="text-micro font-semibold text-white/70 lg:hidden">{locationLabel}</span>
              <button
                type="button"
                onClick={() => (currentUser?.isLoggedIn ? onOpenAccount() : onOpenAuth?.('welcome'))}
                className="flex min-h-9 items-center gap-2 rounded-full border border-white/15 bg-white/10 p-1 pe-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20 pointer-coarse:min-h-11"
              >
                <UserAvatar name={currentUser?.name} avatarUrl={currentUser?.avatarUrl} className="h-7 w-7" textClassName="text-micro" />
                <span className="max-w-24 truncate text-label font-bold">
                  {currentUser?.isLoggedIn && currentUser.name ? currentUser.name.split(' ')[0] : localize('Sign in', 'تسجيل الدخول', 'Se connecter')}
                </span>
              </button>
            </div>
          </header>

          <div className="mt-5 sm:mt-7">
            <BrandLogo size="sm" showSlogan={false} language={locale.language} className="!items-start" />
            <p className="mt-3 text-caption font-semibold text-white/85" data-home-greeting="true">
              {greeting}
              {greetingName ? ` · ${greetingName}` : ''}
            </p>
            <h1 className="mt-1 max-w-md text-h1 font-extrabold tracking-tight text-white sm:text-display">
              {locale.isArabic
                ? 'أين تريد أن تذهب اليوم؟'
                : locale.isFrench
                  ? 'Où voulez-vous aller aujourd’hui ?'
                  : 'Where are you going today?'}
            </h1>
          </div>

          <form onSubmit={handleSearchSubmit} className="mt-4">
            <div data-surface="card" className="flex items-center gap-1.5 rounded-full border border-line bg-surface p-1.5 shadow-lg pointer-coarse:gap-2 pointer-coarse:p-2 transition-shadow focus-within:border-brand-500 focus-within:shadow-md">
              <Search className="ms-2 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={localize('Search a city or place', 'ابحث عن مدينة أو مكان', 'Rechercher une ville ou un lieu')}
                aria-label={localize('Search places', 'البحث عن أماكن', 'Rechercher des lieux')}
                className="min-w-0 flex-1 bg-transparent py-2 text-body font-semibold text-ink outline-none placeholder:font-medium placeholder:text-muted pointer-coarse:min-h-11"
              />
              <button
                type="button"
                onClick={handleMicClick}
                aria-pressed={isListeningMic}
                aria-label={localize('Voice assistant', 'المساعد الصوتي', 'Assistant vocal')}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors pointer-coarse:h-11 pointer-coarse:w-11 ${
                  isListeningMic ? 'bg-negative-fill text-negative-ink' : 'text-muted hover:bg-surface-sunken hover:text-ink'
                }`}
              >
                <Mic className={`h-4 w-4 ${isListeningMic ? 'animate-[sindbad-pulse_1.1s_ease-in-out_infinite]' : ''}`} aria-hidden="true" />
              </button>
              <Button type="submit" size="sm" className="h-9 rounded-full px-3.5 pointer-coarse:h-11" icon={<ArrowUpRight className="h-4 w-4" />}>
                <span className="sr-only sm:not-sr-only">{localize('Search', 'بحث', 'Chercher')}</span>
              </Button>
            </div>
          </form>

          {(voicePending || voiceReply || voiceError) && (
            <div className="mt-2.5 rounded-xl border border-line bg-surface/95 p-3 shadow-sm backdrop-blur" aria-live="polite">
              {voicePending ? (
                <p className="flex items-center gap-2 text-caption text-muted">
                  <span className="sindbad-skeleton inline-block h-3.5 w-3.5 rounded-full" aria-hidden="true" />
                  {localize('Listening to your request…', 'جارٍ تنفيذ طلبك…', 'Traitement de votre demande…')}
                </p>
              ) : voiceError ? (
                <p className="text-caption font-semibold text-negative">{voiceError}</p>
              ) : voiceReply ? (
                <div className="space-y-2.5">
                  <p className="text-caption leading-relaxed font-medium text-ink-soft">{voiceReply.text}</p>
                  {voiceReply.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {voiceReply.actions.map((action) => (
                        <Button key={`${action.target}-${action.label}`} size="sm" variant="secondary" onClick={() => onVoiceAction(action)}>
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          <button
            type="button"
            onClick={onOpenAIChat}
            id="home-ask-ai-btn"
            className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-label font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/20 pointer-coarse:min-h-11 pointer-coarse:px-4"
          >
            <svg viewBox="0 0 28 28" className="h-4 w-4" aria-hidden="true">
              <path d="M14.6 3.2c3.9 2.7 6.4 6.7 7.2 11.5h-7.2z" fill="rgba(255,255,255,0.92)" />
              <path d="M12.6 6.1c-2.4 2.3-4 5.5-4.4 8.6h4.4z" fill="var(--color-sand-400)" />
            </svg>
            {localize('Ask Sindbad to plan it', 'اسأل سندباد لِيخطّطها', 'Demandez à Sindbad de planifier')}
          </button>
        </div>
      </section>

      {/* ---- Utilities: quiet strip, not six competing cards ---- */}
      <section aria-label={localize('Travel tools', 'أدوات السفر', 'Outils de voyage')} className="mx-auto w-full max-w-3xl px-3 sm:px-5">
        <div className="sindbad-scroll-x -mx-3 px-3 sm:mx-0 sm:px-0">
          <ToolChip icon={<Plane className="h-4 w-4" />} label={localize('Flights', 'الطيران', 'Vols')} onClick={onOpenFlights} />
          <ToolChip icon={<Bed className="h-4 w-4" />} label={localize('Stays', 'الإقامات', 'Hébergements')} onClick={() => { onSelectCategory('accommodation'); onNavigateTab('map'); }} />
          <ToolChip icon={<Utensils className="h-4 w-4" />} label={localize('Food', 'المطاعم', 'Restaurants')} onClick={() => { onSelectCategory('restaurant'); onNavigateTab('map'); }} />
          <ToolChip icon={<CloudSun className="h-4 w-4" />} label={localize('Weather', 'الطقس', 'Météo')} onClick={onOpenWeather} />
          <ToolChip icon={<Compass className="h-4 w-4" />} label={localize('Map', 'الخريطة', 'Carte')} onClick={() => onNavigateTab('map')} />
          <ToolChip icon={<CalendarDays className="h-4 w-4" />} label={localize('Trips', 'الرحلات', 'Voyages')} onClick={() => onNavigateTab('trips')} />
        </div>
      </section>

      {tripDestination && (
        <section className="mx-auto w-full max-w-3xl px-3 pt-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-line bg-brand-soft px-3.5 py-2.5">
            <p className="min-w-0 text-caption font-semibold text-brand-accent">
              {localize(
                `Showing places around ${tripDestination.name}`,
                `تعرض أماكن حول ${tripDestination.arabicName || tripDestination.name}`,
                `Lieux autour de ${tripDestination.frenchName || tripDestination.name}`,
              )}
            </p>
            <Button size="sm" variant="secondary" onClick={() => onNavigateTab('explore')}>
              {localize('Open list', 'فتح القائمة', 'Ouvrir la liste')}
            </Button>
          </div>
        </section>
      )}

      {/* ---- Nearby ---- */}
      <section className="mx-auto w-full max-w-3xl px-3 pt-6 sm:px-5" aria-labelledby="home-nearby-title">
        <div className="mb-2.5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 id="home-nearby-title" className="text-h2 font-bold tracking-tight text-ink">
              {localize('Nearby', 'بالقرب منك', 'À proximité')}
            </h2>
            <p className="mt-0.5 truncate text-micro text-muted">{locationLabel}</p>
          </div>
          {hasLocation && featuredPlaces.length > 0 && (
            <button
              id="home-nearby-see-all"
              type="button"
              onClick={() => onNavigateTab('explore')}
              className="inline-flex shrink-0 items-center rounded-lg px-2.5 py-1 text-label font-bold text-brand-accent transition-colors hover:bg-brand-soft pointer-coarse:min-h-11"
            >
              {localize('See all', 'عرض الكل', 'Tout voir')}
            </button>
          )}
        </div>

        {!hasLocation && !tripDestination ? (
          <EmptyState
            tone="dashed"
            icon={<MapPin className="h-5 w-5" aria-hidden="true" />}
            title={localize('Find places around you', 'اعثر على أماكن حولك', 'Trouvez des lieux autour de vous')}
            description={localize('Share your location to see nearby places.', 'شارك موقعك لعرض الأماكن القريبة.', 'Partagez votre position pour voir les lieux proches.')}
            action={
              <>
                {locationPermission !== 'unsupported' && (
                  <Button size="sm" onClick={() => void onRequestLocation()}>
                    {localize('Use my location', 'استخدم موقعي', 'Utiliser ma position')}
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => onNavigateTab('explore')}>
                  {localize('Search instead', 'البحث بدلاً من ذلك', 'Rechercher à la place')}
                </Button>
              </>
            }
          />
        ) : placesLoading && featuredPlaces.length === 0 ? (
          <div className="flex gap-3 overflow-hidden">
            {[0, 1, 2, 3].map((item) => (
              <span key={item} className="sindbad-skeleton h-56 w-40 shrink-0 rounded-3xl sm:w-44" aria-hidden="true" />
            ))}
            <span className="sr-only">{localize('Loading nearby places', 'جارٍ تحميل الأماكن القريبة', 'Chargement des lieux proches')}</span>
          </div>
        ) : featuredPlaces.length === 0 ? (
          <EmptyState
            icon={<Search className="h-5 w-5" aria-hidden="true" />}
            title={localize('No places found here yet', 'لا توجد أماكن هنا بعد', 'Aucun lieu trouvé ici pour le moment')}
            description={localize(
              'Try a nearby city, or add a place so other travelers can find it.',
              'جرّب مدينة قريبة، أو أضف مكاناً ليجده المسافرون الآخرون.',
              'Essayez une ville proche, ou ajoutez un lieu pour les autres voyageurs.',
            )}
            action={
              <Button size="sm" variant="secondary" onClick={() => onNavigateTab('explore')}>
                {localize('Browse places', 'تصفح الأماكن', 'Parcourir les lieux')}
              </Button>
            }
          />
        ) : (
          <div className="sindbad-scroll-x -mx-3 px-3 sm:mx-0 sm:px-0">
            {featuredPlaces.map((place, index) => (
              <PlaceCard
                key={place.id}
                place={place}
                variant="media"
                language={locale.language}
                saved={savedPlaceIds.includes(place.id)}
                onToggleSave={onToggleSave}
                onSelect={onSelectPlace}
                eager={index < 2}
              />
            ))}
          </div>
        )}
      </section>

      {/* ---- Saved ---- */}
      {savedPlaces.length > 0 && (
        <section id="home-saved-section" className="mx-auto w-full scroll-mt-20 px-3 pt-7 sm:px-5" aria-labelledby="home-saved-title">
          <div className="mb-2.5 flex items-end justify-between gap-3">
            <h2 id="home-saved-title" className="text-h2 font-bold tracking-tight text-ink">
              {localize('Saved places', 'أماكن محفوظة', 'Lieux enregistrés')}
            </h2>
            <span className="text-micro font-semibold tabular-nums text-muted">{savedPlaces.length}</span>
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {savedPlaces.slice(0, 4).map((place) => {
              const distance = formatDistance(place.distanceKm, locale.language);
              return (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => onSelectPlace(place)}
                    className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-start transition-colors hover:bg-surface-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-bold text-ink">{placeDisplayName(place, locale.language)}</span>
                      <span className="block truncate text-micro text-muted">{[place.area, distance].filter(Boolean).join(' · ')}</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
};

function userLocationLabel(language: SupportedLanguage, hasLocation: boolean, tripDestination: Place | null) {
  const locale = { isArabic: language === 'ar', isFrench: language === 'fr' };
  const pick = (en: string, ar: string, fr: string) => (locale.isArabic ? ar : locale.isFrench ? fr : en);
  if (tripDestination) return pick(`Around ${tripDestination.name}`, `حول ${tripDestination.arabicName || tripDestination.name}`, `Autour de ${tripDestination.frenchName || tripDestination.name}`);
  if (hasLocation) return pick('Location shared', 'الموقع مفعّل', 'Position partagée');
  return pick('Location off', 'الموقع غير مفعّل', 'Position désactivée');
}

const ToolChip: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-16 w-[5.25rem] shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-surface text-muted shadow-xs transition-colors duration-150 hover:border-line-strong hover:text-brand-accent active:bg-surface-muted"
  >
    <span aria-hidden="true">{icon}</span>
    <span className="max-w-full truncate px-1 text-micro font-bold text-ink-soft">{label}</span>
  </button>
);

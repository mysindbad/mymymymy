import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bed,
  CloudSun,
  Heart,
  Loader2,
  MapPin,
  Menu,
  Mic,
  Plane,
  Search,
  Sparkles,
  Utensils,
} from 'lucide-react';
import { Place } from '../types';
import { SupportedLanguage } from '../data/translations';
import { BrandLogo } from './BrandLogo';
import { PlaceVisual } from './PlaceVisual';
import { UserAvatar } from './UserAvatar';
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
  onOpenAuth?: (screen?: any) => void;
  currentUser?: { name: string; email: string; avatarUrl: string; isLoggedIn?: boolean };
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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [voicePending, setVoicePending] = useState(false);
  const [voiceReply, setVoiceReply] = useState<AssistantNavigationReply | null>(null);
  const [voiceError, setVoiceError] = useState('');
  const [clock, setClock] = useState(() => new Date());
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const localize = (english: string, arabic: string, french: string) =>
    isAr ? arabic : isFr ? french : english;

  const featuredPlaces = useMemo(() => places.slice(0, 5), [places]);
  const hour = clock.getHours();
  const greeting = hour >= 5 && hour < 12
    ? localize('Good morning', 'صباح الخير', 'Bonjour')
    : hour >= 12 && hour < 18
      ? localize('Good afternoon', 'نهارك سعيد', 'Bon après-midi')
      : localize('Good evening', 'مساء الخير', 'Bonsoir');
  const greetingName = currentUser?.isLoggedIn && currentUser.name?.trim() ? `، ${currentUser.name.trim()}` : '';

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
      recognition.lang = isAr ? 'ar-MA' : isFr ? 'fr-FR' : 'en-US';
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
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 pb-28 text-slate-800" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="relative overflow-hidden bg-gradient-to-b from-sky-400 via-sky-300 to-white pb-7 shadow-sm">
        <div className="absolute inset-0">
          <img src="https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1200&auto=format&fit=crop&q=78" alt="Travel scenery" fetchPriority="high" decoding="async" className="h-full w-full object-cover object-top opacity-75" />
          <div className="absolute inset-0 bg-gradient-to-b from-sky-500/25 via-white/5 to-white" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-xl items-center justify-between px-4 pt-3">
          <button id="home-side-menu-btn" type="button" onClick={onOpenSideMenu} className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-md" aria-label={localize('Open menu', 'القائمة', 'Ouvrir le menu')}>
            <Menu className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => currentUser?.isLoggedIn ? onOpenAccount() : onOpenAuth?.('welcome')}
            className="flex items-center gap-2 rounded-full bg-slate-900/90 px-2.5 py-1.5 text-white shadow-sm"
            aria-label={localize('Account', 'الحساب', 'Compte')}
          >
            <UserAvatar name={currentUser?.name} avatarUrl={currentUser?.avatarUrl} className="h-6 w-6" textClassName="text-[9px]" />
            <span className="max-w-24 truncate text-xs font-bold">{currentUser?.name || localize('Traveler', 'مسافر', 'Voyageur')}</span>
          </button>
        </div>

        <div className="relative z-10 mx-auto max-w-md px-4 py-2">
          <BrandLogo size="lg" showSlogan={false} language={language} />
          <p className="mt-1 text-center text-sm font-black text-slate-900 drop-shadow-sm" data-home-greeting="true">{greeting}{greetingName}</p>
        </div>

        <div className="relative z-10 mx-auto max-w-xl space-y-2 px-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1.5 ps-3.5 shadow-lg focus-within:ring-2 focus-within:ring-blue-500">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={localize('Search places', 'ابحث عن مكان', 'Rechercher un lieu')} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-slate-400" />
            <button type="button" onClick={handleMicClick} aria-pressed={isListeningMic} aria-label={localize('Voice assistant', 'المساعد الصوتي', 'Assistant vocal')} className={`rounded-full p-2 ${isListeningMic ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-500 hover:bg-slate-100'}`}>
              <Mic className="h-4 w-4" />
            </button>
            <button id="home-ask-ai-btn" type="button" onClick={onOpenAIChat} className="flex items-center gap-1 rounded-full bg-blue-600 px-3 py-2 text-xs font-bold text-white">
              <Sparkles className="h-3 w-3" />
              {localize('Ask', 'اسأل', 'Demander')}
            </button>
          </form>

          {(voicePending || voiceReply || voiceError) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" aria-live="polite">
              {voicePending ? <div className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin text-blue-600" />{localize('Processing…', 'جارٍ المعالجة…', 'Traitement…')}</div> : voiceError ? <p className="text-sm font-medium text-rose-700">{voiceError}</p> : voiceReply ? <div className="space-y-2"><p className="text-sm font-medium text-slate-800">{voiceReply.text}</p>{voiceReply.actions.length > 0 && <div className="flex flex-wrap gap-2">{voiceReply.actions.map((action) => <button type="button" key={`${action.target}-${action.label}`} onClick={() => onVoiceAction(action)} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">{action.label}</button>)}</div>}</div> : null}
            </div>
          )}
        </div>
      </div>

      <div className="relative z-20 mx-auto -mt-2 max-w-2xl px-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <HomeAction icon={<Plane className="h-5 w-5" />} label={localize('Flights', 'الطيران', 'Vols')} onClick={onOpenFlights} />
            <HomeAction icon={<Bed className="h-5 w-5" />} label={localize('Stays', 'الإقامات', 'Hébergements')} onClick={() => { onSelectCategory('accommodation'); onNavigateTab('map'); }} />
            <HomeAction icon={<MapPin className="h-5 w-5" />} label={localize('Trips', 'الرحلات', 'Voyages')} onClick={() => onNavigateTab('trips')} />
            <HomeAction icon={<Utensils className="h-5 w-5" />} label={localize('Restaurants', 'المطاعم', 'Restaurants')} onClick={() => { onSelectCategory('restaurant'); onNavigateTab('map'); }} />
            <HomeAction icon={<CloudSun className="h-5 w-5" />} label={localize('Weather', 'الطقس', 'Météo')} onClick={onOpenWeather} />
            <HomeAction icon={<Search className="h-5 w-5" />} label={localize('Explore', 'استكشف', 'Explorer')} onClick={() => onNavigateTab('explore')} />
          </div>
        </div>
      </div>

      <section className="mx-auto mt-6 max-w-2xl px-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-black text-slate-900">{localize('Nearby places', 'أماكن قريبة', 'Lieux proches')}</h2>
          {hasLocation && <button id="home-nearby-see-all" type="button" onClick={() => onNavigateTab('explore')} className="text-xs font-bold text-blue-600">{localize('See all', 'عرض الكل', 'Tout voir')}</button>}
        </div>

        {!hasLocation ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <MapPin className="mx-auto mb-2 h-6 w-6 text-blue-600" />
            <p className="text-sm font-bold text-slate-800">{localize('Share your location to see nearby places.', 'شارك موقعك لعرض الأماكن القريبة.', 'Partagez votre localisation pour voir les lieux proches.')}</p>
            {locationPermission !== 'unsupported' && <button type="button" onClick={() => void onRequestLocation()} className="mt-3 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">{localize('Use my location', 'استخدم موقعي', 'Utiliser ma localisation')}</button>}
          </div>
        ) : featuredPlaces.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-500">{localize('No nearby places found.', 'لم يتم العثور على أماكن قريبة.', 'Aucun lieu proche trouvé.')}</div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {featuredPlaces.map((place) => {
              const isSaved = savedPlaceIds.includes(place.id);
              return <article key={place.id} onClick={() => onSelectPlace(place)} className="relative h-52 w-40 shrink-0 cursor-pointer overflow-hidden rounded-3xl bg-slate-200 shadow-sm sm:w-48">
                <PlaceVisual place={place} language={language} className="h-full w-full" imageClassName="h-full w-full object-cover" showFallbackLabel={false} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/10" />
                <button type="button" onClick={(event) => { event.stopPropagation(); onToggleSave(place.id); }} aria-label={isSaved ? localize('Remove saved place', 'إزالة من المحفوظات', 'Retirer des favoris') : localize('Save place', 'حفظ المكان', 'Enregistrer le lieu')} className={`absolute end-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full ${isSaved ? 'bg-rose-500' : 'bg-black/40'} text-white`}><Heart className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} /></button>
                <div className="absolute inset-x-3 bottom-3 text-white"><h3 className="font-bold leading-tight">{isAr && place.arabicName ? place.arabicName : isFr && place.frenchName ? place.frenchName : place.name}</h3><p className="mt-1 text-xs text-slate-200">{place.area || place.region}{typeof place.distanceKm === 'number' ? ` · ${place.distanceKm < 10 ? place.distanceKm.toFixed(1) : Math.round(place.distanceKm)} km` : ''}</p></div>
              </article>;
            })}
          </div>
        )}
      </section>
    </div>
  );
};

const HomeAction: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button type="button" onClick={onClick} className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl p-2 text-center text-blue-600 transition hover:bg-slate-50 active:scale-95">
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">{icon}</span>
    <span className="text-[11px] font-bold text-slate-800">{label}</span>
  </button>
);

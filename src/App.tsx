import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Compass, Home as HomeIcon, Loader2, ShoppingBag, User } from 'lucide-react';
import { Place } from './types';
import { SupportedLanguage } from './data/translations';
import { fetchPlaces, sendChatMessage } from './services/api';
import { AUTH_CALLBACK_PATH, supabase } from './lib/supabase';
import { signOut, useAuthSession } from './lib/authSession';
import { HomeScreen } from './components/HomeScreen';
import type { AuthScreenType } from './components/AuthFlowModal';
import { AIIcon } from './components/AIIcon';
import { hasCompletedOnboarding } from './components/OnboardingModal';
import { useGeolocation } from './hooks/useGeolocation';
import { usePwaInstall } from './hooks/usePwaInstall';
import { filterNearbyPlaces, filterPlacesForTrip } from './lib/placeContext';
import {
  AppNavigationAction,
  AssistantNavigationReply,
  destinationVoiceReply,
  extractDestinationIntent,
  resolveAppNavigationHelp,
} from './lib/appNavigation';

const ContextMapView = lazy(() => import('./components/ContextMapView').then((module) => ({ default: module.ContextMapView })));
const ExploreFeed = lazy(() => import('./components/ExploreFeed').then((module) => ({ default: module.ExploreFeed })));
const TripsPlanner = lazy(() => import('./components/TripsPlanner').then((module) => ({ default: module.TripsPlanner })));
const CommunityHub = lazy(() => import('./components/CommunityHub').then((module) => ({ default: module.CommunityHub })));
const NavigationFlow = lazy(() => import('./components/NavigationFlow').then((module) => ({ default: module.NavigationFlow })));
const PlaceDetailModal = lazy(() => import('./components/PlaceDetailModal').then((module) => ({ default: module.PlaceDetailModal })));
const AIChatModal = lazy(() => import('./components/AIChatModal').then((module) => ({ default: module.AIChatModal })));
const AddPlaceModal = lazy(() => import('./components/AddPlaceModal').then((module) => ({ default: module.AddPlaceModal })));
const PassiveDataModal = lazy(() => import('./components/PassiveDataModal').then((module) => ({ default: module.PassiveDataModal })));
const SideMenuDrawer = lazy(() => import('./components/SideMenuDrawer').then((module) => ({ default: module.SideMenuDrawer })));
const FlightsModal = lazy(() => import('./components/FlightsModal').then((module) => ({ default: module.FlightsModal })));
const WeatherModal = lazy(() => import('./components/WeatherModal').then((module) => ({ default: module.WeatherModal })));
const AuthFlowModal = lazy(() => import('./components/AuthFlowModal').then((module) => ({ default: module.AuthFlowModal })));
const OnboardingModal = lazy(() => import('./components/OnboardingModal').then((module) => ({ default: module.OnboardingModal })));
const AccountProfilePage = lazy(() => import('./components/AccountProfilePage').then((module) => ({ default: module.AccountProfilePage })));

type ActiveTab = 'home' | 'explore' | 'trips' | 'community' | 'account';
type ExploreView = 'feed' | 'map';
const PASSIVE_GPS_CONSENT_KEY = 'sindbad_passive_gps_consent';
const LANGUAGE_KEY = 'sindbad_language';

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  isLoggedIn: boolean;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [places, setPlaces] = useState<Place[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activeNavDestination, setActiveNavDestination] = useState<Place | null>(null);
  const [exploreView, setExploreView] = useState<ExploreView>('feed');
  const [exploreQuery, setExploreQuery] = useState('');
  const [exploreCategory, setExploreCategory] = useState('All');
  const [tripDestination, setTripDestination] = useState<Place | null>(null);
  const [tripInitialQuery, setTripInitialQuery] = useState('');

  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [isAddPlaceOpen, setIsAddPlaceOpen] = useState(false);
  const [isPassiveModalOpen, setIsPassiveModalOpen] = useState(false);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [isFlightsOpen, setIsFlightsOpen] = useState(false);
  const [isWeatherOpen, setIsWeatherOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [authInitialScreen, setAuthInitialScreen] = useState<AuthScreenType>('welcome');
  const { status: authStatus, user: authUser } = useAuthSession();

  const currentUser: CurrentUser = authUser
    ? { id: authUser.id, name: authUser.name, email: authUser.email, avatarUrl: authUser.avatarUrl, isLoggedIn: true }
    : { id: '', name: '', email: '', avatarUrl: '', isLoggedIn: false };

  const [language, setLanguage] = useState<SupportedLanguage>(() => {
    try {
      const stored = localStorage.getItem(LANGUAGE_KEY);
      return stored === 'ar' || stored === 'fr' || stored === 'en' ? stored : 'en';
    } catch {
      return 'en';
    }
  });
  const [currency] = useState('MAD');
  const [isPassiveOptedIn, setIsPassiveOptedIn] = useState(() => {
    try { return localStorage.getItem(PASSIVE_GPS_CONSENT_KEY) === 'true'; } catch { return false; }
  });
  const [savedPlaceIds, setSavedPlaceIds] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('sindbad_saved_ids') || '[]');
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch { return []; }
  });

  const { location: userLocation, permission, requestPermission } = useGeolocation();
  const { canInstall, promptInstall, showIosHint: showIosInstallHint, dismissIosHint: dismissIosInstallHint } = usePwaInstall();
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const shellText = (en: string, ar: string, fr: string) => isAr ? ar : isFr ? fr : en;

  const handlePassiveOptInChange = (optedIn: boolean) => {
    setIsPassiveOptedIn(optedIn);
    try { localStorage.setItem(PASSIVE_GPS_CONSENT_KEY, String(optedIn)); } catch { /* session state still works */ }
  };

  useEffect(() => {
    try { localStorage.setItem(LANGUAGE_KEY, language); } catch { /* ignore storage failure */ }
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, isAr]);

  useEffect(() => {
    if (authStatus !== 'authed' || !currentUser.id) {
      setIsOnboardingOpen(false);
      return;
    }
    setIsOnboardingOpen(!hasCompletedOnboarding(currentUser.id));
  }, [authStatus, currentUser.id]);

  useEffect(() => {
    if (permission === 'granted' && !userLocation) void requestPermission();
  }, [permission, userLocation]);

  const loadNearbyPlaces = async () => {
    if (!userLocation) {
      setPlaces([]);
      setPlacesError(null);
      setPlacesLoading(false);
      return;
    }
    setPlacesLoading(true);
    setPlacesError(null);
    try {
      const all = await fetchPlaces({ userLat: userLocation.latitude, userLng: userLocation.longitude });
      setPlaces(filterNearbyPlaces(all, userLocation));
    } catch (error) {
      setPlaces([]);
      setPlacesError(error instanceof Error ? error.message : 'Failed to load places');
    } finally {
      setPlacesLoading(false);
    }
  };

  useEffect(() => {
    if (tripDestination) return;
    if (userLocation) void loadNearbyPlaces();
    else {
      setPlaces([]);
      setPlacesLoading(false);
      setPlacesError(null);
    }
  }, [userLocation?.latitude, userLocation?.longitude, tripDestination?.id]);

  useEffect(() => {
    const resolveAuthCallback = async () => {
      const callbackUrl = new URL(window.location.href);
      if (callbackUrl.pathname !== AUTH_CALLBACK_PATH) return;
      const code = callbackUrl.searchParams.get('code');
      const callbackMode = callbackUrl.searchParams.get('mode');
      let exchangeSucceeded = !code;
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        exchangeSucceeded = !error;
        if (error) console.error('Supabase auth callback failed:', error);
      }
      window.history.replaceState({}, document.title, '/');
      if (callbackMode === 'recovery' && exchangeSucceeded) {
        setAuthInitialScreen('reset-password');
        setIsAuthOpen(true);
      }
    };
    void resolveAuthCallback();
  }, []);

  const handleToggleSave = (placeId: string) => {
    setSavedPlaceIds((current) => {
      const next = current.includes(placeId) ? current.filter((id) => id !== placeId) : [...current, placeId];
      try { localStorage.setItem('sindbad_saved_ids', JSON.stringify(next)); } catch { /* session state still works */ }
      return next;
    });
  };

  const handlePlaceAdded = (newPlace: Place) => {
    setPlaces((current) => [newPlace, ...current.filter((place) => place.id !== newPlace.id)]);
    setSelectedPlace(newPlace);
  };

  const handleDestinationSelect = (name: string) => {
    const query = name.trim();
    if (!query) return;
    setTripDestination(null);
    setExploreQuery(query);
    setExploreCategory('All');
    setExploreView('feed');
    setActiveTab('explore');
  };

  const handleTripCreated = async (destination: Place) => {
    setTripDestination(destination);
    setExploreQuery('');
    setExploreCategory('All');
    setExploreView('feed');
    setPlacesLoading(true);
    setPlacesError(null);
    try {
      const all = await fetchPlaces({ userLat: destination.coordinates[0], userLng: destination.coordinates[1] });
      setPlaces(filterPlacesForTrip(all, destination, userLocation));
    } catch (error) {
      setPlaces([]);
      setPlacesError(error instanceof Error ? error.message : 'Failed to load trip places');
    } finally {
      setPlacesLoading(false);
      setActiveTab('explore');
    }
  };

  const handleOpenAuth = (screen: AuthScreenType = 'welcome') => {
    setAuthInitialScreen(screen);
    setIsAuthOpen(true);
  };

  const handleAppAction = (action: AppNavigationAction) => {
    switch (action.target) {
      case 'home':
        setActiveTab('home');
        break;
      case 'explore':
        setTripDestination(null);
        setExploreQuery(action.query || '');
        setExploreCategory('All');
        setExploreView('feed');
        setActiveTab('explore');
        break;
      case 'map':
        setTripDestination(null);
        setExploreQuery(action.query || '');
        setExploreCategory('All');
        setExploreView('map');
        setActiveTab('explore');
        break;
      case 'trips':
        setTripInitialQuery(action.query || '');
        setActiveTab('trips');
        break;
      case 'community':
        setActiveTab('community');
        break;
      case 'account':
        setActiveTab('account');
        break;
      case 'add-place':
        setIsAddPlaceOpen(true);
        break;
      case 'flights':
        setIsFlightsOpen(true);
        break;
      case 'weather':
        setIsWeatherOpen(true);
        break;
    }
  };

  const handleVoiceCommand = async (message: string): Promise<AssistantNavigationReply> => {
    const navigationHelp = resolveAppNavigationHelp(message, language);
    if (navigationHelp) return navigationHelp;
    const destination = extractDestinationIntent(message, language);
    if (destination) return destinationVoiceReply(destination, language);
    if (authStatus !== 'authed') {
      return {
        text: shellText('Sign in to ask Sindbad open-ended questions.', 'سجّل الدخول لطرح أسئلة مفتوحة على سندباد.', 'Connectez-vous pour poser une question à Sindbad.'),
        actions: [{ target: 'account', label: shellText('Account', 'الحساب', 'Compte') }],
      };
    }
    const text = await sendChatMessage(message, shellText('Travel and destinations', 'السفر والوجهات', 'Voyages et destinations'), language, []);
    return { text, actions: [] };
  };

  const navigatePrimary = (tab: 'home' | 'explore' | 'map' | 'trips' | 'community') => {
    if (tab === 'map') {
      setExploreView('map');
      setActiveTab('explore');
    } else if (tab === 'explore') {
      setExploreView('feed');
      setActiveTab('explore');
    } else {
      setActiveTab(tab);
    }
  };

  const topBar = (title: string) => (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
      <button type="button" onClick={() => setActiveTab('home')} className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">← {shellText('Home', 'الرئيسية', 'Accueil')}</button>
      <h2 className="text-sm font-black text-slate-900">{title}</h2><div className="w-16" />
    </div>
  );

  const loadingFallback = (
    <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      {shellText('Loading…', 'جارٍ التحميل…', 'Chargement…')}
    </div>
  );

  return (
    <div className={`flex min-h-screen flex-col bg-slate-100 font-sans ${isAr ? 'rtl' : 'ltr'}`}>
      {placesLoading && <div className="fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-lg">{shellText('Loading places…', 'جارٍ تحميل الأماكن…', 'Chargement des lieux…')}</div>}
      {placesError && <div className="fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-800 shadow-lg"><span>{shellText('Could not load places', 'تعذر تحميل الأماكن', 'Impossible de charger les lieux')}</span>{userLocation && !tripDestination && <button type="button" onClick={() => void loadNearbyPlaces()} className="rounded-lg bg-rose-600 px-2.5 py-1 text-white">{shellText('Retry', 'إعادة', 'Réessayer')}</button>}</div>}

      <main className="relative flex-1 overflow-hidden">
        {activeTab === 'home' && <HomeScreen
          onOpenAIChat={() => setIsAIChatOpen(true)}
          onNavigateTab={navigatePrimary}
          onSelectCategory={(category) => { setTripDestination(null); setExploreQuery(''); setExploreCategory(category); setExploreView('map'); setActiveTab('explore'); }}
          onSelectDestination={handleDestinationSelect}
          onOpenFlights={() => setIsFlightsOpen(true)}
          onOpenWeather={() => setIsWeatherOpen(true)}
          onOpenSideMenu={() => setIsSideMenuOpen(true)}
          onOpenAccount={() => setActiveTab('account')}
          onSelectPlace={setSelectedPlace}
          onToggleSave={handleToggleSave}
          onVoiceCommand={handleVoiceCommand}
          onVoiceAction={handleAppAction}
          onRequestLocation={requestPermission}
          places={places}
          savedPlaceIds={savedPlaceIds}
          hasLocation={Boolean(userLocation)}
          locationPermission={permission}
          language={language}
          onOpenAuth={handleOpenAuth}
          currentUser={currentUser}
        />}

        <Suspense fallback={loadingFallback}>
          {activeTab === 'explore' && <div className="h-full w-full overflow-y-auto">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5"><button type="button" onClick={() => setActiveTab('home')} className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">← {shellText('Home', 'الرئيسية', 'Accueil')}</button><h2 className="truncate text-sm font-black text-slate-900">{exploreView === 'feed' ? shellText('Explore', 'استكشف', 'Explorer') : shellText('Map', 'الخريطة', 'Carte')}</h2><button type="button" onClick={() => setExploreView((current) => current === 'feed' ? 'map' : 'feed')} className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700">{exploreView === 'feed' ? shellText('Map', 'الخريطة', 'Carte') : shellText('List', 'القائمة', 'Liste')}</button></div>
            {exploreView === 'feed' ? <ExploreFeed
              initialQuery={exploreQuery}
              onSelectPlace={setSelectedPlace}
              onStartRoute={setActiveNavDestination}
              onOpenAddModal={() => setIsAddPlaceOpen(true)}
              onOpenPassiveModal={() => setIsPassiveModalOpen(true)}
              savedPlaceIds={savedPlaceIds}
              onToggleSave={handleToggleSave}
              language={language}
              currency={currency}
              userLocation={userLocation}
              tripDestination={tripDestination}
              onPlacesLoaded={setPlaces}
            /> : <ContextMapView
              places={places}
              initialQuery={exploreQuery}
              initialCategory={exploreCategory}
              onSelectPlace={setSelectedPlace}
              onStartRoute={setActiveNavDestination}
              language={language}
              userLocation={userLocation}
            />}
          </div>}

          {activeTab === 'trips' && <div className="h-full w-full overflow-y-auto">{topBar(shellText('My Trips', 'رحلاتي', 'Mes voyages'))}<TripsPlanner language={language} authStatus={authStatus} onOpenAuth={() => handleOpenAuth('welcome')} onTripCreated={(destination) => void handleTripCreated(destination)} initialDestinationQuery={tripInitialQuery} /></div>}

          {activeTab === 'community' && <div className="h-full w-full overflow-y-auto">{topBar(shellText('Community', 'المجتمع', 'Communauté'))}<CommunityHub onOpenAddModal={() => setIsAddPlaceOpen(true)} onOpenPassiveModal={() => setIsPassiveModalOpen(true)} isPassiveOptedIn={isPassiveOptedIn} language={language} /></div>}

          {activeTab === 'account' && <div className="h-full w-full overflow-y-auto"><AccountProfilePage
            language={language}
            onLanguageChange={setLanguage}
            authStatus={authStatus}
            authUser={authUser}
            userLocation={userLocation}
            locationPermission={permission}
            onRequestLocation={requestPermission}
            isPassiveOptedIn={isPassiveOptedIn}
            onOpenPassiveGps={() => setIsPassiveModalOpen(true)}
            savedPlacesCount={savedPlaceIds.length}
            canInstall={canInstall}
            onInstall={() => { void promptInstall(); }}
            onOpenAuth={() => handleOpenAuth('welcome')}
            onSignOut={async () => { await signOut(); setActiveTab('home'); }}
            onBack={() => setActiveTab('home')}
          /></div>}
        </Suspense>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-2 shadow-[0_-8px_25px_rgba(0,0,0,0.06)] backdrop-blur-xl">
        <div className="relative mx-auto flex max-w-md items-end justify-between px-2">
          <BottomTab id="tab-home" active={activeTab === 'home'} label={shellText('Home', 'الرئيسية', 'Accueil')} icon={<HomeIcon className="h-5 w-5" />} onClick={() => setActiveTab('home')} />
          <BottomTab id="tab-explore" active={activeTab === 'explore'} label={shellText('Explore', 'استكشف', 'Explorer')} icon={<Compass className="h-5 w-5" />} onClick={() => { setExploreView('feed'); setActiveTab('explore'); }} />
          <button id="tab-ai-assistant" type="button" onClick={() => setIsAIChatOpen(true)} className="flex flex-col items-center gap-1 px-3 py-0.5 text-blue-600"><AIIcon size={22} variant="badge" /><span className="text-[11px] font-extrabold">AI</span></button>
          <BottomTab id="tab-trips" active={activeTab === 'trips'} label={shellText('Trips', 'رحلاتي', 'Voyages')} icon={<ShoppingBag className="h-5 w-5" />} onClick={() => setActiveTab('trips')} />
          <BottomTab id="tab-profile" active={activeTab === 'account'} label={shellText('Profile', 'حسابي', 'Compte')} icon={<User className="h-5 w-5" />} onClick={() => setActiveTab('account')} />
        </div>
      </nav>

      <Suspense fallback={null}>
        <SideMenuDrawer
          isOpen={isSideMenuOpen}
          onClose={() => setIsSideMenuOpen(false)}
          onNavigateTab={navigatePrimary}
          onOpenAccount={() => setActiveTab('account')}
          onOpenAddPlace={() => setIsAddPlaceOpen(true)}
          onOpenPassiveGps={() => setIsPassiveModalOpen(true)}
          language={language}
          onOpenAuth={handleOpenAuth}
          authStatus={authStatus}
          authUser={authUser}
          canInstall={canInstall}
          onInstall={() => { void promptInstall(); }}
          showIosInstallHint={showIosInstallHint}
          onDismissIosInstallHint={dismissIosInstallHint}
        />

        <AuthFlowModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} initialScreen={authInitialScreen} language={language} onToggleLanguage={setLanguage} onAuthSuccess={() => {}} />
        {isOnboardingOpen && authStatus === 'authed' && currentUser.id && <OnboardingModal userId={currentUser.id} language={language} onLanguageChange={setLanguage} userLocation={userLocation} permission={permission} requestPermission={requestPermission} onComplete={() => setIsOnboardingOpen(false)} />}
        <FlightsModal isOpen={isFlightsOpen} onClose={() => setIsFlightsOpen(false)} language={language} />
        <WeatherModal isOpen={isWeatherOpen} onClose={() => setIsWeatherOpen(false)} language={language} />

        {activeNavDestination && <NavigationFlow destination={activeNavDestination} onClose={() => setActiveNavDestination(null)} onArrivedExplore={(place) => { setActiveNavDestination(null); setSelectedPlace(place); }} onSavePlace={handleToggleSave} isSaved={savedPlaceIds.includes(activeNavDestination.id)} language={language} />}

        <PlaceDetailModal place={selectedPlace} onClose={() => setSelectedPlace(null)} onStartNavigation={(place) => { setSelectedPlace(null); setActiveNavDestination(place); }} onSaveToggle={handleToggleSave} isSaved={selectedPlace ? savedPlaceIds.includes(selectedPlace.id) : false} onPlaceUpdated={(updated) => { setPlaces((current) => current.map((place) => place.id === updated.id ? updated : place)); setSelectedPlace(updated); }} language={language} currency={currency} />

        <AIChatModal isOpen={isAIChatOpen} onClose={() => setIsAIChatOpen(false)} destination={shellText('Travel and destinations', 'السفر والوجهات', 'Voyages et destinations')} onNavigateApp={handleAppAction} language={language} />
        <AddPlaceModal isOpen={isAddPlaceOpen} onClose={() => setIsAddPlaceOpen(false)} onPlaceAdded={handlePlaceAdded} language={language} />
        <PassiveDataModal isOpen={isPassiveModalOpen} onClose={() => setIsPassiveModalOpen(false)} isOptedIn={isPassiveOptedIn} onToggleOptIn={handlePassiveOptInChange} language={language} />
      </Suspense>
    </div>
  );
}

const BottomTab: React.FC<{ id: string; active: boolean; label: string; icon: React.ReactNode; onClick: () => void }> = ({ id, active, label, icon, onClick }) => (
  <button id={id} type="button" onClick={onClick} className={`flex flex-col items-center gap-1 px-3 py-0.5 transition ${active ? 'font-bold text-blue-600' : 'font-medium text-slate-400 hover:text-slate-600'}`}>{icon}<span className="text-[11px] leading-none">{label}</span></button>
);

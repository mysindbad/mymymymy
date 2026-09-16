import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { Place } from './types';
import { SupportedLanguage } from './data/translations';
import { fetchPlaces, sendChatMessage } from './services/api';
import { AUTH_CALLBACK_PATH, supabase } from './lib/supabase';
import { signOut, useAuthSession } from './lib/authSession';
import { HomeScreen } from './components/HomeScreen';
import type { AuthScreenType } from './components/AuthFlowModal';
import { ScreenHeader } from './ui/ScreenHeader';
import { PrimaryNav, PrimaryNavTab } from './components/PrimaryNav';
import { Button, IconButton } from './ui/Button';
import { ToastRegion } from './ui/toast';
import { Alert } from './ui/Feedback';
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
  const shellText = (en: string, ar: string, fr: string) => (isAr ? ar : isFr ? fr : en);

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

  const navigatePrimary = (tab: 'home' | 'explore' | 'map' | 'trips' | 'community' | 'account') => {
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

  /** Saved places live on the home screen, so the account page jumps there. */
  const handleOpenSavedPlaces = () => {
    navigatePrimary('home');
    window.setTimeout(() => {
      document.getElementById('home-saved-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 90);
  };

  const handleNavSelect = (tab: PrimaryNavTab) => {
    if (tab === 'assistant') {
      setIsAIChatOpen(true);
      return;
    }
    navigatePrimary(tab);
  };

  const navActiveTab: PrimaryNavTab = activeTab === 'explore' && exploreView === 'map' ? 'explore' : activeTab;
  // The map paints its own chrome-aware height, so it must not inherit the nav clearance.
  const isMapSurface = activeTab === 'explore' && exploreView === 'map';

  const loadingFallback = (
    <div className="px-3 py-6 sm:px-5">
      <div className="mx-auto max-w-2xl space-y-3">
        <span className="sindbad-skeleton block h-6 w-40 rounded-md" />
        <span className="sindbad-skeleton block h-24 w-full rounded-xl" />
        <span className="sindbad-skeleton block h-24 w-full rounded-xl" />
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas text-ink-soft">
      <a
        href="#sindbad-main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-label focus:font-bold focus:text-ink focus:shadow-lg"
      >
        {shellText('Skip to content', 'تخطَّ إلى المحتوى', 'Aller au contenu')}
      </a>

      <PrimaryNav
        activeTab={navActiveTab}
        language={language}
        onSelectTab={handleNavSelect}
        onOpenMenu={() => setIsSideMenuOpen(true)}
        authUser={authUser}
        isSignedIn={currentUser.isLoggedIn}
        onOpenAuth={() => handleOpenAuth('welcome')}
      />

      <div className="flex min-h-dvh w-full min-w-0 flex-col">
        {placesLoading && (
          <div
            className="fixed inset-x-0 top-0 z-[55] h-0.5 overflow-hidden bg-brand-soft"
            role="progressbar"
            aria-label={shellText('Loading places', 'جارٍ تحميل الأماكن', 'Chargement des lieux')}
          >
            <span className="block h-full w-1/3 animate-[sindbad-progress_1.1s_var(--ease-glide)_infinite] bg-brand-fill" />
          </div>
        )}

        <main
          id="sindbad-main"
          className={`relative min-w-0 flex-1 ${isMapSurface ? '' : 'pb-[calc(var(--sindbad-chrome-h)+env(safe-area-inset-bottom,0px))] lg:pb-0'}`}
        >
          {placesError && (
            <div className="mx-auto w-full max-w-6xl px-3 pt-3 sm:px-5">
              <Alert
                tone="error"
                action={userLocation && !tripDestination ? (
                  <Button size="sm" variant="secondary" onClick={() => void loadNearbyPlaces()}>
                    {shellText('Retry', 'إعادة المحاولة', 'Réessayer')}
                  </Button>
                ) : undefined}
              >
                {shellText(
                  'Places could not be loaded. Check your connection and try again.',
                  'تعذر تحميل الأماكن. تحقق من الاتصال وأعد المحاولة.',
                  'Impossible de charger les lieux. Vérifiez votre connexion puis réessayez.',
                )}
              </Alert>
            </div>
          )}

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
            placesLoading={placesLoading}
            tripDestination={tripDestination}
          />}

          <Suspense fallback={loadingFallback}>
            {activeTab === 'explore' && (
              <div className="flex h-full w-full flex-col">
                <ScreenHeader
                  title={exploreView === 'feed'
                    ? shellText('Explore', 'استكشف', 'Explorer')
                    : shellText('Map', 'الخريطة', 'Carte')}
                  subtitle={tripDestination
                    ? shellText(`Places around ${tripDestination.name}`, `أماكن حول ${tripDestination.arabicName || tripDestination.name}`, `Lieux autour de ${tripDestination.frenchName || tripDestination.name}`)
                    : undefined}
                  actions={
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setExploreView((current) => (current === 'feed' ? 'map' : 'feed'))}
                      >
                        {exploreView === 'feed' ? shellText('Map', 'الخريطة', 'Carte') : shellText('List', 'القائمة', 'Liste')}
                      </Button>
                      <IconButton
                        label={shellText('Menu', 'القائمة', 'Menu')}
                        size="sm"
                        variant="ghost"
                        className="lg:hidden"
                        onClick={() => setIsSideMenuOpen(true)}
                      >
                        <Menu className="h-4 w-4" />
                      </IconButton>
                    </>
                  }
                />
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
                  onSwitchToMap={() => setExploreView('map')}
                  globalPlaces={places}
                /> : <ContextMapView
                  places={places}
                  isLoading={placesLoading}
                  initialQuery={exploreQuery}
                  initialCategory={exploreCategory}
                  onSelectPlace={setSelectedPlace}
                  onStartRoute={setActiveNavDestination}
                  language={language}
                  userLocation={userLocation}
                  onOpenList={() => setExploreView('feed')}
                />}
              </div>
            )}

            {activeTab === 'trips' && <TripsPlanner language={language} authStatus={authStatus} onOpenAuth={() => handleOpenAuth('welcome')} onTripCreated={(destination) => void handleTripCreated(destination)} initialDestinationQuery={tripInitialQuery} />}

            {activeTab === 'community' && (
              <CommunityHub
                onOpenAddModal={() => setIsAddPlaceOpen(true)}
                onOpenPassiveModal={() => setIsPassiveModalOpen(true)}
                isPassiveOptedIn={isPassiveOptedIn}
                language={language}
                onExploreRegion={() => navigatePrimary('map')}
              />
            )}

            {activeTab === 'account' && <div className="min-h-dvh"><AccountProfilePage
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
              onOpenSaved={handleOpenSavedPlaces}
              canInstall={canInstall}
              onInstall={() => { void promptInstall(); }}
              onOpenAuth={() => handleOpenAuth('welcome')}
              onSignOut={async () => { await signOut(); setActiveTab('home'); }}
              onBack={() => setActiveTab('home')}
            /></div>}
          </Suspense>
        </main>
      </div>

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
        <WeatherModal isOpen={isWeatherOpen} onClose={() => setIsWeatherOpen(false)} language={language} userLocation={userLocation} tripDestination={tripDestination} places={places} />

        {activeNavDestination && <NavigationFlow destination={activeNavDestination} onClose={() => setActiveNavDestination(null)} onArrivedExplore={(place) => { setActiveNavDestination(null); setSelectedPlace(place); }} onSavePlace={handleToggleSave} isSaved={savedPlaceIds.includes(activeNavDestination.id)} language={language} />}

        <PlaceDetailModal place={selectedPlace} onClose={() => setSelectedPlace(null)} onStartNavigation={(place) => { setSelectedPlace(null); setActiveNavDestination(place); }} onSaveToggle={handleToggleSave} isSaved={selectedPlace ? savedPlaceIds.includes(selectedPlace.id) : false} onPlaceUpdated={(updated) => { setPlaces((current) => current.map((place) => place.id === updated.id ? updated : place)); setSelectedPlace(updated); }} language={language} currency={currency} onOpenMap={() => { setSelectedPlace(null); setExploreView('map'); setActiveTab('explore'); }} />

        <AIChatModal isOpen={isAIChatOpen} onClose={() => setIsAIChatOpen(false)} destination={shellText('Travel and destinations', 'السفر والوجهات', 'Voyages et destinations')} onNavigateApp={handleAppAction} language={language} />
        <AddPlaceModal
          isOpen={isAddPlaceOpen}
          onClose={() => setIsAddPlaceOpen(false)}
          onPlaceAdded={handlePlaceAdded}
          language={language}
          onOpenAuth={() => {
            setIsAddPlaceOpen(false);
            handleOpenAuth('welcome');
          }}
        />
        <PassiveDataModal
          isOpen={isPassiveModalOpen}
          onClose={() => setIsPassiveModalOpen(false)}
          isOptedIn={isPassiveOptedIn}
          onToggleOptIn={handlePassiveOptInChange}
          language={language}
          onOpenAuth={() => {
            setIsPassiveModalOpen(false);
            handleOpenAuth('welcome');
          }}
        />
      </Suspense>

      <ToastRegion />
    </div>
  );
}


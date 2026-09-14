import React, { useState, useEffect } from 'react';
import {
  Home as HomeIcon,
  Compass,
  ShoppingBag,
  User,
  Radio,
  Plus
} from 'lucide-react';
import { Place } from './types';
import { fetchPlaces } from './services/api';
import { AUTH_CALLBACK_PATH, supabase } from './lib/supabase';
import { signOut, useAuthSession } from './lib/authSession';

import { HomeScreen } from './components/HomeScreen';
import { MapView } from './components/MapView';
import { ExploreFeed } from './components/ExploreFeed';
import { TripsPlanner } from './components/TripsPlanner';
import { CommunityHub } from './components/CommunityHub';
import { NavigationFlow } from './components/NavigationFlow';
import { PlaceDetailModal } from './components/PlaceDetailModal';
import { AIChatModal } from './components/AIChatModal';
import { AddPlaceModal } from './components/AddPlaceModal';
import { PassiveDataModal } from './components/PassiveDataModal';
import { SideMenuDrawer } from './components/SideMenuDrawer';
import { FlightsModal } from './components/FlightsModal';
import { WeatherModal } from './components/WeatherModal';
import { SupportedLanguage, TRANSLATIONS } from './data/translations';
import { AuthFlowModal, AuthScreenType } from './components/AuthFlowModal';
import { AIIcon } from './components/AIIcon';
import { OnboardingModal, hasCompletedOnboarding } from './components/OnboardingModal';
import { useGeolocation } from './hooks/useGeolocation';
import { usePwaInstall } from './hooks/usePwaInstall';

type ActiveTab = 'home' | 'explore' | 'trips' | 'community';
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
  const [placesLoading, setPlacesLoading] = useState(true);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activeNavDestination, setActiveNavDestination] = useState<Place | null>(null);
  const [exploreView, setExploreView] = useState<ExploreView>('feed');
  const [exploreQuery, setExploreQuery] = useState('');
  const [exploreCategory, setExploreCategory] = useState('All');

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
    ? {
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
      avatarUrl: authUser.avatarUrl,
      isLoggedIn: true,
    }
    : { id: '', name: '', email: '', avatarUrl: '', isLoggedIn: false };

  const [language, setLanguage] = useState<SupportedLanguage>(() => {
    try {
      const stored = localStorage.getItem(LANGUAGE_KEY);
      return stored === 'ar' || stored === 'fr' || stored === 'en' ? stored : 'en';
    } catch {
      return 'en';
    }
  });
  const [currency] = useState<string>('MAD');
  const [isPassiveOptedIn, setIsPassiveOptedIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PASSIVE_GPS_CONSENT_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [savedPlaceIds, setSavedPlaceIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('sindbad_saved_ids');
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  });
  const { location: userLocation, permission, requestPermission } = useGeolocation();
  const {
    canInstall,
    promptInstall,
    showIosHint: showIosInstallHint,
    dismissIosHint: dismissIosInstallHint,
  } = usePwaInstall();

  const handlePassiveOptInChange = (optedIn: boolean) => {
    setIsPassiveOptedIn(optedIn);
    try {
      localStorage.setItem(PASSIVE_GPS_CONSENT_KEY, String(optedIn));
    } catch {
      // Storage may be unavailable in private browsing; keep the current session state.
    }
  };

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const isAr = language === 'ar';

  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // Storage may be unavailable; keep the current session language.
    }
  }, [language]);

  useEffect(() => {
    if (authStatus !== 'authed' || !currentUser.isLoggedIn || !currentUser.id) {
      setIsOnboardingOpen(false);
      return;
    }
    setIsOnboardingOpen(!hasCompletedOnboarding(currentUser.id));
  }, [authStatus, currentUser.id, currentUser.isLoggedIn]);

  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, isAr]);

  const loadPlaces = async () => {
    setPlacesLoading(true);
    setPlacesError(null);
    try {
      setPlaces(await fetchPlaces());
    } catch (error) {
      setPlacesError(error instanceof Error ? error.message : 'Failed to load places');
    } finally {
      setPlacesLoading(false);
    }
  };

  useEffect(() => {
    void loadPlaces();
  }, []);

  useEffect(() => {
    const resolveAuthCallback = async () => {
      const callbackUrl = new URL(window.location.href);
      const isAuthCallback = callbackUrl.pathname === AUTH_CALLBACK_PATH;
      if (!isAuthCallback) return;

      const code = callbackUrl.searchParams.get('code');
      const callbackMode = callbackUrl.searchParams.get('mode');
      let exchangeSucceeded = !code;

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        exchangeSucceeded = !error;
        if (error) {
          console.error('Supabase auth callback failed:', error);
        }
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
    setSavedPlaceIds((prev) => {
      const next = prev.includes(placeId) ? prev.filter((id) => id !== placeId) : [...prev, placeId];
      try {
        localStorage.setItem('sindbad_saved_ids', JSON.stringify(next));
      } catch {
        // Storage may be unavailable; keep the saved state for this session.
      }
      return next;
    });
  };

  const handlePlaceAdded = (newPlace: Place) => {
    setPlaces((prev) => [newPlace, ...prev]);
    setSelectedPlace(newPlace);
  };

  const handleDestinationSelect = (name: string) => {
    const query = name.trim();
    if (!query) return;
    setExploreQuery(query);
    setExploreCategory('All');
    setExploreView('feed');
    setActiveTab('explore');
  };

  const handleOpenAuth = (screen: AuthScreenType = 'welcome') => {
    setAuthInitialScreen(screen);
    setIsAuthOpen(true);
  };

  return (
    <div className={`min-h-screen bg-slate-100 flex flex-col font-sans ${isAr ? 'rtl' : 'ltr'}`}>
      {placesLoading && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-lg">
          {isAr ? 'جاري تحميل الأماكن...' : 'Loading places...'}
        </div>
      )}
      {placesError && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-800 shadow-lg border border-rose-200">
          <span>{isAr ? 'تعذر تحميل الأماكن' : 'Could not load places'}</span>
          <button onClick={() => void loadPlaces()} className="rounded-lg bg-rose-600 px-2.5 py-1 text-white">
            {isAr ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      <main className="flex-1 relative overflow-hidden">
        {activeTab === 'home' && (
          <HomeScreen
            onOpenAIChat={() => setIsAIChatOpen(true)}
            onNavigateTab={(tab) => {
              if (tab === 'map') setActiveTab('explore');
              else setActiveTab(tab as ActiveTab);
            }}
            onSelectCategory={(cat) => {
              setExploreQuery('');
              setExploreCategory(cat);
              setExploreView('map');
              setActiveTab('explore');
            }}
            onSelectDestination={handleDestinationSelect}
            onOpenFlights={() => setIsFlightsOpen(true)}
            onOpenWeather={() => setIsWeatherOpen(true)}
            onOpenAddPlace={() => setIsAddPlaceOpen(true)}
            onOpenSideMenu={() => setIsSideMenuOpen(true)}
            onSelectPlace={(p) => setSelectedPlace(p)}
            places={places}
            savedPlaceIds={savedPlaceIds}
            onToggleSave={handleToggleSave}
            language={language}
            onOpenAuth={handleOpenAuth}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'explore' && (
          <div className="w-full h-full overflow-y-auto">
            <div className="bg-white px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button onClick={() => setActiveTab('home')} className="px-2.5 py-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition shrink-0">
                  ← {isAr ? 'الرئيسية' : 'Home'}
                </button>
                <h2 className="text-sm font-bold text-slate-900 truncate">
                  {exploreView === 'feed' ? (isAr ? 'استكشاف الأماكن' : 'Explore Places') : (isAr ? 'الخريطة التفاعلية' : 'Interactive Map')}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setExploreView(exploreView === 'feed' ? 'map' : 'feed')} className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200">
                  {exploreView === 'feed' ? (isAr ? 'الخريطة' : 'Map') : (isAr ? 'الاستكشاف' : 'Discoveries')}
                </button>
                <button onClick={() => setIsPassiveModalOpen(true)} className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200 flex items-center gap-1">
                  <Radio className="w-3 h-3 text-emerald-600" />
                  <span>{isPassiveOptedIn ? (isAr ? 'مساهمة الموقع: مفعّلة' : 'Location preference: On') : (isAr ? 'مساهمة الموقع: متوقفة' : 'Location preference: Off')}</span>
                </button>
                <button onClick={() => setIsAddPlaceOpen(true)} className="px-2.5 py-1 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-xs flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span className="hidden sm:inline">{isAr ? 'إضافة مكان' : 'Add Place'}</span>
                </button>
              </div>
            </div>
            {exploreView === 'feed' ? (
              <ExploreFeed
                initialQuery={exploreQuery}
                onSelectPlace={(p) => setSelectedPlace(p)}
                onStartRoute={(p) => setActiveNavDestination(p)}
                onOpenAddModal={() => setIsAddPlaceOpen(true)}
                onOpenPassiveModal={() => setIsPassiveModalOpen(true)}
                onOpenMapToRegion={() => setExploreView('map')}
                savedPlaceIds={savedPlaceIds}
                onToggleSave={handleToggleSave}
                language={language}
                currency={currency}
                userLocation={userLocation}
                isPassiveOptedIn={isPassiveOptedIn}
                onPassiveOptInChange={handlePassiveOptInChange}
              />
            ) : (
              <MapView
                places={places}
                initialQuery={exploreQuery}
                initialCategory={exploreCategory}
                onPlacesChange={setPlaces}
                onSelectPlace={(p) => setSelectedPlace(p)}
                onStartRoute={(p) => setActiveNavDestination(p)}
                onOpenMultiStopPlanner={() => setActiveTab('trips')}
                savedPlaceIds={savedPlaceIds}
                language={language}
                currency={currency}
                userLocation={userLocation}
                isPassiveOptedIn={isPassiveOptedIn}
                onPassiveOptInChange={handlePassiveOptInChange}
              />
            )}
          </div>
        )}

        {activeTab === 'trips' && (
          <div className="w-full h-full overflow-y-auto">
            <div className="bg-white px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setActiveTab('home')}
                className="px-2.5 py-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
              >
                ← {isAr ? 'الرئيسية' : 'Home'}
              </button>
              <h2 className="text-sm font-bold text-slate-900">
                {isAr ? 'مخطط الرحلات' : 'Trips Planner'}
              </h2>
              <div className="w-16" />
            </div>
            <TripsPlanner
              language={language}
              authStatus={authStatus}
              onOpenAuth={() => handleOpenAuth('welcome')}
            />
          </div>
        )}

        {activeTab === 'community' && (
          <div className="w-full h-full overflow-y-auto">
            <div className="bg-white px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setActiveTab('home')}
                className="px-2.5 py-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
              >
                ← {isAr ? 'الرئيسية' : 'Home'}
              </button>
              <h2 className="text-sm font-bold text-slate-900">
                {isAr ? 'حسابي' : language === 'fr' ? 'Mon compte' : 'My Account'}
              </h2>
              <div className="w-16" />
            </div>
            <CommunityHub
              onOpenAddModal={() => setIsAddPlaceOpen(true)}
              onOpenPassiveModal={() => setIsPassiveModalOpen(true)}
              isPassiveOptedIn={isPassiveOptedIn}
              userXp={0}
              language={language}
              currentUser={currentUser}
              onOpenAuth={() => handleOpenAuth('welcome')}
            />
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 px-4 py-2 shadow-[0_-8px_25px_rgba(0,0,0,0.06)]">
        <div className="max-w-md mx-auto flex items-end justify-between relative px-2">
          <button id="tab-home" onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 py-0.5 px-3 transition ${activeTab === 'home' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'}`}>
            <HomeIcon className={`w-5 h-5 ${activeTab === 'home' ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[11px] leading-none">{isAr ? 'الرئيسية' : 'Home'}</span>
          </button>
          <button id="tab-explore" onClick={() => setActiveTab('explore')} className={`flex flex-col items-center gap-1 py-0.5 px-3 transition ${activeTab === 'explore' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'}`}>
            <Compass className={`w-5 h-5 ${activeTab === 'explore' ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[11px] leading-none">{isAr ? 'استكشف' : 'Explore'}</span>
          </button>
          <button id="tab-ai-assistant" onClick={() => setIsAIChatOpen(true)} className={`flex flex-col items-center gap-1 py-0.5 px-3 transition active:scale-95 group ${isAIChatOpen ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-blue-600 font-medium'}`} title={isAr ? 'الذكاء الاصطناعي لسندباد' : 'AI Assistant'}>
            <div className="w-[22px] h-[22px] flex items-center justify-center transition-transform group-hover:scale-110">
              <AIIcon size={22} variant="badge" />
            </div>
            <span className="text-[11px] leading-none tracking-wider font-extrabold text-blue-600">AI</span>
          </button>
          <button id="tab-trips" onClick={() => setActiveTab('trips')} className={`flex flex-col items-center gap-1 py-0.5 px-3 transition ${activeTab === 'trips' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'}`}>
            <ShoppingBag className={`w-5 h-5 ${activeTab === 'trips' ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[11px] leading-none">{isAr ? 'رحلاتي' : 'Trips'}</span>
          </button>
          <button id="tab-profile" onClick={() => setActiveTab('community')} className={`flex flex-col items-center gap-1 py-0.5 px-3 transition ${activeTab === 'community' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'}`}>
            <User className={`w-5 h-5 ${activeTab === 'community' ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[11px] leading-none">{isAr ? 'حسابي' : 'Profile'}</span>
          </button>
        </div>
      </nav>

      <SideMenuDrawer
        isOpen={isSideMenuOpen}
        onClose={() => setIsSideMenuOpen(false)}
        onNavigateTab={(tab) => {
          if (tab === 'map') setActiveTab('explore');
          else setActiveTab(tab as ActiveTab);
        }}
        onOpenAddPlace={() => setIsAddPlaceOpen(true)}
        onOpenPassiveGps={() => setIsPassiveModalOpen(true)}
        onOpenAIChat={() => setIsAIChatOpen(true)}
        userXp={0}
        language={language}
        onOpenAuth={handleOpenAuth}
        authStatus={authStatus}
        authUser={authUser}
        onSignOut={async () => {
          try {
            await signOut();
            setIsSideMenuOpen(false);
          } catch (error) {
            console.error('Sign out failed:', error);
          }
        }}
        canInstall={canInstall}
        onInstall={() => { void promptInstall(); }}
        showIosInstallHint={showIosInstallHint}
        onDismissIosInstallHint={dismissIosInstallHint}
      />

      <AuthFlowModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialScreen={authInitialScreen}
        language={language}
        onToggleLanguage={setLanguage}
        onAuthSuccess={() => {}}
      />

      {isOnboardingOpen && authStatus === 'authed' && currentUser.id && (
        <OnboardingModal
          userId={currentUser.id}
          language={language}
          onLanguageChange={setLanguage}
          userLocation={userLocation}
          permission={permission}
          requestPermission={requestPermission}
          onComplete={() => setIsOnboardingOpen(false)}
        />
      )}

      <FlightsModal isOpen={isFlightsOpen} onClose={() => setIsFlightsOpen(false)} language={language} />
      <WeatherModal isOpen={isWeatherOpen} onClose={() => setIsWeatherOpen(false)} language={language} />

      {activeNavDestination && (
        <NavigationFlow
          destination={activeNavDestination}
          onClose={() => setActiveNavDestination(null)}
          onArrivedExplore={(p) => {
            setActiveNavDestination(null);
            setSelectedPlace(p);
          }}
          onSavePlace={handleToggleSave}
          isSaved={savedPlaceIds.includes(activeNavDestination.id)}
          language={language}
        />
      )}

      <PlaceDetailModal
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
        onStartNavigation={(p) => {
          setSelectedPlace(null);
          setActiveNavDestination(p);
        }}
        onSaveToggle={handleToggleSave}
        isSaved={selectedPlace ? savedPlaceIds.includes(selectedPlace.id) : false}
        onPlaceUpdated={(updated) => {
          setPlaces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          setSelectedPlace(updated);
        }}
        language={language}
        currency={currency}
      />

      <AIChatModal
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        destination="Morocco & Global Destinations"
        onPlanTripFromAI={() => {
          setIsAIChatOpen(false);
          setActiveTab('trips');
        }}
        language={language}
      />

      <AddPlaceModal
        isOpen={isAddPlaceOpen}
        onClose={() => setIsAddPlaceOpen(false)}
        onPlaceAdded={handlePlaceAdded}
        language={language}
      />

      <PassiveDataModal
        isOpen={isPassiveModalOpen}
        onClose={() => setIsPassiveModalOpen(false)}
        isOptedIn={isPassiveOptedIn}
        onToggleOptIn={handlePassiveOptInChange}
        language={language}
      />
    </div>
  );
}

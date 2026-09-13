import React, { useState, useEffect } from 'react';
import {
  Home as HomeIcon,
  Compass,
  ShoppingBag,
  User,
  Sparkles,
  MapPin,
  Radio,
  Plus
} from 'lucide-react';
import { Place } from './types';
import { fetchPlaces } from './services/api';
import { supabase } from './lib/supabase';

// Components
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
import mySindbadTransparent from './assets/images/my_sindbad_logo_transparent.png';
import { AuthFlowModal, AuthScreenType } from './components/AuthFlowModal';
import { AIIcon } from './components/AIIcon';

type ActiveTab = 'home' | 'explore' | 'trips' | 'community';
type ExploreView = 'feed' | 'map';
const PASSIVE_GPS_CONSENT_KEY = 'sindbad_passive_gps_consent';
const LANGUAGE_KEY = 'sindbad_language';
const USER_XP_KEY = 'sindbad_user_xp';

function readStoredXp(): number {
  try {
    const stored = Number(localStorage.getItem(USER_XP_KEY));
    return Number.isFinite(stored) && stored >= 0 ? Math.floor(stored) : 0;
  } catch {
    return 0;
  }
}

type CurrentUser = {
  name: string;
  email: string;
  avatar: string;
  isLoggedIn: boolean;
};

export default function App() {
  // Navigation & View State - Default to 'home' to show the exact home page requested
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [places, setPlaces] = useState<Place[]>([]);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activeNavDestination, setActiveNavDestination] = useState<Place | null>(null);
  const [exploreView, setExploreView] = useState<ExploreView>('feed');
  const [exploreQuery, setExploreQuery] = useState('');
  const [exploreCategory, setExploreCategory] = useState('All');

  // Modals
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [isAddPlaceOpen, setIsAddPlaceOpen] = useState(false);
  const [isPassiveModalOpen, setIsPassiveModalOpen] = useState(false);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [isFlightsOpen, setIsFlightsOpen] = useState(false);
  const [isWeatherOpen, setIsWeatherOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authInitialScreen, setAuthInitialScreen] = useState<AuthScreenType>('welcome');

  // User Settings & Profile
  const [currentUser, setCurrentUser] = useState<CurrentUser>({
    name: '',
    email: '',
    avatar: '🧔',
    isLoggedIn: false,
  });
  const [language, setLanguage] = useState<SupportedLanguage>(() => {
    try {
      const stored = localStorage.getItem(LANGUAGE_KEY);
      return stored === 'ar' || stored === 'fr' || stored === 'en' ? stored : 'en';
    } catch {
      return 'en';
    }
  });
  const [currency, setCurrency] = useState<string>('MAD');
  const [isPassiveOptedIn, setIsPassiveOptedIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PASSIVE_GPS_CONSENT_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [userXp, setUserXp] = useState<number>(() => readStoredXp());
  const [savedPlaceIds, setSavedPlaceIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('sindbad_saved_ids');
      return stored ? JSON.parse(stored) : ['akchour-bridge', 'riad-el-pueblo'];
    } catch {
      return ['akchour-bridge', 'riad-el-pueblo'];
    }
  });

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
    try {
      localStorage.setItem(USER_XP_KEY, String(userXp));
    } catch {
      // Storage may be unavailable; keep the current session XP.
    }

    if (currentUser.isLoggedIn) {
      void supabase.auth.updateUser({ data: { community_xp: userXp } });
    }
  }, [userXp, currentUser.isLoggedIn]);

  // Apply RTL direction when Arabic is selected
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
    const applySession = (session: { user?: { email?: string; user_metadata?: Record<string, unknown> } } | null) => {
      const user = session?.user;
      if (!user) {
        setCurrentUser({ name: '', email: '', avatar: '🧔', isLoggedIn: false });
        setUserXp(readStoredXp());
        return;
      }
      const metadata = user.user_metadata || {};
      const metadataXp = Number(metadata.community_xp);
      setUserXp(Number.isFinite(metadataXp) && metadataXp >= 0 ? Math.floor(metadataXp) : readStoredXp());
      setCurrentUser({
        name: typeof metadata.full_name === 'string' && metadata.full_name.trim()
          ? metadata.full_name
          : user.email?.split('@')[0] || 'Traveler',
        email: user.email || '',
        avatar: typeof metadata.avatar_url === 'string' && metadata.avatar_url ? metadata.avatar_url : '🧔',
        isLoggedIn: true,
      });
    };

    void supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const handleToggleSave = (placeId: string) => {
    setSavedPlaceIds((prev) => {
      const next = prev.includes(placeId) ? prev.filter((id) => id !== placeId) : [...prev, placeId];
      try {
        localStorage.setItem('sindbad_saved_ids', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handlePlaceAdded = (newPlace: Place) => {
    setPlaces((prev) => [newPlace, ...prev]);
    setSelectedPlace(newPlace);
    setUserXp((prev) => prev + 100);
  };

  const handleDestinationSelect = (name: string) => {
    const query = name.trim();
    if (!query) return;
    setExploreQuery(query);
    setExploreCategory('All');
    setExploreView('feed');
    setActiveTab('explore');
  };

  const savedPlacesList = places.filter((p) => savedPlaceIds.includes(p.id));

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
      {/* Active Tab Router */}
      <main className="flex-1 relative overflow-hidden">
        {/* 1. HOME SCREEN: Exactly matches the uploaded photo */}
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
            onToggleLanguage={setLanguage}
            onOpenAuth={handleOpenAuth}
            currentUser={currentUser}
          />
        )}

        {/* 2. EXPLORE & LIVE MAP TAB */}
        {activeTab === 'explore' && (
          <div className="w-full h-full overflow-y-auto">
            <div className="bg-white px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button onClick={() => setActiveTab('home')} className="px-2.5 py-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition shrink-0">
                  ← {isAr ? 'الرئيسية' : 'Home'}
                </button>
                <h2 className="text-sm font-bold text-slate-900 truncate">
                  {exploreView === 'feed' ? (isAr ? 'الاستكشاف وذاكرة المجتمع' : 'Explore & AI Memory') : (isAr ? 'الخريطة التفاعلية الحية' : 'Live Interactive Map')}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setExploreView(exploreView === 'feed' ? 'map' : 'feed')} className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200">
                  {exploreView === 'feed' ? (isAr ? 'الخريطة' : 'Map') : (isAr ? 'الاستكشاف' : 'Discoveries')}
                </button>
                <button onClick={() => setIsPassiveModalOpen(true)} className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200 flex items-center gap-1">
                  <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
                  <span>{isPassiveOptedIn ? 'GPS Active' : 'GPS Off'}</span>
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
              />
            )}
          </div>
        )}

        {/* 3. TRIPS & OFFLINE SAVED ITINERARIES */}
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
                {isAr ? 'مخطط الرحلات والأماكن المحفوظة' : 'Trips & Saved Places'}
              </h2>
              <div className="w-16" />
            </div>

            <TripsPlanner
              savedPlaces={savedPlacesList}
              onStartRoute={(p) => setActiveNavDestination(p)}
              onSelectPlace={(p) => setSelectedPlace(p)}
              onRemoveSaved={handleToggleSave}
              language={language}
            />
          </div>
        )}

        {/* 4. PROFILE & COMMUNITY HUB */}
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
                {isAr ? 'ملفي الشخصي ومجتمع سندباد' : language === 'fr' ? 'Mon profil et la communauté' : 'My Profile & Community'}
              </h2>
              <div className="w-16" />
            </div>

            <CommunityHub
              onOpenAddModal={() => setIsAddPlaceOpen(true)}
              onOpenPassiveModal={() => setIsPassiveModalOpen(true)}
              isPassiveOptedIn={isPassiveOptedIn}
              userXp={userXp}
              language={language}
              currentUser={currentUser}
              onOpenAuth={() => handleOpenAuth('welcome')}
            />
          </div>
        )}
      </main>

      {/* 2. BOTTOM NAVIGATION BAR: Exactly matching the uploaded photo */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 px-4 py-2 shadow-[0_-8px_25px_rgba(0,0,0,0.06)]">
        <div className="max-w-md mx-auto flex items-end justify-between relative px-2">
          {/* Tab 1: Home */}
          <button
            id="tab-home"
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 py-0.5 px-3 transition ${
              activeTab === 'home'
                ? 'text-blue-600 font-bold'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <HomeIcon className={`w-5 h-5 ${activeTab === 'home' ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[11px] leading-none">{isAr ? 'الرئيسية' : 'Home'}</span>
          </button>

          {/* Tab 2: Explore */}
          <button
            id="tab-explore"
            onClick={() => setActiveTab('explore')}
            className={`flex flex-col items-center gap-1 py-0.5 px-3 transition ${
              activeTab === 'explore'
                ? 'text-blue-600 font-bold'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <Compass className={`w-5 h-5 ${activeTab === 'explore' ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[11px] leading-none">{isAr ? 'استكشف' : 'Explore'}</span>
          </button>

          {/* Tab 3 (Center): Professional AI Assistant */}
          <button
            id="tab-ai-assistant"
            onClick={() => setIsAIChatOpen(true)}
            className={`flex flex-col items-center gap-1 py-0.5 px-3 transition active:scale-95 group ${
              isAIChatOpen
                ? 'text-blue-600 font-bold'
                : 'text-slate-500 hover:text-blue-600 font-medium'
            }`}
            title={isAr ? 'الذكاء الاصطناعي لسندباد' : 'AI Assistant'}
          >
            <div className="w-[22px] h-[22px] flex items-center justify-center transition-transform group-hover:scale-110">
              <AIIcon size={22} variant="badge" />
            </div>
            <span className="text-[11px] leading-none tracking-wider font-extrabold text-blue-600">
              AI
            </span>
          </button>

          {/* Tab 4: Trips */}
          <button
            id="tab-trips"
            onClick={() => setActiveTab('trips')}
            className={`flex flex-col items-center gap-1 py-0.5 px-3 transition ${
              activeTab === 'trips'
                ? 'text-blue-600 font-bold'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <ShoppingBag className={`w-5 h-5 ${activeTab === 'trips' ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[11px] leading-none">{isAr ? 'رحلاتي' : 'Trips'}</span>
          </button>

          {/* Tab 5: Profile */}
          <button
            id="tab-profile"
            onClick={() => setActiveTab('community')}
            className={`flex flex-col items-center gap-1 py-0.5 px-3 transition ${
              activeTab === 'community'
                ? 'text-blue-600 font-bold'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <User className={`w-5 h-5 ${activeTab === 'community' ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[11px] leading-none">{isAr ? 'حسابي' : 'Profile'}</span>
          </button>
        </div>
      </nav>

      {/* 3. MODALS & SPECIALIZED DIALOGS */}

      {/* Side Menu Drawer */}
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
        userXp={userXp}
        language={language}
        onToggleLanguage={setLanguage}
        onOpenAuth={handleOpenAuth}
      />

      {/* Auth & Onboarding 6-Screen Flow Modal */}
      <AuthFlowModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialScreen={authInitialScreen}
        language={language}
        onToggleLanguage={setLanguage}
        onAuthSuccess={(user) => {
          setCurrentUser({
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            isLoggedIn: true,
          });
        }}
      />

      {/* Flights Discovery Modal */}
      <FlightsModal
        isOpen={isFlightsOpen}
        onClose={() => setIsFlightsOpen(false)}
        language={language}
      />

      {/* Weather Forecast Modal */}
      <WeatherModal
        isOpen={isWeatherOpen}
        onClose={() => setIsWeatherOpen(false)}
        language={language}
      />

      {/* Turn-by-Turn AI Navigation Flow */}
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

      {/* Place Details Modal with Formation History & Community Reviews */}
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

      {/* Scoped Sindbad AI Chat Modal */}
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

      {/* Add Place / Business Owner Listing Modal */}
      <AddPlaceModal
        isOpen={isAddPlaceOpen}
        onClose={() => setIsAddPlaceOpen(false)}
        onPlaceAdded={handlePlaceAdded}
        language={language}
      />

      {/* Passive Location Sharing Modal */}
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

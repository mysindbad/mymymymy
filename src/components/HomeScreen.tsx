import React, { useState } from 'react';
import {
  Search,
  Mic,
  Sparkles,
  Plane,
  Bed,
  MapPin,
  Utensils,
  CloudSun,
  ShoppingBag,
  Heart,
  ChevronRight,
  ArrowRight,
  Bell,
  Menu,
  Sun,
  ShieldCheck,
  Compass,
  Radio
} from 'lucide-react';
import { Place } from '../types';
import { SupportedLanguage, TRANSLATIONS } from '../data/translations';
import { BrandLogo } from './BrandLogo';
import { LanguageFlagSelector } from './LanguageFlagSelector';

interface HomeScreenProps {
  onOpenAIChat: () => void;
  onNavigateTab: (tab: 'home' | 'explore' | 'map' | 'trips' | 'community') => void;
  onSelectCategory: (category: string) => void;
  onSelectDestination: (destinationName: string) => void;
  onOpenFlights: () => void;
  onOpenWeather: () => void;
  onOpenAddPlace: () => void;
  onOpenSideMenu: () => void;
  onSelectPlace: (place: Place) => void;
  places: Place[];
  savedPlaceIds: string[];
  onToggleSave: (placeId: string) => void;
  language?: SupportedLanguage;
  onToggleLanguage?: (lang: SupportedLanguage) => void;
  onOpenAuth?: (screen?: any) => void;
  currentUser?: { name: string; email: string; avatar: string; isLoggedIn?: boolean };
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenAIChat,
  onNavigateTab,
  onSelectCategory,
  onSelectDestination,
  onOpenFlights,
  onOpenWeather,
  onOpenAddPlace,
  onOpenSideMenu,
  onSelectPlace,
  places,
  savedPlaceIds,
  onToggleSave,
  language = 'en',
  onToggleLanguage,
  onOpenAuth,
  currentUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCountry, setActiveCountry] = useState<string>('Morocco');
  const [isListeningMic, setIsListeningMic] = useState(false);

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const isAr = language === 'ar';

  const handleMicClick = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      try {
        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = isAr ? 'ar-SA' : 'en-US';
        recognition.onstart = () => setIsListeningMic(true);
        recognition.onend = () => setIsListeningMic(false);
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setSearchQuery(transcript);
          onSelectDestination(transcript);
        };
        recognition.start();
      } catch {
        setIsListeningMic(false);
      }
    } else {
      setSearchQuery(isAr ? 'شفشاون وأقشور' : 'Chefchaouen & Akchour');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSelectDestination(searchQuery.trim());
    }
  };

  // Popular Destinations list exactly matching the image
  const popularDestinations = [
    {
      id: 'istanbul',
      name: 'Istanbul',
      tagline: 'History meets beauty',
      photo: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=600&auto=format&fit=crop&q=80',
      category: 'Turkey',
    },
    {
      id: 'marrakech',
      name: 'Marrakech',
      tagline: 'Colors & culture',
      photo: 'https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=600&auto=format&fit=crop&q=80',
      category: 'Morocco',
    },
    {
      id: 'paris',
      name: 'Paris',
      tagline: 'The city of dreams',
      photo: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&auto=format&fit=crop&q=80',
      category: 'France',
    },
    {
      id: 'bali',
      name: 'Bali',
      tagline: "Nature's paradise",
      photo: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&auto=format&fit=crop&q=80',
      category: 'Indonesia',
    },
    {
      id: 'chefchaouen',
      name: 'Chefchaouen',
      tagline: 'Blue pearl of the Rif',
      photo: 'https://images.unsplash.com/photo-1548013146-72479768bada?w=600&auto=format&fit=crop&q=80',
      category: 'Morocco',
    },
  ];

  return (
    <div className="w-full min-h-screen bg-slate-50 pb-28 select-none text-slate-800" dir={isAr ? 'rtl' : 'ltr'}>
      {/* 1. HERO SECTION: Exactly matching image top section */}
      <div className="relative w-full overflow-hidden bg-gradient-to-b from-sky-400 via-sky-300 to-sky-100 pb-8 sm:pb-12 shadow-md">
        {/* Background Scenic Landscape (Santorini & Mediterranean Sea with Sailboats) */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1600&auto=format&fit=crop&q=85"
            alt="Mediterranean Coast"
            className="w-full h-full object-cover object-top opacity-85"
          />
          {/* Subtle warm sunset & sky gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-sky-500/30 via-transparent to-white" />
        </div>

        {/* Decorative Blooming Bougainvillea on edges */}
        <div className="absolute top-0 left-0 right-0 h-28 pointer-events-none z-10 opacity-75 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-pink-500/25 via-transparent to-transparent" />

        {/* Top App Header: Menu Button (Left) | Language Flag Switcher & User Greeting & Bell (Right) */}
        <div className="relative z-20 max-w-md sm:max-w-xl mx-auto px-4 pt-3 flex items-center justify-between">
          {/* Menu Button */}
          <button
            id="home-side-menu-btn"
            onClick={onOpenSideMenu}
            className="w-9 h-9 rounded-full bg-blue-600/90 hover:bg-blue-700 text-white shadow-md flex items-center justify-center backdrop-blur-md transition active:scale-95"
            title={isAr ? 'القائمة' : 'Open Menu'}
          >
            <Menu className="w-4 h-4 stroke-[2.5]" />
          </button>

          {/* Exterior Language Flag Switcher + User Traveler Greeting + Notification Bell */}
          <div className="flex items-center gap-1.5">
            {/* Direct Language Flag Selector at outer entry */}
            {onToggleLanguage && (
              <div className="bg-white/90 backdrop-blur-md rounded-full shadow-sm border border-slate-200/80 p-0.5">
                <LanguageFlagSelector
                  currentLanguage={language}
                  onSelectLanguage={onToggleLanguage}
                  variant="compact"
                />
              </div>
            )}

            <button
              onClick={() => {
                if (onOpenAuth) {
                  onOpenAuth('welcome');
                } else {
                  onNavigateTab('community');
                }
              }}
              className="px-2.5 sm:px-3 py-1 rounded-full bg-slate-900/85 hover:bg-slate-900 text-white shadow-sm flex items-center gap-1.5 backdrop-blur-md transition active:scale-95 text-xs font-semibold"
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-[10px] overflow-hidden">
                {currentUser?.avatar || '🧔'}
              </div>
              <div className="text-left rtl:text-right leading-tight hidden xs:block">
                <span className="text-[9px] text-slate-300 block">
                  {currentUser?.isLoggedIn ? (isAr ? 'مرحباً،' : 'Welcome,') : (isAr ? 'أهلاً بك،' : 'Hello,')}
                </span>
                <span className="text-[11px] font-bold text-white max-w-[70px] truncate block">
                  {currentUser?.name || (isAr ? 'المسافر' : 'Traveler!')}
                </span>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-300 rtl:rotate-180" />
            </button>

            <button
              onClick={() => onNavigateTab('community')}
              className="w-9 h-9 rounded-full bg-blue-600/90 hover:bg-blue-700 text-white shadow-md flex items-center justify-center relative transition active:scale-95"
            >
              <Bell className="w-4 h-4 fill-white" />
              <span className="absolute top-1 right-1 rtl:right-auto rtl:left-1 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </div>

        {/* Main Brand Identity: Official 3D Robot Mascot & My Sindbad Logo */}
        <div className="relative z-20 max-w-md mx-auto px-4 pt-2 pb-1">
          <BrandLogo size="lg" showSlogan={true} />
        </div>

        {/* Decorative Side Elements matching the image */}
        {/* Left: Rustic Wooden Signpost ("Good Trips Brighter Stories ♡") */}
        <div className="absolute left-3 rtl:left-auto rtl:right-3 top-24 z-10 hidden sm:flex flex-col items-center">
          <div className="px-2.5 py-1 rounded-sm bg-amber-800/90 text-amber-100 text-[10px] font-bold uppercase shadow-md -rotate-3 border border-amber-700">
            {isAr ? 'رحلات' : 'Good'}
          </div>
          <div className="px-2.5 py-1 rounded-sm bg-amber-800/90 text-amber-100 text-[10px] font-bold uppercase shadow-md rotate-2 border border-amber-700 -mt-0.5">
            {isAr ? 'سعيدة' : 'Trips'}
          </div>
          <div className="px-2.5 py-1 rounded-sm bg-amber-800/90 text-amber-100 text-[10px] font-bold uppercase shadow-md -rotate-2 border border-amber-700 -mt-0.5">
            {isAr ? 'وقصص' : 'Brighter'}
          </div>
          <div className="px-2.5 py-1 rounded-sm bg-amber-800/90 text-amber-100 text-[10px] font-bold uppercase shadow-md rotate-3 border border-amber-700 -mt-0.5">
            {isAr ? 'ملهمة ♡' : 'Stories ♡'}
          </div>
          <div className="w-1.5 h-14 bg-amber-900 shadow-md" />
        </div>

        {/* Right: Elegant White Script ("Explore Discover Enjoy ✈") */}
        <div className="absolute right-4 rtl:right-auto rtl:left-4 top-28 z-10 hidden sm:block text-right rtl:text-left text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
          <div className="text-sm font-serif italic tracking-wide">{isAr ? 'استكشف' : 'Explore'}</div>
          <div className="text-base font-serif italic tracking-wide font-bold">{isAr ? 'اكتشف' : 'Discover'}</div>
          <div className="text-lg font-serif italic tracking-wide font-black flex items-center justify-end rtl:justify-start gap-1">
            <span>{isAr ? 'استمتع' : 'Enjoy'}</span>
            <span className="text-xs">✈</span>
          </div>
        </div>

        {/* 2. FLOATING SEARCH BAR & COUNTRY CHIPS */}
        <div className="relative z-30 max-w-md sm:max-w-xl mx-auto px-4 mt-2.5 space-y-2">
          {/* Main Rounded Search Input */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center gap-2 bg-white rounded-full p-1.5 pl-3.5 rtl:pl-1.5 rtl:pr-3.5 pr-1.5 shadow-lg border border-slate-200/80 transition-all focus-within:ring-2 focus-within:ring-blue-500"
          >
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'إلى أين ترغب بالسفر؟' : 'Where do you want to go?'}
              className="flex-1 text-xs sm:text-sm text-slate-800 bg-transparent outline-none placeholder:text-slate-400 font-medium"
            />
            {/* Microphone Button */}
            <button
              type="button"
              onClick={handleMicClick}
              className={`p-1.5 rounded-full transition ${
                isListeningMic ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-slate-600'
              }`}
              title={isAr ? 'بحث صوتي' : 'Voice Search'}
            >
              <Mic className="w-3.5 h-3.5" />
            </button>

            {/* "✦ Ask AI" Button */}
            <button
              id="home-ask-ai-btn"
              type="button"
              onClick={onOpenAIChat}
              className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white font-bold text-xs shadow-md shadow-blue-500/25 flex items-center gap-1 transition active:scale-95 shrink-0"
            >
              <Sparkles className="w-3 h-3 fill-current text-amber-300" />
              <span>{isAr ? 'اسأل AI' : 'Ask AI'}</span>
            </button>
          </form>

          {/* Destination Quick Chips: Morocco, Turkey, Egypt, Switzerland, More */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 justify-start sm:justify-center">
            {[
              { label: 'Morocco', nameAr: 'المغرب', icon: '📍' },
              { label: 'Turkey', nameAr: 'تركيا', icon: '✈' },
              { label: 'Egypt', nameAr: 'مصر', icon: '🌴' },
              { label: 'Switzerland', nameAr: 'سويسرا', icon: '⛰' },
              { label: 'More', nameAr: 'المزيد', icon: '•••' },
            ].map((chip) => {
              const isSelected = activeCountry === chip.label;
              return (
                <button
                  key={chip.label}
                  onClick={() => {
                    setActiveCountry(chip.label);
                    onSelectDestination(chip.label);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shadow-2xs backdrop-blur-md transition border flex items-center gap-1 ${
                    isSelected
                      ? 'bg-white border-blue-500 text-blue-900 font-bold ring-2 ring-blue-500/20'
                      : 'bg-white/95 border-slate-200 text-slate-700 hover:bg-white'
                  }`}
                >
                  <span>{chip.icon}</span>
                  <span>{isAr ? chip.nameAr : chip.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. 6 SERVICE CATEGORY ICONS (Harmonious, perfectly proportioned for mobile) */}
      <div className="max-w-md sm:max-w-2xl mx-auto px-4 -mt-2 sm:-mt-3 relative z-20">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-2.5 sm:p-3.5 shadow-sm border border-slate-100/90">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-2.5">
            {/* 1. Flights */}
            <button
              id="service-flights-btn"
              onClick={onOpenFlights}
              className="flex flex-col items-center text-center p-1.5 rounded-xl hover:bg-slate-50 transition group active:scale-95"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-sky-400 via-blue-500 to-blue-600 shadow-sm shadow-blue-500/20 flex items-center justify-center text-white transition transform group-hover:scale-105">
                <Plane className="w-5 h-5 -rotate-45 stroke-[2.2]" />
              </div>
              <span className="font-bold text-xs text-slate-900 mt-1.5 block leading-tight">
                {isAr ? 'الطيران' : 'Flights'}
              </span>
              <span className="text-[9px] text-slate-500 block leading-tight mt-0.5 line-clamp-1">
                {isAr ? 'أفضل الأسعار' : 'Best deals'}
              </span>
            </button>

            {/* 2. Hotels */}
            <button
              id="service-hotels-btn"
              onClick={() => {
                onSelectCategory('accommodation');
                onNavigateTab('map');
              }}
              className="flex flex-col items-center text-center p-1.5 rounded-xl hover:bg-slate-50 transition group active:scale-95"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-sm shadow-emerald-500/20 flex items-center justify-center text-white transition transform group-hover:scale-105">
                <Bed className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="font-bold text-xs text-slate-900 mt-1.5 block leading-tight">
                {isAr ? 'الفنادق' : 'Hotels'}
              </span>
              <span className="text-[9px] text-slate-500 block leading-tight mt-0.5 line-clamp-1">
                {isAr ? 'إقامة مريحة' : 'Stay your way'}
              </span>
            </button>

            {/* 3. Trips */}
            <button
              id="service-trips-btn"
              onClick={() => onNavigateTab('trips')}
              className="flex flex-col items-center text-center p-1.5 rounded-xl hover:bg-slate-50 transition group active:scale-95"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 shadow-sm shadow-orange-500/20 flex items-center justify-center text-white transition transform group-hover:scale-105">
                <MapPin className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="font-bold text-xs text-slate-900 mt-1.5 block leading-tight">
                {isAr ? 'الرحلات' : 'Trips'}
              </span>
              <span className="text-[9px] text-slate-500 block leading-tight mt-0.5 line-clamp-1">
                {isAr ? 'برامج منظمة' : 'Itineraries'}
              </span>
            </button>

            {/* 4. Restaurants */}
            <button
              id="service-restaurants-btn"
              onClick={() => {
                onSelectCategory('restaurant');
                onNavigateTab('map');
              }}
              className="flex flex-col items-center text-center p-1.5 rounded-xl hover:bg-slate-50 transition group active:scale-95"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-600 to-purple-700 shadow-sm shadow-purple-500/20 flex items-center justify-center text-white transition transform group-hover:scale-105">
                <Utensils className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="font-bold text-xs text-slate-900 mt-1.5 block leading-tight">
                {isAr ? 'المطاعم' : 'Restaurants'}
              </span>
              <span className="text-[9px] text-slate-500 block leading-tight mt-0.5 line-clamp-1">
                {isAr ? 'أشهى المأكولات' : 'Local dining'}
              </span>
            </button>

            {/* 5. Weather */}
            <button
              id="service-weather-btn"
              onClick={onOpenWeather}
              className="flex flex-col items-center text-center p-1.5 rounded-xl hover:bg-slate-50 transition group active:scale-95"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-500 shadow-sm shadow-cyan-500/20 flex items-center justify-center text-white transition transform group-hover:scale-105">
                <CloudSun className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="font-bold text-xs text-slate-900 mt-1.5 block leading-tight">
                {isAr ? 'الطقس' : 'Weather'}
              </span>
              <span className="text-[9px] text-slate-500 block leading-tight mt-0.5 line-clamp-1">
                {isAr ? 'نشرة فورية' : 'Live forecast'}
              </span>
            </button>

            {/* 6. More */}
            <button
              id="service-more-btn"
              onClick={onOpenAddPlace}
              className="flex flex-col items-center text-center p-1.5 rounded-xl hover:bg-slate-50 transition group active:scale-95"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-pink-500 via-rose-500 to-red-500 shadow-sm shadow-rose-500/20 flex items-center justify-center text-white transition transform group-hover:scale-105">
                <ShoppingBag className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="font-bold text-xs text-slate-900 mt-1.5 block leading-tight">
                {isAr ? 'المزيد' : 'More'}
              </span>
              <span className="text-[9px] text-slate-500 block leading-tight mt-0.5 line-clamp-1">
                {isAr ? 'أنشطة وتجارب' : 'Activities'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. TWO FEATURED PROMO CARDS (Side-by-side matching the image) */}
      <div className="max-w-md sm:max-w-2xl mx-auto px-4 mt-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Left Card: Handpicked Real Destinations */}
          <div
            onClick={() => onNavigateTab('explore')}
            className="relative h-36 rounded-2xl overflow-hidden shadow-sm cursor-pointer group transition transform hover:-translate-y-0.5"
          >
            <img
              src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80"
              alt="Amazing Destinations"
              className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
            <div className="absolute inset-0 p-3.5 flex flex-col justify-between text-white">
              <div>
                <span className="text-[10px] font-black tracking-widest uppercase text-sky-200">
                  {isAr ? 'استكشف' : 'DISCOVER'}
                </span>
                <h3 className="text-base font-bold leading-tight mt-0.5">
                  {isAr ? 'وجهات سياحية ساحرة' : 'Amazing Destinations'}
                </h3>
                <p className="text-xs text-slate-200 mt-0.5">
                  {isAr ? 'أماكن سياحية حقيقية موثوقة ومختارة بعناية' : 'Curated handpicked real-world gems'}
                </p>
              </div>

              <div>
                <button className="px-3 py-1 rounded-full bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-sm flex items-center gap-1 transition">
                  <span>{isAr ? 'استكشف الآن' : 'Explore Now'}</span>
                  <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Card: Smart Trip Planning */}
          <div
            onClick={() => onNavigateTab('trips')}
            className="relative h-36 rounded-2xl overflow-hidden shadow-sm cursor-pointer group transition transform hover:-translate-y-0.5"
          >
            <img
              src="https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop&q=80"
              alt="Marrakech Minaret Sunset"
              className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
            <div className="absolute inset-0 p-3.5 flex flex-col justify-between text-white">
              <div>
                <span className="text-[10px] font-black tracking-widest uppercase text-amber-200">
                  {isAr ? 'تخطيط ذكي' : 'PLAN SMARTER'}
                </span>
                <h3 className="text-base font-bold leading-tight mt-0.5">
                  {isAr ? 'برامج سياحية متكاملة' : 'Tailored Travel Itineraries'}
                </h3>
                <p className="text-xs text-slate-200 mt-0.5">
                  {isAr ? 'جداول يومية مخصصة بحسب تفضيلاتك ووجهتك' : 'Personalized day-by-day schedules'}
                </p>
              </div>

              <div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAIChat();
                  }}
                  className="px-3 py-1 rounded-full bg-white hover:bg-slate-100 text-blue-600 font-bold text-xs shadow-sm flex items-center gap-1 transition"
                >
                  <span>{isAr ? 'ابدأ التخطيط' : 'Start Planning'}</span>
                  <Sparkles className="w-3 h-3 text-blue-600 fill-blue-600" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. POPULAR DESTINATIONS SECTION (Horizontal Scrolling Cards matching image) */}
      <div className="max-w-md sm:max-w-2xl mx-auto px-4 mt-7 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            {isAr ? 'الوجهات الأكثر طلباً' : 'Popular Destinations'}
          </h2>
          <button
            onClick={() => onNavigateTab('explore')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
          >
            <span>{isAr ? 'عرض الكل' : 'See All'}</span>
            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>

        {/* Horizontal Carousel */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
          {popularDestinations.map((dest) => {
            const isSaved = savedPlaceIds.includes(dest.id);
            return (
              <div
                key={dest.id}
                onClick={() => onSelectDestination(dest.name)}
                className="relative w-40 sm:w-48 h-56 rounded-3xl overflow-hidden shadow-md shrink-0 cursor-pointer group transition transform hover:-translate-y-1"
              >
                <img
                  src={dest.photo}
                  alt={dest.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/20" />

                {/* Heart Favorite Button on Top Right */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSave(dest.id);
                  }}
                  className={`absolute top-2.5 right-2.5 rtl:right-auto rtl:left-2.5 w-7 h-7 rounded-full backdrop-blur-md flex items-center justify-center transition ${
                    isSaved ? 'bg-rose-500 text-white' : 'bg-black/40 hover:bg-black/60 text-white'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                </button>

                {/* Bottom Destination Info */}
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <h4 className="font-bold text-sm sm:text-base leading-tight drop-shadow-xs">
                    {dest.name}
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-snug drop-shadow-xs mt-0.5">
                    {dest.tagline}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

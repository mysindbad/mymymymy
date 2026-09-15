export type AppNavigationTarget =
  | 'home'
  | 'explore'
  | 'map'
  | 'trips'
  | 'community'
  | 'account'
  | 'add-place'
  | 'flights'
  | 'weather';

export type AppNavigationAction = {
  target: AppNavigationTarget;
  label: string;
  query?: string;
};

export type AssistantNavigationReply = {
  text: string;
  actions: AppNavigationAction[];
};

const normalize = (value: string) => value.trim().toLocaleLowerCase();

const hasAny = (value: string, terms: string[]) => terms.some((term) => value.includes(term));

const labels = (language: string) => ({
  home: language === 'ar' ? 'الرئيسية' : language === 'fr' ? 'Accueil' : 'Home',
  explore: language === 'ar' ? 'استكشف' : language === 'fr' ? 'Explorer' : 'Explore',
  map: language === 'ar' ? 'الخريطة' : language === 'fr' ? 'Carte' : 'Map',
  trips: language === 'ar' ? 'إضافة رحلة' : language === 'fr' ? 'Ajouter un voyage' : 'Add Trip',
  community: language === 'ar' ? 'المجتمع' : language === 'fr' ? 'Communauté' : 'Community',
  account: language === 'ar' ? 'الحساب' : language === 'fr' ? 'Compte' : 'Account',
  addPlace: language === 'ar' ? 'إضافة مكان' : language === 'fr' ? 'Ajouter un lieu' : 'Add Place',
  flights: language === 'ar' ? 'الطيران' : language === 'fr' ? 'Vols' : 'Flights',
  weather: language === 'ar' ? 'الطقس' : language === 'fr' ? 'Météo' : 'Weather',
});

export function resolveAppNavigationHelp(
  message: string,
  language: string,
): AssistantNavigationReply | null {
  const text = normalize(message);
  const l = labels(language);

  const response = (target: AppNavigationTarget, label: string, en: string, ar: string, fr: string): AssistantNavigationReply => ({
    text: language === 'ar' ? ar : language === 'fr' ? fr : en,
    actions: [{ target, label }],
  });

  if (hasAny(text, ['add trip', 'create trip', 'new trip', 'plan a trip', 'my trips', 'trip planner', 'إضافة رحلة', 'انشاء رحلة', 'إنشاء رحلة', 'رحلاتي', 'خطط رحلة', 'ajouter un voyage', 'créer un voyage', 'mes voyages'])) {
    return response('trips', l.trips, 'Open Trips and choose Add Trip.', 'افتح رحلاتي ثم اختر إضافة رحلة.', 'Ouvrez Mes voyages puis choisissez Ajouter un voyage.');
  }
  if (hasAny(text, ['add place', 'new place', 'submit place', 'إضافة مكان', 'اضافة مكان', 'ajouter un lieu'])) {
    return response('add-place', l.addPlace, 'You can add a place here.', 'يمكنك إضافة مكان من هنا.', 'Vous pouvez ajouter un lieu ici.');
  }
  if (hasAny(text, ['account', 'profile', 'settings', 'my profile', 'الحساب', 'حسابي', 'الملف الشخصي', 'الإعدادات', 'compte', 'profil', 'paramètres'])) {
    return response('account', l.account, 'Open your account settings.', 'افتح إعدادات حسابك.', 'Ouvrez les paramètres de votre compte.');
  }
  if (hasAny(text, ['map', 'where is the map', 'الخريطة', 'carte'])) {
    return response('map', l.map, 'Open the map.', 'افتح الخريطة.', 'Ouvrez la carte.');
  }
  if (hasAny(text, ['explore', 'find places', 'places near', 'استكشف', 'أماكن', 'lieux', 'explorer'])) {
    return response('explore', l.explore, 'Open Explore to browse places.', 'افتح استكشف لتصفح الأماكن.', 'Ouvrez Explorer pour parcourir les lieux.');
  }
  if (hasAny(text, ['community', 'contribution', 'المجتمع', 'مساهمة', 'communauté', 'contribution'])) {
    return response('community', l.community, 'Open Community.', 'افتح المجتمع.', 'Ouvrez la communauté.');
  }
  if (hasAny(text, ['flight', 'flights', 'طيران', 'رحلة جوية', 'vol', 'vols'])) {
    return response('flights', l.flights, 'Open Flights.', 'افتح الطيران.', 'Ouvrez Vols.');
  }
  if (hasAny(text, ['weather', 'forecast', 'الطقس', 'météo', 'meteo'])) {
    return response('weather', l.weather, 'Open Weather.', 'افتح الطقس.', 'Ouvrez la météo.');
  }
  if (hasAny(text, ['home', 'home page', 'الرئيسية', 'accueil'])) {
    return response('home', l.home, 'Go to Home.', 'اذهب إلى الرئيسية.', 'Allez à l’accueil.');
  }
  return null;
}

function cleanDestination(value: string) {
  return value
    .replace(/[.!?؟]+$/g, '')
    .replace(/\b(please|today|tomorrow|now)\b/gi, '')
    .trim();
}

export function extractDestinationIntent(message: string, language: string): string | null {
  const trimmed = message.trim();
  const patterns = language === 'ar'
    ? [/(?:أريد|اريد|بغيت|حاب|أرغب).{0,24}(?:إلى|الى|لـ|ل)\s*([^؟.!]+)/i, /(?:اذهب|أذهب|سافر|أسافر)\s+(?:إلى|الى|لـ|ل)?\s*([^؟.!]+)/i]
    : language === 'fr'
      ? [/(?:je veux|j'aimerais|je voudrais).{0,24}(?:aller|voyager|visiter)\s+(?:à|au|aux|vers)?\s*([^.!?]+)/i, /(?:aller|voyager|visiter)\s+(?:à|au|aux|vers)\s+([^.!?]+)/i]
      : [/(?:i want|i'd like|i would like).{0,24}(?:go|travel|visit)\s+(?:to\s+)?([^.!?]+)/i, /(?:go|travel|visit|going)\s+to\s+([^.!?]+)/i];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      const destination = cleanDestination(match[1]);
      if (destination.length >= 2 && destination.length <= 80) return destination;
    }
  }
  return null;
}

export function destinationVoiceReply(destination: string, language: string): AssistantNavigationReply {
  const text = language === 'ar'
    ? `${destination}. ماذا تريد أن تفعل؟`
    : language === 'fr'
      ? `${destination}. Que souhaitez-vous faire ?`
      : `${destination}. What would you like to do?`;
  return {
    text,
    actions: [
      {
        target: 'explore',
        query: destination,
        label: language === 'ar' ? `استكشف ${destination}` : language === 'fr' ? `Explorer ${destination}` : `Explore ${destination}`,
      },
      {
        target: 'trips',
        query: destination,
        label: language === 'ar' ? 'إضافة رحلة' : language === 'fr' ? 'Ajouter un voyage' : 'Add Trip',
      },
    ],
  };
}

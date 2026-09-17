import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  Coins,
  MapPin,
  Plus,
  SlidersHorizontal,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  addTripExpense,
  ApiAuthenticationError,
  createTrip,
  deleteTrip,
  deleteTripExpense,
  fetchPlaces,
  fetchTripExpenses,
  fetchTrips,
  planTrip,
  Trip,
  TripBudget,
  TripExpenseCategory,
  TripItinerary,
  updateTrip,
} from '../services/api';
import { Place } from '../types';
import { SupportedLanguage } from '../data/translations';
import { AuthStatus } from '../lib/authSession';
import { buildCityDestination, rankFuzzyDestinations } from '../lib/fuzzyDestination';
import { formatDate, useLocale } from '../lib/i18n';
import { placeDisplayName } from '../lib/placeView';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Button, IconButton } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Alert, EmptyState, ErrorState, SkeletonList } from '../ui/Feedback';
import { OptionCard, Select, TextInput } from '../ui/Field';
import { Panel, Divider } from '../ui/Panel';
import { Sheet } from '../ui/Sheet';
import { toast } from '../ui/toast';

interface TripsPlannerProps {
  language?: SupportedLanguage;
  authStatus?: AuthStatus;
  onOpenAuth?: () => void;
  onTripCreated?: (destination: Place) => void;
  initialDestinationQuery?: string;
}

const preferenceOptions = [
  { value: 'nature', ar: 'طبيعة', en: 'Nature', fr: 'Nature' },
  { value: 'culture', ar: 'ثقافة', en: 'Culture', fr: 'Culture' },
  { value: 'food', ar: 'طعام', en: 'Food', fr: 'Cuisine' },
  { value: 'relaxation', ar: 'استرخاء', en: 'Relaxation', fr: 'Détente' },
  { value: 'shopping', ar: 'تسوق', en: 'Shopping', fr: 'Shopping' },
];

const expenseCategories: TripExpenseCategory[] = ['accommodation', 'food', 'transport', 'activity', 'souvenir', 'other'];
const MAX_PLAN_DAYS = 7;

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromToday(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return dateInputValue(date);
}

function addDays(value: string, offset: number) {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(timestamp)) return '';
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function dayCount(start: string, end: string) {
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 1;
  return Math.max(1, Math.round((to - from) / 86_400_000) + 1);
}

// Internal error codes/messages that must never reach the user verbatim.
// Anything that looks like a machine code (ALL_CAPS_WITH_UNDERSCORES) is
// treated as internal, regardless of where it was thrown from.
const INTERNAL_ERROR_PATTERN = /^[A-Z][A-Z0-9_]{3,}$/;

function sessionExpiredMessage(language: string) {
  return language === 'ar'
    ? 'انتهت صلاحية جلسة الدخول. سجّل الدخول مجدداً للمتابعة.'
    : language === 'fr'
      ? 'Votre session a expiré. Reconnectez-vous pour continuer.'
      : 'Your session has expired. Sign in again to continue.';
}

function messageFrom(error: unknown, fallback: string, language: string = 'en'): string {
  if (error instanceof ApiAuthenticationError) return sessionExpiredMessage(language);
  if (error instanceof Error && error.message && !INTERNAL_ERROR_PATTERN.test(error.message.trim())) {
    return error.message;
  }
  return fallback;
}

function mergePlaceResults(primary: Place[], additional: Place[]) {
  const merged = [...primary];
  for (const place of additional) {
    if (!merged.some((candidate) => candidate.id === place.id)) merged.push(place);
  }
  return merged;
}

export const TripsPlanner: React.FC<TripsPlannerProps> = ({
  language = 'en',
  authStatus = 'restoring',
  onOpenAuth,
  onTripCreated,
  initialDestinationQuery = '',
}) => {
  const locale = useLocale(language);
  const l = locale.t;
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAuthLoadError, setIsAuthLoadError] = useState(false);

  const [step, setStep] = useState(1);
  const [search, setSearch] = useState(initialDestinationQuery);
  const [places, setPlaces] = useState<Place[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState('');
  const [placesSearched, setPlacesSearched] = useState(false);
  const [placesRetryToken, setPlacesRetryToken] = useState(0);
  const searchSequence = useRef(0);
  const [planning, setPlanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [planError, setPlanError] = useState('');
  const [itinerary, setItinerary] = useState<TripItinerary | null>(null);
  const [overBudget, setOverBudget] = useState(false);
  const [form, setForm] = useState({
    destinationId: '',
    startDate: dateFromToday(0),
    endDate: dateFromToday(1),
    budget: '1500',
    currency: 'MAD',
    participants: 1,
    preferences: [] as string[],
  });

  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [budgetByTripId, setBudgetByTripId] = useState<Record<string, TripBudget>>({});
  const [budgetLoadingId, setBudgetLoadingId] = useState<string | null>(null);
  const [budgetErrorByTripId, setBudgetErrorByTripId] = useState<Record<string, string>>({});
  const [expenseModalTripId, setExpenseModalTripId] = useState<string | null>(null);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseError, setExpenseError] = useState('');
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    category: 'food' as TripExpenseCategory,
    amount: '',
    description: '',
    expenseDate: dateFromToday(0),
  });

  const today = dateFromToday(0);
  const latestEndDate = addDays(form.startDate, MAX_PLAN_DAYS - 1);
  const selectedPlace = places.find((place) => place.id === form.destinationId) || null;
  const selectedIsCity = Boolean(selectedPlace?.id.startsWith('city:'));
  const tripDays = dayCount(form.startDate, form.endDate);
  const plannedTotal = Number(itinerary?.totalEstimatedCost ?? 0);
  const budgetNumber = Number(form.budget) || 0;
  const isPlanning = !itinerary;

  const STEPS = [
    { id: 1, label: l('Destination', 'الوجهة', 'Destination'), icon: MapPin },
    { id: 2, label: l('Dates', 'التواريخ', 'Dates'), icon: CalendarDays },
    { id: 3, label: l('Budget', 'الميزانية', 'Budget'), icon: Wallet },
    { id: 4, label: l('Travelers', 'المسافرون', 'Voyageurs'), icon: Users },
    { id: 5, label: l('Preferences', 'التفضيلات', 'Préférences'), icon: SlidersHorizontal },
  ];

  const resetPlanner = (destinationQuery = '') => {
    setStep(1);
    setSearch(destinationQuery);
    setPlaces([]);
    setPlacesSearched(false);
    setPlacesError('');
    setPlanError('');
    setItinerary(null);
    setOverBudget(false);
    setForm({
      destinationId: '',
      startDate: dateFromToday(0),
      endDate: dateFromToday(1),
      budget: '1500',
      currency: 'MAD',
      participants: 1,
      preferences: [],
    });
  };

  useEffect(() => {
    if (initialDestinationQuery.trim()) resetPlanner(initialDestinationQuery.trim());
  }, [initialDestinationQuery]);

  const loadTrips = async () => {
    setLoading(true);
    setError('');
    setIsAuthLoadError(false);
    try {
      setTrips(await fetchTrips());
    } catch (loadError) {
      const authFailure = loadError instanceof ApiAuthenticationError;
      setIsAuthLoadError(authFailure);
      setError(authFailure
        ? l('Your session could not be verified.', 'تعذر التحقق من جلسة الدخول.', 'Votre session n’a pas pu être vérifiée.')
        : messageFrom(loadError, l('Unable to load trips.', 'تعذر تحميل الرحلات.', 'Impossible de charger les voyages.'), language));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authStatus === 'authed') void loadTrips();
    else if (authStatus === 'anonymous') {
      setTrips([]);
      setLoading(false);
    }
  }, [authStatus]);

  useEffect(() => {
    const query = search.trim();
    const sequence = ++searchSequence.current;
    if (query.length < 2) {
      setPlaces([]);
      setPlacesLoading(false);
      setPlacesError('');
      setPlacesSearched(false);
      if (form.destinationId) setForm((current) => ({ ...current, destinationId: '' }));
      return;
    }

    setPlacesLoading(true);
    setPlacesError('');
    const timer = window.setTimeout(async () => {
      try {
        const direct = await fetchPlaces({ query });
        if (sequence !== searchSequence.current) return;
        let results = direct;

        // A sparse exact search (for example one hotel in Marrakech) must not make that
        // hotel pretend to be the city. Supplement with catalog matches and derive a city row.
        if (query.length >= 3 && direct.length < 8) {
          const liveCatalog = await fetchPlaces();
          if (sequence !== searchSequence.current) return;
          results = mergePlaceResults(direct, rankFuzzyDestinations(query, liveCatalog, 24));
        }

        const city = buildCityDestination(query, results);
        const finalResults = city
          ? [city, ...results.filter((place) => place.id !== city.id)].slice(0, 24)
          : results.slice(0, 24);
        if (sequence !== searchSequence.current) return;
        setPlaces(finalResults);
        setPlacesSearched(true);
        if (form.destinationId && !finalResults.some((place) => place.id === form.destinationId)) {
          setForm((current) => ({ ...current, destinationId: '' }));
        }
      } catch (searchError) {
        if (sequence !== searchSequence.current) return;
        setPlaces([]);
        setPlacesSearched(true);
        setPlacesError(messageFrom(searchError, l('Unable to search destinations.', 'تعذر البحث عن الوجهات.', 'Impossible de rechercher les destinations.'), language));
      } finally {
        if (sequence === searchSequence.current) setPlacesLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, placesRetryToken]);

  const updateForm = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));
  const togglePreference = (value: string) => updateForm({
    preferences: form.preferences.includes(value)
      ? form.preferences.filter((item) => item !== value)
      : form.preferences.concat(value),
  });

  const nextStep = () => {
    if (step === 1 && !form.destinationId) return setPlanError(l('Choose a destination.', 'اختر وجهة.', 'Choisissez une destination.'));
    if (step === 2 && (!form.startDate || !form.endDate || form.endDate < form.startDate)) return setPlanError(l('Check the trip dates.', 'تحقق من تواريخ الرحلة.', 'Vérifiez les dates du voyage.'));
    if (step === 2 && form.startDate < today) return setPlanError(l('The trip cannot start in the past.', 'لا يمكن أن تبدأ الرحلة في تاريخ مضى.', 'Le voyage ne peut pas commencer dans le passé.'));
    if (step === 2 && latestEndDate && form.endDate > latestEndDate) return setPlanError(l('Plans support up to 7 days.', 'يدعم التخطيط مدة تصل إلى 7 أيام.', 'Les plans prennent en charge jusqu’à 7 jours.'));
    if (step === 3 && (!Number.isFinite(Number(form.budget)) || Number(form.budget) <= 0)) return setPlanError(l('Enter a valid budget.', 'أدخل ميزانية صحيحة.', 'Saisissez un budget valide.'));
    setPlanError('');
    setStep((current) => Math.min(5, current + 1));
  };

  const runPlan = async () => {
    if (!selectedPlace) return;
    if (authStatus !== 'authed') {
      setPlanError(l(
        'Sign in to generate your AI itinerary. Your destination, dates, budget, and preferences are kept.',
        'سجّل الدخول لإنشاء خطتك بالذكاء الاصطناعي. سيتم الاحتفاظ بالوجهة والتواريخ والميزانية والتفضيلات التي أدخلتها.',
        'Connectez-vous pour générer votre itinéraire IA. Votre destination, vos dates, votre budget et vos préférences sont conservés.',
      ));
      return;
    }
    setPlanning(true);
    setPlanError('');
    try {
      const result = await planTrip({
        destinationId: selectedIsCity ? undefined : selectedPlace.id,
        destination: selectedIsCity ? {
          name: selectedPlace.name,
          arabicName: selectedPlace.arabicName,
          frenchName: selectedPlace.frenchName,
          region: selectedPlace.region,
          area: selectedPlace.area,
          address: selectedPlace.address,
          coordinates: selectedPlace.coordinates,
        } : undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        budget: Number(form.budget),
        currency: form.currency,
        participants: form.participants,
        preferences: form.preferences,
      });
      setItinerary(result.itinerary);
      setOverBudget(result.overBudget);
    } catch (planFailure) {
      setPlanError(messageFrom(planFailure, l('Unable to create the plan.', 'تعذر إنشاء الخطة.', 'Impossible de créer le plan.'), language));
    } finally {
      setPlanning(false);
    }
  };

  const saveTrip = async () => {
    if (!itinerary || !selectedPlace) return;
    setSaving(true);
    setPlanError('');
    try {
      const enrichedItinerary: TripItinerary = {
        ...itinerary,
        destinationName: itinerary.destinationName || selectedPlace.name,
        destinationArea: itinerary.destinationArea || selectedPlace.area,
        destinationRegion: itinerary.destinationRegion || selectedPlace.region,
        destinationCoordinates: itinerary.destinationCoordinates || selectedPlace.coordinates,
      };
      const trip = await createTrip({
        name: locale.isArabic ? `رحلة إلى ${selectedPlace.arabicName || selectedPlace.name}` : locale.isFrench ? `Voyage à ${selectedPlace.frenchName || selectedPlace.name}` : `Trip to ${selectedPlace.name}`,
        destinationId: selectedIsCity ? undefined : selectedPlace.id,
        startDate: form.startDate,
        endDate: form.endDate,
        budget: Number(form.budget),
        currency: form.currency,
        participantsCount: form.participants,
        preferences: form.preferences,
        aiItinerary: enrichedItinerary,
      });
      const saved = selectedIsCity && !trip.destinationName ? { ...trip, destinationName: selectedPlace.name, aiItinerary: enrichedItinerary } : trip;
      setTrips((current) => [saved, ...current]);
      const destination = selectedPlace;
      resetPlanner();
      toast(l('Trip saved', 'تم حفظ الرحلة', 'Voyage enregistré'), { tone: 'success' });
      onTripCreated?.(destination);
    } catch (saveFailure) {
      setPlanError(messageFrom(saveFailure, l('Unable to save the trip.', 'تعذر حفظ الرحلة.', 'Impossible d’enregistrer le voyage.'), language));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (trip: Trip, status: Trip['status']) => {
    try {
      const updated = await updateTrip(trip.id, { status });
      setTrips((current) => current.map((item) => item.id === trip.id ? { ...updated, spentTotal: item.spentTotal } : item));
    } catch (statusError) {
      setError(messageFrom(statusError, l('Unable to update trip.', 'تعذر تحديث الرحلة.', 'Impossible de mettre à jour le voyage.'), language));
    }
  };

  const removeTrip = async (trip: Trip) => {
    if (!window.confirm(l(`Delete “${trip.name}”?`, `حذف «${trip.name}»؟`, `Supprimer « ${trip.name} » ?`))) return;
    try {
      await deleteTrip(trip.id);
      setTrips((current) => current.filter((item) => item.id !== trip.id));
      setExpandedTripId((current) => current === trip.id ? null : current);
      toast(l('Trip deleted', 'تم حذف الرحلة', 'Voyage supprimé'));
    } catch (deleteError) {
      setError(messageFrom(deleteError, l('Unable to delete trip.', 'تعذر حذف الرحلة.', 'Impossible de supprimer le voyage.'), language));
    }
  };

  const applyBudget = (tripId: string, budget: TripBudget) => {
    setBudgetByTripId((current) => ({ ...current, [tripId]: budget }));
    setTrips((current) => current.map((trip) => trip.id === tripId ? { ...trip, spentTotal: budget.spentTotal } : trip));
  };

  const loadExpenses = async (tripId: string) => {
    setBudgetLoadingId(tripId);
    setBudgetErrorByTripId((current) => ({ ...current, [tripId]: '' }));
    try {
      applyBudget(tripId, await fetchTripExpenses(tripId));
    } catch (loadError) {
      setBudgetErrorByTripId((current) => ({ ...current, [tripId]: messageFrom(loadError, l('Unable to load expenses.', 'تعذر تحميل المصروفات.', 'Impossible de charger les dépenses.'), language) }));
    } finally {
      setBudgetLoadingId((current) => current === tripId ? null : current);
    }
  };

  const toggleTrip = (tripId: string) => {
    if (expandedTripId === tripId) return setExpandedTripId(null);
    setExpandedTripId(tripId);
    if (!budgetByTripId[tripId]) void loadExpenses(tripId);
  };

  const submitExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!expenseModalTripId) return;
    const amount = Number(expenseForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) return setExpenseError(l('Enter an amount greater than zero.', 'أدخل مبلغاً أكبر من صفر.', 'Saisissez un montant supérieur à zéro.'));
    const budget = budgetByTripId[expenseModalTripId];
    if (!budget) return;
    setExpenseSaving(true);
    setExpenseError('');
    try {
      const updated = await addTripExpense(expenseModalTripId, {
        category: expenseForm.category,
        amount,
        currency: budget.currency,
        description: expenseForm.description.trim() || undefined,
        expenseDate: expenseForm.expenseDate,
      });
      applyBudget(expenseModalTripId, updated);
      setExpenseModalTripId(null);
      setExpenseForm({ category: 'food', amount: '', description: '', expenseDate: dateFromToday(0) });
      toast(l('Expense added', 'تمت إضافة المصروف', 'Dépense ajoutée'), { tone: 'success' });
    } catch (saveError) {
      setExpenseError(messageFrom(saveError, l('Unable to save expense.', 'تعذر حفظ المصروف.', 'Impossible d’enregistrer la dépense.'), language));
    } finally {
      setExpenseSaving(false);
    }
  };

  const removeExpense = async (tripId: string, expenseId: string) => {
    if (!window.confirm(l('Delete this expense?', 'حذف هذا المصروف؟', 'Supprimer cette dépense ?'))) return;
    setDeletingExpenseId(expenseId);
    try {
      applyBudget(tripId, await deleteTripExpense(tripId, expenseId));
    } catch (deleteError) {
      setBudgetErrorByTripId((current) => ({ ...current, [tripId]: messageFrom(deleteError, l('Unable to delete expense.', 'تعذر حذف المصروف.', 'Impossible de supprimer la dépense.'), language) }));
    } finally {
      setDeletingExpenseId(null);
    }
  };

  const statusLabel = (status: Trip['status']) => ({
    planning: l('Planning', 'قيد التخطيط', 'Planification'),
    active: l('Active', 'نشطة', 'Actif'),
    completed: l('Completed', 'مكتملة', 'Terminé'),
    cancelled: l('Cancelled', 'ملغاة', 'Annulé'),
  })[status];

  const statusTone = (status: Trip['status']): 'brand' | 'positive' | 'neutral' | 'caution' => ({
    planning: 'brand' as const,
    active: 'positive' as const,
    completed: 'neutral' as const,
    cancelled: 'caution' as const,
  })[status];

  if (authStatus === 'restoring') {
    return (
      <>
        <ScreenHeader title={l('My Trips', 'رحلاتي', 'Mes voyages')} />
        <div className="mx-auto w-full max-w-3xl px-3 pt-4 sm:px-5">
          <SkeletonList rows={3} />
        </div>
      </>
    );
  }

  return (
    <div className="min-h-dvh">
      <ScreenHeader
        title={l('My Trips', 'رحلاتي', 'Mes voyages')}
        subtitle={trips.length > 0 ? l(`${trips.length} saved`, `${trips.length} محفوظة`, `${trips.length} enregistrés`) : undefined}
        actions={isPlanning ? (
          <Button size="sm" onClick={() => resetPlanner()} icon={<Plus className="h-3.5 w-3.5" />}>
            {l('Add Trip', 'إضافة رحلة', 'Ajouter un voyage')}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => resetPlanner()}>
            {l('New trip', 'رحلة جديدة', 'Nouveau voyage')}
          </Button>
        )}
      />

      <div className="mx-auto w-full max-w-3xl px-3 pb-8 pt-4 sm:px-5">
        {error && (
          <Alert
            tone="error"
            className="mb-4"
            action={
              <>
                <Button size="sm" variant="secondary" onClick={() => void loadTrips()}>
                  {l('Retry', 'إعادة المحاولة', 'Réessayer')}
                </Button>
                {isAuthLoadError && onOpenAuth && (
                  <Button size="sm" variant="ghost" onClick={onOpenAuth}>
                    {l('Sign in', 'تسجيل الدخول', 'Se connecter')}
                  </Button>
                )}
              </>
            }
          >
            {error}
          </Alert>
        )}

        {isPlanning ? (
          <Panel padded="md" className="overflow-hidden">
            <ol className="sindbad-scroll-x flex items-center gap-1.5 border-b border-line px-4 py-3" aria-label={l('Plan steps', 'خطوات التخطيط', 'Étapes du plan')}>
              {STEPS.map((item, index) => {
                const done = step > item.id;
                const current = step === item.id;
                return (
                  <li key={item.id} className="flex flex-1 shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => { if (done) { setPlanError(''); setStep(item.id); } }}
                      disabled={!done && !current}
                      aria-current={current ? 'step' : undefined}
                      aria-label={item.label}
                      className={`flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] ${done ? 'hover:bg-brand-soft' : ''} disabled:cursor-default`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-micro font-bold ${
                          current
                            ? 'border-brand-600 bg-brand-fill text-on-brand'
                            : done
                              ? 'border-brand-600 bg-brand-soft text-brand-accent'
                              : 'border-line-strong text-muted'
                        }`}
                      >
                        {done ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" /> : item.id}
                      </span>
                      <span className={`hidden truncate text-label font-bold sm:block ${current ? 'text-ink' : done ? 'text-brand-accent' : 'text-muted'}`}>
                        {item.label}
                      </span>
                    </button>
                    {index < STEPS.length - 1 && <span className="h-px min-w-2 flex-1 bg-line" aria-hidden="true" />}
                  </li>
                );
              })}
            </ol>

            <div className="p-4 sm:p-5">
              {step === 1 && (
                <div className="space-y-3">
                  <TextInput
                    id="trip-destination-search"
                    type="search"
                    label={l('Destination', 'الوجهة', 'Destination')}
                    value={search}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
                    placeholder={l('Search a city or place', 'ابحث عن مدينة أو مكان', 'Rechercher une ville ou un lieu')}
                    autoComplete="off"
                  />

                  {search.trim().length < 2 ? (
                    <p className="rounded-lg bg-surface-muted px-3.5 py-4 text-center text-caption text-muted [text-wrap:balance]">
                      {l('Type at least 2 characters.', 'اكتب حرفين على الأقل.', 'Saisissez au moins 2 caractères.')}
                    </p>
                  ) : placesLoading ? (
                    <div aria-busy="true">
                      <SkeletonList rows={3} className="[&>li]:border-line" />
                      <p className="sr-only">{l('Searching destinations…', 'جارٍ البحث عن وجهات…', 'Recherche de destinations…')}</p>
                    </div>
                  ) : placesError ? (
                    <ErrorState
                      title={l('Destination search failed.', 'فشل البحث عن الوجهة.', 'La recherche a échoué.')}
                      description={placesError}
                      retryLabel={l('Try again', 'إعادة المحاولة', 'Réessayer')}
                      onRetry={() => setPlacesRetryToken((token) => token + 1)}
                    />
                  ) : placesSearched && places.length === 0 ? (
                    <EmptyState
                      icon={<MapPin className="h-5 w-5" aria-hidden="true" />}
                      title={l('No destinations found.', 'لم يتم العثور على وجهات.', 'Aucune destination trouvée.')}
                      description={l(
                        'A city, region or a single place all work as destinations.',
                        'تصلح المدينة أو الجهة أو مكان واحد كوجهة.',
                        'Une ville, une région ou un lieu unique font tous office de destination.',
                      )}
                    />
                  ) : (
                    <ul className="grid-cols-1 grid max-h-80 gap-2 overflow-y-auto pe-0.5 sm:grid-cols-2">
                      {places.map((place) => {
                        const isCity = place.id.startsWith('city:');
                        const selected = form.destinationId === place.id;
                        return (
                          <li key={place.id} data-destination-kind={isCity ? 'city' : 'place'}>
                            <OptionCard
                              selected={selected}
                              onSelect={() => updateForm({ destinationId: place.id })}
                              label={placeDisplayName(place, locale.language)}
                              description={isCity ? l('City', 'مدينة', 'Ville') : [place.area, place.region].filter(Boolean).join(' · ')}
                              icon={isCity ? <Building2 className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                              className="w-full"
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="grid-cols-1 grid gap-4 sm:grid-cols-2">
                  <TextInput
                    id="trip-start-date"
                    type="date"
                    label={l('Start date', 'تاريخ البداية', 'Date de début')}
                    value={form.startDate}
                    min={today}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                      const startDate = event.target.value;
                      const patch: Partial<typeof form> = { startDate };
                      if (form.endDate < startDate) patch.endDate = addDays(startDate, 1) || startDate;
                      updateForm(patch);
                    }}
                  />
                  <TextInput
                    id="trip-end-date"
                    type="date"
                    label={l('End date', 'تاريخ النهاية', 'Date de fin')}
                    hint={l(`${tripDays} ${tripDays === 1 ? 'day' : 'days'}`, `${tripDays} يوم`, `${tripDays} ${tripDays === 1 ? 'jour' : 'jours'}`)}
                    value={form.endDate}
                    min={form.startDate}
                    max={latestEndDate}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateForm({ endDate: event.target.value })}
                  />
                </div>
              )}

              {step === 3 && (
                <div className="grid-cols-1 grid gap-4 sm:grid-cols-[1fr_9rem]">
                  <TextInput
                    id="trip-budget"
                    type="number"
                    min="1"
                    inputMode="decimal"
                    label={l('Budget', 'الميزانية', 'Budget')}
                    hint={l(`About ${(budgetNumber / Math.max(1, tripDays)).toFixed(0)} ${form.currency} a day`, `حوالي ${(budgetNumber / Math.max(1, tripDays)).toFixed(0)} ${form.currency} يومياً`, `Environ ${(budgetNumber / Math.max(1, tripDays)).toFixed(0)} ${form.currency} par jour`)}
                    value={form.budget}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateForm({ budget: event.target.value })}
                  />
                  <Select
                    id="trip-currency"
                    label={l('Currency', 'العملة', 'Devise')}
                    value={form.currency}
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateForm({ currency: event.target.value })}
                  >
                    <option value="MAD">MAD</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </Select>
                </div>
              )}

              {step === 4 && (
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <TextInput
                    id="trip-participants"
                    type="number"
                    min="1"
                    max="50"
                    inputMode="numeric"
                    className="w-32"
                    label={l('Travelers', 'المسافرون', 'Voyageurs')}
                    value={form.participants}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateForm({ participants: Math.max(1, Number(event.target.value) || 1) })}
                  />
                  <p className="pb-3 text-caption text-muted">
                    {l('Costs in the plan are totals for the group.', 'التكاليف في الخطة إجماعية للمجموعة.', 'Les coûts du plan sont des totaux pour le groupe.')}
                  </p>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-3">
                  <div className="grid-cols-1 grid gap-2 sm:grid-cols-2">
                    {preferenceOptions.map((preference) => (
                      <OptionCard
                        key={preference.value}
                        selected={form.preferences.includes(preference.value)}
                        onSelect={() => togglePreference(preference.value)}
                        label={locale.isArabic ? preference.ar : locale.isFrench ? preference.fr : preference.en}
                        className="w-full"
                      />
                    ))}
                  </div>
                  <div className="rounded-lg bg-surface-muted p-3">
                    <p className="text-caption font-bold text-ink">{selectedPlace ? placeDisplayName(selectedPlace, locale.language) : l('No destination', 'بدون وجهة', 'Aucune destination')}</p>
                    <p className="mt-0.5 text-micro text-muted">
                      {[
                        `${formatDate(form.startDate, language)} – ${formatDate(form.endDate, language)}`,
                        `${tripDays} ${l('days', 'أيام', 'jours')}`,
                        `${form.budget} ${form.currency}`,
                        `${form.participants} ${l('travelers', 'مسافر', 'voyageurs')}`,
                      ].join(' · ')}
                    </p>
                  </div>
                  {authStatus === 'anonymous' && !planError && (
                    <Alert tone="info">
                      {l(
                        'Sign-in is required to generate and save the plan. Your inputs will stay filled in.',
                        'يلزم تسجيل الدخول لإنشاء الخطة وحفظها. ستبقى مدخلاتك محفوظة كما هي.',
                        'La connexion est requise pour générer et enregistrer le plan. Vos informations resteront renseignées.',
                      )}
                    </Alert>
                  )}
                </div>
              )}

              {planError && (
                <div className="mt-4">
                  <Alert
                    tone="error"
                    action={authStatus === 'anonymous' && onOpenAuth ? (
                      <Button size="sm" variant="secondary" onClick={onOpenAuth}>
                        {l('Sign in', 'تسجيل الدخول', 'Se connecter')}
                      </Button>
                    ) : undefined}
                  >
                    {planError}
                  </Alert>
                </div>
              )}

              <Divider className="my-4" />

              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <Button variant="ghost" onClick={() => { setPlanError(''); setStep((current) => Math.max(1, current - 1)); }} disabled={step === 1}>
                  {l('Back', 'السابق', 'Retour')}
                </Button>
                {step < 5 ? (
                  <Button className="ms-auto" onClick={nextStep}>
                    {l('Next', 'التالي', 'Suivant')}
                  </Button>
                ) : (
                  <Button className="ms-auto" onClick={() => void runPlan()} loading={planning}>
                    {l('Create Plan', 'إنشاء الخطة', 'Créer le plan')}
                  </Button>
                )}
              </div>
            </div>
          </Panel>
        ) : (
          <Panel padded="none" className="overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-line p-4 sm:p-5">
              <div className="min-w-0">
                <h2 className="text-h2 font-bold tracking-tight text-ink [text-wrap:balance]">
                  {itinerary.destinationName || (selectedPlace ? placeDisplayName(selectedPlace, locale.language) : l('Your plan', 'خطتك', 'Votre plan'))}
                </h2>
                <p className="mt-0.5 truncate text-micro text-muted">
                  {[selectedPlace?.area || selectedPlace?.region, `${formatDate(form.startDate, language)} – ${formatDate(form.endDate, language)}`].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="shrink-0 text-end">
                <p className="text-title font-extrabold text-ink tabular-nums">{plannedTotal.toFixed(2)} {form.currency}</p>
                <p className={`text-micro font-semibold ${overBudget ? 'text-caution-strong' : 'text-muted'}`}>
                  {overBudget
                    ? l(`${(plannedTotal - budgetNumber).toFixed(0)} over`, `أعلى بـ ${(plannedTotal - budgetNumber).toFixed(0)}`, `${(plannedTotal - budgetNumber).toFixed(0)} en dessus`)
                    : l(`of ${budgetNumber.toFixed(0)} budget`, `من ميزانية ${budgetNumber.toFixed(0)}`, `sur un budget de ${budgetNumber.toFixed(0)}`)}
                </p>
              </div>
            </div>

            <div className="h-1 w-full bg-surface-sunken" role="img" aria-label={l('Budget used', 'الميزانية المستعملة', 'Budget utilisé')}>
              <div
                className={`h-full transition-[width] duration-300 ${overBudget ? 'bg-caution' : 'bg-positive-fill'}`}
                style={{ width: `${budgetNumber > 0 ? Math.min(100, (plannedTotal / budgetNumber) * 100) : 0}%` }}
              />
            </div>

            {overBudget && (
              <div className="px-4 pt-4 sm:px-5">
                <Alert tone="warning">
                  {l('This plan exceeds the budget.', 'هذه الخطة تتجاوز الميزانية.', 'Ce plan dépasse le budget.')}
                </Alert>
              </div>
            )}

            <ol className="space-y-0 p-4 sm:p-5">
              {itinerary.days.map((day) => (
                <li key={day.day} className="relative ps-7">
                  <span className="absolute start-[0.4375rem] top-6 bottom-0 w-px bg-line" aria-hidden="true" />
                  <span className="absolute start-0 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-brand-500 bg-surface" aria-hidden="true" />
                  <h3 className="text-body font-bold text-ink">
                    {l('Day', 'اليوم', 'Jour')} {day.day}
                    <span className="ms-2 font-medium text-muted">{day.title}</span>
                  </h3>
                  {typeof day.dailyCost === 'number' && (
                    <p className="mt-0.5 flex items-center gap-1 text-micro text-muted tabular-nums">
                      <Coins className="h-3 w-3" aria-hidden="true" />
                      {day.dailyCost.toFixed(2)} {itinerary.currency || form.currency}
                    </p>
                  )}
                  <ul className="mt-2 space-y-2.5 pb-4">
                    {day.items.map((item, index) => (
                      <li key={`${day.day}-${index}`} className="flex gap-3">
                        <span className="w-12 shrink-0 pt-px text-micro font-bold text-brand-accent tabular-nums">{item.time}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-caption font-semibold text-ink">{item.activity}</span>
                          {item.note && <span className="mt-0.5 block text-micro leading-relaxed text-muted">{item.note}</span>}
                          {typeof item.estimatedCost === 'number' && item.estimatedCost > 0 && (
                            <span className="mt-0.5 block text-micro text-muted tabular-nums">
                              {item.estimatedCost.toFixed(2)} {itinerary.currency || form.currency}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>

            {Array.isArray(itinerary.tips) && itinerary.tips.length > 0 && (
              <div className="border-t border-line px-4 py-3 sm:px-5">
                <ul className="space-y-1.5">
                  {itinerary.tips.map((tip) => (
                    <li key={tip} className="flex gap-2 text-micro leading-relaxed text-muted">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-2 border-t border-line bg-surface-muted p-3 sm:px-5">
              <Button variant="secondary" onClick={() => resetPlanner()} className="shrink-0">
                {l('Discard', 'تجاهل', 'Annuler')}
              </Button>
              <Button className="min-w-0 flex-1" onClick={() => void saveTrip()} loading={saving} icon={<Check className="h-4 w-4" />}>
                {l('Save Trip', 'حفظ الرحلة', 'Enregistrer le voyage')}
              </Button>
            </div>

            {planError && (
              <div className="px-4 pb-4 sm:px-5">
                <Alert tone="error">{planError}</Alert>
              </div>
            )}
          </Panel>
        )}

        <section className="mt-6" aria-labelledby="trips-saved-heading">
          <h2 id="trips-saved-heading" className="mb-2 text-title font-bold tracking-tight text-ink">
            {l('Saved trips', 'الرحلات المحفوظة', 'Voyages enregistrés')}
          </h2>

          {authStatus === 'anonymous' ? (
            <EmptyState
              tone="dashed"
              icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
              title={l('Sign in to keep your trips', 'سجّل الدخول للاحتفاظ برحلاتك', 'Connectez-vous pour conserver vos voyages')}
              description={l(
                'Plans you save appear here with their expenses, on every device you use.',
                'تظهر الخطط المحفوظة هنا مع مصروفاتها على كل جهاز تستخدمه.',
                'Les plans enregistrés apparaissent ici avec leurs dépenses, sur chaque appareil.',
              )}
              action={onOpenAuth ? <Button size="sm" onClick={onOpenAuth}>{l('Sign in', 'تسجيل الدخول', 'Se connecter')}</Button> : undefined}
            />
          ) : loading ? (
            <SkeletonList rows={2} />
          ) : trips.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
              title={l('No trips yet.', 'لا توجد رحلات بعد.', 'Aucun voyage pour le moment.')}
              description={isPlanning
                ? l('Build a plan above and save it to see it here.', 'أنشئ خطة أعلاه واحفظها لتظهر هنا.', 'Créez un plan ci-dessus puis enregistrez-le.')
                : l('Your saved plan will show up here.', 'ستظهر خطتك المحفوظة هنا.', 'Votre plan enregistré apparaîtra ici.')}
            />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {trips.map((trip) => {
                const budget = budgetByTripId[trip.id];
                const spent = budget?.spentTotal ?? trip.spentTotal ?? 0;
                const expanded = expandedTripId === trip.id;
                const destinationName = trip.destinationName || trip.aiItinerary?.destinationName || l('Destination', 'وجهة', 'Destination');
                const share = trip.budget > 0 ? Math.min(100, (spent / trip.budget) * 100) : 0;
                return (
                  <li key={trip.id}>
                    <div className="flex items-start gap-3 p-3.5">
                      <button type="button" onClick={() => toggleTrip(trip.id)} aria-expanded={expanded} className="min-w-0 flex-1 text-start">
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 truncate text-body font-bold text-ink">{trip.name}</span>
                          <Chip tone={statusTone(trip.status)}>{statusLabel(trip.status)}</Chip>
                        </span>
                        <span className="mt-0.5 block truncate text-micro text-muted">
                          {destinationName} · {formatDate(trip.startDate, language)} – {formatDate(trip.endDate, language)}
                        </span>
                        <span className="mt-2 flex items-center gap-2">
                          <span className="h-1 min-w-14 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                            <span className={`block h-full rounded-full ${spent > trip.budget ? 'bg-caution' : 'bg-positive-fill'}`} style={{ width: `${share}%` }} />
                          </span>
                          <span className="shrink-0 text-micro font-semibold text-muted tabular-nums">
                            {spent.toFixed(0)} / {trip.budget.toFixed(0)} {trip.currency}
                          </span>
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center">
                        <Select
                          id={`trip-status-${trip.id}`}
                          className="me-1 hidden w-32 sm:block"
                          value={trip.status}
                          onChange={(event: React.ChangeEvent<HTMLSelectElement>) => void changeStatus(trip, event.target.value as Trip['status'])}
                        >
                          <option value="planning">{statusLabel('planning')}</option>
                          <option value="active">{statusLabel('active')}</option>
                          <option value="completed">{statusLabel('completed')}</option>
                          <option value="cancelled">{statusLabel('cancelled')}</option>
                        </Select>
                        <IconButton label={l('Delete trip', 'حذف الرحلة', 'Supprimer le voyage')} size="sm" variant="ghost" onClick={() => void removeTrip(trip)}>
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                        <IconButton label={expanded ? l('Collapse', 'طيّ', 'Replier') : l('Expenses', 'المصروفات', 'Dépenses')} size="sm" variant="ghost" onClick={() => toggleTrip(trip.id)}>
                          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                        </IconButton>
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-t border-line bg-surface-muted px-3.5 py-3.5">
                        {budgetLoadingId === trip.id ? (
                          <div className="space-y-2" aria-busy="true">
                            <span className="sindbad-skeleton block h-4 w-32 rounded" />
                            <span className="sindbad-skeleton block h-4 w-full rounded" />
                            <span className="sr-only">{l('Loading expenses…', 'جارٍ تحميل المصروفات…', 'Chargement des dépenses…')}</span>
                          </div>
                        ) : budgetErrorByTripId[trip.id] ? (
                          <Alert tone="error" action={
                            <Button size="sm" variant="secondary" onClick={() => void loadExpenses(trip.id)}>
                              {l('Retry', 'إعادة المحاولة', 'Réessayer')}
                            </Button>
                          }>
                            {budgetErrorByTripId[trip.id]}
                          </Alert>
                        ) : budget ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-label font-bold uppercase tracking-wide text-muted">
                                {l('Expenses', 'المصروفات', 'Dépenses')}
                                <span className="ms-1.5 tabular-nums">{budget.expenses.length}</span>
                              </p>
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={<Plus className="h-3.5 w-3.5" />}
                                onClick={() => {
                                  setExpenseModalTripId(trip.id);
                                  setExpenseError('');
                                  setExpenseForm({ category: 'food', amount: '', description: '', expenseDate: dateFromToday(0) });
                                }}
                              >
                                {l('Add expense', 'إضافة مصروف', 'Ajouter une dépense')}
                              </Button>
                            </div>
                            {budget.expenses.length === 0 ? (
                              <p className="rounded-lg border border-dashed border-line-strong px-3 py-4 text-center text-micro text-muted">
                                {l('No expenses yet.', 'لا توجد مصروفات بعد.', 'Aucune dépense.')}
                              </p>
                            ) : (
                              <ul className="divide-y divide-line">
                                {budget.expenses.map((expense) => (
                                  <li key={expense.id} className="flex items-center gap-3 py-2">
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-caption font-bold text-ink">{expense.description || expense.category}</span>
                                      <span className="block text-micro text-muted">{formatDate(expense.expenseDate, language)}</span>
                                    </span>
                                    <span className="shrink-0 text-caption font-bold text-ink tabular-nums">{expense.amount.toFixed(2)} {expense.currency}</span>
                                    <button
                                      type="button"
                                      disabled={deletingExpenseId === expense.id}
                                      onClick={() => void removeExpense(trip.id, expense.id)}
                                      aria-label={l('Delete expense', 'حذف المصروف', 'Supprimer la dépense')}
                                      className="sindbad-hit-expand shrink-0 rounded-md p-1.5 text-muted transition-colors hover:text-negative disabled:opacity-50"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className="flex items-center justify-between border-t border-line pt-2.5 text-caption">
                              <span className="font-semibold text-muted">{l('Left to spend', 'المتبقي', 'Restant')}</span>
                              <span className={`font-bold tabular-nums ${trip.budget - budget.spentTotal < 0 ? 'text-caution-strong' : 'text-ink'}`}>
                                {(trip.budget - budget.spentTotal).toFixed(2)} {trip.currency}
                              </span>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <Sheet
        open={Boolean(expenseModalTripId)}
        onClose={() => setExpenseModalTripId(null)}
        title={l('Add expense', 'إضافة مصروف', 'Ajouter une dépense')}
        size="sm"
        language={language}
        footer={
          <Button className="w-full" type="submit" form="expense-form" loading={expenseSaving} disabled={expenseSaving}>
            {l('Save expense', 'حفظ المصروف', 'Enregistrer la dépense')}
          </Button>
        }
      >
        <form id="expense-form" onSubmit={submitExpense} className="space-y-3.5 px-4 pb-6 pt-3 sm:px-5">
          <Select
            id="expense-category"
            label={l('Category', 'الفئة', 'Catégorie')}
            value={expenseForm.category}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setExpenseForm((current) => ({ ...current, category: event.target.value as TripExpenseCategory }))}
          >
            {expenseCategories.map((category) => (
              <option key={category} value={category}>{category.replace('_', ' ')}</option>
            ))}
          </Select>
          <TextInput
            id="expense-amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            required
            label={l('Amount', 'المبلغ', 'Montant')}
            value={expenseForm.amount}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))}
          />
          <TextInput
            id="expense-description"
            label={l('Description', 'الوصف', 'Description')}
            hint={l('Optional', 'اختياري', 'Facultatif')}
            value={expenseForm.description}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setExpenseForm((current) => ({ ...current, description: event.target.value }))}
          />
          <TextInput
            id="expense-date"
            type="date"
            required
            label={l('Date', 'التاريخ', 'Date')}
            value={expenseForm.expenseDate}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setExpenseForm((current) => ({ ...current, expenseDate: event.target.value }))}
          />
          {expenseError && <Alert tone="error">{expenseError}</Alert>}
        </form>
      </Sheet>
    </div>
  );
};

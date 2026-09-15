import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
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

function formatDate(value: string, language: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-MA' : language, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export const TripsPlanner: React.FC<TripsPlannerProps> = ({
  language = 'en',
  authStatus = 'restoring',
  onOpenAuth,
  onTripCreated,
  initialDestinationQuery = '',
}) => {
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const l = (en: string, ar: string, fr: string) => isAr ? ar : isFr ? fr : en;
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
        : messageFrom(loadError, l('Unable to load trips.', 'تعذر تحميل الرحلات.', 'Impossible de charger les voyages.')));
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
        const results = await fetchPlaces({ query });
        if (sequence !== searchSequence.current) return;
        setPlaces(results.slice(0, 24));
        setPlacesSearched(true);
        if (form.destinationId && !results.some((place) => place.id === form.destinationId)) {
          setForm((current) => ({ ...current, destinationId: '' }));
        }
      } catch (searchError) {
        if (sequence !== searchSequence.current) return;
        setPlaces([]);
        setPlacesSearched(true);
        setPlacesError(messageFrom(searchError, l('Unable to search destinations.', 'تعذر البحث عن الوجهات.', 'Impossible de rechercher les destinations.')));
      } finally {
        if (sequence === searchSequence.current) setPlacesLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

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
    if (!form.destinationId) return;
    setPlanning(true);
    setPlanError('');
    try {
      const result = await planTrip({
        destinationId: form.destinationId,
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
      setPlanError(messageFrom(planFailure, l('Unable to create the plan.', 'تعذر إنشاء الخطة.', 'Impossible de créer le plan.')));
    } finally {
      setPlanning(false);
    }
  };

  const saveTrip = async () => {
    if (!itinerary || !selectedPlace) return;
    setSaving(true);
    setPlanError('');
    try {
      const trip = await createTrip({
        name: isAr ? `رحلة إلى ${selectedPlace.arabicName || selectedPlace.name}` : isFr ? `Voyage à ${selectedPlace.name}` : `Trip to ${selectedPlace.name}`,
        destinationId: selectedPlace.id,
        startDate: form.startDate,
        endDate: form.endDate,
        budget: Number(form.budget),
        currency: form.currency,
        participantsCount: form.participants,
        preferences: form.preferences,
        aiItinerary: itinerary,
      });
      setTrips((current) => [trip, ...current]);
      const destination = selectedPlace;
      resetPlanner();
      onTripCreated?.(destination);
    } catch (saveFailure) {
      setPlanError(messageFrom(saveFailure, l('Unable to save the trip.', 'تعذر حفظ الرحلة.', 'Impossible d’enregistrer le voyage.')));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (trip: Trip, status: Trip['status']) => {
    try {
      const updated = await updateTrip(trip.id, { status });
      setTrips((current) => current.map((item) => item.id === trip.id ? { ...updated, spentTotal: item.spentTotal } : item));
    } catch (statusError) {
      setError(messageFrom(statusError, l('Unable to update trip.', 'تعذر تحديث الرحلة.', 'Impossible de mettre à jour le voyage.')));
    }
  };

  const removeTrip = async (trip: Trip) => {
    if (!window.confirm(l(`Delete “${trip.name}”?`, `حذف «${trip.name}»؟`, `Supprimer « ${trip.name} » ?`))) return;
    try {
      await deleteTrip(trip.id);
      setTrips((current) => current.filter((item) => item.id !== trip.id));
      setExpandedTripId((current) => current === trip.id ? null : current);
    } catch (deleteError) {
      setError(messageFrom(deleteError, l('Unable to delete trip.', 'تعذر حذف الرحلة.', 'Impossible de supprimer le voyage.')));
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
      setBudgetErrorByTripId((current) => ({ ...current, [tripId]: messageFrom(loadError, l('Unable to load expenses.', 'تعذر تحميل المصروفات.', 'Impossible de charger les dépenses.')) }));
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
    } catch (saveError) {
      setExpenseError(messageFrom(saveError, l('Unable to save expense.', 'تعذر حفظ المصروف.', 'Impossible d’enregistrer la dépense.')));
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
      setBudgetErrorByTripId((current) => ({ ...current, [tripId]: messageFrom(deleteError, l('Unable to delete expense.', 'تعذر حذف المصروف.', 'Impossible de supprimer la dépense.')) }));
    } finally {
      setDeletingExpenseId(null);
    }
  };

  if (authStatus === 'restoring') return <CenteredLoading text={l('Loading…', 'جارٍ التحميل…', 'Chargement…')} />;
  if (authStatus === 'anonymous') return <div className="mx-auto flex max-w-xl justify-center p-8 pb-24"><button type="button" onClick={onOpenAuth} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">{l('Sign in to view your trips', 'سجّل الدخول لعرض رحلاتك', 'Connectez-vous pour voir vos voyages')}</button></div>;

  const statusLabel = (status: Trip['status']) => ({
    planning: l('Planning', 'قيد التخطيط', 'Planification'),
    active: l('Active', 'نشطة', 'Actif'),
    completed: l('Completed', 'مكتملة', 'Terminé'),
    cancelled: l('Cancelled', 'ملغاة', 'Annulé'),
  })[status];

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-5xl space-y-5 p-4 pb-24 sm:p-6">
      <section className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div><h1 className="text-xl font-black text-slate-900">{l('My Trips', 'رحلاتي', 'Mes voyages')}</h1><p className="mt-1 text-xs text-slate-500">{trips.length} {l('trips', 'رحلة', 'voyages')}</p></div>
        <button type="button" onClick={() => resetPlanner()} className="flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4" />{l('Add Trip', 'إضافة رحلة', 'Ajouter un voyage')}</button>
      </section>

      {error && <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><span>{error}</span><div className="flex gap-2"><button type="button" onClick={() => void loadTrips()} className="font-bold">{l('Retry', 'إعادة المحاولة', 'Réessayer')}</button>{isAuthLoadError && onOpenAuth && <button type="button" onClick={onOpenAuth} className="font-bold underline">{l('Sign in', 'تسجيل الدخول', 'Se connecter')}</button>}</div></div>}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between"><h2 className="font-black text-slate-900">{l('Add Trip', 'إضافة رحلة', 'Ajouter un voyage')}</h2><span className="text-xs font-bold text-slate-400">{step}/5</span></div>
        {step === 1 && <div className="space-y-3">
          <label htmlFor="trip-destination-search" className="text-sm font-bold text-slate-700">{l('Destination', 'الوجهة', 'Destination')}</label>
          <input id="trip-destination-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={l('Search a city or place', 'ابحث عن مدينة أو مكان', 'Rechercher une ville ou un lieu')} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500" />
          {search.trim().length < 2 ? <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500">{l('Type at least 2 characters.', 'اكتب حرفين على الأقل.', 'Saisissez au moins 2 caractères.')}</p>
            : placesLoading ? <CenteredLoading text={l('Searching…', 'جارٍ البحث…', 'Recherche…')} compact />
              : placesError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{placesError}</div>
                : placesSearched && places.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">{l('No destinations found.', 'لم يتم العثور على وجهات.', 'Aucune destination trouvée.')}</div>
                  : <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">{places.map((place) => <button key={place.id} type="button" onClick={() => updateForm({ destinationId: place.id })} className={`flex items-center gap-3 rounded-2xl border p-3 text-start ${form.destinationId === place.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300'}`}><MapPin className="h-5 w-5 shrink-0 text-blue-600" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-900">{isAr && place.arabicName ? place.arabicName : place.name}</strong><small className="block truncate text-slate-500">{place.area} · {place.region}</small></span>{form.destinationId === place.id && <Check className="h-4 w-4 text-blue-600" />}</button>)}</div>}
        </div>}
        {step === 2 && <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">{l('Start date', 'تاريخ البداية', 'Date de début')}<input type="date" value={form.startDate} min={today} onChange={(event) => updateForm({ startDate: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-normal" /></label><label className="text-sm font-bold text-slate-700">{l('End date', 'تاريخ النهاية', 'Date de fin')}<input type="date" value={form.endDate} min={form.startDate} max={latestEndDate} onChange={(event) => updateForm({ endDate: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-normal" /></label></div>}
        {step === 3 && <div className="grid gap-4 sm:grid-cols-[1fr_140px]"><label className="text-sm font-bold text-slate-700">{l('Budget', 'الميزانية', 'Budget')}<input type="number" min="1" value={form.budget} onChange={(event) => updateForm({ budget: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-normal" /></label><label className="text-sm font-bold text-slate-700">{l('Currency', 'العملة', 'Devise')}<select value={form.currency} onChange={(event) => updateForm({ currency: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-normal"><option>MAD</option><option>EUR</option><option>USD</option></select></label></div>}
        {step === 4 && <label className="block max-w-sm text-sm font-bold text-slate-700">{l('Travelers', 'المسافرون', 'Voyageurs')}<input type="number" min="1" max="50" value={form.participants} onChange={(event) => updateForm({ participants: Math.max(1, Number(event.target.value) || 1) })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-normal" /></label>}
        {step === 5 && <div><p className="mb-3 text-sm font-bold text-slate-700">{l('Preferences', 'التفضيلات', 'Préférences')}</p><div className="grid gap-2 sm:grid-cols-2">{preferenceOptions.map((preference) => <label key={preference.value} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 ${form.preferences.includes(preference.value) ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}><input type="checkbox" checked={form.preferences.includes(preference.value)} onChange={() => togglePreference(preference.value)} /><span className="text-sm font-bold text-slate-700">{isAr ? preference.ar : isFr ? preference.fr : preference.en}</span></label>)}</div></div>}
        {planError && <div className="mt-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertTriangle className="h-4 w-4" />{planError}</div>}
        <div className="mt-6 flex items-center justify-between gap-3"><button type="button" disabled={step === 1} onClick={() => { setPlanError(''); setStep((current) => Math.max(1, current - 1)); }} className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 disabled:invisible"><ChevronLeft className="h-4 w-4 rtl:rotate-180" />{l('Back', 'السابق', 'Retour')}</button>{step < 5 ? <button type="button" onClick={nextStep} className="flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">{l('Next', 'التالي', 'Suivant')}<ChevronRight className="h-4 w-4 rtl:rotate-180" /></button> : <button type="button" onClick={() => void runPlan()} disabled={planning} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{planning && <Loader2 className="h-4 w-4 animate-spin" />}{l('Create Plan', 'إنشاء الخطة', 'Créer le plan')}</button>}</div>
      </section>

      {itinerary && <section className="space-y-4 rounded-3xl border border-blue-100 bg-blue-50/40 p-4 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black text-slate-900">{selectedPlace?.name}</h2><p className="text-xs text-slate-500">{formatDate(form.startDate, language)} – {formatDate(form.endDate, language)}</p></div><strong className="text-lg text-blue-700">{itinerary.totalEstimatedCost.toFixed(2)} {form.currency}</strong></div>{overBudget && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">{l('This plan exceeds the budget.', 'هذه الخطة تتجاوز الميزانية.', 'Ce plan dépasse le budget.')}</div>}<div className="grid gap-3 md:grid-cols-2">{itinerary.days.map((day) => <article key={day.day} className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="mb-2 font-black text-slate-900">{l('Day', 'اليوم', 'Jour')} {day.day} · {day.title}</h3><div className="space-y-2">{day.items.map((item, index) => <div key={`${day.day}-${index}`} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between gap-2"><strong className="text-sm text-slate-800">{item.activity}</strong><span className="text-xs text-slate-500">{item.time}</span></div><p className="mt-1 text-xs text-slate-500">{item.note}</p></div>)}</div></article>)}</div><button type="button" onClick={() => void saveTrip()} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{l('Save Trip', 'حفظ الرحلة', 'Enregistrer le voyage')}</button></section>}

      <section className="space-y-3">
        {loading ? <CenteredLoading text={l('Loading trips…', 'جارٍ تحميل الرحلات…', 'Chargement des voyages…')} />
          : trips.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><CalendarDays className="mx-auto mb-3 h-8 w-8 text-blue-500" /><p className="font-bold text-slate-700">{l('No trips yet.', 'لا توجد رحلات بعد.', 'Aucun voyage pour le moment.')}</p></div>
            : <div className="grid gap-3 md:grid-cols-2">{trips.map((trip) => {
              const budget = budgetByTripId[trip.id];
              const spent = budget?.spentTotal ?? trip.spentTotal ?? 0;
              const expanded = expandedTripId === trip.id;
              return <article key={trip.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><button type="button" onClick={() => toggleTrip(trip.id)} className="min-w-0 flex-1 text-start"><strong className="block truncate text-slate-900">{trip.name}</strong><span className="mt-1 block truncate text-xs text-slate-500">{trip.destinationName || l('Destination', 'وجهة', 'Destination')} · {formatDate(trip.startDate, language)} – {formatDate(trip.endDate, language)}</span></button><div className="flex"><button type="button" onClick={() => toggleTrip(trip.id)} className="rounded-xl p-2 text-slate-400"><ChevronDown className={`h-4 w-4 ${expanded ? 'rotate-180' : ''}`} /></button><button type="button" onClick={() => void removeTrip(trip)} className="rounded-xl p-2 text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div></div><div className="mt-3 flex items-center justify-between"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{statusLabel(trip.status)}</span><select value={trip.status} onChange={(event) => void changeStatus(trip, event.target.value as Trip['status'])} className="rounded-xl border border-slate-200 px-2 py-1 text-xs"><option value="planning">{statusLabel('planning')}</option><option value="active">{statusLabel('active')}</option><option value="completed">{statusLabel('completed')}</option><option value="cancelled">{statusLabel('cancelled')}</option></select></div><div className="mt-3 text-xs text-slate-500">{l('Spent', 'المصروف', 'Dépensé')}: <strong>{spent.toFixed(2)} / {trip.budget.toFixed(2)} {trip.currency}</strong></div>
                {expanded && <div className="mt-4 border-t border-slate-100 pt-4">{budgetLoadingId === trip.id ? <CenteredLoading text={l('Loading expenses…', 'جارٍ تحميل المصروفات…', 'Chargement des dépenses…')} compact /> : budgetErrorByTripId[trip.id] ? <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{budgetErrorByTripId[trip.id]} <button type="button" onClick={() => void loadExpenses(trip.id)} className="font-bold underline">{l('Retry', 'إعادة', 'Réessayer')}</button></div> : budget ? <div className="space-y-3"><div className="flex items-center justify-between"><strong className="text-sm text-slate-900">{l('Expenses', 'المصروفات', 'Dépenses')}</strong><button type="button" onClick={() => { setExpenseModalTripId(trip.id); setExpenseError(''); setExpenseForm({ category: 'food', amount: '', description: '', expenseDate: dateFromToday(0) }); }} className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5" />{l('Add expense', 'إضافة مصروف', 'Ajouter')}</button></div>{budget.expenses.length === 0 ? <p className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-500">{l('No expenses yet.', 'لا توجد مصروفات بعد.', 'Aucune dépense.')}</p> : budget.expenses.map((expense) => <div key={expense.id} className="flex items-center gap-2 rounded-xl border border-slate-100 p-2"><div className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-800">{expense.description || expense.category}</strong><span className="text-[11px] text-slate-500">{expense.amount.toFixed(2)} {expense.currency}</span></div><button type="button" disabled={deletingExpenseId === expense.id} onClick={() => void removeExpense(trip.id, expense.id)} className="p-2 text-slate-400 hover:text-rose-600">{deletingExpenseId === expense.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></div>)}</div> : null}</div>}
              </article>;
            })}</div>}
      </section>

      {expenseModalTripId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true"><form onSubmit={submitExpense} className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="font-black text-slate-900">{l('Add expense', 'إضافة مصروف', 'Ajouter une dépense')}</h2><button type="button" onClick={() => setExpenseModalTripId(null)} className="p-2 text-slate-400"><X className="h-5 w-5" /></button></div><div className="space-y-3"><label className="block text-sm font-bold text-slate-700">{l('Category', 'الفئة', 'Catégorie')}<select value={expenseForm.category} onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value as TripExpenseCategory }))} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal">{expenseCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="block text-sm font-bold text-slate-700">{l('Amount', 'المبلغ', 'Montant')}<input aria-label={l('Amount', 'المبلغ', 'Montant')} required type="number" min="0.01" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal" /></label><label className="block text-sm font-bold text-slate-700">{l('Description', 'الوصف', 'Description')}<input aria-label={l('Description', 'الوصف', 'Description')} value={expenseForm.description} onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal" /></label><label className="block text-sm font-bold text-slate-700">{l('Date', 'التاريخ', 'Date')}<input required type="date" value={expenseForm.expenseDate} onChange={(event) => setExpenseForm((current) => ({ ...current, expenseDate: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal" /></label></div>{expenseError && <div className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{expenseError}</div>}<button type="submit" disabled={expenseSaving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{expenseSaving && <Loader2 className="h-4 w-4 animate-spin" />}{l('Save expense', 'حفظ المصروف', 'Enregistrer')}</button></form></div>}
    </div>
  );
};

const CenteredLoading: React.FC<{ text: string; compact?: boolean }> = ({ text, compact = false }) => (
  <div className={`flex items-center justify-center gap-2 text-sm text-slate-500 ${compact ? 'py-5' : 'rounded-2xl bg-white p-8'}`}><Loader2 className="h-4 w-4 animate-spin text-blue-600" />{text}</div>
);

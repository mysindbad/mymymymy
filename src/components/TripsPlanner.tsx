import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BedDouble,
  Bus,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Loader2,
  MapPin,
  Plus,
  Receipt,
  RefreshCw,
  Sparkles,
  Trash2,
  Utensils,
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

interface TripsPlannerProps {
  language?: SupportedLanguage;
  authStatus?: AuthStatus;
  onOpenAuth?: () => void;
}

const preferences = [
  { value: 'nature', ar: 'طبيعة', en: 'Nature' },
  { value: 'culture', ar: 'ثقافة', en: 'Culture' },
  { value: 'food', ar: 'طعام', en: 'Food' },
  { value: 'relaxation', ar: 'استرخاء', en: 'Relaxation' },
  { value: 'shopping', ar: 'تسوق', en: 'Shopping' },
];

const categoryIcon: Record<string, React.ReactNode> = {
  food: <Utensils className="h-4 w-4" />,
  sight: <Landmark className="h-4 w-4" />,
  activity: <Activity className="h-4 w-4" />,
  transport: <Bus className="h-4 w-4" />,
  accommodation: <BedDouble className="h-4 w-4" />,
};

const expenseCategoryMeta: Record<TripExpenseCategory, { ar: string; en: string; icon: React.ReactNode }> = {
  accommodation: { ar: 'إقامة', en: 'Accommodation', icon: <BedDouble className="h-4 w-4" /> },
  food: { ar: 'طعام', en: 'Food', icon: <Utensils className="h-4 w-4" /> },
  transport: { ar: 'تنقل', en: 'Transport', icon: <Bus className="h-4 w-4" /> },
  activity: { ar: 'نشاط', en: 'Activity', icon: <Activity className="h-4 w-4" /> },
  souvenir: { ar: 'تذكار', en: 'Souvenir', icon: <Receipt className="h-4 w-4" /> },
  other: { ar: 'أخرى', en: 'Other', icon: <Wallet className="h-4 w-4" /> },
};

const expenseCategories = Object.keys(expenseCategoryMeta) as TripExpenseCategory[];

function dateFromToday(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string, language: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-MA' : language, { dateStyle: 'medium' }).format(new Date(value + 'T00:00:00'));
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export const TripsPlanner: React.FC<TripsPlannerProps> = ({
  language = 'en',
  authStatus = 'restoring',
  onOpenAuth,
}) => {
  const isAr = language === 'ar';
  const [trips, setTrips] = useState<Trip[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [placesLoaded, setPlacesLoaded] = useState(false);
  const [placesError, setPlacesError] = useState('');
  const [planning, setPlanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isAuthLoadError, setIsAuthLoadError] = useState(false);
  const [planError, setPlanError] = useState('');
  const [itinerary, setItinerary] = useState<TripItinerary | null>(null);
  const [overBudget, setOverBudget] = useState(false);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [budgetByTripId, setBudgetByTripId] = useState<Record<string, TripBudget>>({});
  const [budgetLoadingId, setBudgetLoadingId] = useState<string | null>(null);
  const [budgetErrorByTripId, setBudgetErrorByTripId] = useState<Record<string, string>>({});
  const [expenseModalTripId, setExpenseModalTripId] = useState<string | null>(null);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [expenseError, setExpenseError] = useState('');
  const [expenseForm, setExpenseForm] = useState({
    category: 'food' as TripExpenseCategory,
    amount: '',
    description: '',
    expenseDate: dateFromToday(0),
  });
  const [form, setForm] = useState({
    destinationId: '',
    startDate: dateFromToday(0),
    endDate: dateFromToday(1),
    budget: '1500',
    currency: 'MAD',
    participants: 1,
    preferences: [] as string[],
  });

  const selectedPlace = places.find((place) => place.id === form.destinationId);
  const visiblePlaces = useMemo(() => {
    const query = search.trim().toLowerCase();
    return places
      .filter((place) => !query || [place.name, place.arabicName, place.area, place.region].filter(Boolean).join(' ').toLowerCase().includes(query))
      .slice(0, 24);
  }, [places, search]);

  const loadData = async () => {
    setLoading(true);
    setPlacesLoading(true);
    setPlacesLoaded(false);
    setError('');
    setPlacesError('');
    setIsAuthLoadError(false);

    const [tripsResult, placesResult] = await Promise.allSettled([fetchTrips(), fetchPlaces()]);

    if (tripsResult.status === 'fulfilled') {
      setTrips(tripsResult.value);
    } else {
      const authFailure = tripsResult.reason instanceof ApiAuthenticationError;
      setIsAuthLoadError(authFailure);
      setError(authFailure
        ? (isAr ? 'تعذر التحقق من جلسة الدخول. حاول مرة أخرى أو سجّل الدخول مجدداً.' : 'We could not verify your session. Retry or sign in again.')
        : messageFrom(tripsResult.reason, isAr ? 'تعذر تحميل الرحلات.' : 'Unable to load trips.'));
    }

    if (placesResult.status === 'fulfilled') {
      setPlaces(placesResult.value);
      setPlacesLoaded(true);
    } else {
      setPlaces([]);
      setPlacesError(placesResult.reason instanceof Error
        ? placesResult.reason.message
        : (isAr ? 'تعذر تحميل الوجهات.' : 'Unable to load destinations.'));
    }

    setLoading(false);
    setPlacesLoading(false);
  };

  useEffect(() => {
    if (authStatus === 'authed') {
      void loadData();
    } else if (authStatus === 'anonymous') {
      setLoading(false);
      setTrips([]);
    }
  }, [authStatus]);

  const updateForm = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));
  const togglePreference = (value: string) => updateForm({
    preferences: form.preferences.includes(value)
      ? form.preferences.filter((item) => item !== value)
      : form.preferences.concat(value),
  });

  const nextStep = () => {
    if (step === 1 && !form.destinationId) return setPlanError(isAr ? 'اختر وجهة أولاً.' : 'Choose a destination first.');
    if (step === 2 && (!form.startDate || !form.endDate || form.endDate < form.startDate)) return setPlanError(isAr ? 'تحقق من تواريخ الرحلة.' : 'Check the trip dates.');
    if (step === 3 && (!Number.isFinite(Number(form.budget)) || Number(form.budget) <= 0)) return setPlanError(isAr ? 'أدخل ميزانية صحيحة.' : 'Enter a valid budget.');
    setPlanError('');
    setStep((current) => Math.min(5, current + 1));
  };

  const runPlan = async () => {
    if (!form.destinationId) return setPlanError(isAr ? 'اختر وجهة أولاً.' : 'Choose a destination first.');
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
      setPlanError(messageFrom(planFailure, isAr ? 'تعذر التخطيط بالذكاء الاصطناعي. حاول مرة أخرى.' : 'AI planning failed. Try again.'));
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
        name: isAr ? 'رحلة إلى ' + (selectedPlace.arabicName || selectedPlace.name) : 'Trip to ' + selectedPlace.name,
        destinationId: selectedPlace.id,
        startDate: form.startDate,
        endDate: form.endDate,
        budget: Number(form.budget),
        currency: form.currency,
        participantsCount: form.participants,
        preferences: form.preferences,
        aiItinerary: itinerary,
      });
      setTrips((current) => [trip].concat(current));
      setItinerary(null);
      setOverBudget(false);
      setStep(1);
    } catch (saveFailure) {
      setPlanError(messageFrom(saveFailure, isAr ? 'تعذر حفظ الرحلة.' : 'Unable to save the trip.'));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (trip: Trip, status: Trip['status']) => {
    try {
      const updated = await updateTrip(trip.id, { status });
      setTrips((current) => current.map((item) => item.id === trip.id ? { ...updated, spentTotal: item.spentTotal } : item));
    } catch (statusError) {
      setError(messageFrom(statusError, isAr ? 'تعذر تحديث حالة الرحلة.' : 'Unable to update trip status.'));
    }
  };

  const removeTrip = async (trip: Trip) => {
    if (!window.confirm(isAr ? 'هل تريد حذف «' + trip.name + '»؟' : 'Delete “' + trip.name + '”?')) return;
    try {
      await deleteTrip(trip.id);
      setTrips((current) => current.filter((item) => item.id !== trip.id));
      setBudgetByTripId((current) => {
        const next = { ...current };
        delete next[trip.id];
        return next;
      });
      if (expandedTripId === trip.id) setExpandedTripId(null);
    } catch (deleteError) {
      setError(messageFrom(deleteError, isAr ? 'تعذر حذف الرحلة.' : 'Unable to delete the trip.'));
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
      const budget = await fetchTripExpenses(tripId);
      applyBudget(tripId, budget);
    } catch (loadError) {
      setBudgetErrorByTripId((current) => ({
        ...current,
        [tripId]: messageFrom(loadError, isAr ? 'تعذر تحميل المصروفات.' : 'Unable to load expenses.'),
      }));
    } finally {
      setBudgetLoadingId((current) => current === tripId ? null : current);
    }
  };

  const toggleTrip = (tripId: string) => {
    if (expandedTripId === tripId) {
      setExpandedTripId(null);
      return;
    }
    setExpandedTripId(tripId);
    if (!budgetByTripId[tripId]) void loadExpenses(tripId);
  };

  const openExpenseModal = (tripId: string) => {
    setExpenseModalTripId(tripId);
    setExpenseError('');
    setExpenseForm({ category: 'food', amount: '', description: '', expenseDate: dateFromToday(0) });
  };

  const closeExpenseModal = () => {
    if (!expenseSaving) setExpenseModalTripId(null);
  };

  const submitExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!expenseModalTripId) return;
    const amount = Number(expenseForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setExpenseError(isAr ? 'أدخل مبلغًا أكبر من صفر.' : 'Enter an amount greater than zero.');
      return;
    }
    const budget = budgetByTripId[expenseModalTripId];
    if (!budget) return;
    if (budget.spentTotal + amount > budget.budget
      && !window.confirm(isAr ? 'سيتم تجاوز الميزانية — متابعة؟' : 'This will exceed the budget — continue?')) return;

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
      setExpenseError(messageFrom(saveError, isAr ? 'تعذر حفظ المصروف.' : 'Unable to save expense.'));
    } finally {
      setExpenseSaving(false);
    }
  };

  const removeExpense = async (tripId: string, expenseId: string) => {
    if (!window.confirm(isAr ? 'هل تريد حذف هذا المصروف؟' : 'Delete this expense?')) return;
    setDeletingExpenseId(expenseId);
    setBudgetErrorByTripId((current) => ({ ...current, [tripId]: '' }));
    try {
      const updated = await deleteTripExpense(tripId, expenseId);
      applyBudget(tripId, updated);
    } catch (deleteError) {
      setBudgetErrorByTripId((current) => ({
        ...current,
        [tripId]: messageFrom(deleteError, isAr ? 'تعذر حذف المصروف.' : 'Unable to delete expense.'),
      }));
    } finally {
      setDeletingExpenseId(null);
    }
  };

  const labels = isAr
    ? {
      title: 'مخطط الرحلات الذكي',
      subtitle: 'أنشئ خطة واقعية لرحلتك في المغرب',
      create: 'إنشاء رحلة',
      empty: 'لا توجد رحلات بعد — أنشئ أول رحلة',
      next: 'التالي',
      back: 'السابق',
      plan: 'خطط بالذكاء الاصطناعي',
      save: 'حفظ الرحلة',
      retry: 'إعادة المحاولة',
      loading: 'جارٍ التحميل…',
      search: 'ابحث عن وجهة',
      destination: 'الوجهة',
      budget: 'الميزانية',
      participants: 'المشاركون',
      preferences: 'التفضيلات',
      start: 'تاريخ البداية',
      end: 'تاريخ النهاية',
      currency: 'العملة',
      people: 'أشخاص',
      planning: 'قيد التخطيط',
      active: 'نشطة',
      completed: 'مكتملة',
      cancelled: 'ملغاة',
      total: 'الإجمالي',
      warning: 'تتجاوز هذه الخطة الميزانية المحددة.',
      spent: 'المصروف',
      remaining: 'المتبقي',
      budgetPanel: 'ميزانية الرحلة',
      addExpense: 'إضافة مصروف',
      expenses: 'المصروفات',
      noExpenses: 'لم تسجل أي مصروفات بعد.',
      expenseDate: 'التاريخ',
      description: 'الوصف',
      amount: 'المبلغ',
      category: 'الفئة',
      cancel: 'إلغاء',
      saveExpense: 'حفظ المصروف',
      newExpense: 'مصروف جديد',
      overBudget: 'تجاوزت الميزانية بـ',
      showBudget: 'عرض الميزانية',
      hideBudget: 'إخفاء الميزانية',
      loginAgain: 'تسجيل الدخول مجدداً',
      placesError: 'تعذر تحميل الوجهات.',
      noPlaceMatch: 'لا توجد وجهة مطابقة — الأماكن المتاحة حالياً في شمال المغرب',
    }
    : {
      title: 'AI Trip Planner',
      subtitle: 'Build a realistic Morocco trip plan',
      create: 'Create a trip',
      empty: 'No trips yet — create your first trip',
      next: 'Next',
      back: 'Back',
      plan: 'Plan with AI',
      save: 'Save trip',
      retry: 'Retry',
      loading: 'Loading…',
      search: 'Search destinations',
      destination: 'Destination',
      budget: 'Budget',
      participants: 'Participants',
      preferences: 'Preferences',
      start: 'Start date',
      end: 'End date',
      currency: 'Currency',
      people: 'people',
      planning: 'Planning',
      active: 'Active',
      completed: 'Completed',
      cancelled: 'Cancelled',
      total: 'Total',
      warning: 'This plan exceeds the selected budget.',
      spent: 'Spent',
      remaining: 'Remaining',
      budgetPanel: 'Trip budget',
      addExpense: 'Add expense',
      expenses: 'Expenses',
      noExpenses: 'No expenses recorded yet.',
      expenseDate: 'Date',
      description: 'Description',
      amount: 'Amount',
      category: 'Category',
      cancel: 'Cancel',
      saveExpense: 'Save expense',
      newExpense: 'New expense',
      overBudget: 'Over budget by',
      showBudget: 'Show budget',
      hideBudget: 'Hide budget',
      loginAgain: 'Sign in again',
      placesError: 'Unable to load destinations.',
      noPlaceMatch: 'No matching destination — places currently available in Northern Morocco',
    };
  const statusLabel = (status: Trip['status']) => labels[status];

  if (authStatus === 'restoring') {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 p-8 pb-24 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
        {labels.loading}
      </div>
    );
  }

  if (authStatus === 'anonymous') {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center p-6 pb-24">
        <button
          type="button"
          onClick={onOpenAuth}
          className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
        >
          {isAr ? 'سجّل الدخول لعرض رحلاتك' : 'Sign in to view your trips'}
        </button>
      </div>
    );
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-5xl space-y-6 p-4 pb-24 sm:p-6">
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900 p-6 text-white shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-300"><Sparkles className="h-4 w-4" /> {labels.title}</div>
            <h1 className="text-2xl font-black sm:text-3xl">{labels.subtitle}</h1>
          </div>
          <button onClick={() => { setItinerary(null); setStep(1); }} className="flex shrink-0 items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 text-sm font-bold hover:bg-white/25"><Plus className="h-4 w-4" /> {labels.create}</button>
        </div>
      </section>

      {error && <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><span>{error}</span><div className="flex items-center gap-3"><button onClick={() => void loadData()} className="flex items-center gap-1 font-bold text-indigo-700"><RefreshCw className="h-4 w-4" /> {labels.retry}</button>{isAuthLoadError && onOpenAuth && <button onClick={onOpenAuth} className="font-bold text-slate-600 underline underline-offset-2">{labels.loginAgain}</button>}</div></div>}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div><h2 className="text-lg font-black text-slate-900">{labels.create}</h2><p className="text-xs text-slate-500">{step}/5</p></div>
          <div className="flex gap-1">{[1, 2, 3, 4, 5].map((item) => <span key={item} className={'h-2 w-8 rounded-full ' + (item <= step ? 'bg-indigo-600' : 'bg-slate-200')} />)}</div>
        </div>
        {step === 1 && <div className="space-y-4"><label className="block text-sm font-bold text-slate-700">{labels.destination}</label><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500" />{placesLoading ? <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {labels.loading}</div> : placesError ? <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><span>{labels.placesError}</span><button onClick={() => void loadData()} className="flex items-center gap-1 font-bold"><RefreshCw className="h-4 w-4" /> {labels.retry}</button></div> : placesLoaded && visiblePlaces.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-600">{labels.noPlaceMatch}</div> : <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">{visiblePlaces.map((place) => <button key={place.id} onClick={() => updateForm({ destinationId: place.id })} className={'flex items-center gap-3 rounded-2xl border p-3 text-start transition ' + (form.destinationId === place.id ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-300')}><MapPin className="h-5 w-5 shrink-0 text-indigo-600" /><span className="min-w-0"><strong className="block truncate text-sm text-slate-900">{isAr && place.arabicName ? place.arabicName : place.name}</strong><small className="block truncate text-slate-500">{place.area} · {place.region}</small></span>{form.destinationId === place.id && <Check className="ms-auto h-4 w-4 text-indigo-600" />}</button>)}</div>}</div>}
        {step === 2 && <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">{labels.start}<input type="date" value={form.startDate} onChange={(event) => updateForm({ startDate: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-indigo-500" /></label><label className="text-sm font-bold text-slate-700">{labels.end}<input type="date" value={form.endDate} min={form.startDate} onChange={(event) => updateForm({ endDate: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-indigo-500" /></label></div>}
        {step === 3 && <div className="grid gap-4 sm:grid-cols-[1fr_160px]"><label className="text-sm font-bold text-slate-700">{labels.budget}<div className="relative mt-2"><Wallet className="absolute start-4 top-3.5 h-4 w-4 text-slate-400" /><input type="number" min="1" value={form.budget} onChange={(event) => updateForm({ budget: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-10 py-3 font-normal outline-none focus:border-indigo-500" /></div></label><label className="text-sm font-bold text-slate-700">{labels.currency}<select value={form.currency} onChange={(event) => updateForm({ currency: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-indigo-500"><option>MAD</option><option>EUR</option><option>USD</option></select></label></div>}
        {step === 4 && <div className="max-w-sm"><label className="text-sm font-bold text-slate-700">{labels.participants}<div className="mt-3 flex items-center gap-4 rounded-2xl border border-slate-200 p-4"><Users className="h-5 w-5 text-indigo-600" /><input type="number" min="1" max="50" value={form.participants} onChange={(event) => updateForm({ participants: Math.max(1, Number(event.target.value)) })} className="w-full text-xl font-black outline-none" /><span className="text-sm text-slate-500">{labels.people}</span></div></label></div>}
        {step === 5 && <div><p className="mb-3 text-sm font-bold text-slate-700">{labels.preferences}</p><div className="grid gap-2 sm:grid-cols-2">{preferences.map((preference) => <label key={preference.value} className={'flex cursor-pointer items-center gap-3 rounded-2xl border p-3 ' + (form.preferences.includes(preference.value) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200')}><input type="checkbox" checked={form.preferences.includes(preference.value)} onChange={() => togglePreference(preference.value)} className="h-4 w-4 accent-indigo-600" /><span className="text-sm font-bold text-slate-700">{isAr ? preference.ar : preference.en}</span></label>)}</div></div>}
        {planError && <div className="mt-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertTriangle className="h-4 w-4 shrink-0" /> {planError}</div>}
        <div className="mt-6 flex items-center justify-between gap-3"><button disabled={step === 1} onClick={() => { setPlanError(''); setStep((current) => Math.max(1, current - 1)); }} className="flex items-center gap-1 rounded-2xl px-4 py-2 text-sm font-bold text-slate-600 disabled:invisible hover:bg-slate-100"><ChevronLeft className="h-4 w-4 rtl:rotate-180" /> {labels.back}</button>{step < 5 ? <button onClick={nextStep} className="flex items-center gap-1 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">{labels.next}<ChevronRight className="h-4 w-4 rtl:rotate-180" /></button> : <button onClick={() => void runPlan()} disabled={planning} className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">{planning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{planning ? labels.loading : labels.plan}</button>}</div>
      </section>

      {itinerary && <section className="space-y-4 rounded-3xl border border-indigo-100 bg-indigo-50/40 p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-slate-900">{selectedPlace && selectedPlace.name}</h2><p className="text-sm text-slate-500">{formatDate(form.startDate, language)} – {formatDate(form.endDate, language)}</p></div><div className="text-end"><p className="text-xs font-bold uppercase text-slate-500">{labels.total}</p><p className="text-2xl font-black text-indigo-700">{itinerary.totalEstimatedCost.toFixed(2)} {form.currency}</p><div className="mt-2 h-2 w-40 overflow-hidden rounded-full bg-slate-200"><div className={'h-full ' + (overBudget ? 'bg-rose-500' : 'bg-emerald-500')} style={{ width: Math.min(100, itinerary.totalEstimatedCost / Number(form.budget) * 100) + '%' }} /></div></div></div>{overBudget && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">{labels.warning}</div>}<div className="grid gap-3 md:grid-cols-2">{itinerary.days.map((day) => <article key={day.day} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-black text-slate-900">Day {day.day} · {day.title}</h3><span className="text-xs font-bold text-indigo-600">{day.dailyCost.toFixed(2)} {form.currency}</span></div><div className="space-y-2">{day.items.map((item, index) => <div key={String(day.day) + '-' + String(index)} className="flex gap-3 rounded-xl bg-slate-50 p-3"><span className="mt-0.5 text-indigo-600">{categoryIcon[item.category]}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><strong className="text-sm text-slate-800">{item.activity}</strong><span className="shrink-0 text-xs font-mono text-slate-500">{item.time}</span></div><p className="mt-1 text-xs text-slate-500">{item.note}</p><p className="mt-1 text-xs font-bold text-emerald-700">{item.estimatedCost.toFixed(2)} {form.currency}</p></div></div>)}</div></article>)}</div>{itinerary.tips.length > 0 && <div className="rounded-2xl bg-white p-4"><h3 className="mb-2 font-black text-slate-900">{isAr ? 'نصائح' : 'Tips'}</h3><ul className="list-disc space-y-1 ps-5 text-sm text-slate-600">{itinerary.tips.map((tip, index) => <li key={index}>{tip}</li>)}</ul></div>}<button onClick={() => void saveTrip()} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{labels.save}</button></section>}

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-lg font-black text-slate-900">{isAr ? 'رحلاتي' : 'My trips'}</h2><span className="text-sm text-slate-500">{trips.length}</span></div>
        {loading ? <div className="flex items-center gap-2 rounded-2xl bg-white p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {labels.loading}</div>
          : trips.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><CalendarDays className="mx-auto mb-3 h-8 w-8 text-indigo-500" /><p className="font-bold text-slate-700">{labels.empty}</p><button onClick={() => { setItinerary(null); setStep(1); }} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> {labels.create}</button></div>
            : <div className="grid gap-3 md:grid-cols-2">{trips.map((trip) => {
              const budget = budgetByTripId[trip.id];
              const spent = budget?.spentTotal ?? trip.spentTotal ?? 0;
              const budgetPercentage = trip.budget > 0 ? spent / trip.budget * 100 : 0;
              const budgetBar = budgetPercentage >= 100 ? 'bg-rose-500' : budgetPercentage >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
              const isExpanded = expandedTripId === trip.id;
              return <article key={trip.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => toggleTrip(trip.id)} className="flex min-w-0 flex-1 items-start gap-3 text-start">
                    <span className="mt-0.5 rounded-xl bg-indigo-50 p-2 text-indigo-600"><Wallet className="h-4 w-4" /></span>
                    <span className="min-w-0"><strong className="block truncate text-slate-900">{trip.name}</strong><span className="mt-1 block truncate text-xs text-slate-500">{trip.destinationName || (isAr ? 'وجهة' : 'Destination')} · {formatDate(trip.startDate, language)} – {formatDate(trip.endDate, language)}</span></span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1"><button onClick={() => toggleTrip(trip.id)} className="rounded-xl p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600" title={isExpanded ? labels.hideBudget : labels.showBudget} aria-expanded={isExpanded}><ChevronDown className={'h-4 w-4 transition-transform ' + (isExpanded ? 'rotate-180' : '')} /></button><button onClick={() => void removeTrip(trip)} className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title={isAr ? 'حذف' : 'Delete'}><Trash2 className="h-4 w-4" /></button></div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3"><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{statusLabel(trip.status)}</span><select value={trip.status} onChange={(event) => void changeStatus(trip, event.target.value as Trip['status'])} className="rounded-xl border border-slate-200 px-2 py-1 text-xs"><option value="planning">{labels.planning}</option><option value="active">{labels.active}</option><option value="completed">{labels.completed}</option><option value="cancelled">{labels.cancelled}</option></select></div>
                <div className="mt-4"><div className="mb-1 flex justify-between text-xs font-bold text-slate-500"><span>{labels.budget}</span><span>{spent.toFixed(2)} / {trip.budget.toFixed(2)} {trip.currency}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={'h-full transition-all ' + budgetBar} style={{ width: Math.min(100, budgetPercentage) + '%' }} /></div></div>
                {isExpanded && <div className="mt-5 border-t border-slate-100 pt-4">
                  {budgetLoadingId === trip.id ? <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {labels.loading}</div>
                    : budgetErrorByTripId[trip.id] ? <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><span>{budgetErrorByTripId[trip.id]}</span><button onClick={() => void loadExpenses(trip.id)} className="flex shrink-0 items-center gap-1 font-bold"><RefreshCw className="h-4 w-4" /> {labels.retry}</button></div>
                      : budget && <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3"><h4 className="font-black text-slate-900">{labels.budgetPanel}</h4><button onClick={() => openExpenseModal(trip.id)} className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"><Plus className="h-3.5 w-3.5" /> {labels.addExpense}</button></div>
                        <div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-2xl bg-slate-50 p-3"><span className="block text-xs text-slate-500">{labels.spent}</span><strong className="mt-1 block text-slate-900">{budget.spentTotal.toFixed(2)} {budget.currency}</strong></div><div className={'rounded-2xl p-3 ' + (budget.overBudget ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700')}><span className="block text-xs">{labels.remaining}</span><strong className="mt-1 block">{Math.abs(budget.remaining).toFixed(2)} {budget.currency}</strong></div></div>
                        {budget.overBudget && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{labels.overBudget} {Math.abs(budget.remaining).toFixed(2)} {budget.currency}</div>}
                        <div><h5 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{labels.category}</h5><div className="grid grid-cols-2 gap-2">{expenseCategories.map((category) => { const total = budget.expenses.filter((expense) => expense.category === category).reduce((sum, expense) => sum + expense.amount, 0); if (!total) return null; const meta = expenseCategoryMeta[category]; return <div key={category} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-2 text-xs"><span className="flex items-center gap-1.5 text-slate-600">{meta.icon}{isAr ? meta.ar : meta.en}</span><strong className="text-slate-900">{total.toFixed(2)}</strong></div>; })}</div></div>
                        <div><h5 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{labels.expenses}</h5>{budget.expenses.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">{labels.noExpenses}</div> : <div className="space-y-2">{budget.expenses.map((expense) => { const meta = expenseCategoryMeta[expense.category]; return <div key={expense.id} className="flex items-center gap-2 rounded-2xl border border-slate-100 p-3"><span className="rounded-xl bg-slate-50 p-2 text-indigo-600">{meta.icon}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><strong className="truncate text-sm text-slate-800">{expense.description || (isAr ? meta.ar : meta.en)}</strong><span className="shrink-0 text-sm font-black text-slate-900">{expense.amount.toFixed(2)} {expense.currency}</span></div><p className="mt-1 text-xs text-slate-500">{formatDate(expense.expenseDate, language)} · {isAr ? meta.ar : meta.en}</p></div><button disabled={deletingExpenseId === expense.id} onClick={() => void removeExpense(trip.id, expense.id)} className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50" title={isAr ? 'حذف المصروف' : 'Delete expense'}>{deletingExpenseId === expense.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></div>; })}</div>}</div>
                      </div>}
                </div>}
              </article>;
            })}</div>}
      </section>

      {expenseModalTripId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title" onMouseDown={(event) => { if (event.target === event.currentTarget) closeExpenseModal(); }}>
        <form onSubmit={submitExpense} className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
          <div className="mb-5 flex items-center justify-between gap-3"><h2 id="expense-modal-title" className="text-lg font-black text-slate-900">{labels.newExpense}</h2><button type="button" onClick={closeExpenseModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" title={labels.cancel}><X className="h-5 w-5" /></button></div>
          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-700">{labels.category}<select value={expenseForm.category} onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value as TripExpenseCategory }))} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-indigo-500">{expenseCategories.map((category) => <option key={category} value={category}>{isAr ? expenseCategoryMeta[category].ar : expenseCategoryMeta[category].en}</option>)}</select></label>
            <label className="block text-sm font-bold text-slate-700">{labels.amount}<input required type="number" min="0.01" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-indigo-500" /></label>
            <label className="block text-sm font-bold text-slate-700">{labels.description}<input value={expenseForm.description} onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))} placeholder={isAr ? 'مثال: عشاء في المطعم' : 'e.g. Dinner at the restaurant'} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-indigo-500" /></label>
            <label className="block text-sm font-bold text-slate-700">{labels.expenseDate}<input required type="date" value={expenseForm.expenseDate} onChange={(event) => setExpenseForm((current) => ({ ...current, expenseDate: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-indigo-500" /></label>
          </div>
          {expenseError && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{expenseError}</div>}
          <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={closeExpenseModal} className="rounded-2xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">{labels.cancel}</button><button type="submit" disabled={expenseSaving} className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">{expenseSaving && <Loader2 className="h-4 w-4 animate-spin" />}{labels.saveExpense}</button></div>
        </form>
      </div>}
    </div>
  );
};
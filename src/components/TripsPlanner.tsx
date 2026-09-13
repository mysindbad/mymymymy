import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BedDouble, Bus, CalendarDays, Check, ChevronLeft, ChevronRight, Landmark, Loader2, MapPin, Plus, RefreshCw, Sparkles, Trash2, Utensils, Users, Wallet } from 'lucide-react';
import { ApiAuthenticationError, createTrip, deleteTrip, fetchPlaces, fetchTrips, planTrip, Trip, TripItinerary, updateTrip } from '../services/api';
import { Place } from '../types';
import { SupportedLanguage } from '../data/translations';

interface TripsPlannerProps {
  language?: SupportedLanguage;
  isSessionResolved?: boolean;
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

export const TripsPlanner: React.FC<TripsPlannerProps> = ({ language = 'en', isSessionResolved = true }) => {
  const isAr = language === 'ar';
  const [trips, setTrips] = useState<Trip[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [planError, setPlanError] = useState('');
  const [itinerary, setItinerary] = useState<TripItinerary | null>(null);
  const [overBudget, setOverBudget] = useState(false);
  const [form, setForm] = useState({ destinationId: '', startDate: dateFromToday(0), endDate: dateFromToday(1), budget: '1500', currency: 'MAD', participants: 1, preferences: [] as string[] });

  const selectedPlace = places.find((place) => place.id === form.destinationId);
  const visiblePlaces = useMemo(() => {
    const query = search.trim().toLowerCase();
    return places.filter((place) => !query || [place.name, place.arabicName, place.area, place.region].filter(Boolean).join(' ').toLowerCase().includes(query)).slice(0, 24);
  }, [places, search]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [loadedTrips, loadedPlaces] = await Promise.all([fetchTrips(), fetchPlaces()]);
      setTrips(loadedTrips);
      setPlaces(loadedPlaces);
    } catch (loadError) {
      setError(loadError instanceof ApiAuthenticationError
        ? (isAr ? 'سجّل الدخول أولًا لإضافة رحلتك والاحتفاظ بها بأمان.' : 'Sign in first to add and securely save your trip.')
        : messageFrom(loadError, isAr ? 'تعذر تحميل الرحلات.' : 'Unable to load trips.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSessionResolved) void loadData();
  }, [isSessionResolved]);
  const updateForm = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));
  const togglePreference = (value: string) => updateForm({ preferences: form.preferences.includes(value) ? form.preferences.filter((item) => item !== value) : form.preferences.concat(value) });

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
      const result = await planTrip({ destinationId: form.destinationId, startDate: form.startDate, endDate: form.endDate, budget: Number(form.budget), currency: form.currency, participants: form.participants, preferences: form.preferences });
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
      const trip = await createTrip({ name: isAr ? 'رحلة إلى ' + (selectedPlace.arabicName || selectedPlace.name) : 'Trip to ' + selectedPlace.name, destinationId: selectedPlace.id, startDate: form.startDate, endDate: form.endDate, budget: Number(form.budget), currency: form.currency, participantsCount: form.participants, preferences: form.preferences, aiItinerary: itinerary });
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
      setTrips((current) => current.map((item) => item.id === trip.id ? updated : item));
    } catch (statusError) {
      setError(messageFrom(statusError, isAr ? 'تعذر تحديث حالة الرحلة.' : 'Unable to update trip status.'));
    }
  };

  const removeTrip = async (trip: Trip) => {
    if (!window.confirm(isAr ? 'هل تريد حذف «' + trip.name + '»؟' : 'Delete “' + trip.name + '”?')) return;
    try {
      await deleteTrip(trip.id);
      setTrips((current) => current.filter((item) => item.id !== trip.id));
    } catch (deleteError) {
      setError(messageFrom(deleteError, isAr ? 'تعذر حذف الرحلة.' : 'Unable to delete the trip.'));
    }
  };

  const labels = isAr ? { title: 'مخطط الرحلات الذكي', subtitle: 'أنشئ خطة واقعية لرحلتك في المغرب', create: 'إنشاء رحلة', empty: 'لا توجد رحلات بعد — أنشئ أول رحلة', next: 'التالي', back: 'السابق', plan: 'خطط بالذكاء الاصطناعي', save: 'حفظ الرحلة', retry: 'إعادة المحاولة', loading: 'جارٍ التحميل…', search: 'ابحث عن وجهة', destination: 'الوجهة', budget: 'الميزانية', participants: 'المشاركون', preferences: 'التفضيلات', start: 'تاريخ البداية', end: 'تاريخ النهاية', currency: 'العملة', people: 'أشخاص', planning: 'قيد التخطيط', active: 'نشطة', completed: 'مكتملة', cancelled: 'ملغاة', total: 'الإجمالي', warning: 'تتجاوز هذه الخطة الميزانية المحددة.' } : { title: 'AI Trip Planner', subtitle: 'Build a realistic Morocco trip plan', create: 'Create a trip', empty: 'No trips yet — create your first trip', next: 'Next', back: 'Back', plan: 'Plan with AI', save: 'Save trip', retry: 'Retry', loading: 'Loading…', search: 'Search destinations', destination: 'Destination', budget: 'Budget', participants: 'Participants', preferences: 'Preferences', start: 'Start date', end: 'End date', currency: 'Currency', people: 'people', planning: 'Planning', active: 'Active', completed: 'Completed', cancelled: 'Cancelled', total: 'Total', warning: 'This plan exceeds the selected budget.' };
  const statusLabel = (status: Trip['status']) => labels[status];

  return <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-5xl space-y-6 p-4 pb-24 sm:p-6">
    <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900 p-6 text-white shadow-xl"><div className="flex items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-300"><Sparkles className="h-4 w-4" /> {labels.title}</div><h1 className="text-2xl font-black sm:text-3xl">{labels.subtitle}</h1></div><button onClick={() => { setItinerary(null); setStep(1); }} className="flex shrink-0 items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 text-sm font-bold hover:bg-white/25"><Plus className="h-4 w-4" /> {labels.create}</button></div></section>
    {error && <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><span>{error}</span><button onClick={() => void loadData()} className="flex items-center gap-1 font-bold"><RefreshCw className="h-4 w-4" /> {labels.retry}</button></div>}
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-black text-slate-900">{labels.create}</h2><p className="text-xs text-slate-500">{step}/5</p></div><div className="flex gap-1">{[1, 2, 3, 4, 5].map((item) => <span key={item} className={'h-2 w-8 rounded-full ' + (item <= step ? 'bg-indigo-600' : 'bg-slate-200')} />)}</div></div>
      {step === 1 && <div className="space-y-4"><label className="block text-sm font-bold text-slate-700">{labels.destination}</label><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500" />{loading ? <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {labels.loading}</div> : <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">{visiblePlaces.map((place) => <button key={place.id} onClick={() => updateForm({ destinationId: place.id })} className={'flex items-center gap-3 rounded-2xl border p-3 text-start transition ' + (form.destinationId === place.id ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-300')}><MapPin className="h-5 w-5 shrink-0 text-indigo-600" /><span className="min-w-0"><strong className="block truncate text-sm text-slate-900">{isAr && place.arabicName ? place.arabicName : place.name}</strong><small className="block truncate text-slate-500">{place.area} · {place.region}</small></span>{form.destinationId === place.id && <Check className="ms-auto h-4 w-4 text-indigo-600" />}</button>)}</div>}</div>}
      {step === 2 && <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">{labels.start}<input type="date" value={form.startDate} onChange={(event) => updateForm({ startDate: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-indigo-500" /></label><label className="text-sm font-bold text-slate-700">{labels.end}<input type="date" value={form.endDate} min={form.startDate} onChange={(event) => updateForm({ endDate: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-indigo-500" /></label></div>}
      {step === 3 && <div className="grid gap-4 sm:grid-cols-[1fr_160px]"><label className="text-sm font-bold text-slate-700">{labels.budget}<div className="relative mt-2"><Wallet className="absolute start-4 top-3.5 h-4 w-4 text-slate-400" /><input type="number" min="1" value={form.budget} onChange={(event) => updateForm({ budget: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-10 py-3 font-normal outline-none focus:border-indigo-500" /></div></label><label className="text-sm font-bold text-slate-700">{labels.currency}<select value={form.currency} onChange={(event) => updateForm({ currency: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-indigo-500"><option>MAD</option><option>EUR</option><option>USD</option></select></label></div>}
      {step === 4 && <div className="max-w-sm"><label className="text-sm font-bold text-slate-700">{labels.participants}<div className="mt-3 flex items-center gap-4 rounded-2xl border border-slate-200 p-4"><Users className="h-5 w-5 text-indigo-600" /><input type="number" min="1" max="50" value={form.participants} onChange={(event) => updateForm({ participants: Math.max(1, Number(event.target.value)) })} className="w-full text-xl font-black outline-none" /><span className="text-sm text-slate-500">{labels.people}</span></div></label></div>}
      {step === 5 && <div><p className="mb-3 text-sm font-bold text-slate-700">{labels.preferences}</p><div className="grid gap-2 sm:grid-cols-2">{preferences.map((preference) => <label key={preference.value} className={'flex cursor-pointer items-center gap-3 rounded-2xl border p-3 ' + (form.preferences.includes(preference.value) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200')}><input type="checkbox" checked={form.preferences.includes(preference.value)} onChange={() => togglePreference(preference.value)} className="h-4 w-4 accent-indigo-600" /><span className="text-sm font-bold text-slate-700">{isAr ? preference.ar : preference.en}</span></label>)}</div></div>}
      {planError && <div className="mt-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertTriangle className="h-4 w-4 shrink-0" /> {planError}</div>}
      <div className="mt-6 flex items-center justify-between gap-3"><button disabled={step === 1} onClick={() => { setPlanError(''); setStep((current) => Math.max(1, current - 1)); }} className="flex items-center gap-1 rounded-2xl px-4 py-2 text-sm font-bold text-slate-600 disabled:invisible hover:bg-slate-100"><ChevronLeft className="h-4 w-4 rtl:rotate-180" /> {labels.back}</button>{step < 5 ? <button onClick={nextStep} className="flex items-center gap-1 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">{labels.next}<ChevronRight className="h-4 w-4 rtl:rotate-180" /></button> : <button onClick={() => void runPlan()} disabled={planning} className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">{planning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{planning ? labels.loading : labels.plan}</button>}</div>
    </section>
    {itinerary && <section className="space-y-4 rounded-3xl border border-indigo-100 bg-indigo-50/40 p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-slate-900">{selectedPlace && selectedPlace.name}</h2><p className="text-sm text-slate-500">{formatDate(form.startDate, language)} – {formatDate(form.endDate, language)}</p></div><div className="text-end"><p className="text-xs font-bold uppercase text-slate-500">{labels.total}</p><p className="text-2xl font-black text-indigo-700">{itinerary.totalEstimatedCost.toFixed(2)} {form.currency}</p><div className="mt-2 h-2 w-40 overflow-hidden rounded-full bg-slate-200"><div className={'h-full ' + (overBudget ? 'bg-rose-500' : 'bg-emerald-500')} style={{ width: Math.min(100, itinerary.totalEstimatedCost / Number(form.budget) * 100) + '%' }} /></div></div></div>{overBudget && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">{labels.warning}</div>}<div className="grid gap-3 md:grid-cols-2">{itinerary.days.map((day) => <article key={day.day} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-black text-slate-900">Day {day.day} · {day.title}</h3><span className="text-xs font-bold text-indigo-600">{day.dailyCost.toFixed(2)} {form.currency}</span></div><div className="space-y-2">{day.items.map((item, index) => <div key={String(day.day) + '-' + String(index)} className="flex gap-3 rounded-xl bg-slate-50 p-3"><span className="mt-0.5 text-indigo-600">{categoryIcon[item.category]}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><strong className="text-sm text-slate-800">{item.activity}</strong><span className="shrink-0 text-xs font-mono text-slate-500">{item.time}</span></div><p className="mt-1 text-xs text-slate-500">{item.note}</p><p className="mt-1 text-xs font-bold text-emerald-700">{item.estimatedCost.toFixed(2)} {form.currency}</p></div></div>)}</div></article>)}</div>{itinerary.tips.length > 0 && <div className="rounded-2xl bg-white p-4"><h3 className="mb-2 font-black text-slate-900">{isAr ? 'نصائح' : 'Tips'}</h3><ul className="list-disc space-y-1 ps-5 text-sm text-slate-600">{itinerary.tips.map((tip, index) => <li key={index}>{tip}</li>)}</ul></div>}<button onClick={() => void saveTrip()} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{labels.save}</button></section>}
    <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-black text-slate-900">{isAr ? 'رحلاتي' : 'My trips'}</h2><span className="text-sm text-slate-500">{trips.length}</span></div>{loading ? <div className="flex items-center gap-2 rounded-2xl bg-white p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {labels.loading}</div> : trips.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><CalendarDays className="mx-auto mb-3 h-8 w-8 text-indigo-500" /><p className="font-bold text-slate-700">{labels.empty}</p><button onClick={() => { setItinerary(null); setStep(1); }} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> {labels.create}</button></div> : <div className="grid gap-3 md:grid-cols-2">{trips.map((trip) => { const spent = trip.aiItinerary?.totalEstimatedCost || 0; return <article key={trip.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-900">{trip.name}</h3><p className="mt-1 text-xs text-slate-500">{trip.destinationName || (isAr ? 'وجهة' : 'Destination')} · {formatDate(trip.startDate, language)} – {formatDate(trip.endDate, language)}</p></div><button onClick={() => void removeTrip(trip)} className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title={isAr ? 'حذف' : 'Delete'}><Trash2 className="h-4 w-4" /></button></div><div className="mt-4 flex items-center justify-between gap-3"><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{statusLabel(trip.status)}</span><select value={trip.status} onChange={(event) => void changeStatus(trip, event.target.value as Trip['status'])} className="rounded-xl border border-slate-200 px-2 py-1 text-xs"><option value="planning">{labels.planning}</option><option value="active">{labels.active}</option><option value="completed">{labels.completed}</option><option value="cancelled">{labels.cancelled}</option></select></div><div className="mt-4"><div className="mb-1 flex justify-between text-xs font-bold text-slate-500"><span>{labels.budget}</span><span>{trip.budget.toFixed(2)} {trip.currency}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-indigo-500" style={{ width: Math.min(100, spent / trip.budget * 100) + '%' }} /></div></div></article>; })}</div>}</section>
  </div>;
};

import React, { useState } from 'react';
import { Plane, X } from 'lucide-react';
import { SupportedLanguage } from '../data/translations';

interface FlightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: SupportedLanguage;
}

function tomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export const FlightsModal: React.FC<FlightsModalProps> = ({ isOpen, onClose, language = 'en' }) => {
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const t = (en: string, ar: string, fr: string) => isAr ? ar : isFr ? fr : en;
  const [fromCity, setFromCity] = useState('Casablanca (CMN)');
  const [toCity, setToCity] = useState('Tangier / Tetouan (TNG)');
  const [flightDate, setFlightDate] = useState(tomorrowDate);
  const [showResults, setShowResults] = useState(false);

  if (!isOpen) return null;

  const handleReview = (event: React.FormEvent) => {
    event.preventDefault();
    setShowResults(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-gradient-to-r from-sky-500 to-blue-600 p-4 text-white sm:p-5">
          <div className="flex items-center gap-2.5"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20"><Plane className="h-5 w-5 -rotate-45" /></span><h3 className="text-base font-black">{t('Flights', 'الرحلات الجوية', 'Vols')}</h3></div>
          <button type="button" onClick={onClose} aria-label={t('Close', 'إغلاق', 'Fermer')} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20"><X className="h-4 w-4" /></button>
        </header>

        <form onSubmit={handleReview} className="space-y-4 p-5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[11px] font-bold text-slate-500">{t('From', 'من', 'De')}<input type="text" value={fromCity} onChange={(event) => setFromCity(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-800" /></label>
            <label className="block text-[11px] font-bold text-slate-500">{t('To', 'إلى', 'À')}<input type="text" value={toCity} onChange={(event) => setToCity(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-800" /></label>
          </div>
          <label className="block text-[11px] font-bold text-slate-500">{t('Date', 'التاريخ', 'Date')}<input type="date" value={flightDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setFlightDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-800" /></label>
          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 font-bold text-white"><Plane className="h-4 w-4" />{t('Check route', 'مراجعة المسار', 'Vérifier le trajet')}</button>

          {showResults && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-bold text-amber-900">{t('Flight search is unavailable right now.', 'البحث عن الرحلات غير متاح حالياً.', 'La recherche de vols est indisponible pour le moment.')}</p>
              <div className="mt-2 space-y-1 text-slate-700">
                <div>{t('From', 'من', 'De')}: {fromCity || '—'}</div>
                <div>{t('To', 'إلى', 'À')}: {toCity || '—'}</div>
                <div>{t('Date', 'التاريخ', 'Date')}: {flightDate || '—'}</div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

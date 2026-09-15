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
  const [fromCity, setFromCity] = useState('Casablanca (CMN)');
  const [toCity, setToCity] = useState('Tangier / Tetouan (TNG)');
  const [flightDate, setFlightDate] = useState(tomorrowDate);
  const [showResults, setShowResults] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs sm:p-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-gradient-to-r from-sky-500 to-blue-600 p-4 text-white sm:p-5">
          <div className="flex items-center gap-2.5"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20"><Plane className="h-5 w-5 -rotate-45" /></span><h3 className="text-base font-bold">{isAr ? 'الطيران' : 'Flights'}</h3></div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30" aria-label={isAr ? 'إغلاق' : 'Close'}><X className="h-4 w-4" /></button>
        </header>

        <form onSubmit={(event) => { event.preventDefault(); setShowResults(true); }} className="space-y-4 p-5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-[11px] font-bold text-slate-500">{isAr ? 'من' : 'From'}</span><input type="text" value={fromCity} onChange={(event) => setFromCity(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-medium text-slate-800" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-bold text-slate-500">{isAr ? 'إلى' : 'To'}</span><input type="text" value={toCity} onChange={(event) => setToCity(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-medium text-slate-800" /></label>
          </div>
          <label className="block"><span className="mb-1 block text-[11px] font-bold text-slate-500">{isAr ? 'التاريخ' : 'Date'}</span><input type="date" value={flightDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setFlightDate(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-medium text-slate-800" /></label>
          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700"><Plane className="h-4 w-4" />{isAr ? 'مراجعة' : 'Review'}</button>

          {showResults && (
            <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-bold text-amber-900">{isAr ? 'الحجز المباشر غير متاح بعد.' : 'Live booking is not available yet.'}</p>
              <div className="space-y-0.5 text-[11px] font-semibold text-slate-700"><div>{isAr ? 'من:' : 'From:'} {fromCity || '—'}</div><div>{isAr ? 'إلى:' : 'To:'} {toCity || '—'}</div><div>{isAr ? 'التاريخ:' : 'Date:'} {flightDate || '—'}</div></div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

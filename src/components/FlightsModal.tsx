import React, { useState } from 'react';
import { ExternalLink, Info, Plane, X } from 'lucide-react';
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

  if (!isOpen) return null;

  const searchUrl = `https://www.google.com/travel/flights?q=${encodeURIComponent(`flights from ${fromCity} to ${toCity} on ${flightDate}`)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-gradient-to-r from-sky-500 to-blue-600 p-4 text-white sm:p-5">
          <div className="flex items-center gap-2.5"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20"><Plane className="h-5 w-5 -rotate-45" /></span><h3 className="text-base font-black">{t('Flights', 'الرحلات الجوية', 'Vols')}</h3></div>
          <button type="button" onClick={onClose} aria-label={t('Close', 'إغلاق', 'Fermer')} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20"><X className="h-4 w-4" /></button>
        </header>

        <div className="space-y-4 p-5 text-xs">
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="font-bold leading-relaxed">
              {t(
                'My Sindbad does not search or book flights yet. Fill in your trip below and open it directly in a flight search engine.',
                'لا يبحث My Sindbad عن رحلات جوية أو يحجزها بعد. أدخل تفاصيل رحلتك وافتحها مباشرة في محرك بحث طيران خارجي.',
                'My Sindbad ne recherche ni ne réserve encore de vols. Renseignez votre trajet puis ouvrez-le directement dans un moteur de recherche de vols.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[11px] font-bold text-slate-500">{t('From', 'من', 'De')}<input type="text" value={fromCity} onChange={(event) => setFromCity(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-800" /></label>
            <label className="block text-[11px] font-bold text-slate-500">{t('To', 'إلى', 'À')}<input type="text" value={toCity} onChange={(event) => setToCity(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-800" /></label>
          </div>
          <label className="block text-[11px] font-bold text-slate-500">{t('Date', 'التاريخ', 'Date')}<input type="date" value={flightDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setFlightDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-800" /></label>

          <a
            href={searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700"
          >
            <ExternalLink className="h-4 w-4" />
            {t('Search on Google Flights', 'البحث عبر Google Flights', 'Rechercher sur Google Flights')}
          </a>
          <p className="text-center text-[10px] text-slate-400">{t('Opens an external site in a new tab.', 'يفتح موقعاً خارجياً في تبويب جديد.', 'Ouvre un site externe dans un nouvel onglet.')}</p>
        </div>
      </div>
    </div>
  );
};

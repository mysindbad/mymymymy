import React, { useState } from 'react';
import { X, Plane } from 'lucide-react';
import { SupportedLanguage } from '../data/translations';

interface FlightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: SupportedLanguage;
}

export const FlightsModal: React.FC<FlightsModalProps> = ({ isOpen, onClose, language = 'en' }) => {
  const isAr = language === 'ar';
  const [fromCity, setFromCity] = useState('Casablanca (CMN)');
  const [toCity, setToCity] = useState('Tangier / Tetouan (TNG)');
  const [flightDate, setFlightDate] = useState('2026-09-18');
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
      setShowResults(true);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-in zoom-in-95">
        <div className="p-4 sm:p-5 bg-gradient-to-r from-sky-500 to-blue-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Plane className="w-5 h-5 text-white -rotate-45" />
            </div>
            <div>
              <h3 className="font-bold text-base">{isAr ? 'تخطيط الرحلات الجوية' : 'Flight Planning'}</h3>
              <p className="text-xs text-sky-100">{isAr ? 'خطط لمسارك — الأسعار الحية غير متصلة بعد' : 'Plan your route — live fares are not connected yet'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSearch} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'من' : 'From'}</label>
              <input
                type="text"
                value={fromCity}
                onChange={(e) => setFromCity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'إلى' : 'To'}</label>
              <input
                type="text"
                value={toCity}
                onChange={(e) => setToCity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'تاريخ السفر' : 'Departure Date'}</label>
            <input
              type="date"
              value={flightDate}
              onChange={(e) => setFlightDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={isSearching}
            className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
          >
            <Plane className="w-4 h-4" />
            <span>{isSearching ? (isAr ? 'جاري البحث عن العروض...' : 'Searching Flight Deals...') : (isAr ? 'بحث عن الرحلات' : 'Find Best Deals')}</span>
          </button>

          {showResults && (
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                <h4 className="text-xs font-bold text-amber-900">
                  {isAr ? 'البحث المباشر غير متصل بعد' : 'Live flight search is not connected yet'}
                </h4>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {isAr
                    ? 'تم حفظ تفاصيل مسارك فقط. لن نعرض أسعاراً أو رحلات ثابتة على أنها عروض حقيقية.'
                    : 'Your route details are ready, but no live prices or flight options are being shown as real offers.'}
                </p>
                <div className="text-[11px] font-semibold text-slate-700 space-y-0.5">
                  <div>{isAr ? 'من:' : 'From:'} {fromCity || '—'}</div>
                  <div>{isAr ? 'إلى:' : 'To:'} {toCity || '—'}</div>
                  <div>{isAr ? 'التاريخ:' : 'Date:'} {flightDate || '—'}</div>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

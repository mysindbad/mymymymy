import React, { useState } from 'react';
import { X, Plane, Calendar, ArrowRight, Sparkles, MapPin, Check } from 'lucide-react';
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

  const deals = [
    {
      airline: 'Royal Air Maroc',
      flightNo: 'AT 402',
      departTime: '09:15',
      arriveTime: '10:25',
      price: '$64',
      type: 'Direct • 1h 10m',
    },
    {
      airline: 'Air Arabia Maroc',
      flightNo: '3O 118',
      departTime: '14:30',
      arriveTime: '15:40',
      price: '$48',
      type: 'Direct • 1h 10m',
    },
    {
      airline: 'Iberia',
      flightNo: 'IB 3340',
      departTime: '18:50',
      arriveTime: '20:10',
      price: '$82',
      type: 'Direct • 1h 20m',
    },
  ];

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
              <h3 className="font-bold text-base">{isAr ? 'حجوزات الطيران الذكية' : 'Flights • Best Deals Worldwide'}</h3>
              <p className="text-xs text-sky-100">{isAr ? 'مقارنة أسعار الرحلات بمساعدة الذكاء الاصطناعي' : 'AI-assisted flight pricing & direct connections'}</p>
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
              <h4 className="text-xs font-bold text-slate-800">{isAr ? 'أفضل الرحلات المتاحة' : 'Available Direct Options'}</h4>
              {deals.map((deal) => (
                <div key={deal.flightNo} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">{deal.airline} • {deal.flightNo}</span>
                    <span className="text-[11px] text-slate-500">{deal.departTime} → {deal.arriveTime} ({deal.type})</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-blue-600 block">{deal.price}</span>
                    <button
                      type="button"
                      onClick={() => alert(`Redirecting to ${deal.airline} booking partner...`)}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700"
                    >
                      {isAr ? 'حجز' : 'Select'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

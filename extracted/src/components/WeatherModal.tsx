import React, { useState } from 'react';
import { X, Sun, Cloud, CloudSun, Droplets, Wind, Sparkles, MapPin } from 'lucide-react';
import { SupportedLanguage } from '../data/translations';

interface WeatherModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: SupportedLanguage;
}

export const WeatherModal: React.FC<WeatherModalProps> = ({ isOpen, onClose, language = 'en' }) => {
  const isAr = language === 'ar';
  const [selectedCity, setSelectedCity] = useState('Chefchaouen, Morocco');

  if (!isOpen) return null;

  const weatherData: Record<string, any> = {
    'Chefchaouen, Morocco': {
      temp: '24°C',
      condition: 'Sunny & Pleasant',
      high: '27°',
      low: '16°',
      humidity: '42%',
      wind: '11 km/h',
      aiTip: isAr
        ? 'الطقس مثالي اليوم لاستكشاف أزقة شفشاون العتيقة، مع نسيم جبلي لطيف في المساء.'
        : 'Perfect conditions for walking the blue medina stairs. Pleasant mountain breeze expected at sunset.',
      forecast: [
        { day: 'Today', temp: '24°C', icon: '☀️' },
        { day: 'Fri', temp: '25°C', icon: '🌤️' },
        { day: 'Sat', temp: '23°C', icon: '☀️' },
        { day: 'Sun', temp: '22°C', icon: '⛅' },
      ],
    },
    'Akchour Cascades, Morocco': {
      temp: '21°C',
      condition: 'Clear Mountain Air',
      high: '23°',
      low: '14°',
      humidity: '58%',
      wind: '8 km/h',
      aiTip: isAr
        ? 'مياه الوادي منعشة جداً! ارتدِ حذاء مشي مضاد للانزلاق للصخور الرطبة.'
        : 'Canyon waters are cool and refreshing. Wear non-slip water shoes for rocky river crossings.',
      forecast: [
        { day: 'Today', temp: '21°C', icon: '☀️' },
        { day: 'Fri', temp: '22°C', icon: '☀️' },
        { day: 'Sat', temp: '21°C', icon: '🌤️' },
        { day: 'Sun', temp: '20°C', icon: '⛅' },
      ],
    },
    'Marrakech, Morocco': {
      temp: '29°C',
      condition: 'Warm & Sunny',
      high: '32°',
      low: '19°',
      humidity: '28%',
      wind: '14 km/h',
      aiTip: isAr
        ? 'درجات حرارة دافئة نهاراً. يُفضل زيارة حديقة ماجوريل صباحاً والأسواق بعد العصر.'
        : 'Warm afternoon sunshine. Recommended to visit gardens in morning and souks after 4 PM.',
      forecast: [
        { day: 'Today', temp: '29°C', icon: '☀️' },
        { day: 'Fri', temp: '30°C', icon: '☀️' },
        { day: 'Sat', temp: '31°C', icon: '☀️' },
        { day: 'Sun', temp: '29°C', icon: '🌤️' },
      ],
    },
  };

  const current = weatherData[selectedCity] || weatherData['Chefchaouen, Morocco'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-in zoom-in-95">
        <div className="p-4 sm:p-5 bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <CloudSun className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">{isAr ? 'الطقس المباشر والتوقعات' : 'Weather • Plan with Confidence'}</h3>
              <p className="text-xs text-cyan-100">{isAr ? 'توقعات ذكية لمسارات رحلتك' : 'Live conditions with AI travel tips'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* City selector */}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="flex-1 p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs outline-none"
            >
              <option value="Chefchaouen, Morocco">Chefchaouen, Morocco</option>
              <option value="Akchour Cascades, Morocco">Akchour Cascades, Morocco</option>
              <option value="Marrakech, Morocco">Marrakech, Morocco</option>
            </select>
          </div>

          {/* Current Temp Display */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-100 flex items-center justify-between">
            <div>
              <span className="text-3xl font-black text-slate-900">{current.temp}</span>
              <p className="text-xs font-bold text-blue-600 mt-0.5">{current.condition}</p>
              <span className="text-[11px] text-slate-500">H: {current.high} • L: {current.low}</span>
            </div>
            <div className="text-4xl">☀️</div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Humidity</span>
              <span className="text-sm font-bold text-slate-800 flex items-center justify-center gap-1 mt-0.5">
                <Droplets className="w-3.5 h-3.5 text-cyan-600" />
                {current.humidity}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Wind Speed</span>
              <span className="text-sm font-bold text-slate-800 flex items-center justify-center gap-1 mt-0.5">
                <Wind className="w-3.5 h-3.5 text-blue-600" />
                {current.wind}
              </span>
            </div>
          </div>

          {/* AI Tip */}
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-start gap-2.5 text-amber-900">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{current.aiTip}</p>
          </div>

          {/* 4-Day Forecast */}
          <div>
            <span className="font-bold text-slate-700 block mb-2">{isAr ? 'توقعات الأيام القادمة' : '4-Day Forecast'}</span>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              {current.forecast.map((f: any) => (
                <div key={f.day} className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold block">{f.day}</span>
                  <span className="text-base my-1 block">{f.icon}</span>
                  <span className="text-xs font-bold text-slate-800">{f.temp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

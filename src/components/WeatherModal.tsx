import React, { useEffect, useState } from 'react';
import { CloudSun, Loader2, MapPin, RefreshCw, Wind, X } from 'lucide-react';
import { SupportedLanguage } from '../data/translations';
import { getWeather, WeatherData } from '../services/api';

interface WeatherModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: SupportedLanguage;
}

const cities = [
  { id: 'chefchaouen', label: 'Chefchaouen, Morocco', coordinates: [35.1695, -5.2625] as [number, number] },
  { id: 'akchour', label: 'Akchour Cascades, Morocco', coordinates: [35.2415, -5.1742] as [number, number] },
  { id: 'marrakech', label: 'Marrakech, Morocco', coordinates: [31.625, -7.99] as [number, number] },
];

export function weatherCodeToLabel(code: number, isAr = false): string {
  if (code === 0) return isAr ? 'سماء صافية' : 'Clear sky';
  if ([1, 2, 3].includes(code)) return isAr ? 'غائم جزئياً' : 'Partly cloudy';
  if ([45, 48].includes(code)) return isAr ? 'ضباب' : 'Fog';
  if ([51, 52, 53, 54, 55, 56, 57].includes(code)) return isAr ? 'رذاذ' : 'Drizzle';
  if ([61, 62, 63, 64, 65, 66, 67].includes(code)) return isAr ? 'أمطار' : 'Rain';
  if ([71, 72, 73, 74, 75, 76, 77, 85, 86].includes(code)) return isAr ? 'ثلوج' : 'Snow';
  if ([80, 81, 82].includes(code)) return isAr ? 'زخات مطرية' : 'Rain showers';
  if ([95, 96, 99].includes(code)) return isAr ? 'عواصف رعدية' : 'Thunderstorm';
  return isAr ? 'غير معروف' : 'Unknown';
}

export const WeatherModal: React.FC<WeatherModalProps> = ({ isOpen, onClose, language = 'en' }) => {
  const isAr = language === 'ar';
  const [selectedCity, setSelectedCity] = useState(cities[0].id);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWeather = async () => {
    const city = cities.find((item) => item.id === selectedCity) || cities[0];
    setIsLoading(true);
    setError(null);
    try {
      setWeather(await getWeather(city.coordinates[0], city.coordinates[1]));
    } catch (loadError) {
      setWeather(null);
      setError(loadError instanceof Error ? loadError.message : 'Weather service temporarily unavailable');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) void loadWeather();
  }, [isOpen, selectedCity]);

  if (!isOpen) return null;
  const city = cities.find((item) => item.id === selectedCity) || cities[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
        <div className="p-4 sm:p-5 bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <CloudSun className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">{isAr ? 'الطقس المباشر' : 'Live weather'}</h3>
              <p className="text-xs text-cyan-100">{isAr ? 'بيانات من موقعك المختار' : 'Current conditions for the selected place'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
            <select
              value={selectedCity}
              onChange={(event) => setSelectedCity(event.target.value)}
              className="flex-1 p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs outline-none"
            >
              {cities.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>

          {isLoading && (
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200 flex items-center justify-center gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>{isAr ? 'جاري تحميل الطقس...' : 'Loading weather...'}</span>
            </div>
          )}
          {error && !isLoading && (
            <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-3">
              <span>{isAr ? 'خدمة الطقس غير متاحة مؤقتاً' : 'Weather service temporarily unavailable'}</span>
              <button onClick={() => void loadWeather()} className="rounded-lg bg-rose-600 px-3 py-1.5 text-white font-bold flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                {isAr ? 'إعادة' : 'Retry'}
              </button>
            </div>
          )}
          {weather && !isLoading && (
            <>
              <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-100 flex items-center justify-between">
                <div>
                  <span className="text-3xl font-black text-slate-900">{weather.temperatureC}°C</span>
                  <p className="text-xs font-bold text-blue-600 mt-0.5">{weatherCodeToLabel(weather.weatherCode, isAr)}</p>
                  <span className="text-[11px] text-slate-500">
                    {isAr ? 'آخر تحديث' : 'Observed'}: {new Date(weather.observedAt).toLocaleString(language)}
                  </span>
                </div>
                <CloudSun className="w-12 h-12 text-blue-500" />
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">{isAr ? 'سرعة الرياح' : 'Wind speed'}</span>
                <span className="text-sm font-bold text-slate-800 flex items-center justify-center gap-1 mt-0.5">
                  <Wind className="w-3.5 h-3.5 text-blue-600" />
                  {weather.windSpeedKmh} km/h
                </span>
              </div>
              <p className="text-[11px] text-slate-500">{city.label}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
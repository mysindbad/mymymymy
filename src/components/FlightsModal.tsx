import React, { useState } from 'react';
import { ExternalLink, Plane } from 'lucide-react';
import { SupportedLanguage } from '../data/translations';
import { useLocale } from '../lib/i18n';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { TextInput } from '../ui/Field';
import { Alert } from '../ui/Feedback';

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
  const locale = useLocale(language);
  const t = locale.t;
  const [fromCity, setFromCity] = useState('Casablanca (CMN)');
  const [toCity, setToCity] = useState('Tangier / Tetouan (TNG)');
  const [flightDate, setFlightDate] = useState(tomorrowDate);

  const searchUrl = `https://www.google.com/travel/flights?q=${encodeURIComponent(`flights from ${fromCity} to ${toCity} on ${flightDate}`)}`;

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title={t('Flights', 'الرحلات الجوية', 'Vols')}
      subtitle={t('Opens in Google Flights', 'يُفتح في Google Flights', 'S’ouvre dans Google Flights')}
      size="md"
      language={language}
      footer={
        <a href={searchUrl} target="_blank" rel="noopener noreferrer" className="block">
          <Button full icon={<ExternalLink className="h-4 w-4" />}>
            {t('Search on Google Flights', 'البحث عبر Google Flights', 'Rechercher sur Google Flights')}
          </Button>
        </a>
      }
    >
      <div className="space-y-3.5 px-4 pb-6 pt-3 sm:px-5">
        <Alert tone="info">
          {t(
            'My Sindbad does not search or book flights yet. Fill in your trip below and open it directly in a flight search engine.',
            'لا يبحث My Sindbad عن رحلات جوية أو يحجزها بعد. أدخل تفاصيل رحلتك وافتحها مباشرة في محرك بحث طيران.',
            'My Sindbad ne recherche ni ne réserve encore de vols. Renseignez votre trajet puis ouvrez-le dans un moteur de recherche de vols.',
          )}
        </Alert>

        <div className="grid-cols-1 grid gap-3 sm:grid-cols-2">
          <TextInput id="flight-from" label={t('From', 'من', 'De')} value={fromCity} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFromCity(event.target.value)} />
          <TextInput id="flight-to" label={t('To', 'إلى', 'À')} value={toCity} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setToCity(event.target.value)} />
        </div>
        <TextInput
          id="flight-date"
          type="date"
          label={t('Date', 'التاريخ', 'Date')}
          min={new Date().toISOString().slice(0, 10)}
          value={flightDate}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFlightDate(event.target.value)}
        />
        <p className="text-micro text-muted">{t('Opens an external site in a new tab.', 'يفتح موقعاً خارجياً في تبويب جديد.', 'Ouvre un site externe dans un nouvel onglet.')}</p>
      </div>
    </Sheet>
  );
};

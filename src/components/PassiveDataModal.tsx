import React, { useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { submitPassiveTrace } from '../services/api';
import { getAuthSessionSnapshot } from '../lib/authSession';
import { SupportedLanguage } from '../data/translations';
import { useLocale } from '../lib/i18n';
import { Sheet } from '../ui/Sheet';
import { Switch } from '../ui/Field';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Feedback';
import { Divider } from '../ui/Panel';

interface PassiveDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOptedIn: boolean;
  onToggleOptIn: (optedIn: boolean) => void;
  language?: SupportedLanguage;
  onOpenAuth?: () => void;
}

type SendStatus = { type: 'success' | 'error'; message: string };

function requestCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GEOLOCATION_UNAVAILABLE'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

function createContributionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `contribution_${crypto.randomUUID()}`;
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const values = new Uint32Array(4);
    crypto.getRandomValues(values);
    return `contribution_${Array.from(values, (value) => value.toString(16).padStart(8, '0')).join('')}`;
  }
  throw new Error('SECURE_RANDOM_UNAVAILABLE');
}

export const PassiveDataModal: React.FC<PassiveDataModalProps> = ({
  isOpen,
  onClose,
  isOptedIn,
  onToggleOptIn,
  language = 'en',
  onOpenAuth,
}) => {
  const locale = useLocale(language);
  const localize = locale.t;
  const [isSendingSample, setIsSendingSample] = useState(false);
  const [sendStatus, setSendStatus] = useState<SendStatus | null>(null);
  const isSignedIn = getAuthSessionSnapshot().status === 'authed';

  const handleSendCurrentLocation = async () => {
    setSendStatus(null);
    if (!isSignedIn) {
      setSendStatus({ type: 'error', message: localize('Sign in first.', 'سجّل الدخول أولاً.', 'Connectez-vous d’abord.') });
      return;
    }

    setIsSendingSample(true);
    try {
      const position = await requestCurrentPosition();
      const success = await submitPassiveTrace({
        coordinates: [position.coords.latitude, position.coords.longitude],
        mode: 'manual_sample',
        anonymousUserId: createContributionId(),
      });
      setSendStatus(success
        ? { type: 'success', message: localize('Location sent.', 'تم إرسال الموقع.', 'Localisation envoyée.') }
        : { type: 'error', message: localize('Could not send location.', 'تعذر إرسال الموقع.', 'Impossible d’envoyer la localisation.') });
    } catch {
      setSendStatus({ type: 'error', message: localize('Location permission is required.', 'يلزم السماح بالوصول إلى الموقع.', 'L’autorisation de localisation est requise.') });
    } finally {
      setIsSendingSample(false);
    }
  };

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title={localize('Location contribution', 'مساهمة الموقع', 'Contribution de position')}
      size="sm"
      language={language}
      footer={
        <Button
          full
          onClick={() => void handleSendCurrentLocation()}
          loading={isSendingSample}
          disabled={!isOptedIn}
          icon={<Navigation className="h-4 w-4" />}
        >
          {localize('Send location', 'إرسال الموقع', 'Envoyer la localisation')}
        </Button>
      }
    >
      <div className="px-4 pb-6 pt-1 sm:px-5">
        <div className="sindbad-list-row -mx-4 rounded-none px-4 sm:mx-0 sm:rounded-lg sm:px-3.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-accent">
            <MapPin className="h-4 w-4" aria-hidden="true" />
          </span>
          <Switch
            id="passive-sample-toggle"
            checked={isOptedIn}
            onChange={onToggleOptIn}
            label={localize('Share a location sample', 'مشاركة عينة موقع', 'Partager un échantillon de position')}
            description={localize(
              'Sends one point when you tap Send. Nothing is sent on its own.',
              'يُرسل نقطة واحدة عند الضغط على إرسال. لا يُرسل شيء تلقائياً.',
              'Envoie un point lorsque vous appuyez sur Envoyer. Rien n’est envoyé automatiquement.',
            )}
          />
        </div>

        <Divider className="my-3.5" />

        <p className="text-caption leading-relaxed text-muted">
          {localize(
            'Your location is sent only when you tap Send.',
            'يُرسل موقعك فقط عندما تضغط على إرسال.',
            'Votre position n’est envoyée que lorsque vous appuyez sur Envoyer.',
          )}
        </p>
        <ul className="mt-2.5 space-y-1.5">
          {[
            localize('Coordinates and a timestamp', 'الإحداثيات والطابع الزمني', 'Coordonnées et horodatage'),
            localize('A random contribution id, not your name', 'معرّف مساهمة عشوائي، وليس اسمك', 'Un identifiant aléatoire, pas votre nom'),
            localize('You can turn this off at any time', 'يمكنك إيقاف هذا في أي وقت', 'Vous pouvez désactiver cela à tout moment'),
          ].map((line) => (
            <li key={line} className="flex items-start gap-2 text-caption text-ink-soft">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
              {line}
            </li>
          ))}
        </ul>

        {sendStatus && (
          <div className="mt-3.5">
            <Alert
              tone={sendStatus.type === 'success' ? 'success' : 'error'}
              action={sendStatus.type === 'error' && !isSignedIn && onOpenAuth ? (
                <Button size="sm" variant="secondary" onClick={onOpenAuth}>
                  {localize('Sign in', 'تسجيل الدخول', 'Se connecter')}
                </Button>
              ) : undefined}
            >
              {sendStatus.message}
            </Alert>
          </div>
        )}
      </div>
    </Sheet>
  );
};

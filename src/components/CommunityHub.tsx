import React, { useEffect, useState } from 'react';
import { ArrowRight, Map as MapIcon, Plus, Radio, Sparkles } from 'lucide-react';
import { SupportedLanguage } from '../data/translations';
import { fetchAiMemoryInsights, type AiMemoryInsights } from '../services/api';
import { useLocale } from '../lib/i18n';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Alert, Skeleton } from '../ui/Feedback';
import { Divider } from '../ui/Panel';

interface CommunityHubProps {
  onOpenAddModal: () => void;
  onOpenPassiveModal: () => void;
  isPassiveOptedIn: boolean;
  language?: SupportedLanguage;
  onExploreRegion?: () => void;
}

type MetricsStatus = 'loading' | 'ready' | 'unavailable';

function Metric({ label, value, status }: { label: string; value: number | undefined; status: MetricsStatus }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <span className="text-body font-extrabold tabular-nums text-white">
        {status === 'ready' && value !== undefined ? value : status === 'loading' ? '—' : '—'}
      </span>
      <span className="truncate text-micro text-slate-300">{label}</span>
    </div>
  );
}

export const CommunityHub: React.FC<CommunityHubProps> = ({
  onOpenAddModal,
  onOpenPassiveModal,
  isPassiveOptedIn,
  language = 'en',
  onExploreRegion,
}) => {
  const locale = useLocale(language);
  const t = locale.t;
  const [insights, setInsights] = useState<AiMemoryInsights | null>(null);
  const [metricsStatus, setMetricsStatus] = useState<MetricsStatus>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setMetricsStatus('loading');
    fetchAiMemoryInsights()
      .then((data) => {
        if (cancelled) return;
        setInsights(data);
        setMetricsStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setInsights(null);
        setMetricsStatus('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return (
    <div className="mx-auto w-full max-w-[46rem] px-4 py-4 sm:px-6 sm:py-6">
      <header className="mb-5">
        <h1 className="text-display font-extrabold tracking-tight text-ink">
          {t('Community', 'المجتمع', 'Communauté')}
        </h1>
        <p className="mt-1 text-body text-muted">
          {t('Places and signals contributed by travelers.', 'أماكن وإشارات يضيفها المسافرون.', 'Des lieux et des signaux ajoutés par les voyageurs.')}
        </p>
      </header>

      {/* Editorial band — the region this release actually covers. */}
      <section className="relative overflow-hidden rounded-xl bg-slate-950 px-4 pb-4 pt-4 sm:px-5" data-surface="night">
        <div className="pointer-events-none absolute -end-10 -top-14 h-44 w-44 rounded-full bg-brand-600/20 blur-[2px]" aria-hidden="true" />
        <div className="relative">
          <Chip
            tone="onPhoto"
            icon={<Sparkles className="h-3 w-3" />}
            className="border-white/25 bg-white/10 text-white"
          >
            {t('Northern Morocco', 'شمال المغرب', 'Nord du Maroc')}
          </Chip>
          <h2 className="mt-2.5 max-w-[34ch] text-title font-bold leading-snug text-white sm:text-h2 sm:leading-[1.3]">
            {t(
              'Local depth in Chefchaouen, Akchour and the Rif',
              'عمق محلي في شفشاون وأقشور والريف',
              'Une couverture locale de Chefchaouen, Akchour et du Rif',
            )}
          </h2>
          <p className="mt-1.5 max-w-[52ch] text-caption leading-relaxed text-slate-300">
            {t(
              'Sindbad organizes local places and community signals in northern Morocco. Numbers below come from the live service only.',
              'ينظّم سندباد الأماكن المحلية وإشارات المجتمع في شمال المغرب. الأرقام أدناه تأتي من الخدمة الحية فقط.',
              'My Sindbad organise les lieux et signaux communautaires du nord du Maroc. Les chiffres ci-dessous proviennent du service en direct.',
            )}
          </p>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-3">
            <Metric label={t('Learned places', 'أماكن متعلَّمة', 'Lieux appris')} value={insights?.totalLearnedPlaces} status={metricsStatus} />
            <Metric label={t('Hidden gems', 'جواهر خفية', 'Pépites')} value={insights?.hiddenGemsCount} status={metricsStatus} />
            <Metric label={t('Location contributions', 'مساهمات الموقع', 'Contributions de position')} value={insights?.totalPassiveGpsTraces} status={metricsStatus} />
            {metricsStatus === 'loading' && (
              <span className="ms-auto flex items-center gap-2">
                <Skeleton className="h-3 w-14" />
                <span className="sr-only">{t('Loading community metrics', 'جارٍ تحميل مقاييس المجتمع', 'Chargement des métriques communautaires')}</span>
              </span>
            )}
          </div>

          {onExploreRegion && (
            <div className="mt-4">
              <button
                type="button"
                onClick={onExploreRegion}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white/10 px-3.5 text-body font-bold text-white transition-colors hover:bg-white/15"
              >
                <MapIcon className="h-4 w-4" aria-hidden="true" />
                {t('Open the region map', 'افتح خريطة المنطقة', 'Ouvrir la carte de la région')}
                <ArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </section>

      {metricsStatus === 'unavailable' && (
        <div className="mt-3">
          <Alert
            tone="info"
            title={t('Live counts are unavailable', 'الأعداد الحية غير متاحة', 'Les compteurs en direct sont indisponibles')}
            action={
              <Button size="sm" variant="secondary" onClick={() => setReloadToken((value) => value + 1)}>
                {t('Retry', 'إعادة المحاولة', 'Réessayer')}
              </Button>
            }
          >
            {t('No estimated numbers are shown while the service is unreachable.', 'لا تُعرض أي أرقام تقديرية أثناء تعذّر الوصول إلى الخدمة.', 'Aucun chiffre estimé n’est affiché quand le service est injoignable.')}
          </Alert>
        </div>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-caption font-bold uppercase tracking-[0.08em] text-muted">
          {t('Contribute', 'المساهمة', 'Contribuer')}
        </h2>
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <button type="button" onClick={onOpenAddModal} className="sindbad-list-row w-full rounded-none border-b border-line">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-accent">
              <Plus className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body font-bold text-ink">{t('Add a place', 'أضف مكاناً', 'Ajouter un lieu')}</span>
              <span className="block text-micro text-muted">
                {t('Name, what it is, where it is.', 'الاسم، نوعه، وموقعه.', 'Nom, type et emplacement.')}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted rtl:-scale-x-100" aria-hidden="true" />
          </button>
          <button type="button" onClick={onOpenPassiveModal} className="sindbad-list-row w-full rounded-none">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isPassiveOptedIn ? 'bg-positive/12 text-positive' : 'bg-surface-muted text-muted'}`}>
              <Radio className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body font-bold text-ink">{t('Location contributions', 'مساهمات الموقع', 'Contributions de position')}</span>
              <span className="block text-micro text-muted">
                {isPassiveOptedIn
                  ? t('On — one point per send', 'مفعّلة — نقطة عند كل إرسال', 'Activée — un point par envoi')
                  : t('Off — nothing is sent', 'متوقفة — لا يُرسل شيء', 'Désactivée — rien n’est envoyé')}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted rtl:-scale-x-100" aria-hidden="true" />
          </button>
        </div>
      </section>

    </div>
  );
};

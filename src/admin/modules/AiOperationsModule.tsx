// AI operations, strictly from what the platform stores: request counts in ai_usage_events and
// measured outcomes in service_events. No prompts, no answers, no user-level content - the app
// does not store any of that, and this screen does not pretend otherwise.
import { useAdminLocale } from '../locale-context';
import { adminUrl, useAdminResource } from '../useAdminData';
import { useAdminRouter } from '../router';
import { Button, DayBars, DefinitionList, ErrorNotice, Metric, Panel, Pill, RefreshButton, SectionTitle, type Tone } from '../ui';
import type { AiOperationsPayload } from '../types';

export default function AiOperationsModule() {
  const { t, n, time, relative } = useAdminLocale();
  const { navigate } = useAdminRouter();
  const resource = useAdminResource<AiOperationsPayload>(adminUrl('/api/admin/ai-operations'));
  const payload = resource.data ?? null;
  const usage = payload?.usage;
  const outcomes = payload?.outcomes;
  const configuration = payload?.configuration;

  const errorShare = outcomes && outcomes.total > 0 ? (outcomes.failed / outcomes.total) * 100 : null;
  const tone: Tone = outcomes && outcomes.total === 0
    ? 'unknown'
    : errorShare === null
      ? 'unknown'
      : errorShare > 20 ? 'bad' : errorShare > 5 ? 'warn' : 'ok';

  const endpoints = new Map(usage?.byEndpoint.map((entry) => [entry.endpoint, entry.count]) ?? []);

  return (
    <div className="adm-grid" style={{ gap: '0.75rem' }}>
      <Panel
        title={t('AI availability and load', 'توفّر الذكاء الاصطناعي وحِمله', 'Disponibilité et charge IA')}
        note={t('from ai_usage_events (7 days) and service_events (24h)', 'من ai_usage_events (7 أيام) وservice_events (24 ساعة)', 'depuis ai_usage_events (7 j) et service_events (24 h)')}
        actions={
          <>
            <RefreshButton onClick={resource.reload} busy={resource.isRefreshing} />
            <Button size="sm" data-variant="ghost" onClick={() => navigate('/admin/health')}>{t('Service health', 'حالة الخدمات', 'Santé des services')}</Button>
          </>
        }
        flush
      >
        <div style={{ display: 'grid', gap: '0.75rem', padding: '0.75rem' }}>
          {resource.error && !payload ? <ErrorNotice error={resource.error} onRetry={resource.reload} /> : null}
          <div className="adm-grid adm-grid-4">
            <Metric
              label={t('Provider key', 'مفتاح المزوّد', 'Clé fournisseur')}
              value={configuration?.keyConfigured ? <Pill state="ok">{t('configured', 'مضبوط', 'configurée')}</Pill> : <Pill state="warn">{t('not configured', 'غير مضبوط', 'non configurée')}</Pill>}
              note={t('presence only, never the value', 'وجودا فقط، لا القيمة', 'présence seulement, jamais la valeur')}
            />
            <Metric
              label={t('Requests, 7 days', 'الطلبات، 7 أيام', 'Requêtes, 7 j')}
              value={n(usage?.total7d ?? 0, 0)}
              note={t('chat + trip planning, counted at the API boundary', 'الدردشة وتخطيط الرحلات، تُعدّ عند حد الواجهة', 'chat + planification, comptées à la frontière API')}
            />
            <Metric
              label={t('Measured calls, 24h', 'استدعاءات مقاسة، 24 ساعة', 'Appels mesurés, 24 h')}
              value={n(outcomes?.total ?? 0, 0)}
              note={outcomes && outcomes.total > 0
                ? t(`${n(outcomes.failed, 0)} failed`, `${n(outcomes.failed, 0)} فاشل`, `${n(outcomes.failed, 0)} échoués`)
                : t('no traffic to measure', 'لا حركة لقياسها', 'aucun trafic à mesurer')}
            />
            <Metric
              label={t('Median latency', 'الزمن الوسيط', 'Latence médiane')}
              value={outcomes?.p50LatencyMs === null || outcomes?.p50LatencyMs === undefined ? '—' : n(outcomes.p50LatencyMs, 0)}
              unit={outcomes?.p50LatencyMs === null ? undefined : 'ms'}
              note={outcomes?.p95LatencyMs !== null && outcomes?.p95LatencyMs !== undefined
                ? t(`95th percentile ${n(outcomes.p95LatencyMs, 0)} ms`, `المئين 95 يساوي ${n(outcomes.p95LatencyMs, 0)} ملة`, `95e centile ${n(outcomes.p95LatencyMs, 0)} ms`)
                : t('no latency measured', 'لم يُقَس زمن', 'aucune latence mesurée')}
            />
          </div>

          <div className="adm-grid adm-grid-2">
            <div>
              <SectionTitle>{t('Requests per day', 'الطلبات في اليوم', 'Requêtes par jour')}</SectionTitle>
              {usage && usage.perDay.some((day) => day.count > 0) ? (
                <>
                  <DayBars days={usage.perDay} />
                  <p className="adm-note" style={{ margin: '0.375rem 0 0' }}>
                    {t('14 days of stored events, oldest on the left. Nothing is interpolated between days.',
                        '14 يوما من الأحداث المحفوظة، الأقدم يسارا. لا يُستنتج شيء بين الأيام.',
                        '14 jours d’événements enregistrés, le plus ancien à gauche. Aucune interpolation.')}</p>
                </>
              ) : (
                <p className="adm-note">{t('No AI request has been recorded in the last seven days, so there is no line to draw.', 'لم يُسجَّل أي طلب ذكاء اصطناعي خلال سبعة أيام، فلا يوجد خط يُرسم.', 'Aucune requête IA sur sept jours : rien à tracer.')}</p>
              )}
            </div>
            <div>
              <SectionTitle>{t('By feature', 'حسب الميزة', 'Par fonctionnalité')}</SectionTitle>
              <ul className="adm-dist">
                {['chat', 'plan_trip', 'navigation-guidance'].map((endpoint) => (
                  <li key={endpoint}>
                    <span className="adm-dist-key">{featureLabel(endpoint, t)}</span>
                    <span className="adm-dist-bar" aria-hidden="true">
                      <i style={{ width: `${Math.max(2, Math.round(((endpoints.get(endpoint) ?? 0) / Math.max(1, usage?.total7d ?? 1)) * 100))}%` }} />
                    </span>
                    <span className="adm-dist-val adm-num">{n(endpoints.get(endpoint) ?? 0, 0)}</span>
                  </li>
                ))}
              </ul>
              <p className="adm-note" style={{ margin: '0.375rem 0 0' }}>
                {t('Navigation guidance is served by a route that records its own telemetry only when the app calls it through the main API.',
                    'إرشاد الملاحة يقدّمه مسار يسجّل قياساته فقط عند استدعائه عبر الواجهة الرئيسية.',
                    'Le guidage de navigation n’est télémétré que lorsqu’il passe par l’API principale.')}
              </p>
            </div>
          </div>

          <DefinitionList
            items={[
              { label: t('Model requested', 'النموذج المطلوب', 'Modèle demandé'), value: configuration ? <span className="adm-mono">{configuration.model}</span> : '—' },
              { label: t('Provider', 'المزوّد', 'Fournisseur'), value: configuration?.provider ?? '—' },
              {
                label: t('Outcome mix', 'توزيع النتائج', 'Répartition des résultats'),
                value: outcomes && outcomes.total > 0
                  ? <span><Pill state={tone}>{errorShare !== null && errorShare > 0 ? t(`${n(errorShare, 1)}% of measured calls failed`, `فشل ${n(errorShare, 1)}% من الاستدعاءات المقاسة`, `${n(errorShare, 1)} % des appels ont échoué`) : t('every measured call succeeded', 'كل الاستدعاءات المقاسة نجحت', 'tous les appels mesurés ont réussi')}</Pill></span>
                  : <Pill state="unknown">{t('nothing measured in this window', 'لم يُقَس شيء في هذه النافذة', 'rien de mesuré sur cette fenêtre')}</Pill>,
              },
              {
                label: t('Last measurement', 'آخر قياس', 'Dernière mesure'),
                value: outcomes && outcomes.total > 0 ? t(`${n(outcomes.total, 0)} calls recorded`, `سُجّلت ${n(outcomes.total, 0)} استدعاءات`, `${n(outcomes.total, 0)} appels enregistrés`) : '—',
              },
            ]}
          />

          <div className="adm-evidence">
            <strong style={{ fontSize: '0.75rem' }}>{t('What is deliberately not shown', 'ما لا يُعرض عن قصد', 'Ce qui n’est volontairement pas affiché')}</strong>
            <p style={{ margin: 0, fontSize: '0.75rem' }}>
              {t('Prompts and answers are not stored by this app, so there is no transcript to browse, no per-person usage table, and no retained conversation. Keys live in deployment configuration and are never sent to a browser. Trip plans saved by travellers are their own records, visible in their account - not here.',
                  'لا يخزّن التطبيق الأوامر ولا الردود، لذلك لا يوجد نص محادثة يُتصفّح ولا جدول استخدام لكل شخص ولا محتوى محفوظ. المفاتيح في إعدادات النشر ولا تُرسل إلى المتصفح أبدا. رحلات المحفوظة يراها صاحبها في حسابهوحده.',
                  'Les prompts et réponses ne sont pas stockés : aucun transcript, aucune table par personne, aucune conversation conservée. Les clés restent dans la configuration du déploiement et ne vont jamais au navigateur. Les voyages enregistrés appartiennent aux voyageurs et se voient dans leur compte, pas ici.')}</p>
          </div>
          <p className="adm-note" style={{ margin: 0 }}>
            {payload ? t(`This page was read ${time(new Date().toISOString())} · updated ${relative(new Date().toISOString())}`, `قُرئت هذه الصفحة ${time(new Date().toISOString())}`, `Lu à ${time(new Date().toISOString())}`) : null}
          </p>
        </div>
      </Panel>
    </div>
  );
}

function featureLabel(endpoint: string, t: (en: string, ar: string, fr: string) => string): string {
  if (endpoint === 'chat') return t('Assistant chat', 'محادثة المساعد', 'Chat assistant');
  if (endpoint === 'plan_trip') return t('Trip planning', 'تخطيط رحلة', 'Planification de voyage');
  if (endpoint === 'navigation-guidance') return t('Navigation guidance', 'إرشاد الملاحة', 'Guidage de navigation');
  return endpoint.replace(/_/g, ' ');
}

// Service health, from measurements the platform took itself.
//
// Two sources, never mixed: `service_events` rows written by the response-boundary observer in
// server.ts (what real user traffic experienced) and an explicit live probe an operator starts
// from here. A page that rendered successfully is not evidence that the app is healthy, so this
// screen never says "healthy" from its own load.
import { useCallback, useState } from 'react';
import { useAdminLocale } from '../locale-context';
import { adminUrl, useAdminAction, useAdminResource } from '../useAdminData';
import { useAdminRouter } from '../router';
import { Button, ErrorNotice, Panel, Pill, RefreshButton, SectionTitle, type Tone } from '../ui';
import { describeAdminError } from '../api';
import type { ProbeResponse, ServiceHealthPayload, ServiceStatus } from '../types';

const STATUS_TONE: Record<ServiceStatus, Tone> = { healthy: 'ok', degraded: 'warn', unavailable: 'bad', unknown: 'neutral' };

const SERVICE_NAMES: Record<string, { en: string; ar: string; fr: string; note: { en: string; ar: string; fr: string } }> = {
  api: {
    en: 'App API',
    ar: 'واجهة التطبيق',
    fr: 'API applicative',
    note: { en: 'the HTTP layer that answers /api/health', ar: 'طبقة HTTP التي تجيب على /api/health', fr: 'la couche HTTP qui répond à /api/health' },
  },
  database: {
    en: 'Database',
    ar: 'قاعدة البيانات',
    fr: 'Base de données',
    note: { en: 'PostgREST read against places', ar: 'قراءة PostgREST على جدول الأماكن', fr: 'lecture PostgREST sur places' },
  },
  weather: {
    en: 'Weather',
    ar: 'الطقس',
    fr: 'Météo',
    note: { en: 'Open-Meteo, via /api/weather', ar: 'Open-Meteo عبر /api/weather', fr: 'Open-Meteo via /api/weather' },
  },
  tiles: {
    en: 'Map tiles',
    ar: 'بلاطات الخريطة',
    fr: 'Tuiles cartographiques',
    note: { en: 'OpenStreetMap, with Carto as backup', ar: 'OpenStreetMap مع Carto احتياطيا', fr: 'OpenStreetMap, Carto en secours' },
  },
  place_discovery: {
    en: 'Place discovery',
    ar: 'اكتشاف الأماكن',
    fr: 'Découverte de lieux',
    note: { en: 'Overpass, via /api/nearby-places', ar: 'Overpass عبر /api/nearby-places', fr: 'Overpass via /api/nearby-places' },
  },
  ai: {
    en: 'AI provider',
    ar: 'مزوّد الذكاء الاصطناعي',
    fr: 'Fournisseur IA',
    note: { en: 'Gemini calls made from the app', ar: 'استدعاءات Gemini من التطبيق', fr: 'appels Gemini depuis l’app' },
  },
};

interface Row {
  key: string;
  status: ServiceStatus;
  latencyMs: number | null;
  ok: number;
  failed: number;
  detail: string | null;
  source: string;
  checkedAt: string | null;
}

export default function ServiceHealthModule() {
  const { t, n, time, relative } = useAdminLocale();
  const { navigate } = useAdminRouter();
  const health = useAdminResource<ServiceHealthPayload>(adminUrl('/api/admin/service-health'));
  const [selfCheck, setSelfCheck] = useState<{ status: 'idle' | 'checking' | 'ok' | 'down'; code: number | null; ms: number | null }>({ status: 'idle', code: null, ms: null });
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [probes, setProbes] = useState<{ services: Row['key'][]; checkedAt: string } | null>(null);
  const probeAction = useAdminAction<ProbeResponse>(adminUrl('/api/admin/service-health/probes'));

  const runSelfCheck = useCallback(async () => {
    setSelfCheck((current) => ({ ...current, status: 'checking' }));
    const startedAt = performance.now();
    try {
      const response = await fetch('/api/health', { headers: { Accept: 'application/json' } });
      const ms = Math.round(performance.now() - startedAt);
      setSelfCheck({ status: response.ok ? 'ok' : 'down', code: response.status, ms });
    } catch {
      setSelfCheck({ status: 'down', code: null, ms: null });
    }
  }, []);

  const runProbes = useCallback(async () => {
    setProbing(true);
    setProbeError(null);
    const result = await probeAction.run({});
    if (result) {
      setProbes({ services: result.probes.services.map((service) => service.key), checkedAt: result.probes.checkedAt });
      health.reload();
    } else {
      setProbeError(describeAdminError(probeAction.error));
    }
    setProbing(false);
  }, [probeAction, health]);

  const telemetry = health.data?.health.services ?? [];
  const byKey = new Map(telemetry.map((entry) => [entry.key, entry]));
  const snapshot = (health.data as unknown as { configuration?: Record<string, boolean> })?.configuration ?? {};
  void snapshot;

  const rows: Row[] = ['api', 'database', 'weather', 'tiles', 'place_discovery', 'ai'].map((key) => {
    const observed = byKey.get(key);
    if (key === 'api') {
      return {
        key,
        status: selfCheck.status === 'ok' ? 'healthy' : selfCheck.status === 'down' ? 'unavailable' : 'unknown',
        latencyMs: selfCheck.ms,
        ok: 0,
        failed: 0,
        detail: selfCheck.status === 'idle'
          ? t('not measured yet — run the request check below', 'لم يُقَس بعد — شغّل فحص الطلب بالأسفل', 'pas encore mesuré — lancez le test ci-dessous')
          : selfCheck.code === null
            ? t('the request did not complete', 'لم يكتمل الطلب', 'la requête n’a pas abouti')
            : t(`answered ${selfCheck.code}`, `أجاب برمز ${selfCheck.code}`, `a répondu ${selfCheck.code}`),
        source: 'this-request',
        checkedAt: null,
      };
    }
    if (key === 'database') {
      return {
        key,
        status: health.error ? (health.error.isUnavailable ? 'unavailable' : 'unknown') : health.data ? 'healthy' : 'unknown',
        latencyMs: null,
        ok: health.data ? 1 : 0,
        failed: health.error ? 1 : 0,
        detail: health.data
          ? t('the roster and every count on this console were read from it', 'قُرئت منها القائمة وكل counts هذه اللوحة', 'liste et compteurs de cette console lus depuis elle')
          : t('this screen could not read it', 'تعذّرت قراءة هذه الشاشة لها', 'cet écran n’a pas pu la lire'),
        source: 'admin-read',
        checkedAt: health.updatedAt ? new Date(health.updatedAt).toISOString() : null,
      };
    }
    return {
      key,
      status: observed?.status ?? 'unknown',
      latencyMs: observed?.latencyMs ?? null,
      ok: Number(observed?.ok ?? 0),
      failed: Number(observed?.failed ?? 0),
      detail: observed?.detail ?? t('no request in the last 24h to measure', 'لا طلب في آخر 24 ساعة لقياسه', 'aucune requête sur 24 h à mesurer'),
      source: observed?.source ?? 'none',
      checkedAt: observed?.checkedAt ?? null,
    };
  });

  return (
    <div className="adm-grid" style={{ gap: '0.75rem' }}>
      <Panel
        title={t('What the platform measured', 'ما قاسته المنصة', 'Ce que la plateforme a mesuré')}
        note={t(
          `telemetry window 24h · ${n(health.data?.health.telemetryRows ?? 0, 0)} recorded calls · generated ${time(health.data?.health.generatedAt)}`,
          `نافذة القياس 24 ساعة · ${n(health.data?.health.telemetryRows ?? 0, 0)} استدعاء مسجّل · أُنشئت ${time(health.data?.health.generatedAt)}`,
          `fenêtre 24 h · ${n(health.data?.health.telemetryRows ?? 0, 0)} appels enregistrés · générée ${time(health.data?.health.generatedAt)}`,
        )}
        actions={
          <>
            <RefreshButton onClick={health.reload} busy={health.isRefreshing} />
            <Button size="sm" onClick={() => void runProbes()} disabled={probing || Boolean(probeAction.isPending)}>
              {probing ? t('Probing…', 'جارٍ الفحص…', 'Sondage…') : t('Run live checks', 'تشغيل فحص مباشر', 'Lancer les sondes')}
            </Button>
            <Button size="sm" data-variant="ghost" onClick={runSelfCheck} disabled={selfCheck.status === 'checking'}>
              {selfCheck.status === 'checking' ? t('Checking…', 'جارٍ الفحص…', 'Test…') : t('Check this API', 'افحص هذه الواجهة', 'Tester cette API')}
            </Button>
          </>
        }
        flush
      >
        <table className="adm-table">
          <caption>{t('Service status derived from recorded outcomes. Latency is the median of measured calls, not an estimate.', 'حالة الخدمات مستمدة من النتائج المسجلة. الوسيط هو وسيط الاستدعاءات المقاسة، لا تقدير.', 'États dérivés des résultats enregistrés. Latence = médiane des appels mesurés, pas une estimation.')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('Service', 'الخدمة', 'Service')}</th>
              <th scope="col">{t('Status', 'الحالة', 'État')}</th>
              <th scope="col" style={{ textAlign: 'end' }}>{t('Median', 'الوسيط', 'Médiane')}</th>
              <th scope="col" style={{ textAlign: 'end' }}>{t('Ok / failed', 'ناجح / فاشل', 'Ok / échecs')}</th>
              <th scope="col">{t('Evidence', 'الدليل', 'Preuve')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const meta = SERVICE_NAMES[row.key];
              const name = meta ? t(meta.en, meta.ar, meta.fr) : row.key;
              return (
                <tr key={row.key}>
                  <td>
                    <strong>{name}</strong>
                    <span className="adm-cell-sub">{meta ? t(meta.note.en, meta.note.ar, meta.note.fr) : ''}</span>
                  </td>
                  <td>
                    <Pill state={STATUS_TONE[row.status]}>{statusLabel(row.status, t)}</Pill>
                  </td>
                  <td className="adm-num" style={{ textAlign: 'end' }}>{row.latencyMs === null ? '—' : `${n(row.latencyMs, 0)} ms`}</td>
                  <td className="adm-num" style={{ textAlign: 'end' }}>{row.ok || row.failed ? `${n(row.ok, 0)} / ${n(row.failed, 0)}` : '—'}</td>
                  <td>
                    <span className="adm-note">
                      {row.detail}
                      {row.checkedAt ? ` · ${relative(row.checkedAt)}` : ''}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {health.error ? <div style={{ padding: '0 0.75rem 0.75rem' }}><ErrorNotice error={health.error} onRetry={health.reload} /></div> : null}
        {probeError ? <p className="adm-error-text" style={{ padding: '0 0.75rem 0.75rem', margin: 0 }} role="alert">{probeError}</p> : null}
        {probes ? (
          <p className="adm-hint" style={{ padding: '0 0.75rem 0.75rem', margin: 0 }} role="status">
            {t(`Live probes finished at ${time(probes.checkedAt)} and were written to telemetry.`, `انتهت الفحوص المباشرة في ${time(probes.checkedAt)} ودوّنت في القياسات.`, `Sondages terminés à ${time(probes.checkedAt)} et enregistrés dans la télémétrie.`)}
          </p>
        ) : null}
      </Panel>

      <div className="adm-grid adm-grid-2">
        <Panel title={t('Request check', 'فحص الطلب', 'Test de requête')}>
          <SectionTitle>{t('/api/health', '/api/health', '/api/health')}</SectionTitle>
          <p className="adm-note" style={{ margin: 0 }}>
            {selfCheck.status === 'idle'
              ? t('Nothing has been measured from this browser yet. The button above asks the running API directly.', 'لم يُقَس شيء من هذا المتصفح بعد. الزر أعلاه يسأل الواجهة العاملة مباشرة.', 'Rien n’a été mesuré depuis ce navigateur. Le bouton ci-dessus interroge l’API en cours.')
              : selfCheck.status === 'checking'
                ? t('Waiting for the response…', 'في انتظار الجواب…', 'En attente de la réponse…')
                : t(`Answered ${selfCheck.code ?? 'no response'}${selfCheck.ms !== null ? ` in ${selfCheck.ms} ms` : ''}.`, `أجاب ${selfCheck.code ?? 'بلا جواب'}${selfCheck.ms !== null ? ` خلال ${selfCheck.ms} ملة` : ''}.`, `A répondu ${selfCheck.code ?? 'aucune réponse'}${selfCheck.ms !== null ? ` en ${selfCheck.ms} ms` : ''}.`)}
          </p>
          <p className="adm-note" style={{ margin: '0.375rem 0 0' }}>
            {t('A 200 here means the HTTP layer is up. It is not evidence that the database, AI or weather upstreams are healthy — those are the rows above.',
                '200 هنا يعني أن طبقة HTTP تعمل. ليست دليلا على صحة قاعدة البيانات أو الذكاء الاصطناعي أو الطقس، فتلك في الصفوف أعلاه.',
                'Un 200 signifie que la couche HTTP répond. Ce n’est pas une preuve pour la base, l’IA ou la météo — voir les lignes ci-dessus.')}
          </p>
        </Panel>

        <Panel title={t('Configuration observed', 'الإعدادات المرصودة', 'Configuration observée')}>
          <SectionTitle>{t('What this deployment exposes', 'ما يكشفه هذا النشر', 'Ce que ce déploiement expose')}</SectionTitle>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.375rem', fontSize: '0.75rem' }}>
            <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Pill state={health.data?.configuration.database ? 'ok' : 'warn'}>{health.data?.configuration.database ? t('database reachable', 'قاعدة البيانات متاحة', 'base joignable') : t('database unreachable', 'قاعدة البيانات غير متاحة', 'base injoignable')}</Pill>
              <span className="adm-note">{t('proven by a successful admin read', 'مُثبت بقراءة مشرف ناجحة', 'prouvé par une lecture admin réussie')}</span>
            </li>
            <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Pill state={health.data?.configuration.aiProvider ? 'ok' : 'neutral'}>{health.data?.configuration.aiProvider ? t('AI key present', 'مفتاح الذكاء الاصطناعي مضبوط', 'clé IA présente') : t('no AI key here', 'لا مفتاح هنا', 'pas de clé ici')}</Pill>
              <span className="adm-note">{t('presence only — the value is never read into the browser', 'مجرد وجود — لا تُقرأ القيمة إلى المتصفح أبدا', 'présence uniquement — la valeur n’est jamais exposée')}</span>
            </li>
          </ul>
          <div className="adm-actions">
            <Button size="sm" onClick={() => navigate('/admin/ai')}>{t('AI operations', 'عمليات الذكاء الاصطناعي', 'Opérations IA')}</Button>
            <Button size="sm" data-variant="ghost" onClick={() => navigate('/admin/audit?targetType=place')}>{t('Recent changes', 'التغييرات الأخيرة', 'Changements récents')}</Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function statusLabel(status: ServiceStatus, t: (en: string, ar: string, fr: string) => string): string {
  if (status === 'healthy') return t('healthy', 'سليمة', 'saine');
  if (status === 'degraded') return t('degraded', 'متدهورة', 'dégradée');
  if (status === 'unavailable') return t('unavailable', 'غير متاحة', 'indisponible');
  return t('no data', 'لا بيانات', 'aucune donnée');
}

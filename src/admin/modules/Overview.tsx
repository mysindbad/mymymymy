// Operations overview. Every figure below is a live count returned by
// `admin_operations_snapshot()`, which reads the same tables the consumer app reads. There is
// no stored history in this deployment, so nothing here is drawn as a trend line.
import { useAdminLocale } from '../locale-context';
import { useAdminResource, adminUrl } from '../useAdminData';
import { useAdminRouter } from '../router';
import { Button, DataTable, ErrorNotice, Metric, Panel, Pill, RefreshButton, StaleNotice, type Column, type Tone } from '../ui';
import type { OverviewResponse, AuditRow } from '../types';

const MODERATION_TONES: Record<string, Tone> = {
  approved: 'ok',
  pending: 'warn',
  needs_changes: 'bad',
  rejected: 'neutral',
};

const SERVICE_LABELS: Record<string, { en: string; ar: string; fr: string }> = {
  weather: { en: 'Weather', ar: 'الطقس', fr: 'Météo' },
  tiles: { en: 'Map tiles', ar: 'بلاطات الخريطة', fr: 'Tuiles carte' },
  place_discovery: { en: 'Place discovery', ar: 'اكتشاف الأماكن', fr: 'Découverte de lieux' },
  ai: { en: 'AI provider', ar: 'مزوّد الذكاء الاصطناعي', fr: 'Fournisseur IA' },
};

export default function OverviewModule() {
  const { t, n, relative, time, dateTime } = useAdminLocale();
  const { navigate } = useAdminRouter();
  const resource = useAdminResource<OverviewResponse>(adminUrl('/api/admin/overview'));
  const overview = resource.data?.overview ?? null;
  const snapshot = overview?.snapshot ?? {};

  if (resource.error && !overview) {
    return (
      <Panel title={t('Operations overview', 'نظرة عامة على التشغيل', 'Vue générale des opérations')}>
        <ErrorNotice error={resource.error} onRetry={resource.reload} />
      </Panel>
    );
  }

  const places = snapshot.places ?? {};
  const reviews = snapshot.reviews ?? {};
  const travelers = snapshot.travelers ?? {};
  const moderators = snapshot.moderators ?? {};
  const services = snapshot.services ?? {};
  const audit = snapshot.audit ?? {};
  const byModeration: Record<string, number> = places.by_moderation ?? {};
  const pending = Number(byModeration.pending ?? 0);
  const needsChanges = Number(byModeration.needs_changes ?? 0);
  const rejected = Number(byModeration.rejected ?? 0);

  const attention = [
    {
      key: 'pending-places',
      label: t('Submitted places waiting for a decision', 'أماكن مقترحة تنتظر قرارًا', 'Lieux proposés en attente de décision'),
      value: pending,
      to: '/admin/moderation',
      tone: (pending > 0 ? 'warn' : 'ok') as Tone,
    },
    {
      key: 'needs-changes',
      label: t('Places sent back for changes', 'أماكن أُعيدت لتعديلها', 'Lieux renvoyés pour modification'),
      value: needsChanges,
      to: '/admin/moderation?status=needs_changes',
      tone: (needsChanges > 0 ? 'bad' : 'neutral') as Tone,
    },
    {
      key: 'pending-reviews',
      label: t('Reviews waiting for moderation', 'تقييمات تنتظر المراجعة', 'Avis en attente de modération'),
      value: Number(reviews.pending ?? 0),
      to: '/admin/reviews?status=pending',
      tone: (Number(reviews.pending ?? 0) > 0 ? 'warn' : 'ok') as Tone,
    },
    {
      key: 'service-problems',
      label: t('Failed upstream calls in the last 24h', 'استدعاءات فاشلة للمصادر الخارجية خلال 24 ساعة', 'Appels amont échoués sur 24 h'),
      value: Number(services.problems_last_24h ?? 0),
      to: '/admin/health',
      tone: (Number(services.problems_last_24h ?? 0) > 0 ? 'bad' : 'ok') as Tone,
    },
  ];

  const historyColumns: Array<Column<AuditRow>> = [
    {
      id: 'when',
      label: t('When', 'التوقيت', 'Quand'),
      width: '9rem',
      render: (row) => <span className="adm-num" title={dateTime(row.occurredAt)}>{relative(row.occurredAt)}</span>,
    },
    {
      id: 'action',
      label: t('Action', 'الإجراء', 'Action'),
      render: (row) => (
        <span>
          <strong>{row.action.replace(/_/g, ' ')}</strong>
          <span className="adm-cell-sub adm-mono">
            {row.targetType} · {row.targetId ? `${row.targetId.slice(0, 8)}…${row.targetId.slice(-4)}` : '—'}
          </span>
        </span>
      ),
    },
    { id: 'admin', label: t('Administrator', 'المشرف', 'Administrateur'), render: (row) => row.adminLabel ?? '—' },
    {
      id: 'reason',
      label: t('Reason', 'السبب', 'Motif'),
      render: (row) => <span style={{ color: 'var(--adm-ink-soft)' }}>{row.reason ?? '—'}</span>,
    },
  ];

  return (
    <>
      {resource.isStale ? <StaleNotice at={resource.updatedAt} onRetry={resource.reload} /> : null}

      <div className="adm-split">
        <Panel
          title={t('Catalogue', 'الكتالوج', 'Catalogue')}
          note={t(
            `counted live · read in ${n(overview?.databaseLatencyMs, 0)} ms`,
            `لحظي مباشرةً · قُرئ في ${n(overview?.databaseLatencyMs, 0)} ملة`,
            `compté en direct · lu en ${n(overview?.databaseLatencyMs, 0)} ms`,
          )}
          actions={<RefreshButton onClick={resource.reload} busy={resource.isRefreshing} />}
          flush
        >
          <div style={{ display: 'grid', gap: '0.75rem', padding: '0.75rem' }}>
            <div className="adm-grid adm-grid-4">
              <Metric
                label={t('Places published', 'أماكن منشورة', 'Lieux publiés')}
                value={n(places.total ?? 0, 0)}
                note={t('rows in public.places', 'صفوف في public.places', 'lignes dans public.places')}
              />
              <Metric
                label={t('Waiting for a decision', 'بانتظار قرار', 'En attente de décision')}
                value={n(pending, 0)}
                note={t('moderation_status = pending', 'حالة المراجعة pending', 'moderation_status = pending')}
              />
              <Metric
                label={t('Hidden from the feed', 'مخفية من القائمة', 'Masqués du flux')}
                value={n(rejected, 0)}
                note={t('rejected places stay in the database', 'الأماكن المرفوضة تبقى في القاعدة', 'les lieux rejetés restent en base')}
              />
              <Metric
                label={t('With live ratings', 'بتقييمات حقيقية', 'Avec note réelle')}
                value={n(places.with_live_rating ?? 0, 0)}
                unit={t(`of ${n(places.total ?? 0, 0)}`, `من ${n(places.total ?? 0, 0)}`, `sur ${n(places.total ?? 0, 0)}`)}
                note={t('review_count > 0 · seed reviews excluded', 'review_count > 0 · دون تقييمات البذرة', 'review_count > 0 · avis seed exclus')}
              />
            </div>

            <div className="adm-grid adm-grid-4">
              <Metric
                label={t('Traveler reviews', 'تقييمات المسافرين', 'Avis voyageurs')}
                value={n(reviews.live_total ?? 0, 0)}
                note={t(`${n(reviews.last_24h ?? 0, 0)} written in the last 24h`, `${n(reviews.last_24h ?? 0, 0)} كُتبت خلال 24 ساعة`, `${n(reviews.last_24h ?? 0, 0)} écrits sur 24 h`)}
              />
              <Metric
                label={t('Check-ins', 'زيارات مسجّلة', 'Check-ins')}
                value={n(snapshot.checkins?.total ?? 0, 0)}
                note={t(`${n(snapshot.checkins?.last_7d ?? 0, 0)} in the last 7 days`, `${n(snapshot.checkins?.last_7d ?? 0, 0)} خلال 7 أيام`, `${n(snapshot.checkins?.last_7d ?? 0, 0)} sur 7 jours`)}
              />
              <Metric
                label={t('Traveler profiles', 'ملفات المسافرين', 'Profils voyageurs')}
                value={n(travelers.profiles_total ?? 0, 0)}
                note={t(`${n(travelers.created_last_7d ?? 0, 0)} new this week`, `${n(travelers.created_last_7d ?? 0, 0)} جديد هذا الأسبوع`, `${n(travelers.created_last_7d ?? 0, 0)} nouveaux cette semaine`)}
              />
              <Metric
                label={t('Trips planned', 'رحلات مخطّطة', 'Voyages planifiés')}
                value={n(snapshot.trips?.total ?? 0, 0)}
                note={t(`${n(snapshot.trips?.created_last_7d ?? 0, 0)} in the last 7 days`, `${n(snapshot.trips?.created_last_7d ?? 0, 0)} خلال 7 أيام`, `${n(snapshot.trips?.created_last_7d ?? 0, 0)} sur 7 jours`)}
              />
            </div>

            <div className="adm-grid adm-grid-2">
              <div>
                <h4 className="adm-section-title">{t('Moderation state', 'حالة المراجعة', 'État de modération')}</h4>
                <ul className="adm-dist">
                  {Object.entries(byModeration).length === 0 ? <li><span className="adm-note">{t('No places recorded yet.', 'لا توجد أماكن مسجلة بعد.', 'Aucun lieu enregistré.')}</span></li> : null}
                  {Object.entries(byModeration).map(([status, count]) => (
                    <li key={status}>
                      <span className="adm-dist-key">
                        <Pill state={MODERATION_TONES[status] ?? 'neutral'}>{status.replace('_', ' ')}</Pill>
                      </span>
                      <span className="adm-dist-bar" aria-hidden="true">
                        <i style={{ width: `${Math.max(2, Math.round((Number(count) / Math.max(1, Number(places.total ?? 1))) * 100))}%` }} />
                      </span>
                      <span className="adm-dist-val adm-num">{n(Number(count), 0)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="adm-section-title">{t('Where the catalogue came from', 'مصدر بيانات الكتالوج', 'Origine du catalogue')}</h4>
                <ul className="adm-dist">
                  {(places.by_source ?? []).map((entry: { key: string; count: number }) => (
                    <li key={entry.key}>
                      <span className="adm-dist-key">{sourceLabel(entry.key, t)}</span>
                      <span className="adm-dist-bar" aria-hidden="true">
                        <i style={{ width: `${Math.max(2, Math.round((Number(entry.count) / Math.max(1, Number(places.total ?? 1))) * 100))}%` }} />
                      </span>
                      <span className="adm-dist-val adm-num">{n(Number(entry.count), 0)}</span>
                    </li>
                  ))}
                </ul>
                <p className="adm-note" style={{ marginTop: '0.375rem' }}>
                  {t('Seed rows are labelled as such everywhere in this console, and carry no live rating.',
                      'صفوف البذرة موسومة كذلك في كل هذه الشاشة، ولا تحمل تقييمًا حقيقيًا.',
                      'les lignes seed sont marquées comme telles ici, sans note réelle.')}
                </p>
              </div>
            </div>
          </div>
        </Panel>

        <div className="adm-grid" style={{ gap: '0.75rem' }}>
          <Panel title={t('Needs attention', 'يحتاج انتباهًا', 'À traiter')} note={t('links open the real queue', 'الروابط تفتح الطابور الفعلي', 'les liens ouvrent la file réelle')}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.375rem' }}>
              {attention.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => navigate(item.to)}
                    style={{
                      inlineSize: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.4375rem 0.5rem', border: '1px solid var(--adm-line)', borderRadius: 'var(--adm-radius)',
                      background: 'var(--adm-surface-raised)', cursor: 'pointer', textAlign: 'start', font: 'inherit', color: 'inherit',
                    }}
                  >
                    <Pill state={item.tone}>{item.value > 0 ? n(item.value, 0) : '0'}</Pill>
                    <span style={{ fontSize: '0.75rem', color: 'var(--adm-ink-soft)' }}>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="adm-note" style={{ margin: '0.5rem 0 0' }}>
              {t(`Roster: ${n(moderators.active_total ?? 0, 0)} active administrator(s), ${n(moderators.super_admins ?? 0, 0)} with the super role.`,
                  `القائمة: ${n(moderators.active_total ?? 0, 0)} مشرف نشط، منهم ${n(moderators.super_admins ?? 0, 0)} بصلاحية عليا.`,
                  `Effectif : ${n(moderators.active_total ?? 0, 0)} administrateur(s) actif(s), dont ${n(moderators.super_admins ?? 0, 0)} super-administrateurs.`)}
            </p>
          </Panel>

          <Panel
            title={t('Upstream calls (24h)', 'الاستدعاءات الخارجية (24 ساعة)', 'Appels amont (24 h)')}
            note={t('measured by the app itself', 'تقيسها المنصة نفسها', 'mesurés par l’application')}
            actions={<Button size="sm" data-variant="ghost" onClick={() => navigate('/admin/health')}>{t('Service health', 'حالة الخدمات', 'Santé des services')}</Button>}
          >
            <ul className="adm-dist">
              {(services.by_service ?? []).length === 0 ? (
                <li><span className="adm-note">{t('No upstream traffic recorded in this window.', 'لم يُسجَّل أي traffic خارجي في هذه الفترة.', 'Aucun trafic amont sur cette fenêtre.')}</span></li>
              ) : null}
              {(services.by_service ?? []).map((entry: { service: string; ok: number; failed: number }) => {
                const label = SERVICE_LABELS[entry.service];
                const name = label ? t(label.en, label.ar, label.fr) : entry.service;
                const total = Number(entry.ok) + Number(entry.failed);
                return (
                  <li key={entry.service}>
                    <span className="adm-dist-key">{name}</span>
                    <span className="adm-dist-bar" aria-hidden="true">
                      <i style={{ width: `${Math.max(2, Math.round((Number(entry.failed) / Math.max(1, total)) * 100))}%`, background: 'var(--adm-bad)' }} />
                    </span>
                    <span className="adm-dist-val adm-num" title={t(`${n(entry.ok, 0)} ok · ${n(entry.failed, 0)} failed`, `${n(entry.ok, 0)} ناجح · ${n(entry.failed, 0)} فاشل`, `${n(entry.ok, 0)} ok · ${n(entry.failed, 0)} échoués`)}>
                      {n(entry.failed, 0)} / {n(total, 0)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="adm-note" style={{ margin: '0.5rem 0 0' }}>
              {services.last_problem_at
                ? t(`Last problem ${relative(services.last_problem_at)} · ${time(services.last_problem_at)}`, `آخر مشكلة ${relative(services.last_problem_at)} · ${time(services.last_problem_at)}`, `Dernier incident ${relative(services.last_problem_at)} · ${time(services.last_problem_at)}`)
                : t('No failed upstream call has been recorded.', 'لم يُسجَّل أي استدعاء فاشل.', 'Aucun appel amont échoué enregistré.')}
            </p>
          </Panel>
        </div>
      </div>

      <Panel
        title={t('Recent administrator actions', 'آخر إجراءات المشرفين', 'Actions récentes des administrateurs')}
        note={audit.last_event_at
          ? t(`last event ${relative(audit.last_event_at)} · ${n(audit.last_24h ?? 0, 0)} in 24h`, `آخر إجراء ${relative(audit.last_event_at)} · ${n(audit.last_24h ?? 0, 0)} خلال 24 ساعة`, `dernière action ${relative(audit.last_event_at)} · ${n(audit.last_24h ?? 0, 0)} sur 24 h`)
          : t('No audited mutation recorded yet.', 'لم يُسجَّل أي إجراء مراجَع بعد.', 'Aucune mutation auditée enregistrée.')}
        actions={<Button size="sm" data-variant="ghost" onClick={() => navigate('/admin/audit')}>{t('Open audit log', 'فتح سجل التدقيق', 'Ouvrir le journal d’audit')}</Button>}
        flush
      >
        <DataTable
          caption={t('The eight most recent changes made by administrators, newest first.', 'آخر ثمانية تغييرات اجراها المشرفون، الأحدث أولاً.', 'Les huit dernières modifications d’administrateurs, les plus récentes d’abord.')}
          columns={historyColumns}
          rows={overview?.recentActions ?? []}
          rowKey={(row) => row.id}
          isLoading={resource.isLoading}
          skeletonRows={4}
          empty={
            <div className="adm-empty">
              <h3>{t('Nothing has been changed from this console yet.', 'لم يُغيَّر شيء من هذه الشاشة بعد.', 'Rien a été modifié depuis cette console pour le moment.')}</h3>
              <p>{t('Every approval, edit and privilege change will be recorded here with the reason given.', 'سيُسجَّل كل اعتماد أو تعديل أو تغيير صلاحية هنا مع السبب.', 'Chaque approbation, édition ou changement de privilège sera journalisé ici avec son motif.')}</p>
            </div>
          }
          error={resource.error && overview ? <ErrorNotice error={resource.error} onRetry={resource.reload} /> : undefined}
        />
      </Panel>
    </>
  );
}

function sourceLabel(key: string, t: (en: string, ar: string, fr: string) => string): string {
  if (key === 'initial_seed') return t('Initial seed catalogue', 'الكتالوج الأولي', 'Catalogue initial (seed)');
  if (key === 'community_traveler') return t('Traveller submissions', 'اقتراحات المسافرين', 'Contributions voyageurs');
  if (key === 'business_owner') return t('Business owners', 'أصحاب الأنشطة', 'Propriétaires concernés');
  return key;
}

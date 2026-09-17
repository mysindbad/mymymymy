// The audit trail. These are the rows written by the database functions themselves - an action
// recorded here is an action that actually happened inside the transaction that changed the
// record, which is why a mutation and its audit entry cannot drift apart.
import { useEffect, useState } from 'react';
import { useAdminLocale } from '../locale-context';
import { adminUrl, useAdminResource, useDebouncedValue } from '../useAdminData';
import { useAdminRouter } from '../router';
import { Button, CopyButton, DataTable, DefinitionList, ErrorNotice, Pagination, Panel, Pill, RefreshButton, SectionTitle, Select, TextInput, type Column } from '../ui';
import type { AuditRow, Page } from '../types';

const TARGETS = ['', 'place', 'review', 'traveler', 'admin_role'];

export default function AuditModule() {
  const { t, n, date, time, relative } = useAdminLocale();
  const { params, setParams, navigate } = useAdminRouter();
  const targetType = params.get('targetType') && TARGETS.includes(params.get('targetType') as string) ? (params.get('targetType') as string) : '';
  const targetId = params.get('targetId') ?? '';
  const action = params.get('action') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const pageSize = [25, 50, 100].includes(Number(params.get('pageSize'))) ? Number(params.get('pageSize')) : 25;
  const dir = params.get('dir') === 'asc' ? 'asc' : 'desc';
  const [actionInput, setActionInput] = useState(action);
  const debouncedAction = useDebouncedValue(actionInput.trim(), 400);

  useEffect(() => { setActionInput(action); }, [action]);
  useEffect(() => {
    if (debouncedAction === action) return;
    setParams({ action: debouncedAction || null, page: null }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedAction]);

  const resource = useAdminResource<Page<AuditRow>>(adminUrl('/api/admin/audit-events', {
    targetType: targetType || undefined,
    targetId: targetId || undefined,
    action: action || undefined,
    page,
    pageSize,
    sort: 'occurred_at',
    dir,
  }));
  const rows = resource.data?.rows ?? [];
  const [selected, setSelected] = useState<AuditRow | null>(null);

  useEffect(() => {
    if (selected) {
      const fresh = rows.find((row) => row.id === selected.id);
      if (fresh && fresh !== selected) setSelected(fresh);
    }
    // Only re-resolve the open entry when a new page arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  const columns: Array<Column<AuditRow>> = [
    {
      id: 'when',
      label: t('When', 'التوقيت', 'Quand'),
      width: '12rem',
      render: (row) => (
        <span className="adm-num">
          {date(row.occurredAt)} {time(row.occurredAt)}
          <span className="adm-cell-sub">{relative(row.occurredAt)}</span>
        </span>
      ),
    },
    {
      id: 'admin',
      label: t('Administrator', 'المشرف', 'Administrateur'),
      width: '12rem',
      render: (row) => (
        <span>
          {row.adminLabel ?? t('no label', 'بدون تسمية', 'sans libellé')}
          <span className="adm-cell-sub">{row.adminRole ? row.adminRole.replace('_', ' ') : '—'}</span>
        </span>
      ),
    },
    {
      id: 'action',
      label: t('Action', 'الإجراء', 'Action'),
      width: '12rem',
      render: (row) => <strong>{row.action.replace(/_/g, ' ')}</strong>,
    },
    {
      id: 'target',
      label: t('Target', 'العنصر', 'Cible'),
      render: (row) => (
        <span>
          <Pill state="neutral">{targetLabel(row.targetType, t)}</Pill>
          <span className="adm-cell-sub adm-mono">{row.targetId ? `${row.targetId.slice(0, 8)}…${row.targetId.slice(-4)}` : '—'}</span>
        </span>
      ),
    },
    {
      id: 'reason',
      label: t('Reason', 'السبب', 'Motif'),
      render: (row) => <span style={{ color: 'var(--adm-ink-soft)' }}>{row.reason ?? t('not required', 'غير مطلوب', 'non requis')}</span>,
    },
    {
      id: 'change',
      label: t('Change', 'التغيير', 'Changement'),
      width: '14rem',
      render: (row) => <span className="adm-mono" style={{ fontSize: '0.6875rem' }}>{summarise(row.changeSummary)}</span>,
    },
  ];

  return (
    <div className="adm-split">
      <Panel
        title={t('Audit log', 'سجل التدقيق', 'Journal d’audit')}
        note={resource.data ? t(`${n(resource.data.total, 0)} recorded events`, `${n(resource.data.total, 0)} حدثا مسجّلا`, `${n(resource.data.total, 0)} événements enregistrés`) : t('reading…', 'جارٍ القراءة…', 'lecture…')}
        actions={<RefreshButton onClick={resource.reload} busy={resource.isRefreshing} />}
        flush
      >
        <div className="adm-toolbar">
          <Select
            label={t('Target type', 'نوع العنصر', 'Type de cible')}
            value={targetType}
            onChange={(event) => setParams({ targetType: event.target.value || null, page: null })}
            options={TARGETS.map((value) => ({ value, label: value ? targetLabel(value, t) : t('all types', 'كل الأنواع', 'tous types') }))}
          />
          <TextInput
            label={t('Action contains', 'الإجراء يحوي', 'Action contient')}
            value={actionInput}
            onChange={(event) => setActionInput(event.target.value)}
            className="adm-search"
            placeholder="moderation"
          />
          <TextInput
            label={t('Target id', 'معرّف العنصر', 'Identifiant de la cible')}
            value={targetId}
            onChange={(event) => setParams({ targetId: event.target.value.trim() || null, page: null }, { replace: true })}
            className="adm-search"
            placeholder="—"
          />
          <span className="adm-spacer" />
          <Button size="sm" data-variant="ghost" onClick={() => setParams({ targetType: null, targetId: null, action: null, page: null })}>
            {t('Clear', 'مسح', 'Effacer')}
          </Button>
        </div>
        <DataTable
          caption={t('Every privileged mutation, newest first. Nothing here can be edited or deleted from this console.', 'كل تغيير بصلاحيات، الأحدث أولا. لا يمكن تعديل شيء هنا ولا حذفه من هذه اللوحة.', 'Chaque mutation privilégiée, la plus récente d’abord. Rien ne peut être modifié ou supprimé depuis cette console.')}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowSelect={(row) => setSelected(row)}
          activeKey={selected?.id ?? null}
          sort={{ key: 'occurred_at', dir }}
          onSortChange={() => setParams({ dir: dir === 'desc' ? 'asc' : 'desc' })}
          isLoading={resource.isLoading}
          error={resource.error ? <ErrorNotice error={resource.error} onRetry={resource.reload} /> : undefined}
          empty={
            <div className="adm-empty">
              <h3>{t('No audited events match', 'لا أحداث تدقيق تطابق', 'Aucun événement ne correspond')}</h3>
              <p>{rows.length === 0 && !resource.error
                ? t('The audit table is append-only and starts empty on a fresh deployment. Approving a submission or editing a place writes the first row.',
                    'جدول التدقيق للإضافة فقط ويبدأ فارغا في النشر الجديد. اعتماد مقترح أو تعديل مكان يكتب أول صف.',
                    'La table d’audit est en ajout seul et démarre vide. Approuver une proposition ou corriger un lieu écrit la première ligne.')
                : null}</p>
            </div>
          }
        />
        <div className="adm-pager">
          <Pagination
            page={resource.data?.page ?? page}
            pageCount={resource.data?.pageCount ?? 1}
            total={resource.data?.total ?? 0}
            pageSize={resource.data?.pageSize ?? pageSize}
            onPage={(next) => setParams({ page: String(next) })}
            onPageSize={(next) => setParams({ pageSize: String(next), page: null })}
          />
        </div>
      </Panel>

      {selected ? (
        <aside className="adm-inspector" aria-label={t('Audit entry', 'سجل التدقيق', 'Entrée d’audit')}>
          <div className="adm-inspector-head">
            <div style={{ minWidth: 0 }}>
              <h2>{selected.action.replace(/_/g, ' ')}</h2>
              <p className="adm-note" style={{ margin: '0.125rem 0 0' }}>{date(selected.occurredAt)} · {time(selected.occurredAt)}</p>
            </div>
            <Button size="sm" data-variant="ghost" style={{ marginInlineStart: 'auto' }} onClick={() => setSelected(null)}>{t('Close', 'إغلاق', 'Fermer')}</Button>
          </div>
          <DefinitionList
            items={[
              { label: t('Event id', 'معرّف الحدث', 'Identifiant'), value: <CopyButton value={selected.id} /> },
              { label: t('Administrator', 'المشرف', 'Administrateur'), value: `${selected.adminLabel ?? '—'} (${selected.adminRole ?? '—'})` },
              { label: t('Target', 'العنصر', 'Cible'), value: `${targetLabel(selected.targetType, t)} · ${selected.targetId || '—'}` },
              { label: t('Reason', 'السبب', 'Motif'), value: selected.reason ?? t('none recorded', 'لا شيء', 'aucun') },
            ]}
          />
          <div>
            <SectionTitle>{t('What changed', 'ما تغيّر', 'Ce qui a changé')}</SectionTitle>
            <pre className="adm-mono" style={{ margin: 0, fontSize: '0.6875rem', whiteSpace: 'pre-wrap', background: 'var(--adm-surface-sunken)', border: '1px solid var(--adm-line)', borderRadius: 'var(--adm-radius)', padding: '0.5rem' }}>
              {JSON.stringify(selected.changeSummary ?? {}, null, 2)}
            </pre>
            <p className="adm-note" style={{ margin: '0.375rem 0 0' }}>
              {t('Change metadata as written by the database function — before/after values only, never secrets.',
                  'بيانات التغيير كما كتبتها دالة قاعدة البيانات --قبل وبعد فقط، ولا أسرار.',
                  'Métadonnées écrites par la fonction SQL : valeurs avant/après uniquement, jamais de secret.')}
            </p>
          </div>
          {selected.targetType === 'place' && selected.targetId ? (
            <div className="adm-actions">
              <Button size="sm" onClick={() => navigate(`/admin/places/${selected.targetId}`)}>{t('Open the place record', 'افتح سجل المكان', 'Ouvrir la fiche du lieu')}</Button>
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}

function targetLabel(value: string, t: (en: string, ar: string, fr: string) => string) {
  if (value === 'place') return t('place', 'مكان', 'lieu');
  if (value === 'review') return t('review', 'تقييم', 'avis');
  if (value === 'traveler') return t('traveller', 'مسافر', 'voyageur');
  if (value === 'admin_role') return t('console access', 'صلاحية اللوحة', 'accès console');
  return value || '—';
}

function summarise(summary: Record<string, unknown>): string {
  const keys = Object.keys(summary ?? {});
  if (keys.length === 0) return '—';
  return keys.slice(0, 4).map((key) => `${key}:${String(summary[key]).slice(0, 24)}`).join(' ');
}

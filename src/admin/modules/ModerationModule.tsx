// Submission queue: what a moderator has to decide on, with enough evidence to decide it.
// The list is filtered in the database (`moderation_status in (pending, needs_changes)`) and
// the per-state counts are exact head counts, never a slice of the current page.
import { useEffect, useState } from 'react';
import { useAdminLocale } from '../locale-context';
import { adminUrl, useAdminResource, useDebouncedValue } from '../useAdminData';
import { useAdminRouter } from '../router';
import { Button, DataTable, ErrorNotice, Pagination, Panel, Pill, RefreshButton, SearchBox, StaleNotice, type Column } from '../ui';
import { PlaceInspector, displayName, moderationLabel } from '../PlaceInspector';
import type { PlaceRow, QueueResponse } from '../types';

export default function ModerationModule({ placeId }: { placeId: string | null }) {
  const { t, n, date, relative, language } = useAdminLocale();
  const { params, setParams, navigate } = useAdminRouter();
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const pageSize = [25, 50, 100].includes(Number(params.get('pageSize'))) ? Number(params.get('pageSize')) : 25;
  const sort = params.get('sort') === 'name' ? 'name' : params.get('sort') === 'review_count' ? 'review_count' : 'created_at';
  const dir = params.get('dir') === 'asc' ? 'asc' : 'desc';
  const rawQuery = params.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(rawQuery);
  const debounced = useDebouncedValue(searchInput.trim());

  useEffect(() => { setSearchInput(rawQuery); }, [rawQuery]);
  useEffect(() => {
    if (debounced === rawQuery) return;
    setParams({ q: debounced || null, page: null }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const resource = useAdminResource<QueueResponse>(adminUrl('/api/admin/moderation/queue', { q: rawQuery || undefined, page, pageSize, sort, dir }));
  const queue = resource.data?.queue ?? null;
  const rows = queue?.rows ?? [];
  const pending = queue?.queueCounts.find((entry) => entry.status === 'pending')?.total ?? 0;
  const needsChanges = queue?.queueCounts.find((entry) => entry.status === 'needs_changes')?.total ?? 0;

  const columns: Array<Column<PlaceRow>> = [
    {
      id: 'name',
      label: t('Place', 'المكان', 'Lieu'),
      sortKey: 'name',
      width: '18rem',
      render: (row) => (
        <span>
          {displayName(row, t, language)}
          <span className="adm-cell-sub">{[row.area, row.region].filter(Boolean).join(' · ')}</span>
        </span>
      ),
    },
    {
      id: 'evidence',
      label: t('What the traveller wrote', 'ما كتبه المسافر', 'Ce que le voyageur a écrit'),
      render: (row) => (
        <span style={{ display: 'block', maxInlineSize: '34rem' }}>
          {row.description ? (
            <>
              <span style={{ color: 'var(--adm-ink-soft)' }}>{truncate(row.description, 220)}</span>
              {row.description.length > 220 ? <span className="adm-note"> · {t(`${n(row.description.length, 0)} characters`, `${n(row.description.length, 0)} حرفًا`, `${n(row.description.length, 0)} caractères`)}</span> : null}
            </>
          ) : (
            <span className="adm-note" style={{ color: 'var(--adm-bad)' }}>{t('No description was submitted.', 'لم يُرفق وصف.', 'Aucune description soumise.')}</span>
          )}
          <span className="adm-cell-sub">
            {row.category ? row.category.replace('_', ' ') : t('no category', 'بدون فئة', 'sans catégorie')} · {row.coordinates ? t('coordinates on file', 'الإحداثيات محفوظة', 'coordonnées enregistrées') : <span style={{ color: 'var(--adm-warn)' }}>{t('no coordinates', 'بدون إحداثيات', 'sans coordonnées')}</span>} · {row.photos.length ? t(`${n(row.photos.length, 0)} photo(s)`, `${n(row.photos.length, 0)} صورة`, `${n(row.photos.length, 0)} photo(s)`) : t('no photos', 'بدون صور', 'sans photos')}
          </span>
        </span>
      ),
    },
    {
      id: 'state',
      label: t('State', 'الحالة', 'État'),
      width: '10rem',
      render: (row) => (
        <span>
          <Pill state={row.moderation.status === 'needs_changes' ? 'bad' : 'warn'}>{moderationLabel(row.moderation.status, t)}</Pill>
          {row.moderation.note ? <span className="adm-cell-sub">{truncate(row.moderation.note, 60)}</span> : null}
        </span>
      ),
    },
    {
      id: 'submitted',
      label: t('Submitted', 'أُرسل', 'Soumis'),
      sortKey: 'created_at',
      width: '10rem',
      render: (row) => (
        <span className="adm-num" title={date(row.createdAt)}>
          {relative(row.createdAt)}
          <span className="adm-cell-sub">{row.submittedBy ? t('by a signed-in traveller', 'من مسافر مسجّل', 'par un voyageur connecté') : t('catalogue import', 'استيراد كتالوج', 'import catalogue')}</span>
        </span>
      ),
    },
    {
      id: 'open',
      label: t('Inspector', 'اللوحة', 'Inspecteur'),
      align: 'end',
      width: '6.5rem',
      render: (row) => (
        <span className="adm-note">
          {row.id === placeId ? t('open', 'مفتوحة', 'ouverte') : t('select', 'اختر', 'choisir')}
        </span>
      ),
    },
  ];

  return (
    <div className="adm-split">
      <Panel
        title={t('Submission queue', 'طابور الاقتراحات', 'File de modération')}
        note={t(
          `${n(queue?.waitingTotal ?? 0, 0)} waiting · ${n(pending, 0)} pending · ${n(needsChanges, 0)} needs changes`,
          `${n(queue?.waitingTotal ?? 0, 0)} في الانتظار · ${n(pending, 0)} قيد المراجعة · ${n(needsChanges, 0)} يحتاج تعديلًا`,
          `${n(queue?.waitingTotal ?? 0, 0)} en attente · ${n(pending, 0)} à modérer · ${n(needsChanges, 0)} à modifier`,
        )}
        actions={
          <>
            <RefreshButton onClick={resource.reload} busy={resource.isRefreshing} />
            <Button size="sm" data-variant="ghost" onClick={() => navigate('/admin/places?status=needs_changes')}>
              {t('Needs-changes view', 'عرض «يحتاج تعديلًا»', 'Vue « à modifier »')}
            </Button>
          </>
        }
        flush
      >
        {resource.isStale ? <StaleNotice at={resource.updatedAt} onRetry={resource.reload} /> : null}
        <div className="adm-toolbar">
          <SearchBox
            label={t('Search the queue', 'ابحث في الطابور', 'Chercher dans la file')}
            placeholder={t('Name or area', 'الاسم أو المنطقة', 'Nom ou zone')}
            value={searchInput}
            onChange={setSearchInput}
          />
          <p className="adm-note" style={{ margin: 0, maxWidth: '32rem' }}>
            {t('Decisions hide nothing permanently: a rejected place stays in the database with your note and can be approved again.',
                'القرارات لا تحذف نهائيا: المكان المرفوض يبقى في القاعدة مع ملاحظتك ويمكن اعتماده لاحقا.',
                'Aucune suppression définitive : un lieu rejeté reste en base avec votre motif et peut être réapprouvé.')}
          </p>
        </div>
        <DataTable
          caption={t('Places awaiting a moderation decision, newest first.', 'أماكن تنتظر قرار مراجعة، الأحدث أولا.', 'Lieux en attente de décision, les plus récents d’abord.')}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowSelect={(row) => navigate(`/admin/moderation/${row.id}`)}
          activeKey={placeId}
          sort={{ key: sort, dir }}
          onSortChange={(key) => setParams({ sort: key, dir: sort === key && dir === 'desc' ? 'asc' : 'desc', page: null })}
          isLoading={resource.isLoading}
          error={resource.error ? <ErrorNotice error={resource.error} onRetry={resource.reload} /> : undefined}
          empty={
            <div className="adm-empty">
              <h3>{t('Nothing is waiting', 'لا شيء في الانتظار', 'Rien en attente')}</h3>
              <p>{resource.error
                ? t('The queue could not be read.', 'تعذر قراءة الطابور.', 'File illisible.')
                : t('Every submitted place has a decision recorded. New submissions from the traveller app appear here immediately.',
                    'كل مقترح له قرار مسجل. الاقتراحات الجديدة من تطبيق المسافرين تظهر هنا مباشرة.',
                    'Chaque proposition a une décision. Les nouvelles soumissions apparaissent ici directement.')}</p>
            </div>
          }
        />
        <div className="adm-pager">
          <Pagination
            page={queue?.page ?? page}
            pageCount={queue?.pageCount ?? 1}
            total={queue?.total ?? 0}
            pageSize={queue?.pageSize ?? pageSize}
            onPage={(next) => setParams({ page: String(next) })}
            onPageSize={(next) => setParams({ pageSize: String(next), page: null })}
          />
        </div>
      </Panel>

      {placeId ? (
        <PlaceInspector
          placeId={placeId}
          onClose={() => {
            const firstRow = document.querySelector<HTMLElement>('[data-adm-row="0"]');
            navigate(`/admin/moderation${params.toString() ? `?${params}` : ''}`);
            window.setTimeout(() => firstRow?.focus(), 40);
          }}
          onOpenPlace={(next) => navigate(`/admin/moderation/${next}`)}
        />
      ) : null}
    </div>
  );
}

function truncate(value: string, max: number) {
  const single = value.replace(/\s+/g, ' ').trim();
  return single.length > max ? `${single.slice(0, max)}…` : single;
}

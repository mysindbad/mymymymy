// Places management: the operational heart of this console. Everything is paginated and
// filtered in the database (`limit`/`offset` plus exact head counts), so a catalogue of
// thousands is browsable without shipping rows to the browser that nobody asked for.
import { useEffect, useMemo, useState } from 'react';
import { useAdminLocale } from '../locale-context';
import { adminUrl, useAdminResource, useDebouncedValue } from '../useAdminData';
import { useAdminRouter } from '../router';
import { Button, DataTable, ErrorNotice, Pagination, Panel, Pill, RefreshButton, SearchBox, Segmented, Select, StaleNotice, TextInput, type Column } from '../ui';
import { PlaceInspector, displayName, moderationLabel } from '../PlaceInspector';
import type { Page, PlaceRow } from '../types';

const CATEGORIES = ['', 'accommodation', 'tourist_poi', 'restaurant', 'emergency', 'campsite', 'service'];
const SOURCES = ['', 'initial_seed', 'community_traveler', 'business_owner'];
const STATUSES = ['', 'pending', 'approved', 'needs_changes', 'rejected'];

export default function PlacesModule({ placeId }: { placeId: string | null }) {
  const { t, n, date, relative, language } = useAdminLocale();
  const { params, setParams, navigate } = useAdminRouter();

  const status = oneOf(params.get('status'), STATUSES);
  const category = oneOf(params.get('category'), CATEGORIES);
  const source = oneOf(params.get('source'), SOURCES);
  const region = (params.get('region') ?? '').slice(0, 80);
  const gem = params.get('gem') === 'true';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const pageSize = [25, 50, 100].includes(Number(params.get('pageSize'))) ? Number(params.get('pageSize')) : 25;
  const sort = params.get('sort') ?? 'created_at';
  const dir = params.get('dir') === 'asc' ? 'asc' : 'desc';
  const rawQuery = params.get('q') ?? '';

  const [searchInput, setSearchInput] = useState(rawQuery);
  const [regionInput, setRegionInput] = useState(region);
  const debouncedSearch = useDebouncedValue(searchInput.trim());
  const debouncedRegion = useDebouncedValue(regionInput.trim(), 400);

  useEffect(() => { setSearchInput(rawQuery); }, [rawQuery]);
  useEffect(() => { setRegionInput(region); }, [region]);

  useEffect(() => {
    if (debouncedSearch === rawQuery) return;
    setParams({ q: debouncedSearch || null, page: null }, { replace: true });
    // The URL is the source of truth; this only mirrors a settled keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    if (debouncedRegion === region) return;
    setParams({ region: debouncedRegion || null, page: null }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedRegion]);

  const query = useMemo(() => ({
    q: rawQuery || undefined,
    status: status || undefined,
    category: category || undefined,
    source: source || undefined,
    region: region || undefined,
    gem: gem ? 'true' : undefined,
    page,
    pageSize,
    sort,
    dir,
  }), [rawQuery, status, category, source, region, gem, page, pageSize, sort, dir]);

  const resource = useAdminResource<Page<PlaceRow>>(adminUrl('/api/admin/places', query));
  const rows = resource.data?.rows ?? [];
  const total = resource.data?.total ?? 0;
  const pageCount = resource.data?.pageCount ?? 1;
  const activeFilters = [status, category, source, region, gem ? 'gems' : '', rawQuery].filter(Boolean).length;

  const columns = useMemo<Array<Column<PlaceRow>>>(() => [
    {
      id: 'name',
      label: t('Place', 'المكان', 'Lieu'),
      sortKey: 'name',
      width: '22rem',
      render: (row) => (
        <span>
          {displayName(row, t, language)}
          <span className="adm-cell-sub">{[row.area, row.region].filter(Boolean).join(' · ') || t('no locality', 'بدون منطقة', 'sans localité')}</span>
        </span>
      ),
    },
    {
      id: 'category',
      label: t('Category', 'الفئة', 'Catégorie'),
      width: '11rem',
      render: (row) => (
        <span>
          {row.category ? row.category.replace('_', ' ') : t('uncategorised', 'بدون فئة', 'sans catégorie')}
          {row.subCategory ? <span className="adm-cell-sub">{row.subCategory}</span> : null}
        </span>
      ),
    },
    {
      id: 'moderation',
      label: t('Moderation', 'المراجعة', 'Modération'),
      sortKey: 'moderated_at',
      width: '11rem',
      render: (row) => (
        <span>
          <Pill state={row.moderation.status === 'approved' ? 'ok' : row.moderation.status === 'pending' ? 'warn' : row.moderation.status === 'needs_changes' ? 'bad' : 'neutral'}>
            {moderationLabel(row.moderation.status, t)}
          </Pill>
          {row.moderation.moderatedAt ? <span className="adm-cell-sub">{relative(row.moderation.moderatedAt)}</span> : null}
        </span>
      ),
    },
    {
      id: 'rating',
      label: t('Rating', 'التقييم', 'Note'),
      sortKey: 'rating',
      align: 'end',
      width: '8rem',
      render: (row) => row.rating.value === null
        ? <span className="adm-note">{t('unrated', 'بدون تقييم', 'non noté')}</span>
        : <span className="adm-num">{n(row.rating.value, 2)}<span className="adm-cell-sub">{n(row.rating.reviewCount, 0)} {t('reviews', 'تقييم', 'avis')}</span></span>,
    },
    {
      id: 'origin',
      label: t('Origin', 'المصدر', 'Origine'),
      width: '10rem',
      render: (row) => (
        <span>
          {row.seed.isSeed ? <Pill state="neutral">{t('seed', 'بذرة', 'seed')}</Pill> : <Pill state="neutral">{row.source.replace('_', ' ')}</Pill>}
          <span className="adm-cell-sub">{row.trustLevel}{row.isUnderDocumentedGem ? ` · ${t('under-documented', 'غير موثّق', 'peu documenté')}` : ''}</span>
        </span>
      ),
    },
    {
      id: 'checkins',
      label: t('Check-ins', 'زيارات', 'Check-ins'),
      sortKey: 'check_ins_count',
      align: 'end',
      width: '6rem',
      render: (row) => <span className="adm-num">{n(row.checkInsCount, 0)}</span>,
    },
    {
      id: 'updated',
      label: t('Updated', 'آخر تحديث', 'Mis à jour'),
      sortKey: 'updated_at',
      width: '9rem',
      render: (row) => <span className="adm-num" title={date(row.updatedAt)}>{row.updatedAt ? relative(row.updatedAt) : '—'}</span>,
    },
    {
      id: 'created',
      label: t('Created', 'أُنشئ', 'Créé'),
      sortKey: 'created_at',
      width: '9rem',
      render: (row) => <span className="adm-num" title={date(row.createdAt)}>{date(row.createdAt)}</span>,
    },
  ], [t, n, date, relative]);

  const changeSort = (key: string) => {
    setParams({ sort: key, dir: sort === key && dir === 'desc' ? 'asc' : 'desc', page: null });
  };

  const closeInspector = () => {
    const row = document.querySelector<HTMLElement>(`[data-adm-row]`);
    navigate(`/admin/places${params.toString() ? `?${params}` : ''}`);
    window.setTimeout(() => row?.focus(), 40);
  };

  return (
    <div className="adm-split">
      <Panel
        title={t('Places', 'الأماكن', 'Lieux')}
        note={resource.isLoading && !resource.data
          ? t('loading…', 'جارٍ التحميل…', 'chargement…')
          : t(`${n(total, 0)} matching rows`, `${n(total, 0)} صفا مطابقًا`, `${n(total, 0)} lignes correspondantes`)}
        actions={
          <>
            <RefreshButton onClick={resource.reload} busy={resource.isRefreshing} />
            <Button
              size="sm"
              data-variant="ghost"
              onClick={() => setParams({ q: null, status: null, category: null, source: null, region: null, gem: null, page: null })}
              disabled={activeFilters === 0}
            >
              {t(`Clear filters${activeFilters ? ` (${activeFilters})` : ''}`, activeFilters ? `مسح المرشحات (${activeFilters})` : 'مسح المرشحات', activeFilters ? `Effacer les filtres (${activeFilters})` : 'Effacer les filtres')}
            </Button>
          </>
        }
        flush
      >
        {resource.isStale ? <StaleNotice at={resource.updatedAt} onRetry={resource.reload} /> : null}
        <div className="adm-toolbar">
          <SearchBox
            label={t('Search places', 'البحث في الأماكن', 'Rechercher un lieu')}
            placeholder={t('Name, area, description', 'الاسم، المنطقة، الوصف', 'Nom, zone, description')}
            value={searchInput}
            onChange={setSearchInput}
          />
          <Select
            label={t('Moderation', 'المراجعة', 'Modération')}
            value={status}
            onChange={(event) => setParams({ status: event.target.value || null, page: null })}
            options={STATUSES.map((value) => ({ value, label: value ? moderationLabel(value, t) : t('all states', 'كل الحالات', 'tous états') }))}
          />
          <Select
            label={t('Category', 'الفئة', 'Catégorie')}
            value={category}
            onChange={(event) => setParams({ category: event.target.value || null, page: null })}
            options={CATEGORIES.map((value) => ({ value, label: value ? value.replace('_', ' ') : t('all categories', 'كل الفئات', 'toutes catégories') }))}
          />
          <Select
            label={t('Origin', 'المصدر', 'Origine')}
            value={source}
            onChange={(event) => setParams({ source: event.target.value || null, page: null })}
            options={SOURCES.map((value) => ({ value, label: value ? sourceLabel(value, t) : t('all origins', 'كل المصادر', 'toutes origines') }))}
          />
          <TextInput
            label={t('Region', 'الجهة', 'Région')}
            value={regionInput}
            onChange={(event) => setRegionInput(event.target.value)}
            className="adm-search"
            placeholder={t('exact-ish match', 'مطابقة تقريبية', 'approximatif')}
          />
          <Segmented
            label={t('Under-documented filter', 'مرشّح غير الموثّقة', 'Filtre peu documentes')}
            value={gem ? 'gems' : 'all'}
            onChange={(next) => setParams({ gem: next === 'gems' ? 'true' : null, page: null })}
            options={[
              { value: 'all', label: t('All places', 'كل الأماكن', 'Tous les lieux') },
              { value: 'gems', label: t('Under-documented', 'غير موثّقة', 'Peu documentés') },
            ]}
          />
        </div>

        <DataTable
          caption={t('Places in public.places, filtered and sorted by the server. Select a row to open the inspector.', 'أماكن من public.places، تُرشَّح وتُرتَّب في الخادم. اختر صفا لفتح لوحة التفاصيل.', 'Lieux de public.places, filtrés et triés côté serveur. Sélectionnez une ligne pour ouvrir l’inspecteur.')}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowSelect={(row) => navigate(`/admin/places/${row.id}`)}
          activeKey={placeId}
          sort={{ key: sort, dir }}
          onSortChange={changeSort}
          isLoading={resource.isLoading}
          error={resource.error ? <ErrorNotice error={resource.error} onRetry={resource.reload} /> : undefined}
          empty={
            activeFilters > 0
              ? <div className="adm-empty">
                  <h3>{t('No place matches these filters', 'لا مكان يطابق هذه المرشحات', 'Aucun lieu ne correspond à ces filtres')}</h3>
                  <p>{t('The database answered with zero rows. Clear a filter or search a different spelling.', 'قاعدة البيانات أجابت بصفر صفوف. امسح مرشحا أو ابحث بصيغة أخرى.', 'La base a répondu zéro ligne. Effacez un filtre ou changez d’orthographe.')}</p>
                  <Button size="sm" onClick={() => setParams({ q: null, status: null, category: null, source: null, region: null, gem: null, page: null })}>{t('Clear filters', 'مسح المرشحات', 'Effacer les filtres')}</Button>
                </div>
              : <div className="adm-empty">
                  <h3>{t('The catalogue is empty on this deployment', 'الكتالوج فارغ على هذا النشر', 'Le catalogue est vide sur ce déploiement')}</h3>
                  <p>{t('Nothing was hidden by a filter — there are no rows in places at all.', 'لم يُخفِ أيُّ مرشّح شيئا — لا توجد صفوف في جدول الأماكن أصلا.', 'Aucun filtre n’a rien masqué — la table est vide.')}</p>
                </div>
          }
        />
        <div className="adm-pager">
          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            pageSize={pageSize}
            onPage={(next) => setParams({ page: String(next) })}
            onPageSize={(next) => setParams({ pageSize: String(next), page: null })}
          />
        </div>
      </Panel>

      {placeId ? (
        <PlaceInspector
          placeId={placeId}
          onClose={closeInspector}
          onOpenPlace={(next) => navigate(`/admin/places/${next}`)}
        />
      ) : null}
    </div>
  );
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | '' {
  return allowed.includes((value ?? '') as T) ? ((value ?? '') as T) : '';
}


function sourceLabel(source: string, t: (en: string, ar: string, fr: string) => string): string {
  if (source === 'initial_seed') return t('initial seed', 'بذرة أولية', 'seed initial');
  if (source === 'community_traveler') return t('traveller submission', 'اقتراح مسافر', 'contribution voyageur');
  if (source === 'business_owner') return t('business owner', 'صاحب نشاط', 'propriétaire');
  return source;
}

// Review moderation. Approving or withdrawing a review only changes `reviews.moderation_status`;
// the place aggregate is recomputed by the database trigger, which counts real (non-seed)
// approved reviews only. The panel shows the recomputed aggregate so the effect is visible
// instead of assumed.
import { useEffect, useState } from 'react';
import { useAdminLocale } from '../locale-context';
import { adminUrl, useAdminAction, useAdminResource, useDebouncedValue } from '../useAdminData';
import { useAdminRouter } from '../router';
import { Button, DataTable, DefinitionList, ErrorNotice, Pagination, Panel, Pill, RefreshButton, SearchBox, SectionTitle, Select, StaleNotice, Textarea, type Column } from '../ui';
import { describeAdminError } from '../api';
import { pushAdminToast } from '../toast';
import type { Page, ReviewRow } from '../types';

type ReviewPage = Page<ReviewRow>;

export default function ReviewsModule() {
  const { t, n, date, relative } = useAdminLocale();
  const { params, setParams } = useAdminRouter();
  const status = params.get('status') && ['approved', 'pending', 'rejected'].includes(params.get('status') as string) ? (params.get('status') as string) : '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const pageSize = [25, 50, 100].includes(Number(params.get('pageSize'))) ? Number(params.get('pageSize')) : 25;
  const sort = ['date', 'updated_at', 'rating', 'moderated_at'].includes(params.get('sort') ?? '') ? (params.get('sort') as string) : 'date';
  const dir = params.get('dir') === 'asc' ? 'asc' : 'desc';
  const rawQuery = params.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(rawQuery);
  const debounced = useDebouncedValue(searchInput.trim());
  const [selected, setSelected] = useState<ReviewRow | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => { setSearchInput(rawQuery); }, [rawQuery]);
  useEffect(() => {
    if (debounced === rawQuery) return;
    setParams({ q: debounced || null, page: null }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  useEffect(() => { setReason(''); }, [selected?.id]);

  const resource = useAdminResource<ReviewPage>(adminUrl('/api/admin/reviews', {
    q: rawQuery || undefined,
    status: status || undefined,
    page,
    pageSize,
    sort,
    dir,
  }));
  const rows = resource.data?.rows ?? [];

  const moderate = useAdminAction<{ moderation: { moderationStatus: string; placeRating: number | null; placeReviewCount: number } | null }>(
    // The path follows the current selection; `decide` refuses to run without one.
    adminUrl(`/api/admin/reviews/${selected?.id ?? 'unselected'}/moderation`),
    { invalidate: ['/api/admin/reviews', '/api/admin/overview', '/api/admin/audit-events', '/api/admin/places'] },
  );

  const decide = async (next: 'approved' | 'rejected' | 'pending') => {
    if (!selected) return;
    const result = await moderate.run({ status: next, ...(reason.trim() ? { reason: reason.trim() } : {}) });
    if (result) {
      const aggregate = result.moderation;
      pushAdminToast({
        tone: next === 'rejected' ? 'neutral' : 'ok',
        title: t('Review state recorded', 'سُجّلت حالة التقييم', 'État de l’avis enregistré'),
        message: aggregate
          ? t(
            `Place aggregate is now ${aggregate.placeRating === null ? 'unrated' : `${aggregate.placeRating.toFixed(2)} from ${aggregate.placeReviewCount} review(s)`}`,
            `أصبحت قاعدة المكان ${aggregate.placeRating === null ? 'بدون تقييم' : `${aggregate.placeRating.toFixed(2)} من ${aggregate.placeReviewCount} تقييما`}`,
            `Note du lieu : ${aggregate.placeRating === null ? 'non noté' : `${aggregate.placeRating.toFixed(2)} sur ${aggregate.placeReviewCount} avis`}`,
          )
          : undefined,
      });
      setReason('');
      setSelected(null);
      resource.reload();
    }
  };

  const columns: Array<Column<ReviewRow>> = [
    {
      id: 'author',
      label: t('Author', 'الكاتب', 'Auteur'),
      width: '12rem',
      render: (row) => (
        <span>
          {row.authorName || t('unnamed', 'بدون اسم', 'sans nom')}
          <span className="adm-cell-sub">{row.authorRole.replace(/_/g, ' ')}{row.isSeed ? ` · ${t('seed', 'بذرة', 'seed')}` : ''}</span>
        </span>
      ),
    },
    {
      id: 'place',
      label: t('Place', 'المكان', 'Lieu'),
      width: '16rem',
      render: (row) => (
        <span>
          {row.placeName ?? t('place removed from catalogue', 'حُذف المكان من الكتالوج', 'lieu retiré du catalogue')}
          {row.placeArea ? <span className="adm-cell-sub">{row.placeArea}</span> : null}
        </span>
      ),
    },
    {
      id: 'rating',
      label: t('Score', 'الدرجة', 'Note'),
      align: 'end',
      sortKey: 'rating',
      width: '5.5rem',
      render: (row) => <span className="adm-num">{n(row.rating, 0)} / 5</span>,
    },
    {
      id: 'text',
      label: t('Text', 'النص', 'Texte'),
      render: (row) => (
        <span style={{ display: 'block', maxInlineSize: '30rem' }}>
          {row.text ? row.text.replace(/\s+/g, ' ').slice(0, 200) : <span className="adm-note">{t('(no text)', '(بدون نص)', '(sans texte)')}</span>}
          {row.tags.length ? <span className="adm-cell-sub">{row.tags.join(' · ')}</span> : null}
        </span>
      ),
    },
    {
      id: 'state',
      label: t('Moderation', 'المراجعة', 'Modération'),
      sortKey: 'moderated_at',
      width: '11rem',
      render: (row) => (
        <span>
          <Pill state={row.moderation.status === 'approved' ? 'ok' : row.moderation.status === 'pending' ? 'warn' : 'neutral'}>
            {row.moderation.status.replace('_', ' ')}
          </Pill>
          {row.moderation.moderatedAt ? <span className="adm-cell-sub">{relative(row.moderation.moderatedAt)}</span> : null}
        </span>
      ),
    },
    {
      id: 'date',
      label: t('Written', 'كُتب', 'Écrit le'),
      sortKey: 'date',
      width: '9rem',
      render: (row) => <span className="adm-num" title={date(row.createdAt)}>{date(row.createdAt)}</span>,
    },
  ];

  return (
    <div className="adm-split">
      <Panel
        title={t('Reviews', 'التقييمات', 'Avis')}
        note={resource.data ? t(`${n(resource.data.total, 0)} rows match`, `${n(resource.data.total, 0)} صفا مطابقًا`, `${n(resource.data.total, 0)} lignes correspondent`) : t('reading…', 'جارٍ القراءة…', 'lecture…')}
        actions={
          <>
            <RefreshButton onClick={resource.reload} busy={resource.isRefreshing} />
            <Select
              label=""
              className=""
              aria-label={t('Filter by moderation state', 'ترشيح بحالة المراجعة', 'Filtrer par état')}
              value={status}
              onChange={(event) => setParams({ status: event.target.value || null, page: null })}
              options={[
                { value: '', label: t('all states', 'كل الحالات', 'tous les états') },
                { value: 'pending', label: t('pending', 'قيد المراجعة', 'à modérer') },
                { value: 'approved', label: t('approved', 'معتمد', 'approuvés') },
                { value: 'rejected', label: t('withdrawn', 'مسحوب', 'retirés') },
              ]}
            />
          </>
        }
        flush
      >
        {resource.isStale ? <StaleNotice at={resource.updatedAt} onRetry={resource.reload} /> : null}
        <div className="adm-toolbar">
          <SearchBox
            label={t('Search review text and authors', 'ابحث في نصوص التقييمات وأسماء كُتابها', 'Rechercher dans les avis')}
            placeholder={t('Words from the review', 'كلمات من التقييم', 'Mots de l’avis')}
            value={searchInput}
            onChange={setSearchInput}
          />
          <p className="adm-note" style={{ margin: 0, maxWidth: '34rem' }}>
            {t('Withdrawing a review removes it from the place aggregate; it is not deleted, and seed reviews are never mixed into live ratings.',
                'سحب التقييم يُخرجه من متوسط المكان؛ لا يُحذف، وتقييمات البذرة لا تختلط بالتقييمات الحقيقية.',
                'Retirer un avis le sort de la moyenne du lieu ; il n’est pas supprimé, et les avis seed ne se mélangent jamais aux notes réelles.')}
          </p>
        </div>
        <DataTable
          caption={t('Reviews, newest first unless sorted otherwise.', 'التقييمات، الأحدث أولا ما لم تغيّر الترتيب.', 'Avis, les plus récents d’abord sauf tri différent.')}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowSelect={(row) => setSelected(row)}
          activeKey={selected?.id ?? null}
          sort={{ key: sort, dir }}
          onSortChange={(key) => setParams({ sort: key, dir: sort === key && dir === 'desc' ? 'asc' : 'desc', page: null })}
          isLoading={resource.isLoading}
          error={resource.error ? <ErrorNotice error={resource.error} onRetry={resource.reload} /> : undefined}
          empty={<Empty />}
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
        <aside className="adm-inspector" aria-label={t('Review inspector', 'لوحة التقييم', 'Inspecteur de l’avis')}>
          <div className="adm-inspector-head">
            <div style={{ minWidth: 0 }}>
              <h2>{t('Review', 'تقييم', 'Avis')}</h2>
              <p className="adm-note" style={{ margin: '0.125rem 0 0' }}>
                {selected.placeName ?? t('unknown place', 'مكان غير معروف', 'lieu inconnu')} · {date(selected.createdAt)}
              </p>
            </div>
            <Button size="sm" data-variant="ghost" onClick={() => setSelected(null)} style={{ marginInlineStart: 'auto', flex: 'none' }}>
              {t('Close', 'إغلاق', 'Fermer')}
            </Button>
          </div>

          <Pill state={selected.moderation.status === 'approved' ? 'ok' : selected.moderation.status === 'pending' ? 'warn' : 'neutral'}>
            {selected.moderation.status.replace('_', ' ')}
          </Pill>

          <div className="adm-evidence">
            <strong style={{ fontSize: '0.8125rem' }}>{n(selected.rating, 0)} / 5</strong>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{selected.text || t('(this reviewer wrote no text)', '(لم يكتب هذا المسافر نصا)', '(aucun texte)')}</p>
            {selected.tags.length ? <span className="adm-note">{selected.tags.join(' · ')}</span> : null}
            {selected.photos.length ? <span className="adm-note">{t(`${n(selected.photos.length, 0)} photo(s) attached`, `${n(selected.photos.length, 0)} صورة مرفقة`, `${n(selected.photos.length, 0)} photo(s) jointe(s)`)}</span> : null}
            {selected.suppressedPhotoCount > 0 ? <span className="adm-note">{t(`${selected.suppressedPhotoCount} photo URL(s) are not https and were not rendered.`, `${selected.suppressedPhotoCount} رابط صورة ليس https ولم يُعرض.`, `${selected.suppressedPhotoCount} URL(s) non https non affichées.`)}</span> : null}
          </div>

          <DefinitionList
            items={[
              { label: t('Author', 'الكاتب', 'Auteur'), value: selected.authorName || t('unnamed', 'بدون اسم', 'sans nom') },
              { label: t('Role', 'الصفة', 'Rôle'), value: selected.authorRole.replace(/_/g, ' ') },
              { label: t('Provenance', 'المصدر', 'Provenance'), value: selected.isSeed ? t('seed data — excluded from live aggregates', 'بيانات بذرة — مستثناة من المتوسطات', 'seed — exclu des agrégats') : t('written by a real account or visitor', 'كُتب من حساب حقيقي أو زائر', 'écrit par un compte ou visiteur') },
              { label: t('Updated', 'آخر تعديل', 'Mis à jour'), value: selected.updatedAt ? `${date(selected.updatedAt)} · ${relative(selected.updatedAt)}` : '—' },
              { label: t('Moderator note', 'ملاحظة المراجع', 'Note du modérateur'), value: selected.moderation.note ?? '—' },
              { label: t('Identifier', 'المعرّف', 'Identifiant'), value: <span className="adm-mono" style={{ fontSize: '0.6875rem' }}>{selected.id}</span> },
            ]}
          />

          <div>
            <SectionTitle>{t('Moderate', 'المراجعة', 'Modérer')}</SectionTitle>
            <Textarea
              label={t('Reason (recorded in the audit log)', 'السبب (يُسجَّل في سجل التدقيق)', 'Motif (journalisé)')}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              maxLength={500}
            />
            <div className="adm-actions">
              <Button size="sm" data-variant="primary" disabled={moderate.isPending || selected.moderation.status === 'approved'} onClick={() => void decide('approved')}>
                {t('Approve', 'اعتماد', 'Approuver')}
              </Button>
              <Button size="sm" onClick={() => void decide('pending')} disabled={moderate.isPending}>
                {t('Send back to queue', 'إعادة إلى الطابور', 'Renvoyer dans la file')}
              </Button>
              <Button size="sm" data-variant="danger" disabled={moderate.isPending || selected.moderation.status === 'rejected'} onClick={() => void decide('rejected')}>
                {t('Withdraw from aggregate', 'سحب من المتوسط', 'Retirer de la moyenne')}
              </Button>
            </div>
            {moderate.isPending ? <span className="adm-hint">{t('Writing the decision…', 'جارٍ كتابة القرار…', 'Écriture de la décision…')}</span> : null}
            {moderate.error ? <span className="adm-error-text" role="alert">{describeAdminError(moderate.error)}</span> : null}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function Empty() {
  const { t } = useAdminLocale();
  return (
    <div className="adm-empty">
      <h3>{t('No reviews match this view', 'لا تقييمات تطابق هذا العرض', 'Aucun avis ne correspond')}</h3>
      <p>{t('Real reviews appear here as soon as travellers write them in the app.', 'تظهر التقييمات الحقيقية هنا فور كتابة المسافرين لها في التطبيق.', 'Les avis réels apparaissent dès qu’ils sont écrits dans l’app.')}</p>
    </div>
  );
}

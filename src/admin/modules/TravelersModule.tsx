// Traveller accounts, at the width an operator actually needs. The API returns no email, no
// auth metadata, no stored coordinates and nothing from trips - those columns exist in the
// database, and this screen deliberately does not read them (see toAdminTravelerRow).
import { useEffect, useState } from 'react';
import { useAdminLocale } from '../locale-context';
import { adminUrl, useAdminResource, useDebouncedValue } from '../useAdminData';
import { useAdminRouter } from '../router';
import { Button, DataTable, DefinitionList, ErrorNotice, Pagination, Panel, Pill, RefreshButton, SearchBox, SectionTitle, type Column } from '../ui';
import type { Page, TravelerDetailResponse, TravelerRow } from '../types';

export default function TravelersModule({ userId }: { userId: string | null }) {
  const { t, n, date, relative } = useAdminLocale();
  const { params, setParams, navigate } = useAdminRouter();
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const pageSize = [25, 50, 100].includes(Number(params.get('pageSize'))) ? Number(params.get('pageSize')) : 25;
  const sort = ['created_at', 'display_name', 'updated_at'].includes(params.get('sort') ?? '') ? (params.get('sort') as string) : 'created_at';
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

  const resource = useAdminResource<Page<TravelerRow>>(adminUrl('/api/admin/travelers', { q: rawQuery || undefined, page, pageSize, sort, dir }));
  const detail = useAdminResource<TravelerDetailResponse>(userId ? adminUrl(`/api/admin/travelers/${userId}`) : '');
  const rows = resource.data?.rows ?? [];

  const columns: Array<Column<TravelerRow>> = [
    {
      id: 'name',
      label: t('Account', 'الحساب', 'Compte'),
      sortKey: 'display_name',
      width: '16rem',
      render: (row) => (
        <span>
          {row.displayName ?? t('no display name', 'بدون اسم عرض', 'sans nom affiché')}
          <span className="adm-cell-sub adm-mono">{shortId(row.userId)}</span>
        </span>
      ),
    },
    {
      id: 'language',
      label: t('Preferred language', 'لغة مفضّلة', 'Langue préférée'),
      width: '9rem',
      render: (row) => (row.preferredLanguage
        ? <Pill state="neutral">{languageLabel(row.preferredLanguage, t)}</Pill>
        : <span className="adm-note">{t('not set', 'غير مضبوطة', 'non définie')}</span>),
    },
    {
      id: 'activity',
      label: t('Profile contents', 'محتوى الملف', 'Contenu du profil'),
      width: '16rem',
      render: (row) => (
        <span className="adm-note">
          {row.hasAvatar ? t('avatar', 'صورة رمزية', 'avatar') : t('no avatar', 'بدون صورة', 'sans avatar')}
          {` · ${row.hasLocationOnFile ? t('a location is stored', 'موقع مخزّن', 'position enregistrée') : t('no location stored', 'لا موقع مخزّن', 'aucune position')}`}
          {row.hasHomeLocationOnFile ? ` · ${t('home set', 'مسكن محدد', 'domicile défini')}` : ''}
        </span>
      ),
    },
    {
      id: 'role',
      label: t('Console access', 'الوصول للوحة', 'Accès console'),
      width: '10rem',
      render: (row) => (row.adminRole
        ? <Pill state="ok">{row.adminRole.replace('_', ' ')}</Pill>
        : <span className="adm-note">{t('traveller only', 'مسافر فقط', 'voyageur uniquement')}</span>),
    },
    {
      id: 'created',
      label: t('Registered', 'تاريخ التسجيل', 'Inscription'),
      sortKey: 'created_at',
      width: '10rem',
      render: (row) => <span className="adm-num" title={date(row.createdAt)}>{row.createdAt ? relative(row.createdAt) : '—'}</span>,
    },
    {
      id: 'updated',
      label: t('Last profile change', 'آخر تعديل للملف', 'Dernière modification'),
      sortKey: 'updated_at',
      width: '10rem',
      render: (row) => <span className="adm-num">{row.updatedAt ? relative(row.updatedAt) : '—'}</span>,
    },
  ];

  return (
    <div className="adm-split">
      <Panel
        title={t('Travellers', 'المسافرون', 'Voyageurs')}
        note={resource.data ? t(`${n(resource.data.total, 0)} profiles in user_profiles`, `${n(resource.data.total, 0)} ملفا في user_profiles`, `${n(resource.data.total, 0)} profils dans user_profiles`) : t('reading…', 'جارٍ القراءة…', 'lecture…')}
        actions={<RefreshButton onClick={resource.reload} busy={resource.isRefreshing} />}
        flush
      >
        <div className="adm-toolbar">
          <SearchBox
            label={t('Search display names', 'ابحث في أسماء العرض', 'Rechercher un nom affiché')}
            placeholder={t('Display name', 'اسم العرض', 'Nom affiché')}
            value={searchInput}
            onChange={setSearchInput}
          />
          <p className="adm-note" style={{ margin: 0, maxWidth: '34rem' }}>
            {t('Emails, passwords, tokens and trip contents are not part of this view; the admin API does not read those columns.',
                'البريد وكلمات المرور والرموز ومحتوى الرحلات ليست جزءا من هذه الشاشة؛ واجهة المشرفين لا تقرأ هذه الأعمدة أصلا.',
                'E-mails, mots de passe, jetons et contenu des voyages ne font pas partie de cette vue ; l’API admin ne lit pas ces colonnes.')}
          </p>
        </div>
        <DataTable
          caption={t('Traveller profiles with their metadata. Select a row for the record.', 'ملفات المسافرين مع بياناتها الوصفية. اختر صفا لعرض السجل.', 'Profils voyageurs. Sélectionnez une ligne pour la fiche.')}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.userId}
          onRowSelect={(row) => navigate(`/admin/travelers/${row.userId}`)}
          activeKey={userId}
          sort={{ key: sort, dir }}
          onSortChange={(key) => setParams({ sort: key, dir: sort === key && dir === 'desc' ? 'asc' : 'desc', page: null })}
          isLoading={resource.isLoading}
          error={resource.error ? <ErrorNotice error={resource.error} onRetry={resource.reload} /> : undefined}
          empty={
            <div className="adm-empty">
              <h3>{t('No profile matches that name', 'لا ملف يطابق هذا الاسم', 'Aucun profil ne correspond')}</h3>
              <p>{t('Profiles are created automatically when somebody signs in for the first time.', 'تُنشأ الملفات تلقائيا عند أول تسجيل دخول.', 'Les profils sont créés à la première connexion.')}</p>
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

      {userId ? (
        <aside className="adm-inspector" aria-label={t('Traveller record', 'سجل المسافر', 'Fiche voyageur')}>
          <div className="adm-inspector-head">
            <div style={{ minWidth: 0 }}>
              <h2>{detail.data?.traveler.profile?.displayName ?? t('Traveller', 'مسافر', 'Voyageur')}</h2>
              <p className="adm-note" style={{ margin: '0.125rem 0 0' }}>{shortId(userId)}</p>
            </div>
            <Button size="sm" data-variant="ghost" style={{ marginInlineStart: 'auto', flex: 'none' }} onClick={() => navigate(`/admin/travelers${params.toString() ? `?${params}` : ''}`)}>
              {t('Close', 'إغلاق', 'Fermer')}
            </Button>
          </div>
          {detail.isLoading && !detail.data ? <p className="adm-note">{t('Reading…', 'جارٍ القراءة…', 'Lecture…')}</p> : null}
          {detail.error ? <ErrorNotice error={detail.error} onRetry={detail.reload} /> : null}
          {detail.data ? (
            <>
              <DefinitionList
                items={[
                  { label: t('Preferred language', 'اللغة المفضّلة', 'Langue préférée'), value: languageLabel(detail.data.traveler.profile?.preferredLanguage ?? '', t) },
                  { label: t('Registered', 'تاريخ التسجيل', 'Inscription'), value: date(detail.data.traveler.profile?.createdAt) },
                  { label: t('Last change', 'آخر تغيير', 'Dernier changement'), value: detail.data.traveler.profile?.updatedAt ? relative(detail.data.traveler.profile.updatedAt) : '—' },
                  { label: t('Avatar', 'الصورة الرمزية', 'Avatar'), value: detail.data.traveler.profile?.hasAvatar ? t('set', 'مضبوطة', 'défini') : t('none', 'لا شيء', 'aucun') },
                  {
                    label: t('Location', 'الموقع', 'Position'),
                    value: detail.data.traveler.profile?.hasLocationOnFile
                      ? t('a location is stored for trip features. It is not displayed here.', 'يوجد موقع مخزّن لميزات الرحلات. لا يُعرض هنا.', 'Une position est enregistrée pour les fonctions de voyage. Elle n’est pas affichée ici.')
                      : t('nothing stored', 'لا شيء مخزّن', 'rien d’enregistré'),
                  },
                  { label: t('Console role', 'صلاحية اللوحة', 'Rôle console'), value: detail.data.traveler.admin ? <Pill state="ok">{detail.data.traveler.admin.role.replace('_', ' ')}</Pill> : t('none', 'لا شيء', 'aucun') },
                  { label: t('Account id', 'معرّف الحساب', 'Identifiant'), value: <span className="adm-mono" style={{ fontSize: '0.6875rem' }}>{userId}</span> },
                ]}
              />
              <div>
                <SectionTitle>{t('Activity on the platform', 'نشاطه على المنصة', 'Activité sur la plateforme')}</SectionTitle>
                <DefinitionList
                  items={[
                    { label: t('Places submitted', 'أماكن اقترحها', 'Lieux proposés'), value: <span className="adm-num">{n(detail.data.traveler.activity.placesSubmitted, 0)}</span> },
                    { label: t('Reviews written', 'تقييمات كتبت', 'Avis écrits'), value: <span className="adm-num">{n(detail.data.traveler.activity.reviewsWritten, 0)}</span> },
                    { label: t('Trips planned', 'رحلات خطّط لها', 'Voyages planifiés'), value: <span className="adm-num">{n(detail.data.traveler.activity.tripsCreated, 0)}</span> },
                  ]}
                />
                <p className="adm-note" style={{ margin: '0.375rem 0 0' }}>
                  {t('Counts only. Trip dates, budgets and notes stay private to the account.', 'أعداد فقط. تواريخ الرحلات وميزانياتها وملاحظاتها تبقى خاصة بالحساب.', 'Compteurs uniquement. Dates, budgets et notes restent privés.')}
                </p>
              </div>
              <div className="adm-actions">
                <Button size="sm" onClick={() => navigate(`/admin/administrators?target=${userId}`)}>
                  {t('Manage console access', 'إدارة الصلاحيات', 'Gérer les accès console')}
                </Button>
                <Button size="sm" data-variant="ghost" onClick={() => navigate(`/admin/audit?targetType=traveler&targetId=${userId}`)}>
                  {t('Audit entries for this id', 'سجل التدقيق لهذا المعرّف', 'Journal pour cet id')}
                </Button>
              </div>
            </>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}

function shortId(id: string) {
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function languageLabel(value: string, t: (en: string, ar: string, fr: string) => string) {
  if (value === 'ar') return t('Arabic', 'العربية', 'arabe');
  if (value === 'fr') return t('French', 'الفرنسية', 'français');
  if (value === 'en') return t('English', 'الإنجليزية', 'anglais');
  return value || t('not set', 'غير مضبوطة', 'non définie');
}

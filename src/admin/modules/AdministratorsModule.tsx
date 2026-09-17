// The roster. Granting and revoking are the two highest-privilege actions in this console, so
// they are the narrowest too: super_admin only (enforced again inside the database function),
// a written reason is mandatory, and the last super administrator cannot be revoked.
import { useEffect, useState } from 'react';
import { useAdminLocale } from '../locale-context';
import { adminUrl, useAdminAction, useAdminResource, useDebouncedValue } from '../useAdminData';
import { useAdminRouter } from '../router';
import { Button, ConfirmDialog, DataTable, DefinitionList, ErrorNotice, Panel, Pill, RefreshButton, SearchBox, SectionTitle, Select, TextInput, type Column } from '../ui';
import { describeAdminError } from '../api';
import { pushAdminToast } from '../toast';
import type { AdminRole, Page, RosterRow, TravelerRow } from '../types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AdministratorsModule() {
  const { t, n, date, relative } = useAdminLocale();
  const { params, setParams, navigate } = useAdminRouter();
  const roster = useAdminResource<{ rows: RosterRow[] }>(adminUrl('/api/admin/administrators'));
  const rows = roster.data?.rows ?? [];

  const [targetId, setTargetId] = useState(params.get('target') ?? '');
  const [role, setRole] = useState<AdminRole>('admin');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<RosterRow | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  useEffect(() => {
    const fromUrl = params.get('target');
    if (fromUrl) setTargetId(fromUrl);
  }, [params]);

  const grant = useAdminAction<{ grant: { userId: string; role: string } | null }>(adminUrl('/api/admin/administrators/grant'), {
    invalidate: ['/api/admin/administrators', '/api/admin/overview', '/api/admin/audit-events', '/api/admin/travelers'],
  });
  const revoke = useAdminAction<{ revoke: { userId: string; revoked: boolean } | null }>(adminUrl('/api/admin/administrators/revoke'), {
    invalidate: ['/api/admin/administrators', '/api/admin/overview', '/api/admin/audit-events', '/api/admin/travelers'],
  });

  const submitGrant = async () => {
    const id = targetId.trim();
    if (!UUID_PATTERN.test(id)) {
      setFormError(t('Paste the account id from the travellers screen (a 36-character identifier).', 'الصق معرّف الحساب من شاشة المسافرين (36 حرفا).', 'Collez l’identifiant du compte pris dans l’écran Voyageurs (36 caractères).'));
      return;
    }
    if (reason.trim().length < 4) {
      setFormError(t('A short written reason is required.', 'السبب الكتابي إلزامي ولو قصيرا.', 'Un motif écrit est obligatoire, même court.'));
      return;
    }
    setFormError(null);
    const result = await grant.run({ user_id: id, role, reason: reason.trim() });
    if (result) {
      pushAdminToast({ tone: 'ok', title: t('Access granted', 'منح الصلاحية', 'Accès accordé'), message: t(`${role} · recorded with your reason`, `${role} · سُجّل مع سببك`, `${role} · journalisé avec le motif`) });
      setReason('');
      setTargetId('');
      setParams({ target: null });
      roster.reload();
    } else if (grant.error) {
      setFormError(describeAdminError(grant.error));
    }
  };

  const submitRevoke = async () => {
    if (!confirmRevoke) return;
    if (revokeReason.trim().length < 4) {
      pushAdminToast({ tone: 'bad', title: t('A reason is required', 'السبب إلزامي', 'Un motif est requis'), message: t('The database refuses a revocation without one.', 'ترفض قاعدة البيانات سحب الصلاحية بدون سبب.', 'La base refuse une révocation sans motif.') });
      return;
    }
    const result = await revoke.run({ user_id: confirmRevoke.userId, reason: revokeReason.trim() });
    if (result) {
      pushAdminToast({ tone: 'ok', title: t('Access revoked', 'سُحبت الصلاحية', 'Accès révoqué'), message: t('The roster entry is kept with the revocation record; nothing is deleted.', 'يبقى سجل العضوية مع إثبات السحب؛ لا يُحذف شيء.', 'L’entrée reste avec sa révocation ; rien n’est supprimé.') });
      setConfirmRevoke(null);
      setRevokeReason('');
      roster.reload();
    } else if (revoke.error) {
      pushAdminToast({ tone: 'bad', title: t('The revocation was refused', 'رُفض السحب', 'Révocation refusée'), message: describeAdminError(revoke.error) });
    }
  };

  const columns: Array<Column<RosterRow>> = [
    {
      id: 'who',
      label: t('Administrator', 'المشرف', 'Administrateur'),
      width: '18rem',
      render: (row) => (
        <span>
          {row.displayName ?? t('no display name', 'بدون اسم عرض', 'sans nom affiché')}
          <button
            type="button"
            className="adm-cell-sub adm-mono"
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--adm-accent)', textDecoration: 'underline' }}
            onClick={() => navigate(`/admin/travelers/${row.userId}`)}
            title={t('Open the traveller record', 'افتح سجل المسافر', 'Ouvrir la fiche voyageur')}
          >
            {row.userId}
          </button>
        </span>
      ),
    },
    {
      id: 'role',
      label: t('Role', 'الصلاحية', 'Rôle'),
      width: '10rem',
      render: (row) => <Pill state={row.role === 'super_admin' ? 'ok' : 'neutral'}>{row.role.replace('_', ' ')}</Pill>,
    },
    { id: 'granted', label: t('Granted', 'منحها', 'Accordé'), width: '11rem', render: (row) => <span className="adm-num" title={date(row.grantedAt)}>{relative(row.grantedAt)}</span> },
    {
      id: 'by',
      label: t('Granted by', 'بموافقة', 'Par'),
      render: (row) => (row.grantedBy
        ? <span className="adm-mono" style={{ fontSize: '0.6875rem' }}>{`${row.grantedBy.slice(0, 8)}…${row.grantedBy.slice(-4)}`}</span>
        : <span className="adm-note">{t('created before this console existed', 'أُنشئ قبل وجود هذه اللوحة', 'créé avant cette console')}</span>),
    },
    {
      id: 'revoke',
      label: t('Action', 'إجراء', 'Action'),
      align: 'end',
      width: '8rem',
      render: (row) => (
        <Button size="sm" data-variant="danger" onClick={() => { setConfirmRevoke(row); setRevokeReason(''); }}>
          {t('Revoke', 'سحب', 'Révoquer')}
        </Button>
      ),
    },
  ];

  const travellerSearch = useDebouncedValue(targetId.trim(), 400);
  const lookup = useAdminResource<Page<TravelerRow>>(
    UUID_PATTERN.test(travellerSearch) ? '' : adminUrl('/api/admin/travelers', { q: travellerSearch || undefined, pageSize: 5, page: 1 }),
  );

  return (
    <div className="adm-split">
      <Panel
        title={t('Administrators roster', 'قائمة المشرفين', 'Liste des administrateurs')}
        note={roster.data ? t(`${n(rows.length, 0)} active`, `${n(rows.length, 0)} نشط`, `${n(rows.length, 0)} actifs`) : t('reading…', 'جارٍ القراءة…', 'lecture…')}
        actions={<RefreshButton onClick={roster.reload} busy={roster.isRefreshing} />}
        flush
      >
        <DataTable
          caption={t('Active rows in admin_accounts. Revoked rows stay in the table for the audit trail and are not listed here.', 'الصفوف النشطة في admin_accounts. تبقى الصفوف المسحوبة للتحقيق ولا تُعرض هنا.', 'Lignes actives de admin_accounts. Les révoquations restent en base pour l’audit et ne sont pas listées.')}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.userId}
          isLoading={roster.isLoading}
          error={roster.error ? <ErrorNotice error={roster.error} onRetry={roster.reload} /> : undefined}
          empty={
            <div className="adm-empty">
              <h3>{t('The roster is empty', 'القائمة فارغة', 'La liste est vide')}</h3>
              <p>{t('A migration cannot seed an administrator safely: grant the first account from a super-administrator session, or insert the row directly in the database.',
                  'لا يمكن للهجرة إنشاء مشرف أول بأمان: امنح الحساب الأول من جلسة مشرف أعلى، أو أدرج الصف مباشرة في قاعدة البيانات.',
                  'Une migration ne peut pas créer un premier administrateur en toute sécurité : accordez le premier compte depuis une session super-administrateur, ou insérez la ligne directement en base.')}</p>
            </div>
          }
        />
      </Panel>

      <aside className="adm-inspector" aria-label={t('Grant console access', 'منح صلاحية', 'Accorder un accès console')}>
        <SectionTitle>{t('Grant console access', 'منح صلاحية اللوحة', 'Accorder un accès')}</SectionTitle>
        <p className="adm-note" style={{ margin: 0 }}>
          {t('Only a super administrator can add or remove people here. The database function repeats that check, so a compromised browser cannot self-promote.',
              'المشرف الأعلى فقط يمكنه إضافة أو سحب الأشخاص هنا. وتُعيد دالة قاعدة البيانات التحقق نفسه، لذا لا يستطيع متصفح مخترق ترقية نفسه.',
              'Seul un super-administrateur peut ajouter ou retirer quelqu’ici. La fonction SQL répète ce contrôle : un navigateur compromis ne peut pas se promouvoir.')}
        </p>
        <TextInput
          label={t('Account id (from the travellers screen)', 'معرّف الحساب (من شاشة المسافرين)', 'Identifiant du compte (écran Voyageurs)')}
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
          placeholder="0f3c…"
          spellCheck={false}
          inputRef={undefined}
          error={formError && !UUID_PATTERN.test(targetId.trim()) ? formError : null}
          hint={UUID_PATTERN.test(targetId.trim()) ? t('looks like a valid identifier', 'يبدو معرّفا صالحا', 'identifiant plausible') : t('paste a full uuid to continue', 'الصق معرّفا كاملا للمتابعة', 'collez un uuid complet pour continuer')}
        />
        {!UUID_PATTERN.test(travellerSearch) && travellerSearch.length > 1 && !lookup.isLoading ? (
          <div className="adm-evidence">
            <span className="adm-note">{t('Not a uuid yet. Search results for this text:', 'ليس معرّفا بعد. نتائج البحث عن هذه الكلمة:', 'Pas encore un uuid. Résultats pour ce texte :')}</span>
            {(lookup.data?.rows ?? []).slice(0, 4).map((row) => (
              <button
                key={row.userId}
                type="button"
                onClick={() => setTargetId(row.userId)}
                style={{ background: 'none', border: 0, padding: 0, textAlign: 'start', cursor: 'pointer', font: 'inherit', color: 'var(--adm-accent)' }}
              >
                {row.displayName ?? t('unnamed', 'بدون اسم', 'sans nom')} · <span className="adm-mono" style={{ fontSize: '0.625rem' }}>{row.userId}</span>
              </button>
            ))}
            {(lookup.data?.rows.length ?? 0) === 0 && !lookup.error ? <span className="adm-note">{t('Nothing matched that name.', 'لم يطابقه أي اسم.', 'Aucun résultat.')}</span> : null}
            {lookup.error ? <ErrorNotice error={lookup.error} onRetry={lookup.reload} /> : null}
          </div>
        ) : null}
        <Select
          label={t('Role', 'الصلاحية', 'Rôle')}
          value={role}
          onChange={(event) => setRole(event.target.value as AdminRole)}
          options={[
            { value: 'admin', label: t('admin — moderate content', 'admin — مراجعة المحتوى', 'admin — modération') },
            { value: 'super_admin', label: t('super_admin — also manages the roster', 'super_admin — يدير القائمة أيضا', 'super_admin — gère aussi la liste') },
          ]}
        />
        <TextInput
          label={t('Reason (stored in the audit log)', 'السبب (يُحفظ في سجل التدقيق)', 'Motif (journalisé)')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
        />
        <div className="adm-actions">
          <Button data-variant="primary" size="sm" onClick={() => void submitGrant()} disabled={grant.isPending}>
            {grant.isPending ? t('Writing…', 'جارٍ الكتابة…', 'Écriture…') : t('Grant access', 'منح الصلاحية', 'Accorder l’accès')}
          </Button>
        </div>
        {formError && UUID_PATTERN.test(targetId.trim()) ? <span className="adm-error-text" role="alert">{formError}</span> : null}
        {grant.status === 'done' && grant.result ? (
          <span className="adm-hint" role="status">{t('Roster row written and audited.', 'كُتب السجل ودُوِّن في التدقيق.', 'Ligne écrite et journalisée.')}</span>
        ) : null}

        <SectionTitle>{t('What changing a role does', 'ماذا يغيّر تغيير الصلاحية', 'Ce que change un rôle')}</SectionTitle>
        <DefinitionList
          items={[
            { label: t('Immediately', 'فوريا', 'Immédiatement'), value: t('The next admin request is answered with the new role; the console re-checks within seconds.', 'يُجاب الطلب التالي بالصلاحية الجديدة؛ تتحقق اللوحة خلال ثوان.', 'La prochaine requête reçoit le nouveau rôle ; la console revérifie en quelques secondes.') },
            { label: t('Not affected', 'لا يتأثر', 'Non affecté'), value: t('Passwords, sessions of other devices, the traveller app and the person’s own data.', 'كلمات المرور وجلسات الأجهزة الأخرى وتطبيق المسافر وبيانات الشخص.', 'Mots de passe, sessions des autres appareils, l’app voyageur et les données de la personne.') },
            { label: t('Guardrail', 'ضمان', 'Garde-fou'), value: t('The last active super administrator cannot be revoked, so the console can never lock itself out.', 'لا يمكن سحب صلاحية آخر مشرف أعلى نشط، فلا تُغلق اللوحة على نفسها.', 'Le dernier super-administrateur actif ne peut pas être révoqué : la console ne peut pas se verrouiller.') },
          ]}
        />
      </aside>

      <ConfirmDialog
        open={Boolean(confirmRevoke)}
        title={t('Revoke console access?', 'سحب صلاحية اللوحة؟', 'Révoquer l’accès console ?')}
        body={
          <>
            <p style={{ margin: 0 }}>
              {t('This removes moderation rights for this account and takes effect on its next request. Their place records, reviews and audit entries are untouched.',
                  'يسحب هذا صلاحية المراجعة لهذا الحساب عند طلبه التالي. أما أماكنه وتقييماته وسجل تدقيقه فلا تُمسّ.',
                  'Cela retire les droits de modération dès la prochaine requête. Ses fiches, avis et lignes d’audit ne sont pas touchés.')}
            </p>
            <div>
              <TextInput
                label={t('Reason (required)', 'السبب (إلزامي)', 'Motif (obligatoire)')}
                value={revokeReason}
                onChange={(event) => setRevokeReason(event.target.value)}
                maxLength={500}
              />
            </div>
          </>
        }
        expect={confirmRevoke?.displayName ?? confirmRevoke?.userId ?? ''}
        confirmLabel={t('Revoke access', 'سحب الصلاحية', 'Révoquer l’accès')}
        cancelLabel={t('Keep access', 'إبقاء الصلاحية', 'Conserver l’accès')}
        busy={revoke.isPending}
        onConfirm={() => void submitRevoke()}
        onCancel={() => setConfirmRevoke(null)}
      />
    </div>
  );
}

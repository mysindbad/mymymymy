// The place inspector: one record, everything the platform actually holds about it, and the
// only two things an administrator may do to it - decide its moderation state, or curate the
// descriptive fields. Ratings, review counts, seed baselines and the gem flag are not editable
// here because the database refuses them, and this surface does not offer what cannot happen.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  ConfirmDialog,
  CopyButton,
  DataTable,
  DefinitionList,
  ErrorNotice,
  IconButton,
  InspectorSkeleton,
  Pill,
  SectionTitle,
  Select,
  TextInput,
  Textarea,
  useHotkeys,
  isTypingTarget,
} from './ui';
import { useAdminLocale } from './locale-context';
import { adminUrl, useAdminAction, useAdminResource } from './useAdminData';
import { MapPreview } from './MapPreview';
import { pushAdminToast } from './toast';
import { adminUrl as _unusedAdminUrl } from './useAdminData';
import { describeAdminError, adminFetch as _adminFetch } from './api';
import type { PlaceDetailResponse, PlaceModerationStatus, PlaceRow, ReviewRow } from './types';
import { PLACE_CURATION_ENUMS, PLACE_STATUSES_REQUIRING_REASON } from './types';
void _unusedAdminUrl;
void _adminFetch;

/** Mirrors CURATION_FIELDS in server/admin.ts. The server is still the only authority; this
 *  exists so the obvious mistakes are caught before a request is made. */
const CURATION_FIELDS: Array<{ key: string; max: number; required: boolean; multiline?: boolean; label: { en: string; ar: string; fr: string } }> = [
  { key: 'name', max: 160, required: true, label: { en: 'Name (English)', ar: 'الاسم (إنجليزية)', fr: 'Nom (anglais)' } },
  { key: 'arabic_name', max: 160, required: false, label: { en: 'Name (Arabic)', ar: 'الاسم (عربية)', fr: 'Nom (arabe)' } },
  { key: 'french_name', max: 160, required: false, label: { en: 'Name (French)', ar: 'الاسم (فرنسية)', fr: 'Nom (français)' } },
  { key: 'description', max: 4000, required: true, multiline: true, label: { en: 'Description', ar: 'الوصف', fr: 'Description' } },
  { key: 'region', max: 120, required: true, label: { en: 'Region', ar: 'الجهة', fr: 'Région' } },
  { key: 'area', max: 120, required: true, label: { en: 'Area / city', ar: 'المنطقة / المدينة', fr: 'Zone / ville' } },
  { key: 'address', max: 320, required: true, label: { en: 'Address', ar: 'العنوان', fr: 'Adresse' } },
  { key: 'sub_category', max: 80, required: false, label: { en: 'Sub-category', ar: 'الفئة الفرعية', fr: 'Sous-catégorie' } },
  { key: 'formation_info', max: 1000, required: false, multiline: true, label: { en: 'Geological / formation notes', ar: 'ملاحظات جيولوجية', fr: 'Notes géologiques' } },
  { key: 'opening_hours', max: 240, required: false, label: { en: 'Opening hours', ar: 'أوقات العمل', fr: 'Horaires' } },
  { key: 'contact_phone', max: 40, required: false, label: { en: 'Contact phone', ar: 'هاتف التواصل', fr: 'Téléphone' } },
];

type FormState = Record<string, string>;
type PendingDecision = { status: PlaceModerationStatus; reason: string };
type CommittedDecision = { status: PlaceModerationStatus; reason: string | null };

function initialForm(place: PlaceRow): FormState {
  return {
    name: place.name,
    arabic_name: place.arabicName ?? '',
    french_name: place.frenchName ?? '',
    description: place.description,
    region: place.region,
    area: place.area,
    address: place.address,
    sub_category: place.subCategory ?? '',
    formation_info: place.formationInfo ?? '',
    opening_hours: place.openingHours ?? '',
    contact_phone: place.contactPhone ?? '',
    category: place.category ?? '',
    price_level: place.priceLevel ?? '',
    trust_level: place.trustLevel ?? 'unverified',
  };
}

export function PlaceInspector({ placeId, onClose, onOpenPlace }: { placeId: string; onClose: () => void; onOpenPlace?: (id: string) => void }) {
  const { t, n, date, dateTime, relative, language } = useAdminLocale();
  const resource = useAdminResource<PlaceDetailResponse>(adminUrl(`/api/admin/places/${placeId}`));
  const detail = resource.data?.detail ?? null;
  const place = detail?.place ?? null;

  const [form, setForm] = useState<FormState | null>(null);
  const [decision, setDecision] = useState<PendingDecision | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [photoFailed, setPhotoFailed] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  const moderation = useAdminAction<{ moderation: { id: string; name: string; moderationStatus: PlaceModerationStatus; moderatedAt: string | null } | null }>(adminUrl(`/api/admin/places/${placeId}/moderation`), {
    invalidate: ['/api/admin/places', '/api/admin/overview', '/api/admin/moderation', '/api/admin/audit-events'],
  });
  const curation = useAdminAction<{ updated: { id: string; updatedAt: string } | null; changedFields: string[] }>(adminUrl(`/api/admin/places/${placeId}`), {
    method: 'PATCH',
    invalidate: ['/api/admin/places', '/api/admin/overview', '/api/admin/moderation', '/api/admin/audit-events'],
  });

  useEffect(() => {
    if (place && !form) setForm(initialForm(place));
  }, [place, form]);

  useEffect(() => {
    setForm(place ? initialForm(place) : null);
    setFieldErrors({});
    setPhotoFailed(false);
    // Intentionally keyed on the record id, not on every refetch, so a background refresh never
    // wipes what the operator is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId]);

  const dirty = useMemo(() => {
    if (!place || !form) return false;
    const base = initialForm(place);
    return Object.keys(base).some((key) => (form[key] ?? '') !== base[key]);
  }, [form, place]);

  const patch = useMemo(() => {
    if (!place || !form || !dirty) return null;
    const base = initialForm(place);
    const next: Record<string, string> = {};
    Object.keys(base).forEach((key) => {
      const value = (form[key] ?? '').trim();
      if (value !== base[key]) next[key] = value;
    });
    return next;
  }, [form, place, dirty]);

  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!form) return false;
    CURATION_FIELDS.forEach((field) => {
      const value = (form[field.key] ?? '').trim();
      if (field.required && !value) errors[field.key] = t('This field cannot be empty.', 'لا يمكن أن يكون هذا الحقل فارغًا.', 'Ce champ ne peut pas être vide.');
      if (value.length > field.max) errors[field.key] = t(`At most ${field.max} characters.`, `بحد أقصى ${field.max} حرفًا.`, `${field.max} caractères maximum.`);
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  const submitCuration = useCallback(async () => {
    if (!patch || !validate()) return;
    const reason = (form?.__reason ?? '').trim() || null;
    const result = await curation.run({ ...patch, ...(reason ? { reason } : {}) });
    if (result) {
      pushAdminToast({
        tone: 'ok',
        title: t('Place updated', 'تم تحديث المكان', 'Lieu mis à jour'),
        message: t(`${result.changedFields.length} field(s) written; audit event recorded.`, `كُتبت ${result.changedFields.length} خانة وسُجّل حدث تدقيق.`, `${result.changedFields.length} champ(s) écrit(s) ; événement journalisé.`),
      });
      setForm((current) => (current ? { ...current, __reason: '' } : current));
      resource.reload();
    } else if (curation.errorRef.current) {
      pushAdminToast({ tone: 'bad', title: t('The change was refused', 'رُفض التغيير', 'La modification a été refusée'), message: describeAdminError(curation.errorRef.current) });
    }
  }, [patch, validate, form, curation, resource, t]);

  const submitDecision = useCallback(async (next: CommittedDecision | null) => {
    if (!next) return;
    // Hiding a record from the public catalogue is the one action on this screen that removes it
    // from people's view, so it always passes the typed-name confirmation - including when the
    // reason arrived through the inline form rather than straight from the button.
    if (next.status === 'rejected' && !confirmReject) {
      setDecision(next);
      setConfirmReject(true);
      return;
    }
    const result = await moderation.run({ status: next.status, ...(next.reason ? { reason: next.reason } : {}) });
    setDecision(null);
    if (result) {
      pushAdminToast({
        tone: next.status === 'rejected' ? 'neutral' : 'ok',
        title: t('Decision recorded', 'تم تسجيل القرار', 'Décision enregistrée'),
        message: t(`moderation_status → ${result.moderation?.moderationStatus ?? next.status}`, `حالة المراجعة ← ${result.moderation?.moderationStatus ?? next.status}`, `moderation_status → ${result.moderation?.moderationStatus ?? next.status}`),
      });
      setConfirmReject(false);
      resource.reload();
    } else if (moderation.errorRef.current) {
      pushAdminToast({ tone: 'bad', title: t('The decision was refused', 'رُفض القرار', 'La décision a été refusée'), message: describeAdminError(moderation.errorRef.current) });
    }
  }, [moderation, resource, t, confirmReject]);

  const requestDecision = useCallback((status: PlaceModerationStatus) => {
    if (!place) return;
    const requiresReason = PLACE_STATUSES_REQUIRING_REASON.includes(status) && !(place.moderation.note ?? '');
    const reason = (decision?.status === status ? decision.reason : place.moderation.note) ?? '';
    if (requiresReason && !reason.trim()) {
      setDecision({ status, reason: '' });
      window.setTimeout(() => reasonRef.current?.focus(), 30);
      return;
    }
    if (status === 'rejected') {
      setDecision({ status, reason: reason.trim() });
      setConfirmReject(true);
      return;
    }
    void submitDecision({ status, reason: reason.trim() || null });
  }, [place, decision, submitDecision]);

  useHotkeys((event) => {
    if (isTypingTarget(event.target)) {
      if (event.key === 'Escape' && decision) {
        setDecision(null);
      }
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Escape') {
      // A dialog owns the keyboard while it is open: escaping must dismiss the dialog in front,
      // not the screen behind it.
      if (document.querySelector('[role="dialog"]')) return;
      onClose();
      return;
    }
    if (confirmReject) return;
    if (event.key === 'a') { event.preventDefault(); requestDecision('approved'); }
    else if (event.key === 'n') { event.preventDefault(); requestDecision('needs_changes'); }
    else if (event.key === 'x') { event.preventDefault(); requestDecision('rejected'); }
    else if (event.key === 'e') {
      event.preventDefault();
      document.querySelector<HTMLElement>('[data-adm-curation] input')?.focus();
    }
  }, true);

  useEffect(() => { asideRef.current?.focus(); }, [placeId]);

  if (resource.isLoading && !detail) {
    return <InspectorSkeleton />;
  }
  if (!place) {
    return (
      <div className="adm-inspector">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <h2>{t('Place record', 'سجل المكان', 'Fiche du lieu')}</h2>
          <IconButton label={t('Close inspector', 'إغلاق اللوحة', 'Fermer le panneau')} onClick={onClose} style={{ marginInlineStart: 'auto' }}>
            <span aria-hidden="true">×</span>
          </IconButton>
        </div>
        {resource.error ? <ErrorNotice error={resource.error} onRetry={resource.reload} /> : null}
      </div>
    );
  }

  const isRejected = place.moderation.status === 'rejected';

  return (
    <aside className="adm-inspector" tabIndex={-1} ref={asideRef} aria-label={t(`Inspector: ${place.name}`, `لوحة التفاصيل: ${place.name}`, `Inspecteur : ${place.name}`)}>
      <div className="adm-inspector-head">
        <div style={{ minWidth: 0 }}>
          <h2>{displayName(place, t, language)}</h2>
          <p className="adm-note" style={{ margin: '0.125rem 0 0' }}>
            {[place.area, place.region].filter(Boolean).join(' · ') || t('no locality recorded', 'لا توجد منطقة مسجلة', 'aucune localité enregistrée')}
            {place.category ? ` · ${place.category.replace('_', ' ')}` : ''}
          </p>
        </div>
        <IconButton label={t('Close inspector (Esc)', 'إغلاق اللوحة (Esc)', 'Fermer l’inspecteur (Esc)')} onClick={onClose} style={{ marginInlineStart: 'auto', flex: 'none' }}>
          <span aria-hidden="true">×</span>
        </IconButton>
      </div>

      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
        <Pill state={place.moderation.status === 'approved' ? 'ok' : place.moderation.status === 'pending' ? 'warn' : place.moderation.status === 'needs_changes' ? 'bad' : 'neutral'}>
          {moderationLabel(place.moderation.status, t)}
        </Pill>
        <Pill state={place.trustLevel === 'official' ? 'ok' : 'neutral'}>{t(`trust: ${place.trustLevel}`, `الموثوقية: ${place.trustLevel}`, `fiabilité : ${place.trustLevel}`)}</Pill>
        {place.seed.isSeed ? <Pill state="neutral">{t('seed record', 'سجل بذرة', 'enregistrement seed')}</Pill> : null}
        {place.isUnderDocumentedGem ? <Pill state="warn">{t('under-documented', 'غير موثّق بما يكفي', 'peu documenté')}</Pill> : null}
        {isRejected ? <Pill state="bad">{t('hidden from the public feed', 'مخفي من القائمة العامة', 'masqué du flux public')}</Pill> : null}
      </div>

      {place.coordinates ? <MapPreview latitude={place.coordinates[1]} longitude={place.coordinates[0]} title={displayName(place, t, language)} /> : null}

      {place.photos.length > 0 || place.suppressedPhotoCount > 0 ? (
        <div>
          <SectionTitle>{t('Photos', 'الصور', 'Photos')}</SectionTitle>
          {place.suppressedPhotoCount > 0 ? (
            <p className="adm-note" style={{ margin: '0 0 0.375rem' }} role="status">
              {t(`${place.suppressedPhotoCount} stored photo URL(s) are not https and were not rendered.`, `${place.suppressedPhotoCount} رابط صورة مخزّن ليس https ولم يُعرض.`, `${place.suppressedPhotoCount} URL(s) de photo non https : non affichées.`)}
            </p>
          ) : null}
          <div className="adm-photo-strip">
            {place.photos.map((url, index) => (
              <img
                key={`${url}-${index}`}
                src={url}
                alt={t(`Photo ${index + 1} for ${displayName(place, t, language)}`, `صورة ${index + 1} لـ${displayName(place, t, language)}`, `Photo ${index + 1} de ${displayName(place, t, language)}`)}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(event) => { (event.currentTarget as HTMLImageElement).style.opacity = '0.25'; setPhotoFailed(true); }}
              />
            ))}
          </div>
          {photoFailed ? <p className="adm-note" style={{ margin: '0.25rem 0 0' }}>{t('At least one photo could not be loaded from its host.', 'تعذّر تحميل بعض الصور من مستضيفها.', 'Certaines photos n’ont pas pu être chargées.')}</p> : null}
        </div>
      ) : null}

      <div>
        <SectionTitle>{t('Identity and origin', 'الهوية والمصدر', 'Identité et origine')}</SectionTitle>
        <DefinitionList
          items={[
            { label: t('Identifier', 'المعرّف', 'Identifiant'), value: <CopyButton value={place.id} /> },
            { label: t('Submitted by', 'قدّمه', 'Proposé par'), value: place.submittedBy ? <CopyButton value={place.submittedBy} label={t('Copy submitter id', 'نسخ معرّف المقدِّم', 'Copier l’identifiant')} /> : t('not recorded (catalogue import)', 'غير مسجل (استيراد الكتالوج)', 'non enregistré (import catalogue)') },
            { label: t('Source row', 'مصدر الصف', 'Origine de la ligne'), value: sourceLabel(place.source, t) },
            { label: t('Data source', 'مصدر البيانات', 'Source de données'), value: place.dataSource },
            { label: t('Photo provenance', 'مصدر الصور', 'Provenance des photos'), value: place.photoProvenance ?? t('not recorded', 'غير مسجلة', 'non enregistrée') },
            { label: t('Coordinates', 'الإحداثيات', 'Coordonnées'), value: place.coordinates ? <span className="adm-mono">{place.coordinates[0].toFixed(5)}, {place.coordinates[1].toFixed(5)}</span> : t('none stored', 'لا شيء مخزّن', 'aucune') },
            { label: t('Created', 'أُنشئ', 'Créé le'), value: date(place.createdAt) },
            { label: t('Updated', 'حُدّث', 'Mis à jour'), value: place.updatedAt ? `${date(place.updatedAt)} · ${relative(place.updatedAt)}` : '—' },
            { label: t('Last check-in', 'آخر زيارة مسجلة', 'Dernier check-in'), value: place.lastActivityAt ? date(place.lastActivityAt) : t('none', 'لا شيء', 'aucun') },
            { label: t('Last verified', 'آخر تحقق', 'Dernière vérification'), value: place.lastVerifiedAt ? date(place.lastVerifiedAt) : t('never verified', 'لم يُتحقق منه', 'jamais vérifié') },
          ]}
        />
      </div>

      <div>
        <SectionTitle>{t('Rating truth', 'حقيقة التقييم', 'Vérité de la note')}</SectionTitle>
        <DefinitionList
          items={[
            {
              label: t('Live rating', 'التقييم الحقيقي', 'Note réelle'),
              value: place.rating.value === null
                ? <span>{t('unrated', 'بدون تقييم', 'non noté')} <span className="adm-note">({place.rating.provenance})</span></span>
                : <span className="adm-num">{n(place.rating.value, 2)} <span className="adm-note">/ 5 · {n(place.rating.reviewCount, 0)} {t('reviews', 'تقييمًا', 'avis')}</span></span>,
            },
            {
              label: t('Rating provenance', 'مصدر التقييم', 'Provenance de la note'),
              value: place.rating.provenance,
            },
            {
              label: t('Seed baseline', 'خط البذرة', 'Référence seed'),
              value: place.seed.isSeed
                ? <span className="adm-num">{place.seed.rating === null ? t('none', 'لا شيء', 'aucune') : n(place.seed.rating, 2)} · {n(place.seed.reviewCount, 0)} {t('seed reviews', 'تقييم بذرة', 'avis seed')}</span>
                : t('not a seeded record', 'ليس سجل بذرة', 'pas un enregistrement seed'),
            },
            { label: t('Seed origin', 'مصدر البذرة', 'Origine seed'), value: place.seed.source ?? '—' },
            { label: t('Check-ins', 'زيارات', 'Check-ins'), value: <span className="adm-num">{n(place.checkInsCount, 0)}</span> },
          ]}
        />
        <p className="adm-note" style={{ margin: '0.375rem 0 0' }}>
          {t('This panel is read-only on purpose: ratings come from real reviews only, and the under-documented flag is computed by the database.',
              'هذه اللوحة للقراءة فقط عن قصد: التقييمات تأتي من مراجعات حقيقية فقط، وحالة «غير موثّق» تحسبها قاعدة البيانات.',
              'Ce panneau est en lecture seule : les notes viennent uniquement d’avis réels, et le drapeau « peu documenté » est calculé par la base.')}
        </p>
      </div>

      {(detail?.duplicateCandidates.length ?? 0) > 0 ? (
        <div>
          <SectionTitle>{t('Possible duplicates', 'احتمال تكرار', 'Doublons possibles')}</SectionTitle>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.375rem' }}>
            {detail!.duplicateCandidates.slice(0, 5).map((candidate) => (
              <li key={candidate.id} className="adm-evidence" data-flagged={candidate.likely ? 'true' : 'false'}>
                <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '0.8125rem' }}>{candidate.name}</strong>
                  {candidate.likely ? <Pill state="warn">{t('likely duplicate', 'تكرار محتمل', 'doublon probable')}</Pill> : null}
                  <span className="adm-note adm-num" style={{ marginInlineStart: 'auto' }}>
                    {candidate.distanceMeters === null ? '—' : `${n(candidate.distanceMeters, 0)} m`} · {t('name match', 'تشابه الاسم', 'similarité')}&nbsp;{n(Math.round(candidate.similarity * 100), 0)}%
                  </span>
                </div>
                <span className="adm-note">
                  {[candidate.area, candidate.category, moderationLabel(candidate.moderationStatus as PlaceModerationStatus, t)].filter(Boolean).join(' · ')}
                </span>
                {onOpenPlace ? (
                  <Button size="sm" data-variant="ghost" onClick={() => onOpenPlace(candidate.id)} style={{ alignSelf: 'start' }}>
                    {t('Open this record', 'افتح هذا السجل', 'Ouvrir cette fiche')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="adm-note" style={{ margin: '0.375rem 0 0' }}>
            {t('Candidates are places within 400 m of these coordinates, ranked by name similarity. Nothing is merged automatically.',
                'المرشحون هي أماكن ضمن 400 م من هذه الإحداثيات، مرتّبة بحسب تشابه الأسماء. لا يُدمج شيء تلقائيًا.',
                'Les candidats sont à moins de 400 m, classés par similarité de nom. Aucune fusion automatique.')}
          </p>
        </div>
      ) : null}

      <div>
        <SectionTitle>{t('Moderation decision', 'قرار المراجعة', 'Décision de modération')}</SectionTitle>
        <p className="adm-note" style={{ margin: '0 0 0.375rem' }}>
          {place.moderation.moderatedAt
            ? t(`Last decision ${relative(place.moderation.moderatedAt)} · ${moderationLabel(place.moderation.status, t)}${place.moderation.note ? ` · “${place.moderation.note}”` : ''}`,
                `آخر قرار ${relative(place.moderation.moderatedAt)} · ${moderationLabel(place.moderation.status, t)}${place.moderation.note ? ` · «${place.moderation.note}»` : ''}`,
                `Dernière décision ${relative(place.moderation.moderatedAt)} · ${moderationLabel(place.moderation.status, t)}${place.moderation.note ? ` · «${place.moderation.note}»` : ''}`)
            : t('No decision has been recorded for this place.', 'لم يُسجَّل أي قرار لهذا المكان.', 'Aucune décision enregistrée pour ce lieu.')}
        </p>
        <div className="adm-actions">
          <Button data-variant="primary" size="sm" onClick={() => requestDecision('approved')} disabled={moderation.isPending || place.moderation.status === 'approved'}>
            {t('Approve / keep live', 'اعتماد / إبقاء منشورًا', 'Approuver / publier')}
          </Button>
          <Button size="sm" onClick={() => requestDecision('needs_changes')} disabled={moderation.isPending}>
            {t('Needs changes', 'يحتاج تعديلًا', 'À modifier')}
          </Button>
          <Button data-variant="danger" size="sm" onClick={() => requestDecision('rejected')} disabled={moderation.isPending || isRejected}>
            {t('Reject and hide', 'رفض وإخفاء', 'Rejeter et masquer')}
          </Button>
        </div>
        {moderation.error ? <span className="adm-error-text" role="alert">{describeAdminError(moderation.error)}</span> : null}
        {decision ? (
          <div style={{ display: 'grid', gap: '0.375rem', marginTop: '0.5rem' }}>
            <Textarea
              label={t(`Reason for “${moderationLabel(decision.status, t)}”`, `سبب «${moderationLabel(decision.status, t)}»`, `Motif de « ${moderationLabel(decision.status, t)} »`)}
              hint={t('Stored on the record and in the audit log. Required for rejections and for changes requests.', 'يُحفظ في السجل وفي سجل التدقيق. إلزامي للرفض وطلب التعديل.', 'Enregistré sur la fiche et dans le journal. Obligatoire pour rejet et demande de modification.')}
              rows={3}
              value={decision.reason}
              onChange={(event) => setDecision({ ...decision, reason: event.target.value })}
              textAreaRef={reasonRef}
              maxLength={500}
            />
            <div className="adm-actions">
              <Button size="sm" data-variant="primary" disabled={moderation.isPending} onClick={() => void submitDecision(decision)}>
                {moderation.isPending ? t('Recording…', 'جارٍ التسجيل…', 'Enregistrement…') : t('Record this decision', 'سجّل هذا القرار', 'Enregistrer cette décision')}
              </Button>
              <Button size="sm" data-variant="ghost" onClick={() => setDecision(null)}>{t('Cancel', 'إلغاء', 'Annuler')}</Button>
            </div>
          </div>
        ) : null}
      </div>

      <div data-adm-curation>
        <SectionTitle>{t('Curate descriptive fields', 'تحرير الحقول الوصفية', 'Corriger les champs descriptifs')}</SectionTitle>
        {!form ? null : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {CURATION_FIELDS.map((field) => {
              const error = fieldErrors[field.key] ?? null;
              const label = t(field.label.en, field.label.ar, field.label.fr);
              const value = form[field.key] ?? '';
              const counter = `${value.length}/${field.max}`;
              if (field.multiline) {
                return (
                  <Textarea
                    key={field.key}
                    label={`${label} · ${counter}`}
                    value={value}
                    error={error}
                    rows={4}
                    maxLength={field.max}
                    onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                  />
                );
              }
              return (
                <TextInput
                  key={field.key}
                  label={`${label} · ${counter}`}
                  value={value}
                  error={error}
                  maxLength={field.max}
                  onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                />
              );
            })}
            <div className="adm-grid adm-grid-2">
              <Select
                label={t('Category', 'الفئة', 'Catégorie')}
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                options={[
                  { value: '', label: t('— choose —', '— اختر —', '— choisir —'), },
                  ...PLACE_CURATION_ENUMS.category.map((value) => ({ value, label: value.replace('_', ' ') })),
                ]}
              />
              <Select
                label={t('Price level', 'مستوى السعر', 'Niveau de prix')}
                value={form.price_level}
                onChange={(event) => setForm({ ...form, price_level: event.target.value })}
                options={[{ value: '', label: t('— none —', '— لا شيء —', '— aucun —') }, ...PLACE_CURATION_ENUMS.price_level.map((value) => ({ value, label: value }))]}
              />
              <Select
                label={t('Trust level', 'مستوى الموثوقية', 'Niveau de fiabilité')}
                value={form.trust_level}
                onChange={(event) => setForm({ ...form, trust_level: event.target.value })}
                options={PLACE_CURATION_ENUMS.trust_level.map((value) => ({ value, label: trustLabel(value, t) }))}
              />
              <div className="adm-field">
                <span className="adm-label">{t('Photo evidence', 'أدلة الصور', 'Preuve photo')}</span>
                <span className="adm-hint">{place.photos.length ? t(`${place.photos.length} hosted photo(s) on this record.`, `${place.photos.length} صورة مستضافة على هذا السجل.`, `${place.photos.length} photo(s) hébergée(s).`) : t('No photos hosted.', 'لا توجد صور مستضافة.', 'Aucune photo hébergée.')}</span>
              </div>
            </div>
            <Textarea
              label={t('Why is this changing? (optional)', 'لماذا يتغيّر هذا؟ (اختياري)', 'Pourquoi ce changement ? (facultatif)')}
              hint={t('Written to the audit log next to your identifier.', 'يُكتب في سجل التدقيق بجانب معرّفك.', 'Écrit dans le journal d’audit avec votre identifiant.')}
              rows={2}
              maxLength={500}
              value={form.__reason ?? ''}
              onChange={(event) => setForm({ ...form, __reason: event.target.value })}
            />
            <div className="adm-actions" style={{ alignItems: 'center' }}>
              <Button size="sm" data-variant="primary" disabled={!dirty || !patch || curation.isPending} onClick={() => void submitCuration()}>
                {curation.isPending ? t('Saving…', 'جارٍ الحفظ…', 'Enregistrement…') : t('Save changes', 'حفظ التعديلات', 'Enregistrer les modifications')}
              </Button>
              <Button size="sm" data-variant="ghost" disabled={!dirty || curation.isPending} onClick={() => { setForm(initialForm(place)); setFieldErrors({}); }}>
                {t('Discard', 'تجاهل', 'Annuler')}
              </Button>
              <span className="adm-note" aria-live="polite">
                {!dirty
                  ? t('No unsaved changes.', 'لا تغييرات غير محفوظة.', 'Aucune modification en attente.')
                  : t(`${patch ? Object.keys(patch).length : 0} field(s) will be written.`, `سيُكتب ${patch ? Object.keys(patch).length : 0} حقلًا.`, `${patch ? Object.keys(patch).length : 0} champ(s) seront écrits.`)}
              </span>
            </div>
            {curation.error ? (
              <span className="adm-error-text" role="alert">
                {curation.error.status === 400
                  ? t('The server rejected these values: ', 'رفض الخادم هذه القيم: ', 'Le serveur a refusé ces valeurs : ')
                  : ''}
                {describeAdminError(curation.error)}
              </span>
            ) : null}
            {curation.status === 'done' && curation.result ? (
              <span className="adm-hint" role="status">
                {curation.result.updated
                  ? t(`Saved ${dateTime(curation.result.updated.updatedAt)} · ${curation.result.changedFields.join(', ')}`, `حُفظ ${dateTime(curation.result.updated.updatedAt)} · ${curation.result.changedFields.join('، ')}`, `Enregistré ${dateTime(curation.result.updated.updatedAt)} · ${curation.result.changedFields.join(', ')}`)
                  : t('Saved.', 'تم الحفظ.', 'Enregistré.')}
              </span>
            ) : null}
          </div>
        )}
      </div>

      <div>
        <SectionTitle>{t('Reviews on this place', 'تقييمات هذا المكان', 'Avis sur ce lieu')}</SectionTitle>
        {(detail?.reviews.length ?? 0) === 0 ? (
          <p className="adm-note">{t('No reviews yet — which is why the rating above is what it is.', 'لا توجد تقييمات بعد — ولهذا التقييم أعلاه ما هو عليه.', 'Aucun avis — d’où la note affichée.')}</p>
        ) : (
          <DataTable
            caption={t('The twenty most recent reviews attached to this place.', 'آخر عشرين تقييمًا مرتبطًا بهذا المكان.', 'Les vingt avis les plus récents de ce lieu.')}
            columns={[
              { id: 'author', label: t('Author', 'الكاتب', 'Auteur'), render: (row: ReviewRow) => (
                <span>{row.authorName || t('anonymous', 'مجهول', 'anonyme')}<span className="adm-cell-sub">{row.authorRole}{row.isSeed ? ` · ${t('seed', 'بذرة', 'seed')}` : ''}</span></span>
              ) },
              { id: 'rating', label: t('Rating', 'التقييم', 'Note'), align: 'end', width: '4.5rem', render: (row: ReviewRow) => <span className="adm-num">{n(row.rating, 0)} / 5</span> },
              { id: 'text', label: t('Text', 'النص', 'Texte'), render: (row: ReviewRow) => <span style={{ display: 'block', maxInlineSize: '22rem' }}>{row.text || t('(no text)', '(بدون نص)', '(sans texte)')}</span> },
              { id: 'mod', label: t('State', 'الحالة', 'État'), render: (row: ReviewRow) => <Pill state={row.moderation.status === 'approved' ? 'ok' : row.moderation.status === 'pending' ? 'warn' : 'neutral'}>{row.moderation.status}</Pill> },
            ]}
            rows={detail?.reviews ?? []}
            rowKey={(row) => row.id}
          />
        )}
      </div>

      <div>
        <SectionTitle>{t('Audit history for this place', 'سجل التدقيق لهذا المكان', 'Historique d’audit de ce lieu')}</SectionTitle>
        {(detail?.history.length ?? 0) === 0 ? (
          <p className="adm-note">{t('Nothing has been changed from the admin console for this record.', 'لم يُغيَّر شيء لهذا السجل من شاشة المشرفين.', 'Rien a été modifié depuis la console pour cette fiche.')}</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.375rem' }}>
            {detail!.history.map((event) => (
              <li key={event.id} className="adm-evidence">
                <strong style={{ fontSize: '0.75rem' }}>{event.action.replace(/_/g, ' ')}</strong>
                <span className="adm-note">{dateTime(event.occurredAt)} · {event.adminLabel ?? '—'} · {event.adminRole ?? ''}</span>
                {event.reason ? <span style={{ fontSize: '0.75rem' }}>{event.reason}</span> : null}
                {Object.keys(event.changeSummary ?? {}).length > 0 ? (
                  <pre className="adm-mono" style={{ margin: 0, fontSize: '0.625rem', whiteSpace: 'pre-wrap', color: 'var(--adm-ink-soft)' }}>{JSON.stringify(event.changeSummary)}</pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={confirmReject}
        title={t('Reject this place?', 'رفض هذا المكان؟', 'Rejeter ce lieu ?')}
        body={
          <>
            <p style={{ margin: 0 }}>
              {t('The record stays in the database with your note, and is hidden from the public feed, map and search. It can be approved again at any time; nothing is deleted.',
                  'يبقى السجل في قاعدة البيانات مع ملاحظتك، ويُخفى من القائمة العامة والخريطة والبحث. يمكن اعتماده لاحقًا في أي وقت؛ لا يُحذف شيء.',
                  'La fiche reste en base avec votre note et est masquée du flux public, de la carte et de la recherche. Elle peut être réapprouvée ; rien n’est supprimé.')}
            </p>
            {decision?.reason ? <p className="adm-note" style={{ margin: '0.25rem 0 0' }}>{t(`Reason to record: “${decision.reason}”`, `السبب المسجَّل: «${decision.reason}»`, `Motif enregistré : « ${decision.reason} »`)}</p> : null}
          </>
        }
        expect={place.name}
        confirmLabel={t('Reject and hide', 'رفض وإخفاء', 'Rejeter et masquer')}
        cancelLabel={t('Keep as is', 'إبقاء الوضع', 'Conserver')}
        busy={moderation.isPending}
        onConfirm={() => void submitDecision(decision ?? { status: 'rejected', reason: '' })}
        onCancel={() => setConfirmReject(false)}
      />
    </aside>
  );
}

export function displayName(
  place: { name: string; arabicName: string | null; frenchName: string | null },
  t: (en: string, ar: string, fr: string) => string,
  language: string,
): string {
  // The console follows its own reading language, never the traveller's stored preference.
  if (language === 'ar' && place.arabicName) return place.arabicName;
  if (language === 'fr' && place.frenchName) return place.frenchName;
  return place.name || t('Untitled place', 'مكان بدون اسم', 'Lieu sans nom');
}

export function moderationLabel(status: PlaceModerationStatus | string | null, t: (en: string, ar: string, fr: string) => string): string {
  if (status === 'approved') return t('approved', 'معتمد', 'approuvé');
  if (status === 'pending') return t('pending review', 'بانتظار المراجعة', 'à modérer');
  if (status === 'needs_changes') return t('needs changes', 'يحتاج تعديلًا', 'à modifier');
  if (status === 'rejected') return t('rejected', 'مرفوض', 'rejeté');
  return t('unknown state', 'حالة غير معروفة', 'état inconnu');
}

function sourceLabel(source: string, t: (en: string, ar: string, fr: string) => string): string {
  if (source === 'initial_seed') return t('initial seed catalogue', 'كتالوج البذرة الأولي', 'catalogue initial (seed)');
  if (source === 'community_traveler') return t('traveller submission', 'اقتراح مسافر', 'contribution voyageur');
  if (source === 'business_owner') return t('business owner submission', 'اقتراح صاحب النشاط', 'contribution du propriétaire');
  return source;
}

function trustLabel(value: string, t: (en: string, ar: string, fr: string) => string): string {
  if (value === 'unverified') return t('unverified', 'غير موثّق', 'non vérifié');
  if (value === 'community') return t('community-reported', 'من المجتمع', 'signalé par la communauté');
  if (value === 'external') return t('external source', 'مصدر خارجي', 'source externe');
  if (value === 'official') return t('official / owner-confirmed', 'رسمي / مؤكد من صاحبه', 'officiel / confirmé');
  return value;
}

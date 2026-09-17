// Settings: only what is really configurable, and what the console itself can do.
//
// There is no toggle here because none would work: every operational value in this deployment
// comes from environment configuration or a migration, and there is no settings table to write
// to. Showing switches that change nothing is exactly the kind of decoration this console was
// asked not to have.
import { useAdminLocale } from '../locale-context';
import { adminUrl, useAdminResource } from '../useAdminData';
import { useAdminRouter } from '../router';
import { Button, DefinitionList, ErrorNotice, Panel, Pill, RefreshButton, SectionTitle } from '../ui';
import type { SettingsPayload } from '../types';

export default function SettingsModule() {
  const { t, n } = useAdminLocale();
  const { navigate } = useAdminRouter();
  const resource = useAdminResource<SettingsPayload>(adminUrl('/api/admin/settings'));
  const settings = resource.data?.settings ?? null;
  const role = resource.data?.role ?? null;

  if (resource.error && !settings) {
    return (
      <Panel title={t('Settings', 'الإعدادات', 'Réglages')}>
        <ErrorNotice error={resource.error} onRetry={resource.reload} />
      </Panel>
    );
  }

  const capabilities = settings?.capabilities ?? {};

  return (
    <div className="adm-grid" style={{ gap: '0.75rem' }}>
      <div className="adm-grid adm-grid-2" style={{ gap: '0.75rem' }}>
        <Panel
          title={t('Deployment', 'النشر', 'Déploiement')}
          actions={<RefreshButton onClick={resource.reload} busy={resource.isRefreshing} />}
        >
          <DefinitionList
            items={[
              { label: t('Environment', 'البيئة', 'Environnement'), value: settings?.runtime.nodeEnvironment ?? '—' },
              { label: t('Hosting', 'الاستضافة', 'Hébergement'), value: settings?.runtime.hosting ?? '—' },
              {
                label: t('Revision', 'النسخة', 'Révision'),
                value: settings?.runtime.revision
                  ? <span className="adm-mono" style={{ fontSize: '0.6875rem' }}>{settings.runtime.revision.slice(0, 12)}</span>
                  : <span className="adm-note">{t('the deployment did not expose a commit sha', 'لم يكشف النشر عن رقم النسخة', 'le déploiement n’a pas exposé de sha')}</span>,
              },
              { label: t('Your role', 'صلاحيّتك', 'Votre rôle'), value: role ? <Pill state={role === 'super_admin' ? 'ok' : 'neutral'}>{role.replace('_', ' ')}</Pill> : '—' },
            ]}
          />
        </Panel>

        <Panel title={t('Capabilities', 'القدرات', 'Capacités')} note={t('presence booleans only — values never cross to the browser', 'موجده فقط --لا تعبر القيم إلى المتصفح أبدا', 'booléens de présence — les valeurs ne passent jamais au navigateur')}>
          <div style={{ display: 'grid', gap: '0.375rem' }}>
            <Capability
              label={t('Supabase reachable from the server', 'Supabase متاحة من الخادم', 'Supabase joignable côté serveur')}
              present={Boolean(capabilities.supabase)}
              detail={t('without it every admin read answers 503 instead of guessing', 'بدونها تُجيب كل قراءة للمشرف بـ503 بدل التخمين', 'sinon chaque lecture admin répond 503 plutôt que deviner')}
            />
            <Capability
              label={t('Service-role key configured', 'مفتاح الخدمة مضبوط', 'Clé service_role configurée')}
              present={Boolean(capabilities.serviceRole)}
              detail={t('used only inside server.ts; never sent to a client', 'يُستخدم داخل server.ts فقط، ولا يُرسل إلى العميل', 'utilisé côté serveur uniquement ; jamais envoyé au client')}
            />
            <Capability
              label={t('AI provider key configured', 'مفتاح الذكاء الاصطناعي مضبوط', 'Clé IA configurée')}
              present={Boolean(capabilities.aiProvider)}
              detail={t('the assistant returns 503 while it is absent', 'يرجع المساعد 503 في غيابه', 'l’assistant renvoie 503 en son absence')}
            />
            <Capability
              label={t('Rate-limit salt configured', 'ملح تحديد المعدّل مضبوط', 'Sel anti-abus configuré')}
              present={Boolean(capabilities.rateLimitSalt)}
              detail={t('without it limits fall back to a per-process counter', 'بدونها يرجع التحديد إلى عدّاد داخل العملية', 'sinon la limite retombe sur un compteur processeur')}
            />
            <Capability
              label={t('Seed fallback allowed', 'السماح ببيانات البذرة', 'Fallback seed autorisé')}
              present={Boolean(capabilities.seedFallback)}
              detail={t('when off, an unreachable database means an honest error, never demo rows', 'عند الإيقاف يعني تعذّر القاعدة خطأ صريحا، لا بيانات تجريبية', 'sinon une base injoignable produit une erreur honnête, jamais des données de démonstration')}
            />
          </div>
        </Panel>
      </div>

      <div className="adm-grid adm-grid-2" style={{ gap: '0.75rem' }}>
        <Panel title={t('Live counters', 'عدادات مباشرة', 'Compteurs en direct')}>
          <DefinitionList
            items={[
              { label: t('Rate-limit windows in the table', 'نوافذ التحديد في الجدول', 'Fenêtres anti-abus en table'), value: <span className="adm-num">{n(settings?.counters.rateLimitWindowsActive ?? 0, 0)}</span> },
              { label: t('AI requests in the last hour', 'طلبات الذكاء الاصطناعي في آخر ساعة', 'Requêtes IA sur la dernière heure'), value: <span className="adm-num">{n(settings?.counters.aiRequestsLastHour ?? 0, 0)}</span> },
            ]}
          />
          <p className="adm-note" style={{ margin: '0.375rem 0 0' }}>
            {t('These are the same counters the API enforces, read from the tables that back them — not a chart of stored history, because none is kept.',
                'هذه هي العدّادات التي تفرضها الواجهة نفسها، مقروءة من جداولها --لا رسم بياني لتاريخ محفوظ لأنه لا تاريخ محفوظ.',
                'Ce sont les compteurs appliqués par l’API, lus dans leurs tables — pas un historique, car aucun n’est conservé.')}
          </p>
        </Panel>

        <Panel title={t('What this console can change', 'ما يمكن لهذه اللوحة تغييره', 'Ce que cette console peut modifier')}>
          <SectionTitle>{t('Write surface', 'سطح الكتابة', 'Surface d’écriture')}</SectionTitle>
          <ul style={{ margin: 0, paddingInlineStart: '1rem', display: 'grid', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--adm-ink-soft)' }}>
            <li>{t('Moderation state of a place (pending / approved / needs changes / rejected)', 'حالة مراجعة المكان (قيد المراجعة / معتمد / يحتاج تعديلا / مرفوض)', 'état de modération d’un lieu')}&nbsp;<Button size="sm" data-variant="ghost" onClick={() => navigate('/admin/moderation')}>{t('queue', 'الطابور', 'file')}</Button></li>
            <li>{t('Descriptive fields of a place, through an allow-list the database enforces', 'الحقول الوصفية للمكان، عبر قائمة مسموحة تفرضها قاعدة البيانات', 'champs descriptifs d’un lieu, via une liste autorisée contrôlée en base')}</li>
            <li>{t('Moderation state of a review, with the aggregate recomputed by trigger', 'حالة مراجعة التقييم، ويُعاد حساب المتوسط بواسطة مشغّل', 'état de modération d’un avis, agrégat recalculé par trigger')}</li>
            <li>{t('The administrators roster (super administrators only)', 'قائمة المشرفين (المشرفون الأعلى فقط)', 'liste des administrateurs (super-administrateurs seulement)')}</li>
          </ul>
          <SectionTitle>{t('Deliberately impossible', 'غير ممكن عن قصد', 'Volontairement impossible')}</SectionTitle>
          <ul style={{ margin: 0, paddingInlineStart: '1rem', display: 'grid', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--adm-ink-soft)' }}>
            <li>{t('Editing a rating, a review count, a seed baseline or the under-documented flag', 'تعديل تقييم أو عدد التقييمات أو خط البذرة أو علامة "غير موثّق"', 'modifier une note, un compteur, une référence seed ou le drapeau « peu documenté »')}</li>
            <li>{t('Deleting a place, a review, a trip or a profile — no delete exists in this API', 'حذف مكان أو تقييم أو رحلة أو ملف — لا يوجد حذف في هذه الواجهة', 'supprimer un lieu, un avis, un voyage ou un profil — aucune suppression dans cette API')}</li>
            <li>{t('Reading passwords, tokens, emails, stored coordinates or AI conversations', 'قراءة كلمات المرور أو الرموز أو البريد أو الإحداثيات أو محادثات الذكاء الاصطناعي', 'lire mots de passe, jetons, e-mails, positions ou conversations IA')}</li>
            <li>{t('Bulk deletes, "reset the database", or any irreversible shortcut', 'الحذف الجماعي أو إعادة ضبط القاعدة أو أي اختصار غير قابل للتراجع', 'suppressions en masse, « reset », aucun raccourci irréversible')}</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Capability({ label, present, detail }: { label: string; present: boolean; detail: string }) {
  return (
    <div className="adm-evidence">
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <Pill state={present ? 'ok' : 'unknown'}>{present ? 'configured' : 'absent'}</Pill>
        <strong style={{ fontSize: '0.75rem' }}>{label}</strong>
      </div>
      <span className="adm-note">{detail}</span>
    </div>
  );
}

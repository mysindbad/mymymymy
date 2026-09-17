// The Admin Control Center shell: the gate, the rail, the tone and language switches, and the
// route table. The console is lazy-loaded from main.tsx and never mounts the consumer app, so
// its DOM, its stylesheet and its density stay its own — while the brand accent, type and
// Arabic/Latin pairing stay the same.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  Sparkles,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  LogOut,
  Moon,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Users,
} from 'lucide-react';
import './admin.css';
import { AdminLocaleProvider, useAdminLocale } from './locale-context';
import { AdminRouterProvider, useAdminRouter, useAdminSegments } from './router';
import { AdminSessionProvider, useAdminSession } from './session';
import { adminUrl, useAdminResource } from './useAdminData';
import { Button, Modal, Panel, Segmented, Toaster } from './ui';
import { applyAdminDocumentLocale, initialAdminLocale, setAdminLocale, type AdminLocale } from './locale';
import type { OverviewResponse } from './types';
import OverviewModule from './modules/Overview';
import PlacesModule from './modules/PlacesModule';
import ModerationModule from './modules/ModerationModule';
import ReviewsModule from './modules/ReviewsModule';
import TravelersModule from './modules/TravelersModule';
import AdministratorsModule from './modules/AdministratorsModule';
import ServiceHealthModule from './modules/ServiceHealthModule';
import AiOperationsModule from './modules/AiOperationsModule';
import AuditModule from './modules/AuditModule';
import SettingsModule from './modules/SettingsModule';

const TONE_KEY = 'sindbad-admin-tone';

type ModuleKey = 'overview' | 'places' | 'moderation' | 'reviews' | 'travelers' | 'administrators' | 'health' | 'ai' | 'audit' | 'settings';

interface NavEntry {
  key: ModuleKey;
  path: string;
  icon: typeof LayoutDashboard;
  group: 'operations' | 'catalogue' | 'people' | 'platform';
  title: { en: string; ar: string; fr: string };
  subtitle: { en: string; ar: string; fr: string };
}

const NAV: NavEntry[] = [
  {
    key: 'overview',
    path: '/admin',
    icon: LayoutDashboard,
    group: 'operations',
    title: { en: 'Overview', ar: 'نظرة عامة', fr: 'Vue générale' },
    subtitle: { en: 'Live counts from the tables the app reads', ar: 'عدادات مباشرة من الجداول التي يقرأها التطبيق', fr: 'Compteurs en direct des tables de l’app' },
  },
  {
    key: 'moderation',
    path: '/admin/moderation',
    icon: Inbox,
    group: 'operations',
    title: { en: 'Submissions', ar: 'الاقتراحات', fr: 'Propositions' },
    subtitle: { en: 'Places waiting for a decision, with the evidence', ar: 'أماكن تنتظر قرارا، مع الأدلة', fr: 'Lieux en attente, avec les preuves' },
  },
  {
    key: 'reviews',
    path: '/admin/reviews',
    icon: Activity,
    group: 'operations',
    title: { en: 'Reviews', ar: 'التقييمات', fr: 'Avis' },
    subtitle: { en: 'Moderation without touching the aggregate rules', ar: 'مراجعة دون المساس بقواعد الحساب', fr: 'Modération sans toucher aux règles de calcul' },
  },
  {
    key: 'audit',
    path: '/admin/audit',
    icon: ScrollText,
    group: 'operations',
    title: { en: 'Audit log', ar: 'سجل التدقيق', fr: 'Journal d’audit' },
    subtitle: { en: 'Append-only record of privileged changes', ar: 'سجل للإضافة فقط عن التغييرات المصاحِلة', fr: 'Journal en ajout seul des changements privilégiés' },
  },
  {
    key: 'places',
    path: '/admin/places',
    icon: Boxes,
    group: 'catalogue',
    title: { en: 'Places', ar: 'الأماكن', fr: 'Lieux' },
    subtitle: { en: 'Search, curate and decide — the main working screen', ar: 'بحث وتصحيح وقرار — شاشة العمل الرئيسية', fr: 'Rechercher, corriger, décider — l’écran principal' },
  },
  {
    key: 'travelers',
    path: '/admin/travelers',
    icon: Users,
    group: 'people',
    title: { en: 'Travellers', ar: 'المسافرون', fr: 'Voyageurs' },
    subtitle: { en: 'Profile metadata only — no email, no location, no trips', ar: 'البيانات الوصفية للملف فقط — لا بريد ولا موقع ولا رحلات', fr: 'Métadonnées de profil seulement — sans e-mail, position ni voyage' },
  },
  {
    key: 'administrators',
    path: '/admin/administrators',
    icon: ShieldCheck,
    group: 'people',
    title: { en: 'Administrators', ar: 'المشرفون', fr: 'Administrateurs' },
    subtitle: { en: 'The roster that unlocks this console', ar: 'القائمة التي تفتح هذه اللوحة', fr: 'La liste qui ouvre cette console' },
  },
  {
    key: 'health',
    path: '/admin/health',
    icon: Activity,
    group: 'platform',
    title: { en: 'Service health', ar: 'حالة الخدمات', fr: 'Santé des services' },
    subtitle: { en: 'Measured outcomes, plus probes you start on purpose', ar: 'نتائج مقاسة، وفحوص تباشرها بنفسك', fr: 'Résultats mesurés, plus des sondes déclenchées' },
  },
  {
    key: 'ai',
    path: '/admin/ai',
    icon: Sparkles,
    group: 'platform',
    title: { en: 'AI operations', ar: 'عمليات الذكاء الاصطناعي', fr: 'Opérations IA' },
    subtitle: { en: 'Availability, load and latency — never stored prompts', ar: 'التوفّر والحمل والزمن — لا أوامر مخزّنة', fr: 'Disponibilité, charge et latence — jamais de prompts' },
  },
  {
    key: 'settings',
    path: '/admin/settings',
    icon: SlidersHorizontal,
    group: 'platform',
    title: { en: 'Settings', ar: 'الإعدادات', fr: 'Réglages' },
    subtitle: { en: 'What is configurable here, and what is not', ar: 'ما يمكن ضبطه هنا وما لا يمكن', fr: 'Ce qui se règle ici, et ce qui ne se règle pas' },
  },
];

const GROUP_LABELS: Record<NavEntry['group'], { en: string; ar: string; fr: string }> = {
  operations: { en: 'Daily work', ar: 'العمل اليومي', fr: 'Travail courant' },
  catalogue: { en: 'Catalogue', ar: 'الكتالوج', fr: 'Catalogue' },
  people: { en: 'People', ar: 'الأشخاص', fr: 'Personnes' },
  platform: { en: 'Platform', ar: 'المنصّة', fr: 'Plateforme' },
};

export default function AdminRoot() {
  const [locale, setLocale] = useState<AdminLocale>(() => {
    const initial = initialAdminLocale();
    setAdminLocale(initial);
    return initial;
  });

  useEffect(() => {
    applyAdminDocumentLocale(locale);
  }, [locale]);

  return (
    <AdminLocaleProvider initial={locale}>
      <AdminRouterProvider>
        <AdminSessionProvider>
          <AdminShell />
          <Toaster />
        </AdminSessionProvider>
      </AdminRouterProvider>
    </AdminLocaleProvider>
  );
}

function AdminShell() {
  const { t, n, language, setLanguage } = useAdminLocale();
  const session = useAdminSession();
  const segments = useAdminSegments();
  const { navigate } = useAdminRouter();
  const [tone, setTone] = useState<'dark' | 'light'>(() => {
    try {
      return window.localStorage.getItem(TONE_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', tone === 'dark');
    try {
      window.localStorage.setItem(TONE_KEY, tone);
    } catch {
      // Storage policy can refuse; the in-memory tone still applies for this session.
    }
  }, [tone]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && ['input', 'textarea', 'select'].includes(target.tagName.toLowerCase());
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === '?') {
        event.preventDefault();
        setHelpOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const route = useMemo<{ entry: NavEntry; id: string | null }>(() => {
    const key = (segments[0] ?? 'overview') as ModuleKey;
    const entry = NAV.find((item) => item.key === key) ?? NAV[0];
    return { entry, id: segments[1] ?? null };
  }, [segments]);

  const pendingCount = usePendingBadge(session.status === 'granted');

  const moduleNode = (() => {
    switch (route.entry.key) {
      case 'places': return <PlacesModule placeId={route.id} />;
      case 'moderation': return <ModerationModule placeId={route.id} />;
      case 'reviews': return <ReviewsModule />;
      case 'travelers': return <TravelersModule userId={route.id} />;
      case 'administrators': return <AdministratorsModule />;
      case 'health': return <ServiceHealthModule />;
      case 'ai': return <AiOperationsModule />;
      case 'audit': return <AuditModule />;
      case 'settings': return <SettingsModule />;
      default: return <OverviewModule />;
    }
  })();

  const gate = <GateScreen />;

  return (
    <div className="sindbad-admin" data-admin-tone={tone}>
      <a className="adm-skip-link" href="#admin-content">
        {t('Skip to the main panel', 'انتقل إلى اللوحة الرئيسية', 'Aller au panneau principal')}
      </a>
      {session.status === 'granted' ? (
        <div className="adm-shell">
          <nav className="adm-rail" aria-label={t('Admin sections', 'أقسام اللوحة', 'Sections de la console')}>
            <div className="adm-brand">
              <span className="adm-brand-mark" aria-hidden="true">MS</span>
              <span className="adm-brand-text">
                <b>My Sindbad</b>
                <span>{t('control room', 'غرفة التحكم', 'salle de contrôle')}</span>
              </span>
            </div>
            {(['operations', 'catalogue', 'people', 'platform'] as const).map((group) => {
              const items = NAV.filter((item) => item.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="adm-nav-group-block">
                  <p className="adm-nav-group">{t(GROUP_LABELS[group].en, GROUP_LABELS[group].ar, GROUP_LABELS[group].fr)}</p>
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = route.entry.key === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className="adm-navlink"
                        aria-current={active ? 'page' : undefined}
                        onClick={() => navigate(item.path)}
                      >
                        <Icon size={14} aria-hidden="true" />
                        {t(item.title.en, item.title.ar, item.title.fr)}
                        {item.key === 'moderation' && pendingCount !== null && pendingCount > 0 ? (
                          <span className="adm-nav-badge adm-num" aria-label={t(`${pendingCount} waiting`, `${pendingCount} في الانتظار`, `${pendingCount} en attente`)}>
                            {n(pendingCount, 0)}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            <div className="adm-rail-foot">
              <span>{t('Privileges are checked on every request.', 'تُفحص الصلاحية في كل طلب.', 'Les privilèges sont vérifiés à chaque requête.')}</span>
              <span>{t('Nothing here can delete data.', 'لا يمكن حذف أي بيانات من هنا.', 'Rien ici ne supprime de données.')}</span>
            </div>
          </nav>

          <div className="adm-main">
            <header className="adm-topbar">
              <div>
                <h1>{t(route.entry.title.en, route.entry.title.ar, route.entry.title.fr)}</h1>
                <p className="adm-topbar-sub" style={{ margin: 0 }}>{t(route.entry.subtitle.en, route.entry.subtitle.ar, route.entry.subtitle.fr)}</p>
              </div>
              <div className="adm-topbar-actions">
                <Segmented
                  label={t('Console language', 'لغة اللوحة', 'Langue de la console')}
                  value={language}
                  onChange={(next) => setLanguage(next as AdminLocale)}
                  options={[
                    { value: 'en', label: 'EN' },
                    { value: 'fr', label: 'FR' },
                    { value: 'ar', label: 'ع' },
                  ]}
                />
                <Button
                  data-variant="ghost"
                  onClick={() => setTone((current) => (current === 'dark' ? 'light' : 'dark'))}
                  aria-label={tone === 'dark' ? t('Switch to light', 'التبديل إلى الفاتح', 'Passer en clair') : t('Switch to dark', 'التبديل إلى الداكن', 'Passer en sombre')}
                >
                  {tone === 'dark' ? <Sun size={13} aria-hidden="true" /> : <Moon size={13} aria-hidden="true" />}
                  {tone === 'dark' ? t('Light', 'فاتح', 'Clair') : t('Dark', 'داكن', 'Sombre')}
                </Button>
                <Button data-variant="ghost" onClick={() => setHelpOpen(true)} aria-label={t('Keyboard shortcuts', 'اختصارات لوحة المفاتيح', 'Raccourcis clavier')}>
                  <HelpCircle size={13} aria-hidden="true" />
                  ?
                </Button>
                <Button data-variant="ghost" onClick={() => void session.signOut()}>
                  <LogOut size={13} aria-hidden="true" />
                  {t('Sign out', 'تسجيل الخروج', 'Déconnexion')}
                </Button>
              </div>
            </header>
            <main className="adm-view" id="admin-content" tabIndex={-1}>
              {moduleNode}
            </main>
          </div>
        </div>
      ) : (
        gate
      )}

      {helpOpen ? (
        <Modal title={t('Keyboard layer', 'طبقة لوحة المفاتيح', 'Raccourcis clavier')} onClose={() => setHelpOpen(false)}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.375rem', fontSize: '0.8125rem' }}>
            {[
              ['/ · ' + t('focus the search field', 'تركيز حقل البحث', 'focus sur la recherche')],
              ['j / k · ' + t('move through table rows', 'التنقل بين صفوف الجدول', 'naviguer dans les lignes')],
              [t('Enter', 'Enter', 'Entrée') + ' · ' + t('open the selected record', 'فتح السجل المحدد', 'ouvrir la fiche sélectionnée')],
              ['a / n / x · ' + t('approve · needs changes · reject (in the place inspector)', 'اعتماد · يحتاج تعديلا · رفض (في لوحة المكان)', 'approuver · à modifier · rejeter (inspecteur)')],
              ['Esc · ' + t('close the inspector or dialog', 'إغلاق اللوحة أو النافذة', 'fermer l’inspecteur ou la boîte')],
              ['? · ' + t('this list', 'هذه القائمة', 'cette liste')],
            ].map((line) => (
              <li key={line}>
                <span className="adm-keyhint">{line}</span>
              </li>
            ))}
          </ul>
          <p className="adm-note" style={{ margin: 0 }}>
            {t('Shortcuts are ignored while you are typing, so nothing fires inside a form.', 'تُتجاهل الاختصارات أثناء الكتابة، فلا يُنفَّذ شيء داخل نموذج.', 'Les raccourcis sont ignorés pendant la saisie.')}</p>
        </Modal>
      ) : null}
    </div>
  );
}

/** The rail badge comes from the same snapshot the overview page reads - one cached RPC, no
 *  second counting endpoint and no invented number. */
function usePendingBadge(enabled: boolean) {
  const resource = useAdminResource<OverviewResponse>(enabled ? adminUrl('/api/admin/overview') : '');
  const byModeration = (resource.data?.overview.snapshot?.places?.by_moderation ?? {}) as Record<string, number>;
  return enabled ? Number(byModeration.pending ?? 0) : null;
}

function GateScreen() {
  const { t } = useAdminLocale();
  const session = useAdminSession();
  const { navigate } = useAdminRouter();
  const retry = useCallback(() => session.refresh(), [session]);

  if (session.status === 'probing') {
    return (
      <div className="adm-gate">
        <div className="adm-gate-card" role="status" aria-live="polite">
          <h1>{t('Checking your access', 'جارٍ التحقق من صلاحيتك', 'Vérification de vos droits')}</h1>
          <p>{t('The console asks the API which role this session holds on the administrators roster. It does not decide anything in the browser.',
              'تسأل اللوحة الواجهة عن الصلاحية التي يحملها هذا الحساب في قائمة المشرفين. لا تقرر شيئا في المتصفح.',
              'La console demande à l’API le rôle de cette session dans la liste des administrateurs. Rien n’est décidé dans le navigateur.')}</p>
          <span className="adm-skeleton" style={{ display: 'block' }} />
        </div>
      </div>
    );
  }

  if (session.status === 'granted') {
    // Reachable only for a frame between the probe and a re-check; never renders stale UI.
    return null;
  }

  if (session.status === 'denied') {
    return (
      <div className="adm-gate">
        <div className="adm-gate-card" role="alert">
          <h1>{t('This console is not open to your account', 'هذه اللوحة غير مفتوحة لحسابك', 'Cette console n’est pas ouverte à votre compte')}</h1>
          <p>
            {session.ownEmail
              ? t(`Signed in as ${session.ownEmail}. That account is not on the administrators roster.`, `أنت مسجّل كـ${session.ownEmail}. هذا الحساب ليس في قائمة المشرفين.`, `Connecté en tant que ${session.ownEmail}. Ce compte n’est pas dans la liste des administrateurs.`)
              : t('You are signed in with an account that is not on the administrators roster.', 'أنت مسجّل بحساب ليس في قائمة المشرفين.', 'Vous êtes connecté avec un compte absent de la liste des administrateurs.')}
          </p>
          <p className="adm-note">{t('Nothing is hidden client-side: the API refuses the data as well. If you expected access, ask a super administrator to add your account id in Administrators.',
              'لا شيء مخفي في المتصفح: الواجهة ترفض البيانات كذلك. إن كنت تتوقع الوصول، اطلب من مشرف أعلى إضافة معرّف حسابك من شاشة المشرفين.',
              'Rien n’est masqué côté client : l’API refuse aussi les données. Si vous attendiez un accès, demandez à un super-administrateur d’ajouter votre identifiant.')}</p>
          <div className="adm-gate-actions">
            <Button data-variant="ghost" onClick={() => { window.location.assign('/'); }}>{t('Back to the app', 'العودة إلى التطبيق', 'Retour à l’app')}</Button>
            <Button onClick={retry}>{t('Check again', 'تحقّق مرة أخرى', 'Vérifier à nouveau')}</Button>
            <Button data-variant="ghost" onClick={() => { void session.signOut(); }}>{t('Switch account', 'تغيير الحساب', 'Changer de compte')}</Button>
          </div>
        </div>
      </div>
    );
  }

  if (session.status === 'anonymous') {
    return (
      <div className="adm-gate">
        <div className="adm-gate-card">
          <h1>{t('Administrator sign-in', 'تسجيل دخول المشرف', 'Connexion administrateur')}</h1>
          <p>{t('This is the same account system as the traveller app: sign in with an account that the roster lists, and the console opens.',
              'نظام الحسابات نفسه المستخدم في تطبيق المسافرين: سجّل الدخول بحساب مدرج في القائمة لتفتح اللوحة.',
              'Le même système de comptes que l’app voyageurs : connectez-vous avec un compte listé pour ouvrir la console.')}</p>
          <div className="adm-gate-actions">
            <Button data-variant="primary" onClick={session.signIn}>{t('Sign in', 'تسجيل الدخول', 'Se connecter')}</Button>
            <Button data-variant="ghost" onClick={retry}>{t('Check again', 'تحقّق مرة أخرى', 'Vérifier à nouveau')}</Button>
          </div>
        </div>
      </div>
    );
  }

  if (session.status === 'unavailable') {
    return (
      <div className="adm-gate">
        <div className="adm-gate-card" role="alert">
          <h1>{t('The admin data service is not configured', 'خدمة بيانات المشرفين غير مضبوطة', 'Le service de données admin n’est pas configuré')}</h1>
          <p>{t('This deployment has no server-side Supabase credentials, so no privileged read can be authorised. The console would have nothing truthful to show, so it shows this instead of an empty dashboard.',
              'لا يحتوي هذا النشر على بيانات Supabase الخاصة بالخادم، لذا لا يمكن التفويض بأي قراءة مميّزة. بدلا من عرض أصفار بلا معن، تعرض هذه الرسالة.',
              'Ce déploiement n’a pas d’identifiants Supabase côté serveur : aucune lecture privilégiée ne peut être autorisée. La console affiche ceci plutôt qu’un tableau vide.')}</p>
          <div className="adm-gate-actions">
            <Button onClick={retry}>{t('Try again', 'إعادة المحاولة', 'Réessayer')}</Button>
            <Button data-variant="ghost" onClick={() => navigate('/')}>{t('Open the traveller app', 'افتح تطبيق المسافرين', 'Ouvrir l’app voyageurs')}</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="adm-gate">
      <div className="adm-gate-card">
        <h1>{t('The console could not reach the API', 'لم تصل اللوحة إلى الواجهة', 'La console n’a pas pu joindre l’API')}</h1>
        <p>{t('The access probe failed. Nothing was assumed: an unreachable API is shown as unreachable, never as authorised.',
              'فشل فحص الصلاحية. لم يُفترض شيء: الواجهة غير المتاحة تُعرض كذلك، لا مفوّضة.',
              'La vérification d’accès a échoué. Une API injoignable est affichée comme telle, jamais comme autorisée.')}</p>
        <div className="adm-gate-actions">
          <Button data-variant="primary" onClick={retry}>{t('Try again', 'إعادة المحاولة', 'Réessayer')}</Button>
        </div>
      </div>
    </div>
  );
}


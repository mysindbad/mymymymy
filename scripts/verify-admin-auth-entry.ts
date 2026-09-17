/**
 * Sign-in entry-point contracts.
 *
 * Source-level guards for the R52 fix. The behaviour itself is proved in a real browser by
 * tests/e2e/auth-entry.spec.ts (admin: Sign in -> Google visible with no "Get Started" step;
 * traveller: the welcome screen is intact). This file stops the two halves from drifting apart in
 * a refactor, the same way the other verify-* scripts guard rules that span files:
 *
 *   * the Admin Control Center opens the shared auth modal on the method screen, because an
 *     operator who already clicked "Sign in" should not be sent through traveller onboarding;
 *   * the traveller app keeps its onboarding welcome screen;
 *   * the Google button is the real Supabase OAuth call, not a lookalike link.
 */

import { readFileSync } from 'node:fs';

const ADMIN_SESSION = 'src/admin/session.tsx';
const AUTH_MODAL = 'src/components/AuthFlowModal.tsx';
const CONSUMER_APP = 'src/App.tsx';
const ADMIN_ROOT = 'src/admin/AdminRoot.tsx';

/** Collapse whitespace so JSX attributes can be matched regardless of formatting. */
function flat(path: string): string {
  return readFileSync(path, 'utf8').replace(/\s+/g, ' ');
}

function requires(path: string, patterns: string[], why: string) {
  const source = flat(path);
  for (const pattern of patterns) {
    if (!source.includes(pattern)) {
      throw new Error(`${path} is missing ${why}: ${pattern}`);
    }
  }
}

// ---------------------------------------------------------------- the admin entry point
// One modal, one prop: the console asks for the method screen explicitly instead of inheriting
// the traveller default.
// Matched on the element rather than adjacent text: comments and props may sit between them.
if (/<AuthFlowModal\b[^>]*initialScreen="sign-in-method"/.test(flat(ADMIN_SESSION)) === false) {
  throw new Error(
    `${ADMIN_SESSION}: the admin sign-in modal must open on the method screen ` +
      '(initialScreen="sign-in-method") so Google is visible as soon as an operator clicks Sign in',
  );
}
// The gate button has to be wired to the same action that opens it.
requires(
  ADMIN_ROOT,
  ['onClick={session.signIn}'],
  'the administrator gate must have a Sign in control that opens the auth flow',
);

// ---------------------------------------------------------------- the traveller flow is untouched
requires(
  CONSUMER_APP,
  ["const [authInitialScreen, setAuthInitialScreen] = useState<AuthScreenType>('welcome')"],
  'the traveller app must keep opening auth on the welcome screen',
);
requires(
  CONSUMER_APP,
  ['const handleOpenAuth = (screen: AuthScreenType = \'welcome\') => {'],
  'traveller entry points must default to the welcome screen, not inherit an admin-only default',
);
if (/initialScreen=\{authInitialScreen\}/.test(flat(CONSUMER_APP)) === false) {
  throw new Error(`${CONSUMER_APP}: the traveller modal must keep using its own initial screen state`);
}

// ---------------------------------------------------------------- Google is the real OAuth call
requires(
  AUTH_MODAL,
  ['await supabase.auth.signInWithOAuth({ provider: \'google\','],
  'the Google button must call Supabase OAuth',
);
requires(
  AUTH_MODAL,
  ['redirectTo: getAuthRedirectUrl()'],
  'the Google button must carry a redirect back into the app',
);
// The three options the method screen must offer, and the onboarding step it must not require.
requires(
  AUTH_MODAL,
  [
    "currentScreen === 'sign-in-method' && (",
    "localize('Continue with Google'",
    "localize('Continue with email'",
    "localize('Create an account'",
  ],
  'the method screen must offer Google, email and account creation',
);
// A link that only looks like Google would be a fake control.
for (const fake of ['href="https://accounts.google.com', 'window.location = \'https://accounts.google.com']) {
  if (flat(AUTH_MODAL).includes(fake)) {
    throw new Error(`${AUTH_MODAL}: Google sign-in must go through Supabase, not a hand-built link (${fake})`);
  }
}

console.log('Admin and traveller sign-in entry contracts verified');

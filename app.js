// Pekora bootstrap: theme, shell (header / sidebar / bottom bar), auth state and routes.
import { configured, config } from './firebase.js';
import { state, on, isLoggedIn } from './state.js';
import { route, setNotFound, startRouter, navigate } from './router.js';
import { bootAuth, openAuthModal, logOut } from './auth.js';
import { initSearchbar } from './qrox.js';
import { startInbox, stopInbox, unreadCount } from './inbox.js';
import { hydrate } from './data.js';
import { html, icon, avatarOf, $, $$, toast } from './util.js';

// ---------------------------------------------------------------- theme
const THEME_KEY = 'pekora.theme';
const getPref = () => { try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch { return 'auto'; } };
function applyTheme() {
  const pref = getPref();
  const dark = pref === 'dark' || (pref === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0f0f14' : '#ffffff');
}
export function cycleTheme() {
  const next = { auto: 'dark', dark: 'light', light: 'auto' }[getPref()];
  try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
  applyTheme();
  toast(`Theme: ${next}`);
  return next;
}
export const themePref = getPref;
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
applyTheme();

// ---------------------------------------------------------------- setup screen (no Firebase config yet)
function showSetup() {
  const missing = ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_STORAGE_BUCKET', 'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_APP_ID'];
  document.getElementById('app').innerHTML = String(html`
    <main class="setup">
      <img src="/assets/logo-mark.svg" width="64" height="64" alt="pekora">
      <h1>Almost there — connect Firebase</h1>
      <p class="muted">Pekora's server is running, but it has no Firebase web-app config yet. In Render → your service → <b>Environment</b>, add:</p>
      <pre>${missing.join('\n')}</pre>
      <p class="muted">Find these values in the Firebase console → Project settings → Your apps → Web app. Then redeploy. The full walkthrough is in <b>README.md</b>.</p>
    </main>`);
}

// ---------------------------------------------------------------- shell
const NAV = [
  { href: '/', icon: 'home', label: 'Home' },
  { href: '/shorts', icon: 'shorts', label: 'Shorts' },
  { href: '/live', icon: 'live', label: 'Live' },
  { href: '/subscriptions', icon: 'bell', label: 'Subscriptions', auth: true },
  { href: '/messages', icon: 'message', label: 'Messages', auth: true, badge: true },
];

function buildShell() {
  document.getElementById('app').innerHTML = String(html`
    <header class="topbar">
      <div class="tb-left">
        <button class="icon-btn" id="btn-menu" aria-label="Menu">${icon('menu')}</button>
        <a class="logo" href="/" aria-label="pekora home">
          <img class="logo-full logo-light" src="/assets/logo-full.svg" alt="pekora" height="30">
          <img class="logo-full logo-dark" src="/assets/logo-full-dark.svg" alt="pekora" height="30">
          <img class="logo-mark" src="/assets/logo-mark.svg" alt="pekora" width="32" height="32">
        </a>
      </div>

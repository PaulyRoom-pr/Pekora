import { toast } from './util.js';

const KEY = 'pekora.theme';
export const themePref = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } };

export function applyTheme() {
  const pref = themePref();
  const dark = pref === 'dark' || (pref === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0f0f14' : '#ffffff');
}
export function setTheme(pref) {
  try { localStorage.setItem(KEY, pref); } catch { /* storage blocked */ }
  applyTheme();
}
export function cycleTheme() {
  const next = { auto: 'dark', dark: 'light', light: 'auto' }[themePref()];
  setTheme(next);
  toast(`Theme: ${next}`);
  return next;
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
applyTheme();

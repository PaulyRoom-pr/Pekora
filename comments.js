// Comments with replies, GIFs and images (and the GIF picker).
import {
  db, collection, doc, addDoc, deleteDoc, getDocs, query, orderBy, limit, serverTimestamp, getCountFromServer,
} from '../firebase.js';
import { state, on } from '../state.js';
import { hydrate, uploadFile } from '../data.js';
import { requireLogin } from '../auth.js';
import { resizeImage } from '../media.js';
import { html, raw, icon, toast, timeAgo, modal, toEl, busy, debounce, randomId, confirmDialog, esc, fmtCount } from '../util.js';

const httpsOnly = (u) => (typeof u === 'string' && u.startsWith('https://') ? u : '');

export function openImage(url) {
  const u = httpsOnly(url);
  if (!u) return;
  modal(html`<img class="zoom-img" src="${u}" alt="">`, { title: 'Image', wide: true, className: 'zoom' });
}

// ---------------------------------------------------------------- GIF picker
export function openGifPicker(onPick) {
  const m = modal(html`
    <div class="gif-picker">
      <div class="input-prefix"><b>${icon('search', 18)}</b><input type="search" placeholder="Search GIFs" aria-label="Search GIFs"></div>
      <div class="gif-grid" aria-live="polite"><p class="muted">Loading…</p></div>
      <p class="muted tiny">GIFs via GIPHY</p>
    </div>`, { title: 'Add a GIF', wide: true });
  const grid = m.body.querySelector('.gif-grid');
  const input = m.body.querySelector('input');
  const pick = (url) => { m.close(); onPick(url); };

  const fallback = () => {
    grid.innerHTML = String(html`<form class="stack" data-paste>
      <p class="muted">GIF search is not set up on this server (add a GIPHY_API_KEY), but you can paste a link to any GIF.</p>
      <input type="url" name="url" placeholder="https://…/funny.gif" required>
      <button class="btn btn-primary">Use this GIF</button></form>`);
    grid.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      const u = httpsOnly(e.target.url.value.trim());
      if (!u) return toast('The GIF link must start with https://', 'error');
      pick(u);
    };
    input.disabled = true;
  };
  let seq = 0;
  const search = async () => {
    const mine = ++seq;
    try {
      const r = await fetch('/api/gifs?q=' + encodeURIComponent(input.value.trim()));
      if (r.status === 503) return fallback();
      if (!r.ok) throw new Error('gif search failed');
      const { results } = await r.json();
      if (mine !== seq) return;
      grid.innerHTML = results.length
        ? String(html`${results.map((g) => html`<button type="button" class="gif-item" data-url="${g.url}" aria-label="${g.title || 'GIF'}"><img src="${g.preview}" alt="${g.title}" loading="lazy" style="aspect-ratio:${g.w}/${g.h}"></button>`)}`)
        : '<p class="muted">No GIFs found.</p>';
      grid.querySelectorAll('.gif-item').forEach((b) => (b.onclick = () => pick(b.dataset.url)));
    } catch {
      if (mine === seq) grid.innerHTML = '<p class="muted">Could not load GIFs right now.</p>';
    }
  };
  input.addEventListener('input', debounce(search, 350));
  search();
}

// ---------------------------------------------------------------- composer
function composer({ placeholder = 'Add a comment…', submitLabel = 'Comment', onSubmit, onCancel, autofocus = false }) {
  const el = toEl(html`<div class="composer">

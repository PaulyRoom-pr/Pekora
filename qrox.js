// Qrox — the AI assistant in the search bar.
// 1. press the "Qrox" button, 2. type e.g. "show me videos like this" or "videos about space",
// 3. the server asks Groq to turn that into search queries (the API key never reaches the browser),
// 4. we search Pekora with those queries and put the matches on the For You page.
import { state, setCurrentVideo, setQroxPicks, getQroxPicks } from './state.js';
import { searchByQueries } from './data.js';
import { navigate } from './router.js';
import { html, icon, esc, toast, debounce } from './util.js';

const slim = (v) => ({
  id: v.id, kind: v.kind, title: v.title, thumbURL: v.thumbURL || '', ownerUid: v.ownerUid, duration: v.duration || 0,
  views: v.views || 0, createdMs: v.createdMs, viewerCount: v.viewerCount || 0,
});

export function initSearchbar() {
  const form = document.getElementById('searchbar');
  const input = document.getElementById('q');
  const btn = document.getElementById('btn-qrox');
  const panel = document.getElementById('qrox-panel');
  let qroxOn = false;
  let busy = false;
  const thread = []; // {role:'user'|'qrox', text, queries?}

  const context = () => state.currentVideo || state.lastWatched || null;

  const setMode = (on) => {
    qroxOn = on;
    btn.setAttribute('aria-pressed', String(on));
    form.classList.toggle('qrox-on', on);
    input.placeholder = on ? 'Ask Qrox… e.g. “show me videos like this”' : 'Search';
    input.setAttribute('aria-label', on ? 'Ask Qrox' : 'Search');
    panel.hidden = !on;
    if (on) { draw(); input.focus(); }
  };

  const chips = () => {
    const ctx = context();
    const list = [
      ...(ctx ? ['Show me videos like this'] : []),
      'Show me videos about space', 'Funny shorts', 'Live streams right now',
    ];
    return list.map((t) => `<button type="button" class="chip-btn" data-chip="${esc(t)}">${esc(t)}</button>`).join('');
  };

  function draw(thinking = false) {
    const ctx = context();
    panel.innerHTML = String(html`
      <div class="qx-head">${icon('sparkles', 18)}<b>Qrox</b><span class="muted">AI search for Pekora</span>
        <button type="button" class="icon-btn" data-qx-close aria-label="Close Qrox">${icon('x', 18)}</button></div>
      ${ctx ? html`<p class="qx-ctx">${icon('play', 14)} I can see you are on <b>${ctx.title}</b>.</p>` : html`<p class="qx-ctx muted">Open a video and I can find more like it. Or just tell me what you want to see.</p>`}
      <div class="qx-thread" aria-live="polite">
        ${thread.map((m) => html`<div class="qx-msg ${m.role}"><p>${m.text}</p>
          ${m.queries?.length ? html`<div class="qx-queries">${m.queries.map((q) => html`<span class="chip-sm">${q}</span>`)}</div>` : ''}</div>`)}
        ${thinking ? html`<div class="qx-msg qrox"><p class="qx-dots"><i></i><i></i><i></i> Qrox is thinking…</p></div>` : ''}
      </div>
      <div class="qx-chips">${(window.__raw ? '' : '')}</div>`);
    panel.querySelector('.qx-chips').innerHTML = chips();
    panel.querySelector('[data-qx-close]').onclick = () => setMode(false);
    panel.querySelectorAll('[data-chip]').forEach((b) => (b.onclick = () => { input.value = b.dataset.chip; ask(b.dataset.chip); }));
    const t = panel.querySelector('.qx-thread');
    t.scrollTop = t.scrollHeight;
  }

  async function ask(message) {
    message = message.trim();

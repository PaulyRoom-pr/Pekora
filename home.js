// Home = the "For you" page. Qrox can replace its top section with AI-picked videos.
import { fetchVideos, fetchLive, hydrate } from '../data.js';
import { getQroxPicks, setQroxPicks, on, isLoggedIn, setCurrentVideo } from '../state.js';
import { videoCard, shortCard, emptyState, skeletonGrid } from '../components/cards.js';
import { openAuthModal } from '../auth.js';
import { html, icon, raw } from '../util.js';
import { notifyContextChanged } from '../qrox.js';

export default async function home(ctx) {
  ctx.title('');
  setCurrentVideo(null);
  notifyContextChanged();
  const el = ctx.el;
  let filter = 'all';
  let data = null;

  el.innerHTML = String(html`<div class="page">
    <div class="chips" role="tablist" aria-label="Filter">
      ${[['all', 'All'], ['video', 'Videos'], ['short', 'Shorts'], ['live', 'Live']].map(([k, l]) => html`<button class="chip ${k === 'all' ? 'active' : ''}" data-f="${k}" role="tab">${l}</button>`)}
    </div>
    <div data-picks></div>
    <div data-body>${skeletonGrid(8)}</div>
  </div>`);

  const picksBox = el.querySelector('[data-picks]');
  const body = el.querySelector('[data-body]');

  function drawPicks() {
    const p = getQroxPicks();
    if (!p) { picksBox.innerHTML = ''; return; }
    picksBox.innerHTML = String(html`<section class="qx-banner">
      <div class="qx-banner-head">
        <span class="qx-badge">${icon('sparkles', 16)} Qrox picks</span>
        <div class="grow"><h2>${p.message}</h2><p class="muted">${p.reply}${p.degraded ? ' (AI was unavailable, so I used your keywords.)' : ''}</p>
          <div class="qx-queries">${(p.queries || []).map((q) => html`<a class="chip-sm" href="/results?q=${encodeURIComponent(q)}">${q}</a>`)}</div></div>
        <button class="btn btn-soft btn-pill" data-clear>Back to normal For you</button>
      </div>
      ${p.videos.length
        ? html`<div class="grid">${p.videos.map((v) => videoCard(v))}</div>`
        : html`<p class="muted pad">Nothing on Pekora matches that yet. Try different words, or upload something!</p>`}
    </section>`);
    picksBox.querySelector('[data-clear]').onclick = () => setQroxPicks(null);
    hydrate(picksBox);
  }

  function drawBody() {
    if (!data) return;
    const { videos, shorts, live } = data;
    const showV = filter === 'all' || filter === 'video';
    const showS = filter === 'all' || filter === 'short';
    const showL = filter === 'all' || filter === 'live';
    const hasAny = videos.length || shorts.length || live.length;
    if (!hasAny) {
      body.innerHTML = String(emptyState(
        'Nothing to watch yet',
        'Pekora is brand new. Be the first to upload a video, post a short or go live!',
        isLoggedIn()
          ? '<div class="row center gap"><a class="btn btn-primary btn-pill" href="/upload?type=video">Upload a video</a><a class="btn btn-soft btn-pill" href="/go-live">Go live</a></div>'
          : '<button class="btn btn-primary btn-pill" data-signup>Sign up to create</button>'
      ));
      body.querySelector('[data-signup]')?.addEventListener('click', () => openAuthModal('signup'));
      return;
    }
    body.innerHTML = String(html`
      ${showL && live.length ? html`<section><h2 class="sec-title"><span class="live-dot"></span> Live now</h2><div class="grid">${live.map((v) => videoCard(v))}</div></section>` : ''}

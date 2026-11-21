import { getUserByName, getUser, fetchVideos, theySubscribeToMe, isSubscribed, hydrate } from '../data.js';
import { state, setCurrentVideo } from '../state.js';
import { mountSubscribe } from '../components/social.js';
import { videoCard, shortCard, emptyState, skeletonGrid } from '../components/cards.js';
import { html, avatarOf, fmtCount, icon, raw } from '../util.js';

export default async function channel(ctx) {
  setCurrentVideo(null);
  const el = ctx.el;
  el.innerHTML = '<div class="page"><p class="muted">Loading channel…</p></div>';
  const found = await getUserByName(ctx.params.name);
  if (!ctx.alive()) return;
  if (!found) {
    el.innerHTML = String(emptyState('Channel not found', `Nobody is called @${ctx.params.name} on Pekora.`, '<a class="btn btn-primary btn-pill" href="/">Go home</a>'));
    return;
  }
  const u = await getUser(found.id, { fresh: true });
  if (!ctx.alive()) return;
  ctx.title(u.displayName);
  const mine = state.user?.uid === u.id;
  let subs = u.subscribersCount || 0;
  let tab = ctx.query.get('tab') || 'videos';

  el.innerHTML = String(html`<div class="channel">
    <div class="banner" ${u.bannerURL ? raw(`style="background-image:url('${encodeURI(u.bannerURL).replace(/'/g, '%27')}')"`) : ''}></div>
    <div class="page">
      <header class="chan-head">
        <img class="avatar xl" src="${avatarOf(u)}" alt="">
        <div class="chan-info">
          <h1>${u.displayName}</h1>
          <p class="muted">@${u.username} • <span data-subs>${fmtCount(subs)} subscribers</span></p>
          <p class="muted clamp" data-bio>${u.bio || ''}</p>
          <div class="row gap wrap" data-actions>
            ${mine
              ? html`<a class="btn btn-soft btn-pill" href="/settings">${icon('edit', 18)} Customize channel</a><a class="btn btn-primary btn-pill" href="/go-live">${icon('live', 18)} Go live</a>`
              : html`<span data-sub></span><span data-dm></span>`}
          </div>
        </div>
      </header>
      <div class="tabs" role="tablist">
        ${[['videos', 'Videos'], ['shorts', 'Shorts'], ['live', 'Live'], ['about', 'About']].map(([k, l]) => html`<button class="tab ${k === tab ? 'active' : ''}" data-tab="${k}" role="tab">${l}</button>`)}
      </div>
      <div data-body></div>
    </div>
  </div>`);

  const subsEl = el.querySelector('[data-subs]');
  async function refreshDm() {
    const slot = el.querySelector('[data-dm]');
    if (!slot || !state.user) return;
    try {
      const mutual = (await isSubscribed(state.user.uid, u.id)) && (await theySubscribeToMe(state.user.uid, u.id));
      slot.innerHTML = mutual ? String(html`<a class="btn btn-soft btn-pill" href="/messages/${u.username}">${icon('message', 18)} Message</a>`) : '';
    } catch { /* not mutual or offline */ }
  }
  if (!mine) {
    ctx.onCleanup(mountSubscribe(el.querySelector('[data-sub]'), u.id, {
      onChange: (d) => { subs += d; subsEl.textContent = `${fmtCount(subs)} subscribers`; refreshDm(); },
    }));
    refreshDm();
  }

  const body = el.querySelector('[data-body]');
  const loaded = {};
  async function drawTab() {
    el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'about') {

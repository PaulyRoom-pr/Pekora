// Vertical, snap-scrolling Shorts feed.
import { fetchVideos, getVideo, getUser, hydrate, countView } from '../data.js';
import { state, setCurrentVideo } from '../state.js';
import { mountReactions, mountSubscribe, shareButton } from '../components/social.js';
import { mountComments } from '../components/comments.js';
import { emptyState } from '../components/cards.js';
import { notifyContextChanged } from '../qrox.js';
import { html, icon, modal, avatarOf } from '../util.js';

export default async function shorts(ctx) {
  ctx.title('Shorts');
  const el = ctx.el;
  el.innerHTML = '<div class="shorts-wrap"><p class="muted pad">Loading shorts…</p></div>';
  let list = await fetchVideos({ kind: 'short', max: 30 });
  const startId = ctx.params.id;
  if (startId) {
    const first = list.find((s) => s.id === startId) || (await getVideo(startId));
    if (first && first.kind === 'short') list = [first, ...list.filter((s) => s.id !== startId)];
  }
  if (!ctx.alive()) return;
  if (!list.length) {
    el.innerHTML = String(emptyState('No shorts yet', 'Be the first to post one.', '<a class="btn btn-primary btn-pill" href="/upload?type=short">Upload a short</a>'));
    return;
  }

  let muted = !(navigator.userActivation?.hasBeenActive);
  const owners = new Map();
  await Promise.all([...new Set(list.map((s) => s.ownerUid))].map(async (id) => owners.set(id, await getUser(id))));
  if (!ctx.alive()) return;

  el.innerHTML = String(html`<div class="shorts-wrap"><div class="shorts-feed" tabindex="0">
    ${list.map((s, i) => html`<section class="short-item" data-i="${i}" data-id="${s.id}" aria-label="${s.title}">
      <div class="short-frame">
        <video loop playsinline preload="none" ${s.thumbURL ? html`poster="${s.thumbURL}"` : ''}></video>
        <button class="short-hit" aria-label="Play or pause"></button>
        <div class="short-info">
          <a class="short-chan" href="/@${owners.get(s.ownerUid)?.username || ''}"><img class="avatar sm" src="${avatarOf(owners.get(s.ownerUid) || { id: s.ownerUid })}" alt=""><b>@${owners.get(s.ownerUid)?.username || 'unknown'}</b></a>
          <span data-sub></span>
          <p class="short-title">${s.title}</p>
        </div>
      </div>
      <div class="short-rail">
        <span data-react></span>
        <button class="rail-btn" data-comments aria-label="Comments">${icon('message', 26)}<span>Comments</span></button>
        <span data-share></span>
        <button class="rail-btn" data-mute aria-label="Mute or unmute">${icon(muted ? 'mute' : 'volume', 26)}<span>Sound</span></button>
      </div>
    </section>`)}
  </div></div>`);

  const feed = el.querySelector('.shorts-feed');
  const items = [...feed.querySelectorAll('.short-item')];
  const mounted = new Set();
  const cleanups = [];
  let active = -1;

  const setSrc = (i, on) => {
    const v = items[i]?.querySelector('video');
    if (!v) return;
    if (on && !v.getAttribute('src')) { v.src = list[i].videoURL; v.preload = 'auto'; }
    if (!on && v.getAttribute('src')) { v.pause(); v.removeAttribute('src'); v.load(); }
  };

  function activate(i) {
    if (i === active) return;
    active = i;
    items.forEach((it, j) => {
      const vid = it.querySelector('video');
      if (j === i) return;
      vid.pause();

import { db, doc, updateDoc } from '../firebase.js';
import {
  getVideo, getUser, hydrate, countView, deleteVideo, searchVideos, fetchVideos, buildTokens, parseTags,
} from '../data.js';
import { state, setCurrentVideo } from '../state.js';
import { navigate } from '../router.js';
import { mountSubscribe, mountReactions, shareButton } from '../components/social.js';
import { mountComments } from '../components/comments.js';
import { rowCard, emptyState } from '../components/cards.js';
import { watchTogether } from '../components/partyPicker.js';
import { notifyContextChanged } from '../qrox.js';
import { html, icon, fmtCount, avatarOf, modal, toast, confirmDialog, busy } from '../util.js';

export default async function watch(ctx) {
  const id = ctx.params.id;
  const el = ctx.el;
  el.innerHTML = '<div class="page"><div class="player-skel sk-box"></div></div>';
  const v = await getVideo(id);
  if (!ctx.alive()) return;
  if (!v) { el.innerHTML = String(emptyState('Video not found', 'It may have been removed.', '<a class="btn btn-primary btn-pill" href="/">Go home</a>')); return; }
  if (v.kind === 'live') return navigate(`/live/${id}`, { replace: true });
  if (v.kind === 'short') return navigate(`/shorts/${id}`, { replace: true });

  const owner = await getUser(v.ownerUid, { fresh: true });
  if (!ctx.alive()) return;
  ctx.title(v.title);
  const isOwner = state.user?.uid === v.ownerUid;
  let subs = owner?.subscribersCount || 0;

  // let Qrox know what is being watched
  const context = { id, kind: v.kind, title: v.title, description: v.description, tags: v.tags, channel: owner?.displayName, ownerUid: v.ownerUid };
  setCurrentVideo(context);
  notifyContextChanged();
  ctx.onCleanup(() => { setCurrentVideo(null); notifyContextChanged(); });

  el.innerHTML = String(html`<div class="watch">
    <div class="watch-main">
      <div class="player-wrap"><video id="player" controls playsinline autoplay preload="metadata" ${v.thumbURL ? html`poster="${v.thumbURL}"` : ''} src="${v.videoURL}"></video></div>
      <h1 class="watch-title">${v.title}</h1>
      <div class="watch-bar">
        <a class="chan-block" href="/@${owner?.username || ''}">
          <img class="avatar lg" src="${avatarOf(owner || { id: v.ownerUid })}" alt="">
          <div><b>${owner?.displayName || 'Unknown'}</b><div class="muted" data-subs>${fmtCount(subs)} subscribers</div></div>
        </a>
        <span data-sub></span>
        <div class="watch-actions">
          <span data-react></span>
          <span data-share></span>
          <button class="btn btn-soft btn-pill" data-party>${icon('tv', 18)} Watch together</button>
          ${isOwner ? html`<button class="btn btn-soft btn-pill" data-edit>${icon('edit', 18)} Edit</button><button class="btn btn-soft btn-pill danger" data-del>${icon('trash', 18)} Delete</button>` : ''}
        </div>
      </div>
      <div class="desc-box" data-desc tabindex="0" role="button" aria-expanded="false">
        <b>${fmtCount(v.views || 0)} views • ${new Date(v.createdMs).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</b>
        <p class="pre clamp3" data-text>${v.description || 'No description.'}</p>
        <div class="tag-row">${(v.tags || []).map((t) => html`<a class="chip-sm" href="/results?q=${encodeURIComponent(t)}">#${t}</a>`)}</div>
      </div>
      <div data-comments></div>
    </div>

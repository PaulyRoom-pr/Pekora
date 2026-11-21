// Viewer page for a live stream: video (WebRTC) + live chat + likes/dislikes.
import { db, doc, onSnapshot } from '../firebase.js';
import { getVideo, getUser, hydrate, toVideo, isFresh } from '../data.js';
import { state, setCurrentVideo, isLoggedIn } from '../state.js';
import { navigate } from '../router.js';
import { Viewer } from '../rtc.js';
import { mountChat } from '../components/chat.js';
import { mountSubscribe, mountReactions, shareButton } from '../components/social.js';
import { emptyState } from '../components/cards.js';
import { openAuthModal } from '../auth.js';
import { notifyContextChanged } from '../qrox.js';
import { html, icon, avatarOf, fmtCount } from '../util.js';

export default async function stream(ctx) {
  const id = ctx.params.id;
  const el = ctx.el;
  el.innerHTML = '<div class="page"><div class="player-skel sk-box"></div></div>';
  const v0 = await getVideo(id);
  if (!ctx.alive()) return;
  if (!v0) { el.innerHTML = String(emptyState('Stream not found', 'It may have been removed.', '<a class="btn btn-primary btn-pill" href="/live">See who is live</a>')); return; }
  if (v0.kind === 'short') return navigate(`/shorts/${id}`, { replace: true });
  if (v0.kind === 'video') return navigate(`/watch/${id}`, { replace: true });

  const owner = await getUser(v0.ownerUid, { fresh: true });
  if (!ctx.alive()) return;
  ctx.title(v0.title);
  let subs = owner?.subscribersCount || 0;
  let v = v0;

  setCurrentVideo({ id, kind: 'live', title: v0.title, description: v0.description, tags: v0.tags, channel: owner?.displayName, ownerUid: v0.ownerUid });
  notifyContextChanged();
  ctx.onCleanup(() => { setCurrentVideo(null); notifyContextChanged(); });

  el.innerHTML = String(html`<div class="watch stream-page">
    <div class="watch-main">
      <div class="player-wrap stream-player">
        <video id="live-video" playsinline autoplay></video>
        <div class="stream-overlay" data-overlay><div class="spinner"></div><p>Connecting to the stream…</p></div>
        <button class="btn btn-soft btn-pill unmute" data-unmute hidden>${icon('mute', 18)} Tap to unmute</button>
      </div>
      <div class="live-line"><span class="badge badge-live big" data-livebadge>LIVE</span><span data-viewers class="muted"></span></div>
      <h1 class="watch-title">${v.title}</h1>
      <div class="watch-bar">
        <a class="chan-block" href="/@${owner?.username || ''}"><img class="avatar lg" src="${avatarOf(owner || { id: v.ownerUid })}" alt="">
          <div><b>${owner?.displayName || 'Unknown'}</b><div class="muted" data-subs>${fmtCount(subs)} subscribers</div></div></a>
        <span data-sub></span>
        <div class="watch-actions"><span data-react></span><span data-share></span></div>
      </div>
      <div class="desc-box static"><p class="pre">${v.description || 'No description.'}</p>
        <div class="tag-row">${(v.tags || []).map((t) => html`<a class="chip-sm" href="/results?q=${encodeURIComponent(t)}">#${t}</a>`)}</div></div>
    </div>
    <aside class="chat-col" data-chat></aside>
  </div>`);

  const video = el.querySelector('#live-video');
  const overlay = el.querySelector('[data-overlay]');
  const unmuteBtn = el.querySelector('[data-unmute]');
  const say = (text, spinner = false) => { overlay.hidden = false; overlay.innerHTML = `${spinner ? '<div class="spinner"></div>' : ''}<p>${text}</p>`; };

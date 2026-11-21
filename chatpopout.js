// /chat/:id — a chat-only window for the creator (second screen, OBS browser dock, phone…).
import { db, doc, onSnapshot } from '../firebase.js';
import { getVideo, toVideo, isFresh } from '../data.js';
import { mountChat } from '../components/chat.js';
import { setCurrentVideo } from '../state.js';
import { html, fmtCount } from '../util.js';

export default async function chatpopout(ctx) {
  const id = ctx.params.id;
  setCurrentVideo(null);
  const v = await getVideo(id);
  if (!ctx.alive()) return;
  if (!v || v.kind !== 'live') {
    ctx.el.innerHTML = '<div class="popout"><p class="muted pad">That stream could not be found.</p></div>';
    return;
  }
  ctx.title(`Chat — ${v.title}`);
  ctx.el.innerHTML = String(html`<div class="popout">
    <header class="popout-head"><img src="/assets/logo-mark.svg" width="22" height="22" alt="">
      <b class="clamp1">${v.title}</b><span class="badge badge-live" data-status>LIVE</span><span class="muted" data-viewers></span></header>
    <div class="popout-chat" data-chat></div>
  </div>`);
  const status = ctx.el.querySelector('[data-status]');
  const viewers = ctx.el.querySelector('[data-viewers]');
  const unsub = onSnapshot(doc(db, 'videos', id), (snap) => {
    if (!snap.exists()) return;
    const cur = toVideo(snap);
    const live = isFresh(cur);
    status.textContent = live ? 'LIVE' : 'ENDED';
    status.classList.toggle('ended', !live);
    viewers.textContent = live ? `${fmtCount(cur.viewerCount || 0)} watching` : '';
  });
  ctx.onCleanup(unsub);
  ctx.onCleanup(mountChat(ctx.el.querySelector('[data-chat]'), { path: ['videos', id, 'chat'], ownerUid: v.ownerUid, title: 'Stream chat' }));
}

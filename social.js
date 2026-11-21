// Subscribe button, like/dislike bar and share button.
import { state, on } from '../state.js';
import { isSubscribed, subscribe, unsubscribe, theySubscribeToMe, getReactionCounts, getMyReaction, setReaction } from '../data.js';
import { requireLogin } from '../auth.js';
import { html, icon, toast, fmtCount, copyText } from '../util.js';

export function mountSubscribe(el, channelUid, { onChange } = {}) {
  if (state.user?.uid === channelUid) { el.innerHTML = ''; return () => {}; }
  let subscribed = false, ready = !state.user, working = false;

  const draw = () => {
    el.innerHTML = String(html`<button class="btn btn-pill ${subscribed ? 'btn-soft' : 'btn-invert'}" ${!ready || working ? 'disabled' : ''}>
      ${subscribed ? html`${icon('bell', 18)} Subscribed` : 'Subscribe'}</button>`);
    el.firstElementChild.onclick = toggle;
  };
  async function load() {
    if (!state.user) { ready = true; subscribed = false; return draw(); }
    ready = false; draw();
    try { subscribed = await isSubscribed(state.user.uid, channelUid); } catch (e) { console.warn(e); }
    ready = true; draw();
  }
  function toggle() {
    requireLogin(async () => {
      if (working) return;
      working = true; draw();
      try {
        if (subscribed) {
          await unsubscribe(state.user.uid, channelUid);
          subscribed = false; onChange?.(-1);
        } else {
          await subscribe(state.user.uid, channelUid);
          subscribed = true; onChange?.(1);
          if (await theySubscribeToMe(state.user.uid, channelUid).catch(() => false)) {
            toast('You two are subscribed to each other — you can DM now! 💬', 'success', 5000);
          }
        }
      } catch (e) {
        console.error(e);
        toast('Could not update your subscription.', 'error');
      }
      working = false; draw();
    }, 'Log in to subscribe.');
  }
  draw();
  load();
  return on('auth', load);
}

export function mountReactions(el, videoId, { compact = false } = {}) {
  let counts = { likes: 0, dislikes: 0 }, mine = null, loaded = false, working = false, dead = false;

  const draw = () => {
    if (dead) return;
    el.innerHTML = String(html`<div class="react ${compact ? 'vertical' : ''}">
      <button class="react-btn ${mine === 'like' ? 'on' : ''}" data-t="like" aria-pressed="${mine === 'like'}" aria-label="Like">${icon('like', compact ? 26 : 20)}<span>${loaded ? fmtCount(counts.likes) : ''}</span></button>
      ${compact ? '' : html`<i class="react-sep"></i>`}
      <button class="react-btn dislike ${mine === 'dislike' ? 'on' : ''}" data-t="dislike" aria-pressed="${mine === 'dislike'}" aria-label="Dislike">${icon('like', compact ? 26 : 20)}<span>${loaded ? fmtCount(counts.dislikes) : ''}</span></button>
    </div>`);
    el.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => toggle(b.dataset.t)));
  };
  async function load() {
    try {
      const [c, m] = await Promise.all([getReactionCounts(videoId), state.user ? getMyReaction(videoId, state.user.uid) : null]);
      counts = c; mine = m; loaded = true;
    } catch (e) { console.warn('reactions', e); loaded = true; }
    draw();
  }
  function toggle(type) {
    requireLogin(async () => {
      if (working) return;
      working = true;

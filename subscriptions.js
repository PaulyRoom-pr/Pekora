import { state, isLoggedIn, setCurrentVideo } from '../state.js';
import { listSubscriptions, fetchVideos, getUser, hydrate } from '../data.js';
import { videoCard, emptyState, skeletonGrid } from '../components/cards.js';
import { openAuthModal } from '../auth.js';
import { html, avatarOf } from '../util.js';

export default async function subscriptions(ctx) {
  ctx.title('Subscriptions');
  setCurrentVideo(null);
  const el = ctx.el;
  if (!isLoggedIn()) {
    el.innerHTML = String(emptyState('Log in to see your subscriptions', 'Videos from channels you subscribe to show up here.', '<button class="btn btn-primary btn-pill" data-login>Log in</button>'));
    el.querySelector('[data-login]').onclick = () => openAuthModal('login', { onDone: () => ctx.el.isConnected && location.reload() });
    return;
  }
  el.innerHTML = `<div class="page">${skeletonGrid(6)}</div>`;
  try {
    const ids = await listSubscriptions(state.user.uid);
    if (!ctx.alive()) return;
    if (!ids.length) {
      el.innerHTML = String(emptyState('You have not subscribed to anyone yet', 'Subscribe to channels you like. If they subscribe back, you can DM and watch together!', '<a class="btn btn-primary btn-pill" href="/">Explore videos</a>'));
      return;
    }
    const [users, vids, shorts] = await Promise.all([
      Promise.all(ids.slice(0, 40).map((id) => getUser(id))),
      fetchVideos({ owners: ids, kind: 'video', max: 40 }),
      fetchVideos({ owners: ids, kind: 'short', max: 20 }),
    ]);
    if (!ctx.alive()) return;
    const all = [...vids, ...shorts].sort((a, b) => b.createdMs - a.createdMs);
    el.innerHTML = String(html`<div class="page">
      <h1 class="page-title">Subscriptions</h1>
      <div class="avatar-row">${users.filter(Boolean).map((u) => html`<a class="avatar-chip" href="/@${u.username}"><img class="avatar lg" src="${avatarOf(u)}" alt=""><span>${u.displayName}</span></a>`)}</div>
      ${all.length ? html`<div class="grid">${all.map((v) => videoCard(v))}</div>` : emptyState('No new videos', 'The channels you follow have not posted yet.')}
    </div>`);
    hydrate(el);
  } catch (e) {
    console.error(e);
    if (ctx.alive()) el.innerHTML = String(emptyState('Could not load subscriptions', 'Try again in a moment.'));
  }
}

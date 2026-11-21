import { fetchLive, hydrate } from '../data.js';
import { videoCard, emptyState, skeletonGrid } from '../components/cards.js';
import { isLoggedIn, setCurrentVideo } from '../state.js';
import { html, icon } from '../util.js';
import { openAuthModal } from '../auth.js';

export default async function livelist(ctx) {
  ctx.title('Live');
  setCurrentVideo(null);
  const el = ctx.el;
  el.innerHTML = String(html`<div class="page">
    <div class="row between wrap gap"><h1 class="page-title"><span class="live-dot"></span> Live now</h1>
      <button class="btn btn-primary btn-pill" data-go>${icon('live', 18)} Go live</button></div>
    <div data-body>${skeletonGrid(4)}</div></div>`);
  el.querySelector('[data-go]').onclick = () => (isLoggedIn() ? (location.href = '/go-live') : openAuthModal('login'));
  const body = el.querySelector('[data-body]');
  const load = async () => {
    try {
      const live = await fetchLive(60);
      if (!ctx.alive()) return;
      body.innerHTML = live.length
        ? String(html`<div class="grid">${live.map((v) => videoCard(v))}</div>`)
        : String(emptyState('No one is live right now', 'Be the first — hit “Go live” and start streaming.'));
      hydrate(body);
    } catch (e) { console.error(e); if (ctx.alive()) body.innerHTML = String(emptyState('Could not load streams', 'Try again in a moment.')); }
  };
  await load();
  const t = setInterval(load, 30000);
  ctx.onCleanup(() => clearInterval(t));
}

import { searchVideos, searchUsers, hydrate } from '../data.js';
import { rowCard, emptyState } from '../components/cards.js';
import { html, avatarOf, fmtCount } from '../util.js';
import { setCurrentVideo } from '../state.js';

export default async function search(ctx) {
  const q = (ctx.query.get('q') || '').trim();
  ctx.title(q ? q : 'Search');
  setCurrentVideo(null);
  const el = ctx.el;
  if (!q) { el.innerHTML = String(emptyState('Search Pekora', 'Type something in the search bar — or press Qrox and just ask.')); return; }
  el.innerHTML = '<div class="page narrow"><p class="muted">Searching…</p></div>';

  const [videos, users] = await Promise.all([searchVideos(q, { max: 60 }).catch(() => []), searchUsers(q, 5).catch(() => [])]);
  if (!ctx.alive()) return;
  let filter = 'all';
  const draw = () => {
    const list = videos.filter((v) => filter === 'all' || v.kind === filter);
    el.innerHTML = String(html`<div class="page narrow">
      <div class="chips">${[['all', 'All'], ['video', 'Videos'], ['short', 'Shorts'], ['live', 'Live']].map(([k, l]) => html`<button class="chip ${k === filter ? 'active' : ''}" data-f="${k}">${l}</button>`)}</div>
      ${users.length && filter === 'all' ? html`<section class="channel-results">${users.map((u) => html`<a class="chan-row" href="/@${u.username}">
          <img class="avatar lg" src="${avatarOf(u)}" alt=""><div><b>${u.displayName}</b><div class="muted">@${u.username} • ${fmtCount(u.subscribersCount || 0)} subscribers</div><div class="muted clamp">${u.bio || ''}</div></div></a>`)}</section>` : ''}
      ${list.length ? html`<section class="rows">${list.map((v) => rowCard(v))}</section>`
        : (users.length && filter === 'all' ? '' : emptyState(`No results for “${q}”`, 'Try different or fewer words.'))}
    </div>`);
    el.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { filter = b.dataset.f; draw(); }));
    hydrate(el);
  };
  draw();
}

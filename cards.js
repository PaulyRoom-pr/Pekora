import { html, icon, fmtDuration, fmtCount, timeAgo, raw } from '../util.js';

export const hrefOf = (v) => (v.kind === 'short' ? `/shorts/${v.id}` : v.kind === 'live' ? `/live/${v.id}` : `/watch/${v.id}`);

const thumbImg = (v) =>
  v.thumbURL
    ? html`<img src="${v.thumbURL}" alt="" loading="lazy" decoding="async">`
    : html`<div class="thumb-ph" aria-hidden="true">${icon(v.kind === 'live' ? 'live' : 'play', 34)}</div>`;

const stats = (v) =>
  v.kind === 'live'
    ? `${fmtCount(v.viewerCount || 0)} watching`
    : `${fmtCount(v.views || 0)} views • ${timeAgo(v.createdMs)}`;

/** Standard 16:9 grid card (videos and live streams). */
export function videoCard(v) {
  const href = hrefOf(v);
  return html`<article class="vcard">
    <a class="thumb" href="${href}" aria-label="${v.title}">
      ${thumbImg(v)}
      ${v.kind === 'live'
        ? html`<span class="badge badge-live">LIVE</span>`
        : html`<span class="badge badge-dur">${fmtDuration(v.duration)}</span>`}
      ${v.kind === 'short' ? html`<span class="badge badge-short">${icon('shorts', 14)} Short</span>` : ''}
    </a>
    <div class="vmeta">
      <a class="vavatar" data-ulink="${v.ownerUid}" href="/"><img class="avatar" data-uavatar="${v.ownerUid}" alt="" loading="lazy"></a>
      <div class="vtext">
        <h3 class="vtitle"><a href="${href}">${v.title}</a></h3>
        <a class="vchan" data-ulink="${v.ownerUid}" data-uname="${v.ownerUid}" href="/"></a>
        <div class="vstats">${stats(v)}</div>
      </div>
    </div>
  </article>`;
}

/** Vertical card used in the Shorts shelf. */
export function shortCard(v) {
  return html`<a class="scard" href="/shorts/${v.id}" aria-label="${v.title}">
    ${v.thumbURL ? html`<img src="${v.thumbURL}" alt="" loading="lazy">` : html`<div class="thumb-ph">${icon('shorts', 34)}</div>`}
    <span class="scard-grad"></span>
    <span class="scard-title">${v.title}</span>
    <span class="scard-views">${fmtCount(v.views || 0)} views</span>
  </a>`;
}

/** Horizontal row used in search results and "up next". */
export function rowCard(v, { small = false } = {}) {
  const href = hrefOf(v);
  return html`<article class="vrow ${small ? 'small' : ''}">
    <a class="thumb" href="${href}" aria-label="${v.title}">
      ${thumbImg(v)}
      ${v.kind === 'live' ? html`<span class="badge badge-live">LIVE</span>` : html`<span class="badge badge-dur">${fmtDuration(v.duration)}</span>`}
    </a>
    <div class="vtext">
      <h3 class="vtitle"><a href="${href}">${v.title}</a></h3>
      <div class="vstats">${stats(v)}</div>
      <a class="vchan inline" data-ulink="${v.ownerUid}" href="/"><img class="avatar xs" data-uavatar="${v.ownerUid}" alt=""><span data-uname="${v.ownerUid}"></span></a>
      ${small ? '' : html`<p class="vdesc">${(v.description || '').slice(0, 160)}</p>`}
    </div>
  </article>`;
}

export const emptyState = (title, text, action = '') =>
  html`<div class="empty"><div class="empty-ic">${icon('film', 40)}</div><h2>${title}</h2><p class="muted">${text}</p>${raw(action)}</div>`;

export const skeletonGrid = (n = 8) =>

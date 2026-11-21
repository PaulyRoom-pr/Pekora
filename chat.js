// Real-time chat used by live streams, the creator's chat pop-out, and watch parties.
import { db, collection, doc, addDoc, deleteDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from '../firebase.js';
import { state, on } from '../state.js';
import { hydrate } from '../data.js';
import { requireLogin } from '../auth.js';
import { html, icon, toast } from '../util.js';

/**
 * @param path       Firestore collection path segments, e.g. ['videos', id, 'chat'] or ['parties', id, 'chat']
 * @param ownerUid   user who may delete any message (stream owner); pass '' for none
 */
export function mountChat(el, { path, ownerUid = '', readOnly = false, title = 'Live chat', emptyText = 'Say hi 👋' }) {
  const col = collection(db, ...path);
  let msgs = [], dead = false, lastSent = 0;

  el.innerHTML = String(html`<section class="chat">
    <header class="chat-head"><h2>${title}</h2></header>
    <div class="chat-list" role="log" aria-live="polite"></div>
    <form class="chat-form"></form>
  </section>`);
  const list = el.querySelector('.chat-list');
  const form = el.querySelector('.chat-form');

  const drawForm = () => {
    if (readOnly) { form.innerHTML = ''; return; }
    if (!state.user || !state.profile) {
      form.innerHTML = String(html`<button type="button" class="btn btn-primary btn-pill block" data-login>Log in to chat</button>`);
      form.querySelector('[data-login]').onclick = () => requireLogin(() => {});
      return;
    }
    form.innerHTML = String(html`<img class="avatar xs" data-uavatar="${state.user.uid}" alt="">
      <input name="text" maxlength="300" autocomplete="off" placeholder="Chat…" aria-label="Chat message">
      <button class="icon-btn send" aria-label="Send">${icon('send', 20)}</button>`);
    hydrate(form);
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = form.elements.text;
    const text = input?.value.trim();
    if (!text) return;
    if (Date.now() - lastSent < 1000) return toast('Slow down a little 🙂');
    lastSent = Date.now();
    input.value = '';
    try {
      await addDoc(col, { uid: state.user.uid, text, createdAt: serverTimestamp() });
    } catch (err) {
      console.error(err);
      input.value = text;
      toast('Message was not sent.', 'error');
    }
  });

  const render = () => {
    if (dead) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    list.innerHTML = msgs.length
      ? String(html`${msgs.map((m) => html`<div class="cmsg" data-id="${m.id}">
          <img class="avatar xs" data-uavatar="${m.uid}" alt="">
          <div><a class="cname" data-ulink="${m.uid}" data-uname="${m.uid}" href="/"></a> <span class="ctext">${m.text}</span></div>
          ${state.user && (state.user.uid === m.uid || state.user.uid === ownerUid) ? html`<button class="icon-btn del" data-del aria-label="Delete message">${icon('x', 14)}</button>` : ''}
        </div>`)}`)
      : `<p class="muted center pad">${emptyText}</p>`;
    hydrate(list);
    if (nearBottom) list.scrollTop = list.scrollHeight;
  };
  list.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;

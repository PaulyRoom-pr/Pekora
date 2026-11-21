// Firestore / Storage access used by the views. Nothing here touches the DOM except hydrate().
import {
  db, storage, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, collection, query, where, orderBy,
  limit, onSnapshot, writeBatch, serverTimestamp, increment, getCountFromServer, ref, uploadBytesResumable,
  getDownloadURL, deleteObject,
} from './firebase.js';
import { avatarOf, esc } from './util.js';

// ---------------------------------------------------------------- users
const userCache = new Map();
export function getUser(uid, { fresh = false } = {}) {
  if (!uid) return Promise.resolve(null);
  if (fresh) userCache.delete(uid);
  if (!userCache.has(uid)) {
    userCache.set(
      uid,
      getDoc(doc(db, 'users', uid))
        .then((s) => (s.exists() ? { id: s.id, ...s.data() } : null))
        .catch((e) => { console.warn('getUser', e); userCache.delete(uid); return null; })
    );
  }
  return userCache.get(uid);
}
export const invalidateUser = (uid) => userCache.delete(uid);

export async function getUserByName(name) {
  const n = String(name || '').toLowerCase().replace(/^@/, '');
  if (!/^[a-z0-9_]{3,20}$/.test(n)) return null;
  const s = await getDoc(doc(db, 'usernames', n));
  return s.exists() ? getUser(s.data().uid) : null;
}

/** Fill in names/avatars/links inside `root` from data-u* attributes (value = uid). */
export async function hydrate(root = document) {
  const els = root.querySelectorAll('[data-uname],[data-uhandle],[data-uavatar],[data-ulink]');
  const uids = new Set();
  els.forEach((e) => uids.add(e.dataset.uname || e.dataset.uhandle || e.dataset.uavatar || e.dataset.ulink));
  const users = new Map(await Promise.all([...uids].map(async (id) => [id, await getUser(id)])));
  els.forEach((e) => {
    const id = e.dataset.uname || e.dataset.uhandle || e.dataset.uavatar || e.dataset.ulink;
    const u = users.get(id);
    if (e.dataset.uname !== undefined) e.textContent = u ? u.displayName : 'Unknown';
    if (e.dataset.uhandle !== undefined) e.textContent = u ? '@' + u.username : '';
    if (e.dataset.uavatar !== undefined) {
      e.src = u ? avatarOf(u) : avatarOf({ id, displayName: '?' });
      e.alt = '';
    }
    if (e.dataset.ulink !== undefined && u) e.setAttribute('href', '/@' + u.username);
  });
}

export async function searchUsers(text, max = 6) {
  const q = String(text || '').trim().toLowerCase().replace(/^@/, '');
  if (!q) return [];
  const col = collection(db, 'users');
  const run = (field) =>
    getDocs(query(col, where(field, '>=', q), where(field, '<=', q + ''), limit(max))).catch(() => ({ docs: [] }));
  const [a, b] = await Promise.all([run('username'), run('displayLower')]);
  const map = new Map();
  [...a.docs, ...b.docs].forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
  return [...map.values()].slice(0, max);
}

// ---------------------------------------------------------------- search tokens
const STOP = new Set('the a an and or of to in on for with is are was be this that it at by from as my your our i you we they me us what who how'.split(' '));
export function tokenize(text) {
  const out = new Set();
  for (const w of String(text || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []) {
    if (w.length < 2 || w.length > 24 || STOP.has(w)) continue;

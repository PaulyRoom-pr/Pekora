// Tracks DM chats for the unread badge. "Seen" markers live in localStorage (per device).
import { watchChats } from './data.js';
import { state, emit } from './state.js';

let chats = new Map();
let unsub = null;

const seenKey = (id) => `pekora.seen.${id}`;
const seenAt = (id) => Number(localStorage.getItem(seenKey(id)) || 0);

export function startInbox() {
  stopInbox();
  if (!state.user) return;
  unsub = watchChats(state.user.uid, (map) => { chats = map; emit('inbox', unreadCount()); });
}
export function stopInbox() {
  unsub?.(); unsub = null; chats = new Map(); emit('inbox', 0);
}
export const getChats = () => chats;
export function isUnread(chat) {
  return chat.lastFrom !== state.user?.uid && chat.updatedMs > seenAt(chat.id);
}
export function unreadCount() {
  let n = 0;
  for (const c of chats.values()) if (isUnread(c)) n++;
  return n;
}
export function markSeen(chatId) {
  try { localStorage.setItem(seenKey(chatId), String(Date.now() + 1000)); } catch { /* ignore */ }
  emit('inbox', unreadCount());
}

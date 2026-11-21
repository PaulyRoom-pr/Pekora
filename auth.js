// Sign up / log in / log out + the auth modal.
//
// Firebase Auth needs an email, but Pekora people log in with a USERNAME. So every account gets a private
// random sign-in address (u<random>@pekora.invalid). The username → sign-in address lookup lives in
// usernames/{username}. The optional real email is stored privately in users/{uid}/private/info.
import {
  auth, db, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, deleteUser,
  doc, getDoc, writeBatch, serverTimestamp,
} from './firebase.js';
import { state, emit } from './state.js';
import { invalidateUser } from './data.js';
import { html, modal, toast, icon, randomId, busy } from './util.js';
import { navigate } from './router.js';

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const normName = (s) => String(s || '').trim().toLowerCase().replace(/^@/, '');

function setAuthState(user, profile) {
  state.user = user;
  state.profile = profile;
  state.authReady = true;
  if (user) invalidateUser(user.uid);
  emit('auth', { user, profile });
}

export function bootAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (state.signingUp) return; // signUp() sets state itself once the profile exists
      if (!user) { setAuthState(null, null); return resolve(); }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists()) { await signOut(auth); setAuthState(null, null); return resolve(); }
        setAuthState(user, { id: user.uid, ...snap.data() });
      } catch (e) {
        console.error(e);
        toast('Could not load your profile. Check your connection.', 'error');
        setAuthState(null, null);
      }
      resolve();
    });
  });
}

export async function refreshProfile() {
  if (!state.user) return;
  const snap = await getDoc(doc(db, 'users', state.user.uid));
  if (snap.exists()) setAuthState(state.user, { id: state.user.uid, ...snap.data() });
}

export function authMessage(e) {
  const c = e?.code || '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return 'Wrong username or password.';
  if (c.includes('too-many-requests')) return 'Too many attempts. Wait a bit and try again.';
  if (c.includes('weak-password')) return 'That password is too weak. Use at least 8 characters.';
  if (c.includes('network')) return 'Network problem — check your connection.';
  if (c.includes('operation-not-allowed')) return 'Email/Password sign-in is not enabled in Firebase Authentication yet.';
  if (c.includes('permission-denied')) return 'The server rejected that. Make sure the Firestore rules from this project are deployed.';
  return e?.message || 'Something went wrong.';
}

export async function usernameTaken(name) {
  return (await getDoc(doc(db, 'usernames', name))).exists();
}

export async function logIn(usernameRaw, password) {
  const username = normName(usernameRaw);
  if (!username || !password) throw new Error('Enter your username and password.');
  if (!USERNAME_RE.test(username)) throw new Error('Wrong username or password.');
  const snap = await getDoc(doc(db, 'usernames', username));
  if (!snap.exists()) throw new Error('Wrong username or password.');

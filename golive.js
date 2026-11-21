// The creator's live studio: pick a source (camera / screen / a looping pre-recorded video), go live, end stream.
import { state, isLoggedIn, setCurrentVideo } from '../state.js';
import { db, doc, addDoc, collection, updateDoc, getDocs, query, where, serverTimestamp } from '../firebase.js';
import { Broadcaster, Mixer } from '../rtc.js';
import { mountChat } from '../components/chat.js';
import { emptyState } from '../components/cards.js';
import { uploadFile, buildTokens, parseTags } from '../data.js';
import { addNavGuard } from '../router.js';
import { openAuthModal } from '../auth.js';
import { html, icon, toast, copyText, confirmDialog, fmtDuration } from '../util.js';

const mediaError = (e) => {
  const n = e?.name || '';
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'Permission was denied. Allow camera / microphone / screen access in your browser and try again.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No camera or microphone was found on this device.';
  if (n === 'NotReadableError') return 'Your camera or microphone is being used by another app.';
  return e?.message || 'Could not start that source.';
};

/** Turn a choice into live tracks. Returns { kind, video, audioStream, micStream, previewEl?, stop() }. */
async function acquire(kind, { useMic, file, start = 0, end = 0, onEnded }) {
  if (kind === 'camera') {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: useMic ? { echoCancellation: true, noiseSuppression: true } : false,
      });
    } catch (e) {
      if (!useMic) throw e;
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      toast('Could not use the microphone — streaming without it.', 'info', 5000);
    }
    return { kind, video: stream.getVideoTracks()[0], audioStream: null, micStream: stream.getAudioTracks().length ? stream : null, stop: () => stream.getTracks().forEach((t) => t.stop()) };
  }
  if (kind === 'screen') {
    const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
    let mic = null;
    if (useMic) { try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch { toast('Could not use the microphone — sharing the screen without it.', 'info', 5000); } }
    const video = display.getVideoTracks()[0];
    video.addEventListener('ended', () => onEnded?.());
    return { kind, video, audioStream: display.getAudioTracks().length ? display : null, micStream: mic, stop: () => { display.getTracks().forEach((t) => t.stop()); mic?.getTracks().forEach((t) => t.stop()); } };
  }
  // pre-recorded video / clip, played on a loop
  if (!file) throw new Error('Choose a video file first.');
  const el = document.createElement('video');
  el.playsInline = true;
  const url = URL.createObjectURL(file);
  el.src = url;
  await new Promise((res, rej) => { el.onloadedmetadata = res; el.onerror = () => rej(new Error("Your browser can't play that file. Try MP4 (H.264) or WebM.")); });
  const dur = el.duration || 0;
  const s = Math.min(Math.max(0, Number(start) || 0), Math.max(0, dur - 0.5));
  const e = Number(end) > s ? Math.min(Number(end), dur) : 0;
  el.loop = !e;
  el.currentTime = s;

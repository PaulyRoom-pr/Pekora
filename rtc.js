// Live streaming over WebRTC, signaled through Firestore (videos/{id}/signals/{viewer}).
//
// Topology: the creator's browser connects directly to every viewer (a "mesh"). That needs no media
// server, but the creator uploads one copy of the stream per viewer, so it suits small-to-medium
// audiences. To scale to thousands, swap Broadcaster/Viewer for an SFU/HLS provider; the rest of the
// app (chat, likes, the stream page) does not care how the video travels.
import { db, doc, collection, setDoc, updateDoc, deleteDoc, onSnapshot, arrayUnion, serverTimestamp } from './firebase.js';
import { state } from './state.js';
import { randomId } from './util.js';

const rtcConfig = () => ({ iceServers: state.iceServers });
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };

/** One persistent audio path: mic + (screen/file audio) → one track that never changes. */
export class Mixer {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.dest = this.ctx.createMediaStreamDestination();
    this.parts = {
      mic: { gain: this.ctx.createGain(), node: null },
      src: { gain: this.ctx.createGain(), node: null },
    };
    this.parts.mic.gain.connect(this.dest);
    this.parts.src.gain.connect(this.dest);
    this.track = this.dest.stream.getAudioTracks()[0];
  }
  resume() { return this.ctx.resume().catch(() => {}); }
  _set(name, stream) {
    const p = this.parts[name];
    try { p.node?.disconnect(); } catch { /* already gone */ }
    p.node = null;
    if (stream && stream.getAudioTracks().length) {
      p.node = this.ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
      p.node.connect(p.gain);
    }
  }
  setMic(stream) { this._set('mic', stream); }
  setSource(stream) { this._set('src', stream); }
  setMicMuted(muted) { this.parts.mic.gain.gain.value = muted ? 0 : 1; }
  close() { try { this.ctx.close(); } catch { /* ignore */ } }
}

export class Broadcaster {
  constructor(streamId, mixer, { onCount } = {}) {
    this.id = streamId;
    this.mixer = mixer;
    this.onCount = onCount || (() => {});
    this.videoTrack = null;
    this.peers = new Map();
    this.unsub = null;
    this.stream = new MediaStream();
  }
  get count() { return [...this.peers.values()].filter((p) => p.pc.connectionState === 'connected').length; }

  start(videoTrack) {
    this.videoTrack = videoTrack;
    this.stream.addTrack(videoTrack);
    this.stream.addTrack(this.mixer.track);
    this.unsub = onSnapshot(
      collection(db, 'videos', this.id, 'signals'),
      (snap) => snap.docChanges().forEach((ch) => this._change(ch)),
      (e) => console.error('signals', e)
    );
  }

  /** Swap camera ↔ screen ↔ video file without dropping any viewer. */
  async setVideoTrack(track) {
    this.stream.removeTrack(this.videoTrack);
    this.videoTrack = track;
    this.stream.addTrack(track);
    await Promise.all([...this.peers.values()].map((p) => p.videoSender?.replaceTrack(track).catch((e) => console.warn(e))));
  }

  _change(ch) {
    const id = ch.doc.id;
    if (ch.type === 'removed') return this._drop(id, false);
    const data = ch.doc.data();

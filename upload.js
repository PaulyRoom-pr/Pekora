// Upload a full video (up to 20 hours) or a short (up to 20 minutes).
import { state, isLoggedIn } from '../state.js';
import { createVideoDoc, uploadFile, deleteStored, buildTokens, parseTags, extOf } from '../data.js';
import { probeVideo, resizeImage } from '../media.js';
import { navigate } from '../router.js';
import { openAuthModal } from '../auth.js';
import { emptyState } from '../components/cards.js';
import { html, icon, toast, fmtBytes, fmtDuration, randomId } from '../util.js';
import { setCurrentVideo } from '../state.js';

export const LIMITS = { video: 20 * 3600, short: 20 * 60 };
const LABEL = { video: '20 hours', short: '20 minutes' };

export default async function upload(ctx) {
  ctx.title('Upload');
  setCurrentVideo(null);
  const el = ctx.el;
  if (!isLoggedIn()) {
    el.innerHTML = String(emptyState('Log in to upload', 'You need an account to post videos and shorts.', '<button class="btn btn-primary btn-pill" data-login>Log in</button>'));
    el.querySelector('[data-login]').onclick = () => openAuthModal('login', { onDone: () => navigate(location.pathname + location.search) });
    return;
  }

  let type = ctx.query.get('type') === 'short' ? 'short' : 'video';
  let file = null, meta = null, customThumb = null, uploading = false, task = null;

  el.innerHTML = String(html`<div class="page narrow">
    <h1 class="page-title">Upload</h1>
    <div class="chips" role="tablist">
      <button class="chip" data-type="video" role="tab">${icon('upload', 16)} Full video</button>
      <button class="chip" data-type="short" role="tab">${icon('shorts', 16)} Short</button>
    </div>
    <p class="muted" data-limit></p>
    <label class="dropzone" data-drop tabindex="0">
      <input type="file" accept="video/*" hidden data-file>
      <div data-drop-text>${icon('upload', 40)}<h3>Drag a video here, or click to choose a file</h3><p class="muted">MP4 (H.264) and WebM work best in every browser.</p></div>
    </label>
    <form class="stack" data-form hidden>
      <div class="upload-grid">
        <div class="stack">
          <label class="field"><span>Title <em class="req">*</em></span><input name="title" maxlength="100" required></label>
          <label class="field"><span>Description</span><textarea name="description" rows="5" maxlength="5000" placeholder="Tell people what this is about"></textarea></label>
          <label class="field"><span>Tags <em class="muted">(comma separated — helps people and Qrox find it)</em></span><input name="tags" placeholder="space, science, vlog"></label>
        </div>
        <div class="stack">
          <div class="thumb-preview" data-thumb><span class="muted">Thumbnail</span></div>
          <label class="btn btn-soft btn-pill block">${icon('image', 18)} Choose a custom thumbnail<input type="file" accept="image/*" hidden data-thumbfile></label>
          <p class="muted tiny" data-info></p>
        </div>
      </div>
      <div class="progress" data-progress hidden><div class="bar"><i></i></div><span data-pct>0%</span></div>
      <p class="form-error" data-error hidden role="alert"></p>
      <div class="row gap end">
        <button type="button" class="btn btn-ghost" data-cancel hidden>Cancel upload</button>
        <button class="btn btn-primary btn-lg" data-publish>Publish</button>
      </div>
    </form>
  </div>`);

  const $q = (s) => el.querySelector(s);

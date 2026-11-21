// Browser-side media helpers: image resizing, video probing, voice recording.

async function loadBitmap(file) {
  try {
    return await createImageBitmap(file);
  } catch {
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be read.')); };
      img.src = url;
    });
  }
}
const dim = (b) => [b.width || b.naturalWidth, b.height || b.naturalHeight];

/** Resize to fit within maxW×maxH, or (cover) crop to exactly w×h. Returns a JPEG blob. */
export async function resizeImage(file, { maxW = 1600, maxH = 1600, cover = false, w, h, type = 'image/jpeg', quality = 0.86 } = {}) {
  const bmp = await loadBitmap(file);
  const [bw, bh] = dim(bmp);
  let dw, dh, sx = 0, sy = 0, sw = bw, sh = bh;
  if (cover) {
    dw = w; dh = h;
    const s = Math.max(w / bw, h / bh);
    sw = w / s; sh = h / s; sx = (bw - sw) / 2; sy = (bh - sh) / 2;
  } else {
    const s = Math.min(1, maxW / bw, maxH / bh);
    dw = Math.round(bw * s); dh = Math.round(bh * s);
  }
  const c = document.createElement('canvas');
  c.width = dw; c.height = dh;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, dw, dh);
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, dw, dh);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not process the image.'))), type, quality));
}

/** Read duration / size from a local video and grab a thumbnail frame. */
export function probeVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    let done = false;
    const finish = (fn) => { if (done) return; done = true; clearTimeout(timer); URL.revokeObjectURL(url); v.removeAttribute('src'); v.load(); fn(); };
    const timer = setTimeout(() => finish(() => reject(new Error('Reading this video took too long. Try an MP4 (H.264) or WebM file.'))), 25000);
    v.onerror = () => finish(() => reject(new Error("Your browser can't read this video. Try an MP4 (H.264) or WebM file.")));
    v.onloadedmetadata = () => {
      const meta = { duration: v.duration, width: v.videoWidth, height: v.videoHeight, thumb: null };
      if (!isFinite(meta.duration) || meta.duration <= 0) return finish(() => reject(new Error('Could not read the length of this video.')));
      const grab = () => {
        try {
          const scale = Math.min(1, 640 / (v.videoWidth || 640));
          const c = document.createElement('canvas');
          c.width = Math.max(2, Math.round(v.videoWidth * scale));
          c.height = Math.max(2, Math.round(v.videoHeight * scale));
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          c.toBlob((b) => finish(() => resolve({ ...meta, thumb: b })), 'image/jpeg', 0.82);
        } catch { finish(() => resolve(meta)); }
      };
      v.onseeked = grab;
      setTimeout(() => finish(() => resolve(meta)), 8000); // no thumbnail is better than no upload
      v.currentTime = Math.min(1, meta.duration / 2);
    };

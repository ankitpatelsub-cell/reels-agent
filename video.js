// video.js — video render dispatch. Real provider when VIDEO_API_KEY set; else preview MP4 via ffmpeg.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const OUT = path.join(__dirname, 'reels');
fs.mkdirSync(OUT, { recursive: true });

function esc(s) { return (s || '').replace(/([:\\'%])/g, '\\$1'); }

// Decode a base64 image (data URL or raw) to a file; return path or null.
function saveImage(b64, id) {
  if (!b64) return null;
  const m = b64.match(/^data:(image\/\w+);base64,(.*)$/) || b64.match(/^(.*)$/);
  const raw = m[2] !== undefined ? m[2] : b64;
  const ext = (m[1] || 'image/png').includes('jpeg') ? 'jpg' : 'png';
  const fp = path.join(OUT, `in-${id}.${ext}`);
  try { fs.writeFileSync(fp, Buffer.from(raw, 'base64')); return fp; } catch { return null; }
}

// Real provider hook (plug when key arrives). Currently returns null -> preview.
function renderWithProvider(script, imagePath) {
  if (!process.env.VIDEO_API_KEY) return null;
  // TODO: dispatch to Luma/Hailuo/Kling/xAI-video with process.env.VIDEO_API_KEY + script.videoPrompt + imagePath
  return null;
}

// 10s branded slate with hook text (no audio track -> avoids codec issues).
function renderPreview(script, id) {
  const mp4 = path.join(OUT, `reel-${id}.mp4`);
  try {
    execFileSync('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', 'color=c=0x0f1f33:s=1080x1920:d=10',
      '-vf',
      `drawtext=text='${esc(script.brand)}':fontcolor=white:fontsize=64:x=(w-tw)/2:y=820:box=1:boxcolor=0x1f5fae@0.7:boxborderw=20,` +
      `drawtext=text='${esc(script.hook.slice(0, 46))}':fontcolor=white:fontsize=38:x=(w-tw)/2:y=1010:box=1:boxcolor=0x000000@0.5:boxborderw=12`,
      '-t', '10', '-pix_fmt', 'yuv420p', mp4
    ], { stdio: 'ignore' });
    return mp4;
  } catch (e) { return null; }
}

function render(script, id, imageB64) {
  const imagePath = saveImage(imageB64, id);
  const real = renderWithProvider(script, imagePath);
  if (real) return { mode: 'provider', file: real };
  const prev = renderPreview(script, id);
  return { mode: 'preview', file: prev, note: 'Preview slate (no VIDEO_API_KEY set). Add key to render real video.' };
}

module.exports = { render };

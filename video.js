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

// Real provider: xAI Grok Imagine Video (api.x.ai). Uses XAI_API_KEY (not OpenRouter —
// OpenRouter does NOT route xAI video models). Falls back to null -> preview on any error.
function renderWithProvider(script, imagePath) {
  const key = process.env.XAI_API_KEY;
  if (!key) return null;
  try {
    const https = require('https');
    const prompt = (script.videoPrompt || script.hook || 'A cinematic promotional video').slice(0, 1000);
    // xAI image-to-video: POST /v1/video/generations with model + input image
    const body = JSON.stringify({
      model: 'x-ai/grok-imagine-video',
      input: imagePath ? [{ type: 'image', image: 'file://' + imagePath }] : undefined,
      prompt,
      n_seconds: 10,
      resolution: '720p',
      aspect_ratio: '9:16',
    });
    const buf = execFileSync('curl', [
      '-sSL', '--max-time', '120',
      '-X', 'POST', 'https://api.x.ai/v1/video/generations',
      '-H', 'Content-Type: application/json',
      '-H', 'Authorization: Bearer ' + key,
      '-d', body,
    ], { encoding: 'utf8' });
    const j = JSON.parse(buf);
    // xAI returns a generations id -> poll /v1/video/generations/{id} until status=complete
    const genId = j.id || (j.data && j.data.id);
    if (!genId) return null;
    const mp4 = path.join(OUT, `reel-${Date.now().toString().slice(-6)}.mp4`);
    // poll up to ~110s
    for (let i = 0; i < 22; i++) {
      const st = JSON.parse(execFileSync('curl', [
        '-sSL', '--max-time', '30',
        '-H', 'Authorization: Bearer ' + key,
        `https://api.x.ai/v1/video/generations/${genId}`,
      ], { encoding: 'utf8' }));
      const data = st.data || st;
      if (data.status === 'complete' && data.video && data.video.url) {
        execFileSync('curl', ['-sSL', '--max-time', '120', '-o', mp4, data.video.url]);
        if (fs.existsSync(mp4)) return mp4;
      }
      require('child_process').execSync('sleep 5');
    }
    return null;
  } catch (e) {
    console.log('[reels] provider render failed, using preview:', e.message.split('\n')[0]);
    return null;
  }
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

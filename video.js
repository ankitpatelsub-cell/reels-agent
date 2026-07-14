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

const { gen } = require('./image');
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

// 10s branded slate with hook text + optional AI poster background.
function renderPreview(script, id, poster) {
  const mp4 = path.join(OUT, `reel-${id}.mp4`);
  try {
    const args = ['-y','-f','lavfi','-i',`color=c=0x0f1f33:s=1080x1920:d=10`];
    let vf;
    if (poster && fs.existsSync(poster)) {
      args.push('-i', poster, '-filter_complex',
        `[1:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2[ov];` +
        `[0:v][ov]overlay=(W-w)/2:(H-h)/2,` +
        `drawtext=text='${esc(script.brand)}':fontcolor=white:fontsize=64:x=(w-tw)/2:y=820:box=1:boxcolor=0x1f5fae@0.7:boxborderw=20,` +
        `drawtext=text='${esc((script.hook||'').slice(0,46))}':fontcolor=white:fontsize=38:x=(w-tw)/2:y=1010:box=1:boxcolor=0x000000@0.5:boxborderw=12`);
    } else {
      args.push('-vf',
        `drawtext=text='${esc(script.brand)}':fontcolor=white:fontsize=64:x=(w-tw)/2:y=820:box=1:boxcolor=0x1f5fae@0.7:boxborderw=20,` +
        `drawtext=text='${esc((script.hook||'').slice(0,46))}':fontcolor=white:fontsize=38:x=(w-tw)/2:y=1010:box=1:boxcolor=0x000000@0.5:boxborderw=12`);
    }
    args.push('-t','10','-pix_fmt','yuv420p', mp4);
    execFileSync('ffmpeg', args, { stdio: 'ignore' });
    return mp4;
  } catch (e) { return null; }
}
function render(script, id, imageB64) {
  const imagePath = saveImage(imageB64, id);
  // 1) try real AI video (xAI) — needs funded xAI team
  const real = renderWithProvider(script, imagePath);
  if (real) return { mode: 'provider', file: real };
  // 2) generate a real AI poster image (OpenRouter) for the preview
  const poster = gen((script.videoPrompt || script.hook || 'cinematic promo') + ', poster', id);
  if (poster) console.log('[reels] AI poster generated:', poster);
  // 3) branded preview slate (with poster if available)
  const prev = renderPreview(script, id, poster);
  return { mode: 'preview', file: prev, poster: poster || null, note: 'Preview slate + AI poster. Add funded xAI key for full video.' };
}

module.exports = { render };

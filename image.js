// image.js — real AI image generation via OpenRouter (Hermes key).
// Used as the reel poster / car thumbnail. Video stays preview until a video API is funded.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'reels');

function gen(prompt, id) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const model = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-3-pro-image';
  try {
    const body = JSON.stringify({ model, prompt: prompt.slice(0, 1000), n: 1 });
    const out = execFileSync('curl', [
      '-sL', '--max-time', '60', '-X', 'POST', 'https://openrouter.ai/api/v1/images/generations',
      '-H', 'Content-Type: application/json',
      '-H', 'Authorization: Bearer ' + key,
      '-d', body,
    ], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    const j = JSON.parse(out);
    const b64 = j.data && j.data[0] && j.data[0].b64_json;
    if (!b64) return null;
    const fp = path.join(OUT, `poster-${id}.png`);
    fs.writeFileSync(fp, Buffer.from(b64, 'base64'));
    return fp;
  } catch (e) {
    console.log('[reels] image gen failed:', e.message.split('\n')[0]);
    return null;
  }
}
module.exports = { gen };

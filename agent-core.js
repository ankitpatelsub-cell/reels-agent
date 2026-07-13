// agent-core.js — Reels Agent orchestrator (text/image -> marketing reel).
const { reelScript } = require('./script');
const video = require('./video');
const http = require('http');

async function buildReel({ brief, subject, lang = 'en', imageB64 }) {
  const id = Date.now().toString().slice(-6);
  const script = await reelScript({ brief, subject, lang, imageDesc: imageB64 ? 'uploaded photo' : '' });
  const r = video.render(script, id, imageB64);
  return {
    id, lang, mode: r.mode, note: r.note,
    script: { hook: script.hook, scenes: script.scenes, storyboard: script.storyboard, voiceover: script.voiceover, videoPrompt: script.videoPrompt, cta: script.cta },
    video: r.file ? ('/reels/' + require('path').basename(r.file)) : null,
  };
}

// Fetch a car from the car agent and auto-build a reel for it.
function reelFromCar(carId, lang = 'en') {
  return new Promise((resolve) => {
    http.get('http://localhost:8097/api/cars', (res) => {
      let b = ''; res.on('data', d => b += d); res.on('end', () => {
        let cars = []; try { cars = JSON.parse(b); } catch {}
        const c = cars.find(x => String(x.id) === String(carId));
        if (!c) return resolve({ error: 'car not found', id: carId });
        const subject = `${c.brand} ${c.model} ${c.year}`;
        const brief = `₹${(c.price / 1e5).toFixed(2)}L, ${c.fuel}, ${c.km.toLocaleString()} km, ${c.city}. Exchange bonus available.`;
        resolve(buildReel({ subject, brief, lang }));
      });
    }).on('error', () => resolve({ error: 'car agent unreachable' }));
  });
}

// Notify the reels agent when a car is added (called by car agent webhook).
function onCarAdded(car) {
  const subject = `${car.brand} ${car.model} ${car.year}`;
  const brief = `New stock ₹${(car.price / 1e5).toFixed(2)}L, ${car.fuel}, ${car.city}.`;
  return buildReel({ subject, brief, lang: 'en' });
}

module.exports = { buildReel, reelFromCar, onCarAdded };

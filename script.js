// script.js — creative engine for marketing reels (text/image -> script + prompt + storyboard).
const BRAND = { name: 'Shree Auto', city: 'Ahmedabad', tagline: 'New cars, exchange offers & certified used — all in one place' };
const xai = require('./xai');

async function reelScript({ brief, subject, lang = 'en', imageDesc = '' }) {
  const topic = subject || brief || 'our latest car';
  const langName = lang === 'hi' ? 'Hindi' : 'English';
  if (process.env.XAI_API_KEY) {
    try {
      const sys = `You are a creative social-media scriptwriter for ${BRAND.name}, a car dealership in ${BRAND.city}, India. Write a short, catchy 9:16 Instagram/Facebook reel script in ${langName}. Return STRICT JSON: {"hook":"...","scenes":[{"t":0,"vis":"...","txt":"...","vo":"..."},...4 scenes],"cta":"...","videoPrompt":"one cinematic prompt"}.. No markdown, no extra text.`;
      const user = `Subject: ${topic}.${brief ? ' Extra: ' + brief : ''}${imageDesc ? ' An image was uploaded: ' + imageDesc : ''} Include price/exchange offer if mentioned. Keep it punchy and local.`;
      const raw = await xai.chat([{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.8, max_tokens: 700 });
      let json = raw;
      const s = json.indexOf('{'), e = json.lastIndexOf('}');
      if (s >= 0 && e > s) json = json.slice(s, e + 1);
      const d = JSON.parse(json);
      return {
        topic, lang, brand: BRAND.name,
        hook: d.hook, scenes: d.scenes, cta: d.cta,
        storyboard: d.scenes.map(s => `**[${s.t}s]** ${s.vis} — "${s.txt}"`),
        voiceover: d.scenes.map(s => s.vo).join(' '),
        videoPrompt: d.videoPrompt || `Cinematic 9:16 reel of ${topic}, dealership showroom, upbeat`,
      };
    } catch (e) { /* fall through to template */ console.log('[reels] xAI failed, using template:', e.message); }
  }
  // Template fallback (no key or xAI error)
  const L = lang === 'hi'
    ? { hook: 'नमस्ते! ' + BRAND.name + ' से लेकर आए हैं ', sub: 'आज की डील मत छोड़िए', cta: 'शोरूम आइए या कॉल करें — नंबर डिस्क्रिप्शन में' }
    : { hook: 'Hey! ' + BRAND.name + ' brings you ', sub: "Today's deal you can't miss", cta: 'Visit our showroom or call — link in bio' };
  const scenes = [
    { t: 0, vis: imageDesc || ('Hero shot of ' + topic), txt: L.hook + topic, vo: L.hook + topic },
    { t: 3, vis: 'Walkaround / feature highlights', txt: L.sub, vo: L.sub + ' — ' + (brief || 'great price, exchange bonus available') },
    { t: 6, vis: 'Price + exchange offer on screen', txt: 'Exchange bonus up to ₹25k', vo: 'Get up to ₹25k exchange bonus. EMI from low down-payment.' },
    { t: 9, vis: BRAND.name + ' logo + showroom', txt: L.cta, vo: L.cta },
  ];
  const videoPrompt = `Cinematic 9:16 vertical automotive reel, ${topic}, ${imageDesc || 'glossy showroom lighting'}, smooth camera moves, upbeat Indian music, Hindi/English on-screen text, premium dealership vibe, 10 seconds`;
  return { topic, lang, brand: BRAND.name, hook: L.hook + topic, scenes, cta: L.cta, storyboard: scenes.map(s => `**[${s.t}s]** ${s.vis} — "${s.txt}"`), voiceover: scenes.map(s => s.vo).join(' '), videoPrompt };
}

module.exports = { reelScript, BRAND };

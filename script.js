// script.js — creative engine for marketing reels (text/image -> script + prompt + storyboard).
const BRAND = { name: 'Shree Auto', city: 'Ahmedabad', tagline: 'New cars, exchange offers & certified used — all in one place' };

function reelScript({ brief, subject, lang = 'en', imageDesc = '' }) {
  const L = lang === 'hi'
    ? { hook: 'नमस्ते! ' + BRAND.name + ' से लेकर आए हैं ', sub: 'आज की डील मत छोड़िए', cta: 'शोरूम आइए या कॉल करें — नंबर डिस्क्रिप्शन में', out: 'शेयर जरूर करें!' }
    : { hook: 'Hey! ' + BRAND.name + ' brings you ', sub: "Today's deal you can't miss", cta: 'Visit our showroom or call — link in bio', out: 'Share this reel!' };

  const topic = subject || brief || 'our latest car';
  const scenes = [
    { t: 0, vis: imageDesc || ('Hero shot of ' + topic), txt: L.hook + topic, vo: L.hook + topic },
    { t: 3, vis: 'Walkaround / feature highlights', txt: L.sub, vo: L.sub + ' — ' + (brief || 'great price, exchange bonus available') },
    { t: 6, vis: 'Price + exchange offer on screen', txt: 'Exchange bonus up to ₹25k', vo: 'Get up to ₹25k exchange bonus. EMI from low down-payment.' },
    { t: 9, vis: BRAND.name + ' logo + showroom', txt: L.cta, vo: L.cta },
  ];
  const videoPrompt = `Cinematic 9:16 vertical automotive reel, ${topic}, ${imageDesc || 'glossy showroom lighting'}, smooth camera moves, upbeat Indian music, Hindi/English on-screen text, premium dealership vibe, 10 seconds`;
  const storyboard = scenes.map(s => `**[${s.t}s]** ${s.vis} — "${s.txt}"`);
  const voiceover = scenes.map(s => s.vo).join(' ');
  return { topic, lang, hook: L.hook + topic, scenes, storyboard, voiceover, videoPrompt, cta: L.cta, brand: BRAND.name };
}

module.exports = { reelScript, BRAND };

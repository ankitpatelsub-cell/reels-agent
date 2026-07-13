// xai.js — xAI (Grok) chat client, OpenAI-compatible. Used to write reel scripts (text only).
const https = require('https');
function chat(messages, opts = {}) {
  return new Promise((resolve, reject) => {
    const key = process.env.XAI_API_KEY;
    if (!key) return reject(new Error('no XAI_API_KEY'));
    const body = JSON.stringify({
      model: process.env.XAI_MODEL || 'grok-2-latest',
      messages,
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.max_tokens ?? 600,
    });
    const req = https.request({
      hostname: 'api.x.ai', path: '/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key, 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('xAI HTTP ' + res.statusCode + ': ' + d.slice(0, 200)));
        try { const j = JSON.parse(d); resolve(j.choices?.[0]?.message?.content || ''); }
        catch (e) { reject(new Error('xAI parse: ' + d.slice(0, 120))); }
      });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}
module.exports = { chat };

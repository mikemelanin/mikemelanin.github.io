// Бэкенд AI-двойника: POST {question, history} -> {answer}.
// Ключ LLM лежит только в секрете LLM_KEY воркера. Это не прокси: модель, промпт и лимиты задаются здесь.
import { SYSTEM } from './prompt.js';

const MAX_QUESTION = 1000;
const MAX_TURNS = 6;

const cors = origin => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
});

const json = (body, status, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });

// Счётчик в KV: ключ живёт до конца окна. Не атомарный, но для защиты от перебора хватает.
const bump = async (kv, key, limit, ttl) => {
  const n = Number(await kv.get(key)) || 0;
  if (n >= limit) return false;
  await kv.put(key, String(n + 1), { expirationTtl: ttl });
  return true;
};

const cleanHistory = history => (Array.isArray(history) ? history : [])
  .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
  .slice(-MAX_TURNS * 2)
  .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGINS.split(',').map(s => s.trim());
    if (!allowed.includes(origin)) return json({ error: 'forbidden' }, 403);
    const h = cors(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (request.method !== 'POST') return json({ error: 'method' }, 405, h);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400, h); }
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question) return json({ error: 'empty' }, 400, h);
    if (question.length > MAX_QUESTION) return json({ error: 'too long' }, 413, h);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const now = new Date();
    const hour = now.toISOString().slice(0, 13);
    if (!await bump(env.RL, `ip:${ip}:${hour}`, Number(env.PER_IP_HOUR), 3600)) return json({ error: 'rate limit' }, 429, h);
    if (!await bump(env.RL, `day:${hour.slice(0, 10)}`, Number(env.PER_DAY), 86400)) return json({ error: 'daily limit' }, 429, h);

    const messages = [{ role: 'system', content: SYSTEM }, ...cleanHistory(body.history), { role: 'user', content: question }];
    try {
      const r = await fetch(`${env.LLM_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.LLM_KEY}` },
        body: JSON.stringify({ model: env.LLM_MODEL, messages, max_tokens: 600, temperature: 0.3 }),
        signal: AbortSignal.timeout(25000),
      });
      if (!r.ok) {
        console.log('llm status', r.status, (await r.text()).slice(0, 300));
        return json({ error: 'llm' }, 502, h);
      }
      const data = await r.json();
      const answer = (data.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      if (!answer) return json({ error: 'empty answer' }, 502, h);
      return json({ answer }, 200, h);
    } catch (e) {
      console.log('llm error', String(e));
      return json({ error: 'llm' }, 502, h);
    }
  },
};

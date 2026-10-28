// AI-двойник: чат на странице. Готовые вопросы-кнопки отвечает по базе twin/kb.js,
// свободные вопросы – через LLM-бэкенд в ENDPOINT (код в worker/): POST {question, history} -> {answer}.
// Если бэкенд недоступен или не ответил за 20 секунд, двойник молча вернётся к базе.
// Задачи-подсказки – KB.tasks. Если на странице есть конструктор (window.MM_BUILDER), в ответе появится кнопка Собрать архитектуру.
(() => {
  const ENDPOINT = 'https://mike-twin.m-v-melanin.workers.dev';
  const KB = window.TWIN_KB;
  const root = document.querySelector('.twin-chat');
  if (!KB || !root) return;

  const log = root.querySelector('.chat-log');
  const chips = root.querySelector('.chat-chips');
  const form = root.querySelector('.chat-form');
  const input = form.querySelector('textarea');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const byId = Object.fromEntries(KB.entries.map(e => [e.id, e]));
  const history = [];
  let busy = false;

  // ---------- matching ----------
  const ENDINGS = ['иями', 'ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'иях', 'ешь', 'ете', 'ишь', 'ите', 'ость', 'ах', 'ях', 'ов', 'ев', 'ий', 'ый', 'ой', 'ая', 'яя', 'ое', 'ее', 'ие', 'ые', 'ую', 'юю', 'ом', 'ем', 'ам', 'ям', 'ет', 'ит', 'ут', 'ют', 'ат', 'ят', 'ть', 'ся', 'сь', 'а', 'я', 'о', 'е', 'и', 'ы', 'у', 'ю', 'ь', 'й'];
  const norm = s => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
  const stem = w => {
    if (w.length <= 4) return w;
    for (const e of ENDINGS) if (w.endsWith(e) && w.length - e.length >= 3) return w.slice(0, -e.length);
    return w;
  };
  const hit = (k, w) => {
    if (k.length <= 4) return w === k || stem(w) === stem(k);
    const sk = stem(k);
    return w.startsWith(k) || stem(w) === sk || (sk.length >= 5 && w.startsWith(sk));
  };
  const keys = KB.entries.map(e => e.keys.map(k => norm(k).split(' ').filter(Boolean)));

  const taskKeys = KB.taskWords.map(k => norm(k).split(' '));
  const isTask = text => {
    const words = norm(text).split(' ').filter(Boolean);
    return words.length >= 3 && !words.includes('ли') && taskKeys.some(parts => parts.every(p => words.includes(p)));
  };

  const match = text => {
    const words = norm(text).split(' ').filter(Boolean);
    if (!words.length) return null;
    let best = null, top = 0;
    KB.entries.forEach((e, i) => {
      let score = 0;
      keys[i].forEach(parts => {
        if (parts.every(p => words.some(w => hit(p, w)))) score += parts.length > 1 ? parts.length * 1.5 : 1 + Math.min(parts[0].length, 10) / 20;
      });
      if (score > top) { top = score; best = e; }
    });
    return best;
  };

  // ---------- rendering ----------
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const inline = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((.+?)\)/g, (_, t, u) => `<a href="${u}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`);
  const md = text => text.split('\n\n').map(block => {
    const lines = block.split('\n');
    if (lines.every(l => l.startsWith('- '))) return '<ul>' + lines.map(l => `<li>${inline(l.slice(2))}</li>`).join('') + '</ul>';
    const items = lines.filter(l => l.startsWith('- '));
    if (items.length) {
      const head = lines.filter(l => !l.startsWith('- ')).join(' ');
      return `<p>${inline(head)}</p><ul>${items.map(l => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`;
    }
    return `<p>${inline(block)}</p>`;
  }).join('');

  const scrollDown = () => { log.scrollTop = log.scrollHeight; };
  const add = (who, html) => {
    const el = document.createElement('div');
    el.className = 'tw-msg tw-' + who;
    el.innerHTML = html;
    log.append(el);
    scrollDown();
    return el;
  };

  const wait = ms => new Promise(r => setTimeout(r, ms));
  // ответ проявляется, как будто его пишет модель: каждое слово поднимается из размытия с лёгким перелётом,
  // а светящаяся каретка едет по последнему появившемуся слову
  const WORD = window.mmSpring ? window.mmSpring(171, 13.6) : { duration: 480, easing: 'cubic-bezier(.2,.9,.3,1.2)' };
  const type = async el => {
    if (still) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const words = [];
    nodes.forEach(n => {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(part); return; }
        const w = document.createElement('span');
        w.className = 'tw-w';
        w.textContent = part;
        words.push(w);
        frag.append(w);
      });
      n.replaceWith(frag);
    });
    if (!words.length) return;
    const caret = document.createElement('span');
    caret.className = 'tw-caret';
    caret.setAttribute('aria-hidden', 'true');
    el.append(caret);
    el.classList.add('is-gen');
    const gap = Math.min(60, 2400 / words.length);
    words.forEach((w, i) => w.animate([
      { opacity: 0, transform: 'translateY(.42em)', filter: 'blur(9px)' },
      { opacity: 1, offset: 0.7 },
      { opacity: 1, transform: 'none', filter: 'blur(0)' }
    ], { duration: WORD.duration, easing: WORD.easing, delay: i * gap, fill: 'backwards' }));
    const place = w => {
      caret.style.height = w.offsetHeight + 'px';
      caret.style.transform = `translate(${w.offsetLeft + w.offsetWidth + 3}px, ${w.offsetTop}px)`;
    };
    place(words[0]);
    caret.offsetWidth;
    caret.classList.add('is-on');
    for (let i = 0; i < words.length; i++) {
      place(words[i]);
      if (i % 6 === 0) scrollDown();
      await wait(gap);
    }
    caret.classList.remove('is-on');
    await wait(WORD.duration);
    caret.remove();
    el.classList.remove('is-gen');
    scrollDown();
  };

  const tgButton = q => {
    const url = KB.tg + (q ? '?text=' + encodeURIComponent(q) : '');
    return `<a class="tw-tg" href="${url}" target="_blank" rel="noopener"${q ? ` data-copy="${esc(q)}"` : ''}><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 18.7 19.5c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2l-11 6.9-4.7-1.5c-1-.3-1-1 .2-1.5L20.5 3c.9-.3 1.6.2 1.4 1.3Z"/></svg>Написать настоящему Михаилу</a>`;
  };

  // задачи из конструктора: подсказки под приветствием и кнопка Собрать архитектуру в ответе
  const BLD = window.MM_BUILDER;
  const BUILD_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="8.5" y="14" width="7" height="7" rx="1.5"/><path d="M6.5 10v2h11v-2M12 12v2"/></svg>';
  const buildButton = (id, q = '') => `<button type="button" class="tw-tg tw-build" data-build="${id || ''}" data-q="${esc(q)}">${BUILD_ICON}Собрать архитектуру</button>`;
  const TASKS = KB.tasks || [];
  const taskEntry = t => ({
    a: `**${t.label}**: ${t.hint}. Пилот обычно ${t.pilot[0]}–${t.pilot[1]} недель, дальше вывод в production.\n\nНапишите Михаилу пару строк о вашем процессе – он предложит, с чего начать.`,
    build: t.id, tg: true, next: ['approach', 'cost', 'case']
  });

  const showChips = (ids, withTasks) => {
    chips.innerHTML = '';
    if (withTasks) TASKS.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'is-task';
      b.textContent = t.label;
      b.addEventListener('click', () => ask(t.label, taskEntry(t)));
      chips.append(b);
    });
    ids.filter(id => byId[id]).forEach(id => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = byId[id].q;
      b.addEventListener('click', () => ask(byId[id].q, byId[id]));
      chips.append(b);
    });
  };

  // ---------- answering ----------
  const remote = async question => {
    if (!ENDPOINT) return null;
    try {
      const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, history }), signal: AbortSignal.timeout(20000) });
      if (!r.ok) return null;
      const { answer } = await r.json();
      return answer || null;
    } catch { return null; }
  };

  const ask = async (question, entry, fromBuilder) => {
    question = question.trim();
    if (!question || busy) return;
    busy = true;
    form.classList.add('is-busy');
    chips.innerHTML = '';
    root.classList.add('is-used');
    add('me', `<p>${esc(question)}</p>`);
    const dots = add('bot', '<span class="tw-dots" aria-label="Двойник печатает"><i></i><i></i><i></i></span>');
    const think = wait(still ? 0 : 500 + Math.random() * 500);

    const fromLLM = entry ? null : await remote(question);
    const task = !entry && !fromLLM && isTask(question);
    const hitEntry = task ? null : entry || (fromLLM ? null : match(question));
    const text = fromLLM || (task ? KB.task : hitEntry ? hitEntry.a : KB.fallback);
    await think;

    dots.innerHTML = md(text);
    await type(dots);
    if (!hitEntry && !fromLLM) dots.insertAdjacentHTML('beforeend', tgButton(question));
    else if (hitEntry && hitEntry.tg) dots.insertAdjacentHTML('beforeend', tgButton(hitEntry.build ? question : ''));
    if (BLD && !fromBuilder && (task || (hitEntry && hitEntry.build))) dots.insertAdjacentHTML('beforeend', buildButton(hitEntry && hitEntry.build, task ? question : ''));
    scrollDown();

    history.push({ role: 'user', content: question }, { role: 'assistant', content: text });
    showChips(task ? ['approach', 'cost', 'case'] : hitEntry ? hitEntry.next || KB.start : KB.start.filter(id => id !== 'about'));
    scrollDown();
    busy = false;
    form.classList.remove('is-busy');
  };

  // текст вопроса копируем: если Telegram не подставит его в чат, его легко вставить
  log.addEventListener('click', e => {
    const a = e.target.closest('[data-copy]');
    if (a && navigator.clipboard) navigator.clipboard.writeText(a.dataset.copy).catch(() => {});
    const bld = e.target.closest('[data-build]');
    if (bld) BLD.open(bld.dataset.build || null, bld.dataset.q);
  });

  // поле растёт под текст (до max-height в CSS) и показывает последние строки
  const fit = () => {
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
    input.scrollTop = input.scrollHeight;
  };
  input.addEventListener('input', fit);

  let voiceSend = null;
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (voiceSend && voiceSend()) return;
    if (busy) return;
    const q = input.value;
    input.value = '';
    fit();
    ask(q);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });

  // ---------- voice ----------
  // Состояния в form.dataset.voice: wait – браузер включает микрофон (крутилка), rec – слушаем, done – дораспознаём последние слова.
  // Текст диктовки дописывается к тому, что уже в поле. Стоп – текст остаётся, можно поправить или дописать;
  // Отправить во время диктовки – ждём последние слова и отправляем всю фразу.
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = form.querySelector('.chat-mic');
  const status = root.querySelector('.chat-voice');
  if (SR && mic) {
    mic.hidden = false;
    let rec = null, base = '', sendAfter = false, guard;
    const PH = input.placeholder;
    const set = s => {
      if (s) form.dataset.voice = s; else delete form.dataset.voice;
      form.classList.toggle('is-sending', s === 'done' && sendAfter);
      root.classList.toggle('is-voice', !!s);
      mic.setAttribute('aria-label', s ? 'Закончить запись' : 'Сказать голосом');
      input.placeholder = s === 'wait' ? 'Включаю микрофон…' : s ? 'Говорите…' : PH;
      if (status) {
        status.hidden = !s;
        status.dataset.s = s;
        status.lastChild.textContent = { wait: 'Включаю микрофон…', rec: 'Говорите, текст появится в поле', done: sendAfter ? 'Распознаю и отправляю…' : 'Распознаю…' }[s] || '';
      }
    };
    const finish = () => {
      clearTimeout(guard);
      if (!rec) return;
      rec = null;
      const go = sendAfter;
      sendAfter = false;
      set('');
      fit();
      if (go) form.requestSubmit();
    };
    const stop = go => {
      if (go) sendAfter = true;
      const was = form.dataset.voice;
      set('done');
      if (was !== 'done') {
        try { was === 'wait' ? rec.abort() : rec.stop(); } catch { finish(); return; }
      }
      clearTimeout(guard);
      guard = setTimeout(finish, 3000); // Safari иногда не присылает onend
    };
    voiceSend = () => { if (!rec) return false; stop(true); return true; };
    mic.addEventListener('click', () => {
      if (rec) { stop(false); return; }
      if (busy) return;
      const r = rec = new SR();
      r.lang = 'ru-RU'; r.interimResults = true; r.continuous = false;
      base = input.value.trim();
      r.onstart = r.onaudiostart = () => { if (r === rec && form.dataset.voice === 'wait') set('rec'); };
      r.onresult = e => {
        if (r !== rec) return;
        const text = [...e.results].map(x => x[0].transcript).join('').trim();
        input.value = [base, text].filter(Boolean).join(' ');
        fit();
      };
      r.onerror = e => {
        if (r !== rec) return;
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          sendAfter = false;
          finish();
          input.placeholder = 'Нет доступа к микрофону, напишите текстом';
        }
      };
      r.onend = () => { if (r === rec) finish(); };
      set('wait');
      try { r.start(); } catch { finish(); }
    });
  }

  // подсказки печатаются в пустом поле, пока человек не начал вводить
  if (!still && KB.ideas) {
    const PH = input.placeholder;
    let n = 0, k = 0, back = false, seen = false;
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => seen = e.isIntersecting).observe(root);
    const step = () => {
      let delay = back ? 28 : 60;
      const idle = !input.value && document.activeElement !== input && !form.dataset.voice;
      if (seen && idle) {
        const s = KB.ideas[n];
        k += back ? -1 : 1;
        input.placeholder = s.slice(0, k) + '|';
        if (k >= s.length && !back) { back = true; delay = 1800; }
        else if (k <= 0 && back) { back = false; n = (n + 1) % KB.ideas.length; delay = 400; }
      } else if (document.activeElement === input && !form.dataset.voice && input.placeholder !== PH) input.placeholder = PH;
      setTimeout(step, delay);
    };
    step();
  }

  // старт: приветствие появляется, когда чат попадает в экран
  let starting;
  const start = () => starting || (starting = (async () => {
    const el = add('bot', md(KB.greeting));
    await type(el);
    showChips(KB.start.filter(id => !['banks', 'code'].includes(id)), true);
    scrollDown();
  })());

  // конструктор передаёт сюда собранную задачу: прокручиваем к чату и задаём вопрос
  window.MM_TWIN = {
    async ask(q) {
      root.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
      await start();
      while (busy) await wait(200);
      ask(q, null, true);
    }
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); start(); } }, { threshold: .3 });
    io.observe(root);
  } else start();
})();

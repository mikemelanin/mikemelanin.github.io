// Игра "Доведи пилот до production": раннер на canvas.
// Герой – AI-пилот. Бежит через 4 этапа проекта, прыгает через согласования, ИБ, legacy и комитет,
// пригибается от галлюцинаций и scope creep, собирает ₽ эффекта. Тексты и баланс – в STAGES, KINDS, ENDS.
(() => {
  const root = document.querySelector('.rn');
  if (!root) return;
  const cv = root.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const hud = root.querySelector('.rn-hud');
  const screen = root.querySelector('.rn-screen');
  const banner = root.querySelector('.rn-banner');
  const duckBtn = root.querySelector('.rn-duck');
  const soundBtn = root.querySelector('.rn-sound');
  const TG = 'https://t.me/mike_melanin';
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(pointer: coarse)').matches;

  // сцена в логических единицах: высота всегда 320, ширина зависит от экрана
  const LH = 320, GY = 262;
  const GRAV = 2700, JUMP = 930, JUMP2 = 800;
  const RED = '#E5484D', GREEN = '#1F9D55', LIVE = '#7CF29C', SCREEN = '#0A0C26', GOLD = '#F5B544';

  const STAGES = [
    { name: 'Discovery', sub: 'Прыгайте через согласования и пустые данные', pool: ['paper', 'nodata', 'paper', 'feature'], len: 4000 },
    { name: 'Архитектура', sub: 'Впереди ИБ и legacy', pool: ['ib', 'legacy', 'paper', 'nodata'], len: 4800 },
    { name: 'Пилот', sub: 'Пригибайтесь от галлюцинаций', pool: ['ghost', 'legacy', 'feature', 'nodata', 'ghost'], len: 5200 },
    { name: 'Масштаб', sub: 'Финальный босс – комитет', pool: ['committee', 'ib', 'ghost', 'legacy', 'feature'], len: 5600 }
  ];
  const TOTAL = STAGES.reduce((s, x) => s + x.len, 0);
  const STARTS = STAGES.map((_, i) => STAGES.slice(0, i).reduce((s, x) => s + x.len, 0));
  const GATE = TOTAL + 150;

  // air – высота нижнего края над землёй: такие препятствия летят, под ними можно пригнуться
  const KINDS = {
    paper: { label: 'Согласование', w: 34, h: 44 },
    nodata: { label: 'Нет данных', w: 48, h: 34 },
    ib: { label: 'ИБ', w: 30, h: 62 },
    legacy: { label: 'Legacy', w: 50, h: 46 },
    committee: { label: 'Комитет', w: 78, h: 50 },
    ghost: { label: 'Галлюцинация', w: 40, h: 40, air: 48, bob: 1 },
    feature: { label: '+1 фича', w: 46, h: 24, air: 52, bob: 1, fly: 70 }
  };
  const ENDS = {
    paper: ['Утонули в согласованиях', 'Одно решение – один владелец и срок. Согласования собирайте параллельно, а не по очереди.'],
    nodata: ['Не нашлось данных', 'Данные проверяют в discovery, до обещаний бизнесу.'],
    feature: ['Scope creep победил', 'Новые фичи – во второй этап. Пилот проверяет одну гипотезу.'],
    ib: ['Не прошли ИБ', 'Безопасников зовут на первую встречу, а не на последнюю.'],
    legacy: ['Застряли в legacy', 'На пилоте только читаем из старых систем, запись – потом.'],
    ghost: ['Галлюцинация в проде', 'Evals на реальных диалогах и ответы только со ссылкой на источник.'],
    committee: ['Комитет не убедили', 'На комитет идут с baseline и эффектом в деньгах, а не с демо.']
  };
  const BOARDS = ['AI-first', 'Где ROI?', 'Q3 roadmap', 'Нужен пилот', 'Agentic', 'Срочно в прод', 'GenAI 2.0', 'Хотим как у всех'];

  // ---------- colors follow the site theme ----------
  let C = {};
  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    C = { paper: v('--paper'), card: v('--card'), ink: v('--ink'), muted: v('--muted'), line: v('--line'), chip: v('--chip'), fig: v('--figure'), blue: v('--blue') };
  };
  readColors();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { readColors(); draw(); });

  // ---------- sound ----------
  let ac = null, muted = false;
  try { muted = localStorage.getItem('mm-runner-muted') === '1'; } catch {}
  soundBtn.setAttribute('aria-pressed', String(!muted));
  const beep = (f1, f2, dur, type = 'square', vol = .05, delay = 0) => {
    if (muted) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f1, t0);
      o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      o.connect(g).connect(ac.destination);
      o.start(t0); o.stop(t0 + dur);
    } catch {}
  };
  const SFX = {
    jump: () => beep(360, 700, .13),
    jump2: () => beep(520, 980, .12),
    coin: () => { beep(988, 988, .05, 'square', .03); beep(1319, 1319, .08, 'square', .03, .05); },
    hit: () => beep(240, 50, .32, 'sawtooth', .06),
    save: () => beep(700, 300, .22, 'triangle', .07),
    up: () => beep(660, 990, .16, 'triangle', .06),
    stage: () => [523, 784].forEach((f, i) => beep(f, f, .12, 'triangle', .05, i * .1)),
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, f, .2, 'square', .045, i * .11)),
    lose: () => [392, 330, 262].forEach((f, i) => beep(f, f * .97, .22, 'triangle', .06, i * .16))
  };
  soundBtn.addEventListener('click', () => {
    muted = !muted;
    soundBtn.setAttribute('aria-pressed', String(!muted));
    try { localStorage.setItem('mm-runner-muted', muted ? '1' : '0'); } catch {}
  });

  // ---------- size ----------
  let W = 800, k = 1, px = 90;
  const resize = () => {
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const scale = r.height / LH;
    W = r.width / scale;
    k = Math.max(.7, Math.min(1, W / 800));
    px = Math.max(62, Math.min(150, W * .13));
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    draw();
  };

  // ---------- state ----------
  let state = 'start';
  let p, obs, items, parts, texts, dist, nextX, stageIdx, hearts, coins, shield, inv, t, shake, fv, decel, finT, lastKind, best = 0;
  try { best = +localStorage.getItem('mm-runner-best') || 0; } catch {}
  const keys = { down: false };

  const reset = () => {
    p = { y: 0, vy: 0, jumps: 0, duck: false, phase: 0, blink: 0, blinkIn: 2 };
    obs = []; items = []; parts = []; texts = [];
    dist = 0; nextX = 760; stageIdx = 0; hearts = 3; coins = 0; shield = false; inv = 0; t = 0; shake = 0; finT = 0; lastKind = 'paper';
  };
  reset();

  const stageAt = x => { let i = 0; while (i < STAGES.length - 1 && x >= STARTS[i + 1]) i++; return i; };
  const speedAt = x => (330 + stageAt(x) * 55 + x / TOTAL * 45) * k;

  // ---------- spawning ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const spawn = () => {
    const st = STAGES[stageAt(nextX)];
    const kind = st.pool[Math.floor(Math.random() * st.pool.length)];
    const K = KINDS[kind];
    obs.push({ kind, x: nextX, w: K.w, h: K.h, air: K.air || 0, bob: K.bob, fly: K.fly || 0, seed: Math.random() * 6 });
    const gap = speedAt(nextX) * rand(.95, 1.8) + K.w;
    const r = Math.random();
    if (r < .58) {
      const n = 3 + Math.floor(Math.random() * 3), x0 = nextX + K.w + gap * .22, high = Math.random() < .5;
      for (let i = 0; i < n; i++) items.push({ kind: 'coin', x: x0 + i * 26, h: high ? 46 + Math.sin(i / (n - 1) * Math.PI) * 70 : 24 });
    } else if (r < .66) items.push({ kind: 'shield', x: nextX + K.w + gap * .45, h: 96 });
    else if (r < .7 && hearts < 3) items.push({ kind: 'heart', x: nextX + K.w + gap * .45, h: 104 });
    nextX += gap;
  };

  // ---------- particles & floating texts ----------
  const burst = (x, h, n, colors, power = 1) => {
    if (still) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) parts.push({ x, h, vx: (Math.random() - .5) * 320 * power, vh: rand(80, 300) * power, life: rand(.5, 1.1), t: 0, c: colors[i % colors.length], s: rand(2, 5), r: Math.random() * 6 });
  };
  const say = (text, color) => texts.push({ x: dist + 10, h: 100, text, color, t: 0 });

  // ---------- HUD ----------
  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C1 8.6 3 5 6.5 5c2 0 3.6 1.1 4.5 2.6C11.9 6.1 13.5 5 15.5 5 19 5 21 8.6 19.6 11.8 17.5 16.4 12 21 12 21Z"/></svg>';
  hud.innerHTML = `
    <div class="rn-hearts" role="img" aria-label="Доверие бизнеса">${HEART.repeat(3)}</div>
    <div class="rn-track"><span class="rn-stage"></span><div class="rn-bar"><i></i>${STARTS.slice(1).map(s => `<s style="left:${s / TOTAL * 100}%"></s>`).join('')}<b>PROD</b></div></div>
    <div class="rn-coins"><span>0</span> млн ₽</div>`;
  const heartEls = [...hud.querySelectorAll('.rn-hearts svg')];
  const stageEl = hud.querySelector('.rn-stage');
  const barEl = hud.querySelector('.rn-bar');
  const coinEl = hud.querySelector('.rn-coins');
  const paintHearts = lost => heartEls.forEach((h, i) => {
    h.classList.toggle('is-on', i < hearts);
    if (lost && i === hearts) { h.classList.remove('is-lost'); h.offsetWidth; h.classList.add('is-lost'); }
  });
  const paintCoins = () => { coinEl.firstElementChild.textContent = coins; coinEl.classList.remove('is-pop'); coinEl.offsetWidth; coinEl.classList.add('is-pop'); };
  const paintStage = () => { stageEl.textContent = `Этап ${stageIdx + 1} из ${STAGES.length} · ${STAGES[stageIdx].name}`; };

  let bannerTimer;
  const showBanner = () => {
    const s = STAGES[stageIdx];
    banner.innerHTML = `<small>Этап ${stageIdx + 1} из ${STAGES.length}</small><strong>${s.name}</strong><span>${s.sub}</span>`;
    banner.classList.add('is-on');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => banner.classList.remove('is-on'), 1900);
  };

  // ---------- screens ----------
  const KEYS = touch
    ? '<li>Тап по игре – прыжок, в воздухе ещё раз</li><li>Кнопка справа – пригнуться</li>'
    : '<li><kbd>Пробел</kbd> или <kbd>↑</kbd> – прыжок, в воздухе ещё раз</li><li><kbd>↓</kbd> – пригнуться</li>';
  const panel = (html, focus) => {
    screen.innerHTML = `<div class="rn-panel">${html}</div>`;
    screen.hidden = false;
    if (focus) screen.querySelector('[data-act]')?.focus({ preventScroll: true });
  };
  const intro = () => panel(`
    <p class="rn-kicker">Игра · около минуты</p>
    <h3>Это ваш AI-пилот</h3>
    <p>Доведите его до production: 4 этапа, 3 жизни доверия бизнеса и много ₽ эффекта по пути.</p>
    <ul class="rn-keys">${KEYS}</ul>
    <div class="rn-btns"><button type="button" class="btn btn-blue" data-act="play">Играть</button></div>`);

  const over = () => {
    const [title, tip] = ENDS[lastKind];
    const pct = Math.min(99, Math.round(dist / TOTAL * 100));
    panel(`
      <p class="rn-kicker">Проект закрыт на этапе ${STAGES[stageIdx].name}</p>
      <h3 class="is-lost">${title}</h3>
      <p>Пройдено ${pct}% пути, собрано ${coins} млн ₽ эффекта.</p>
      <p><strong>Совет Михаила:</strong> ${tip}</p>
      <div class="rn-btns"><button type="button" class="btn btn-blue" data-act="play">Ещё раз</button></div>`, true);
  };

  const win = () => {
    const rec = coins > best;
    if (rec) { best = coins; try { localStorage.setItem('mm-runner-best', String(best)); } catch {} }
    const rank = coins >= 45 ? 'AI Transformation Lead' : coins >= 20 ? 'Крепкий delivery' : 'Дошли до прода на характере';
    const msg = `Довёл пилот до production в игре на вашем сайте: ${coins} млн ₽ эффекта. Хочу обсудить реальный проект.`;
    panel(`
      <p class="rn-kicker">Пилот в production</p>
      <h3>${rank}</h3>
      <p>Эффект: <strong>${coins} млн ₽</strong>, доверие бизнеса: <strong>${hearts} из 3</strong>.${rec ? ' Это ваш рекорд.' : ` Рекорд: ${best} млн ₽.`}</p>
      <p>В реальном проекте препятствия те же, только кнопки "Ещё раз" нет.</p>
      <div class="rn-btns">
        <button type="button" class="btn btn-blue" data-act="play">Ещё раз</button>
        <a class="btn btn-line" href="${TG}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Обсудить ваш пилот</a>
      </div>`, true);
  };

  const pausePanel = () => panel(`
    <p class="rn-kicker">Пауза</p>
    <h3>Пилот ждёт</h3>
    <p>Этап ${stageIdx + 1} из ${STAGES.length}, собрано ${coins} млн ₽.</p>
    <div class="rn-btns"><button type="button" class="btn btn-blue" data-act="resume">Продолжить</button></div>`, true);

  // ---------- control ----------
  const setRunning = on => {
    root.classList.toggle('is-running', on);
    duckBtn.hidden = !(on && touch);
    if (!on) { keys.down = false; duckBtn.classList.remove('is-down'); }
  };

  const play = () => {
    reset();
    state = 'run';
    screen.hidden = true;
    hud.hidden = false;
    paintHearts(); coinEl.firstElementChild.textContent = '0'; paintStage(); showBanner();
    setRunning(true);
    root.focus({ preventScroll: true });
    const r = root.getBoundingClientRect();
    if (r.top < 70 || r.bottom > innerHeight) root.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
    kick();
  };
  const pause = () => { if (state !== 'run') return; state = 'pause'; setRunning(false); pausePanel(); };
  const resume = () => { state = 'run'; screen.hidden = true; setRunning(true); root.focus({ preventScroll: true }); kick(); };

  const jump = () => {
    if (state !== 'run') return;
    if (p.y <= 0 && p.vy <= 0) { p.vy = JUMP; p.y = .01; p.jumps = 1; SFX.jump(); }
    else if (p.jumps < 2) { p.vy = JUMP2; p.jumps = 2; SFX.jump2(); burst(dist, p.y, 6, [C.line, C.fig], .5); }
  };

  screen.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    ({ play, resume })[b.dataset.act]?.();
  });

  addEventListener('keydown', e => {
    if (state !== 'run') return;
    if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); if (!e.repeat) jump(); }
    else if (['ArrowDown', 'KeyS'].includes(e.code)) { e.preventDefault(); keys.down = true; }
    else if (e.code === 'Escape' || e.code === 'KeyP') pause();
  });
  addEventListener('keyup', e => { if (['ArrowDown', 'KeyS'].includes(e.code)) keys.down = false; });

  root.addEventListener('pointerdown', e => {
    if (state !== 'run' || e.target.closest('button, a')) return;
    e.preventDefault();
    jump();
  });
  const duck = on => e => { e.preventDefault(); keys.down = on; duckBtn.classList.toggle('is-down', on); };
  duckBtn.addEventListener('pointerdown', duck(true));
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => duckBtn.addEventListener(n, duck(false)));
  duckBtn.addEventListener('contextmenu', e => e.preventDefault());

  // ---------- update ----------
  const hitBy = o => {
    o.hit = true; o.kvx = 420; o.kvh = 460; o.kx = 0; o.kh = 0; o.kr = 0;
    if (shield) {
      shield = false; inv = .8;
      burst(o.x + o.w / 2, o.air + o.h / 2, 16, [C.fig, '#fff', LIVE]);
      say('Evals спасли!', C.fig); SFX.save();
      return;
    }
    hearts--; inv = 1.5; shake = .35; lastKind = o.kind;
    burst(dist, 40, 14, [RED, C.ink, '#fff']);
    say('−доверие', RED); SFX.hit();
    paintHearts(true);
    if (hearts <= 0) {
      state = 'over'; setRunning(false); SFX.lose();
      setTimeout(() => { if (state === 'over') over(); }, 800);
    }
  };

  const stepParts = dt => {
    parts.forEach(q => { q.t += dt; q.vh -= 900 * dt; q.x += q.vx * dt; q.h = Math.max(0, q.h + q.vh * dt); q.r += dt * 8; });
    parts = parts.filter(q => q.t < q.life);
    texts.forEach(q => { q.t += dt; q.h += 40 * dt; });
    texts = texts.filter(q => q.t < 1.1);
  };
  const blinkTick = dt => {
    p.blinkIn -= dt;
    if (p.blinkIn < 0) { p.blink = .12; p.blinkIn = rand(2, 4.5); }
    if (p.blink > 0) p.blink -= dt;
  };

  const update = dt => {
    t += dt;
    let v;
    if (state === 'finish') { fv = Math.max(0, fv - decel * dt); v = fv; finT += dt; }
    else v = speedAt(dist);
    dist += v * dt;

    const s = stageAt(dist);
    if (s !== stageIdx && state === 'run') { stageIdx = s; paintStage(); showBanner(); SFX.stage(); }

    // игрок
    const wasAir = p.y > 0;
    p.duck = state === 'run' && keys.down;
    if (p.y > 0 || p.vy > 0) {
      p.vy -= GRAV * (p.duck ? 2.4 : 1) * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; p.jumps = 0; if (wasAir) burst(dist, 2, 6, [C.line], .35); }
    }
    p.phase += dt * v / 18;
    if (inv > 0) inv -= dt;
    if (shake > 0) shake -= dt;
    blinkTick(dt);

    if (state === 'run') {
      while (nextX - dist + px < W + 120 && nextX < TOTAL - 260) spawn();
      if (dist >= TOTAL) {
        state = 'finish'; setRunning(false); fv = v; decel = v * v / (2 * (GATE - 20 - dist));
        banner.classList.remove('is-on');
        SFX.win();
        burst(GATE, 150, 50, [C.fig, LIVE, RED, GOLD, GREEN], 1.4);
      }
    }
    if (state === 'finish' && finT > 1.5) {
      state = 'win';
      win();
    }

    // препятствия
    const ph = p.duck ? (p.y < 4 ? 34 : 40) : 60;
    const pl = px - 15, pr = px + 15, pb = p.y, pt = p.y + ph;
    for (const o of obs) {
      if (o.fly) o.x -= o.fly * dt;
      if (o.hit) { o.kx += o.kvx * dt; o.kh += o.kvh * dt; o.kvh -= 1500 * dt; o.kr += 7 * dt; continue; }
      if (state !== 'run' || inv > 0) continue;
      const sx = o.x - dist + px;
      if (sx > pr + 4 || sx + o.w < pl - 4) continue;
      const b = o.air + (o.bob ? Math.sin(t * 4 + o.seed) * 5 : 0);
      if (pr - 5 > sx && pl + 5 < sx + o.w && pt - 4 > b && pb + 3 < b + o.h) hitBy(o);
    }
    obs = obs.filter(o => o.x - dist + px + (o.kx || 0) > -160 && (o.kh || 0) > -400);

    // бонусы
    const cy = p.y + ph / 2;
    for (const it of items) {
      if (it.got || state !== 'run') continue;
      const dx = it.x - dist, dy = it.h - cy;
      if (dx * dx + dy * dy < 34 * 34) {
        it.got = true;
        if (it.kind === 'coin') { coins++; paintCoins(); SFX.coin(); burst(it.x, it.h, 5, [GREEN, LIVE], .5); }
        else if (it.kind === 'shield') { shield = true; SFX.up(); say('Evals: щит от удара', C.fig); }
        else { hearts = Math.min(3, hearts + 1); paintHearts(); SFX.up(); say('+доверие: нашёлся спонсор', GREEN); }
      }
    }
    items = items.filter(it => !it.got && it.x - dist + px > -40);

    stepParts(dt);
    barEl.style.setProperty('--p', Math.min(1, dist / TOTAL));
  };

  const idle = dt => {
    t += dt;
    obs.forEach(o => { if (o.hit) { o.kx += o.kvx * dt; o.kh += o.kvh * dt; o.kvh -= 1500 * dt; o.kr += 7 * dt; } });
    if (state === 'start') dist += 28 * dt;
    if (state === 'win') {
      p.y = Math.abs(Math.sin(t * 5)) * 26;
      if (!still && Math.random() < dt * 2.5) burst(GATE + rand(-60, 60), rand(120, 180), 12, [C.fig, LIVE, RED, GOLD, GREEN], .9);
    }
    blinkTick(dt);
    stepParts(dt);
  };

  // ---------- drawing ----------
  const rr = (x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  const line = (a, b, c, d) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); };
  const dot = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const text = (s, x, y, font, color, align = 'center') => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); };
  const FONT = (w, s) => `${w} ${s}px Onest, system-ui, sans-serif`;
  const DISPLAY = s => `700 ${s}px Unbounded, system-ui, sans-serif`;
  const pill = (s, cx, bottom, bg = C.ink, fg = C.card) => {
    ctx.font = FONT(600, 11);
    const w = ctx.measureText(s).width + 14;
    ctx.fillStyle = bg; rr(cx - w / 2, bottom - 19, w, 19, 9.5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 4, bottom); ctx.lineTo(cx + 4, bottom); ctx.lineTo(cx, bottom + 4); ctx.fill();
    text(s, cx, bottom - 9, FONT(600, 11), fg);
  };

  const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const CITY = (() => {
    const r = rng(11), list = [];
    let x = 0;
    while (x < 1900) { const w = 40 + r() * 70, h = 50 + r() * 120; list.push({ x, w, h }); x += w + 6 + r() * 34; }
    return { list, period: x };
  })();
  const CLOUDS = (() => {
    const r = rng(5), list = [];
    for (let i = 0; i < 6; i++) list.push({ x: i * 300 + r() * 120, y: 34 + r() * 70, s: .7 + r() * .6 });
    return { list, period: 1800 };
  })();

  const tile = (period, par, fn) => {
    const off = (dist * par) % period;
    for (let k2 = -1; k2 * period - off < W + period; k2++) fn(k2 * period - off, k2 + Math.floor(dist * par / period));
  };

  const scene = () => {
    ctx.fillStyle = C.card; ctx.fillRect(0, 0, W, LH);
    const g = ctx.createLinearGradient(0, GY - 160, 0, GY);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, C.paper);
    ctx.fillStyle = g; ctx.fillRect(0, GY - 160, W, 160);

    // облака
    ctx.fillStyle = C.paper;
    tile(CLOUDS.period, .08, ox => CLOUDS.list.forEach(c => {
      const x = ox + c.x;
      if (x < -120 || x > W + 120) return;
      dot(x, c.y, 16 * c.s); dot(x + 20 * c.s, c.y - 8 * c.s, 20 * c.s); dot(x + 44 * c.s, c.y, 15 * c.s); ctx.fillRect(x, c.y, 44 * c.s, 15 * c.s);
    }));

    // город на горизонте: башни крупного бизнеса
    ctx.save();
    ctx.globalAlpha = .09; ctx.fillStyle = C.fig;
    tile(CITY.period, .15, ox => CITY.list.forEach(b => {
      const x = ox + b.x;
      if (x + b.w < 0 || x > W) return;
      ctx.fillRect(x, GY - b.h, b.w, b.h);
    }));
    ctx.globalAlpha = .12;
    tile(CITY.period, .15, ox => CITY.list.forEach(b => {
      const x = ox + b.x;
      if (x + b.w < 0 || x > W) return;
      for (let wy = GY - b.h + 10; wy < GY - 14; wy += 16) for (let wx = x + 8; wx < x + b.w - 10; wx += 14) ctx.fillRect(wx, wy, 6, 7);
    }));
    ctx.restore();

    // билборды с корпоративными лозунгами
    tile(1100, .45, (ox, i) => {
      const x = ox + 520;
      if (x < -80 || x > W + 80) return;
      ctx.strokeStyle = C.line; ctx.lineWidth = 4; line(x, GY, x, GY - 92);
      ctx.fillStyle = C.card; ctx.strokeStyle = C.line; ctx.lineWidth = 2;
      rr(x - 56, GY - 132, 112, 42, 10); ctx.fill(); ctx.stroke();
      text(BOARDS[((i % BOARDS.length) + BOARDS.length) % BOARDS.length], x, GY - 111, FONT(600, 13), C.muted);
    });

    // земля
    ctx.fillStyle = C.paper; ctx.fillRect(0, GY, W, LH - GY);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; line(0, GY + 1, W, GY + 1);
    ctx.strokeStyle = C.line; ctx.lineWidth = 2;
    for (let x = -(dist % 36); x < W; x += 36) line(x, GY + 16, x + 12, GY + 16);
    for (let x = -((dist + 18) % 54); x < W; x += 54) line(x, GY + 34, x + 20, GY + 34);

    // вехи этапов
    STARTS.slice(1).forEach((s0, i) => {
      const x = s0 - dist + px;
      if (x < -80 || x > W + 80) return;
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3; line(x, GY, x, GY - 74);
      ctx.fillStyle = C.fig; rr(x, GY - 74, 92, 24, 5); ctx.fill();
      text(STAGES[i + 1].name, x + 46, GY - 62, FONT(700, 11), '#fff');
    });

    // финиш: production
    const gx = GATE - dist + px;
    if (gx > -140 && gx < W + 140) {
      ctx.fillStyle = C.ink;
      rr(gx - 64, GY - 128, 34, 128, 5); ctx.fill();
      rr(gx + 30, GY - 128, 34, 128, 5); ctx.fill();
      for (let r = 0; r < 7; r++) for (const side of [-56, 38]) {
        ctx.fillStyle = (Math.floor(t * 6) + r + side) % 3 ? LIVE : '#2b2f5a';
        dot(gx + side, GY - 116 + r * 16, 2.5);
        ctx.fillStyle = '#2b2f5a'; ctx.fillRect(gx + side + 6, GY - 118 + r * 16, 12, 4);
      }
      ctx.fillStyle = C.blue; rr(gx - 76, GY - 166, 152, 32, 9); ctx.fill();
      text('PRODUCTION', gx, GY - 150, DISPLAY(13), '#fff');
    }
  };

  const drawObs = o => {
    const b = o.air + (o.bob ? Math.sin(t * 4 + o.seed) * 5 : 0);
    let sx = o.x - dist + px;
    if (sx > W + 80 || sx < -200) return;
    ctx.save();
    if (o.hit) {
      ctx.translate(sx + o.w / 2 + o.kx, GY - b - o.h / 2 - o.kh);
      ctx.rotate(o.kr);
      ctx.translate(-(sx + o.w / 2), -(GY - b - o.h / 2));
      ctx.globalAlpha = .85;
    }
    const x = sx, top = GY - b - o.h, w = o.w, h = o.h, base = GY - b;
    ctx.lineWidth = 2;
    switch (o.kind) {
      case 'paper':
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = '#fff'; ctx.strokeStyle = '#C8CBDA';
          rr(x + (i % 2 ? 3 : -2), base - 11 * (i + 1), w, 10, 2); ctx.fill(); ctx.stroke();
        }
        ctx.save(); ctx.translate(x + w / 2, top + 6); ctx.rotate(-.2);
        ctx.strokeStyle = RED; ctx.lineWidth = 1.5; rr(-15, -7, 30, 14, 3); ctx.stroke();
        text('НЕТ', 0, 0, FONT(800, 9), RED);
        ctx.restore();
        break;
      case 'nodata':
        ctx.fillStyle = '#E59E2E'; rr(x, top, w * .45, 10, 3); ctx.fill();
        rr(x, top + 5, w, h - 5, 4); ctx.fill();
        ctx.fillStyle = GOLD; rr(x, top + 11, w, h - 11, 4); ctx.fill();
        text('?', x + w / 2, top + 22, FONT(800, 18), '#fff');
        break;
      case 'ib':
        ctx.fillStyle = RED; rr(x, top, w, h, 4); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1.5;
        for (let y = top + 10; y < base; y += 10) line(x, y, x + w, y);
        for (let y = top, j = 0; y < base; y += 10, j++) line(x + (j % 2 ? w / 3 : w * 2 / 3), y, x + (j % 2 ? w / 3 : w * 2 / 3), y + 10);
        ctx.fillStyle = '#fff'; rr(x + w / 2 - 8, top + h / 2 - 4, 16, 13, 3); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(x + w / 2, top + h / 2 - 4, 5, Math.PI, 0); ctx.stroke();
        break;
      case 'legacy':
        ctx.fillStyle = '#CFC8B8'; rr(x, top, w, h - 9, 6); ctx.fill();
        ctx.fillStyle = '#B9B19F'; ctx.fillRect(x + w / 2 - 9, base - 9, 18, 5); rr(x + 6, base - 5, w - 12, 5, 2); ctx.fill();
        ctx.fillStyle = SCREEN; rr(x + 6, top + 6, w - 12, h - 23, 4); ctx.fill();
        text('C:\\>' + (Math.floor(t * 3) % 2 ? '_' : ''), x + 10, top + 14, '600 9px ui-monospace, Menlo, monospace', '#4ADE80', 'left');
        break;
      case 'committee':
        ctx.fillStyle = C.muted;
        [[14, 0], [w / 2, -4], [w - 14, 0]].forEach(([dx, dy]) => { dot(x + dx, top + 10 + dy, 9); rr(x + dx - 11, top + 16 + dy, 22, 16, 6); ctx.fill(); });
        ctx.fillStyle = RED; [[14, 0], [w / 2, -4], [w - 14, 0]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.moveTo(x + dx - 2, top + 18 + dy); ctx.lineTo(x + dx + 2, top + 18 + dy); ctx.lineTo(x + dx, top + 26 + dy); ctx.fill(); });
        ctx.fillStyle = C.ink; rr(x - 4, base - 26, w + 8, 26, 4); ctx.fill();
        ctx.fillStyle = GOLD; dot(x + w - 4, base - 30, 4);
        break;
      case 'ghost': {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = C.line;
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(x, top + w / 2);
        ctx.arc(x + w / 2, top + w / 2, w / 2, Math.PI, 0);
        ctx.lineTo(x + w, base);
        for (let i = 4; i > 0; i--) ctx.quadraticCurveTo(x + w * (i - .5) / 4, base + (i % 2 ? -7 : 7) * Math.sin(t * 8 + o.seed), x + w * (i - 1) / 4, base);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = SCREEN; dot(x + w * .36, top + 16, 3.5); dot(x + w * .64, top + 16, 3.5);
        ctx.beginPath(); ctx.ellipse(x + w / 2, top + 26, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'feature':
        ctx.fillStyle = '#fff'; ctx.strokeStyle = C.fig;
        ctx.beginPath(); ctx.moveTo(x, top + h / 2); ctx.lineTo(x + w, top); ctx.lineTo(x + w * .7, base); ctx.closePath(); ctx.fill(); ctx.stroke();
        line(x, top + h / 2, x + w * .62, top + h * .62);
        text('+1', x + w * .62, top + h * .4, FONT(800, 10), C.fig);
        break;
    }
    if (!o.hit) pill(KINDS[o.kind].label, x + w / 2, top - 7);
    ctx.restore();
  };

  const drawItem = it => {
    const x = it.x - dist + px, y = GY - it.h + Math.sin(t * 4 + it.x) * 3;
    if (x < -30 || x > W + 30) return;
    if (it.kind === 'coin') {
      const sc = Math.abs(Math.cos(t * 4 + it.x / 50));
      ctx.fillStyle = GREEN;
      ctx.beginPath(); ctx.ellipse(x, y, 11 * sc + 1.5, 11, 0, 0, Math.PI * 2); ctx.fill();
      if (sc > .45) text('₽', x, y + .5, FONT(800, 13), '#fff');
    } else if (it.kind === 'shield') {
      ctx.fillStyle = C.fig;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x - 1, y + 4); ctx.lineTo(x + 6, y - 4); ctx.stroke();
      pill('Evals', x, y - 18, C.fig, '#fff');
    } else {
      ctx.fillStyle = RED;
      ctx.save(); ctx.translate(x - 12, y - 12); ctx.scale(1, 1);
      ctx.fill(new Path2D('M12 21s-7.5-4.6-9.6-9.2C1 8.6 3 5 6.5 5c2 0 3.6 1.1 4.5 2.6C11.9 6.1 13.5 5 15.5 5 19 5 21 8.6 19.6 11.8 17.5 16.4 12 21 12 21Z'));
      ctx.restore();
      pill('Спонсор', x, y - 16, RED, '#fff');
    }
  };

  const drawBot = () => {
    const h = p.y, x = px, air = h > 0;
    const duck = p.duck && state === 'run';
    const hurt = state === 'over' || (state === 'run' && inv > 1.1);
    const happy = state === 'win' || state === 'finish';
    // тень
    ctx.fillStyle = C.ink; ctx.globalAlpha = .13 * Math.max(.3, 1 - h / 200);
    ctx.beginPath(); ctx.ellipse(x, GY + 3, 19 * Math.max(.5, 1 - h / 300), 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = state === 'run' && inv > 0 && Math.floor(t * 14) % 2 ? .35 : 1;
    ctx.save();
    ctx.translate(x, GY - h);
    if (duck) ctx.scale(1.18, .58);
    if (state === 'over') ctx.rotate(.12);
    const run = air || state === 'start' || state === 'over' || state === 'pause' ? 0 : Math.sin(p.phase);
    ctx.lineCap = 'round'; ctx.strokeStyle = C.ink;
    // ноги и руки
    ctx.lineWidth = 5;
    if (air) { line(-6, -14, -10, -5); line(6, -14, 10, -7); }
    else { line(-5, -14, -5 + run * 8, -1); line(5, -14, 5 - run * 8, -1); }
    ctx.lineWidth = 4;
    if (air || happy) { line(-15, -28, -22, -42); line(15, -28, 22, -42); }
    else { line(-15, -28, -20 - run * 4, -17); line(15, -28, 20 + run * 4, -17); }
    // тело
    ctx.fillStyle = C.fig; rr(-15, -37, 30, 25, 8); ctx.fill();
    text('AI', 0, -24, DISPLAY(9), '#fff');
    // голова
    ctx.translate(0, air ? 0 : -Math.abs(run) * 1.6);
    ctx.fillStyle = C.fig; rr(-21, -71, 42, 35, 11); ctx.fill();
    ctx.fillStyle = SCREEN; rr(-16, -66, 32, 25, 7); ctx.fill();
    const look = state === 'run' ? 2 : 0;
    if (hurt) {
      ctx.strokeStyle = RED; ctx.lineWidth = 2;
      [-6, 6].forEach(ex => { line(ex - 3 + look, -57, ex + 3 + look, -51); line(ex + 3 + look, -57, ex - 3 + look, -51); });
    } else if (happy) {
      ctx.strokeStyle = LIVE; ctx.lineWidth = 2.5;
      [-6, 6].forEach(ex => { ctx.beginPath(); ctx.arc(ex, -52, 3.5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); });
    } else {
      ctx.fillStyle = '#fff';
      const bh = p.blink > 0 ? .8 : 5.5;
      [-6, 6].forEach(ex => { ctx.beginPath(); ctx.ellipse(ex + look, -54, 3.2, bh, 0, 0, Math.PI * 2); ctx.fill(); });
    }
    // антенна с зелёной лампочкой, как на сайте
    ctx.strokeStyle = C.fig; ctx.lineWidth = 3; line(0, -71, 0, -80);
    const pulse = .5 + Math.sin(t * 5) * .5;
    ctx.fillStyle = 'rgba(124,242,156,' + (.25 * pulse) + ')'; dot(0, -83, 8);
    ctx.fillStyle = hurt ? RED : LIVE; dot(0, -83, 4);
    ctx.restore();
    // щит evals
    if (shield) {
      ctx.globalAlpha = .5 + Math.sin(t * 6) * .2;
      ctx.strokeStyle = C.fig; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, GY - h - 40, 50, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = .08; ctx.fillStyle = C.fig; ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const draw = () => {
    if (!C.card) return;
    ctx.save();
    if (shake > 0 && !still) ctx.translate((Math.random() - .5) * 10 * shake / .35, (Math.random() - .5) * 6 * shake / .35);
    scene();
    items.forEach(drawItem);
    obs.forEach(drawObs);
    drawBot();
    parts.forEach(q => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - q.t / q.life);
      ctx.translate(q.x - dist + px, GY - q.h); ctx.rotate(q.r);
      ctx.fillStyle = q.c; ctx.fillRect(-q.s / 2, -q.s / 2, q.s, q.s * .7);
      ctx.restore();
    });
    texts.forEach(q => {
      ctx.globalAlpha = Math.max(0, 1 - q.t / 1.1);
      text(q.text, q.x - dist + px, GY - q.h, FONT(700, 14), q.color);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  };

  // ---------- loop ----------
  let raf = 0, last = 0, visible = false;
  const active = () => state === 'run' || state === 'finish';
  const wants = () => visible && !document.hidden && (active() || (!still && state !== 'pause'));
  const loop = now => {
    raf = 0;
    const dt = Math.min(.033, (now - last) / 1000);
    last = now;
    if (active()) update(dt); else idle(dt);
    draw();
    if (wants()) raf = requestAnimationFrame(loop);
  };
  function kick() {
    if (raf || !wants()) return;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (!visible && state === 'run') pause();
      kick();
    }, { threshold: .35 }).observe(root);
  } else { visible = true; }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else kick(); });

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(cv); else addEventListener('resize', resize);
  resize();
  if (document.fonts) document.fonts.ready.then(draw);
  intro();
  kick();
})();

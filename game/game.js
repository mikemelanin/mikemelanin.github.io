// Игра "Доведи пилот до production": раннер на canvas.
// Герой – Clawd, пиксельный маскот Claude Code, в роли AI-пилота. 4 этапа проекта, в финале босс – инвесткомитет.
// Прыгает через согласования, ИБ и legacy, пригибается от галлюцинаций и дедлайнов, собирает ₽ эффекта и бонусы:
// Evals – щит, MCP – магнит для ₽, ultrathink – неуязвимость, Vibe coding – радуга и ₽ x2. Тексты и баланс – в STAGES, KINDS, ENDS, QUIPS, BOSS.
// По кнопке Играть подгружается слой эффектов на Phaser (game/fx.js): свечение, частицы, тряска. Без него игра идёт как есть.
(() => {
  const root = document.querySelector('.rn');
  if (!root) return;
  const cv = root.querySelector('canvas');
  const base = cv.getContext('2d');
  // ctx – куда рисуем сейчас: кадр или canvas свечения (G = true), который fx.js размывает поверх кадра
  let ctx = base, G = false;
  const gcv = document.createElement('canvas'), gctx = gcv.getContext('2d');
  const hud = root.querySelector('.rn-hud');
  const screen = root.querySelector('.rn-screen');
  const banner = root.querySelector('.rn-banner');
  const duckBtn = root.querySelector('.rn-duck');
  const soundBtn = root.querySelector('.rn-sound');
  const TG = 'https://t.me/mike_melanin';
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(pointer: coarse)').matches;
  const TAU = Math.PI * 2;

  // сцена в логических единицах: высота всегда 320, ширина зависит от экрана
  const LH = 320, GY = 262;
  const GRAV = 2700, JUMP = 930, JUMP2 = 820, JUMP_CUT = 600;
  const RED = '#E5484D', GREEN = '#1F9D55', LIVE = '#7CF29C', SCREEN = '#0A0C26', GOLD = '#F5B544', MCP = '#3E63DD';
  // Clawd: фирменный оранжевый Claude, глаза почти чёрные, реплики – в терминальном пузыре
  const CLAWD = '#D97757', EYE = '#141413', TERM = '#1F1E1D', IVORY = '#F0EEE6';
  // ultrathink горит огнём: от жёлтого у героя к красному на хвосте
  const FIRE = ['#FFF3B0', '#FFD166', '#FFA552', '#D97757', '#E5484D'];
  // бустер Vibe coding рисует за героем радугу
  const RAINBOW = ['#FF5F6D', '#FFA552', '#FFE066', '#7CF29C', '#5EC8FF', '#A98BFF'];

  // sky – оттенок неба этапа, look – что стоит на среднем плане
  const STAGES = [
    { name: 'Discovery', sub: 'Прыгайте через согласования и пустые данные', pool: ['paper', 'nodata', 'paper', 'feature', 'meeting'], len: 4200, sky: [255, 170, 110], look: 'office' },
    { name: 'Архитектура', sub: 'Впереди ИБ, legacy и дедлайны', pool: ['ib', 'legacy', 'paper', 'nodata', 'deadline'], len: 4800, sky: [80, 150, 255], look: 'servers' },
    { name: 'Пилот', sub: 'Пригибайтесь от галлюцинаций', pool: ['ghost', 'legacy', 'feature', 'nodata', 'ghost', 'deadline'], len: 5200, sky: [160, 110, 255], look: 'lab' },
    { name: 'Масштаб', sub: 'Всё сразу и быстрее', pool: ['meeting', 'ib', 'ghost', 'legacy', 'feature', 'deadline', 'paper'], len: 5400, sky: [50, 70, 190], look: 'city' }
  ];
  const TOTAL = STAGES.reduce((s, x) => s + x.len, 0);
  const STARTS = STAGES.map((_, i) => STAGES.slice(0, i).reduce((s, x) => s + x.len, 0));
  const NIGHT = [0, .2, .55, 1];

  // финальный босс: члены комитета задают вопросы и бросают их, аргументы снижают скепсис
  const BOSS = {
    name: 'Инвесткомитет', sub: 'Прыгайте и пригибайтесь от вопросов, ловите аргументы', sky: [229, 72, 77],
    questions: ['Где ROI?', 'А ИБ согласовала?', 'Почему не Excel?', 'Кто владелец?', 'А если сломается?', 'Бюджет на 2027?', 'А у конкурентов?', 'Это точно AI?', 'Сколько FTE?', 'А галлюцинации?', 'Где baseline?', 'Давайте ещё пилот'],
    args: ['Baseline', 'Эффект в ₽', 'Evals 95%', 'TCO посчитан', 'ИБ: ок', 'Владелец есть', 'Метрики', 'План на год']
  };

  // air – высота нижнего края над землёй: такие препятствия летят, под ними можно пригнуться
  const KINDS = {
    paper: { label: 'Согласование', w: 34, h: 44 },
    nodata: { label: 'Нет данных', w: 48, h: 34 },
    ib: { label: 'ИБ', w: 30, h: 60 },
    legacy: { label: 'Legacy', w: 50, h: 46 },
    meeting: { label: 'Ещё созвон', w: 78, h: 50 },
    ghost: { label: 'Галлюцинация', w: 40, h: 40, air: 28, bob: 1 },
    feature: { label: '+1 фича', w: 46, h: 24, air: 30, bob: 1, fly: 70 },
    deadline: { label: 'Дедлайн вчера', w: 34, h: 34, air: 30, bob: 1, fly: 40 }
  };
  const ENDS = {
    paper: ['Утонули в согласованиях', 'Одно решение – один владелец и срок. Согласования собирайте параллельно, а не по очереди.'],
    nodata: ['Не нашлось данных', 'Данные проверяют в discovery, до обещаний бизнесу.'],
    feature: ['Scope creep победил', 'Новые фичи – во второй этап. Пилот проверяет одну гипотезу.'],
    ib: ['Не прошли ИБ', 'Безопасников зовут на первую встречу, а не на последнюю.'],
    legacy: ['Застряли в legacy', 'На пилоте только читаем из старых систем, запись – потом.'],
    ghost: ['Галлюцинация в проде', 'Evals на реальных диалогах и ответы только со ссылкой на источник.'],
    meeting: ['Утонули в созвонах', 'Один владелец решения и демо раз в неделю вместо статусов.'],
    deadline: ['Сорвали сроки', 'Пилот – 8–12 недель с контрольными точками, а не год исследований.'],
    question: ['Комитет не убедили', 'На комитет идут с baseline и эффектом в деньгах, а не с демо.']
  };
  // реплики Clawd: с многоточием – с крутящейся звёздочкой, как спиннер Claude Code
  const QUIPS = {
    idle: ['Привет! Я Clawd', 'Готов к пилоту', 'Жду команду…'],
    run: ['Thinking…', 'Clauding…', 'Читаю регламенты…', 'Пишу evals…', 'Собираю baseline…', 'Считаю ROI…', 'Ищу данные…', 'Compacting context…', 'Не галлюцинирую!', 'Ship it!', 'Это не в скоупе', 'Деплой в пятницу?', 'Вижу эффект в P&L', 'Пилот, а не POC', 'Где тут prod?', 'Noodling…', 'Percolating…', 'Combobulating…'],
    hit: ["You're absolutely right!", 'Вы абсолютно правы!', 'Исправляю…', 'Отличный фидбек!', 'Откатываю…'],
    save: ['Evals спасли!', 'Тесты зелёные!'],
    stage: ['Этап закрыт ✓', 'Едем дальше!', 'Demo day пройден'],
    boss: ['Готовлю аргументы…', 'Слайд с ROI готов'],
    approve: ['Ship it!', 'Одобрили!'],
    win: ['В проде! ✓', 'Deployed!']
  };
  const PROPS = {
    office: ['AI-first', 'Где ROI?', 'Нужен пилот', 'Хотим как у всех', 'GenAI 2.0', 'Q3 roadmap', 'Срочно в прод', 'Agentic'],
    servers: ['GPU', 'vLLM', 'on-prem', 'Vector DB', 'k8s', 'AI Gateway', 'MCP', 'RAG'],
    lab: ['evals 92%', 'latency 1.2с', 'CSAT +14', 'точность 0.94', 'cost −38%', 'tokens ок'],
    city: ['Claude Code', 'ultrathink', 'Evals > vibes', 'Ship it', '200K контекста', '/compact', 'MCP везде', 'AI в P&L']
  };

  // ---------- colors follow the site theme ----------
  let C = {};
  const dm = matchMedia('(prefers-color-scheme: dark)');
  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    C = { paper: v('--paper'), card: v('--card'), ink: v('--ink'), muted: v('--muted'), line: v('--line'), chip: v('--chip'), fig: v('--figure'), blue: v('--blue'), dark: dm.matches };
  };
  readColors();
  dm.addEventListener?.('change', () => { readColors(); fx?.theme(C.dark); draw(); });

  // ---------- sound ----------
  let ac = null, muted = false;
  try { muted = localStorage.getItem('mm-runner-muted') === '1'; } catch {}
  soundBtn.setAttribute('aria-pressed', String(!muted));
  // На iPhone Web Audio молчит при беззвучном режиме, поэтому просим режим playback, как у музыки.
  const audio = () => {
    try {
      if (!ac) {
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
        ac = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (ac.state === 'suspended') ac.resume();
    } catch { ac = null; }
    return ac;
  };
  const beep = (f1, f2, dur, type = 'square', vol = .05, delay = 0) => {
    if (muted || !audio()) return;
    try {
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
    coin: n => { const f = 2 ** (Math.min(n, 12) / 24); beep(988 * f, 988 * f, .05, 'square', .03); beep(1319 * f, 1319 * f, .08, 'square', .03, .05); },
    hit: () => beep(240, 50, .32, 'sawtooth', .06),
    save: () => beep(700, 300, .22, 'triangle', .07),
    up: () => beep(660, 990, .16, 'triangle', .06),
    mag: () => { beep(330, 660, .18, 'sine', .08); beep(660, 1320, .18, 'sine', .05, .1); },
    ultra: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => beep(f, f, .09, 'square', .04, i * .05)),
    vibe: () => [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => beep(f, f, .12, 'triangle', .05, i * .04)),
    smash: () => { beep(180, 60, .16, 'square', .06); beep(1200, 600, .08, 'triangle', .03); },
    stage: () => [523, 784].forEach((f, i) => beep(f, f, .12, 'triangle', .05, i * .1)),
    boss: () => [196, 185, 175, 165].forEach((f, i) => beep(f, f * .98, .22, 'sawtooth', .045, i * .18)),
    warn: () => { beep(880, 880, .05, 'square', .025); beep(880, 880, .05, 'square', .025, .09); },
    toss: () => beep(520, 180, .14, 'triangle', .05),
    arg: () => [784, 1175].forEach((f, i) => beep(f, f, .1, 'triangle', .06, i * .07)),
    approve: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, f, .16, 'triangle', .07, i * .09)),
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, f, .2, 'square', .045, i * .11)),
    lose: () => [392, 330, 262].forEach((f, i) => beep(f, f * .97, .22, 'triangle', .06, i * .16))
  };

  // музыка: чиптюн-луп из баса, арпеджио, бочки и хэта; во втором квадрате вступает мелодия
  const N = m => 440 * 2 ** ((m - 69) / 12);
  const SONGS = {
    run: {
      bpm: 132,
      prog: [[45, [57, 60, 64]], [41, [57, 60, 65]], [48, [55, 60, 64]], [43, [55, 59, 62]]],
      lead: [69, 0, 72, 0, 76, 0, 74, 72, 0, 69, 0, 71, 72, 0, 0, 0, 69, 0, 72, 0, 77, 0, 76, 74, 0, 72, 0, 69, 72, 0, 0, 0,
        76, 0, 79, 0, 76, 0, 74, 72, 0, 74, 0, 76, 79, 0, 0, 0, 79, 0, 77, 0, 74, 0, 71, 0, 74, 0, 0, 71, 74, 0, 0, 0]
    },
    boss: { bpm: 150, prog: [[40, [52, 55, 59]], [40, [52, 55, 60]], [36, [48, 52, 55]], [38, [50, 54, 57]]] }
  };
  const music = (() => {
    let timer = 0, step = 0, at = 0, song = SONGS.run, rate = 1, out = null, noise = null;
    const voice = (f, t0, dur, type, vol) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      o.connect(g).connect(out); o.start(t0); o.stop(t0 + dur + .02);
    };
    const kick = t0 => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(150, t0); o.frequency.exponentialRampToValueAtTime(40, t0 + .12);
      g.gain.setValueAtTime(.2, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + .14);
      o.connect(g).connect(out); o.start(t0); o.stop(t0 + .16);
    };
    const hat = (t0, vol) => {
      if (!noise) {
        noise = ac.createBuffer(1, Math.round(ac.sampleRate * .05), ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noise; f.type = 'highpass'; f.frequency.value = 7000;
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + .04);
      s.connect(f).connect(g).connect(out); s.start(t0); s.stop(t0 + .05);
    };
    const tick = () => {
      try {
        const sp = 60 / (song.bpm * rate) / 4;
        if (at < ac.currentTime) at = ac.currentTime + .02;
        while (at < ac.currentTime + .12) {
          const s = step % 16, [rootNote, ch] = song.prog[Math.floor(step / 16) % song.prog.length];
          if (s % 4 === 0) kick(at);
          if (s % 4 === 2) hat(at, .06);
          if (song === SONGS.boss && s % 2) hat(at, .03);
          if (s % 2 === 0) voice(N(rootNote + (s % 4 === 2 ? 12 : 0)), at, sp * 1.8, 'triangle', .12);
          voice(N(ch[s % 3] + 12), at, sp * .9, 'square', .02);
          const m = song.lead && Math.floor(step / 64) % 2 ? song.lead[step % 64] : 0;
          if (m) voice(N(m), at, sp * 1.9, 'square', .035);
          at += sp; step++;
        }
      } catch {}
    };
    return {
      play(name) {
        song = SONGS[name];
        if (muted || timer || !audio()) return;
        if (!out) { out = ac.createGain(); out.gain.value = .45; out.connect(ac.destination); }
        step = 0; at = ac.currentTime + .05;
        tick(); timer = setInterval(tick, 25);
      },
      stop() { clearInterval(timer); timer = 0; },
      rate(r) { rate = r; }
    };
  })();
  const tune = () => boss && !boss.approved ? 'boss' : 'run';

  soundBtn.addEventListener('click', () => {
    muted = !muted;
    soundBtn.setAttribute('aria-pressed', String(!muted));
    try { localStorage.setItem('mm-runner-muted', muted ? '1' : '0'); } catch {}
    if (muted) music.stop(); else if (state === 'run') music.play(tune());
  });

  // ---------- size ----------
  let W = 800, k = 1, px = 90, U = 1, GU = 1;
  const resize = () => {
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const scale = r.height / LH;
    W = r.width / scale;
    k = Math.max(.7, Math.min(1, W / 800));
    px = Math.max(66, Math.min(150, W * .13));
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    U = dpr * scale;
    // свечение рисуем в пониженном разрешении: его всё равно размывают
    const gk = Math.min(.5, 900 / cv.width);
    gcv.width = Math.round(cv.width * gk);
    gcv.height = Math.round(cv.height * gk);
    GU = U * gk;
    fx?.resize(cv.width, cv.height, U, W, gcv.width, gcv.height);
    base.setTransform(U, 0, 0, U, 0, 0);
    draw();
  };

  // ---------- effects layer ----------
  // Phaser (~280 КБ в сжатом виде) и fx.js грузятся, только когда игрок навёл на Играть или нажал её
  let fx = null, fxLoad = null;
  const script = src => new Promise((ok, no) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = no; document.head.append(el); });
  const loadFx = () => {
    if (still || fxLoad) return;
    fxLoad = (window.Phaser ? Promise.resolve() : script('game/vendor/phaser-3.90.0.min.js'))
      .then(() => window.MM_FX || script('game/fx.js?v=1'))
      .then(() => window.MM_FX({ base: cv, glow: gcv, dark: C.dark }))
      .then(api => { fx = api; root.classList.add('has-fx'); resize(); })
      .catch(() => {});
  };
  // всплеск эффекта в точке экрана (логические координаты), если слой загружен
  const fxb = (kind, x, y, color) => fx?.burst(kind, x, y, color);

  // ---------- state ----------
  let state = 'start';
  let p, obs, items, parts, texts, trail, dist, nextX, stageIdx, hearts, coins, shield, inv, t, shake, flash, hitstop;
  let fv, decel, finT, lastKind, lastSpawn, boss, gate, mag, ultra, combo, comboT, bestCombo, dodged, smashed, thinks, vibe, vibes, vibeSeen, bubble, quipIn, lastQuip, best = 0;
  try { best = +localStorage.getItem('mm-runner-best') || 0; } catch {}
  const keys = { down: false };

  const reset = () => {
    p = { y: 0, vy: 0, jumps: 0, duck: false, phase: 0, blink: 0, blinkIn: 2, sq: 0, buf: 0, flip: TAU };
    obs = []; items = []; parts = []; texts = []; trail = [];
    dist = 0; nextX = 760; stageIdx = 0; hearts = 3; coins = 0; shield = false; inv = 0; t = 0; shake = 0; flash = 0; hitstop = 0;
    finT = 0; lastKind = 'paper'; lastSpawn = ''; boss = null; gate = 0; mag = 0; ultra = 0; combo = 0; comboT = 0; bestCombo = 0; dodged = 0; smashed = 0; thinks = 0; vibe = 0; vibes = 0; vibeSeen = false;
    bubble = null; quipIn = 2.5;
  };
  reset();

  const stageAt = x => { let i = 0; while (i < STAGES.length - 1 && x >= STARTS[i + 1]) i++; return i; };
  const speedAt = x => (330 + stageAt(x) * 55 + Math.min(1, x / TOTAL) * 45) * k;
  const progress = () => boss ? .9 + .1 * (1 - boss.hp) : Math.min(.9, dist / TOTAL * .9);

  // ---------- spawning ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const spawn = () => {
    const si = stageAt(nextX), st = STAGES[si];
    let kind = pick(st.pool);
    if (kind === lastSpawn) kind = pick(st.pool);
    lastSpawn = kind;
    const K = KINDS[kind];
    obs.push({ kind, x: nextX, w: K.w, h: K.h, air: K.air || 0, bob: K.bob, fly: (K.fly || 0) * k, seed: Math.random() * 6 });
    const gap = speedAt(nextX) * rand(.95, 1.75) + K.w;
    const r = Math.random(), x1 = nextX + K.w + gap * .45;
    // первая радуга – гарантированно в начале, чтобы её увидели
    if (!vibeSeen && nextX > 1600) { vibeSeen = true; items.push({ kind: 'vibe', x: x1, h: 70 }); }
    else if (r < .52) {
      const n = 3 + Math.floor(Math.random() * 3), x0 = nextX + K.w + gap * .22, high = Math.random() < .5;
      for (let i = 0; i < n; i++) items.push({ kind: 'coin', x: x0 + i * 26, h: high ? 46 + Math.sin(i / (n - 1) * Math.PI) * 70 : 24 });
    } else if (r < .59) items.push({ kind: 'shield', x: x1, h: 96 });
    else if (r < .64) items.push({ kind: 'magnet', x: x1, h: 100 });
    else if (r < .68 && si > 0) items.push({ kind: 'ultra', x: x1, h: 112 });
    else if (r < .73) items.push({ kind: 'vibe', x: x1, h: 100 });
    else if (r < .76 && hearts < 3) items.push({ kind: 'heart', x: x1, h: 104 });
    nextX += gap;
  };

  // ---------- particles, floating texts, quips ----------
  const burst = (x, h, n, colors, power = 1) => {
    if (still) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) parts.push({ x, h, vx: (Math.random() - .5) * 320 * power, vh: rand(80, 300) * power, life: rand(.5, 1.1), t: 0, c: colors[i % colors.length], s: rand(2, 5), r: Math.random() * 6 });
  };
  const say = (text, color, x = dist + 10, h = 96, size = 14) => texts.push({ x, h, text, color, t: 0, size });
  const quip = (kind, force) => {
    if (!force && bubble && bubble.t < bubble.dur * .8) return;
    let line = pick(QUIPS[kind]);
    if (line === lastQuip && QUIPS[kind].length > 1) line = pick(QUIPS[kind]);
    lastQuip = line;
    bubble = { text: line, t: 0, dur: kind === 'run' || kind === 'idle' ? 2.2 : 1.7, spin: line.endsWith('…') };
    quipIn = rand(4.5, 7.5);
  };

  // ---------- HUD ----------
  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C1 8.6 3 5 6.5 5c2 0 3.6 1.1 4.5 2.6C11.9 6.1 13.5 5 15.5 5 19 5 21 8.6 19.6 11.8 17.5 16.4 12 21 12 21Z"/></svg>';
  hud.innerHTML = `
    <div class="rn-hearts" role="img" aria-label="Доверие бизнеса">${HEART.repeat(3)}</div>
    <div class="rn-track"><span class="rn-stage"></span><div class="rn-bar"><i></i>${[...STARTS.slice(1), TOTAL].map(s => `<s style="left:${s / TOTAL * 90}%"></s>`).join('')}<b>PROD</b></div></div>
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
  const paintStage = () => { stageEl.textContent = boss ? `Финал · ${BOSS.name}` : `Этап ${stageIdx + 1} из ${STAGES.length} · ${STAGES[stageIdx].name}`; };

  let bannerTimer;
  const showBanner = () => {
    const [small, name, sub] = boss ? ['Финальный босс', BOSS.name, BOSS.sub] : [`Этап ${stageIdx + 1} из ${STAGES.length}`, STAGES[stageIdx].name, STAGES[stageIdx].sub];
    banner.innerHTML = `<small>${small}</small><strong>${name}</strong><span>${sub}</span>`;
    banner.classList.add('is-on');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => banner.classList.remove('is-on'), boss ? 2400 : 1900);
  };

  // ---------- screens ----------
  const KEYS = touch
    ? '<li>Тап по игре – прыжок, в воздухе ещё раз</li><li>Кнопка справа – пригнуться</li>'
    : '<li><kbd>Пробел</kbd> или <kbd>↑</kbd> – прыжок, в воздухе ещё раз</li><li><kbd>Shift</kbd> или <kbd>↓</kbd> – пригнуться</li>';
  const panel = (html, focus, cls = '') => {
    screen.innerHTML = `<div class="rn-panel ${cls}">${html}</div>`;
    screen.hidden = false;
    if (focus) screen.querySelector('[data-act]')?.focus({ preventScroll: true });
  };
  const intro = () => panel(`
    <p class="rn-kicker">Игра · около минуты</p>
    <h3>Это Clawd, ваш AI&#8209;пилот</h3>
    <p class="rn-term">Доведу пилот до production. Поможете?</p>
    <p class="rn-sub">4 этапа, в финале – инвесткомитет. По пути бонусы: Evals, MCP, ultrathink и радуга Vibe coding.</p>
    <ul class="rn-keys">${KEYS}</ul>
    <div class="rn-btns"><button type="button" class="btn btn-blue" data-act="play">Играть</button></div>
    ${best ? `<p class="rn-best">Ваш рекорд: ${best} млн ₽</p>` : ''}`, false, 'rn-intro');

  // ачивки на финальном экране
  const plural = (n, [one, few, many]) => n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;
  const OBST = ['препятствие', 'препятствия', 'препятствий'];
  const badges = won => {
    const list = [];
    if (won && hearts === 3) list.push('Без потерь доверия');
    if (bestCombo >= 8) list.push(`Комбо x${bestCombo}`);
    if (smashed >= 3) list.push(`Смял ${smashed} ${plural(smashed, OBST)}`);
    else if (thinks) list.push('Ultrathinker');
    if (vibes) list.push('Vibe coder');
    if (dodged >= 25) list.push(`Обошёл ${dodged} ${plural(dodged, OBST)}`);
    return list.length ? `<ul class="rn-badges">${list.map(b => `<li>${b}</li>`).join('')}</ul>` : '';
  };

  const over = () => {
    const [title, tip] = ENDS[lastKind];
    const where = boss ? 'на инвесткомитете' : `на этапе ${STAGES[stageIdx].name}`;
    panel(`
      <p class="rn-kicker">Проект закрыт ${where}</p>
      <h3 class="is-lost">${title}</h3>
      <p class="rn-term">You're absolutely right! Попробую иначе</p>
      <p>Пройдено ${Math.min(99, Math.round(progress() * 100))}% пути, собрано ${coins} млн ₽ эффекта${bestCombo >= 3 ? `, лучшее комбо x${bestCombo}` : ''}.</p>
      <p><strong>Совет Михаила:</strong> ${tip}</p>
      ${badges(false)}
      <div class="rn-btns"><button type="button" class="btn btn-blue" data-act="play">Ещё раз</button></div>`, true);
  };

  const win = () => {
    const rec = coins > best;
    if (rec) { best = coins; try { localStorage.setItem('mm-runner-best', String(best)); } catch {} }
    const rank = coins >= 95 && hearts === 3 ? 'Head of AI' : coins >= 75 ? 'AI Transformation Lead' : coins >= 45 ? 'Крепкий delivery' : 'Дошли до прода на характере';
    const msg = `Довёл Clawd до production в игре на вашем сайте: ${coins} млн ₽ эффекта, ранг ${rank}. Хочу обсудить реальный проект.`;
    panel(`
      <p class="rn-kicker">Пилот в production</p>
      <h3>${rank}</h3>
      <p class="rn-term">Deployed to production. Ship it!</p>
      <p>Эффект: <strong>${coins} млн ₽</strong>, доверие бизнеса: <strong>${hearts} из 3</strong>${bestCombo >= 3 ? `, комбо: <strong>x${bestCombo}</strong>` : ''}.${rec ? ' Это ваш рекорд.' : ` Рекорд: ${best} млн ₽.`}</p>
      <p class="rn-note">В реальном проекте препятствия те же, только кнопки "Ещё раз" нет.</p>
      ${badges(true)}
      <div class="rn-btns">
        <button type="button" class="btn btn-blue" data-act="play">Ещё раз</button>
        <a class="btn btn-line" href="${TG}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Обсудить ваш пилот</a>
      </div>`, true);
  };

  const pausePanel = () => panel(`
    <p class="rn-kicker">Пауза</p>
    <h3>Clawd ждёт</h3>
    <p class="rn-term">Interrupted by user</p>
    <p>${boss ? 'Финал, инвесткомитет' : `Этап ${stageIdx + 1} из ${STAGES.length}`}, собрано ${coins} млн ₽.</p>
    <div class="rn-btns"><button type="button" class="btn btn-blue" data-act="resume">Продолжить</button></div>`, true);

  // ---------- control ----------
  const setRunning = on => {
    root.classList.toggle('is-running', on);
    duckBtn.hidden = !(on && touch);
    if (!on) { keys.down = false; duckBtn.classList.remove('is-down'); }
  };

  const play = () => {
    loadFx();
    reset();
    state = 'run';
    screen.hidden = true;
    hud.hidden = false;
    paintHearts(); coinEl.firstElementChild.textContent = '0'; paintStage(); showBanner();
    setRunning(true);
    music.rate(1); music.stop(); music.play('run');
    quip('run', true);
    root.focus({ preventScroll: true });
    const r = root.getBoundingClientRect();
    if (r.top < 70 || r.bottom > innerHeight) root.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
    kick();
  };
  const pause = () => { if (state !== 'run') return; state = 'pause'; setRunning(false); music.stop(); pausePanel(); };
  const resume = () => { state = 'run'; screen.hidden = true; setRunning(true); music.play(tune()); root.focus({ preventScroll: true }); kick(); };

  const doJump = n => {
    p.vy = n === 1 ? JUMP : JUMP2; p.y = Math.max(p.y, .01); p.jumps = n; p.buf = 0;
    if (n === 1) SFX.jump();
    else { SFX.jump2(); p.flip = 0; burst(dist, p.y, 6, [C.line, CLAWD], .5); fxb('jump', px, GY - p.y); }
  };
  const jump = () => {
    if (state !== 'run') return;
    if (p.y <= 0 && p.vy <= 0) doJump(1);
    else if (p.jumps < 2) doJump(2);
    else p.buf = .14;
  };

  screen.addEventListener('pointerover', e => { if (e.target.closest('[data-act="play"]')) loadFx(); });
  screen.addEventListener('focusin', e => { if (e.target.closest('[data-act="play"]')) loadFx(); });
  screen.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    ({ play, resume })[b.dataset.act]?.();
  });

  const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'], DUCK_KEYS = ['ArrowDown', 'KeyS', 'ShiftLeft', 'ShiftRight'];
  addEventListener('keydown', e => {
    if (state !== 'run') return;
    if (JUMP_KEYS.includes(e.code)) { e.preventDefault(); if (!e.repeat) jump(); }
    else if (DUCK_KEYS.includes(e.code)) { e.preventDefault(); keys.down = true; }
    else if (e.code === 'Escape' || e.code === 'KeyP') pause();
  });
  addEventListener('keyup', e => {
    if (DUCK_KEYS.includes(e.code)) keys.down = false;
    // короткое нажатие – низкий прыжок, долгое – высокий
    else if (JUMP_KEYS.includes(e.code) && state === 'run' && p.vy > JUMP_CUT) p.vy = JUMP_CUT;
  });

  root.addEventListener('pointerdown', e => {
    if (state !== 'run' || e.target.closest('button, a')) return;
    e.preventDefault();
    jump();
  });
  const duck = on => e => { e.preventDefault(); keys.down = on; duckBtn.classList.toggle('is-down', on); };
  duckBtn.addEventListener('pointerdown', duck(true));
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => duckBtn.addEventListener(n, duck(false)));
  duckBtn.addEventListener('contextmenu', e => e.preventDefault());

  // ---------- boss ----------
  const bossScale = () => Math.max(.62, Math.min(1, W / 720));
  const bossX = () => {
    const e = Math.min(1, boss.t / 1.1);
    return W - 100 * bossScale() + (1 - e) ** 3 * 320 + boss.out ** 2 * 700;
  };
  const seatX = i => bossX() + (i - 1) * 52 * bossScale();

  const startBoss = () => {
    boss = { t: 0, hp: 1, v: speedAt(TOTAL - 1), throwIn: 1.6, argIn: 2.2, warn: 0, seat: 1, low: true, approved: 0, out: 0, said: null };
    paintStage(); showBanner(); SFX.boss(); quip('boss', true); fxb('boss');
    music.stop(); music.play('boss');
  };
  const throwShot = () => {
    const sx = seatX(boss.seat) - 30, T = rand(.85, 1.15) * (.8 + .2 * boss.hp);
    obs.push({ kind: 'question', x: dist + sx - px, w: 26, h: 26, air: boss.low ? 0 : 30, bob: 0, fly: Math.max(30, (sx - px) / T - boss.v), seed: Math.random() * 6, shot: true });
    boss.throwIn = rand(.9, 1.5) * (.7 + .3 * boss.hp);
    SFX.toss();
  };
  const approve = () => {
    boss.approved = .001;
    obs.forEach(o => { if (o.shot && !o.hit) { o.hit = true; o.kvx = 300; o.kvh = 500; o.kx = 0; o.kh = 0; o.kr = 0; } });
    items = items.filter(it => it.kind !== 'arg');
    burst(dist + seatX(1) - px, 120, 40, [GREEN, LIVE, '#fff', GOLD], 1.3);
    SFX.approve(); quip('approve', true); music.stop(); fxb('approve');
    shake = .2; flash = .15;
  };
  const beginFinish = () => {
    gate = dist + (W - px) + 60;
    state = 'finish'; setRunning(false);
    fv = boss.v; decel = fv * fv / (2 * (gate - 20 - dist)); finT = 0;
    banner.classList.remove('is-on');
  };
  const stepBoss = dt => {
    boss.t += dt;
    if (boss.said) boss.said.t += dt;
    if (!boss.approved) {
      // поле боя сжимается к экрану: скорость такая, чтобы до вопроса оставалась ~секунда реакции
      const target = Math.min(speedAt(TOTAL - 1), (seatX(0) - 60 - px) / 1.1);
      boss.v += (target - boss.v) * Math.min(1, dt * 2);
      boss.hp = Math.max(0, boss.hp - dt * .03);
      if (boss.warn > 0) { boss.warn -= dt; if (boss.warn <= 0) throwShot(); }
      else if ((boss.throwIn -= dt) <= 0 && boss.t > 1.2) {
        boss.warn = .55; boss.seat = Math.floor(Math.random() * 3); boss.low = Math.random() < .5;
        boss.said = { text: pick(BOSS.questions), seat: boss.seat, t: 0 };
        SFX.warn();
      }
      if ((boss.argIn -= dt) <= 0 && boss.t > 1.6) {
        items.push({ kind: 'arg', text: pick(BOSS.args), x: dist + seatX(0) - 70 - px, h: pick([30, 86, 130]), born: t });
        boss.argIn = rand(1.3, 2.1);
      }
      if (boss.hp <= 0) approve();
    } else {
      boss.approved += dt;
      boss.v += (speedAt(TOTAL - 1) - boss.v) * Math.min(1, dt * 1.5);
      if (boss.approved > 1.3) boss.out += dt;
      if (boss.approved > 1.5 && state === 'run') beginFinish();
    }
  };

  // ---------- update ----------
  const hitBy = o => {
    o.hit = true; o.kvx = 420; o.kvh = 460; o.kx = 0; o.kh = 0; o.kr = 0;
    const ox = o.x + o.w / 2, oh = o.air + o.h / 2;
    if (ultra > 0) {
      coins += 2; smashed++; paintCoins();
      burst(ox, oh, 18, FIRE, 1.2); say('+2 млн ₽', GREEN, ox, oh + 30, 13);
      SFX.smash(); shake = .12; fxb('smash', ox - dist + px, GY - oh, '#FFA552');
      return;
    }
    if (shield) {
      shield = false; inv = .8;
      burst(ox, oh, 16, [C.fig, '#fff', LIVE]);
      SFX.save(); quip('save', true); fxb('save', px, GY - p.y - 24, C.fig);
      return;
    }
    hearts--; inv = 1.5; shake = .35; hitstop = .07; lastKind = o.kind; combo = 0;
    burst(dist, 30, 14, [RED, CLAWD, '#fff']);
    say('−доверие', RED); SFX.hit(); quip('hit', true); fxb('hit', px + 12, GY - p.y - 22, '#FFFFFF');
    paintHearts(true);
    if (hearts <= 0) {
      state = 'over'; setRunning(false); music.stop(); SFX.lose();
      setTimeout(() => { if (state === 'over') over(); }, 900);
    }
  };

  const collect = it => {
    it.got = true;
    const ix = it.x - dist + px, iy = GY - it.h;
    if (it.kind === 'coin') {
      combo = comboT > 0 ? combo + 1 : 1; comboT = .9; bestCombo = Math.max(bestCombo, combo);
      coins += vibe > 0 ? 2 : 1; SFX.coin(combo); burst(it.x, it.h, 5, vibe > 0 ? RAINBOW : [GREEN, LIVE], .5); fxb('coin', ix, iy);
      if (combo >= 3) say(`x${combo}`, GREEN, it.x, it.h + 18, 12 + Math.min(combo, 10));
      if (combo % 10 === 0) { coins += 5; say('Комбо! +5 млн ₽', GREEN, dist + 10, 120, 15); }
      paintCoins();
    } else if (it.kind === 'shield') { shield = true; SFX.up(); say('Evals: щит от удара', C.fig); fxb('power', ix, iy, C.fig); }
    else if (it.kind === 'magnet') { mag = 7; SFX.mag(); say('MCP: подключил данные', MCP); fxb('power', ix, iy, MCP); }
    else if (it.kind === 'vibe') {
      vibe = 6; vibes++; SFX.vibe(); say('Vibe coding: ₽ x2', RAINBOW[5]); fxb('vibe', ix, iy);
      bubble = { text: 'Вайбкодим!', t: 0, dur: 1.6, spin: false };
    } else if (it.kind === 'ultra') { ultra = 5.5; thinks++; flash = .18; trail = []; SFX.ultra(); music.rate(1.15); say('ultrathink: неуязвимость', CLAWD); bubble = null; fxb('ultra', px, GY - p.y - 24); }
    else if (it.kind === 'arg') {
      boss.hp = Math.max(0, boss.hp - .14); coins += 2; paintCoins();
      burst(it.x, it.h, 12, [GREEN, LIVE, '#fff'], .8); say(`${it.text} ✓`, GREEN, it.x, it.h + 26, 13); SFX.arg(); fxb('arg', ix, iy);
    } else { hearts = Math.min(3, hearts + 1); paintHearts(); SFX.up(); say('+доверие: нашёлся спонсор', GREEN); fxb('power', ix, iy, RED); }
  };

  const stepParts = dt => {
    parts.forEach(q => { q.t += dt; q.vh -= 900 * dt; q.x += q.vx * dt; q.h = Math.max(0, q.h + q.vh * dt); q.r += dt * 8; });
    parts = parts.filter(q => q.t < q.life);
    texts.forEach(q => { q.t += dt; q.h += 40 * dt; });
    texts = texts.filter(q => q.t < 1.1);
    if (bubble && (bubble.t += dt) > bubble.dur) bubble = null;
  };
  const blinkTick = dt => {
    p.blinkIn -= dt;
    if (p.blinkIn < 0) { p.blink = .12; p.blinkIn = rand(2, 4.5); }
    if (p.blink > 0) p.blink -= dt;
  };
  const kickAway = (o, dt) => { o.kx += o.kvx * dt; o.kh += o.kvh * dt; o.kvh -= 1500 * dt; o.kr += 7 * dt; };

  const update = dt => {
    if (hitstop > 0) { hitstop -= dt; return; }
    t += dt;
    let v;
    if (state === 'finish') { fv = Math.max(0, fv - decel * dt); v = fv; }
    else v = (boss ? boss.v : speedAt(dist)) * (ultra > 0 ? 1.12 : 1);
    dist += v * dt;

    if (!boss) {
      const s = stageAt(dist);
      if (s !== stageIdx && state === 'run') {
        stageIdx = s; paintStage(); showBanner(); SFX.stage(); quip('stage', true); fxb('stage');
        burst(dist + 60, 140, 24, [C.fig, LIVE, GOLD, CLAWD], 1);
      }
    }

    // игрок
    const wasAir = p.y > 0;
    p.duck = state === 'run' && keys.down;
    if (p.y > 0 || p.vy > 0) {
      p.vy -= GRAV * (p.duck ? 2.4 : 1) * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; p.jumps = 0; p.sq = .14; if (wasAir) burst(dist, 2, 6, [C.line], .35); }
    }
    if (p.buf > 0) { p.buf -= dt; if (p.y <= 0 && p.vy <= 0 && state === 'run') doJump(1); }
    if (p.flip < TAU) p.flip = Math.min(TAU, p.flip + dt * 17);
    if (p.sq > 0) p.sq -= dt;
    p.phase += dt * v / 18;
    if (inv > 0) inv -= dt;
    if (shake > 0) shake -= dt;
    if (flash > 0) flash -= dt;
    if (mag > 0) mag -= dt;
    if (comboT > 0 && (comboT -= dt) <= 0) combo = 0;
    if (ultra > 0 || vibe > 0) {
      trail.push({ d: dist, y: p.y, duck: p.duck });
      if (trail.length > 110) trail.shift();
      if (!still && Math.random() < dt * 24) parts.push({ x: dist - 24, h: p.y + rand(6, 36), vx: rand(-260, -120), vh: rand(-40, 140), life: rand(.35, .6), t: 0, c: pick(ultra > 0 ? FIRE : RAINBOW), s: rand(3, 6), r: 0, spark: true });
    }
    if (ultra > 0 && (ultra -= dt) <= 0) { ultra = 0; music.rate(1); }
    if (vibe > 0 && (vibe -= dt) <= 0) vibe = 0;
    if (!ultra && !vibe) trail = [];
    blinkTick(dt);

    if (state === 'run') {
      if (!boss) {
        while (nextX - dist + px < W + 120 && nextX < TOTAL - 300) spawn();
        if (dist >= TOTAL) startBoss();
      }
      if (!ultra && (quipIn -= dt) <= 0) quip(boss ? 'boss' : 'run');
    }
    if (boss) stepBoss(dt);
    if (state === 'finish' && fv <= 0) {
      if (!finT) { SFX.win(); quip('win', true); burst(gate, 150, 50, [C.fig, LIVE, RED, GOLD, GREEN, CLAWD], 1.4); fxb('win'); }
      finT += dt;
      if (finT > 1.3) { state = 'win'; win(); }
    }

    // препятствия
    const ph = p.duck ? (p.y < 4 ? 18 : 22) : 42;
    const pl = px - 18, pr = px + 18, pb = p.y, pt = p.y + ph;
    for (const o of obs) {
      if (o.fly) o.x -= o.fly * dt;
      if (o.hit) { kickAway(o, dt); continue; }
      const sx = o.x - dist + px;
      if (!o.passed && sx + o.w < pl - 4) {
        o.passed = true;
        if (state === 'run') { dodged++; if (o.close) say(pick(['Впритык!', 'Чисто!', 'Изи']), C.fig, dist + 10, 76, 12); }
      }
      if (state !== 'run' || (inv > 0 && ultra <= 0)) continue;
      if (sx > pr + 4 || sx + o.w < pl - 4) continue;
      const b = o.air + (o.bob ? Math.sin(t * 4 + o.seed) * 4 : 0);
      const across = pr - 5 > sx && pl + 5 < sx + o.w;
      if (across && pt - 4 > b && pb + 3 < b + o.h) hitBy(o);
      else if (across && Math.min(pb > b + o.h ? pb - b - o.h : 99, pt < b ? b - pt : 99) < 14) o.close = true;
    }
    obs = obs.filter(o => o.x - dist + px + (o.kx || 0) > -160 && (o.kh || 0) > -400);

    // бонусы
    const cy = p.y + ph / 2;
    for (const it of items) {
      if (it.got || state !== 'run') continue;
      let dx = it.x - dist;
      if (mag > 0 && it.kind === 'coin' && dx < 300 && dx > -40) {
        const f = Math.min(1, dt * 7);
        it.x -= dx * f; it.h += (cy - it.h) * f; dx = it.x - dist;
      }
      const dy = it.h - cy;
      if (it.kind === 'arg' ? Math.abs(dx) < 42 && Math.abs(dy) < 32 : dx * dx + dy * dy < 34 * 34) collect(it);
    }
    items = items.filter(it => !it.got && it.x - dist + px > -60);

    stepParts(dt);
    barEl.style.setProperty('--p', progress());
  };

  const idle = dt => {
    t += dt;
    obs.forEach(o => { if (o.hit) kickAway(o, dt); });
    if (state === 'start') {
      dist += 28 * dt;
      if ((quipIn -= dt) <= 0) quip('idle');
    }
    if (state === 'win') {
      p.y = Math.abs(Math.sin(t * 5)) * 26;
      if (!still && Math.random() < dt * 2.5) burst(gate + rand(-60, 60), rand(120, 180), 12, [C.fig, LIVE, RED, GOLD, GREEN, CLAWD], .9);
      if (Math.random() < dt * .8) fxb('firework', rand(.08, .92) * W, rand(40, 150));
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
  const poly = (...pts) => { ctx.beginPath(); for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); };
  const dot = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
  const text = (s, x, y, font, color, align = 'center') => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); };
  const FONT = (w, s) => `${w} ${s}px Onest, system-ui, sans-serif`;
  const DISPLAY = s => `700 ${s}px Unbounded, system-ui, sans-serif`;
  const MONO = s => `600 ${s}px ui-monospace, Menlo, Consolas, monospace`;
  const pill = (s, cx, bottom, bg = C.ink, fg = C.card, size = 11) => {
    ctx.font = FONT(600, size);
    const w = ctx.measureText(s).width + 14, h = size + 8;
    ctx.fillStyle = bg; rr(cx - w / 2, bottom - h, w, h, h / 2); ctx.fill();
    poly(cx - 4, bottom, cx + 4, bottom, cx, bottom + 4); ctx.fill();
    text(s, cx, bottom - h / 2 + .5, FONT(600, size), fg);
  };
  // раскалённый текст: золотой градиент с бегущим бликом
  const hotText = (s, cx, cy, font) => {
    ctx.font = font;
    const w = ctx.measureText(s).width, q = (t * .8) % 1;
    const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    g.addColorStop(0, FIRE[3]);
    g.addColorStop(Math.max(0, q - .15), FIRE[2]);
    g.addColorStop(q, FIRE[0]);
    g.addColorStop(Math.min(1, q + .15), FIRE[2]);
    g.addColorStop(1, FIRE[3]);
    text(s, cx, cy, font, g);
  };
  // звёздочка Claude: лучи разной длины вокруг центра
  const spark = (x, y, r, rot, color) => {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.4, r * .28);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU, l = r * (i % 2 ? .72 : 1);
      line(Math.cos(a) * r * .18, Math.sin(a) * r * .18, Math.cos(a) * l, Math.sin(a) * l);
    }
    ctx.restore();
  };

  const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const CITY = (() => {
    const r = rng(11), list = [];
    let x = 0;
    while (x < 1900) { const w = 40 + r() * 70, h = 50 + r() * 120; list.push({ x, w, h, s: r() }); x += w + 6 + r() * 34; }
    return { list, period: x };
  })();
  const CLOUDS = (() => {
    const r = rng(5), list = [];
    for (let i = 0; i < 6; i++) list.push({ x: i * 300 + r() * 120, y: 78 + r() * 56, s: .7 + r() * .6 });
    return { list, period: 1800 };
  })();
  const STARS = (() => {
    const r = rng(23), list = [];
    for (let i = 0; i < 70; i++) list.push({ f: r(), y: 8 + r() * 150, s: r() < .2 ? 2 : 1.2, a: .4 + r() * .6, p: r() * 6 });
    return list;
  })();

  const tile = (period, par, fn) => {
    const off = (dist * par) % period;
    for (let k2 = -1; k2 * period - off < W + period; k2++) fn(k2 * period - off, k2 + Math.floor(dist * par / period));
  };

  // небо и ночь плавно меняются от этапа к этапу, на боссе краснеют
  const mix = (a, b, q) => a.map((x, i) => Math.round(x + (b[i] - x) * q));
  const skyNow = () => {
    const i = stageAt(dist), q = i ? Math.min(1, (dist - STARTS[i]) / 700) : 1;
    let c = i ? mix(STAGES[i - 1].sky, STAGES[i].sky, q) : STAGES[0].sky;
    if (boss) c = mix(c, BOSS.sky, Math.min(1, boss.t / 1.5) * (boss.approved ? Math.max(0, 1 - boss.approved) : 1));
    return c;
  };
  const nightNow = () => {
    const i = stageAt(dist), q = i ? Math.min(1, (dist - STARTS[i]) / 700) : 1;
    return i ? NIGHT[i - 1] + (NIGHT[i] - NIGHT[i - 1]) * q : NIGHT[0];
  };

  // в проходе свечения (G) рисуем только то, что светится: неон, экраны, диоды
  const prop = (look, x, label, i) => {
    if (look === 'office') {
      if (G) return;
      ctx.strokeStyle = C.line; ctx.lineWidth = 4; line(x, GY, x, GY - 92);
      ctx.fillStyle = C.card; ctx.strokeStyle = C.line; ctx.lineWidth = 2;
      rr(x - 58, GY - 134, 116, 44, 10); ctx.fill(); ctx.stroke();
      text(label, x, GY - 112, FONT(600, 13), C.muted);
      ctx.save(); ctx.translate(x + 50, GY - 134); ctx.rotate(.18);
      ctx.fillStyle = i % 2 ? GOLD : '#FF9DB5'; ctx.fillRect(-8, -8, 16, 16);
      ctx.restore();
    } else if (look === 'servers') {
      ctx.fillStyle = C.chip; ctx.strokeStyle = C.line; ctx.lineWidth = 2;
      if (!G) { rr(x - 30, GY - 124, 60, 124, 6); ctx.fill(); ctx.stroke(); }
      for (let r = 0; r < 7; r++) {
        const y = GY - 114 + r * 16;
        if (!G) { ctx.fillStyle = C.card; rr(x - 22, y, 44, 11, 2); ctx.fill(); }
        for (let l = 0; l < 3; l++) { ctx.fillStyle = Math.floor(t * 4 + r * 3 + l * 5 + i) % 4 ? LIVE : C.fig; dot(x - 15 + l * 6, y + 5.5, 1.8); }
        if (!G) { ctx.fillStyle = C.line; ctx.fillRect(x + 2, y + 4, 14, 3); }
      }
      if (!G) pill(label, x, GY - 130, C.fig, '#fff');
    } else if (look === 'lab') {
      if (!G) {
        ctx.fillStyle = C.line; ctx.fillRect(x - 3, GY - 70, 6, 70); rr(x - 22, GY - 8, 44, 8, 3); ctx.fill();
        ctx.fillStyle = SCREEN; ctx.strokeStyle = C.line; ctx.lineWidth = 3;
        rr(x - 58, GY - 142, 116, 74, 8); ctx.fill(); ctx.stroke();
      }
      ctx.strokeStyle = LIVE; ctx.lineWidth = 2; ctx.beginPath();
      for (let j = 0; j <= 8; j++) ctx.lineTo(x - 46 + j * 11.5, GY - 82 - j * 4 - Math.sin(j * 1.7 + i) * 6);
      ctx.stroke();
      text(label, x - 48, GY - 128, MONO(11), LIVE, 'left');
    } else {
      const neon = i % 2 ? '#FF7AC6' : '#6DC8FF';
      ctx.strokeStyle = C.line; ctx.lineWidth = 4; if (!G) line(x, GY, x, GY - 98);
      ctx.font = DISPLAY(12);
      const w = ctx.measureText(label).width + 28;
      ctx.fillStyle = SCREEN; rr(x - w / 2, GY - 140, w, 42, 10); if (!G) ctx.fill();
      ctx.strokeStyle = neon; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save();
      if (!still && !fx) { ctx.shadowColor = neon; ctx.shadowBlur = 12; }
      ctx.globalAlpha = Math.sin(t * 13 + i * 3) > .96 ? .4 : 1;
      text(label, x, GY - 119, DISPLAY(12), neon);
      ctx.restore();
    }
  };

  const scene = () => {
    const [sr, sg, sb] = skyNow(), night = nightNow();
    if (!G) {
    ctx.fillStyle = C.card; ctx.fillRect(0, 0, W, LH);
    let g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, `rgba(${sr},${sg},${sb},${C.dark ? .2 : .14})`);
    g.addColorStop(1, `rgba(${sr},${sg},${sb},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, GY);
    g = ctx.createLinearGradient(0, GY - 160, 0, GY);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, C.paper);
    ctx.fillStyle = g; ctx.fillRect(0, GY - 160, W, 160);
    }

    // звёзды к ночи
    if (C.dark && night > 0) {
      ctx.fillStyle = '#fff';
      STARS.forEach(s => {
        ctx.globalAlpha = night * s.a * (.6 + .4 * Math.sin(t * 2 + s.p));
        ctx.fillRect(((s.f * W - dist * .02) % W + W) % W, s.y, s.s, s.s);
      });
      ctx.globalAlpha = 1;
    }
    // солнце садится, пока идёт проект; к масштабу выходит луна
    const pr = Math.min(1, dist / TOTAL), sunY = 100 + pr * 200;
    if (sunY < GY) {
      ctx.fillStyle = '#FFB36B';
      ctx.globalAlpha = C.dark ? .18 : .3; dot(W * .78, sunY, 40);
      ctx.globalAlpha = C.dark ? .35 : .55; dot(W * .78, sunY, 26);
    }
    if (pr > .55) {
      const q = Math.min(1, (pr - .55) / .3);
      ctx.fillStyle = C.dark ? '#E8E6FF' : C.muted;
      ctx.globalAlpha = (C.dark ? .55 : .22) * q; dot(W * .6, GY - 40 - q * 120, 17);
      ctx.fillStyle = C.dark ? '#C9C6F0' : C.line; ctx.globalAlpha *= .6;
      dot(W * .6 - 5, GY - 44 - q * 120, 3.5); dot(W * .6 + 6, GY - 36 - q * 120, 2.5);
    }
    ctx.globalAlpha = 1;

    // облака
    ctx.fillStyle = C.paper; ctx.globalAlpha = C.dark ? .75 : 1;
    if (!G) tile(CLOUDS.period, .08, ox => CLOUDS.list.forEach(c => {
      const x = ox + c.x;
      if (x < -120 || x > W + 120) return;
      // одним контуром, чтобы полупрозрачное облако не темнело на стыках
      ctx.beginPath();
      [[0, 0, 16], [20, -8, 20], [44, 0, 15]].forEach(([dx, dy, r]) => { ctx.moveTo(x + (dx + r) * c.s, c.y + dy * c.s); ctx.arc(x + dx * c.s, c.y + dy * c.s, r * c.s, 0, TAU); });
      ctx.rect(x, c.y, 44 * c.s, 15 * c.s);
      ctx.fill();
    }));
    ctx.globalAlpha = 1;

    // город на горизонте: башни крупного бизнеса, ночью в окнах свет
    ctx.save();
    ctx.globalAlpha = .09; ctx.fillStyle = C.fig;
    if (!G) tile(CITY.period, .15, ox => CITY.list.forEach(b => {
      const x = ox + b.x;
      if (x + b.w < 0 || x > W) return;
      ctx.fillRect(x, GY - b.h, b.w, b.h);
    }));
    tile(CITY.period, .15, ox => CITY.list.forEach((b, bi) => {
      const x = ox + b.x;
      if (x + b.w < 0 || x > W) return;
      let n = 0;
      for (let wy = GY - b.h + 10; wy < GY - 14; wy += 16) for (let wx = x + 8; wx < x + b.w - 10; wx += 14) {
        const lit = night > .3 && (bi * 7 + n++ * 13) % 5 === 0;
        if (G && !lit) continue;
        ctx.fillStyle = lit ? GOLD : C.fig;
        ctx.globalAlpha = lit ? .45 * night : .12;
        ctx.fillRect(wx, wy, 6, 7);
      }
    }));
    ctx.restore();

    // средний план: билборды, серверные стойки, мониторы с метриками, неон – по этапу
    tile(560, .45, (ox, i) => {
      const x = ox + 380;
      if (x < -90 || x > W + 90) return;
      const d = (i * 560 + 380 - px) / .45;
      const look = d >= TOTAL ? 'city' : STAGES[stageAt(d)].look, list = PROPS[look];
      prop(look, x, list[((i % list.length) + list.length) % list.length], i);
    });

    // земля
    if (!G) {
      ctx.fillStyle = C.paper; ctx.fillRect(0, GY, W, LH - GY);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2; line(0, GY + 1, W, GY + 1);
      ctx.strokeStyle = C.line; ctx.lineWidth = 2;
      for (let x = -(dist % 36); x < W; x += 36) line(x, GY + 16, x + 12, GY + 16);
      for (let x = -((dist + 18) % 54); x < W; x += 54) line(x, GY + 34, x + 20, GY + 34);
    }

    // вехи этапов и финала
    if (!G) [...STARTS.slice(1), TOTAL].forEach((s0, i) => {
      const x = s0 - dist + px;
      if (x < -100 || x > W + 100) return;
      const name = STAGES[i + 1]?.name || 'Комитет';
      ctx.font = FONT(700, 11);
      const w = ctx.measureText(name).width + 20;
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3; line(x, GY, x, GY - 74);
      ctx.fillStyle = STAGES[i + 1] ? C.fig : RED; rr(x, GY - 74, w, 24, 5); ctx.fill();
      text(name, x + w / 2, GY - 62, FONT(700, 11), '#fff');
    });

    // финиш: production
    const gx = gate - dist + px;
    if (gate && gx > -140 && gx < W + 140) {
      ctx.fillStyle = C.ink;
      if (!G) { rr(gx - 64, GY - 128, 34, 128, 5); ctx.fill(); rr(gx + 30, GY - 128, 34, 128, 5); ctx.fill(); }
      for (let r = 0; r < 7; r++) for (const side of [-56, 38]) {
        ctx.fillStyle = (Math.floor(t * 6) + r + side) % 3 ? LIVE : '#2b2f5a';
        dot(gx + side, GY - 116 + r * 16, 2.5);
        if (!G) { ctx.fillStyle = '#2b2f5a'; ctx.fillRect(gx + side + 6, GY - 118 + r * 16, 12, 4); }
      }
      ctx.fillStyle = C.blue; rr(gx - 76, GY - 166, 152, 32, 9); ctx.fill();
      text('PRODUCTION', gx, GY - 150, DISPLAY(13), '#fff');
      if (state === 'win' || finT) pill('deploy ✓', gx, GY - 172, GREEN, '#fff');
    }
  };

  const drawObs = o => {
    if (G && o.kind !== 'ghost' && o.kind !== 'question') return;
    const b = o.air + (o.bob ? Math.sin(t * 4 + o.seed) * 4 : 0);
    const sx = o.x - dist + px;
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
        text('C:\\>' + (Math.floor(t * 3) % 2 ? '_' : ''), x + 10, top + 14, MONO(9), '#4ADE80', 'left');
        break;
      case 'meeting':
        ctx.fillStyle = C.muted;
        [[14, 0], [w / 2, -4], [w - 14, 0]].forEach(([dx, dy]) => { dot(x + dx, top + 10 + dy, 9); rr(x + dx - 11, top + 16 + dy, 22, 16, 6); ctx.fill(); });
        ctx.fillStyle = RED; [[14, 0], [w / 2, -4], [w - 14, 0]].forEach(([dx, dy]) => { poly(x + dx - 2, top + 18 + dy, x + dx + 2, top + 18 + dy, x + dx, top + 26 + dy); ctx.fill(); });
        ctx.fillStyle = C.ink; rr(x - 4, base - 26, w + 8, 26, 4); ctx.fill();
        text('zoom', x + w / 2, base - 13, MONO(10), C.card);
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
        ctx.beginPath(); ctx.ellipse(x + w / 2, top + 26, 3, 4, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'feature':
        ctx.fillStyle = '#fff'; ctx.strokeStyle = C.fig;
        poly(x, top + h / 2, x + w, top, x + w * .7, base); ctx.closePath(); ctx.fill(); ctx.stroke();
        line(x, top + h / 2, x + w * .62, top + h * .62);
        text('+1', x + w * .62, top + h * .4, FONT(800, 10), C.fig);
        break;
      case 'deadline': {
        const cx = x + w / 2, cy = top + h / 2 + 2, r = w / 2 - 2;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(still ? 0 : Math.sin(t * 40) * .08);
        ctx.fillStyle = RED; dot(-r * .72, -r * .82, 6); dot(r * .72, -r * .82, 6);
        ctx.fillStyle = '#fff'; ctx.strokeStyle = RED; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = SCREEN; ctx.lineWidth = 2;
        line(0, 0, Math.cos(t * 6) * r * .7, Math.sin(t * 6) * r * .7); line(0, 0, 0, -r * .5);
        ctx.restore();
        break;
      }
      case 'question': {
        const cx = x + w / 2, cy = top + h / 2;
        if (o.air) { ctx.strokeStyle = RED; ctx.globalAlpha *= .45; line(x + w + 4, cy - 5, x + w + 18, cy - 5); line(x + w + 8, cy + 5, x + w + 24, cy + 5); ctx.globalAlpha = o.hit ? .85 : 1; }
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.air ? 0 : (o.x - dist) / 13);
        ctx.fillStyle = RED; dot(0, 0, 13);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.stroke();
        text('?', 0, 1, FONT(800, 16), '#fff');
        ctx.restore();
        break;
      }
    }
    if (!o.hit && !o.shot && !G) pill(KINDS[o.kind].label, x + w / 2, top - 7);
    ctx.restore();
  };

  const drawItem = it => {
    const x = it.x - dist + px, y = GY - it.h + Math.sin(t * 4 + it.x) * 3;
    if (x < -60 || x > W + 60) return;
    if (it.kind === 'coin') {
      const sc = Math.abs(Math.cos(t * 4 + it.x / 50));
      ctx.fillStyle = GREEN;
      ctx.beginPath(); ctx.ellipse(x, y, 11 * sc + 1.5, 11, 0, 0, TAU); ctx.fill();
      if (sc > .45) text('₽', x, y + .5, FONT(800, 13), '#fff');
    } else if (it.kind === 'shield') {
      ctx.fillStyle = C.fig;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; poly(x - 5, y, x - 1, y + 4, x + 6, y - 4); ctx.stroke();
      pill('Evals', x, y - 18, C.fig, '#fff');
    } else if (it.kind === 'magnet') {
      ctx.lineCap = 'butt'; ctx.lineWidth = 7;
      ctx.strokeStyle = MCP; ctx.beginPath(); ctx.arc(x, y - 2, 9, Math.PI, 0, true); ctx.stroke();
      ctx.strokeStyle = MCP; line(x - 9, y - 3, x - 9, y - 10); line(x + 9, y - 3, x + 9, y - 10);
      ctx.strokeStyle = '#fff'; line(x - 9, y - 10, x - 9, y - 14); line(x + 9, y - 10, x + 9, y - 14);
      pill('MCP', x, y - 20, MCP, '#fff');
    } else if (it.kind === 'vibe') {
      ctx.lineWidth = 3; ctx.lineCap = 'butt';
      RAINBOW.forEach((c, j) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(x, y + 7, 17 - j * 3, Math.PI, 0); ctx.stroke(); });
      ctx.fillStyle = '#fff';
      [[-16, 5], [-10, 4], [16, 5], [10, 4]].forEach(([dx, r]) => dot(x + dx, y + 8, r));
      pill('Vibe coding', x, y - 15, TERM, '#fff');
    } else if (it.kind === 'ultra') {
      ctx.save();
      if (!still && !fx) { ctx.shadowColor = CLAWD; ctx.shadowBlur = 14; }
      spark(x, y, 15, t * 2, CLAWD);
      ctx.restore();
      ctx.font = FONT(700, 11);
      const w = ctx.measureText('ultrathink').width + 14;
      ctx.fillStyle = TERM; rr(x - w / 2, y - 40, w, 19, 9.5); ctx.fill();
      hotText('ultrathink', x, y - 30, FONT(700, 11));
    } else if (it.kind === 'arg') {
      const sc = Math.min(1, (t - it.born) / .25);
      ctx.font = FONT(700, 11);
      const w = ctx.measureText(it.text).width + 32;
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.fillStyle = GREEN; rr(-w / 2, -12, w, 24, 12); ctx.fill();
      ctx.fillStyle = '#fff'; dot(-w / 2 + 13, 0, 7);
      ctx.strokeStyle = GREEN; ctx.lineWidth = 2; poly(-w / 2 + 10, 0, -w / 2 + 12.5, 2.5, -w / 2 + 16.5, -2.5); ctx.stroke();
      text(it.text, -w / 2 + 25, .5, FONT(700, 11), '#fff', 'left');
      ctx.restore();
    } else {
      ctx.fillStyle = RED;
      ctx.save(); ctx.translate(x - 12, y - 12);
      ctx.fill(new Path2D('M12 21s-7.5-4.6-9.6-9.2C1 8.6 3 5 6.5 5c2 0 3.6 1.1 4.5 2.6C11.9 6.1 13.5 5 15.5 5 19 5 21 8.6 19.6 11.8 17.5 16.4 12 21 12 21Z'));
      ctx.restore();
      pill('Спонсор', x, y - 16, RED, '#fff');
    }
  };

  // босс: трибуна инвесткомитета, трое за столом, шкала скепсиса и штамп "Одобрено"
  const SKIN = ['#F2C9A0', '#E0AC82', '#F5D2B0'], SUIT = ['#3B3F63', '#23263F', '#4A4F78'], HAIR = ['#2A2320', '#5A3B2A', '#C9CCD8'];
  const drawBoss = () => {
    if (!boss) return;
    const s = bossScale(), bx = bossX();
    if (bx - 100 * s > W) return;
    const mad = !boss.approved;
    ctx.save();
    ctx.translate(bx, GY); ctx.scale(s, s);
    if (!G) {
    ctx.fillStyle = `rgba(229,72,77,${mad ? .08 : .03})`;
    poly(-30, -300, 30, -300, 130, 0, -130, 0); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const mx = (i - 1) * 52, up = mad && boss.warn > 0 && boss.seat === i ? 10 : 0;
      const by = -48 - up - (i === 1 ? 6 : 0) + Math.sin(t * 2.5 + i * 2) * 1.5;
      ctx.fillStyle = SUIT[i]; rr(mx - 20, by - 34, 40, 40, 12); ctx.fill();
      ctx.fillStyle = '#fff'; poly(mx - 7, by - 34, mx + 7, by - 34, mx, by - 22); ctx.fill();
      ctx.fillStyle = RED; poly(mx - 3, by - 30, mx + 3, by - 30, mx + 2, by - 14, mx, by - 11, mx - 2, by - 14); ctx.fill();
      ctx.fillStyle = SKIN[i]; dot(mx, by - 46, 13);
      ctx.fillStyle = HAIR[i]; ctx.beginPath(); ctx.arc(mx, by - 49, 13.5, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      ctx.fillStyle = EYE; dot(mx - 4.5, by - 45, 1.8); dot(mx + 4.5, by - 45, 1.8);
      ctx.strokeStyle = EYE; ctx.lineWidth = 2; ctx.lineCap = 'round';
      if (mad) { line(mx - 8, by - 52, mx - 2, by - 49); line(mx + 8, by - 52, mx + 2, by - 49); line(mx - 4, by - 38, mx + 4, by - 38); }
      else { line(mx - 8, by - 50, mx - 2, by - 52); line(mx + 8, by - 50, mx + 2, by - 52); ctx.beginPath(); ctx.arc(mx, by - 41, 4, .2, Math.PI - .2); ctx.stroke(); }
      if (i === 0) { ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(mx - 4.5, by - 45, 3.6, 0, TAU); ctx.moveTo(mx + 8.1, by - 45); ctx.arc(mx + 4.5, by - 45, 3.6, 0, TAU); ctx.stroke(); }
    }
    ctx.fillStyle = '#191C4A'; rr(-90, -50, 180, 50, 8); ctx.fill();
    ctx.fillStyle = '#2E3270'; rr(-90, -50, 180, 7, 4); ctx.fill();
    ctx.fillStyle = GOLD; rr(-62, -36, 124, 20, 6); ctx.fill();
    text('ИНВЕСТКОМИТЕТ', 0, -25.5, FONT(800, 10), SCREEN);
    }
    if (!mad && boss.approved < 2.5) {
      ctx.save(); ctx.translate(0, -112); ctx.rotate(-.16);
      const pop = 1 + Math.max(0, .25 - boss.approved) * 4;
      ctx.scale(pop, pop);
      ctx.strokeStyle = GREEN; ctx.lineWidth = 4; rr(-82, -20, 164, 40, 6); ctx.stroke();
      text('ОДОБРЕНО', 0, 1, DISPLAY(20), GREEN);
      ctx.restore();
    }
    ctx.restore();
    if (!mad || G) return;
    // шкала и вопросы – без масштаба, чтобы текст не мельчал на телефоне
    const head = GY - 128 * s, cx = Math.min(bx, W - 76);
    text('Скепсис комитета', cx, head - 62, FONT(700, 11), C.ink);
    ctx.fillStyle = C.chip; rr(cx - 70, head - 54, 140, 10, 5); ctx.fill();
    ctx.fillStyle = RED; rr(cx - 70, head - 54, Math.max(10, 140 * boss.hp), 10, 5); ctx.fill();
    const q = boss.said;
    if (q && q.t < 1.5) {
      ctx.font = FONT(700, 12);
      const w = ctx.measureText(q.text).width + 20, hx = seatX(q.seat);
      const bx2 = Math.max(6, Math.min(W - w - 6, hx - w / 2)), by2 = head - 32;
      ctx.globalAlpha = Math.min(1, q.t / .1, (1.5 - q.t) / .25);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = RED; ctx.lineWidth = 2;
      rr(bx2, by2, w, 24, 12); ctx.fill(); ctx.stroke();
      poly(hx - 5, by2 + 23, hx + 5, by2 + 23, hx, by2 + 30); ctx.fill();
      text(q.text, bx2 + w / 2, by2 + 12.5, FONT(700, 12), RED);
      ctx.globalAlpha = 1;
    }
  };

  // Clawd по пиксельной сетке 16×10 из логотипа Claude Code: тело 12×8, ручки по бокам, четыре ножки, два глаза-столбика
  const PX = 4.4, COLS = 16, ROWS = 10;
  const clawd = (x, y, o) => {
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) { ctx.translate(0, -ROWS * PX / 2); ctx.rotate(o.rot); ctx.translate(0, ROWS * PX / 2); }
    ctx.scale(o.sx || 1, o.sy || 1);
    const x0 = -COLS * PX / 2, top = -ROWS * PX, b = o.bob || 0;
    const R = (c, r, w = 1, h = 1) => ctx.fillRect(x0 + c * PX, top + r * PX + b, w * PX + .4, h * PX + .4);
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = 16; }
    ctx.fillStyle = o.tint || CLAWD;
    [3, 5, 10, 12].forEach((c, i) => {
      const lift = o.air ? .7 : o.step != null && i % 2 === o.step ? .9 : 0;
      ctx.fillRect(x0 + c * PX, top + 8 * PX + b, PX + .4, 2 * PX - b - lift * PX + .4);
    });
    R(2, 0, 12, 8);
    if (o.arms === 'up') { R(0, 2, 2, 2); R(14, 2, 2, 2); R(0, 1); R(15, 1); }
    else if (o.arms === 'wave') { R(0, 4, 2, 2); const up = Math.sin(t * 9) > 0; R(14, up ? 2 : 3, 2, 2); R(15, up ? 1 : 2); }
    else { const a = o.swing || 0; R(0, 4 + a, 2, 2); R(14, 4 - a, 2, 2); }
    ctx.shadowBlur = 0;
    if (o.tint) { ctx.restore(); return; }
    ctx.fillStyle = 'rgba(255,255,255,.16)'; R(2, 0, 12, .5);
    ctx.fillStyle = 'rgba(0,0,0,.13)'; R(2, 7.5, 12, .5);
    ctx.fillStyle = EYE; ctx.strokeStyle = EYE; ctx.lineWidth = PX * .7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const E = (...pts) => { ctx.beginPath(); for (let i = 0; i < pts.length; i += 2) ctx.lineTo(x0 + pts[i] * PX, top + pts[i + 1] * PX + b); ctx.stroke(); };
    if (o.eyes === 'hurt') { E(3.7, 2.1, 5.2, 3, 3.7, 3.9); E(12.3, 2.1, 10.8, 3, 12.3, 3.9); }
    else if (o.eyes === 'happy') { E(3.8, 3.5, 4.5, 2.6, 5.2, 3.5); E(10.8, 3.5, 11.5, 2.6, 12.2, 3.5); }
    else if (o.eyes === 'blink') { R(4, 3.2, 1, .5); R(11, 3.2, 1, .5); }
    else { R(4, 2, 1, 2); R(11, 2, 1, 2); }
    ctx.restore();
  };

  const drawBot = () => {
    const h = p.y, x = px, air = h > 0;
    const run = state === 'run', moving = run || (state === 'finish' && fv > 1);
    const duck = p.duck && run;
    const hurt = state === 'over' || (run && inv > 1.1 && ultra <= 0);
    const happy = state === 'win' || (state === 'finish' && fv <= 1) || !!(boss && boss.approved);
    // тень
    if (!G) {
      ctx.fillStyle = C.ink; ctx.globalAlpha = .13 * Math.max(.3, 1 - h / 200);
      ctx.beginPath(); ctx.ellipse(x, GY + 3, 30 * Math.max(.5, 1 - h / 300), 4, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Vibe coding: радуга, которая тянется за Clawd по всей траектории
    if (vibe > 0 && trail.length > 1) {
      ctx.globalAlpha = Math.min(1, vibe) * .9;
      for (let i = trail.length - 1; i > 0; i--) {
        const a = trail[i], z = trail[i - 1];
        const x1 = a.d - dist + x - 22, x2 = z.d - dist + x - 22;
        if (x1 < -10) break;
        const wob = still ? 0 : Math.floor(a.d / 24) % 2 ? 2 : -2;
        const top = GY - a.y - (a.duck ? 12 : 24) - RAINBOW.length * 1.8 + wob;
        RAINBOW.forEach((c, j) => { ctx.fillStyle = c; ctx.fillRect(x2, top + j * 3.6, x1 - x2 + 1, 3.8); });
      }
      ctx.globalAlpha = 1;
    }
    // ultrathink: огненный хвост кометы и оранжевые эхо-копии Clawd
    if (ultra > 0 && trail.length > 1) {
      const fade = Math.min(1, ultra), n = trail.length;
      for (let i = n - 1; i > 0; i--) {
        const a = trail[i], z = trail[i - 1], q = (n - 1 - i) / n;
        const x1 = a.d - dist + x - 20, x2 = z.d - dist + x - 20;
        if (x1 < -10 || vibe > 0) break;
        const th = 24 * (1 - q) * (still ? 1 : .8 + .2 * Math.sin(t * 40 + i)), cy = GY - a.y - (a.duck ? 12 : 24);
        ctx.globalAlpha = fade * (1 - q) * (G ? .45 : .9);
        ctx.fillStyle = FIRE[2 + Math.min(2, Math.floor(q * 3))];
        ctx.fillRect(x2, cy - th / 2, x1 - x2 + 1, th);
        if (q < .55) { ctx.fillStyle = FIRE[q < .25 ? 0 : 1]; ctx.fillRect(x2, cy - th * .2, x1 - x2 + 1, th * .4); }
      }
      for (let i = n - 12; i > 0 && !G; i -= 12) {
        const a = trail[i], q = (n - 1 - i) / n;
        ctx.globalAlpha = fade * .35 * (1 - q);
        clawd(a.d - dist + x, GY - a.y, { sy: a.duck ? .5 : 1, sx: a.duck ? 1.14 : 1, tint: FIRE[Math.min(4, 1 + Math.floor(q * 4))] });
      }
      ctx.globalAlpha = 1;
    }
    // линии скорости
    if (moving && !still && !duck && !ultra && !G) {
      ctx.strokeStyle = CLAWD; ctx.lineCap = 'round'; ctx.lineWidth = 2;
      [[-46, 14, 18], [-56, 26, 26], [-44, 38, 14]].forEach(([dx, dy, len], i) => {
        const q = (t * 3 + i * .37) % 1;
        ctx.globalAlpha = .35 * (1 - q);
        line(x + dx - q * 30, GY - h - dy, x + dx - q * 30 - len, GY - h - dy);
      });
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = run && inv > 0 && ultra <= 0 && Math.floor(t * 14) % 2 ? .35 : 1;
    let sx = 1, sy = 1;
    if (duck) { sx = 1.14; sy = .5; }
    else if (air) { const s = Math.max(-.08, Math.min(.1, p.vy / 9000)); sx = 1 - s; sy = 1 + s; }
    if (p.sq > 0 && !duck) { sx += p.sq; sy -= p.sq; }
    const step = moving && !air ? (Math.sin(p.phase) > 0 ? 0 : 1) : null;
    const bob = moving && !air ? (Math.sin(p.phase * 2) > 0 ? -1.2 : 0) : state === 'start' || state === 'pause' ? (Math.sin(t * 2.4) > .6 ? -1 : 0) : 0;
    if (!G) clawd(x, GY - h, {
      sx, sy, bob, step, air,
      rot: state === 'over' ? .12 : p.flip < TAU ? p.flip : 0,
      arms: air || happy ? 'up' : state === 'start' ? 'wave' : 'down',
      swing: step == null ? 0 : step ? .5 : -.5,
      eyes: hurt ? 'hurt' : happy ? 'happy' : p.blink > 0 || duck ? 'blink' : 'open',
      glow: ultra > 0 && !still && !fx ? (Math.sin(t * 18) > 0 ? FIRE[1] : FIRE[2]) : null
    });
    ctx.globalAlpha = 1;
    const cy = GY - h - (duck ? 12 : 24);
    if (shield) {
      ctx.globalAlpha = .5 + Math.sin(t * 6) * .2;
      ctx.strokeStyle = C.fig; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, cy, 46, 0, TAU); ctx.stroke();
      ctx.globalAlpha = .08; ctx.fillStyle = C.fig; ctx.fill();
    }
    if (mag > 0) {
      ctx.globalAlpha = Math.min(1, mag) * .6;
      ctx.strokeStyle = MCP; ctx.lineWidth = 2; ctx.setLineDash([5, 7]); ctx.lineDashOffset = -t * 30;
      ctx.beginPath(); ctx.arc(x, cy, 54 + Math.sin(t * 8) * 3, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
    if (ultra > 0) {
      ctx.font = DISPLAY(10);
      const w = ctx.measureText('ULTRATHINK').width + 16, y = Math.max(84, GY - h - (duck ? 44 : 68));
      ctx.fillStyle = TERM; rr(x - w / 2, y - 10, w, 20, 10); ctx.fill();
      hotText('ULTRATHINK', x, y + .5, DISPLAY(10));
    }
  };

  // пузырь с репликой Clawd в стиле терминала Claude Code
  const drawBubble = () => {
    if (!bubble || state === 'pause' || ultra > 0) return;
    const a = Math.min(1, bubble.t / .12, (bubble.dur - bubble.t) / .2);
    if (a <= 0) return;
    ctx.font = FONT(600, 12);
    const sp = bubble.spin ? 16 : 0, w = ctx.measureText(bubble.text).width + 20 + sp, h = 24;
    const hx = px + 4, hy = GY - p.y - (p.duck && state === 'run' ? 24 : 46);
    const bx = Math.max(6, Math.min(W - w - 6, hx - 18)), by = Math.max(50, hy - h - 14);
    const tx = Math.max(bx + 10, Math.min(bx + w - 10, hx));
    ctx.globalAlpha = a;
    ctx.fillStyle = TERM; rr(bx, by, w, h, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(217,119,87,.55)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = TERM; poly(tx - 5, by + h - 1, tx + 5, by + h - 1, tx, by + h + 6); ctx.fill();
    if (bubble.spin) spark(bx + 13, by + h / 2, 5, t * 4, CLAWD);
    text(bubble.text, bx + 10 + sp, by + h / 2 + .5, FONT(600, 12), IVORY, 'left');
    ctx.globalAlpha = 1;
  };

  // активные бонусы под HUD
  const drawPower = () => {
    if (state !== 'run') return;
    let x = 14;
    const chip = (label, frac, bg, fg = '#fff') => {
      ctx.font = FONT(700, 11);
      const w = ctx.measureText(label).width + 20;
      if (bg === RAINBOW) { const g = ctx.createLinearGradient(x, 0, x + w, 0); RAINBOW.forEach((c, i) => g.addColorStop(i / (RAINBOW.length - 1), c)); bg = g; }
      ctx.fillStyle = bg; rr(x, 50, w, 20, 10); ctx.fill();
      if (frac) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x + 8, 65, (w - 16) * Math.max(0, frac), 2); }
      text(label, x + w / 2, 59.5, FONT(700, 11), fg);
      x += w + 6;
    };
    if (shield) chip('Evals: щит', 0, C.fig);
    if (mag > 0) chip(`MCP ${Math.ceil(mag)} с`, mag / 7, MCP);
    if (ultra > 0) chip(`ultrathink ${Math.ceil(ultra)} с`, ultra / 5.5, CLAWD);
    if (vibe > 0) chip(`Vibe coding: ₽ x2 · ${Math.ceil(vibe)} с`, vibe / 6, RAINBOW, TERM);
    if (combo >= 3) chip(`Комбо x${combo}`, comboT / .9, GREEN);
  };

  const paint = () => {
    ctx.save();
    if (shake > 0 && !still && !fx) ctx.translate((Math.random() - .5) * 10 * shake / .35, (Math.random() - .5) * 6 * shake / .35);
    scene();
    drawBoss();
    items.forEach(drawItem);
    obs.forEach(drawObs);
    drawBot();
    drawParts();
    drawBubble();
    drawPower();
    if (flash > 0 && !still) { ctx.fillStyle = '#fff'; ctx.globalAlpha = flash * 2; ctx.fillRect(0, 0, W, LH); ctx.globalAlpha = 1; }
    ctx.restore();
  };
  const drawParts = () => {
    parts.forEach(q => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - q.t / q.life);
      ctx.translate(q.x - dist + px, GY - q.h); ctx.rotate(q.r);
      if (q.spark) spark(0, 0, q.s, 0, q.c);
      else { ctx.fillStyle = q.c; ctx.fillRect(-q.s / 2, -q.s / 2, q.s, q.s * .7); }
      ctx.restore();
    });
    texts.forEach(q => {
      ctx.globalAlpha = Math.max(0, 1 - q.t / 1.1);
      text(q.text, q.x - dist + px, GY - q.h, FONT(700, q.size), q.color);
    });
    ctx.globalAlpha = 1;
  };
  // второй проход: только светящиеся детали, в пониженном разрешении
  const paintGlow = () => {
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.clearRect(0, 0, gcv.width, gcv.height);
    gctx.setTransform(GU, 0, 0, GU, 0, 0);
    ctx = gctx; G = true;
    try {
      scene(); drawBoss(); items.forEach(drawItem); obs.forEach(drawObs); drawBot(); drawParts();
    } finally { ctx = base; G = false; }
  };
  // dt > 0 – кадр цикла: слой эффектов продвигает частицы; dt = 0 – просто перерисовать
  const draw = (dt = 0) => {
    if (!C.card) return;
    paint();
    if (!fx) return;
    paintGlow();
    const run = state === 'run' || state === 'finish';
    fx.step(performance.now(), dt, { dist, hx: px - 18, hy: GY - p.y - (p.duck && state === 'run' ? 12 : 24), ultra: run && ultra > 0, vibe: run && vibe > 0, motes: state !== 'over' });
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
    draw(dt);
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
  if (document.fonts) document.fonts.ready.then(() => draw());
  intro();
  kick();
})();

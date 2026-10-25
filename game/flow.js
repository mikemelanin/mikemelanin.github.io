// Игра "Соберите AI-систему": схема-поток в духе Mini Metro. Чёрные линии и узлы, красный – только для пробок.
// Игрок тянет линии: отдел – AI-агент – данные. Запрос бежит точкой от отдела к агенту, агент сходит в данные и вернёт ответ.
// Правила всегда на виду: таймер недели по центру сверху, счётчик линий со словом, красная очередь – крупное предупреждение.
// Под каждым агентом – его нагрузка в процентах: за 100% очереди растут. При выборе усиления видно, какой будет нагрузка дальше.
// Обучение – отдельная фаза до недели 1, его можно пропустить. Начало каждой недели – чекпойнт: проигрыш переигрывает только её.
// Тексты и баланс – в SRC, DEPT, WEEKS, UPS, WHY и блоке balance.
(() => {
  const root = document.querySelector('.fl');
  if (!root) return;
  const $ = s => root.querySelector(s);
  const cv = $('canvas'), ctx = cv.getContext('2d');
  const hud = $('.fl-hud');
  const wnumEl = $('.fl-wnum'), wnameEl = $('.fl-wname');
  const goalEl = $('.fl-goal'), timeEl = $('.fl-time'), barEl = $('.fl-bar');
  const linksEl = $('.fl-links'), linksN = linksEl.querySelector('b');
  const screen = $('.fl-screen'), banner = $('.fl-banner'), alarmEl = $('.fl-alarm'), coachEl = $('.fl-coach'), tipEl = $('.fl-tip');
  const skipBtn = $('.fl-skip'), pauseBtn = $('.fl-pause'), soundBtn = $('.fl-sound');
  const TG = 'https://t.me/mike_melanin';
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const TAP = coarse ? 'Тапните' : 'Кликните';
  const TAU = Math.PI * 2, RED = '#E5484D';
  let C = {};
  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    C = { paper: v('--paper'), card: v('--card'), ink: v('--ink'), muted: v('--muted'), line: v('--line'), chip: v('--chip') };
  };
  readColors();
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
  };

  // ---------- content ----------
  // каждый отдел спрашивает только свои данные: фигура на запросе = фигура источника
  const SRC = {
    kb: { name: 'База знаний', shape: 'sq' },
    crm: { name: 'CRM', shape: 'tr' },
    erp: { name: '1С', shape: 'di' },
    doc: { name: 'Договоры', shape: 'cr' },
  };
  const DEPT = {
    sup: { name: 'Поддержка', src: 'kb', quit: 'Поддержка бросит AI', fail: 'Поддержка вернулась к ручным ответам' },
    sal: { name: 'Продажи', src: 'crm', quit: 'Продажи бросят AI', fail: 'Продажи вернулись к таблицам' },
    fin: { name: 'Финансы', src: 'erp', quit: 'Финансы бросят AI', fail: 'Финансы вернулись к Excel' },
    law: { name: 'Юристы', src: 'doc', quit: 'Юристы бросят AI', fail: 'Юристы вернулись к бумаге' },
  };
  // обучение идёт на поддержке и базе знаний, недели добавляют по отделу; dur – секунды, lines – новые линии
  const TUT_N = 6;
  const WEEKS = [
    { dept: 'sal', src: 'crm', dur: 20, lines: 2, what: 'Новый отдел' },
    { dept: 'fin', src: 'erp', dur: 22, lines: 2, what: 'Новый отдел · запросов больше' },
    { dept: 'law', src: 'doc', dur: 24, lines: 2, what: 'Новый отдел · запросов больше' },
    { name: 'Вся компания', dur: 26, lines: 2, what: 'Пик нагрузки' },
  ];
  const wname = w => w.dept ? DEPT[w.dept].name : w.name;
  // предлог и последнее слово не остаются одни на строке: "к Excel", "ручным ответам"
  const glue = t => t.replace(/ (к|в|с|и|на|о|у) /g, ' $1 ').replace(/ (\S+)$/, ' $1');
  const GPU = 3, GPU_MAX = 1;   // сервер мощнее: +GPU к мощности каждого агента
  // links – запасной вариант: предлагается, только когда усилений осталось меньше двух
  const UPS = {
    agent: { name: 'Второй AI‑агент', max: 1, lines: 2, text: () => 'Заберёт часть отделов. +2 линии, чтобы его подключить' },
    gpu: { name: 'Сервер мощнее', max: GPU_MAX, text: () => `${by('agent').length > 1 ? 'Каждый агент держит' : 'Агент держит'} ${cap + GPU} запросов разом вместо ${cap}` },
    cache: { name: 'Кэш ответов', max: 1, text: () => '40% ответов без похода в данные – агент освобождается быстрее' },
    links: { name: '+3 линии', max: 1, lines: 3, text: () => 'Подключите отделы к обоим агентам – запросы пойдут к свободному' },
  };
  // почему отдел сдался и что посоветовал бы Майк
  const WHY = {
    off: ['Отдел так и не подключили к AI‑агенту.', 'Пилот без пользователей не взлетает. Подключайте отдел с первого дня и спрашивайте, что ему мешает.'],
    data: ['Агент не видел нужных данных, ответов не было.', 'Сначала карта данных и доступы, потом модель. Агент без нужных данных – просто чат-бот.'],
    load: ['Нагрузка была выше 100%: запросов приходило больше, чем агенты успевали ответить.', 'Нагрузку на масштабе считайте до запуска. Мощность и второго агента закладывайте заранее, а частые ответы кэшируйте.'],
    skew: ['Один агент тонул в запросах, а второй стоял с запасом.', 'Делите отделы между агентами по нагрузке, а не по оргструктуре.'],
  };

  // ---------- balance ----------
  const QMAX = 5;            // столько запросов отдел ждёт спокойно, дальше очередь краснеет
  const OVER_T = 10;         // секунд красной очереди до проигрыша
  const CAP = 4;             // запросов, которые агент держит одновременно
  const THINK = .35, THINK2 = .2;
  const CACHE = .4;
  const GAP = .22;           // пауза между запросами одного отдела на линии
  const TRIP = .7;           // секунд на любой пролёт по линии: так мощность агента не зависит от длины линий
  // агент держит запрос от выхода из отдела до готового ответа: пролёт к агенту, мысль, данные туда и обратно, мысль
  const hold = (c = cacheOn) => TRIP * 3 + THINK + THINK2 - (c ? CACHE * TRIP * 2 : 0);
  // запросов в секунду от одного отдела: своя база у каждой недели, к концу недели растёт.
  // Пик недели при верных линиях и толковых усилениях – 65–95% мощности, неверный выбор виден в прогнозе как 104–150%
  const BASE = [.48, .55, .62, 1], RAMP = .4;
  const rate = () => demo ? .42 : tut ? .3 : BASE[week] * (1 + RAMP * weekT / WEEKS[week].dur);

  // ---------- sound ----------
  let ac = null, muted = store.get('mm-flow-muted') === '1';
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
  const tone = (f1, f2, dur, type = 'sine', vol = .05, delay = 0) => {
    if (muted || !audio()) return;
    try {
      const t0 = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f1, t0);
      if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      g.gain.setValueAtTime(.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + .008);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      o.connect(g).connect(ac.destination);
      o.start(t0); o.stop(t0 + dur + .02);
    } catch {}
  };
  // каждый ответ – нота пентатоники, у каждого отдела свой регистр
  const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
  const pluck = (i, delay = 0, vol = .045) => tone(SCALE[i % SCALE.length], SCALE[i % SCALE.length], .55, 'sine', vol, delay);
  const SFX = {
    link: () => { tone(660, 990, .07, 'triangle', .04); },
    cut: () => tone(520, 300, .09, 'triangle', .04),
    no: () => tone(190, 150, .14, 'square', .02),
    note: (d, n) => pluck(d * 2 + n % 3, 0, .03),
    warn: () => tone(196, 185, .22, 'triangle', .05),
    week: () => [2, 4, 5].forEach((k, j) => pluck(k, j * .09)),
    lose: () => [5, 3, 1, 0].forEach((k, j) => tone(SCALE[k] / 2, SCALE[k] / 2, .5, 'triangle', .05, j * .13)),
    win: () => [0, 2, 4, 5, 7].forEach((k, j) => pluck(k, j * .1, .05)),
  };
  soundBtn.addEventListener('click', () => {
    muted = !muted;
    soundBtn.setAttribute('aria-pressed', String(!muted));
    store.set('mm-flow-muted', muted ? '1' : '0');
  });

  // ---------- state ----------
  // state: intro – демо-схема под заставкой, run – игра или обучение (tut > 0), pick – выбор усиления, pause, over, win
  let state = 'intro', demo = true;
  let nodes = [], links = [], dots = [], ghosts = [];
  let week = 0, weekT = 0, tut = 0, cutOnce = false, free = 0, cap = CAP, cacheOn = false;
  let answered = 0, spawned = 0, redT = 0, maxQ = 0, clock = 0, used = {}, warned = 0, hintT = 0;
  // grace – секунды в начале недели (пока виден баннер), когда очередь ещё не краснеет
  let grace = 0, mem = null;
  let sel = null, drag = null, tap = null, hover = null;
  let best = +store.get('mm-flow-best') || 0;
  const TUTK = 'mm-flow-tut', SAVE = 'mm-flow-save';
  let tutDone = store.get(TUTK) === '1';

  const by = kind => nodes.filter(n => n.kind === kind);
  const src = key => nodes.find(n => n.kind === 'src' && n.key === key);
  const srcOf = d => src(DEPT[d.key].src);
  const linkOf = (a, b) => links.find(l => (l.ag === a && l.n === b) || (l.ag === b && l.n === a));
  const other = (l, n) => l.ag === n ? l.n : l.ag;
  const agentsOf = d => links.filter(l => l.n === d).map(l => l.ag);
  // соединять можно только через агента: отдел – агент или агент – данные
  const canPair = (a, b) => a !== b && (a.kind === 'agent') !== (b.kind === 'agent');
  const add = (kind, key) => {
    const n = { kind, key, x: 0, y: 0, tx: 0, ty: 0, born: clock, q: [], over: 0, pulse: 0, busy: 0, jobs: [], spawnT: 1.2, gapT: 0, spin: 0, red: false, load: 0, shown: 0 };
    nodes.push(n);
    return n;
  };
  const link = (a, b) => {
    const ag = a.kind === 'agent' ? a : b, l = { ag, n: ag === a ? b : a, born: clock };
    curve(l);
    links.push(l);
    return l;
  };
  const dIdx = n => Object.keys(DEPT).indexOf(n.key);
  // что мешает отделу: off – нет линии к агенту, data – его агенты не видят его данных, load – просто не успевают
  const diag = d => {
    const ags = agentsOf(d), s = srcOf(d);
    return !ags.length ? 'off' : !ags.some(a => linkOf(a, s)) ? 'data' : 'load';
  };
  // агенты, которые могут ответить отделу: есть линия к отделу и к его данным
  const ready = d => agentsOf(d).filter(a => linkOf(a, srcOf(d)));
  // нагрузка агента: сколько запросов к нему приходит относительно того, сколько он успевает (1 = 100%).
  // Отдел с одним агентом грузит только его; общий отдел доливается тому, у кого запас, – так и раздаёт игра
  const loads = () => {
    const ags = by('agent'), r = rate(), K = cap / hold(), L = new Map(ags.map(a => [a, 0]));
    const shared = [];
    for (const d of by('dept')) {
      const ok = ready(d);
      if (ok.length === 1) L.set(ok[0], L.get(ok[0]) + r);
      else if (ok.length) shared.push(ok);
    }
    for (const ok of shared) for (let k = 0; k < 10; k++) {
      const a = ok.reduce((m, x) => L.get(x) < L.get(m) ? x : m);
      L.set(a, L.get(a) + r / 10);
    }
    for (const a of ags) a.load = L.get(a) / K;
  };
  const pct = v => `${Math.round(v * 100)}%`;
  const agName = a => by('agent').length > 1 ? `агент ${by('agent').indexOf(a) + 1}` : 'агент';

  // ---------- size & layout ----------
  // Широкий экран: данные слева, агенты по центру, отделы справа. Телефон: данные сверху, отделы снизу.
  // tight – телефон боком: высоты мало, подписи уходят вбок от узлов
  // flat – узлы идут слева направо: на широком экране всегда, на телефоне – пока идёт обучение
  let W = 800, H = 480, dpr = 1, land = true, flat = true, tight = false, R = 18, RA = 24, LW = 3, FS = 12, A0 = 0, A1 = 0, AG_Y = 21, AG_GAP = 16;
  const resize = () => {
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(3, devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    land = W / H > 1.05;
    tight = land && H < 360;
    AG_Y = tight ? 15 : 21; AG_GAP = tight ? 13 : 16;
    root.classList.toggle('is-port', !land);
    root.classList.toggle('is-tight', tight);
    R = tight ? 12 : Math.max(14, Math.min(22, Math.min(W, H) * .04));
    RA = R * 1.35;
    LW = R > 16 ? 3.5 : 3;
    FS = R >= 19 ? 13 : 12;
    layout(true);
    links.forEach(curve);
    placeAll();
    draw();
  };
  // Обучение: три узла одной строкой под карточкой подсказки, чтобы она ничего не закрывала
  const tutRow = () => {
    const top = (hud.hidden ? 50 : relTop(hud)) + 8;
    const ch = coachEl.classList.contains('is-on') ? coachEl.offsetHeight : 110;
    return Math.min(H - 58 - RA - 34, Math.max(H * (land ? .5 : .55), top + ch + RA + 24));
  };
  const layout = snap => {
    flat = land || tut > 0;
    const lanes = { src: by('src'), agent: by('agent'), dept: by('dept') };
    const along = { src: 0, agent: .5, dept: 1 };
    let a0, a1, c0, c1;
    if (tight) { a0 = Math.max(W * .13, 104); a1 = W - 132; c0 = 58; c1 = H - 46; }
    else if (land) { a0 = W * .13; a1 = W * .84; c0 = 76; c1 = H - 58; }
    else if (flat) { a0 = W * .16; a1 = W * .76; c0 = c1 = H / 2; }
    // сверху на телефоне два ряда HUD: неделя с линиями и таймер; подписи данных – над узлами
    else { a0 = (hud.hidden ? 100 : relTop(hud)) + R + 32; a1 = H - 100; c0 = 6; c1 = W - 30; }
    A0 = a0; A1 = a1;
    const row = tut ? tutRow() : null;
    for (const kind in lanes) lanes[kind].forEach((n, i, all) => {
      const f = along[kind], c = row ?? c0 + (c1 - c0) * (i + .5) / all.length;
      const a = a0 + (a1 - a0) * f;
      n.tx = flat ? a : c; n.ty = flat ? c : a;
      if (snap || !n.x) { n.x = n.tx; n.y = n.ty; }
    });
  };
  const agLt = v => `нагрузка ${pct(v)}`;

  // ---------- curves ----------
  // линия – мягкая S-кривая вдоль потока, по ней точки бегут с постоянной скоростью
  const N = 22;
  const curve = l => {
    const a = l.ag, b = l.n, dx = b.x - a.x, dy = b.y - a.y;
    const k1 = flat ? .5 : .3, k2 = flat ? .3 : .5;
    const c1x = a.x + dx * k1, c1y = a.y + dy * k2, c2x = b.x - dx * k1, c2y = b.y - dy * k2;
    const pts = l.pts || (l.pts = new Float32Array((N + 1) * 2)), cum = l.cum || (l.cum = new Float32Array(N + 1));
    let len = 0;
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t;
      const x = u * u * u * a.x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * b.x;
      const y = u * u * u * a.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * b.y;
      if (i) len += Math.hypot(x - pts[i * 2 - 2], y - pts[i * 2 - 1]);
      pts[i * 2] = x; pts[i * 2 + 1] = y; cum[i] = len;
    }
    l.len = Math.max(1, len);
  };
  const pointAt = (l, u) => {
    const d = Math.max(0, Math.min(1, u)) * l.len, cum = l.cum, pts = l.pts;
    let i = 1;
    while (i < N && cum[i] < d) i++;
    const s = cum[i] - cum[i - 1] || 1, f = (d - cum[i - 1]) / s;
    return [pts[i * 2 - 2] + (pts[i * 2] - pts[i * 2 - 2]) * f, pts[i * 2 - 1] + (pts[i * 2 + 1] - pts[i * 2 - 1]) * f];
  };
  const distTo = (l, x, y) => {
    let m = Infinity;
    for (let i = 0; i < N; i++) {
      const ax = l.pts[i * 2], ay = l.pts[i * 2 + 1], bx = l.pts[i * 2 + 2], by_ = l.pts[i * 2 + 3];
      const vx = bx - ax, vy = by_ - ay, L = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L));
      m = Math.min(m, Math.hypot(ax + vx * t - x, ay + vy * t - y));
    }
    return m;
  };

  // ---------- flow ----------
  // ask – запрос к агенту, fetch – агент идёт в данные, back – данные к агенту, answer – ответ отделу
  const send = (l, from, kind, r) => dots.push({ l, from, kind, r, t: 0, dur: TRIP });
  // запрос вернулся в очередь: линию убрали, пока он был в пути
  const requeue = (r, held) => {
    if (held && r.ag) r.ag.busy--;
    r.ag = null;
    if (nodes.includes(r.d)) r.d.q.unshift(r);
  };
  const arrive = p => {
    const r = p.r;
    if (p.kind === 'ask') r.ag.jobs.push({ r, t: THINK, ph: 1 });
    else if (p.kind === 'fetch') { const s = other(p.l, p.from); s.pulse = 1; send(p.l, s, 'back', r); }
    else if (p.kind === 'back') r.ag.jobs.push({ r, t: THINK2, ph: 2 });
    else {
      r.d.pulse = 1;
      if (demo) return;
      answered++;
      SFX.note(dIdx(r.d), answered);
    }
  };
  const dispatch = d => {
    const s = srcOf(d);
    let pick = null;
    // свободный агент с доступом к данным отдела, из нескольких – наименее занятый
    for (const a of agentsOf(d)) if (a.busy < cap && linkOf(a, s) && (!pick || a.busy < pick.busy)) pick = a;
    if (!pick) return;
    const r = d.q.shift();
    r.ag = pick; pick.busy++;
    send(linkOf(d, pick), d, 'ask', r);
    d.gapT = GAP;
  };

  const update = dt => {
    clock += dt;
    const e = Math.min(1, dt * 7);
    for (const n of nodes) {
      n.x += (n.tx - n.x) * e; n.y += (n.ty - n.y) * e;
      n.pulse = Math.max(0, n.pulse - dt * 2.4);
    }
    links.forEach(curve);
    for (let i = ghosts.length; i--;) if ((ghosts[i].t += dt * 3) >= 1) ghosts.splice(i, 1);
    if (state !== 'run' && !demo) return;

    for (const d of by('dept')) {
      if ((d.spawnT -= dt) <= 0) {
        d.spawnT = (.75 + Math.random() * .5) / rate();
        // в обучении и в демо очередь не переполняется
        if (!((demo || tut) && d.q.length >= (demo ? 3 : QMAX))) { d.q.push({ s: DEPT[d.key].src, d, ag: null }); if (!demo) spawned++; }
      }
      d.gapT -= dt;
    }
    // свободного агента первым получает отдел с самой длинной очередью, а не первый по списку
    by('dept').sort((a, b) => b.q.length - a.q.length).forEach(d => { if (d.gapT <= 0 && d.q.length) dispatch(d); });
    for (let i = dots.length; i--;) {
      const p = dots[i];
      if ((p.t += dt / p.dur) < 1) continue;
      dots.splice(i, 1);
      arrive(p);
    }
    loads();
    for (const a of by('agent')) {
      // цифра под агентом догоняет нагрузку плавно, чтобы не мелькала
      a.shown += (a.load - a.shown) * Math.min(1, dt * 5);
      a.spin += dt * (.6 + a.busy * 1.2);
      for (let i = a.jobs.length; i--;) {
        const j = a.jobs[i];
        if ((j.t -= dt) > 0) continue;
        if (j.ph === 1 && cacheOn && Math.random() < CACHE) { j.ph = 2; j.t = THINK2; continue; }
        a.jobs.splice(i, 1);
        if (j.ph === 1) {
          const l = linkOf(a, src(j.r.s));
          if (l) send(l, a, 'fetch', j.r); else requeue(j.r, true);
        } else {
          const l = linkOf(a, j.r.d);
          a.busy--;
          if (l) send(l, a, 'answer', j.r); else requeue(j.r, false);
        }
      }
    }
    if (demo) return;

    if (grace > 0) grace -= dt;
    let anyRed = false;
    for (const d of by('dept')) {
      const red = !tut && grace <= 0 && d.q.length > QMAX;
      if (red && !d.red) SFX.warn();
      d.red = red;
      d.over = red ? d.over + dt / OVER_T : Math.max(0, d.over - dt / (OVER_T * 2));
      if (!tut) maxQ = Math.max(maxQ, d.q.length);
      anyRed = anyRed || red;
      if (d.over >= 1) return lose(d);
    }
    if (anyRed) {
      redT += dt;
      if ((warned -= dt) <= 0) { warned = 1.1; if (by('dept').some(d => d.over > .45)) SFX.warn(); }
    }
    if (!tut) {
      weekT += dt;
      if (weekT >= WEEKS[week].dur) return endWeek();
    }
    if ((hintT -= dt) <= 0) { hintT = .5; hints(); }
    alarm();
    paintGoal();
  };

  // ---------- overlays ----------
  // Плашки (предупреждение, баннер недели, обучение, подсказка) ложатся в свободную от узлов полосу.
  // Узел с подписью и очередью – прямоугольник; ищем по высоте зазор, ближайший к нужной точке.
  const boxes = () => {
    ctx.font = `600 ${FS}px Onest, system-ui, sans-serif`;
    const tw = s => ctx.measureText(s).width + 8;
    const out = [];
    for (const n of nodes) {
      const x = n.tx, y = n.ty, at = out.length;
      if (n.kind === 'src') {
        const r = R * 1.15 + 5, w = tw(SRC[n.key].name);
        out.push([x - r, y - r, x + r, y + r]);
        if (tight) out.push([x - R - 8 - w, y - 9, x, y + 9]);
        else if (flat) out.push([x - w / 2, y + R + 5, x + w / 2, y + R + 25]);
        else out.push([x - w / 2, y - R - 23, x + w / 2, y - R - 3]);
      } else if (n.kind === 'agent') {
        // под агентом две строки: имя и нагрузка; на телефоне справа от агента им не хватает ширины
        const r = RA + 10, w = Math.max(tw('AI-агент 2'), tw(agLt(1))), ly = y + RA + AG_Y, gap = AG_GAP;
        out.push([x - r, y - r, x + r, y + r]);
        out.push([x - w / 2, ly - 9, x + w / 2, ly + gap + 9]);
      } else {
        const r = R * 1.02, w = tw(DEPT[n.key].name);
        out.push([x - r - 10, y - r - 12, x + r + 44, y + r + 10]);
        if (tight) out.push([x + r + 40, y - 9, x + r + 45 + w, y + 9]);
        else { const ly = y + r + (flat ? 15 : 14); out.push([x - w / 2, ly - 9, x + w / 2, ly + 9]); }
      }
      for (let i = at; i < out.length; i++) out[i][4] = n.kind;
    }
    return out;
  };
  const relTop = el => el.getBoundingClientRect().bottom - cv.getBoundingClientRect().top;
  // на широком экране кроме центра есть полосы между колонками – там только линии
  const sides = all => {
    const edge = (k, f, i) => Math.max(...all.filter(b => b[4] === k).map(b => f * b[i]), -1e4) * f;
    return [[edge('src', 1, 2), edge('agent', -1, 0)], [edge('agent', 1, 2), edge('dept', -1, 0)]];
  };
  const spot = (w, h, py, taken) => {
    const top = (hud.hidden ? 8 : relTop(hud)) + 6, bot = H - 58;
    const all = boxes(), xs = [W / 2];
    if (land) xs.push(...sides(all).map(([a, b]) => (a + b) / 2));
    all.push(...taken);
    // точки линий: плашка не садится на перекрёсток, где игрок тапом убирает линии
    const lp = [];
    for (const l of links) if (l.pts) for (let i = 0; i <= N; i += 2) lp.push(l.pts[i * 2], l.pts[i * 2 + 1]);
    let best = null;
    for (const cx of xs) {
      const x0 = cx - w / 2 - 3, x1 = cx + w / 2 + 3;
      if (x0 < 2 || x1 > W - 2) continue;
      const ys = all.filter(b => b[2] > x0 && b[0] < x1).map(b => [b[1] - 6, b[3] + 6]).sort((p, q) => p[0] - q[0]);
      const gaps = [];
      let y = top;
      for (const [a, b] of ys) { if (a > y) gaps.push([y, a]); y = Math.max(y, b); }
      if (bot > y) gaps.push([y, bot]);
      for (const [a, b] of gaps) {
        if (b - a < h) continue;
        const ts = [Math.max(a, Math.min(b - h, py - h / 2))];
        for (let t = a; t <= b - h; t += 10) ts.push(t);
        ts.push(b - h);
        for (const t of ts) {
          let hit = 0;
          for (let k = 0; k < lp.length; k += 2) if (lp[k] > x0 && lp[k] < x1 && lp[k + 1] > t && lp[k + 1] < t + h) hit++;
          const sc = Math.abs(t + h / 2 - py) + Math.abs(cx - W / 2) * .6 + hit * 6;
          if (!best || sc < best.sc) best = { sc, x: cx, y: t };
        }
      }
    }
    return best;
  };
  const placeAll = () => {
    const taken = [], top = (hud.hidden ? 8 : relTop(hud)) + 6;
    // обучение: карточка сразу под HUD, а узлы стоят строкой ниже неё (см. tutRow)
    if (coachEl.classList.contains('is-on')) {
      const w = coachEl.offsetWidth, h = coachEl.offsetHeight;
      coachEl.style.left = `${W / 2}px`; coachEl.style.top = `${top + 2}px`;
      taken.push([W / 2 - w / 2, top + 2, W / 2 + w / 2, top + 2 + h]);
    }
    for (const [el, py] of [[alarmEl, .5], [banner, .42], [tipEl, .6]]) {
      el.classList.remove('is-away', 'is-compact', 'is-min');
      el.style.maxWidth = '';
      if (!el.classList.contains('is-on')) continue;
      // при красной тревоге её строка уже говорит, что делать, – обычная подсказка не нужна
      if (el === tipEl && alarmKey && !tipEl.classList.contains('is-alert')) { el.classList.add('is-away'); continue; }
      let w = el.offsetWidth, h = el.offsetHeight;
      let p = spot(w, h, H * py, taken);
      // тесно: тревога и баннер становятся узкими и мельче, чтобы встать в полосу между колонками
      // на телефоне – тонкая полоса во всю ширину, боком – узкая колонка между узлами
      if (!p && el !== tipEl) {
        el.classList.add('is-compact');
        el.style.maxWidth = `${land ? Math.max(180, Math.max(...sides(boxes()).map(([a, b]) => b - a)) - 10) : W - 24}px`;
        w = el.offsetWidth; h = el.offsetHeight; p = spot(w, h, H * py, taken);
        // совсем тесно (маленький телефон): у тревоги остаётся одна строка с отделом и секундами
        if (!p && el === alarmEl) { el.classList.add('is-min'); w = el.offsetWidth; h = el.offsetHeight; p = spot(w, h, H * py, taken); }
      }
      // тревога и баннер видны всегда: если свободной полосы нет, встают под HUD поверх схемы
      if (!p && el !== tipEl) {
        let y = top;
        for (let moved = true; moved;) {
          moved = false;
          for (const b of taken) if (b[2] > W / 2 - w / 2 && b[0] < W / 2 + w / 2 && b[3] > y && b[1] < y + h) { y = b[3] + 6; moved = true; }
        }
        p = { x: W / 2, y };
      }
      if (!p) { el.classList.add('is-away'); continue; }
      el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
      taken.push([p.x - w / 2, p.y, p.x + w / 2, p.y + h]);
    }
  };

  // подсказка-тост: ошибки, "проведите линию", нехватка линий
  let tipText = '', tipLock = 0;
  const tip = (text, alert = false, hold = 0) => {
    if (tipLock > clock && !hold) return;
    if (hold) tipLock = clock + hold;
    if (text === tipText) return;
    tipText = text;
    tipEl.classList.toggle('is-on', !!text);
    tipEl.classList.toggle('is-alert', alert);
    if (text) { tipEl.textContent = text; placeAll(); }
  };

  // крупное предупреждение: какой отдел сейчас сдастся и через сколько секунд
  let alarmKey = '';
  // куда перекинуть отдел перегруженного агента: агент с запасом, к которому отдел ещё не подключён
  const relief = d => {
    const mine = ready(d);
    if (!mine.length || mine.some(a => a.load < 1)) return null;
    const cool = by('agent').filter(a => !mine.includes(a) && a.load < .8).sort((p, q) => p.load - q.load)[0];
    if (!cool) return null;
    const need = (linkOf(d, cool) ? 0 : 1) + (linkOf(cool, srcOf(d)) ? 0 : 1);
    return { cool, need };
  };
  const fix = d => {
    const k = diag(d), D = DEPT[d.key].name, S = SRC[DEPT[d.key].src].name;
    if (k === 'off') return `Проведите линию: ${D} → AI‑агент`;
    if (k === 'data') return `Проведите линию: AI‑агент → ${S}`;
    const mine = ready(d), rel = relief(d);
    if (rel) {
      const to = agName(rel.cool).replace('агент', 'агенту'), hot = agName(mine[0]);
      return free >= rel.need ? `${hot[0].toUpperCase() + hot.slice(1)} перегружен – подключите ${D} к ${to}`
        : `Линий не хватает: ${TAP.toLowerCase()} по лишней и подключите ${D} к ${to}`;
    }
    // агент успевает, просто разбирает очередь, которая накопилась раньше
    if (mine.some(a => a.load < .97)) return 'Агент успевает – очередь разбирается, держитесь';
    const can = ['agent', 'gpu', 'cache'].some(k => (used[k] || 0) < UPS[k].max);
    if (week === WEEKS.length - 1 || !can) return `Нагрузка выше 100% – держитесь, до конца ${timeEl.textContent}`;
    return 'Нагрузка выше 100% – после недели возьмите усиление';
  };
  const alarm = () => {
    let html = '';
    if (state === 'run' && !tut) {
      const d = by('dept').filter(d => d.red).sort((a, b) => b.over - a.over)[0];
      if (d) html = `<strong>${DEPT[d.key].quit} через ${Math.max(1, Math.ceil((1 - d.over) * OVER_T - .05))} с</strong><span>${fix(d)}</span>`;
    }
    if (html === alarmKey) return;
    alarmKey = html;
    if (html) alarmEl.innerHTML = html;
    alarmEl.classList.toggle('is-on', !!html);
    placeAll();
  };

  // шаги обучения: плашка у центра, призрачная линия показывает жест
  const svgShape = (s, cls = '') => {
    const P = {
      sq: '<rect x="-6.5" y="-6.5" width="13" height="13"/>',
      tr: '<path d="M0-8 7.6 5.6H-7.6Z"/>',
      di: '<path d="M0-8.5 8.5 0 0 8.5-8.5 0Z"/>',
      cr: '<path d="M-3-8h6v5h5v6h-5v5h-6v-5h-5v-6h5Z"/>',
      ok: '<circle r="8.5"/><path class="k" d="M-3.6.2-1 2.8 3.8-2.4"/>',
    };
    return `<svg class="fl-g ${cls}" viewBox="-10 -10 20 20" aria-hidden="true">${P[s]}</svg>`;
  };
  let coachKey = '';
  const coach = () => {
    let v = null;
    if (tut && state === 'run') {
      const [a] = by('agent'), [d] = by('dept'), [s] = by('src');
      const miss = !linkOf(d, a) ? [d, a] : !linkOf(a, s) ? [a, s] : null;
      const named = m => m[0] === d ? 'Поддержка → AI‑агент' : 'AI‑агент → База знаний';
      if (tut === 1) v = { t: 'Поддержка → AI‑агент', s: coarse ? 'Проведите пальцем от белого круга к чёрному' : 'Протяните мышью от белого круга к чёрному', g: [d, a] };
      else if (tut === 2) v = { t: 'AI‑агент → База знаний', s: 'Теперь линия к данным: там агент возьмёт ответы', g: [a, s] };
      else if (miss && tut === 4 && cutOnce) v = { t: 'Линия вернулась в запас', s: `Свободных: ${free}. Проведите её снова: ${named(miss)}`, g: miss, hl: linksEl };
      else if (miss) v = { t: 'Верните линию', s: named(miss), g: miss };
      else if (tut === 3) v = { t: 'Фигура = нужные данные', s: `${svgShape('sq')} – запрос в Базу знаний, ${svgShape('ok', 'is-ok')} – готовый ответ`, b: 'Понятно' };
      else if (tut === 4) v = { t: 'Линии ограничены – счётчик вверху', s: `${TAP} по линии, она вернётся в запас`, hl: linksEl };
      else if (tut === 5) v = { t: 'Под агентом – его нагрузка', s: 'До 100% он успевает. Больше – очереди растут: делите отделы между агентами', b: 'Дальше' };
      else v = { t: 'Продержитесь до конца таймера', s: 'Очередь больше 5 краснеет, 10 с красной – проигрыш', b: 'Начать неделю 1', hl: goalEl };
      v.n = tut;
    }
    ghost = v ? v.g || null : ghost;
    linksEl.classList.toggle('is-hl', v?.hl === linksEl);
    goalEl.classList.toggle('is-hl', v?.hl === goalEl);
    skipBtn.hidden = !v;
    const key = v ? [v.n, v.t, v.s, v.b].join('|') : '';
    if (key === coachKey) return;
    const step = v && coachKey.split('|')[0] !== String(v.n);
    coachKey = key;
    // новый шаг – старые подсказки и ошибки больше не к месту
    if (step) { tipLock = 0; tip(''); }
    if (v) coachEl.innerHTML = `<strong>${v.t}</strong><div class="fl-crow${v.b ? ' has-btn' : ''}">${v.s ? `<span>${v.s}</span>` : ''}${v.b ? `<button type="button" data-act="next">${v.b}</button>` : ''}</div>`;
    if (step) { coachEl.classList.remove('is-pop'); void coachEl.offsetWidth; coachEl.classList.add('is-pop'); }
    coachEl.classList.toggle('is-on', !!v);
    paintHud();
    if (tut) { layout(false); links.forEach(curve); }
    placeAll();
  };
  const tutStep = () => {
    if (!tut) return;
    const [a] = by('agent'), [d] = by('dept'), [s] = by('src');
    const both = linkOf(d, a) && linkOf(a, s);
    if (tut <= 2) tut = !linkOf(d, a) ? 1 : !linkOf(a, s) ? 2 : 3;
    else if (tut === 4 && cutOnce && both) tut = 5;
    coach();
  };

  // ---------- hints ----------
  // ghost – пунктир, который сам тянется от узла к узлу и показывает, что сделать
  let ghost = null;
  const hints = () => {
    if (tut) return coach();
    ghost = null;
    const ags = by('agent');
    const age = n => clock - n.born;
    const lighter = () => ags.slice().sort((a, b) => links.filter(l => l.ag === a && l.n.kind === 'dept').length - links.filter(l => l.ag === b && l.n.kind === 'dept').length)[0];
    for (const d of by('dept')) {
      const k = diag(d), s = srcOf(d), D = DEPT[d.key].name, S = SRC[s.key].name;
      if (k === 'off' && (age(d) > 2.5 || d.q.length > 2)) {
        ghost = [d, ags.find(a => linkOf(a, s)) || lighter()];
        return tip(`Проведите линию: ${D} → AI‑агент`);
      }
      if (k === 'data' && age(s) > 1.5) {
        const mine = agentsOf(d), has = ags.find(a => linkOf(a, s));
        if (free > 0 || !has) { ghost = [mine[0], s]; return tip(`Проведите линию: AI‑агент → ${S}`); }
        ghost = [d, has];
        return tip(`Соедините ${D} и ${S} через одного агента`);
      }
    }
    for (const a of ags) if (!links.some(l => l.ag === a) && age(a) > 1) {
      ghost = [a, by('dept').sort((p, q) => q.q.length - p.q.length)[0]];
      return tip('Подключите второго агента: линия к отделу и линия к его данным');
    }
    // агент за 100%, а у второго запас: показываем, какой отдел перекинуть
    for (const d of by('dept').sort((p, q) => q.q.length - p.q.length)) {
      const rel = relief(d);
      if (!rel) continue;
      const to = agName(rel.cool).replace('агент', 'агенту');
      ghost = !linkOf(d, rel.cool) ? [d, rel.cool] : [rel.cool, srcOf(d)];
      return tip(free >= rel.need ? `Подключите ${DEPT[d.key].name} к ${to}: у него запас` : `Линий не хватает: ${TAP.toLowerCase()} по лишней и подключите ${DEPT[d.key].name} к ${to}`);
    }
    tip('');
  };

  // ---------- actions ----------
  const flash = el => { el.classList.remove('is-shake'); void el.offsetWidth; el.classList.add('is-shake'); };
  linksEl.addEventListener('animationend', e => { if (e.target === linksEl && e.animationName !== 'fl-glow') linksEl.classList.remove('is-shake', 'is-add'); });
  // счётчик линий подпрыгивает и показывает, сколько добавилось
  const bump = n => {
    if (!n) return;
    linksEl.dataset.add = `+${n}`;
    linksEl.classList.remove('is-add'); void linksEl.offsetWidth; linksEl.classList.add('is-add');
  };
  const connect = (a, b) => {
    if (!canPair(a, b)) {
      SFX.no();
      return tip(a.kind === 'agent' ? 'Агенты между собой не соединяются' : 'Отделы и данные соединяются через AI‑агента', true, 2.6);
    }
    if (linkOf(a, b)) return;
    if (free <= 0) {
      SFX.no(); flash(linksEl);
      return tip(`Свободных линий нет. ${TAP} по ненужной линии – она вернётся в запас`, true, 3.2);
    }
    link(a, b);
    free--;
    SFX.link(); paintHud(); hintT = 0; tutStep();
  };
  const cut = l => {
    links.splice(links.indexOf(l), 1);
    ghosts.push({ pts: l.pts.slice(), t: 0 });
    for (let i = dots.length; i--;) {
      const p = dots[i];
      if (p.l !== l) continue;
      dots.splice(i, 1);
      // готовый ответ засчитываем, остальное возвращается в очередь отдела
      if (p.kind === 'answer') arrive(p); else requeue(p.r, true);
    }
    free++;
    bump(1);
    if (tut === 4) cutOnce = true;
    SFX.cut(); paintHud(); hintT = 0; tutStep();
  };

  // ---------- input ----------
  const hitR = n => (n.kind === 'agent' ? RA : R) + (coarse ? 18 : 10);
  const nodeAt = (x, y, skip, extra = 0) => {
    let m = null, md = Infinity;
    for (const n of nodes) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (n !== skip && d < hitR(n) + extra && d < md) { m = n; md = d; }
    }
    return m;
  };
  const linkAt = (x, y) => {
    let m = null, md = coarse ? 16 : 10;
    for (const l of links) { const d = distTo(l, x, y); if (d < md) { m = l; md = d; } }
    return m;
  };
  // true – жест наш: тянем линию, страницу не скроллим
  const down = (x, y) => {
    if (state !== 'run') return false;
    audio();
    const n = nodeAt(x, y);
    if (n) { drag = { n, x, y, x0: x, y0: y, moved: false }; return true; }
    tap = { l: linkAt(x, y), x0: x, y0: y };
    return false;
  };
  const move = (x, y) => {
    if (drag) {
      drag.x = x; drag.y = y;
      if (Math.hypot(x - drag.x0, y - drag.y0) > 9) drag.moved = true;
    }
    if (tap && Math.hypot(x - tap.x0, y - tap.y0) > 10) tap = null;
  };
  const up = (x, y) => {
    // жест начался до паузы или конца недели – ничего не делаем
    if (state !== 'run') { cancel(); return; }
    if (drag) {
      const a = drag.n, moved = drag.moved;
      drag = null;
      if (!moved && Math.hypot(x - a.x, y - a.y) < hitR(a)) {
        // тап по узлу: первый выбирает, второй соединяет
        if (sel && sel !== a) { const s = sel; sel = null; connect(s, a); }
        else sel = sel === a ? null : a;
        return;
      }
      sel = null;
      const b = nodeAt(x, y, a, 14);
      if (b) connect(a, b);
      return;
    }
    if (tap) {
      if (tap.l && links.includes(tap.l)) cut(tap.l);
      sel = null;
      tap = null;
    }
  };
  const cancel = () => { drag = null; tap = null; };
  const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  // Палец: жест с узла забираем себе, с пустого места – отдаём странице, чтобы она скроллилась.
  let tid = null;
  const touchOf = e => [...e.changedTouches].find(t => t.identifier === tid);
  cv.addEventListener('touchstart', e => {
    if (e.touches.length > 1) { tid = null; cancel(); return; }
    const t = e.changedTouches[0];
    tid = t.identifier;
    if (down(...local(t))) e.preventDefault();
  }, { passive: false });
  cv.addEventListener('touchmove', e => {
    const t = touchOf(e);
    if (!t) return;
    move(...local(t));
    if (drag) e.preventDefault();
  }, { passive: false });
  cv.addEventListener('touchend', e => {
    const t = touchOf(e);
    if (!t) return;
    tid = null;
    up(...local(t));
    // без синтетического клика: он мог бы попасть в панель, которая появилась под пальцем
    e.preventDefault();
  }, { passive: false });
  cv.addEventListener('touchcancel', () => { tid = null; cancel(); });

  cv.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' || e.button) return;
    if (down(...local(e))) { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch {} }
  });
  cv.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const [x, y] = local(e);
    move(x, y);
    hover = state === 'run' ? nodeAt(x, y) || linkAt(x, y) : null;
    root.classList.toggle('is-hover', !!hover || !!drag);
  });
  cv.addEventListener('pointerup', e => { if (e.pointerType !== 'touch') up(...local(e)); });
  cv.addEventListener('pointercancel', e => { if (e.pointerType !== 'touch') cancel(); });
  cv.addEventListener('pointerleave', () => { hover = null; root.classList.remove('is-hover'); });

  // ---------- draw ----------
  const shape = (x, y, r, s) => {
    ctx.beginPath();
    if (s === 'sq') { const h = r * .86; ctx.rect(x - h, y - h, h * 2, h * 2); }
    else if (s === 'tr') { ctx.moveTo(x, y - r * 1.08); ctx.lineTo(x + r * 1.05, y + r * .78); ctx.lineTo(x - r * 1.05, y + r * .78); ctx.closePath(); }
    else if (s === 'di') { ctx.moveTo(x, y - r * 1.12); ctx.lineTo(x + r * 1.12, y); ctx.lineTo(x, y + r * 1.12); ctx.lineTo(x - r * 1.12, y); ctx.closePath(); }
    else if (s === 'cr') {
      const a = r * .38, b = r;
      ctx.moveTo(x - a, y - b); ctx.lineTo(x + a, y - b); ctx.lineTo(x + a, y - a); ctx.lineTo(x + b, y - a); ctx.lineTo(x + b, y + a); ctx.lineTo(x + a, y + a);
      ctx.lineTo(x + a, y + b); ctx.lineTo(x - a, y + b); ctx.lineTo(x - a, y + a); ctx.lineTo(x - b, y + a); ctx.lineTo(x - b, y - a); ctx.lineTo(x - a, y - a); ctx.closePath();
    } else ctx.arc(x, y, r, 0, TAU);
  };
  const pop = n => {
    const t = Math.max(0, Math.min(1, (clock - n.born) / .45));
    return t >= 1 ? 1 : 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
  };
  const text = (s, x, y, align = 'center', color = C.ink, size = FS) => {
    ctx.font = `600 ${size}px Onest, system-ui, sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = C.card; ctx.lineJoin = 'round';
    ctx.strokeText(s, x, y);
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  };
  const strokePts = (pts, upto = 1) => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    const last = Math.max(1, Math.round(N * upto));
    for (let i = 1; i <= last; i++) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
    ctx.stroke();
  };

  const drawLink = l => {
    const t = Math.min(1, (clock - l.born) / .22);
    ctx.lineWidth = hover === l ? LW + 2 : LW;
    ctx.strokeStyle = C.ink;
    strokePts(l.pts, t);
  };
  const drawDot = p => {
    const u = p.from === p.l.ag ? p.t : 1 - p.t;
    const [x, y] = pointAt(p.l, u);
    if (p.kind === 'ask') {
      ctx.fillStyle = C.ink; ctx.strokeStyle = C.card; ctx.lineWidth = 1.5;
      shape(x, y, 4.6, SRC[p.r.s].shape); ctx.stroke(); ctx.fill();
    } else if (p.kind === 'answer') {
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x, y, 5.6, 0, TAU); ctx.fill();
      ctx.strokeStyle = C.paper; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x - 2.4, y + .2); ctx.lineTo(x - .6, y + 2); ctx.lineTo(x + 2.6, y - 1.8); ctx.stroke();
    } else {
      ctx.fillStyle = p.kind === 'back' ? C.ink : C.paper; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x, y, 3.4, 0, TAU); ctx.fill(); ctx.stroke();
    }
  };
  const ring = (n, r, alpha, color = C.ink, w = 2) => {
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  };
  const drawSrc = n => {
    const s = pop(n);
    if (n.pulse) ring(n, R + 4 + (1 - n.pulse) * 12, n.pulse * .5);
    ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.fillStyle = C.paper; ctx.lineJoin = 'miter';
    shape(n.x, n.y, R * s, SRC[n.key].shape); ctx.fill(); ctx.stroke();
    if (s < .6) return;
    if (tight) text(SRC[n.key].name, n.x - R - 8, n.y, 'right');
    else if (flat) text(SRC[n.key].name, n.x, n.y + R + 15);
    else text(SRC[n.key].name, n.x, n.y - R - 13);
  };
  const drawAgent = (n, i, all) => {
    const s = pop(n), r = RA * s;
    if (n.pulse) ring(n, r + 8 + (1 - n.pulse) * 10, n.pulse * .4);
    // кольцо: сколько запросов агент держит из возможных; красное – агент перегружен
    const hot = n.shown >= 1, seg = TAU / cap, gap = Math.min(.22, seg * .25);
    ctx.lineWidth = 3.2; ctx.lineCap = 'butt';
    for (let k = 0; k < cap; k++) {
      ctx.strokeStyle = k < n.busy ? hot ? RED : C.ink : C.line;
      ctx.beginPath(); ctx.arc(n.x, n.y, r + 6, -Math.PI / 2 + k * seg + gap / 2, -Math.PI / 2 + (k + 1) * seg - gap / 2); ctx.stroke();
    }
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = C.paper; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = n.spin + k * Math.PI / 4, q = r * .42;
      ctx.moveTo(n.x - Math.cos(a) * q, n.y - Math.sin(a) * q); ctx.lineTo(n.x + Math.cos(a) * q, n.y + Math.sin(a) * q);
    }
    ctx.stroke();
    if (s < .6) return;
    const name = all.length > 1 ? `AI-агент ${i + 1}` : 'AI-агент', lt = agLt(n.shown), sz = tight ? 11 : FS;
    const ly = n.y + RA + AG_Y + AG_GAP;
    text(name, n.x, n.y + RA + AG_Y, 'center', C.muted, sz);
    text(lt, n.x, ly, 'center', hot ? RED : C.ink, sz);
    // обучение, шаг про нагрузку: строка с процентами мигает рамкой
    if (tut === 5 && state === 'run') {
      const w = ctx.measureText(lt).width + 14, x0 = n.x - w / 2;
      ctx.globalAlpha = .55 + Math.sin(clock * 5) * .35; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, ly - 11, w, 22, 11) : ctx.rect(x0, ly - 11, w, 22); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };
  const drawDept = n => {
    const s = pop(n), r = R * 1.02 * s;
    const hot = n.red || n.over > 0;
    if (n.pulse) ring(n, r + 4 + (1 - n.pulse) * 10, n.pulse * .45);
    // таймер красной очереди
    if (n.over > 0) {
      ctx.strokeStyle = RED; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.globalAlpha = .25;
      ctx.beginPath(); ctx.arc(n.x, n.y, r + 7, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(n.x, n.y, r + 7, -Math.PI / 2, -Math.PI / 2 + n.over * TAU); ctx.stroke();
    }
    ctx.fillStyle = C.paper; ctx.strokeStyle = hot ? RED : C.ink; ctx.lineWidth = 4.2;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, TAU); ctx.fill(); ctx.stroke();
    // внутри отдела – фигура его данных: видно, куда ему нужна линия
    ctx.globalAlpha = .3; ctx.fillStyle = C.ink;
    shape(n.x, n.y, r * .4, SRC[DEPT[n.key].src].shape); ctx.fill();
    ctx.globalAlpha = 1;
    if (s < .6) return;
    if (tight) text(DEPT[n.key].name, n.x + r + 45, n.y, 'left');
    else text(DEPT[n.key].name, n.x, n.y + r + (flat ? 15 : 14));
    // очередь: сетка 3 x 4 справа от отдела, лишнее – числом над ней.
    // Первые QMAX мест видны пустыми контурами: сколько ещё влезет, пока очередь не покраснела
    const q = n.q, gx = n.x + r + (n.over > 0 ? 15 : 9), gy = n.y - 13.5, sh = SRC[DEPT[n.key].src].shape;
    for (let i = 0; i < Math.max(QMAX, Math.min(q.length, 12)); i++) {
      const x = gx + (i % 3) * 9, y = gy + Math.floor(i / 3) * 9;
      if (i >= q.length) { ctx.strokeStyle = C.muted; ctx.globalAlpha = .45; ctx.lineWidth = 1.1; shape(x, y, 3, sh); ctx.stroke(); ctx.globalAlpha = 1; continue; }
      ctx.fillStyle = i >= QMAX || n.red ? RED : C.ink;
      shape(x, y, 3.4, SRC[q[i].s].shape); ctx.fill();
    }
    if (q.length > 12) text(`+${q.length - 12}`, gx - 1, gy - 11, 'left', RED, 11);
  };
  const drawGhost = () => {
    if (!ghost || drag || state !== 'run') return;
    const [a, b] = ghost;
    if (!a || !b) return;
    const t = (clock * .55) % 1, e = Math.min(1, t * 1.6), k = e * e * (3 - 2 * e);
    const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
    ctx.globalAlpha = .45 * (1 - Math.max(0, t - .8) * 5);
    ctx.setLineDash([5, 7]); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(x, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  };
  const drawDrag = () => {
    if (!drag || !drag.moved) return;
    const a = drag.n, b = nodeAt(drag.x, drag.y, a, 14);
    const ok = !b || (canPair(a, b) && free > 0);
    const x = b ? b.x : drag.x, y = b ? b.y : drag.y;
    ctx.setLineDash([6, 6]); ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.strokeStyle = ok && free > 0 ? C.ink : RED; ctx.globalAlpha = .7;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(x, y); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    if (b) ring(b, (b.kind === 'agent' ? RA : R) + 9, .9, ok ? C.ink : RED, 2.5);
    else { ctx.fillStyle = free > 0 ? C.ink : RED; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); }
  };

  const draw = () => {
    if (!C.ink) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const g of ghosts) { ctx.globalAlpha = 1 - g.t; ctx.lineWidth = LW; ctx.strokeStyle = C.muted; strokePts(g.pts); }
    ctx.globalAlpha = 1;
    links.forEach(drawLink);
    drawGhost();
    drawDrag();
    dots.forEach(drawDot);
    const ags = by('agent');
    nodes.forEach(n => n.kind === 'src' ? drawSrc(n) : n.kind === 'agent' ? drawAgent(n, ags.indexOf(n), ags) : drawDept(n));
    // выбранный тапом узел и куда его можно провести
    if (sel && state === 'run') {
      const pulse = .6 + Math.sin(clock * 6) * .3;
      ring(sel, (sel.kind === 'agent' ? RA : R) + 10, pulse, C.ink, 2.5);
      nodes.forEach(n => { if (canPair(sel, n) && !linkOf(sel, n)) ring(n, (n.kind === 'agent' ? RA : R) + 9, .35, C.ink, 2); });
    }
  };

  // ---------- hud & screens ----------
  const plural = (n, [one, few, many]) => {
    const m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  };
  const REQ = ['запрос', 'запроса', 'запросов'], LINES = ['линия', 'линии', 'линий'];
  const paintHud = () => {
    wnumEl.textContent = tut ? 'Обучение' : `Неделя ${week + 1} из ${WEEKS.length}`;
    wnameEl.textContent = tut ? `Шаг ${tut} из ${TUT_N}` : wname(WEEKS[week]);
    linksN.textContent = String(free);
    linksEl.classList.toggle('is-zero', free <= 0);
    if (free > 0 && tipText.startsWith('Свободных линий нет')) { tipLock = 0; tip(''); }
    const hide = tut > 0 && tut < TUT_N;
    if (goalEl.hidden !== hide) { goalEl.hidden = hide; if (tut) layout(false); placeAll(); }
    paintGoal();
  };
  // таймер недели: сколько ещё продержаться
  let lastSec = -1;
  const paintGoal = () => {
    const dur = WEEKS[week].dur, left = tut ? dur : Math.max(0, Math.ceil(dur - weekT - .001));
    barEl.style.setProperty('--p', tut ? '0' : Math.min(1, weekT / dur).toFixed(3));
    if (left === lastSec) return;
    lastSec = left;
    timeEl.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    const end = !tut && left <= 5;
    goalEl.classList.toggle('is-end', end);
    if (end) { goalEl.classList.remove('is-tick'); void goalEl.offsetWidth; goalEl.classList.add('is-tick'); }
  };

  let bannerT = 0;
  const showBanner = (small, big, line) => {
    banner.innerHTML = `<small>${small}</small><strong>${big}</strong>${line ? `<span>${line}</span>` : ''}`;
    banner.classList.add('is-on');
    placeAll();
    clearTimeout(bannerT);
    bannerT = setTimeout(() => banner.classList.remove('is-on'), 2900);
  };
  const quiet = () => {
    tipLock = 0; tip('');
    alarmKey = ''; alarmEl.classList.remove('is-on');
    clearTimeout(bannerT); banner.classList.remove('is-on');
  };

  const panel = (html, focus) => {
    screen.innerHTML = `<div class="fl-panel">${html}</div>`;
    screen.hidden = false;
    hud.hidden = state === 'intro';
    if (state !== 'pause') { quiet(); coach(); }
    if (focus) screen.querySelector('button')?.focus({ preventScroll: true });
  };

  // ---------- checkpoint ----------
  // начало недели (после выбора усиления) сохраняется целиком: узлы, линии, очереди, усиления, счёт
  // копия в памяти – на случай, когда localStorage недоступен
  const save = () => {
    mem = JSON.stringify({
      v: 3, week, free, cap, cacheOn, used, answered, spawned, redT, maxQ,
      nodes: nodes.map(n => [n.kind, n.key, n.q.length]),
      links: links.map(l => [nodes.indexOf(l.ag), nodes.indexOf(l.n)]),
    });
    store.set(SAVE, mem);
  };
  const num = v => typeof v === 'number' && isFinite(v) && v >= 0;
  // чужое или битое сохранение не должно ломать игру: проверяем всё, что потом читаем
  const valid = s => {
    if (!s || s.v !== 3 || !Number.isInteger(s.week) || !WEEKS[s.week]) return false;
    if (!['free', 'answered', 'spawned', 'redT', 'maxQ'].every(k => num(s[k])) || !Number.isInteger(s.free) || s.free > 20) return false;
    if (!Number.isInteger(s.cap) || s.cap < CAP || s.cap > CAP + 4 || typeof s.cacheOn !== 'boolean') return false;
    if (!s.used || typeof s.used !== 'object' || Array.isArray(s.used) || !Object.entries(s.used).every(([k, v]) => UPS[k] && Number.isInteger(v) && v >= 0 && v <= UPS[k].max)) return false;
    if (!Array.isArray(s.nodes) || !Array.isArray(s.links)) return false;
    const have = new Set();
    for (const n of s.nodes) {
      if (!Array.isArray(n)) return false;
      const [k, key, q = 0] = n;
      const ok = k === 'agent' ? key === 'a1' || key === 'a2' : k === 'dept' ? DEPT[key] : k === 'src' && SRC[key];
      if (!ok || !num(q) || have.has(`${k}:${key}`)) return false;
      have.add(`${k}:${key}`);
    }
    const need = ['sup', ...WEEKS.slice(0, s.week + 1).filter(w => w.dept).map(w => w.dept)];
    if (!have.has('agent:a1') || !need.every(d => have.has(`dept:${d}`) && have.has(`src:${DEPT[d].src}`))) return false;
    return s.links.every(l => Array.isArray(l) && s.nodes[l[0]] && s.nodes[l[1]] && (s.nodes[l[0]][0] === 'agent') !== (s.nodes[l[1]][0] === 'agent'));
  };
  const load = () => {
    for (const raw of [mem, store.get(SAVE)]) {
      try { const s = JSON.parse(raw); if (valid(s)) return s; } catch {}
    }
    return null;
  };
  const drop = () => { mem = null; store.set(SAVE, null); };

  const RULES = `<ul class="fl-rules">
      <li><svg viewBox="0 0 72 24" aria-hidden="true"><path class="s" d="M13 12h12M41 12h13"/><circle class="o" cx="7" cy="12" r="5.5"/><circle class="f" cx="33" cy="12" r="8"/><path class="w" d="M29 12h8M33 8v8M30.2 9.2l5.6 5.6M35.8 9.2l-5.6 5.6"/><rect class="o" x="57" y="6" width="12" height="12"/></svg>
        <span>Проведите линии: <b>отдел → AI‑агент → данные</b></span></li>
      <li><svg viewBox="0 0 72 24" aria-hidden="true"><circle class="f" cx="11" cy="12" r="8"/><path class="w" d="M7 12h8M11 8v8M8.2 9.2l5.6 5.6M13.8 9.2l-5.6 5.6"/><text x="26" y="16.6">85%</text></svg>
        <span>Под агентом – нагрузка. <b>За&nbsp;100% очереди растут</b></span></li>
      <li><svg viewBox="0 0 72 24" aria-hidden="true"><circle class="rr" cx="11" cy="12" r="10"/><path class="ra" d="M11 2a10 10 0 0 1 9.5 13"/><circle class="ro" cx="11" cy="12" r="6"/><g class="rf"><rect x="26" y="4" width="6" height="6"/><rect x="35" y="4" width="6" height="6"/><rect x="44" y="4" width="6" height="6"/><rect x="26" y="14" width="6" height="6"/><rect x="35" y="14" width="6" height="6"/><rect x="44" y="14" width="6" height="6"/></g></svg>
        <span>Очередь больше 5 краснеет. <b>10&nbsp;секунд красной – проигрыш</b></span></li>
      <li><svg viewBox="0 0 72 24" aria-hidden="true"><rect class="o t" x="2" y="2" width="68" height="20" rx="10"/><text x="36" y="16.6" text-anchor="middle">0:20</text></svg>
        <span>Продержитесь до конца таймера. <b>4&nbsp;недели – победа</b></span></li>
    </ul>`;
  const intro = () => {
    const cp = load();
    let btns;
    if (cp && cp.week > 0) btns = `<button type="button" class="btn btn-blue" data-act="cont">Продолжить: неделя ${cp.week + 1}</button><button type="button" class="btn btn-line" data-act="fresh">Сначала</button>`;
    else if (tutDone) btns = `<button type="button" class="btn btn-blue" data-act="fresh">Играть</button>`;
    else btns = `<button type="button" class="btn btn-blue" data-act="learn">Играть с обучением</button><button type="button" class="btn btn-line" data-act="fresh">Без обучения</button>`;
    panel(`
    <p class="fl-kicker">4 недели · 2 минуты</p>
    <h3>Соберите AI‑систему</h3>
    ${RULES}
    <div class="fl-btns">${btns}</div>
    ${tutDone ? '<button type="button" class="fl-more" data-act="learn">Пройти обучение</button>' : ''}
    ${best ? `<p class="fl-best">Ваш рекорд: ${best} ${plural(best, REQ)}</p>` : ''}`);
  };

  // демо под заставкой: вся схема уже собрана и работает
  const demoSet = () => {
    demo = true; state = 'intro';
    nodes = []; links = []; dots = []; ghosts = []; cap = 4; cacheOn = false; tut = 0; clock = 10;
    const a1 = add('agent', 'a1'), a2 = add('agent', 'a2');
    const n = {};
    for (const k in DEPT) { n[k] = add('dept', k); n[DEPT[k].src] = add('src', DEPT[k].src); }
    [[a1, 'sup'], [a1, 'sal'], [a1, 'kb'], [a1, 'crm'], [a2, 'fin'], [a2, 'law'], [a2, 'erp'], [a2, 'doc'], [a2, 'sal'], [a1, 'fin'], [a2, 'crm'], [a1, 'erp']]
      .forEach(([ag, k]) => links.push({ ag, n: n[k], born: -1 }));
    nodes.forEach(n => { n.born = -1; n.spawnT = Math.random() * 2; });
    layout(true);
    links.forEach(curve);
  };

  const reset = () => {
    demo = false; state = 'run';
    nodes = []; links = []; dots = []; ghosts = []; sel = null; drag = null; tap = null; ghost = null;
    week = 0; weekT = 0; tut = 0; cutOnce = false; free = 0; cap = CAP; cacheOn = false; lastSec = -1; grace = 0;
    answered = 0; spawned = 0; redT = 0; maxQ = 0; clock = 0; used = {}; warned = 0; hintT = 0;
    quiet();
  };
  // игра целиком в кадре и не под шапкой сайта
  const enter = () => {
    screen.hidden = true; hud.hidden = false;
    audio();
    root.focus({ preventScroll: true });
    const r = root.getBoundingClientRect(), bar = document.querySelector('.topbar')?.getBoundingClientRect().bottom || 0;
    if (r.top < bar + 4 || r.bottom > innerHeight) scrollBy({ top: r.top - bar - Math.max(8, (innerHeight - bar - r.height) / 2), behavior: still ? 'auto' : 'smooth' });
    kick();
  };
  // старт: с обучением – пустая схема поддержки; без него – пилот в поддержке уже работает, сразу неделя 1
  const play = withTut => {
    reset();
    tutDone = true; store.set(TUTK, '1');
    const a = add('agent', 'a1'), d = add('dept', 'sup'), s = add('src', 'kb');
    layout(true);
    enter();
    if (withTut) { tut = 1; free = 2; paintHud(); hints(); return; }
    link(a, d); link(a, s);
    startWeek(0);
  };
  const finishTut = () => {
    if (!tut) return;
    tut = 0; cutOnce = false; sel = null;
    // ответы обучения в счёт и рекорд не идут
    answered = 0; spawned = 0;
    // пропуск посреди обучения: недостающие линии поддержки дорисуем сами
    const [a] = by('agent'), [d] = by('dept'), [s] = by('src');
    if (!linkOf(d, a)) link(a, d);
    if (!linkOf(a, s)) link(a, s);
    free = 0;
    d.q.length = Math.min(d.q.length, 2);
    coach();
    startWeek(0);
  };
  const startWeek = (i, extra = 0) => {
    const w = WEEKS[i];
    week = i; weekT = 0; lastSec = -1;
    // новый отдел приходит не пустым: 3 запроса уже ждут, сидеть сложа руки нельзя с первой секунды
    if (w.dept) { const d = add('dept', w.dept); add('src', w.src); d.q = Array.from({ length: 3 }, () => ({ s: w.src, d, ag: null })); }
    free += w.lines + extra;
    // новая неделя начинается с чистого листа: без красного таймера и с короткой очередью,
    // иначе проигрыш переезжал бы в следующую неделю и в чекпойнт
    for (const d of by('dept')) { d.over = 0; d.red = false; d.q.length = Math.min(d.q.length, QMAX - 2); }
    grace = 2.5;
    layout(false);
    links.forEach(curve);
    save();
    announce(w.lines + extra);
    if (i) SFX.week();
  };
  const announce = more => {
    const w = WEEKS[week];
    paintHud();
    bump(more);
    const line = more ? `${w.what} · +${more} ${plural(more, LINES)}` : w.dept ? `${w.what} · линий в запасе: ${free}` : w.what;
    showBanner(`Неделя ${week + 1} из ${WEEKS.length} · продержитесь ${w.dur} с`, w.dept ? `${DEPT[w.dept].name} и ${SRC[w.src].name}` : w.name, line);
    hintT = 0;
  };
  const restore = s => {
    reset();
    ({ week, free, cap, cacheOn, answered, spawned, redT, maxQ } = s);
    used = { ...s.used };
    for (const [kind, key, q = 0] of s.nodes) {
      const n = add(kind, key);
      if (kind === 'dept') n.q = Array.from({ length: Math.min(q, QMAX - 2) }, () => ({ s: DEPT[key].src, d: n, ag: null }));
    }
    grace = 2.5;
    layout(true);
    for (const [i, j] of s.links) if (nodes[i] && nodes[j] && canPair(nodes[i], nodes[j]) && !linkOf(nodes[i], nodes[j])) link(nodes[i], nodes[j]);
    enter();
    announce(0);
  };
  const retry = () => {
    const s = load();
    if (s) try { restore(s); return; } catch {}
    drop();
    play(false);
  };

  const endWeek = () => {
    if (week === WEEKS.length - 1) return win();
    state = 'pick'; cancel(); sel = null;
    weekT = WEEKS[week].dur; paintGoal();
    // все оставшиеся усиления; когда их меньше двух, есть ещё запасные линии. У каждого – прогноз нагрузки
    const opts = ['agent', 'gpu', 'cache'].filter(k => (used[k] || 0) < UPS[k].max);
    if (opts.length < 2 && !used.links) opts.push('links');
    const next = WEEKS[week + 1], f0 = forecast();
    const fc = v => `<em class="${v > 1 ? 'is-bad' : ''}"><i>${pct(v)}</i>${v > 1 ? 'не успеют' : 'нагрузка'}</em>`;
    SFX.week();
    panel(`
      <p class="fl-kicker">Неделя ${week + 1} из ${WEEKS.length} пройдена · ${answered} ${plural(answered, REQ)}</p>
      <h3>Чем усилить систему?</h3>
      <p>Неделя ${week + 2}: ${next.dept ? `новый отдел ${DEPT[next.dept].name} и ${SRC[next.src].name}` : 'вся компания, пик нагрузки'}.</p>
      <p class="fl-load">Без усиления к&nbsp;концу недели нагрузка дойдёт до&nbsp;<span class="${f0 > 1 ? 'is-bad' : ''}">${pct(f0)}</span>. Выше 100% очереди растут</p>
      <div class="fl-picks">${opts.map(k => `<button type="button" data-up="${k}"><b>${UPS[k].name}</b><span>${UPS[k].text()}</span>${fc(forecast(k))}</button>`).join('')}</div>`, true);
  };
  // прогноз: нагрузка к концу следующей недели с усилением k, если отделы поделены между агентами поровну
  const forecast = k => {
    const i = week + 1, n = 1 + WEEKS.slice(0, i + 1).filter(w => w.dept).length;
    const ags = by('agent').length + (k === 'agent' ? 1 : 0), c = cap + (k === 'gpu' ? GPU : 0);
    return n * BASE[i] * (1 + RAMP) / (ags * c / hold(cacheOn || k === 'cache'));
  };
  const upgrade = k => {
    if (state !== 'pick') return;
    used[k] = (used[k] || 0) + 1;
    if (k === 'gpu') cap += GPU;
    else if (k === 'cache') cacheOn = true;
    else if (k === 'agent') { const a = add('agent', 'a2'); a.born = clock + .3; }
    state = 'run'; screen.hidden = true;
    startWeek(week + 1, UPS[k].lines || 0);
    root.focus({ preventScroll: true });
    kick();
  };

  // ранг: без красных очередей решает самая длинная очередь за игру
  const rank = () => redT < .5 ? (maxQ <= 3 ? 'Head of AI' : 'AI Transformation Lead') : redT < 8 ? 'Крепкий delivery' : 'Дошли до прода на характере';
  const stats = money => `Ответили на <strong>${answered} ${plural(answered, REQ)}</strong>${money ? `, это <strong>${answered}&nbsp;млн&nbsp;₽</strong> эффекта в год` : ''}.`;
  const record = () => {
    const rec = answered > best;
    if (rec) { best = answered; store.set('mm-flow-best', String(best)); }
    return rec;
  };
  const lose = d => {
    state = 'over'; cancel(); sel = null;
    SFX.lose();
    // перегрузка при простаивающем втором агенте – отдельный совет: дело в разводке, а не в мощности
    let k = diag(d);
    if (k === 'load' && ready(d).every(a => a.load >= 1) && by('agent').some(a => a.load < .8)) k = 'skew';
    const [why, advice] = WHY[k];
    record();
    panel(`
      <p class="fl-kicker">Проект закрыт на неделе ${week + 1} из ${WEEKS.length}</p>
      <h3 class="is-lost">${glue(DEPT[d.key].fail)}</h3>
      <p>${why} ${stats()}</p>
      <p><strong>Совет Майка:</strong> ${advice}</p>
      <div class="fl-btns">
        <button type="button" class="btn btn-blue" data-act="retry">Переиграть неделю ${week + 1}</button>
        ${week ? '<button type="button" class="btn btn-line" data-act="fresh">Сначала</button>' : '<button type="button" class="btn btn-line" data-act="learn">Пройти обучение</button>'}
      </div>`, true);
    draw();
  };
  const win = () => {
    state = 'win'; cancel(); sel = null;
    SFX.win();
    weekT = WEEKS[week].dur; paintGoal();
    drop();
    const rec = record(), title = rank();
    const msg = `Собрал AI-систему в игре на вашем сайте: ${answered} ${plural(answered, REQ)}, ранг ${title}. Хочу обсудить реальный проект.`;
    panel(`
      <p class="fl-kicker">AI работает во всей компании</p>
      <h3>${title}</h3>
      <p>${stats(true)} Самая длинная очередь – ${maxQ}${redT >= .5 ? `, красные очереди – ${Math.round(redT)}&nbsp;с` : ''}.${rec ? ' Это ваш рекорд.' : ` Рекорд: ${best}.`}</p>
      <p class="fl-note">Так я и проектирую AI-платформы: сначала данные, доступы и нагрузка, потом модель.</p>
      <div class="fl-btns">
        <button type="button" class="btn btn-blue" data-act="fresh">Ещё раз</button>
        <a class="btn btn-line" href="${TG}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Обсудить ваш проект</a>
      </div>`, true);
    draw();
  };
  const pause = () => {
    if (state !== 'run') return;
    state = 'pause'; cancel();
    panel(`
      <p class="fl-kicker">Пауза</p>
      <h3>Система ждёт</h3>
      <p>${tut ? `Обучение, шаг ${tut} из ${TUT_N}.` : `Неделя ${week + 1} из ${WEEKS.length}, осталось ${timeEl.textContent}. Ответили на ${answered} ${plural(answered, REQ)}.`}</p>
      <div class="fl-btns"><button type="button" class="btn btn-blue" data-act="resume">Продолжить</button></div>`, true);
  };
  const resume = () => { state = 'run'; screen.hidden = true; placeAll(); root.focus({ preventScroll: true }); kick(); };

  const ACT = {
    learn: () => play(true),
    fresh: () => play(false),
    cont: retry,
    retry,
    resume,
    next: () => { if (state !== 'run') return; if (tut === 3 || tut === 5) { tut++; coach(); } else if (tut === TUT_N) finishTut(); },
    skip: () => { if (state === 'run') finishTut(); },
  };
  screen.addEventListener('click', e => {
    const up_ = e.target.closest('[data-up]');
    if (up_) return upgrade(up_.dataset.up);
    const b = e.target.closest('[data-act]');
    if (b) ACT[b.dataset.act]?.();
  });
  coachEl.addEventListener('click', e => { if (e.target.closest('[data-act="next"]')) ACT.next(); });
  skipBtn.addEventListener('click', ACT.skip);
  pauseBtn.addEventListener('click', () => state === 'run' ? pause() : state === 'pause' && resume());
  addEventListener('keydown', e => {
    if ((e.code === 'Escape' || e.code === 'KeyP') && state === 'run' && root.contains(document.activeElement)) pause();
  });

  // ---------- loop ----------
  let raf = 0, last = 0, visible = false;
  const wants = () => visible && !document.hidden && (state === 'run' || (state === 'intro' && !still));
  const loop = now => {
    raf = 0;
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    update(dt);
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
      if (!visible) pause();
      kick();
    }, { threshold: .3 }).observe(root);
  } else { visible = true; }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else kick(); });

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(cv); else addEventListener('resize', resize);
  demoSet();
  resize();
  if (document.fonts) document.fonts.ready.then(() => { draw(); placeAll(); });
  intro();
  kick();
})();

// Игра "Соберите AI-систему": схема-поток в духе Mini Metro. Чёрные линии и узлы, красный – только для пробок.
// Игрок тянет линии: отдел – AI-агент – данные. Запрос бежит точкой от отдела к агенту, агент сходит в данные и вернёт ответ.
// Не хватает линии или мощности – у отдела копится очередь; красная очередь держится долго – отдел возвращается к Excel.
// 4 недели, после каждой выбор усиления. Тексты и баланс – в SRC, DEPT, WEEKS, UPS, WHY.
(() => {
  const root = document.querySelector('.fl');
  if (!root) return;
  const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
  const hud = root.querySelector('.fl-hud');
  const weekEl = hud.querySelector('.fl-wname'), barEl = hud.querySelector('.fl-bar');
  const linksEl = hud.querySelector('.fl-links'), rubEl = hud.querySelector('.fl-rub');
  const screen = root.querySelector('.fl-screen');
  const banner = root.querySelector('.fl-banner');
  const tipEl = root.querySelector('.fl-tip');
  const pauseBtn = root.querySelector('.fl-pause'), soundBtn = root.querySelector('.fl-sound');
  const TG = 'https://t.me/mike_melanin';
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const TAU = Math.PI * 2, RED = '#E5484D';
  let C = {};
  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    C = { paper: v('--paper'), card: v('--card'), ink: v('--ink'), muted: v('--muted'), line: v('--line'), chip: v('--chip') };
  };
  readColors();

  // ---------- content ----------
  // падежи нужны подсказкам: "доступ к базе знаний", "свяжите продажи и CRM"
  const SRC = {
    kb: { name: 'База знаний', shape: 'sq', dat: 'базе знаний', acc: 'базу знаний' },
    crm: { name: 'CRM', shape: 'tr', dat: 'CRM', acc: 'CRM' },
    erp: { name: '1С', shape: 'di', dat: '1С', acc: '1С' },
    doc: { name: 'Договоры', shape: 'cr', dat: 'договорам', acc: 'договоры' },
  };
  // needs – из каких данных отдел спрашивает и как часто; fail – заголовок проигрыша
  const DEPT = {
    sup: { name: 'Поддержка', gen: 'поддержки', acc: 'поддержку', needs: { kb: 3, crm: 1 }, fail: 'Поддержка вернулась к ручным ответам' },
    sal: { name: 'Продажи', gen: 'продаж', acc: 'продажи', needs: { crm: 3, kb: 1 }, fail: 'Продажи вернулись к таблицам' },
    fin: { name: 'Финансы', gen: 'финансов', acc: 'финансы', needs: { erp: 3, crm: 1 }, fail: 'Финансы вернулись к Excel' },
    law: { name: 'Юристы', gen: 'юристов', acc: 'юристов', needs: { doc: 3, kb: 1 }, fail: 'Юристы вернулись к бумаге' },
  };
  // каждая неделя добавляет отдел и его данные; dur – секунды
  const WEEKS = [
    { name: 'Пилот', dept: 'sup', src: 'kb', dur: 20, title: 'Пилот в поддержке', text: 'Ответы клиентам из базы знаний' },
    { name: 'Продажи', dept: 'sal', src: 'crm', dur: 24, title: 'Подключаем продажи', text: 'Продажам нужна CRM' },
    { name: 'Финансы', dept: 'fin', src: 'erp', dur: 24, title: 'Подключаем финансы', text: 'Финансам нужны данные из 1С' },
    { name: 'Вся компания', dept: 'law', src: 'doc', dur: 26, title: 'AI во всей компании', text: 'Юристам нужны договоры' },
  ];
  const UPS = {
    gpu: { name: 'Сервер мощнее', text: 'Каждый агент держит на 2 запроса больше', max: 2 },
    agent: { name: 'Второй AI\u2011агент', text: 'Ещё один поток запросов и 3 линии к нему', max: 1 },
    cache: { name: 'Кэш ответов', text: 'Треть вопросов агент отвечает сразу, без похода в данные', max: 1 },
    links: { name: '+3 линии', text: 'Подключите отделы к данным вторым маршрутом', max: 2 },
  };
  // почему отдел сдался и что посоветовал бы Майк
  const WHY = {
    off: ['Отдел так и не подключили к AI\u2011агенту.', 'Пилот без пользователей не взлетает. Подключайте отдел с первого дня и спрашивайте, что ему мешает.'],
    data: ['Агент не видел нужных данных, ответов не было.', 'Сначала карта данных и доступы, потом модель. Агент без нужных данных – просто чат-бот.'],
    load: ['Агент не успевал, очередь росла быстрее ответов.', 'Нагрузку на масштабе считайте до запуска. Мощность и второго агента закладывайте заранее, а частые ответы кэшируйте.'],
  };

  // ---------- balance ----------
  const QMAX = 5;            // столько запросов отдел ждёт спокойно, дальше очередь краснеет
  const OVER_T = 8;          // секунд красной очереди до проигрыша
  const CAP = 3;             // запросов, которые агент держит одновременно
  const THINK = .35, THINK2 = .2;
  const CACHE = .33;
  const GAP = .22;           // пауза между запросами одного отдела на линии
  const TRIP = .8;           // секунд на пролёт между колонками
  // запросов в секунду от одного отдела: растёт с неделями и к концу недели
  const rate = () => demo ? .42 : tut ? .3 : (.34 + .09 * week) * (1 + .5 * weekT / WEEKS[week].dur);

  // ---------- sound ----------
  let ac = null, muted = false;
  try { muted = localStorage.getItem('mm-flow-muted') === '1'; } catch {}
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
    try { localStorage.setItem('mm-flow-muted', muted ? '1' : '0'); } catch {}
  });

  // ---------- state ----------
  // state: intro – демо-схема под заставкой, run, pick – выбор усиления, pause, over, win
  let state = 'intro', demo = true;
  let nodes = [], links = [], dots = [], ghosts = [];
  let week = 0, weekT = 0, tut = 0, free = 0, cap = CAP, cacheOn = false;
  let answered = 0, spawned = 0, redT = 0, maxQ = 0, clock = 0, used = {}, warned = 0, hintT = 0;
  let sel = null, drag = null, tap = null, hover = null;
  let best = 0;
  try { best = +localStorage.getItem('mm-flow-best') || 0; } catch {}

  const by = kind => nodes.filter(n => n.kind === kind);
  const src = key => nodes.find(n => n.kind === 'src' && n.key === key);
  const linkOf = (a, b) => links.find(l => (l.ag === a && l.n === b) || (l.ag === b && l.n === a));
  const other = (l, n) => l.ag === n ? l.n : l.ag;
  // соединять можно только через агента: отдел – агент или агент – данные
  const canPair = (a, b) => a !== b && (a.kind === 'agent') !== (b.kind === 'agent');
  const add = (kind, key) => {
    const n = { kind, key, x: 0, y: 0, tx: 0, ty: 0, born: clock, q: [], over: 0, pulse: 0, busy: 0, jobs: [], spawnT: 1.2, gapT: 0, spin: 0, red: false };
    nodes.push(n);
    return n;
  };
  const dIdx = n => Object.keys(DEPT).indexOf(n.key);

  // ---------- size & layout ----------
  // Широкий экран: данные слева, агенты по центру, отделы справа. Телефон: данные сверху, отделы снизу.
  // tight – телефон боком: высоты мало, подписи уходят вбок от узлов
  let W = 800, H = 480, dpr = 1, land = true, tight = false, R = 18, RA = 24, speed = 300, LW = 3, FS = 12;
  const resize = () => {
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(3, devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    land = W / H > 1.05;
    tight = land && H < 360;
    R = tight ? 12 : Math.max(14, Math.min(22, Math.min(W, H) * .04));
    RA = R * 1.35;
    LW = R > 16 ? 3.5 : 3;
    FS = R >= 19 ? 13 : 12;
    layout(true);
    links.forEach(curve);
    draw();
  };
  const layout = snap => {
    const lanes = { src: by('src'), agent: by('agent'), dept: by('dept') };
    const along = { src: 0, agent: .5, dept: 1 };
    let a0, a1, c0, c1;
    if (tight) { a0 = Math.max(W * .13, 104); a1 = W - 132; c0 = 54; c1 = H - 46; }
    else if (land) { a0 = W * .13; a1 = W * .84; c0 = 70; c1 = H - 58; }
    else { a0 = 102; a1 = H - 100; c0 = 6; c1 = W - 30; }
    speed = (a1 - a0) / 2 / TRIP;
    for (const kind in lanes) lanes[kind].forEach((n, i, all) => {
      const f = along[kind], c = c0 + (c1 - c0) * (i + .5) / all.length;
      const a = a0 + (a1 - a0) * f;
      n.tx = land ? a : c; n.ty = land ? c : a;
      if (snap || !n.x) { n.x = n.tx; n.y = n.ty; }
    });
  };

  // ---------- curves ----------
  // линия – мягкая S-кривая вдоль потока, по ней точки бегут с постоянной скоростью
  const N = 22;
  const curve = l => {
    const a = l.ag, b = l.n, dx = b.x - a.x, dy = b.y - a.y;
    const k1 = land ? .5 : .3, k2 = land ? .3 : .5;
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
  const send = (l, from, kind, r) => dots.push({ l, from, kind, r, t: 0, dur: Math.max(.3, l.len / speed) });
  // запрос вернулся в очередь: линию убрали, пока он был в пути
  const requeue = (r, held) => {
    if (held && r.ag) r.ag.busy--;
    r.ag = null;
    if (nodes.includes(r.d)) r.d.q.unshift(r);
  };
  const ask = d => {
    const pool = Object.entries(DEPT[d.key].needs).filter(([s]) => src(s));
    let x = Math.random() * pool.reduce((s, [, w]) => s + w, 0);
    for (const [s, w] of pool) if ((x -= w) < 0) return s;
    return pool[0][0];
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
      paintHud();
    }
  };
  const dispatch = d => {
    const ags = links.filter(l => l.n === d).map(l => l.ag);
    let pick = null, at = -1;
    // берём первый запрос, для которого есть свободный агент с доступом к нужным данным
    for (let i = 0; i < Math.min(d.q.length, 8) && !pick; i++) {
      const s = src(d.q[i].s);
      for (const a of ags) if (a.busy < cap && linkOf(a, s) && (!pick || a.busy < pick.busy)) { pick = a; at = i; }
    }
    if (!pick) return;
    const [r] = d.q.splice(at, 1);
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
        if (!((demo || tut) && d.q.length >= (demo ? 3 : QMAX))) { d.q.push({ s: ask(d), d, ag: null }); if (!demo) spawned++; }
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
    for (const a of by('agent')) {
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

    let anyRed = false;
    for (const d of by('dept')) {
      const red = !tut && d.q.length > QMAX;
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
    paintBar();
  };

  // ---------- hints ----------
  // ghost – пунктир, который сам тянется от узла к узлу и показывает, что сделать
  let ghost = null, tipText = '', tipLock = 0;
  const tip = (text, alert = false, hold = 0) => {
    if (tipLock > clock && !hold) return;
    if (hold) tipLock = clock + hold;
    if (text === tipText) return;
    tipText = text;
    tipEl.classList.toggle('is-on', !!text);
    tipEl.classList.toggle('is-alert', alert);
    if (text) tipEl.textContent = text;
  };
  const nearAgent = n => by('agent').reduce((m, a) => !m || Math.hypot(a.x - n.x, a.y - n.y) < Math.hypot(m.x - n.x, m.y - n.y) ? a : m, null);
  const hints = () => {
    ghost = null;
    const ags = by('agent');
    const age = n => clock - n.born;
    for (const d of by('dept')) if (!links.some(l => l.n === d) && (age(d) > 2.5 || tut)) {
      ghost = [d, nearAgent(d)];
      return tip(`Протяните линию от ${DEPT[d.key].gen} к AI\u2011агенту`);
    }
    // отделу нужны данные, до которых его агенты не достают
    for (const d of by('dept')) {
      const mine = links.filter(l => l.n === d).map(l => l.ag);
      const s = d.q.map(r => src(r.s)).find(s => s && !mine.some(a => linkOf(a, s)));
      if (!s) continue;
      if (!links.some(l => l.n === s)) { ghost = [mine[0] || ags[0], s]; return tip(`Протяните линию от AI\u2011агента к ${SRC[s.key].dat}`); }
      if (age(s) > 2) return tip(`Свяжите ${DEPT[d.key].acc} и ${SRC[s.key].acc} через одного агента`);
    }
    for (const s of by('src')) if (!links.some(l => l.n === s) && (age(s) > 3 || tut)) {
      ghost = [nearAgent(s), s];
      return tip(`Протяните линию от AI\u2011агента к ${SRC[s.key].dat}`);
    }
    for (const a of ags) if (!links.some(l => l.ag === a) && age(a) > 1) { ghost = [a, by('dept')[0]]; return tip('Подключите второго агента к отделу и данным'); }
    if (by('dept').some(d => d.red)) return tip('Агент не успевает – очередь растёт', true);
    tip('');
  };
  const tutCheck = () => {
    if (!tut) return;
    const a = by('agent')[0], d = by('dept')[0], s = by('src')[0];
    if (linkOf(a, d) && linkOf(a, s)) {
      tut = 0; hintT = 0;
      tip('Запросы пошли. Где очередь краснеет – там узко', false, 3.5);
      return;
    }
    hints();
  };

  // ---------- actions ----------
  const flash = el => { el.classList.remove('is-shake'); void el.offsetWidth; el.classList.add('is-shake'); };
  const connect = (a, b) => {
    if (!canPair(a, b)) {
      SFX.no();
      return tip(a.kind === 'agent' ? 'Агенты между собой не соединяются' : 'Отделы и данные соединяются через AI\u2011агента', true, 2.6);
    }
    if (linkOf(a, b)) return;
    if (free <= 0) {
      SFX.no(); flash(linksEl);
      return tip('Линии закончились. Тапните по лишней линии, чтобы убрать её', true, 3);
    }
    const ag = a.kind === 'agent' ? a : b, l = { ag, n: ag === a ? b : a, born: clock };
    curve(l);
    links.push(l);
    free--;
    SFX.link(); paintHud(); tutCheck();
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
    SFX.cut(); paintHud(); hintT = 0;
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
    else if (land) text(SRC[n.key].name, n.x, n.y + R + 15);
    else text(SRC[n.key].name, n.x, n.y - R - 13);
  };
  const drawAgent = (n, i, all) => {
    const s = pop(n), r = RA * s;
    if (n.pulse) ring(n, r + 8 + (1 - n.pulse) * 10, n.pulse * .4);
    // кольцо загрузки: сколько запросов агент держит из возможных
    const seg = TAU / cap, gap = Math.min(.22, seg * .25);
    ctx.lineWidth = 3.2; ctx.lineCap = 'butt';
    for (let k = 0; k < cap; k++) {
      ctx.strokeStyle = k < n.busy ? C.ink : C.line;
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
    const name = all.length > 1 ? `AI-агент ${i + 1}` : 'AI-агент';
    if (land) text(name, n.x, n.y + r + (tight ? 16 : 22), 'center', C.muted, tight ? 11 : FS);
    else text(name, n.x + r + 12, n.y, 'left', C.muted);
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
    if (s < .6) return;
    if (tight) text(DEPT[n.key].name, n.x + r + 45, n.y, 'left');
    else text(DEPT[n.key].name, n.x, n.y + r + (land ? 15 : 14));
    // очередь: сетка 3 x 4 справа от отдела, лишнее – числом над ней
    const q = n.q, gx = n.x + r + (n.over > 0 ? 15 : 9), gy = n.y - 13.5;
    for (let i = 0; i < Math.min(q.length, 12); i++) {
      const x = gx + (i % 3) * 9, y = gy + Math.floor(i / 3) * 9;
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
    ctx.strokeStyle = ok ? C.ink : RED; ctx.globalAlpha = .7;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(x, y); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    if (b) ring(b, (b.kind === 'agent' ? RA : R) + 9, .9, ok ? C.ink : RED, 2.5);
    else { ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); }
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
  const REQ = ['запрос', 'запроса', 'запросов'];
  const paintHud = () => {
    weekEl.textContent = `Неделя ${week + 1} из ${WEEKS.length} · ${WEEKS[week].name}`;
    linksEl.querySelector('b').textContent = String(free);
    linksEl.classList.toggle('is-zero', free <= 0);
    rubEl.querySelector('b').textContent = String(answered);
    paintBar();
  };
  const paintBar = () => barEl.style.setProperty('--p', Math.min(1, weekT / WEEKS[week].dur).toFixed(3));

  let bannerT = 0;
  const showBanner = (small, big, line) => {
    banner.innerHTML = `<small>${small}</small><strong>${big}</strong>${line ? `<span>${line}</span>` : ''}`;
    banner.classList.add('is-on');
    clearTimeout(bannerT);
    bannerT = setTimeout(() => banner.classList.remove('is-on'), 2200);
  };

  const panel = (html, focus) => {
    screen.innerHTML = `<div class="fl-panel">${html}</div>`;
    screen.hidden = false;
    hud.hidden = state === 'intro';
    tipLock = 0; tip('');
    if (focus) screen.querySelector('button')?.focus({ preventScroll: true });
  };

  const intro = () => panel(`
    <p class="fl-kicker">4 недели · 2 минуты</p>
    <h3>Соберите AI\u2011систему</h3>
    <p class="fl-sub">Отделы шлют запросы, AI\u2011агент отвечает по данным компании. Проведите линии от отделов к агенту и от агента к данным.</p>
    <ul class="fl-keys"><li><kbd>${coarse ? 'Проведите пальцем' : 'Тяните мышью'}</kbd> от узла к узлу – линия</li><li><kbd>${coarse ? 'Тап' : 'Клик'}</kbd> по линии – убрать</li></ul>
    <div class="fl-btns"><button type="button" class="btn btn-blue" data-act="play">Играть</button></div>
    ${best ? `<p class="fl-best">Ваш рекорд: ${best} ${plural(best, REQ)}</p>` : ''}`);

  // демо под заставкой: вся схема уже собрана и работает
  const demoSet = () => {
    demo = true; state = 'intro';
    nodes = []; links = []; dots = []; ghosts = []; cap = 4; cacheOn = false; tut = 0; clock = 10;
    const a1 = add('agent', 'a1'), a2 = add('agent', 'a2');
    const n = {};
    WEEKS.forEach(w => { n[w.dept] = add('dept', w.dept); n[w.src] = add('src', w.src); });
    [[a1, 'sup'], [a1, 'sal'], [a1, 'kb'], [a1, 'crm'], [a2, 'fin'], [a2, 'law'], [a2, 'erp'], [a2, 'doc'], [a2, 'kb'], [a2, 'crm']]
      .forEach(([ag, k]) => links.push({ ag, n: n[k], born: -1 }));
    nodes.forEach(n => { n.born = -1; n.spawnT = Math.random() * 2; });
    layout(true);
    links.forEach(curve);
  };

  const play = () => {
    demo = false; state = 'run';
    nodes = []; links = []; dots = []; ghosts = []; sel = null; drag = null; tap = null;
    week = 0; weekT = 0; tut = 1; free = 2; cap = CAP; cacheOn = false;
    answered = 0; spawned = 0; redT = 0; maxQ = 0; clock = 0; used = {}; warned = 0; hintT = 0; tipLock = 0;
    add('agent', 'a1');
    addWeek(0);
    screen.hidden = true; hud.hidden = false;
    audio();
    root.focus({ preventScroll: true });
    // игра целиком в кадре и не под шапкой сайта
    const r = root.getBoundingClientRect(), bar = document.querySelector('.topbar')?.getBoundingClientRect().bottom || 0;
    if (r.top < bar + 4 || r.bottom > innerHeight) scrollBy({ top: r.top - bar - Math.max(8, (innerHeight - bar - r.height) / 2), behavior: still ? 'auto' : 'smooth' });
    tutCheck();
    kick();
  };
  const addWeek = i => {
    const w = WEEKS[i];
    week = i; weekT = 0;
    add('dept', w.dept); add('src', w.src);
    if (i) { free += 2; SFX.week(); }
    layout(false);
    links.forEach(curve);
    paintHud();
    showBanner(`Неделя ${i + 1} из ${WEEKS.length}`, w.title, w.text);
    hintT = 0;
  };
  const endWeek = () => {
    if (week === WEEKS.length - 1) return win();
    state = 'pick'; cancel(); sel = null;
    const pool = Object.keys(UPS).filter(k => (used[k] || 0) < UPS[k].max);
    const two = pool.sort(() => Math.random() - .5).slice(0, 2);
    const next = WEEKS[week + 1];
    SFX.week();
    panel(`
      <p class="fl-kicker">Неделя ${week + 1} пройдена · ${answered} ${plural(answered, REQ)}</p>
      <h3>Чем усилить систему?</h3>
      <p>Дальше: ${/^[А-ЯЁ][а-яё]/.test(next.title) ? next.title[0].toLowerCase() + next.title.slice(1) : next.title}. Запросов станет больше.</p>
      <div class="fl-picks">${two.map(k => `<button type="button" data-up="${k}"><b>${UPS[k].name}</b><span>${UPS[k].text}</span></button>`).join('')}</div>`, true);
  };
  const upgrade = k => {
    used[k] = (used[k] || 0) + 1;
    if (k === 'gpu') cap += 2;
    else if (k === 'cache') cacheOn = true;
    else if (k === 'links') free += 3;
    else if (k === 'agent') { const a = add('agent', 'a2'); a.born = clock + .3; free += 3; }
    state = 'run'; screen.hidden = true;
    addWeek(week + 1);
    root.focus({ preventScroll: true });
    kick();
  };

  // ранг: без красных очередей решает самая длинная очередь за игру
  const rank = () => redT < .5 ? (maxQ <= 3 ? 'Head of AI' : 'AI Transformation Lead') : redT < 8 ? 'Крепкий delivery' : 'Дошли до прода на характере';
  const stats = () => `Ответили на <strong>${answered} ${plural(answered, REQ)}</strong>, это <strong>${answered}&nbsp;млн&nbsp;₽</strong> эффекта в год.`;
  const record = () => {
    const rec = answered > best;
    if (rec) { best = answered; try { localStorage.setItem('mm-flow-best', String(best)); } catch {} }
    return rec;
  };
  const lose = d => {
    state = 'over'; cancel(); sel = null;
    SFX.lose();
    const blocked = d.q.filter(r => !links.some(l => l.n === d && linkOf(l.ag, src(r.s)))).length;
    const [why, advice] = !links.some(l => l.n === d) ? WHY.off : blocked > d.q.length / 2 ? WHY.data : WHY.load;
    record();
    panel(`
      <p class="fl-kicker">Проект закрыт на неделе ${week + 1} из ${WEEKS.length}</p>
      <h3 class="is-lost">${DEPT[d.key].fail}</h3>
      <p>${why} ${stats()}</p>
      <p><strong>Совет Майка:</strong> ${advice}</p>
      <div class="fl-btns"><button type="button" class="btn btn-blue" data-act="play">Ещё раз</button></div>`, true);
    draw();
  };
  const win = () => {
    state = 'win'; cancel(); sel = null;
    SFX.win();
    const rec = record(), title = rank();
    const msg = `Собрал AI-систему в игре на вашем сайте: ${answered} ${plural(answered, REQ)}, ранг ${title}. Хочу обсудить реальный проект.`;
    panel(`
      <p class="fl-kicker">AI работает во всей компании</p>
      <h3>${title}</h3>
      <p>${stats()} Самая длинная очередь – ${maxQ}${redT >= .5 ? `, красные очереди – ${Math.round(redT)}&nbsp;с` : ''}.${rec ? ' Это ваш рекорд.' : ` Рекорд: ${best}.`}</p>
      <p class="fl-note">Так я и проектирую AI-платформы: сначала данные, доступы и нагрузка, потом модель.</p>
      <div class="fl-btns">
        <button type="button" class="btn btn-blue" data-act="play">Ещё раз</button>
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
      <p>Неделя ${week + 1} из ${WEEKS.length}, ответили на ${answered} ${plural(answered, REQ)}.</p>
      <div class="fl-btns"><button type="button" class="btn btn-blue" data-act="resume">Продолжить</button></div>`, true);
  };
  const resume = () => { state = 'run'; screen.hidden = true; root.focus({ preventScroll: true }); kick(); };

  screen.addEventListener('click', e => {
    const up_ = e.target.closest('[data-up]');
    if (up_) return upgrade(up_.dataset.up);
    const b = e.target.closest('[data-act]');
    if (b) ({ play, resume })[b.dataset.act]?.();
  });
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
  if (document.fonts) document.fonts.ready.then(() => draw());
  intro();
  kick();
})();

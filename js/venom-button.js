// Venom-кнопка: чёрная глянцевая пилюля, которая тянется к курсору щупальцами.
// Порт бесплатного React-компонента VenomButton (nexus-ui.com) на чистый JS: шейдер, физика и отрисовка
// как в исходнике. Отличия: сцена – прозрачные холсты вокруг кнопки прямо на странице, цикл засыпает,
// когда всё улеглось, шейдер пропускает далёкие куски щупалец (картинка та же), а при сбое WebGL
// кнопка остаётся обычной CSS-пилюлей. Разметка:
// <span class="venom" data-venom><a class="venom-btn" href="...">...</a></span>
// Настройки через data-атрибуты обёртки: data-strands, data-sense, data-reach,
// data-release, data-cursor="glove|native", data-autoplay.
(() => {
  // перчатка в рамке 32 x 36, кончик пальца (точка курсора) в (11.5, 1)
  const GLOVE = 'M9 14V3.6a2.5 2.5 0 0 1 5 0V12.2a2.2 2.2 0 0 1 4.4 0.4a2.2 2.2 0 0 1 4.4 0.8a2.2 2.2 0 0 1 4.2 1.6V22c0 4-2.6 7-6 7H14.6c-3 0-5.4-1.8-6.6-4.4L4.1 18.6a2.3 2.3 0 0 1 3.6-2.8L9 17.4Z';
  const GLOVE_LINES = 'M18.4 12.6V17.2M22.8 13.4V17.6M14 12.2V16.6';
  const CUFF = 'M12.6 28.6h12.2a1.6 1.6 0 0 1 1.6 1.6v3.4a1.6 1.6 0 0 1-1.6 1.6H12.6a1.6 1.6 0 0 1-1.6-1.6v-3.4a1.6 1.6 0 0 1 1.6-1.6Z';
  const CUFF_LINES = 'M15.4 29.2v5.4M18.7 29.2v5.4M22 29.2v5.4';
  const HOT_X = 11.5, HOT_Y = 1, SC = 1.55;
  // точки хвата: кончик, три костяшки, большой палец, сустав, ладонь, манжета
  const GRIPS = [[11.5, 3.6], [16.2, 13.2], [20.6, 14], [24.9, 15.8], [5.6, 18], [11.5, 10], [18.5, 22], [18.7, 31.6]];
  const BANDS = [[0, 5.6], [0, 4.6], [0, 4.6], [0, 4.4], [Math.PI / 4, 4.8], [0, 5.6], [0.08, 11], [0, 15]];
  // с системным курсором руки нет – щупальца собираются вокруг его кончика
  const NATIVE_GRIPS = [[0, 0], [5, 7], [-4, 6], [8, 13], [-2, 12], [3, 3], [6, 18], [0, 16]];
  const NATIVE_BANDS = NATIVE_GRIPS.map(() => [0, 0]);
  const MS = 7, NP = 12, MSPK = 8, MDROP = 6;
  const PADX = 300, PADY = 220;      // сколько места вокруг кнопки занимает сцена
  // путь призрачной перчатки для autoplay: доли сцены и секунды на отрезок
  const GHOST = [[0.5, 0.8, 1.1], [0.36, 0.74, 1.0], [0.6, 0.82, 0.9], [0.8, 0.64, 0.55], [0.98, 0.97, 1.4],
    [0.86, 0.28, 1.1], [0.7, 0.18, 1.0], [0.5, 0.12, 1.0], [0.3, 0.2, 0.55], [0.03, 0.04, 1.4],
    [0.16, 0.58, 1.1], [0.32, 0.86, 1.0]];
  const GHOST_T = GHOST.reduce((a, p) => a + p[2], 0);

  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  // Одно поле расстояний: пилюля, бугор к руке, щупальца (конусные капсулы), шипы и капли, всё
  // склеено плавным минимумом. Поле несёт и толщину, чтобы каждая часть имела свой круглый профиль.
  // Цвет – чёрный лак, в котором отражается студия: софтбокс сверху, окно слева, светлый пол, два блика.
  const FRAG = `precision highp float;
uniform vec2 uRes;
uniform float uDpr;
uniform vec4 uPill;
uniform vec4 uPts[${MS * NP}];
uniform vec4 uBox[${MS}];
uniform float uCount;
uniform vec4 uSpk[${MSPK}];
uniform vec4 uSpkR[${MSPK}];
uniform vec4 uDrop[${MDROP}];
uniform vec4 uMound;
uniform vec2 uMoundR;
uniform float uLean;

vec2 smin(vec2 a, vec2 b, float k){
  float h = clamp(0.5 + 0.5 * (b.x - a.x) / k, 0.0, 1.0);
  return vec2(mix(b.x, a.x, h) - k * h * (1.0 - h), mix(b.y, a.y, h));
}
float cone(vec2 p, vec2 a, vec2 b, float ra, float rb, out float r){
  vec2 pb = b - a;
  p -= a;
  float h = dot(pb, pb);
  float t = clamp(dot(p, pb) / (h + 1e-4), 0.0, 1.0);
  r = mix(ra, rb, t);
  float bb = ra - rb;
  if (h <= bb * bb + 1e-3) return ra > rb ? length(p) - ra : length(p - pb) - rb;
  vec2 q = vec2(dot(p, vec2(pb.y, -pb.x)), dot(p, pb)) / h;
  q.x = abs(q.x);
  vec2 c = vec2(sqrt(h - bb * bb), bb);
  float k = c.x * q.y - c.y * q.x;
  float m = dot(c, q);
  float n = dot(q, q);
  if (k < 0.0) return sqrt(h * n) - ra;
  if (k > c.x) return sqrt(h * (n + 1.0 - 2.0 * q.y)) - rb;
  return m - ra;
}
vec2 field(vec2 p){
  float rr = uPill.w * 0.5;
  vec2 c = vec2(uPill.x + uPill.z * 0.5, uPill.y + rr);
  float a = max(0.0, uPill.z * 0.5 - rr);
  vec2 q = p - c;
  vec2 body = vec2(length(q - vec2(clamp(q.x, -a, a), 0.0)) - rr, rr);
  float r;
  if (uMoundR.x > 0.01) {
    float dm = cone(p, uMound.xy, uMound.zw, uMoundR.x, uMoundR.y, r);
    body = smin(body, vec2(dm, rr), 14.0);
  }
  vec2 st = vec2(1e5, 2.0);
  for (int s = 0; s < ${MS}; s++) {
    if (float(s) >= uCount) break;
    // куски дальше 40px ни на что не влияют – пропускаем, чтобы не греть видеокарту
    vec4 bx = uBox[s];
    if (p.x < bx.x || p.x > bx.z || p.y < bx.y || p.y > bx.w) continue;
    vec2 one = vec2(1e5, 2.0);
    for (int i = 0; i < ${NP - 1}; i++) {
      vec4 A = uPts[s * ${NP} + i];
      vec4 B = uPts[s * ${NP} + i + 1];
      vec2 dm = p - (A.xy + B.xy) * 0.5;
      float R = length(B.xy - A.xy) * 0.5 + max(A.z, B.z) + 40.0;
      if (dot(dm, dm) > R * R) continue;
      float d = cone(p, A.xy, B.xy, A.z, B.z, r);
      if (d < one.x) one = vec2(d, r + 0.3);
    }
    st = smin(st, one, 3.5);
  }
  for (int k = 0; k < ${MSPK}; k++) {
    if (uSpkR[k].y < 0.5) continue;
    float d = cone(p, uSpk[k].xy, uSpk[k].zw, uSpkR[k].x, 0.35, r);
    st = smin(st, vec2(d, r + 1.0), 3.0);
  }
  for (int k = 0; k < ${MDROP}; k++) {
    if (uDrop[k].w < 0.5) continue;
    st = smin(st, vec2(length(p - uDrop[k].xy) - uDrop[k].z, uDrop[k].z), 5.0);
  }
  vec2 res = smin(body, st, 11.0);
  res.y = max(res.y, body.y * clamp(-body.x / 6.0, 0.0, 1.0));
  return res;
}
float dist(vec2 p){ return field(p).x; }

float env(vec3 R){
  R.x += uLean * 0.18;
  float up = -R.y;
  float e = 0.015;
  e += smoothstep(0.3, 0.5, up) * smoothstep(0.75, 0.55, up) * smoothstep(0.8, 0.5, abs(R.x)) * 2.6;
  e += smoothstep(0.8, 0.95, up) * 0.6;
  e += smoothstep(-0.5, -0.7, R.x) * smoothstep(0.5, 0.25, abs(R.y)) * 1.1;
  e += smoothstep(0.6, 0.85, R.x) * smoothstep(0.6, 0.2, abs(R.y)) * 0.5;
  e += smoothstep(0.25, 0.7, R.y) * 1.25;
  return e;
}

void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 f = field(p);
  float d = f.x;
  float aa = clamp(0.5 - d * uDpr, 0.0, 1.0);

  // мягкая тень вниз и чуть вправо; дальше 26px от слизи её всё равно нет
  float sh = 0.0;
  if (aa < 1.0 && d < 26.0) {
    float ds = dist(p - vec2(2.0, 9.0));
    sh = (1.0 - smoothstep(-4.0, 16.0, ds)) * 0.2;
  }

  vec3 col = vec3(0.0);
  if (aa > 0.0) {
    float B = max(f.y, 0.8);
    float s = clamp(-d, 0.0, B);
    float z = sqrt(max(1e-3, s * (2.0 * B - s)));
    float slope = min((B - s) / z, 6.0);
    float e = 0.5;
    vec2 g = vec2(dist(p + vec2(e, 0.0)) - d, dist(p + vec2(0.0, e)) - d);
    g = length(g) > 1e-6 ? normalize(g) : vec2(0.0);
    vec3 n = normalize(vec3(g * slope, 1.0));
    vec3 R = reflect(vec3(0.0, 0.0, -1.0), n);
    float fres = 0.05 + 0.95 * pow(1.0 - max(n.z, 0.0), 3.0);
    col = vec3(0.008, 0.008, 0.01) + min(env(R) * fres, 1.0) * vec3(0.93, 0.94, 0.97);
    col += pow(max(dot(R, normalize(vec3(-0.35, -0.75, 0.56))), 0.0), 70.0) * 1.2;
    col += pow(max(dot(R, normalize(vec3(0.55, -0.35, 0.76))), 0.0), 140.0) * 0.55;
  }
  float alpha = aa + (1.0 - aa) * sh;
  gl_FragColor = vec4(col * aa, alpha);
}`;

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  const live = new Set();
  const syncCursor = () => document.documentElement.classList.toggle('venom-nocursor', [...live].some(v => v.hide));

  function init(wrap) {
    if (wrap.__venom) return;
    const btn = wrap.querySelector('.venom-btn');
    if (!btn) return;
    const ds = wrap.dataset;
    const opt = {
      strands: clamp(Math.round(+ds.strands || 7), 2, MS),
      sense: +ds.sense || 290, reach: +ds.reach || 140, release: +ds.release || 215,
      cursor: ds.cursor === 'native' || matchMedia('(pointer: coarse)').matches ? 'native' : 'glove',
      autoplay: ds.autoplay === 'true' || ds.autoplay === ''
    };
    const { sense, reach, release } = opt;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const glove = opt.cursor === 'glove' && !reduced;

    const mk = cls => { const c = document.createElement('canvas'); c.className = 'venom-cv ' + cls; c.setAttribute('aria-hidden', 'true'); return c; };
    const cvGl = mk('venom-gl'), cvFx = mk('venom-fx'), cvHand = mk('venom-hand');
    wrap.prepend(cvGl); wrap.append(cvFx, cvHand);
    const fx = cvFx.getContext('2d'), hx = cvHand.getContext('2d');

    // ---------- WebGL ----------
    let gl = null, prog = null, quad = null, shaders = [], U = {};
    const quadData = new Float32Array(8);
    const pts = new Float32Array(MS * NP * 4), boxes = new Float32Array(MS * 4);
    const spk = new Float32Array(MSPK * 4), spkR = new Float32Array(MSPK * 4), drp = new Float32Array(MDROP * 4);
    function flat() {
      wrap.classList.remove('venom--gl'); wrap.classList.add('venom--flat');
      cvGl.style.display = 'none';
    }
    function unflat() {
      wrap.classList.remove('venom--flat'); wrap.classList.add('venom--gl');
      cvGl.style.display = '';
    }
    function setupGl() {
      shaders = [];
      // preserveDrawingBuffer: пока цикл спит, Safari не стирает нарисованную пилюлю
      gl = cvGl.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true, preserveDrawingBuffer: true });
      if (!gl) return false;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); shaders.push(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
      const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) { if (!fs) console.warn('venom shader:', gl.getShaderInfoLog(shaders[1])); return false; }
      prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
      gl.useProgram(prog);
      ['uRes', 'uDpr', 'uPill', 'uPts', 'uBox', 'uCount', 'uSpk', 'uSpkR', 'uDrop', 'uMound', 'uMoundR', 'uLean'].forEach(n => { U[n] = gl.getUniformLocation(prog, n); });
      quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.clearColor(0, 0, 0, 0);
      return true;
    }
    const glOk = setupGl();
    if (glOk) wrap.classList.add('venom--gl'); else flat();
    let dead = !glOk;
    // контекст WebGL может отняться (сон, переключение видеокарты) – ждём восстановления, а пока простая CSS-пилюля
    const onLost = e => {
      e.preventDefault(); dead = true; stop(); flat();
      setCursor(false);
      fx.clearRect(0, 0, cvFx.width, cvFx.height); hx.clearRect(0, 0, cvHand.width, cvHand.height);
    };
    const onRestored = () => { if (setupGl()) { dead = false; unflat(); reset(); fit(); } };
    cvGl.addEventListener('webglcontextlost', onLost);
    cvGl.addEventListener('webglcontextrestored', onRestored);

    // ---------- размеры ----------
    let W = 0, H = 0, dpr = 1;
    function fit() {
      dpr = Math.min(2, devicePixelRatio || 1);
      W = wrap.offsetWidth + PADX * 2; H = wrap.offsetHeight + PADY * 2;
      [cvGl, cvFx, cvHand].forEach(c => {
        c.style.left = -PADX + 'px'; c.style.top = -PADY + 'px'; c.style.width = W + 'px'; c.style.height = H + 'px';
        c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      });
      fxDirty = handDirty = false;
      measure();
      if (dead || running) return;
      if (reduced) tick(performance.now()); else start();
    }

    // пилюля в координатах сцены (холстов), мерится каждый кадр – при нажатии она сжимается
    const pill = { x: 0, y: 0, w: 0, h: 0, r: 0, ls: 0, P: 1, k: 1, sx: 0, sy: 0 };
    function measure() {
      const a = cvGl.getBoundingClientRect(), b = btn.getBoundingClientRect();
      const k = cvGl.offsetWidth ? a.width / cvGl.offsetWidth : 1;
      pill.k = k; pill.sx = a.left; pill.sy = a.top;
      pill.x = (b.left - a.left) / k; pill.y = (b.top - a.top) / k; pill.w = b.width / k; pill.h = b.height / k;
      pill.r = pill.h / 2;
      pill.ls = Math.max(0, pill.w - pill.h);
      pill.P = 2 * pill.ls + 2 * Math.PI * pill.r || 1;
    }
    // контур пилюли по длине дуги: точка и внешняя нормаль
    function at(s) {
      const { x, y, w, h, r, ls, P } = pill;
      s = ((s % P) + P) % P;
      if (s < ls) return { x: x + r + s, y, nx: 0, ny: -1 };
      s -= ls;
      if (s < Math.PI * r) { const a = -Math.PI / 2 + s / r; return { x: x + w - r + Math.cos(a) * r, y: y + r + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) }; }
      s -= Math.PI * r;
      if (s < ls) return { x: x + w - r - s, y: y + h, nx: 0, ny: 1 };
      s -= ls;
      const a = Math.PI / 2 + s / r;
      return { x: x + r + Math.cos(a) * r, y: y + r + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) };
    }
    function nearest(qx, qy) {
      const { x, w, r, ls } = pill;
      const cy = pill.y + r, cx = Math.max(x + r, Math.min(x + w - r, qx));
      const dist = Math.hypot(qx - cx, qy - cy) - r;
      let s;
      if (qx > x + w - r) s = ls + (Math.atan2(qy - cy, qx - cx) + Math.PI / 2) * r;
      else if (qx < x + r) {
        let a = Math.atan2(qy - cy, qx - cx);
        if (a < -Math.PI / 2) a += Math.PI * 2;
        s = 2 * ls + Math.PI * r + (a - Math.PI / 2) * r;
      } else s = qy < cy ? qx - (x + r) : ls + Math.PI * r + (x + w - r - qx);
      return { s, dist };
    }
    const loopDiff = (a, b) => { const P = pill.P; let d = (b - a) % P; if (d > P / 2) d -= P; if (d < -P / 2) d += P; return d; };

    // ---------- указатель ----------
    const ptr = { cx: 0, cy: 0, has: false, inside: false, last: 0 };
    let touched = false;
    // будим цикл, только если курсор в сцене или только что из неё вышел
    function wake() {
      if (running || dead || reduced || !visible || !ptr.has) return;
      const r = btn.getBoundingClientRect();
      const dx = Math.max(r.left - ptr.cx, 0, ptr.cx - r.right), dy = Math.max(r.top - ptr.cy, 0, ptr.cy - r.bottom);
      if ((dx <= PADX && dy <= PADY) || ptr.inside) start();
    }
    const onMove = e => {
      if (e.pointerType === 'touch') return;
      ptr.cx = e.clientX; ptr.cy = e.clientY; ptr.has = true;
      wake();
    };
    const onLeave = e => { if (!e.relatedTarget) { ptr.has = false; if (ptr.inside && !running) start(); } };
    const onBlur = () => { ptr.has = false; if (ptr.inside && !running) start(); };
    const onScroll = () => wake();
    if (!reduced) {
      addEventListener('pointermove', onMove, { passive: true });
      document.addEventListener('pointerout', onLeave);
      addEventListener('blur', onBlur);
      addEventListener('scroll', onScroll, { passive: true });
    }

    const me = { hide: false };
    live.add(me);
    function setCursor(hide) { if (hide !== me.hide) { me.hide = hide; syncCursor(); } }

    function ghostAt(t) {
      let u = t % GHOST_T, i = 0;
      while (u > GHOST[i][2]) { u -= GHOST[i][2]; i++; }
      const f = u / GHOST[i][2], p = k => GHOST[(k + GHOST.length) % GHOST.length];
      const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2), e = f * f * (3 - 2 * f);
      const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * e + (2 * a - 5 * b + 4 * c - d) * e * e + (-a + 3 * b - 3 * c + d) * e * e * e);
      return { x: cr(p0[0], p1[0], p2[0], p3[0]) * W, y: cr(p0[1], p1[1], p2[1], p3[1]) * H };
    }

    // ---------- состояние слизи ----------
    // idle -> seek (тянется к руке) -> grow (бросок к пальцам) -> hold -> snap
    let mode = 'idle', violentSnap = false, grow = 0, seekF = 0, list = [], webs = [];
    const spikes = [], drops = [];
    let near = { s: 0, dist: 999 }, hand = { x: -999, y: -999 }, anchor = { x: 0, y: 0 }, stretch = 0;
    // бугор – пружина с затуханием, поэтому он качается, когда щупальца отпускают
    let mound = 0, moundV = 0, moundS = 0, moundDir = { x: 0, y: 1 }, lean = 0, leanT = 0;
    const grips = glove ? GRIPS : NATIVE_GRIPS, bands = glove ? BANDS : NATIVE_BANDS;
    // насколько слизь заползла на каждую часть перчатки (0..1)
    const coat = new Float32Array(GRIPS.length);
    const gripAt = g => glove ? { x: hand.x + (g[0] - HOT_X) * SC, y: hand.y + (g[1] - HOT_Y) * SC } : { x: hand.x + g[0], y: hand.y + g[1] };

    function spawn() {
      list = [];
      const main = opt.strands, total = main * 2 - 1, root = at(near.s);
      for (let k = 0; k < total; k++) {
        const hair = k % 2 === 1, mi = Math.floor(k / 2);
        // каждое толстое щупальце берёт свой палец, волосок – место между двумя
        const g = hair
          ? [(grips[mi % grips.length][0] + grips[(mi + 1) % grips.length][0]) / 2, (grips[mi % grips.length][1] + grips[(mi + 1) % grips.length][1]) / 2]
          : grips[mi % grips.length];
        list.push({
          x: new Float32Array(NP).fill(root.x), y: new Float32Array(NP).fill(root.y),
          px: new Float32Array(NP).fill(root.x), py: new Float32Array(NP).fill(root.y),
          spread: (k / (total - 1)) * 2 - 1 + (Math.random() - 0.5) * 0.15,
          s: near.s,
          slack: 1.02 + Math.random() * (hair ? 0.2 : 0.12),
          width: hair ? 0.5 : 0.8 + Math.random() * 0.45,
          grip: g, band: hair ? [0, 0] : bands[mi % bands.length], gi: hair ? -1 : mi % grips.length,
          reachK: hair ? 0.35 : 0.55 + Math.random() * 0.4,
          ex: root.x, ey: root.y, follow: 9 + Math.random() * 8,
          seg: 0, phase: Math.random() * 10, hair
        });
      }
      webs = [];
      for (let k = 0; k < list.length - 1; k++) {
        const count = 1 + Math.floor(Math.random() * 2);
        for (let c = 0; c < count; c++) {
          const i = 3 + Math.floor(Math.random() * (NP - 5));
          const j = Math.max(2, Math.min(NP - 2, i + Math.round((Math.random() - 0.5) * 3)));
          webs.push([k, k + 1, i, j, (Math.random() - 0.5) * 5]);
        }
      }
      grow = 0;
      mode = 'seek';
    }

    function snap(violent) {
      if (mode === 'idle' || mode === 'snap') return;
      mode = 'snap'; violentSnap = violent;
      if (!violent) return;
      moundV -= 90; // тело отдёргивается
      const seen = new Set();
      for (const st of list) {
        if (st.hair) continue;
        const key = Math.round(st.s / 8);
        if (seen.has(key) || spikes.length >= MSPK) continue;
        seen.add(key);
        spikes.push({ s: st.s, tilt: (Math.random() - 0.5) * 0.8, len: 10 + Math.random() * 16, age: 0, life: 1.1 + Math.random() * 0.6 });
        if (Math.random() < 0.6 && drops.length < MDROP) {
          const i = 4 + Math.floor(Math.random() * 4), root = at(st.s);
          drops.push({ x: st.x[i], y: st.y[i], vx: (root.x - st.x[i]) * 2, vy: (root.y - st.y[i]) * 2 - 40, r: 2 + Math.random() * 2.2, age: 0 });
        }
      }
    }

    function reset() {
      mode = 'idle'; violentSnap = false; list = []; webs = []; spikes.length = drops.length = 0;
      mound = moundV = 0; seekF = stretch = 0; coat.fill(0);
    }

    // ---------- кадр: физика и отрисовка ----------
    const t0 = performance.now();
    let prev = t0, fxDirty = false, handDirty = false, frames = 0, strikes = 0, ghostOn = false;
    function tick(now) {
      const dt = Math.max(1 / 240, Math.min(0.033, (now - prev) / 1000));
      prev = now;
      if (!W || !H) return;
      measure();
      const time = (now - t0) / 1000;

      if (ptr.has) {
        const x = (ptr.cx - pill.sx) / pill.k, y = (ptr.cy - pill.sy) / pill.k;
        ptr.inside = x >= 0 && y >= 0 && x <= W && y <= H;
        if (ptr.inside) { touched = true; ptr.last = now; hand = { x, y }; }
      } else ptr.inside = false;
      const ghost = ghostOn = opt.autoplay && !reduced && (!touched || (!ptr.inside && now - ptr.last > 2500));
      let isLive = ptr.inside;
      if (ghost) { hand = ghostAt(time); isLive = true; }
      setCursor(glove && !ghost && isLive);

      // расстояние меряется от середины руки; над кнопкой считается касанием
      anchor = glove ? { x: hand.x + (16 - HOT_X) * SC, y: hand.y + (18 - HOT_Y) * SC } : { x: hand.x, y: hand.y };
      near = nearest(anchor.x, anchor.y);
      const D = Math.max(0, near.dist);
      const cx = pill.x + pill.w / 2;
      leanT = isLive ? clamp((hand.x - cx) / (pill.w * 1.5), -1, 1) : 0;
      lean += (leanT - lean) * Math.min(1, dt * 4);

      if (!reduced) {
        if (mode === 'idle' && isLive && D < sense) spawn();
        else if (mode === 'snap' && !violentSnap && isLive && D < sense) mode = 'seek'; // передумал
        else if (mode === 'seek' && (!isLive || D > sense + 25)) snap(false);
        else if (mode === 'seek' && D < reach) { mode = 'grow'; grow = 0; }
        else if ((mode === 'grow' || mode === 'hold') && (!isLive || D > release)) snap(true);
      }
      const holding = mode === 'hold' || mode === 'grow', seeking = mode === 'seek';
      // как сильно тянется: ноль на краю чутья, максимум на дистанции броска
      const fT = seeking ? clamp((sense - D) / Math.max(1, sense - reach), 0, 1) : holding ? 1 : 0;
      seekF += (fT - seekF) * Math.min(1, dt * 5);
      stretch = holding ? Math.min(1, D / release) : 0;
      if (mode === 'grow') { grow = Math.min(1, grow + dt / 0.3); if (grow >= 1) mode = 'hold'; }

      // ---- верле ----
      const spreadPx = Math.max(14, Math.min(pill.w * 0.3, D * 0.4 + 14)) * (seeking ? 0.65 : 1);
      let alive = 0;
      for (const st of list) {
        st.s += loopDiff(st.s, near.s + st.spread * spreadPx) * Math.min(1, dt * (mode === 'snap' ? 1.5 : 6));
        const root = at(st.s), rx = root.x - root.nx * 3, ry = root.y - root.ny * 3;
        let pinTip = false;
        const gp = gripAt(st.grip);
        if (seeking) {
          // ложноножка тянется к своему пальцу на часть пути и ощупывает воздух
          const vx = gp.x - rx, vy = gp.y - ry, vl = Math.hypot(vx, vy) || 1;
          const ease = seekF * seekF * (3 - 2 * seekF);
          const dart = Math.pow(Math.max(0, Math.sin(time * 1.9 + st.phase * 3.1)), 10) * 0.28;
          const len = Math.max(3, vl * st.reachK * 0.85 * ease * (1 + dart));
          const sway = Math.sin(time * 2.7 + st.phase) * (3 + 9 * ease) + Math.sin(time * 5.3 + st.phase * 2) * 2 * ease;
          const tx = rx + (vx / vl) * len - (vy / vl) * sway, ty = ry + (vy / vl) * len + (vx / vl) * sway;
          const k = 1 - Math.exp(-dt * 6);
          st.ex += (tx - st.ex) * k; st.ey += (ty - st.ey) * k;
          pinTip = true;
          st.seg = (Math.hypot(st.ex - rx, st.ey - ry) * (st.slack + 0.06)) / (NP - 1);
        } else if (holding) {
          // бросок к пальцу с закручиванием, потом держит и тянется за ним, как сироп
          let gx = gp.x, gy = gp.y;
          if (mode === 'grow') {
            const coil = Math.pow(1 - grow, 1.6) * (st.hair ? 7 : 13), a = st.phase + grow * Math.PI * 2.6;
            gx += Math.cos(a) * coil; gy += Math.sin(a) * coil * 0.8;
          }
          const k = 1 - Math.exp(-dt * (mode === 'grow' ? 20 + st.follow : st.follow * 1.4));
          st.ex += (gx - st.ex) * k; st.ey += (gy - st.ey) * k;
          pinTip = true;
          st.seg = (Math.hypot(st.ex - rx, st.ey - ry) * st.slack) / (NP - 1);
        } else {
          st.seg *= Math.exp(-dt * 5.5); // втягивается медленно, как что-то тяжёлое
          if (st.seg * (NP - 1) > 1.5) alive++;
        }
        const damp = mode === 'snap' ? 0.86 : 0.92;
        for (let i = 1; i < NP; i++) {
          const vx = (st.x[i] - st.px[i]) * damp, vy = (st.y[i] - st.py[i]) * damp;
          st.px[i] = st.x[i]; st.py[i] = st.y[i];
          const mid = Math.sin((i / (NP - 1)) * Math.PI);
          const wx = Math.sin(time * 1.6 + st.phase + i * 0.55) * 14 * mid;
          const wy = Math.cos(time * 1.3 + st.phase * 1.3 + i * 0.45) * 14 * mid;
          st.x[i] += vx + wx * dt * dt;
          st.y[i] += vy + (260 + wy) * dt * dt;
        }
        st.x[0] = st.px[0] = rx; st.y[0] = st.py[0] = ry;
        if (pinTip) { st.x[NP - 1] = st.ex; st.y[NP - 1] = st.ey; }
        const len = Math.max(0.01, st.seg);
        for (let it = 0; it < 14; it++) {
          for (let i = 0; i < NP - 1; i++) {
            const dx = st.x[i + 1] - st.x[i], dy = st.y[i + 1] - st.y[i];
            const d = Math.hypot(dx, dy) || 0.0001, diff = (d - len) / d;
            const a = i === 0 ? 0 : 0.5, b = pinTip && i + 1 === NP - 1 ? 0 : i === 0 ? 1 : 0.5;
            const m = a + b || 1;
            st.x[i] += dx * diff * (a / m); st.y[i] += dy * diff * (a / m);
            st.x[i + 1] -= dx * diff * (b / m); st.y[i + 1] -= dy * diff * (b / m);
          }
        }
        // немного жёсткости на изгиб – тянется плавной дугой, а не ломается углами
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 1; i < NP - 1; i++) {
            st.x[i] += ((st.x[i - 1] + st.x[i + 1]) / 2 - st.x[i]) * 0.22;
            st.y[i] += ((st.y[i - 1] + st.y[i + 1]) / 2 - st.y[i]) * 0.22;
          }
        }
        if (!Number.isFinite(st.x[NP - 1])) { st.x.fill(rx); st.y.fill(ry); st.px.fill(rx); st.py.fill(ry); }
      }
      if (mode === 'snap' && alive === 0) { mode = 'idle'; list = []; webs = []; }

      // пружина бугра
      const moundTarget = holding ? 5 + 16 * stretch : seeking ? 3 + 9 * seekF : 0;
      moundV += ((moundTarget - mound) * 150 - moundV * 9) * dt;
      mound += moundV * dt;
      if (holding || seeking) {
        moundS += loopDiff(moundS, near.s) * Math.min(1, dt * 6);
        const e = at(moundS), tx = anchor.x - e.x, ty = anchor.y - e.y, tl = Math.hypot(tx, ty) || 1;
        moundDir = { x: e.nx * 0.55 + (tx / tl) * 0.45, y: e.ny * 0.55 + (ty / tl) * 0.45 };
      }

      for (let k = spikes.length - 1; k >= 0; k--) { spikes[k].age += dt; if (spikes[k].age > spikes[k].life) spikes.splice(k, 1); }
      for (let k = drops.length - 1; k >= 0; k--) {
        const d = drops[k];
        d.age += dt; d.vy += 520 * dt;
        d.vx *= Math.exp(-dt * 2); d.vy *= Math.exp(-dt * 1);
        d.x += d.vx * dt; d.y += d.vy * dt;
        d.r *= Math.exp(-dt * 1.5);
        if (d.age > 0.9 || nearest(d.x, d.y).dist < -d.r) drops.splice(k, 1);
      }

      // ---- в шейдер ----
      const thin = 1 - 0.5 * stretch;
      const mains = list.filter(s => !s.hair).slice(0, MS);
      let minX = pill.x, minY = pill.y, maxX = pill.x + pill.w, maxY = pill.y + pill.h;
      const grow2 = seeking ? 0.55 + 0.45 * seekF : 1;
      mains.forEach((st, si) => {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (let i = 0; i < NP; i++) {
          const f = i / (NP - 1);
          // толстое у тела, тонкая нить у руки
          let r = (st.width * (3.0 - 1.9 * f)) * thin * grow2;
          // медленный пульс бежит от тела к руке, будто кормится
          if (holding) r *= 1 + 0.24 * Math.sin(f * 9 - time * 6 + st.phase) * Math.sin(f * Math.PI);
          if (mode === 'snap') r *= 1.15;
          r = Math.max(0.55, r);
          const o = (si * NP + i) * 4;
          pts[o] = st.x[i]; pts[o + 1] = st.y[i]; pts[o + 2] = r; pts[o + 3] = 1;
          minX = Math.min(minX, st.x[i]); maxX = Math.max(maxX, st.x[i]);
          minY = Math.min(minY, st.y[i]); maxY = Math.max(maxY, st.y[i]);
          x0 = Math.min(x0, st.x[i] - r); y0 = Math.min(y0, st.y[i] - r); x1 = Math.max(x1, st.x[i] + r); y1 = Math.max(y1, st.y[i] + r);
        }
        boxes[si * 4] = x0 - 40; boxes[si * 4 + 1] = y0 - 40; boxes[si * 4 + 2] = x1 + 40; boxes[si * 4 + 3] = y1 + 40;
      });
      spk.fill(0); spkR.fill(0);
      spikes.forEach((sp, k) => {
        const p = sp.age / sp.life;
        const up = p < 0.15 ? 1 - Math.pow(1 - p / 0.15, 3) : p > 0.45 ? Math.max(0, 1 - (p - 0.45) / 0.55) : 1;
        const len = sp.len * (p > 0.45 ? up * up * (3 - 2 * up) : up);
        const b = at(sp.s);
        const sway = Math.sin(sp.age * 14) * Math.exp(-sp.age * 3) * 0.35;
        const ang = Math.atan2(b.ny, b.nx) + sp.tilt + sway;
        const tx = b.x + Math.cos(ang) * len, ty = b.y + Math.sin(ang) * len;
        spk[k * 4] = b.x - b.nx * 2; spk[k * 4 + 1] = b.y - b.ny * 2; spk[k * 4 + 2] = tx; spk[k * 4 + 3] = ty;
        spkR[k * 4] = 2.6 * Math.min(1, up + 0.2); spkR[k * 4 + 1] = len > 0.6 ? 1 : 0;
        minX = Math.min(minX, tx); maxX = Math.max(maxX, tx); minY = Math.min(minY, ty); maxY = Math.max(maxY, ty);
      });
      drp.fill(0);
      drops.forEach((d, k) => {
        drp[k * 4] = d.x; drp[k * 4 + 1] = d.y; drp[k * 4 + 2] = d.r; drp[k * 4 + 3] = 1;
        minX = Math.min(minX, d.x); maxX = Math.max(maxX, d.x); minY = Math.min(minY, d.y); maxY = Math.max(maxY, d.y);
      });
      const me0 = at(moundS), mlen = Math.max(0, mound);
      const mr = mlen > 0.3 ? (9 + spreadPx * 0.32) * Math.min(1, mound / 6) : 0;
      const mtx = me0.x + moundDir.x * mlen, mty = me0.y + moundDir.y * mlen;

      if (!dead) {
        gl.viewport(0, 0, cvGl.width, cvGl.height);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(U.uRes, cvGl.width, cvGl.height);
        gl.uniform1f(U.uDpr, dpr);
        gl.uniform4f(U.uPill, pill.x, pill.y, pill.w, pill.h);
        gl.uniform4fv(U.uPts, pts);
        gl.uniform4fv(U.uBox, boxes);
        gl.uniform1f(U.uCount, mains.length);
        gl.uniform4fv(U.uSpk, spk);
        gl.uniform4fv(U.uSpkR, spkR);
        gl.uniform4fv(U.uDrop, drp);
        gl.uniform4f(U.uMound, me0.x - me0.nx * 6, me0.y - me0.ny * 6, mtx, mty);
        gl.uniform2f(U.uMoundR, mr, mr * 0.45);
        gl.uniform1f(U.uLean, lean);
        // шейдер красит только рамку вокруг слизи (плюс место под тень)
        const pad = 34;
        const x0 = Math.max(0, minX - pad), x1 = Math.min(W, maxX + pad), y0 = Math.max(0, minY - pad), y1 = Math.min(H, maxY + pad + 10);
        const X = v => (v / W) * 2 - 1, Y = v => 1 - (v / H) * 2;
        quadData.set([X(x0), Y(y0), X(x1), Y(y0), X(x0), Y(y1), X(x1), Y(y1)]);
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        // самопроверка: в центре пилюли шейдер должен рисовать непрозрачно. Не рисует – сбрасываем
        // слизь, не помогло – выключаем WebGL насовсем, кнопка остаётся обычной CSS-пилюлей
        if (++frames % 90 === 0) {
          const px = new Uint8Array(4);
          gl.readPixels(Math.round(cx * dpr), Math.round((H - pill.y - pill.r) * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          if (px[3] > 200) strikes = 0;
          else if (++strikes === 1) reset();
          else { console.warn('venom: WebGL draws nothing, falling back to CSS'); dead = true; stop(); flat(); }
        }
      }

      // ---- волоски и паутинки поверх, в 2D ----
      if (list.length && (holding || mode === 'snap')) {
        fx.setTransform(dpr, 0, 0, dpr, 0, 0);
        fx.clearRect(0, 0, W, H); fxDirty = true;
        fx.lineCap = 'round'; fx.lineJoin = 'round';
        fx.strokeStyle = 'rgba(6,6,8,0.9)';
        for (const st of list) {
          if (!st.hair) continue;
          fx.lineWidth = 0.7 * thin;
          fx.beginPath(); fx.moveTo(st.x[0], st.y[0]);
          for (let i = 1; i < NP - 1; i++) fx.quadraticCurveTo(st.x[i], st.y[i], (st.x[i] + st.x[i + 1]) / 2, (st.y[i] + st.y[i + 1]) / 2);
          fx.lineTo(st.x[NP - 1], st.y[NP - 1]);
          fx.stroke();
        }
        if (mode === 'hold') {
          fx.strokeStyle = 'rgba(10,10,12,0.6)'; fx.lineWidth = 0.5;
          for (const [a, b, i, j, kink] of webs) {
            const A = list[a], Bs = list[b];
            if (!A || !Bs) continue;
            fx.beginPath(); fx.moveTo(A.x[i], A.y[i]);
            fx.lineTo((A.x[i] + Bs.x[j]) / 2 + kink, (A.y[i] + Bs.y[j]) / 2 - Math.abs(kink) * 0.4);
            fx.lineTo(Bs.x[j], Bs.y[j]);
            fx.stroke();
          }
        }
      } else if (fxDirty) { fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, cvFx.width, cvFx.height); fxDirty = false; }

      // ---- слизь ползёт по перчатке ----
      for (let g = 0; g < coat.length; g++) {
        const caught = holding && list.some(st => st.gi === g && Math.hypot(st.ex - gripAt(st.grip).x, st.ey - gripAt(st.grip).y) < 6);
        coat[g] = caught ? Math.min(1, coat[g] + dt * 0.5) : Math.max(0, coat[g] - dt * 1.4);
      }

      // ---- перчатка поверх всего, потом слизь, обвившая пойманные пальцы ----
      const drawGlove = glove && isLive, wrapped = holding && list.length;
      if (drawGlove || wrapped) {
        hx.setTransform(dpr, 0, 0, dpr, 0, 0);
        hx.clearRect(0, 0, W, H); handDirty = true;
      } else if (handDirty) { hx.setTransform(1, 0, 0, 1, 0, 0); hx.clearRect(0, 0, cvHand.width, cvHand.height); handDirty = false; }
      if (drawGlove) {
        hx.save();
        hx.translate(hand.x - HOT_X * SC, hand.y - HOT_Y * SC);
        hx.scale(SC, SC);
        hx.save(); hx.translate(2.5, 4.5); hx.fillStyle = 'rgba(0,0,0,0.15)'; hx.fill(gloveP); hx.fill(cuffP); hx.restore();
        hx.fillStyle = '#ffffff'; hx.fill(cuffP); hx.fill(gloveP);
        // живая чёрная кожа расползается от каждого пойманного пальца
        if (coat.some(c => c > 0.01)) {
          hx.save(); hx.clip(handClip);
          for (let g = 0; g < coat.length; g++) {
            const c = coat[g];
            if (c < 0.01) continue;
            const e = c * c * (3 - 2 * c), [gx0, gy0] = GRIPS[g];
            const cx0 = gx0 + (17 - gx0) * e * 0.35, cy0 = gy0 + (20 - gy0) * e * 0.35, R = 2.4 + e * 7.5;
            hx.beginPath();
            for (let k = 0; k <= 28; k++) {
              const a = (k / 28) * Math.PI * 2;
              const rr = R * (1 + 0.17 * Math.sin(4 * a + g * 1.7 + time * 2.2) + 0.08 * Math.sin(7 * a - time * 3.1 + g));
              const x = cx0 + Math.cos(a) * rr, y = cy0 + Math.sin(a) * rr;
              if (k === 0) hx.moveTo(x, y); else hx.lineTo(x, y);
            }
            hx.closePath();
            const grad = hx.createRadialGradient(cx0 - R * 0.35, cy0 - R * 0.4, 0, cx0, cy0, R * 1.15);
            grad.addColorStop(0, '#56565b'); grad.addColorStop(0.28, '#141416'); grad.addColorStop(1, '#050506');
            hx.fillStyle = grad; hx.fill();
          }
          hx.restore();
        }
        hx.strokeStyle = '#0b0b0b';
        hx.lineWidth = 1.9; hx.stroke(cuffP);
        hx.lineWidth = 1.1; hx.stroke(cuffL);
        hx.lineWidth = 1.9; hx.stroke(gloveP);
        hx.lineWidth = 1.1; hx.stroke(gloveL);
        hx.restore();
      }
      if (wrapped) {
        hx.lineCap = 'round'; hx.lineJoin = 'round';
        for (const st of list) {
          const gp = gripAt(st.grip), gap = Math.hypot(st.ex - gp.x, st.ey - gp.y);
          const on = clamp(1 - gap / 14, 0, 1);
          if (on <= 0) continue;
          // последний отрезок щупальца идёт поверх перчатки одним плавным сужением
          const from = NP - 4;
          hx.globalAlpha = on; hx.strokeStyle = '#060607';
          for (let i = from; i < NP - 1; i++) {
            const f = i / (NP - 1);
            hx.lineWidth = Math.max(0.6, st.width * (3.0 - 1.9 * f) * thin * 2) * (st.hair ? 0.45 : 1);
            const x0 = i === from ? st.x[i] : (st.x[i - 1] + st.x[i]) / 2, y0 = i === from ? st.y[i] : (st.y[i - 1] + st.y[i]) / 2;
            const last = i === NP - 2;
            hx.beginPath(); hx.moveTo(x0, y0);
            hx.quadraticCurveTo(st.x[i], st.y[i], last ? st.x[NP - 1] : (st.x[i] + st.x[i + 1]) / 2, last ? st.y[NP - 1] : (st.y[i] + st.y[i + 1]) / 2);
            hx.stroke();
          }
          hx.globalAlpha = 1;
        }
      }
    }
    const gloveP = new Path2D(GLOVE), gloveL = new Path2D(GLOVE_LINES), cuffP = new Path2D(CUFF), cuffL = new Path2D(CUFF_LINES);
    const handClip = new Path2D(); handClip.addPath(gloveP); handClip.addPath(cuffP);

    // ---------- цикл ----------
    let raf = 0, running = false, visible = true, calm = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const was = prev;
      try { tick(now); } catch (err) { console.warn('venom:', err); reset(); }
      // засыпаем, когда всё улеглось – ноль нагрузки, пока курсор снова не подойдёт к кнопке
      const still = mode === 'idle' && !list.length && !spikes.length && !drops.length && !ghostOn
        && Math.abs(mound) < 0.05 && Math.abs(moundV) < 0.05 && Math.abs(leanT - lean) < 0.002 && !coat.some(c => c > 0);
      calm = still ? calm + (now - was) / 1000 : 0;
      if (calm > 0.3) stop();
    }
    function start() { if (running || reduced || dead || !visible) return; running = true; calm = 0; prev = performance.now(); raf = requestAnimationFrame(frame); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    const ro = new ResizeObserver(fit); ro.observe(wrap);
    const io = new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; if (visible) start(); else { stop(); setCursor(false); } });
    io.observe(cvGl);
    fit();

    wrap.__venomDbg = () => ({ mode, mound, lean, dead, running, visible, dpr, n: list.length, s: list.map(st => [st.seg, st.ex, st.ey]) });
    wrap.__venom = () => {
      stop(); ro.disconnect(); io.disconnect();
      removeEventListener('pointermove', onMove); document.removeEventListener('pointerout', onLeave);
      removeEventListener('blur', onBlur); removeEventListener('scroll', onScroll);
      cvGl.removeEventListener('webglcontextlost', onLost); cvGl.removeEventListener('webglcontextrestored', onRestored);
      live.delete(me); syncCursor();
      if (gl && !dead) { gl.deleteBuffer(quad); gl.deleteProgram(prog); shaders.forEach(s => gl.deleteShader(s)); }
      [cvGl, cvFx, cvHand].forEach(c => c.remove());
      wrap.classList.remove('venom--gl', 'venom--flat');
      delete wrap.__venom;
    };
  }

  window.VenomButton = { init, destroy: wrap => wrap.__venom && wrap.__venom() };
  const boot = () => document.querySelectorAll('[data-venom]').forEach(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

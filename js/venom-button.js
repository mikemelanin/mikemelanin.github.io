// Venom-кнопка: чёрная глянцевая пилюля, которая тянется к курсору щупальцами.
// Порт React-компонента VenomButton на чистый JS. Разметка:
// <span class="venom" data-venom><a class="venom-btn" href="...">...</a></span>
// Настройки через data-атрибуты обёртки: data-strands, data-sense, data-reach,
// data-release, data-cursor="glove|native", data-autoplay.
(() => {
  const MS = 7, NP = 12, MSPK = 8, MDROP = 6;
  const PADX = 300, PADY = 220;      // сколько места вокруг кнопки занимает сцена
  const GS = 1.55;                    // масштаб перчатки
  // точки хвата на перчатке, кончик пальца в (0,0): кончик, три костяшки, большой, сустав, ладонь, манжета
  const GRIPS = [[0, 3], [9.5, 13], [15.5, 13.5], [21, 15], [-6, 21], [0, 12], [10, 24], [10, 33]];
  const HAND_MID = [9, 20];
  const GHOST = [[.30, .30], [.62, .18], [.80, .42], [.66, .62], [.52, .50], [.46, .58], [.20, .70], [.14, .40], [.36, .54], [.54, .44], [.86, .74], [.50, .86]];

  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const FRAG = `#extension GL_OES_standard_derivatives : enable
precision highp float;
#define MS ${MS}
#define NP ${NP}
#define MSPK ${MSPK}
#define MDROP ${MDROP}
uniform vec2 uRes; uniform float uDpr; uniform float uLean;
uniform vec4 uPill; uniform vec4 uMound; uniform vec2 uMoundR;
uniform vec3 uPts[${MS * NP}]; uniform float uOn[MS]; uniform vec4 uBox[MS];
uniform vec4 uSpk[MSPK]; uniform float uSpkR[MSPK]; uniform vec3 uDrop[MDROP];

float sdPill(vec2 p){ vec2 q = abs(p - uPill.xy); q.x = max(q.x - (uPill.z - uPill.w), 0.); return length(q) - uPill.w; }
vec2 cap(vec2 p, vec2 a, vec2 b, float ra, float rb){
  vec2 pa = p - a, ba = b - a; float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0., 1.);
  float r = mix(ra, rb, t); return vec2(length(pa - ba * t) - r, r);
}
vec2 smin2(vec2 a, vec2 b, float k){ float h = clamp(.5 + .5 * (b.x - a.x) / k, 0., 1.); return vec2(mix(b.x, a.x, h) - k * h * (1. - h), mix(b.y, a.y, h)); }
vec2 hmin(vec2 a, vec2 b){ return a.x < b.x ? a : b; }

vec2 field(vec2 p){
  vec2 body = vec2(sdPill(p), uPill.w);
  if (uMoundR.x > .01) body = smin2(body, cap(p, uMound.xy, uMound.zw, uMoundR.x, uMoundR.y), 14.);
  vec2 ex = vec2(1e5, 1.);
  for (int s = 0; s < MS; s++) {
    if (uOn[s] < .5) continue;
    vec4 bx = uBox[s];
    if (p.x < bx.x - 16. || p.x > bx.z + 16. || p.y < bx.y - 16. || p.y > bx.w + 16.) continue;
    vec2 st = vec2(1e5, 1.);
    for (int i = 0; i < NP - 1; i++) { vec3 a = uPts[s * NP + i], b = uPts[s * NP + i + 1]; st = hmin(st, cap(p, a.xy, b.xy, a.z, b.z)); }
    ex = smin2(ex, st, 3.5);
  }
  for (int i = 0; i < MSPK; i++) { if (uSpkR[i] > .01) ex = smin2(ex, cap(p, uSpk[i].xy, uSpk[i].zw, uSpkR[i], .6), 3.5); }
  for (int i = 0; i < MDROP; i++) { if (uDrop[i].z > .01) ex = smin2(ex, vec2(length(p - uDrop[i].xy) - uDrop[i].z, uDrop[i].z), 3.5); }
  return smin2(body, ex, 11.);
}

float env(vec3 r){
  float c = .015;
  c += smoothstep(.25, .55, -r.y) * (1. - smoothstep(.55, .9, abs(r.x))) * .95;               // софтбокс сверху
  float win = smoothstep(.35, .6, -r.x) * (1. - smoothstep(.3, .55, abs(r.y + .1)));
  c += win * (.8 + .2 * step(.07, abs(fract(r.y * 4. + .5) - .5))) * .55;                     // окно слева
  c += smoothstep(.4, .8, r.x) * .16;                                                         // заполняющий справа
  c += smoothstep(.35, .8, r.y) * .22;                                                        // светлый пол
  c += pow(max(dot(r, normalize(vec3(-.45, -.6, .66))), 0.), 220.) * 2.2;                     // блики
  c += pow(max(dot(r, normalize(vec3(.5, -.35, .8))), 0.), 300.) * 1.2;
  return c;
}

void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 f = field(p);
  float th = max(f.y, .5);
  float s = clamp(-f.x / th, 0., 1.);
  float h = th * sqrt(1. - (1. - s) * (1. - s));
  vec2 g = vec2(dFdx(h), -dFdy(h)) * uDpr;
  vec3 n = normalize(vec3(-g, 1.));
  vec3 r = vec3(0., 0., -1.) + 2. * n.z * n;
  r.x += uLean * .25;
  float F = .05 + .95 * pow(1. - max(n.z, 0.), 5.);
  vec3 col = vec3(.01) + env(normalize(r)) * mix(.5, 1., F) * vec3(.97, .98, 1.);
  float a = clamp(.5 - f.x * uDpr, 0., 1.);
  float sh = .22 * (1. - smoothstep(-6., 16., sdPill(p - vec2(4., 9.))));
  gl_FragColor = vec4(col * a, a + sh * (1. - a));
}`;

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  function rr(c, x, y, w, h, r) {
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function handPath(c) {
    c.beginPath();
    rr(c, -5, 0, 10, 20, 5);
    rr(c, -4, 12, 28, 20, 7);
    [[9.5, 13.5, 4.5], [15.5, 14, 4.3], [21, 15.5, 4]].forEach(([x, y, r]) => { c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); });
    c.moveTo(1, 21); c.ellipse(-4, 21, 5.5, 4, -0.5, 0, Math.PI * 2);
  }
  function glovePath(c) { handPath(c); rr(c, -1, 30, 22, 7, 2); }

  const live = new Set();
  const syncCursor = () => document.documentElement.classList.toggle('venom-nocursor', [...live].some(v => v.hide));

  function init(wrap) {
    if (wrap.__venom) return;
    const btn = wrap.querySelector('.venom-btn');
    if (!btn) return;
    const ds = wrap.dataset;
    const opt = {
      strands: clamp(Math.round(+ds.strands || 7), 2, 7),
      sense: +ds.sense || 290, reach: +ds.reach || 140, release: +ds.release || 215,
      cursor: ds.cursor === 'native' || matchMedia('(pointer: coarse)').matches ? 'native' : 'glove',
      autoplay: ds.autoplay === 'true' || ds.autoplay === ''
    };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const glove = opt.cursor === 'glove' && !reduced;

    const mk = cls => { const c = document.createElement('canvas'); c.className = 'venom-cv ' + cls; c.setAttribute('aria-hidden', 'true'); return c; };
    const cvGl = mk('venom-gl'), cvFx = mk('venom-fx'), cvHand = mk('venom-hand');
    wrap.prepend(cvGl); wrap.append(cvFx, cvHand);
    const fx = cvFx.getContext('2d'), hx = cvHand.getContext('2d');

    // ---------- WebGL ----------
    let gl = null, prog = null, buf = null, shaders = [], U = {};
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
      gl = cvGl.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
      if (!gl || !gl.getExtension('OES_standard_derivatives')) return false;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); shaders.push(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
      const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) { if (fs === null) console.warn('venom shader:', gl.getShaderInfoLog(shaders[1])); return false; }
      prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
      gl.useProgram(prog);
      buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['uRes', 'uDpr', 'uLean', 'uPill', 'uMound', 'uMoundR', 'uPts', 'uOn', 'uBox', 'uSpk', 'uSpkR', 'uDrop'].forEach(n => { U[n] = gl.getUniformLocation(prog, n); });
      gl.clearColor(0, 0, 0, 0);
      return true;
    }
    const glOk = setupGl();
    if (glOk) wrap.classList.add('venom--gl'); else flat();
    let dead = !glOk;
    // контекст WebGL может отняться (сон, переключение видеокарты) – ждём восстановления, а пока простая CSS-пилюля
    const onLost = e => {
      e.preventDefault(); dead = true; stop(); flat();
      me.hide = false; syncCursor();
      fx.clearRect(0, 0, cvFx.width, cvFx.height); hx.clearRect(0, 0, cvHand.width, cvHand.height);
    };
    const onRestored = () => { if (setupGl()) { dead = false; unflat(); reset(); fit(); start(); } };
    cvGl.addEventListener('webglcontextlost', onLost);
    cvGl.addEventListener('webglcontextrestored', onRestored);

    // ---------- размеры ----------
    let W = 0, H = 0, dpr = 1, gdpr = 1;
    function fit() {
      dpr = Math.min(2, devicePixelRatio || 1);
      gdpr = Math.min(1.5, dpr);
      W = wrap.offsetWidth + PADX * 2; H = wrap.offsetHeight + PADY * 2;
      [cvGl, cvFx, cvHand].forEach(c => {
        c.style.left = -PADX + 'px'; c.style.top = -PADY + 'px'; c.style.width = W + 'px'; c.style.height = H + 'px';
        const d = c === cvGl ? gdpr : dpr;
        c.width = Math.round(W * d); c.height = Math.round(H * d);
      });
      if (!running) draw();
    }

    // ---------- состояние ----------
    const pill = { cx: 0, cy: 0, hw: 0, r: 0, L: 0, P: 0 };
    function measure() {
      const sr = cvGl.getBoundingClientRect(), br = btn.getBoundingClientRect();
      const k = sr.width / (cvGl.offsetWidth || 1) || 1;
      pill.k = k; pill.sx = sr.left; pill.sy = sr.top;
      pill.cx = (br.left + br.width / 2 - sr.left) / k; pill.cy = (br.top + br.height / 2 - sr.top) / k;
      pill.hw = br.width / k / 2; pill.r = br.height / k / 2;
      pill.L = Math.max(0, pill.hw - pill.r); pill.P = 4 * pill.L + 2 * Math.PI * pill.r;
      const sc = clamp(pill.r / 32, 0.55, 1.2);
      strands.forEach(st => { st.w = st.w0 * (st.hair ? 1 : sc); });
    }
    // контур пилюли по длине дуги: точка и внешняя нормаль
    function outline(s) {
      const { cx, cy, r, L, P } = pill;
      s = ((s % P) + P) % P;
      if (s < 2 * L) return [cx - L + s, cy - r, 0, -1];
      s -= 2 * L;
      if (s < Math.PI * r) { const a = -Math.PI / 2 + s / r; return [cx + L + r * Math.cos(a), cy + r * Math.sin(a), Math.cos(a), Math.sin(a)]; }
      s -= Math.PI * r;
      if (s < 2 * L) return [cx + L - s, cy + r, 0, 1];
      s -= 2 * L;
      const a = Math.PI / 2 + s / r; return [cx - L + r * Math.cos(a), cy + r * Math.sin(a), Math.cos(a), Math.sin(a)];
    }
    function closest(x, y) {
      const { cx, cy, r, L } = pill;
      if (Math.abs(x - cx) <= L) return y < cy ? x - (cx - L) : 2 * L + Math.PI * r + (cx + L - x);
      if (x > cx) { const a = clamp(Math.atan2(y - cy, x - (cx + L)), -Math.PI / 2, Math.PI / 2); return 2 * L + (a + Math.PI / 2) * r; }
      let a = Math.atan2(y - cy, x - (cx - L)); if (a < 0) a += Math.PI * 2;
      return 4 * L + Math.PI * r + (clamp(a, Math.PI / 2, Math.PI * 1.5) - Math.PI / 2) * r;
    }
    const wrapD = (from, to) => { const P = pill.P || 1; return (((to - from) % P) + P * 1.5) % P - P / 2; };
    const sdPill = (x, y) => { const qx = Math.max(Math.abs(x - pill.cx) - pill.L, 0), qy = Math.abs(y - pill.cy); return Math.hypot(qx, qy) - pill.r; };

    const N = opt.strands * 2 - 1;
    const strands = [];
    for (let i = 0; i < N; i++) {
      const hair = i % 2 === 1, j = i >> 1;
      strands.push({
        hair, gi: hair ? [j % 8, (j + 1) % 8] : j % 8, phase: Math.random() * 6.28,
        reachK: 0.55 + Math.random() * 0.4, w0: hair ? 0.5 : 3.1 + Math.random() * 0.8, w: 0,
        s: 0, len: 0, pinned: false, amt: 0,
        p: new Float32Array(NP * 2), q: new Float32Array(NP * 2), off: (i - (N - 1) / 2) * 7
      });
    }
    let state = 'idle', violent = false, growT = 0, t = 0;
    let moundS = 0, mound = 0, moundV = 0, lean = 0;
    const skin = new Float32Array(8);
    const spikes = [], drops = [];
    let ptr = null, lastReal = -1e9;
    const ghost = { i: 0, u: 0, dur: 1 };

    const onMove = e => {
      if (e.pointerType === 'touch') return;
      ptr = { x: e.clientX, y: e.clientY }; lastReal = performance.now();
    };
    const onLeave = e => { if (!e.relatedTarget) ptr = null; };
    const onBlur = () => { ptr = null; };
    if (!reduced) {
      addEventListener('pointermove', onMove, { passive: true });
      document.addEventListener('pointerout', onLeave);
      addEventListener('blur', onBlur);
    }

    const me = { hide: false, D: Infinity };
    live.add(me);
    function setCursor(hide) {
      if (hide === me.hide) return;
      me.hide = hide; syncCursor();
    }

    function handNow(now) {
      if (ptr) {
        const x = (ptr.x - pill.sx) / pill.k, y = (ptr.y - pill.sy) / pill.k;
        const In = x >= 0 && y >= 0 && x <= W && y <= H;
        setCursor(glove && In);
        return { x, y, real: true, inStage: In };
      }
      setCursor(false);
      if (!opt.autoplay || now - lastReal < 2500) return null;
      const g = ghost, w = i => GHOST[(i + GHOST.length) % GHOST.length];
      const a = w(g.i - 1), b = w(g.i), c = w(g.i + 1), d = w(g.i + 2), u = g.u, u2 = u * u, u3 = u2 * u;
      const cr = k => 0.5 * (2 * b[k] + (-a[k] + c[k]) * u + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * u2 + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * u3);
      return { x: cr(0) * W, y: cr(1) * H, real: false, inStage: true };
    }
    const gripAt = (hand, gi) => {
      const g = GRIPS[gi];
      return glove ? [hand.x + g[0] * GS, hand.y + g[1] * GS]
        : [hand.x + (g[0] - HAND_MID[0]) * 0.45, hand.y + (g[1] - HAND_MID[1]) * 0.45];
    };
    const targetOf = (st, hand) => {
      if (!st.hair) return gripAt(hand, st.gi);
      const a = gripAt(hand, st.gi[0]), b = gripAt(hand, st.gi[1]);
      return [(a[0] + b[0]) / 2 + 3, (a[1] + b[1]) / 2 - 2];
    };

    function snap(hard) {
      state = 'snap'; violent = hard;
      strands.forEach(st => { st.pinned = false; });
      if (!hard) return;
      moundV -= 90;
      strands.filter(st => !st.hair && st.amt > 0.2).slice(0, MSPK).forEach(st => {
        const o = outline(st.s);
        spikes.push({ x: o[0], y: o[1], nx: o[2], ny: o[3], t: 0, life: 0.55 + Math.random() * 0.4, len: 14 + Math.random() * 14, r: 4.5 + Math.random() * 3 });
      });
      strands.filter(st => !st.hair).sort(() => Math.random() - 0.5).slice(0, 3 + (Math.random() * 3 | 0)).forEach(st => {
        const i = (NP - 1) * 2;
        drops.push({ x: st.p[i], y: st.p[i + 1], vx: (st.p[i] - st.q[i]) * 30, vy: (st.p[i + 1] - st.q[i + 1]) * 30 - 40, r0: 2.5 + Math.random() * 3, r: 0, life: 0, max: 0.7 + Math.random() * 0.4 });
      });
      drops.forEach(d => { d.r = d.r0; });
      while (spikes.length > MSPK) spikes.shift();
      while (drops.length > MDROP) drops.shift();
    }

    function step(dt, now) {
      t += dt;
      measure();
      const hand = handNow(now);
      if (hand && !hand.real) {
        ghost.u += dt / ghost.dur;
        if (ghost.u >= 1) { ghost.u -= 1; ghost.i = (ghost.i + 1) % GHOST.length; ghost.dur = 0.55 + Math.random() * 0.85; }
      }
      let D = Infinity, mid = null;
      if (hand) {
        mid = glove ? [hand.x + HAND_MID[0] * GS, hand.y + HAND_MID[1] * GS] : [hand.x, hand.y];
        D = Math.max(0, sdPill(mid[0], mid[1]));
      }
      me.D = D;
      const { sense, reach, release } = opt;

      // переходы состояний
      if (state === 'idle' && D < sense) state = 'seek';
      else if (state === 'seek') {
        if (D < reach) { state = 'grow'; growT = 0; }
        else if (D > sense + 25) snap(false);
      } else if (state === 'grow' || state === 'hold') {
        if (!hand || D > release) snap(true);
        else if (state === 'grow' && (growT += dt) >= 0.3) state = 'hold';
      } else if (state === 'snap') {
        if (!violent && D < sense) state = 'seek';
        else if (strands.every(st => st.len < 1)) state = 'idle';
      }

      const prox = hand ? clamp(1 - (D - reach) / (sense - reach), 0, 1) : 0;
      const stretch = state === 'hold' ? clamp((D - reach * 0.5) / (release - reach * 0.5), 0, 1) : 0;
      const g = state === 'grow' ? clamp(growT / 0.3, 0, 1) : 1;

      // бугор к руке: пружина 150 / 9
      if (mid) moundS += wrapD(moundS, closest(mid[0], mid[1])) * Math.min(1, dt * 5);
      const mTarget = state === 'seek' ? 8 + 26 * prox : state === 'grow' || state === 'hold' ? 30 + 12 * stretch : 0;
      moundV += ((mTarget - mound) * 150 - moundV * 9) * dt;
      mound += moundV * dt;
      lean = lerp(lean, mid ? clamp((mid[0] - pill.cx) / 320, -1, 1) : 0, Math.min(1, dt * 3));

      const holdSet = new Set();
      strands.forEach((st, si) => {
        if (mid) st.s += wrapD(st.s, closest(mid[0], mid[1]) + st.off) * Math.min(1, dt * 4);
        const o = outline(st.s), root = [o[0] - o[2] * 4, o[1] - o[3] * 4];
        const p = st.p, q = st.q, last = (NP - 1) * 2;
        if (st.len < 0.01 && !st.pinned) { for (let i = 0; i < NP; i++) { p[i * 2] = q[i * 2] = root[0]; p[i * 2 + 1] = q[i * 2 + 1] = root[1]; } }
        let tipT = null, tipK = 0;
        if (hand && (state === 'seek' || state === 'grow' || state === 'hold')) {
          const tg = targetOf(st, hand);
          if (state === 'seek') {
            const dart = Math.pow(Math.max(0, Math.sin(t * 2.3 + st.phase)), 6) * 0.25;
            const k = st.reachK * (0.3 + 0.7 * prox) * prox + dart * prox;
            const dx = tg[0] - root[0], dy = tg[1] - root[1], dl = Math.hypot(dx, dy) || 1;
            const sway = Math.sin(t * 1.7 + st.phase) * 9 * prox;
            tipT = [root[0] + dx * k - dy / dl * sway, root[1] + dy * k + dx / dl * sway];
            st.len = lerp(st.len, Math.hypot(tipT[0] - root[0], tipT[1] - root[1]), Math.min(1, dt * 6));
            tipK = Math.min(1, dt * 10); st.pinned = false;
          } else {
            const coil = (1 - g) * 12, a = t * 18 + st.phase;
            tipT = [tg[0] + Math.cos(a) * coil, tg[1] + Math.sin(a) * coil];
            st.len = Math.hypot(tg[0] - root[0], tg[1] - root[1]);
            tipK = state === 'hold' ? 1 : lerp(0.3, 1, g); st.pinned = true;
            if (!st.hair && g > 0.6) holdSet.add(st.gi);
          }
        } else if (state === 'snap') {
          st.len = Math.max(0, st.len - (violent ? 700 : 260) * dt);
        } else {
          st.len = lerp(st.len, 0, Math.min(1, dt * 6));
        }
        st.amt = clamp(st.len / 14, 0, 1);

        // верле
        const damp = state === 'snap' ? 0.86 : 0.92;
        for (let i = 1; i < NP; i++) {
          const x = i * 2;
          const vx = (p[x] - q[x]) * damp, vy = (p[x + 1] - q[x + 1]) * damp;
          q[x] = p[x]; q[x + 1] = p[x + 1];
          p[x] += vx + Math.sin(t * 1.3 + st.phase + i * 0.6) * 0.05;
          p[x + 1] += vy + 300 * dt * dt;
        }
        p[0] = q[0] = root[0]; p[1] = q[1] = root[1];
        if (tipT) { p[last] = lerp(p[last], tipT[0], tipK); p[last + 1] = lerp(p[last + 1], tipT[1], tipK); }
        const rest = st.len / (NP - 1);
        for (let it = 0; it < 14; it++) {
          for (let i = 0; i < NP - 1; i++) {
            const a = i * 2, b = a + 2;
            const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], d = Math.hypot(dx, dy) || 1e-4;
            const wa = i === 0 ? 0 : 1, wb = i + 1 === NP - 1 && st.pinned ? 0 : 1;
            if (!wa && !wb) continue;
            const c = (d - rest) / d / (wa + wb);
            p[a] += dx * c * wa; p[a + 1] += dy * c * wa;
            p[b] -= dx * c * wb; p[b + 1] -= dy * c * wb;
          }
        }
        for (let it = 0; it < 2; it++) {
          for (let i = 1; i < NP - 1; i++) {
            if (i === NP - 2 && st.pinned) continue;
            const x = i * 2;
            p[x] = lerp(p[x], (p[x - 2] + p[x + 2]) / 2, 0.15); p[x + 1] = lerp(p[x + 1], (p[x - 1] + p[x + 3]) / 2, 0.15);
          }
        }
        st.stretch = stretch;
        st.idx = si;
      });

      for (let i = 0; i < 8; i++) skin[i] = clamp(skin[i] + (holdSet.has(i) && glove ? 0.5 : -1.4) * dt, 0, 1);

      for (let i = spikes.length - 1; i >= 0; i--) if ((spikes[i].t += dt) >= spikes[i].life) spikes.splice(i, 1);
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.life += dt; d.vy += 600 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
        d.r = d.r0 * (1 - d.life / d.max);
        if (d.r <= 0) drops.splice(i, 1);
      }
      if (!Number.isFinite(mound + moundV + moundS + lean) || strands.some(st => !Number.isFinite(st.len + st.s + st.p[(NP - 1) * 2] + st.p[(NP - 1) * 2 + 1]))) reset();
      return hand;
    }
    function reset() {
      state = 'idle'; violent = false; mound = moundV = moundS = lean = 0;
      spikes.length = drops.length = 0; skin.fill(0);
      strands.forEach(st => { st.len = 0; st.s = 0; st.amt = 0; st.pinned = false; st.p.fill(0); st.q.fill(0); });
    }

    // ---------- отрисовка ----------
    const pts = new Float32Array(MS * NP * 3), on = new Float32Array(MS), box = new Float32Array(MS * 4);
    const spk = new Float32Array(MSPK * 4), spkR = new Float32Array(MSPK), drp = new Float32Array(MDROP * 3);
    const radius = (st, i) => {
      const u = i / (NP - 1), pulse = 1 + 0.18 * Math.exp(-Math.pow((u - ((t * 0.9 + st.phase) % 1)) * 6, 2));
      return lerp(st.w * 3, st.w * 1.1, u) * (1 - 0.5 * (st.stretch || 0)) * st.amt * pulse;
    };

    function drawGl() {
      if (dead) return;
      let bx0 = pill.cx - pill.hw, by0 = pill.cy - pill.r, bx1 = pill.cx + pill.hw, by1 = pill.cy + pill.r;
      const grow = (x, y, r) => { bx0 = Math.min(bx0, x - r); by0 = Math.min(by0, y - r); bx1 = Math.max(bx1, x + r); by1 = Math.max(by1, y + r); };
      on.fill(0); spkR.fill(0); drp.fill(0);
      strands.filter(st => !st.hair).forEach((st, s) => {
        if (s >= MS || st.amt < 0.02) return;
        on[s] = 1;
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (let i = 0; i < NP; i++) {
          const x = st.p[i * 2], y = st.p[i * 2 + 1], r = radius(st, i), o = (s * NP + i) * 3;
          pts[o] = x; pts[o + 1] = y; pts[o + 2] = r;
          x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r);
        }
        box.set([x0, y0, x1, y1], s * 4);
        grow(x0, y0, 0); grow(x1, y1, 0);
      });
      spikes.forEach((k, i) => {
        const l = k.len * Math.sin(Math.PI * k.t / k.life);
        spk.set([k.x - k.nx * 3, k.y - k.ny * 3, k.x + k.nx * l, k.y + k.ny * l], i * 4);
        spkR[i] = l > 0.5 ? k.r : 0;
        grow(k.x + k.nx * l, k.y + k.ny * l, k.r);
      });
      drops.forEach((d, i) => { drp.set([d.x, d.y, d.r], i * 3); grow(d.x, d.y, d.r); });
      const mo = outline(moundS), mAmt = clamp(mound / 6, 0, 1), rb = pill.r * 0.42;
      const ma = [mo[0] - mo[2] * pill.r * 0.5, mo[1] - mo[3] * pill.r * 0.5];
      const mb = [mo[0] + mo[2] * (Math.max(mound, 0) - rb), mo[1] + mo[3] * (Math.max(mound, 0) - rb)];
      if (mAmt > 0) grow(mb[0], mb[1], rb + 14);

      gl.viewport(0, 0, cvGl.width, cvGl.height);
      gl.disable(gl.SCISSOR_TEST); gl.clear(gl.COLOR_BUFFER_BIT);
      const pad = 34;
      const sx = Math.max(0, Math.floor((bx0 - pad) * gdpr)), sy = Math.max(0, Math.floor((H - by1 - pad - 12) * gdpr));
      const sw = Math.min(cvGl.width, Math.ceil((bx1 + pad) * gdpr)) - sx, sh = Math.min(cvGl.height, Math.ceil((H - by0 + pad) * gdpr)) - sy;
      if (sw <= 0 || sh <= 0) return;
      gl.enable(gl.SCISSOR_TEST); gl.scissor(sx, sy, sw, sh);
      gl.uniform2f(U.uRes, cvGl.width, cvGl.height); gl.uniform1f(U.uDpr, gdpr); gl.uniform1f(U.uLean, lean);
      gl.uniform4f(U.uPill, pill.cx, pill.cy, pill.hw, pill.r);
      gl.uniform4f(U.uMound, ma[0], ma[1], mb[0], mb[1]);
      gl.uniform2f(U.uMoundR, pill.r * 0.7 * mAmt, rb * mAmt);
      gl.uniform3fv(U.uPts, pts); gl.uniform1fv(U.uOn, on); gl.uniform4fv(U.uBox, box);
      gl.uniform4fv(U.uSpk, spk); gl.uniform1fv(U.uSpkR, spkR); gl.uniform3fv(U.uDrop, drp);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function strokeRope(c, st, from, width) {
      c.beginPath(); c.moveTo(st.p[from * 2], st.p[from * 2 + 1]);
      for (let i = from + 1; i < NP - 1; i++) {
        const x = st.p[i * 2], y = st.p[i * 2 + 1];
        c.quadraticCurveTo(x, y, (x + st.p[i * 2 + 2]) / 2, (y + st.p[i * 2 + 3]) / 2);
      }
      c.lineTo(st.p[(NP - 1) * 2], st.p[(NP - 1) * 2 + 1]);
      c.lineWidth = width; c.stroke();
    }

    function drawFx() {
      fx.setTransform(dpr, 0, 0, dpr, 0, 0); fx.clearRect(0, 0, W, H);
      if (state !== 'hold' && state !== 'snap') return;
      fx.lineCap = 'round'; fx.strokeStyle = '#0a0a0c';
      strands.forEach(st => { if (st.hair && st.amt > 0.05) strokeRope(fx, st, 0, 1.4 * st.amt); });
      const thick = strands.filter(st => !st.hair);
      fx.globalAlpha = 0.75;
      for (let s = 0; s < thick.length - 1; s++) {
        const a = thick[s], b = thick[s + 1];
        if (a.amt < 0.3 || b.amt < 0.3) continue;
        [[4, 6], [7, 8]].forEach(([i, j]) => {
          const x0 = a.p[i * 2], y0 = a.p[i * 2 + 1], x1 = b.p[j * 2], y1 = b.p[j * 2 + 1];
          fx.beginPath(); fx.moveTo(x0, y0); fx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 7, x1, y1);
          fx.lineWidth = 0.7; fx.stroke();
        });
      }
      fx.globalAlpha = 1;
    }

    function drawHand(hand) {
      hx.setTransform(dpr, 0, 0, dpr, 0, 0); hx.clearRect(0, 0, W, H);
      if (!glove || !hand || !hand.inStage) return;
      let best = null;
      for (const v of live) if (!best || v.D < best.D) best = v;
      if (best !== me) return;
      hx.save(); hx.translate(hand.x, hand.y); hx.scale(GS, GS);
      hx.lineJoin = 'round'; hx.lineCap = 'round'; hx.strokeStyle = '#111'; hx.fillStyle = '#fff';
      handPath(hx); hx.lineWidth = 2.4; hx.stroke(); hx.fill();
      hx.beginPath(); rr(hx, -1, 30, 22, 7, 2); hx.stroke(); hx.fill();
      hx.lineWidth = 1;
      hx.beginPath(); hx.moveTo(12.5, 15); hx.lineTo(12.5, 20); hx.moveTo(18.3, 16); hx.lineTo(18.3, 20.5);
      hx.moveTo(-2, 9); hx.lineTo(2, 9); hx.moveTo(1, 33.5); hx.lineTo(19, 33.5); hx.stroke();
      // чёрная кожа, ползущая к ладони
      if (skin.some(v => v > 0)) {
        hx.save(); glovePath(hx); hx.clip();
        const palm = GRIPS[6];
        GRIPS.forEach((gp, i) => {
          const v = skin[i]; if (v <= 0) return;
          const cx = lerp(gp[0], palm[0], 0.4 * v), cy = lerp(gp[1], palm[1], 0.4 * v), r = 3 + v * 11;
          const gr = hx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx, cy, r);
          gr.addColorStop(0, '#3c3c42'); gr.addColorStop(0.45, '#0d0d0f'); gr.addColorStop(1, '#050506');
          hx.fillStyle = gr; hx.beginPath(); hx.arc(cx, cy, r, 0, Math.PI * 2); hx.fill();
        });
        hx.restore();
      }
      hx.restore();
      // последний отрезок щупалец поверх перчатки – будто обвили палец
      if (state === 'hold' || (state === 'grow' && growT > 0.15)) {
        hx.lineCap = 'round';
        strands.forEach(st => {
          if (st.hair || st.amt < 0.3) return;
          hx.strokeStyle = '#0a0a0c'; strokeRope(hx, st, NP - 4, radius(st, NP - 2) * 2);
          hx.save(); hx.translate(-0.8, -0.8); hx.strokeStyle = 'rgba(255,255,255,.28)'; strokeRope(hx, st, NP - 3, 1.1); hx.restore();
        });
      }
    }

    function draw(hand) {
      if (W === 0) return;
      measure();
      drawGl(); drawFx(); drawHand(hand);
    }

    // ---------- цикл ----------
    let raf = 0, running = false, visible = true, last = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(1 / 30, last ? (now - last) / 1000 : 1 / 60); last = now;
      try { draw(step(dt, now)); } catch (err) { console.warn('venom:', err); reset(); }
    }
    function start() { if (running || reduced || dead || !visible) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
    function stop() { running = false; cancelAnimationFrame(raf); me.D = Infinity; setCursor(false); if (W) hx.clearRect(0, 0, cvHand.width, cvHand.height); }

    const ro = new ResizeObserver(fit); ro.observe(wrap);
    const io = new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; visible ? start() : stop(); });
    io.observe(cvGl);
    fit(); start();

    wrap.__venomDbg = () => ({ state, mound, moundS, lean, dead, running, visible, s: strands.map(st => [st.len, st.s, st.p[22], st.p[23]]) });
    wrap.__venom = () => {
      stop(); ro.disconnect(); io.disconnect();
      removeEventListener('pointermove', onMove); document.removeEventListener('pointerout', onLeave); removeEventListener('blur', onBlur);
      cvGl.removeEventListener('webglcontextlost', onLost);
      live.delete(me); syncCursor();
      cvGl.removeEventListener('webglcontextrestored', onRestored);
      if (gl && !dead) { gl.deleteProgram(prog); shaders.forEach(s => gl.deleteShader(s)); gl.deleteBuffer(buf); }
      [cvGl, cvFx, cvHand].forEach(c => c.remove());
      wrap.classList.remove('venom--gl', 'venom--flat');
      delete wrap.__venom;
    };
  }

  window.VenomButton = { init, destroy: wrap => wrap.__venom && wrap.__venom() };
  const boot = () => document.querySelectorAll('[data-venom]').forEach(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

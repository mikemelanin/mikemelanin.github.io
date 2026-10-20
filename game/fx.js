// Слой эффектов игры на Phaser 3: неоновое свечение, частицы, ударные волны, тряска камеры и виньетка.
// Грузится только после кнопки Играть (loadFx в game.js), поэтому страницу не утяжеляет.
// Кадр по-прежнему рисует game.js на 2D canvas. Здесь он становится WebGL-текстурой, а второй canvas
// с яркими деталями (неон, огонь, радуга, ₽) размывается и складывается поверх – так получается свечение.
// Координаты в вызовах – логические единицы игры (высота сцены 320): эмиттеры масштабированы на unit.
// Phaser не крутит свой цикл: кадр рендерится из цикла игры через step(), чтобы эффекты шли синхронно.
window.MM_FX = ({ base, glow, dark }) => new Promise((resolve, reject) => {
  const P = window.Phaser;
  const hex = c => parseInt(c.slice(1), 16);
  const FIRE = ['#FFF3B0', '#FFD166', '#FFA552', '#D97757', '#E5484D'].map(hex);
  const RAINBOW = ['#FF5F6D', '#FFA552', '#FFE066', '#7CF29C', '#5EC8FF', '#A98BFF'].map(hex);
  const PARTY = ['#FF5F6D', '#FFE066', '#7CF29C', '#5EC8FF', '#A98BFF', '#D97757', '#FFFFFF'].map(hex);
  const MONEY = ['#7CF29C', '#B8F5C8', '#F5B544', '#FFFFFF'].map(hex);
  const RED = hex('#E5484D'), GREEN = hex('#7CF29C'), CLAWD = hex('#D97757');
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = list => list[Math.floor(Math.random() * list.length)];

  const canvas = document.createElement('canvas');
  canvas.className = 'rn-fx';
  canvas.setAttribute('aria-hidden', 'true');
  base.after(canvas);

  let game, settled = false;
  const fail = e => {
    if (settled) return;
    settled = true;
    try { game?.destroy(true); } catch {}
    canvas.remove();
    reject(e);
  };

  class FxScene extends P.Scene {
    create() {
      if (settled) return;
      let unit = 1, W = 800, dist = 0;

      // текстуры частиц рисуем на месте, без файлов
      const paint = (key, w, h, fn) => { const t = this.textures.createCanvas(key, w, h); fn(t.context, w, h); t.refresh(); };
      paint('dot', 32, 32, (c, w) => {
        const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
        g.addColorStop(0, '#fff'); g.addColorStop(.25, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(0, 0, w, w);
      });
      paint('spark', 32, 32, (c, w) => {
        const m = w / 2;
        c.fillStyle = '#fff'; c.beginPath(); c.moveTo(m, 0);
        c.quadraticCurveTo(m, m, w, m); c.quadraticCurveTo(m, m, m, w); c.quadraticCurveTo(m, m, 0, m); c.quadraticCurveTo(m, m, m, 0);
        c.fill();
      });
      paint('bit', 8, 5, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); });
      paint('ring', 64, 64, (c, w) => { c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 3, 0, Math.PI * 2); c.stroke(); });

      const frameTex = this.textures.addCanvas('frame', base);
      const glowTex = this.textures.addCanvas('glow', glow);
      const frame = this.add.image(0, 0, 'frame').setOrigin(0);
      // свечение в два слоя: плотное у самих деталей и широкий мягкий ореол
      const halos = [1.2, 3.2].map(s => {
        const im = this.add.image(0, 0, 'glow').setOrigin(0).setBlendMode(P.BlendModes.ADD);
        im.preFX.padding = 8;
        im.preFX.addBlur(1, 2, 2, s, 0xffffff, 4);
        return im;
      });
      const redout = this.add.rectangle(0, 0, 10, 10, RED).setOrigin(0).setAlpha(0);

      // world – частицы привязаны к миру и уезжают влево вместе с препятствиями
      const emitters = [];
      const em = (tex, cfg, world = false, glowy = true) => {
        const e = this.add.particles(0, 0, tex, { emitting: false, ...cfg });
        Object.assign(e, { world, glowy });
        emitters.push(e);
        return e;
      };
      const E = {
        coin: em('spark', { speed: { min: 40, max: 150 }, lifespan: { min: 300, max: 520 }, scale: { start: .5, end: 0 }, rotate: { min: 0, max: 90 }, tint: MONEY }, true),
        glint: em('spark', { speed: { min: 60, max: 220 }, lifespan: { min: 400, max: 750 }, scale: { start: .6, end: 0 }, rotate: { min: 0, max: 90 } }, true),
        boom: em('dot', { speed: { min: 70, max: 300 }, lifespan: { min: 280, max: 600 }, scale: { start: .6, end: 0 }, alpha: { start: .85, end: 0 }, gravityY: 160, tint: FIRE.slice(1) }, true),
        debris: em('bit', { speed: { min: 140, max: 380 }, angle: { min: 200, max: 340 }, gravityY: 900, lifespan: { min: 600, max: 1000 }, rotate: { start: 0, end: 540 }, scale: { min: .8, max: 1.3 } }, true, false),
        firework: em('dot', { speed: { min: 50, max: 240 }, lifespan: { min: 700, max: 1200 }, scale: { start: .5, end: 0 }, gravityY: 120 }),
        confetti: em('bit', { speedX: { min: -60, max: 60 }, speedY: { min: 30, max: 150 }, gravityY: 170, lifespan: { min: 2400, max: 3400 }, rotate: { start: 0, end: 720 }, scaleX: { min: .7, max: 1.4 }, scaleY: { min: .6, max: 1.2 }, tint: PARTY }, false, false),
        ember: em('dot', { frequency: 22, speedX: { min: -420, max: -200 }, speedY: { min: -60, max: 60 }, lifespan: { min: 200, max: 420 }, scale: { start: .55, end: 0 }, alpha: { start: .8, end: 0 }, tint: FIRE.slice(1) }),
        vibe: em('spark', { frequency: 30, speedX: { min: -320, max: -160 }, speedY: { min: -80, max: 80 }, lifespan: { min: 350, max: 650 }, scale: { start: .45, end: 0 }, rotate: { min: 0, max: 90 }, tint: RAINBOW })
      };
      // пылинки и светлячки в воздухе, только в тёмной теме
      const zone = new P.Geom.Rectangle(0, 16, 800, 230);
      E.motes = em('dot', {
        frequency: 240, lifespan: { min: 3500, max: 6000 }, speedX: { min: -36, max: -8 }, speedY: { min: -10, max: 6 },
        scale: { min: .12, max: .3 }, tint: [0xFFFFFF, 0xFFD166, 0x9FB4FF],
        alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.sin(t * Math.PI) * .5 },
        emitZone: { type: 'random', source: zone }
      });

      const cam = this.cameras.main;
      const vignette = cam.postFX.addVignette(.5, .5, .92, .22);
      const barrel = cam.postFX.addBarrel(1);

      const setTheme = d => {
        dark = d;
        halos[0].setAlpha(d ? .7 : .4);
        halos[1].setAlpha(d ? .55 : .28);
        vignette.active = d;
        emitters.forEach(e => e.setBlendMode(d && e.glowy ? P.BlendModes.ADD : P.BlendModes.NORMAL));
        if (!d) E.motes.stop();
      };
      setTheme(dark);

      const at = (e, x, y, n) => e.emitParticleAt(x + (e.world ? dist : 0), y, n);
      const ring = (x, y, color, size = 1.6, ms = 380) => {
        const r = this.add.image(x * unit, y * unit, 'ring').setTint(color).setScale(.1 * unit)
          .setBlendMode(dark ? P.BlendModes.ADD : P.BlendModes.NORMAL);
        this.tweens.add({ targets: r, scale: size * unit, alpha: 0, duration: ms, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
      };
      const punch = (amount, ms) => {
        this.tweens.killTweensOf(barrel);
        barrel.amount = 1;
        this.tweens.add({ targets: barrel, amount, duration: ms, yoyo: true, ease: 'Sine.easeOut' });
      };
      const flashRed = (alpha = .22) => {
        this.tweens.killTweensOf(redout);
        redout.setAlpha(alpha);
        this.tweens.add({ targets: redout, alpha: 0, duration: 420, ease: 'Quad.easeOut' });
      };
      const firework = (x, y) => {
        const c = pick(PARTY);
        E.firework.particleTint = c;
        at(E.firework, x, y, 34);
        ring(x, y, c, 1.3, 520);
      };
      const confetti = n => { for (let i = 0; i < n; i++) E.confetti.emitParticleAt(rand(0, W), rand(-40, -4), 1); };
      const show = (n, fn, gap = 220) => { for (let i = 0; i < n; i++) this.time.delayedCall(i * gap, fn); };

      const burst = (kind, x, y, color) => {
        const c = color ? hex(color) : 0xffffff;
        switch (kind) {
          case 'coin': at(E.coin, x, y, 7); break;
          case 'jump': E.glint.particleTint = CLAWD; at(E.glint, x, y, 6); break;
          case 'power': E.glint.particleTint = c; at(E.glint, x, y, 18); ring(x, y, c); break;
          case 'vibe':
            RAINBOW.forEach((rc, i) => this.time.delayedCall(i * 45, () => ring(x, y, rc, 1.2 + i * .25, 520)));
            E.glint.particleTint = 0xFFFFFF; at(E.glint, x, y, 14); punch(1.05, 160);
            break;
          case 'ultra': at(E.boom, x, y, 14); ring(x, y, FIRE[2], 2.6, 520); ring(x, y, FIRE[0], 1.6, 360); punch(1.08, 180); break;
          case 'save': E.glint.particleTint = c; at(E.glint, x, y, 24); ring(x, y, c, 2.2, 450); cam.shake(120, .003); break;
          case 'smash': at(E.boom, x, y, 12); E.debris.particleTint = c; at(E.debris, x, y, 10); ring(x, y, FIRE[2], 1.8); cam.shake(120, .004); break;
          case 'hit': at(E.boom, x, y, 14); E.debris.particleTint = c; at(E.debris, x, y, 14); ring(x, y, RED, 2, 420); cam.shake(260, .008); flashRed(); punch(1.06, 140); break;
          case 'arg': E.glint.particleTint = GREEN; at(E.glint, x, y, 16); ring(x, y, GREEN); break;
          case 'stage': confetti(70); break;
          case 'boss': cam.shake(520, .006); flashRed(.3); punch(1.06, 260); break;
          case 'approve': confetti(110); punch(1.08, 220); show(5, () => firework(rand(.15, .85) * W, rand(50, 150))); break;
          case 'win': confetti(140); show(7, () => firework(rand(.1, .9) * W, rand(40, 160)), 260); break;
          case 'firework': firework(x, y); break;
        }
      };

      const api = {
        canvas,
        burst,
        theme: setTheme,
        // w, h – размер кадра в пикселях, u – пикселей на логическую единицу, lw – ширина сцены в логических единицах
        resize: (w, h, u, lw, gw, gh) => {
          unit = u; W = lw;
          this.scale.resize(w, h);
          frameTex.setSize(w, h);
          glowTex.setSize(gw, gh);
          frame.setSizeToFrame();
          halos.forEach(im => { im.setSizeToFrame(); im.setDisplaySize(w, h); });
          redout.setSize(w, h);
          emitters.forEach(e => e.setScale(unit));
          zone.setTo(0, 16, W, 230);
        },
        // s: dist – пройденный путь, hx/hy – где сейчас Clawd, ultra/vibe – горит ли бонус, motes – пылинки
        step: (now, dt, s) => {
          dist = s.dist;
          emitters.forEach(e => { if (e.world) e.x = -dist * unit; });
          const flow = (e, on) => { if (on !== e.emitting) on ? e.start() : e.stop(); e.particleX = s.hx; e.particleY = s.hy; };
          flow(E.ember, !!s.ultra);
          flow(E.vibe, !!s.vibe && !s.ultra);
          if (dark && !!s.motes !== E.motes.emitting) s.motes ? E.motes.start() : E.motes.stop();
          frameTex.refresh();
          glowTex.refresh();
          this.game.step(now, Math.min(50, dt * 1000));
        },
        destroy: () => this.game.destroy(true)
      };
      this.game.loop.sleep();
      settled = true;
      resolve(api);
    }
  }

  try {
    game = new P.Game({
      type: P.WEBGL, canvas, width: base.width, height: base.height, transparent: true,
      banner: false, autoFocus: false, disableContextMenu: false,
      audio: { noAudio: true },
      input: { keyboard: false, mouse: false, touch: false, gamepad: false, windowEvents: false },
      scale: { mode: P.Scale.NONE },
      render: { antialias: true, powerPreference: 'high-performance' },
      callbacks: { postBoot: g => { if (g.renderer.type !== P.WEBGL) fail(new Error('no webgl')); } },
      scene: FxScene
    });
  } catch (e) { fail(e); }
  setTimeout(() => fail(new Error('fx timeout')), 8000);
});

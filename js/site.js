// Общий скрипт страниц: навигация, анимации героя, подход, таймлайн опыта.
(() => {
  const root = document.documentElement;
  const start = () => requestAnimationFrame(() => { root.classList.add('loaded'); if (window.__intro) window.__intro(); });
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 900))]).then(start);
  } else { start(); }

  // one fixed menu: shadow after scroll, current section highlighted
  const bar = document.querySelector('.topbar');
  if (bar) {
    const shade = () => bar.classList.toggle('is-scrolled', scrollY > 8);
    addEventListener('scroll', shade, { passive: true });
    shade();
    // подсвечиваем только якоря этой страницы, ссылки на другую страницу не трогаем
    const links = [...bar.querySelectorAll('.nav-links a')].filter(a => a.hash && a.pathname === location.pathname);
    if (links.length && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(a => a.classList.toggle('is-here', a.hash === '#' + e.target.id));
      }), { rootMargin: '-45% 0px -50% 0px' });
      ['top', ...links.map(a => a.hash.slice(1))].forEach(id => { const t = document.getElementById(id); if (t) io.observe(t); });
    }
  }

  const set = document.querySelector('.marquee-set');
  if (set) { const copy = set.cloneNode(true); copy.setAttribute('aria-hidden', 'true'); set.after(copy); }

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // пружина как в framer-motion (масса 1): кривая linear() для CSS и WAAPI и её длительность в мс
  const springEase = (k, c) => {
    let x = 0, v = 0, t = 0;
    const pts = [];
    while (t < 2 && (t < 0.1 || Math.abs(1 - x) > 0.001 || Math.abs(v) > 0.01)) {
      pts.push(+x.toFixed(4));
      for (let i = 0; i < 16; i++) { v += (k * (1 - x) - c * v) / 960; x += v / 960; }
      t += 1 / 60;
    }
    pts.push(1);
    const ok = window.CSS && CSS.supports('animation-timing-function', 'linear(0, 1)');
    return { duration: Math.round(t * 1000), easing: ok ? `linear(${pts.join(', ')})` : 'cubic-bezier(.2,.9,.3,1)' };
  };
  window.mmSpring = springEase;
  const onView = (el, fn, opts) => {
    if (!el) return;
    if (!('IntersectionObserver' in window)) return fn(true);
    new IntersectionObserver(([e]) => fn(e.isIntersecting), opts || { threshold: .35 }).observe(el);
  };
  const goJob = job => {
    job.open = true;
    job.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
  };

  // timeline: preview on hover, autoplay while visible
  const tl = document.querySelector('.timeline');
  const prev = document.querySelector('.tl-preview');
  const segs = [...document.querySelectorAll('.tl-seg')];
  if (tl && prev && segs.length) {
    const hover = matchMedia('(hover: hover)').matches;
    let cur = segs.length - 1, timer = null, inView = false, held = false, stopped = still;
    const show = i => {
      cur = i;
      const seg = segs[i], job = document.querySelector(seg.getAttribute('href'));
      segs.forEach(s => s.classList.toggle('is-active', s === seg));
      const role = job.querySelector('.job-role');
      const items = [...job.querySelectorAll('.job-body li')].slice(0, 3).map(li => '<li>' + li.innerHTML + '</li>').join('');
      prev.innerHTML =
        '<div><span class="tlp-years">' + job.querySelector('.job-years').textContent + '</span>' +
        '<div class="tlp-co">' + job.querySelector('.job-co').innerHTML + '</div></div>' +
        '<div><p class="tlp-role">' + role.firstChild.textContent + '</p><p class="tlp-sub">' + role.querySelector('span').textContent + '</p>' +
        '<ul>' + items + '</ul><a class="tlp-more" href="#' + job.id + '">Подробнее</a></div>';
      prev.hidden = false;
      if (tl.scrollWidth > tl.clientWidth) {
        tl.scrollTo({ left: seg.offsetLeft + seg.offsetWidth / 2 - tl.clientWidth / 2, behavior: still ? 'auto' : 'smooth' });
      }
    };
    const run = () => {
      clearTimeout(timer);
      const on = inView && !held && !stopped;
      tl.classList.toggle('is-auto', on);
      if (on) timer = setTimeout(() => { show((cur + 1) % segs.length); run(); }, 4500);
    };
    show(cur);
    onView(tl, v => { inView = v; run(); });
    segs.forEach((seg, i) => {
      seg.addEventListener('mouseenter', () => { if (hover) { held = true; show(i); run(); } });
      seg.addEventListener('focus', () => { held = true; show(i); run(); });
      seg.addEventListener('click', e => {
        e.preventDefault();
        if (hover) return goJob(document.querySelector(seg.getAttribute('href')));
        stopped = true; show(i); run();
      });
    });
    [tl, prev].forEach(el => {
      el.addEventListener('mouseenter', () => { if (hover) { held = true; run(); } });
      el.addEventListener('mouseleave', () => { if (hover) { held = false; run(); } });
    });
    prev.addEventListener('click', e => {
      const a = e.target.closest('.tlp-more');
      if (!a) return;
      e.preventDefault();
      stopped = true; run();
      goJob(document.querySelector(a.getAttribute('href')));
    });
  }

  // count-up figures, replayed while visible
  document.querySelectorAll('[data-count]').forEach(el => {
    const to = +el.dataset.count;
    if (still) return;
    el.textContent = '0';
    let vis = false, id = null;
    const play = () => {
      const t0 = performance.now(), dur = 1300;
      const tick = now => {
        const p = Math.min(1, (now - t0) / dur);
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    onView(el, v => {
      if (v === vis) return;
      vis = v;
      clearInterval(id);
      if (v) { play(); id = setInterval(() => { if (!document.hidden) play(); }, 6000); }
    }, { threshold: .6 });
  });

  // hero: speech bubble on the portrait leads to the AI twin
  const talk = document.querySelector('.portrait-talk');
  if (talk) {
    const say = () => talk.classList.add('is-on');
    setTimeout(say, still ? 0 : 2600);
    talk.addEventListener('click', e => {
      e.preventDefault();
      document.querySelector('#twin').scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
      setTimeout(() => document.querySelector('#twin-input').focus({ preventScroll: true }), still ? 0 : 900);
    });
  }

  // gravel route: freeze for reduced motion
  if (still) document.querySelectorAll('.route animateMotion').forEach(m => { const c = m.parentNode; m.remove(); c.setAttribute('cx', 6); c.setAttribute('cy', 54); });

  // hero: rolling industry (auto + click to step)
  const slot = document.querySelector('.slot');
  if (slot) {
    const word = slot.querySelector('.slot-w');
    const WORDS = ['банки', 'ритейл', 'фарму', 'страхование', 'телеком', 'FMCG', 'бизнес'];
    let idx = 0, heroVis = true, last = 0, busy = false;
    // пружины как в framer-motion: слово – жёсткость 260 и затухание 26, ширина окошка – 300 и 30
    const WORD = springEase(260, 26), WIDTH = springEase(300, 30);
    // старое слово уезжает вверх и расплывается, новое въезжает снизу из размытия, окошко подстраивает ширину
    const roll = async (text) => {
      const old = word.querySelector('.slot-i:not(.is-out)');
      const from = word.getBoundingClientRect().width;
      const next = document.createElement('span');
      next.className = 'slot-i is-in';
      next.textContent = text;
      word.append(next);
      const to = next.getBoundingClientRect().width;
      old.classList.add('is-out');
      const fx = { duration: WORD.duration, easing: WORD.easing, fill: 'forwards' };
      const gone = old.animate([{ transform: 'none', opacity: 1, filter: 'blur(0)' }, { transform: 'translateY(-100%)', opacity: 0, filter: 'blur(8px)' }], fx);
      const come = next.animate([{ transform: 'translateY(100%)', opacity: 0, filter: 'blur(8px)' }, { transform: 'none', opacity: 1, filter: 'blur(0)' }], WORD);
      const grow = word.animate([{ width: from + 'px' }, { width: to + 'px' }], { ...WIDTH, fill: 'forwards' });
      await Promise.all([gone.finished, come.finished, grow.finished]);
      old.remove();
      next.classList.remove('is-in');
      grow.cancel();
    };
    const step = async () => {
      if (busy) return;
      busy = true;
      last = Date.now();
      idx = (idx + 1) % WORDS.length;
      await roll(WORDS[idx]);
      busy = false;
    };
    slot.addEventListener('click', step);
    if (!still) {
      window.__intro = () => {
        onView(slot, v => heroVis = v, { threshold: 0 });
        last = Date.now();
        setInterval(() => {
          if (heroVis && !document.hidden && Date.now() - last > 2000) step();
        }, 250);
      };
    }
  }

  // approach: scroll story
  const story = document.querySelector('.story');
  if (story) {
    const sts = [...story.querySelectorAll('.st')];
    const rail = [...story.querySelectorAll('.rail button')];
    const desk = matchMedia('(min-width: 861px)');

    const scenes = {
      roi(stage) {
        const dots = [...stage.querySelectorAll('.plot i')];
        const count = stage.querySelector('.roi-count');
        const COUNT = count.innerHTML;
        let alive = true, timer;
        const later = (fn, ms) => { timer = setTimeout(() => alive && fn(), ms); };
        const scatter = () => {
          stage.classList.remove('is-sorted', 'is-scan');
          count.innerHTML = '<b>24</b> идеи от бизнеса';
          dots.forEach(d => {
            d.style.setProperty('--x', 8 + Math.random() * 84);
            d.style.setProperty('--y', 8 + Math.random() * 84);
          });
          later(() => { stage.classList.add('is-scan'); later(sort, 1400); }, 2600);
        };
        const sort = () => {
          stage.classList.add('is-sorted');
          later(() => { count.innerHTML = COUNT; }, 1700);
          later(scatter, 8000);
        };
        scatter();
        return () => { alive = false; clearTimeout(timer); stage.classList.remove('is-scan'); stage.classList.add('is-sorted'); count.innerHTML = COUNT; };
      },
      arch(stage) {
        const arch = stage.querySelector('.arch');
        const q = stage.querySelector('.arch-q');
        const Q0 = q.textContent;
        const rows = [...arch.querySelectorAll('.arch-row')];
        const mid = [...rows[2].children];
        const ASK = [
          ['Оператор: ', 'что ответить клиенту про возврат?', 1],
          ['Клиент: ', 'заблокируйте карту', 2],
          ['Юрист: ', 'кратко перескажи договор', 0],
          ['Сотрудник: ', 'какой лимит на командировки?', 1],
          ['CRM: ', 'разметь 300 обращений по темам', 0],
          ['Клиент: ', 'перенесите платёж на пятницу', 2]
        ];
        let alive = true, timer, n = 0;
        arch.classList.add('is-live');
        const hot = els => { arch.querySelectorAll('.is-hot').forEach(e => e.classList.remove('is-hot')); els.forEach(e => e.classList.add('is-hot')); };
        const run = () => {
          const [who, what, k] = ASK[n++ % ASK.length];
          q.innerHTML = who + '<em>' + what + '</em>';
          const path = [[rows[0].firstElementChild], [rows[1].firstElementChild], [mid[k]], [rows[3].firstElementChild], []];
          let s = 0;
          const next = () => {
            if (!alive) return;
            hot(path[s]);
            s++;
            timer = s < path.length ? setTimeout(next, 750) : setTimeout(run, 1800);
          };
          timer = setTimeout(next, 500);
        };
        run();
        return () => { alive = false; clearTimeout(timer); hot([]); arch.classList.remove('is-live'); q.textContent = Q0; };
      },
      poc(stage) {
        const chat = stage.querySelector('.poc-chat');
        const asks = [...stage.querySelectorAll('.poc-asks button')];
        const START = chat.innerHTML;
        const QA = [
          { q: 'Перевёл маме 15 000 ₽, а деньги не пришли', find: ['Регламент переводов, п. 4.1', 'Операции клиента'],
            a: 'Перевод на проверке безопасности, она занимает до 24 часов¹. Деньги не потерялись: зачислятся сегодня до 18:00. Прислать клиенту уведомление, когда дойдут?',
            meta: ['ответ за 1,3 с', '2 источника', '0,4 ₽ за запрос'] },
          { q: 'Списали 799 ₽ за подписку, которую я не оформлял', find: ['Регламент оспаривания, п. 2.1', 'Карточка клиента'],
            a: 'Можно оспорить: заявление принимается 120 дней, списание было 4 октября, срок есть¹. Черновик заявления уже заполнил, клиенту осталось подтвердить в приложении.',
            meta: ['ответ за 1,6 с', '2 источника', 'черновик заявления'] },
          { q: 'Украли телефон с картой, срочно!', find: ['Регламент блокировки карт'], tool: 'block_card •• 4417 ✓',
            a: 'Карта •• 4417 заблокирована, операций после 14:20 не было. Перевыпуск бесплатный, курьер привезёт за 2 дня¹. Отправить клиенту ссылку на выбор времени?',
            meta: ['ответ за 2,1 с', 'действие в АБС', 'оператор подтвердил'] }
        ];
        let alive = true, timers = [], cur = 0;
        const later = (fn, ms) => timers.push(setTimeout(() => alive && fn(), ms));
        const clear = () => { timers.forEach(clearTimeout); timers = []; };
        const el = (cls, html) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; chat.appendChild(d); return d; };
        const show = i => {
          clear(); cur = i;
          asks.forEach((b, j) => b.classList.toggle('is-on', j === i));
          const x = QA[i];
          chat.innerHTML = '';
          el('msg msg-q', '<span>Клиент</span>' + x.q);
          later(() => {
            const f = el('poc-find', 'Ищу в базе знаний<span class="dots"></span>');
            later(() => {
              f.innerHTML = 'Нашёл:';
              x.find.forEach((s, k) => later(() => { const b = document.createElement('b'); b.textContent = s; f.appendChild(b); }, k * 180));
              if (x.tool) later(() => { const b = document.createElement('b'); b.className = 'tool'; b.textContent = x.tool; f.appendChild(b); }, x.find.length * 180 + 250);
              later(() => {
                const m = el('msg msg-a', '<span class="cur"></span>');
                const words = x.a.split(' ');
                let k = 0;
                const tick = () => {
                  k++;
                  m.innerHTML = words.slice(0, k).join(' ').replace('¹', '<sup>1</sup>') + (k < words.length ? '<span class="cur"></span>' : '');
                  if (k < words.length) later(tick, 75);
                  else later(() => {
                    el('poc-meta', x.meta.map(s => '<b>' + s + '</b>').join(''));
                    later(() => show((cur + 1) % QA.length), 5500);
                  }, 250);
                };
                later(tick, 300);
              }, x.find.length * 180 + (x.tool ? 700 : 350));
            }, 1100);
          }, 600);
        };
        const onClick = e => { const i = asks.indexOf(e.target.closest('button')); if (i > -1) show(i); };
        stage.addEventListener('click', onClick);
        show(0);
        return () => { alive = false; clear(); stage.removeEventListener('click', onClick); chat.innerHTML = START; asks.forEach((b, j) => b.classList.toggle('is-on', j === 0)); };
      },
      dash(stage) {
        const poly = stage.querySelector('polyline');
        const area = stage.querySelector('.spark-area');
        const cnt = stage.querySelector('.dash-count');
        const lat = stage.querySelector('.dash-lat');
        let n = 18240;
        const pts = Array.from({ length: 30 }, (_, i) => 22 + Math.sin(i / 3) * 6 + Math.random() * 6);
        const draw = () => {
          const line = pts.map((v, i) => (i / (pts.length - 1) * 100).toFixed(1) + ',' + (40 - v).toFixed(1)).join(' ');
          poly.setAttribute('points', line);
          if (area) area.setAttribute('points', line + ' 100,40 0,40');
        };
        draw();
        const id = setInterval(() => {
          pts.shift();
          pts.push(Math.max(6, Math.min(36, pts[pts.length - 1] + (Math.random() - .45) * 8)));
          draw();
          n += 3 + Math.floor(Math.random() * 9);
          cnt.textContent = n.toLocaleString('ru-RU');
          lat.textContent = (1.1 + Math.random() * .25).toFixed(1).replace('.', ',') + ' с';
        }, 1200);
        return () => clearInterval(id);
      }
    };
    const stops = new Map();
    const activate = (st, on, play = on) => {
      st.classList.toggle('is-on', on);
      const stage = st.querySelector('[data-scene]');
      if (!stage || still) return;
      if (!play && stops.has(st)) { stops.get(st)(); stops.delete(st); }
      if (play && !stops.has(st)) stops.set(st, scenes[stage.dataset.scene](stage));
    };

    let active = -1, timer = null, inView = false, held = false;
    const railEl = story.querySelector('.rail');
    const DURS = [15000, 14000, 34000, 12000];
    rail.forEach((b, i) => b.style.setProperty('--dur', DURS[i] / 1000 + 's'));
    // плашка под активной вкладкой переезжает пружиной, шаги въезжают сбоку из лёгкого размытия
    const sp = (k, c) => { const e = springEase(k, c); return e.duration + 'ms ' + e.easing; };
    story.style.setProperty('--sp-pill', sp(420, 32));
    story.style.setProperty('--sp-st', sp(320, 32));
    const pill = document.createElement('span');
    pill.className = 'rail-pill';
    pill.setAttribute('aria-hidden', 'true');
    railEl.prepend(pill);
    const placePill = jump => {
      const b = rail[Math.max(0, active)];
      if (!b) return;
      if (jump) pill.style.transition = 'none';
      pill.style.width = b.offsetWidth + 'px';
      pill.style.transform = `translateX(${b.offsetLeft}px)`;
      if (jump) { pill.offsetWidth; pill.style.transition = ''; }
    };
    addEventListener('resize', () => placePill(true));
    const setActive = (i, force) => {
      if (i === active && !force) return;
      active = i;
      sts.forEach((s, j) => { activate(s, false); s.classList.toggle('is-past', j < i); });
      activate(sts[i], true, inView);
      rail.forEach((b, j) => b.classList.toggle('is-on', j === i));
      placePill(!pill.style.width);
    };
    const run = () => {
      clearTimeout(timer);
      const on = desk.matches && inView && !held && !still && !document.hidden;
      railEl.classList.remove('is-auto');
      if (!on) return;
      railEl.offsetWidth;
      railEl.classList.add('is-auto');
      timer = setTimeout(() => { setActive((active + 1) % sts.length); run(); }, DURS[active]);
    };
    rail.forEach((b, i) => b.addEventListener('click', () => { setActive(i, true); run(); }));
    story.querySelectorAll('.stage').forEach(s => {
      s.addEventListener('mouseenter', () => { held = true; run(); });
      s.addEventListener('mouseleave', () => { held = false; run(); });
    });
    onView(story, v => {
      inView = v;
      if (!desk.matches) return;
      const s = sts[active];
      if (s) activate(s, true, v);
      run();
    }, { threshold: .3 });
    document.addEventListener('visibilitychange', run);

    const mobileObs = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
      if (desk.matches) return;
      es.forEach(e => activate(e.target, e.isIntersecting));
    }, { threshold: .4 }) : null;
    const mode = () => {
      active = -1;
      clearTimeout(timer);
      sts.forEach(s => { activate(s, false); s.classList.remove('is-past'); });
      if (desk.matches) { if (mobileObs) mobileObs.disconnect(); setActive(0, true); run(); }
      else if (mobileObs) sts.forEach(s => mobileObs.observe(s));
      else sts.forEach(s => activate(s, true));
    };
    desk.addEventListener ? desk.addEventListener('change', mode) : desk.addListener(mode);
    mode();
  }

  // факты: карточки всплывают по очереди, числа докручиваются – каждое новое значение въезжает снизу из размытия
  const facts = document.querySelector('.teaser-facts');
  if (facts && !still) {
    const items = [...facts.children];
    const nums = items.map(li => {
      const st = li.querySelector('strong');
      const m = st.textContent.match(/^(\D*)(\d+)(.*)$/);
      if (!m) return null;
      st.innerHTML = '';
      const box = document.createElement('span');
      box.className = 'cd';
      const cur = document.createElement('span');
      cur.textContent = '0';
      box.append(cur);
      const shown = document.createElement('span'), sr = document.createElement('span');
      shown.setAttribute('aria-hidden', 'true');
      shown.append(m[1], box, m[3].replace(/^ /, '\u00a0'));
      sr.className = 'sr-only';
      sr.textContent = m[1] + m[2] + m[3];
      st.append(sr, shown);
      return { box, to: +m[2] };
    });
    facts.classList.add('is-waiting');
    const roll = (box, text) => {
      const old = box.lastElementChild, next = document.createElement('span');
      next.textContent = text;
      box.append(next);
      const blur = 'blur(4px)', fx = { duration: 250, easing: 'ease-out' };
      old.animate([{ transform: 'none', opacity: 1, filter: 'blur(0)' }, { transform: 'translateY(-.2em)', opacity: 0, filter: blur }], fx).finished.then(() => old.remove());
      next.animate([{ transform: 'translateY(.2em)', opacity: 0, filter: blur }, { transform: 'none', opacity: 1, filter: 'blur(0)' }], fx);
    };
    let played = false;
    onView(facts, v => {
      if (!v || played) return;
      played = true;
      facts.classList.remove('is-waiting');
      items.forEach((li, i) => li.animate([{ opacity: 0, transform: 'translateY(12px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 350, delay: i * 55, easing: 'ease-out', fill: 'backwards' }));
      nums.forEach((n, i) => {
        if (!n) return;
        // значения разгоняются и тормозят к цели, без повторов
        const steps = Math.min(n.to, 14), seen = new Set(['0']), vals = [];
        for (let k = 1; k <= steps; k++) {
          const e = 1 - Math.pow(1 - k / steps, 3);
          let v = Math.round(n.to * e);
          if (n.to >= 100) v = Math.round(v / 10) * 10;
          const t = String(k === steps ? n.to : v);
          if (!seen.has(t)) { seen.add(t); vals.push(t); }
        }
        vals.forEach((t, k) => setTimeout(() => roll(n.box, t), 200 + i * 55 + k * 95));
      });
    }, { threshold: .5 });
  }

  // абзацы, которые читаются при прокрутке: слово поднимается из размытия и темнеет от светло-серого до своего цвета
  const reads = [...document.querySelectorAll('[data-reveal]')];
  if (reads.length && !still) {
    const MUTED = [210, 210, 215];
    const rgb = el => getComputedStyle(el).color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    // каждое слово – в свой span прямо в тексте, поэтому ссылки и выделения внутри абзаца остаются на месте;
    // делим только по обычным пробелам, неразрывные склеивают слова, как и раньше
    const wrap = el => {
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [];
      while (walk.nextNode()) nodes.push(walk.currentNode);
      nodes.forEach(n => {
        if (!n.textContent.trim()) return;
        const frag = document.createDocumentFragment();
        n.textContent.split(/([ \t\n\r\f]+)/).forEach(w => {
          if (!w) return;
          if (!w.trim()) return frag.append(w);
          const sp = document.createElement('span');
          sp.className = 'rv';
          sp.textContent = w;
          frag.append(sp);
        });
        n.replaceWith(frag);
      });
      return [...el.querySelectorAll('.rv')];
    };
    const items = reads.map(el => {
      const spans = wrap(el), colors = new Map();
      const end = spans.map(sp => { const host = sp.parentElement; if (!colors.has(host)) colors.set(host, rgb(host)); return colors.get(host); });
      // окна слов внахлёст, как stagger .65 в оригинале: каждое слово занимает свой отрезок пути
      const start = 0, stop = 1, n = spans.length, total = stop - start;
      const win = total * (1 - (0.65 * (n - 1)) / n), step = n > 1 ? (total - win) / (n - 1) : 0;
      return { el, end, spans, ranges: spans.map((_, i) => [start + i * step, start + i * step + win]), pos: 0, vel: 0, shown: -1 };
    });
    // проявление начинается, когда абзац показался снизу, и заканчивается, когда его верх дошёл до середины экрана,
    // поэтому текст у самого низа страницы успевает проявиться без прокрутки до упора
    const target = it => {
      const r = it.el.getBoundingClientRect(), vh = innerHeight;
      return Math.max(0, Math.min(1, (vh * 0.95 - r.top) / (vh * 0.4)));
    };
    // перерисовываем только абзацы, которые сдвинулись: стили сотен слов на каждом кадре тормозили прокрутку
    const paint = it => {
      if (it.pos === it.shown) return;
      it.shown = it.pos;
      it.spans.forEach((sp, i) => {
        const [a, b] = it.ranges[i], t = Math.max(0, Math.min(1, (it.pos - a) / (b - a)));
        const c = MUTED.map((m, k) => Math.round(m + (it.end[i][k] - m) * t));
        sp.style.color = t < 1 ? `rgb(${c})` : '';
        sp.style.transform = t < 1 ? `translateY(${((1 - t) * 0.32).toFixed(3)}em)` : '';
        sp.style.filter = t < 1 ? `blur(${((1 - t) * 6).toFixed(2)}px)` : '';
      });
    };
    // прокрутка сглажена пружиной (жёсткость 110, затухание 22, масса 0.7), поэтому резкий рывок доигрывается плавно
    let raf = 0, prev = 0;
    const frame = now => {
      const dt = Math.min(0.05, (now - prev) / 1000 || 0.016);
      prev = now;
      let moving = false;
      // сначала все замеры, потом все записи стилей, чтобы браузер не пересчитывал раскладку на каждом абзаце
      const goals = items.map(target);
      items.forEach((it, j) => {
        const goal = goals[j];
        for (let i = 0; i < 4; i++) {
          const h = dt / 4, acc = (110 * (goal - it.pos) - 22 * it.vel) / 0.7;
          it.vel += acc * h; it.pos += it.vel * h;
        }
        if (Math.abs(goal - it.pos) < 0.0005 && Math.abs(it.vel) < 0.001) { it.pos = goal; it.vel = 0; } else moving = true;
        paint(it);
      });
      raf = moving ? requestAnimationFrame(frame) : 0;
    };
    const kick = () => { if (!raf) { prev = performance.now(); raf = requestAnimationFrame(frame); } };
    items.forEach(it => { it.pos = target(it); paint(it); });
    addEventListener('scroll', kick, { passive: true });
    addEventListener('resize', kick);
  }
})();

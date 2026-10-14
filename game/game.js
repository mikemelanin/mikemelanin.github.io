// Мини-игра "Доведите пилот до production": 8 развилок, 4 шкалы, любая на нуле – проект закрыт.
// Развилки берутся случайно из пулов по этапам, поэтому каждая партия немного другая.
// Шкалы: t – доверие бизнеса, b – бюджет, s – сроки, q – качество. Тексты правятся в STAGES.
(() => {
  const root = document.querySelector('.gm');
  if (!root) return;
  const TG = 'https://t.me/mike_melanin';
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MAX = 10, START = 6, PER_STAGE = 2;

  const METERS = [['t', 'Доверие бизнеса'], ['b', 'Бюджет'], ['s', 'Сроки'], ['q', 'Качество']];

  const STAGES = [
    { name: 'Discovery', pool: [
      { title: 'Правление хочет "ChatGPT для всего банка". С чего начнёте?', opts: [
        { t: 'Соберу идеи у бизнеса и выберу 3 задачи с эффектом в P&L', d: { t: 2, q: 1, s: -1 }, c: 'Дольше на старте, зато на комитете есть ответ на главный вопрос: сколько заработаем.' },
        { t: 'Куплю лицензии на всех и посмотрю, что взлетит', d: { b: -3, t: 1 }, c: 'Через квартал финансы спросят, что получили за эти деньги. Ответа не будет.' },
        { t: 'За неделю сделаю вау-демо для правления', d: { t: 3, q: -3 }, c: 'Правление в восторге, но ожидания теперь выше, чем умеет любой пилот.' }
      ] },
      { title: 'Как будете мерить успех пилота?', opts: [
        { t: 'Зафиксирую метрику и baseline до старта', d: { t: 1, q: 2, s: -1 }, set: 'baseline', c: 'Без baseline любой результат можно оспорить. С ним – защитить бюджет на масштаб.' },
        { t: 'Посчитаем потом, когда будет что показать', d: { s: 1, t: -3 }, c: 'Потом выяснится, что никто не помнит, как было до AI.' },
        { t: 'Спросим пользователей, нравится или нет', d: { s: 1, t: -2 }, c: 'Нравится – не метрика. Комитет спросит про деньги и время.' }
      ] },
      { title: 'Бизнес-заказчик уходит в отпуск на месяц в разгар discovery.', opts: [
        { t: 'Найду второго спонсора и зафиксирую решения письменно', d: { t: 2, s: -1 }, c: 'У проекта должно быть минимум два защитника. Один всегда в отпуске.' },
        { t: 'Подождём, без него решения не принять', d: { s: -3 }, c: 'Месяц простоя, и команду начинают забирать на другие задачи.' },
        { t: 'Продолжим сами, покажем результат по возвращении', d: { s: 1, t: -2, q: -2 }, c: 'Вернувшись, заказчик скажет: это не та задача.' }
      ] }
    ] },
    { name: 'Архитектура', pool: [
      { title: 'ИБ: данные клиентов во внешние модели не отдаём.', opts: [
        { t: 'Разверну open-weight модель в контуре', d: { b: -2, s: -1, t: 2 }, c: 'Дороже и дольше, но ИБ становится союзником, а не стоп-фактором.' },
        { t: 'Обезличу ПДн и пойду в облако', d: { t: 1, q: -1, s: -1 }, c: 'Рабочий компромисс, если юристы подписали. Часть контекста теряется при обезличивании.' },
        { t: 'Попрошу CEO продавить ИБ', d: { s: 1, t: -4 }, c: 'Сработает один раз. Следующее согласование займёт втрое дольше.' }
      ] },
      { title: 'Закупка GPU под закрытый контур займёт 4 месяца.', opts: [
        { t: 'Пилот на обезличенных данных в облаке, закупка параллельно', d: { s: 2, b: -2 }, c: 'Не ждём железо, но за переходный период платим дважды. Обычно оно того стоит.' },
        { t: 'Ждём железо', d: { s: -4 }, c: 'Четыре месяца тишины, и проект теряет приоритет.' },
        { t: 'Возьму модель поменьше под текущие серверы', d: { s: 2, q: -2 }, c: 'Быстро, но маленькая модель путается в сложных сценариях. Без evals не узнаете где.' }
      ] },
      { title: 'Интеграция с АБС: legacy, документации нет, вендор отвечает неделями.', opts: [
        { t: 'Пилот только на чтение, запись в АБС – вторым этапом', d: { s: 2, t: -1 }, c: 'Бизнес хотел полную автоматизацию, но так запуск реален. Это главное на пилоте.' },
        { t: 'Сразу полная интеграция с записью', d: { s: -3, q: 2 }, c: 'Самая длинная задача проекта. Пилот рискует до неё не дожить.' },
        { t: 'Пусть сотрудники копируют данные руками', d: { s: 1, t: -2, q: -2 }, c: 'Сотрудники быстро возненавидят такой AI.' }
      ] }
    ] },
    { name: 'Пилот', pool: [
      { title: 'База знаний: 12 000 документов, треть устарела.', opts: [
        { t: 'Назначу владельцев и почищу топ-200 самых частых', d: { s: -1, q: 3 }, c: 'Правило 80/20: двести документов закрывают большинство вопросов.' },
        { t: 'Загрузим всё, модель разберётся', d: { s: 1, q: -4 }, c: 'Модель уверенно цитирует регламент 2019 года.' },
        { t: 'Попрошу бизнес сначала вычистить всё', d: { s: -3, q: 2 }, c: 'Бизнес будет чистить полгода. Пилот столько не ждёт.' }
      ] },
      { title: 'На пилоте ассистент иногда выдумывает тарифы.', opts: [
        { t: 'Guardrails и evals на 500 реальных диалогах', d: { b: -2, q: 3 }, c: 'Галлюцинации не лечатся промптом. Их ловят тестами на ваших данных.' },
        { t: 'Допишу в промпт: не выдумывай', d: { q: -3 }, c: 'Промпт – это пожелание, а не контроль.' },
        { t: 'Отвечать только со ссылкой на источник, иначе – оператору', d: { q: 2, t: 1, s: -1 }, c: 'Меньше автоматизации, зато каждое слово можно проверить.' }
      ] },
      { title: 'Операторы саботируют: боятся, что AI их заменит.', opts: [
        { t: 'AI – подсказчик, их KPI растут, лучших делаю амбассадорами', d: { t: 3, s: -1 }, c: 'Change management съедает больше времени, чем модель. И это нормально.' },
        { t: 'Спущу приказ сверху', d: { s: 1, t: -3, q: -2 }, c: 'Будут пользоваться для галочки, а метрики пилота поплывут.' },
        { t: 'Не обращаю внимания, цифры всё покажут', d: { q: -2, t: -2 }, c: 'Цифры покажут, что ассистентом никто не пользуется.' }
      ] }
    ] },
    { name: 'Production', pool: [
      { title: 'Пилот дал +18% к скорости. Бизнес: давайте завтра на всю компанию!', opts: [
        { t: 'Масштабирую волнами, с SLA и мониторингом', d: { s: -1, q: 2, t: 1 }, set: 'sla', c: 'Каждая волна – новые сценарии и нагрузка. Мониторинг покажет проблемы раньше пользователей.' },
        { t: 'Раскатываем на всех в пятницу', d: { t: 2, q: -4 }, c: 'Пятничный релиз на 10 000 человек. Что может пойти не так.' },
        { t: 'Ещё три месяца пилота, чтобы наверняка', d: { s: -3, t: -2 }, c: 'Бизнес видел эффект и не понимает, почему ждать.' }
      ] },
      { title: 'После раскатки счёт за инференс вырос втрое.', opts: [
        { t: 'Роутинг: простое – на маленькую модель, плюс кэш', d: { b: 3, s: -1 }, c: 'Большинству запросов не нужна самая большая модель. Экономия в разы.' },
        { t: 'Урежу лимиты пользователям', d: { b: 2, t: -2 }, c: 'Деньги сэкономили, пользователи ушли обратно в Excel.' },
        { t: 'Попрошу ещё бюджет', d: { b: 2, t: -3 }, c: 'Дадут один раз. Второй вопрос будет: а вы вообще умеете считать?' }
      ] },
      { title: 'Сменился CIO. Новый спрашивает: зачем нам всё это?', opts: [
        { t: 'Покажу дашборд эффекта в деньгах против baseline', d: { t: -1 }, need: 'baseline', yes: { d: { t: 3 }, c: 'Baseline зафиксировали ещё в discovery, эффект доказан цифрами. Вопрос снят.' }, c: 'Дашборда нет: baseline не фиксировали, сравнивать не с чем.' },
        { t: 'Презентация про тренды AI и отчёты Gartner', d: { t: -2 }, c: 'Тренды не продают. Новому CIO нужен эффект в его бюджете.' },
        { t: 'Позову на встречу с сотрудниками, которые пользуются', d: { t: 2, s: -1 }, c: 'Живые пользователи убеждают лучше любых слайдов.' }
      ] },
      { title: 'Ночью упал сервис моделей, поддержка встала.', opts: [
        { t: 'Включаю fallback на операторов, утром разбор инцидента', d: { t: -1, q: 1 }, need: 'sla', yes: { d: { t: 1, q: 2 }, c: 'SLA и DR закладывали при масштабировании: переключение заняло две минуты.' }, c: 'Fallback собирали на ходу, утро было нервным. DR-тест теперь в плане.' },
        { t: 'Чиним молча, никому не говорим', d: { t: -4 }, c: 'Бизнес узнал от клиентов. Доверие восстанавливать дольше, чем сервис.' },
        { t: 'Откатываемся на старый процесс на месяц', d: { s: -3, t: -1 }, c: 'Месяц без AI – и команда уже сомневается, нужен ли он.' }
      ] }
    ] }
  ];

  const ENDS = {
    t: ['Бизнес потерял веру', 'Пилот закрыли на квартальном комитете. Технически всё работало, но защищать проект было некому.'],
    b: ['Бюджет кончился', 'Деньги закончились раньше, чем появился эффект. Следующий бюджетный цикл – через год.'],
    s: ['Окно закрылось', 'Проект затянулся, приоритеты сменились, команду забрали на другую задачу.'],
    q: ['Скандал с галлюцинацией', 'Ассистент пообещал клиенту несуществующий тариф, скриншот разошёлся по соцсетям. Проект на паузе.']
  };
  const RANKS = [
    [28, 'AI Transformation Lead', 'Бизнес доволен, ИБ на вашей стороне, бюджет под контролем. Так и выглядит production.'],
    [22, 'Крепкий delivery', 'Дошли, но пара шкал просела. На масштабе это аукнется.'],
    [0, 'На морально-волевых', 'В production, но ещё одна развилка – и проект бы закрыли.']
  ];

  // ---------- helpers ----------
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sign = n => (n > 0 ? '+' : '−') + Math.abs(n);
  const TG_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 18.7 19.5c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2l-11 6.9-4.7-1.5c-1-.3-1-1 .2-1.5L20.5 3c.9-.3 1.6.2 1.4 1.3Z"/></svg>';

  // ---------- layout ----------
  root.innerHTML = `
    <div class="gm-top">
      <ol class="gm-track">${STAGES.map(s => `<li>${s.name}</li>`).join('')}</ol>
      <div class="gm-meters">${METERS.map(([k, label]) => `
        <div class="gm-meter" data-k="${k}"><span>${label}<b class="gm-delta" aria-hidden="true"></b></span><i aria-hidden="true"></i></div>`).join('')}
      </div>
    </div>
    <div class="gm-card" aria-live="polite"></div>`;
  const card = root.querySelector('.gm-card');
  const track = [...root.querySelectorAll('.gm-track li')];
  const meterEls = Object.fromEntries([...root.querySelectorAll('.gm-meter')].map(m => [m.dataset.k, m]));

  let st, rounds, n;

  const paint = (delta = {}) => {
    METERS.forEach(([k, label]) => {
      const m = meterEls[k];
      m.style.setProperty('--v', st.m[k]);
      m.classList.toggle('is-low', st.m[k] <= 3);
      m.setAttribute('aria-label', `${label}: ${st.m[k]} из ${MAX}`);
      const b = m.querySelector('.gm-delta');
      if (delta[k]) {
        b.textContent = sign(delta[k]);
        b.className = 'gm-delta ' + (delta[k] > 0 ? 'is-up' : 'is-down');
        if (!still) { b.style.animation = 'none'; b.offsetWidth; b.style.animation = ''; }
      } else b.className = 'gm-delta';
    });
  };
  const paintTrack = stage => track.forEach((li, i) => {
    li.classList.toggle('is-done', i < stage);
    li.classList.toggle('is-on', i === stage);
  });

  const swap = html => {
    card.innerHTML = html;
    if (!still) { card.classList.remove('is-in'); card.offsetWidth; card.classList.add('is-in'); }
  };

  // ---------- screens ----------
  const intro = () => {
    st = { m: { t: START, b: START, s: START, q: START }, flags: new Set() };
    paint(); paintTrack(-1);
    swap(`
      <p class="gm-tag">Мини-игра на 2 минуты</p>
      <h3>Ваш проект: AI-ассистент для крупного банка</h3>
      <p class="gm-lead">Впереди ${STAGES.length * PER_STAGE} развилок от discovery до production. Каждое решение двигает четыре шкалы сверху. Если любая упадёт до нуля, проект закроют.</p>
      <button type="button" class="btn btn-blue gm-go" data-act="start">Начать</button>`);
  };

  const start = () => {
    rounds = STAGES.flatMap((s, i) => shuffle(s.pool.map((r, j) => [r, j])).slice(0, PER_STAGE).sort((a, b) => a[1] - b[1]).map(([r]) => ({ ...r, stage: i })));
    n = 0;
    show();
  };

  const show = () => {
    const r = rounds[n];
    paintTrack(r.stage);
    r.order = shuffle(r.opts);
    swap(`
      <p class="gm-tag">Развилка ${n + 1} из ${rounds.length} · ${STAGES[r.stage].name}</p>
      <h3>${esc(r.title)}</h3>
      <div class="gm-opts">${r.order.map((o, i) => `<button type="button" data-i="${i}"><span class="gm-key">${'ABC'[i]}</span>${esc(o.t)}</button>`).join('')}</div>
      <div class="gm-res" hidden></div>`);
  };

  const pick = i => {
    const r = rounds[n];
    const o = r.order[i];
    const lucky = o.need && st.flags.has(o.need);
    const d = lucky ? o.yes.d : o.d;
    const comment = lucky ? o.yes.c : o.c;
    if (o.set) st.flags.add(o.set);
    METERS.forEach(([k]) => { if (d[k]) st.m[k] = Math.max(0, Math.min(MAX, st.m[k] + d[k])); });
    paint(d);

    card.querySelectorAll('.gm-opts button').forEach((b, j) => { b.disabled = true; b.classList.toggle('is-picked', j === i); });
    const dead = METERS.find(([k]) => st.m[k] <= 0);
    const last = n === rounds.length - 1;
    const res = card.querySelector('.gm-res');
    const chips = METERS.filter(([k]) => d[k]).map(([k, label]) => `<b class="${d[k] > 0 ? 'is-up' : 'is-down'}">${label} ${sign(d[k])}</b>`).join('') || '<b>Шкалы без изменений</b>';
    res.innerHTML = `
      <div class="gm-chips">${chips}</div>
      <p class="gm-comment"><img src="img/photo.jpg" alt="" width="36" height="36"><span><strong>Михаил:</strong> ${esc(comment)}</span></p>
      <button type="button" class="btn btn-blue" data-act="next">${dead || last ? 'Чем всё кончилось' : 'Дальше'}</button>`;
    res.hidden = false;
    res.querySelector('[data-act]').focus({ preventScroll: true });
    if (res.getBoundingClientRect().bottom > innerHeight) res.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'nearest' });
  };

  const next = () => {
    const dead = METERS.find(([k]) => st.m[k] <= 0);
    if (dead) return end(dead[0]);
    if (++n >= rounds.length) return end(null);
    show();
  };

  const end = lost => {
    const score = METERS.reduce((s, [k]) => s + st.m[k], 0);
    let tag, title, text, msg;
    if (lost) {
      paintTrack(rounds[n].stage);
      tag = `Проект закрыт на этапе ${STAGES[rounds[n].stage].name}`;
      [title, text] = ENDS[lost];
      msg = `Сыграл в игру на вашем сайте, проект закрыли: ${title.toLowerCase()}. Хочу обсудить реальный пилот.`;
    } else {
      paintTrack(STAGES.length);
      const [, rank, about] = RANKS.find(([min]) => score >= min);
      tag = 'Пилот в production';
      title = rank;
      text = about;
      msg = `Довёл пилот до production в игре на вашем сайте (${rank}). Хочу обсудить реальный проект.`;
    }
    swap(`
      <p class="gm-tag">${tag}</p>
      <h3 class="gm-end ${lost ? 'is-lost' : 'is-won'}">${title}</h3>
      <p class="gm-lead">${text}</p>
      ${lost ? '' : `<p class="gm-score">Итог по шкалам: <strong>${score} из ${MAX * METERS.length}</strong></p>`}
      <p class="gm-note">Развилки взяты из реальных enterprise AI-проектов. В жизни их больше, и кнопки "Сыграть ещё" там нет.</p>
      <div class="gm-actions">
        <button type="button" class="btn btn-blue" data-act="again">Сыграть ещё</button>
        <a class="btn btn-line" href="${TG}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener" data-copy="${esc(msg)}">${TG_ICON}<span>Обсудить ваш пилот</span></a>
      </div>`);
  };

  card.addEventListener('click', e => {
    const opt = e.target.closest('.gm-opts button');
    if (opt && !opt.disabled) return pick(+opt.dataset.i);
    const act = e.target.closest('[data-act]');
    if (act) ({ start, next, again: () => { intro(); start(); } })[act.dataset.act]();
    const copy = e.target.closest('[data-copy]');
    if (copy && navigator.clipboard) navigator.clipboard.writeText(copy.dataset.copy).catch(() => {});
  });

  intro();
})();

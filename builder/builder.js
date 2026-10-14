// Конструктор AI-архитектуры: задача текстом или подсказкой, потом 3 вопроса, схема справа собирается по ходу.
// В конце – сроки и кнопки обсудить. Все цифры – ориентиры по опыту проектов, не смета.
// Тексты правятся в DATA и QUESTIONS, слова для распознавания задачи – в WORDS.
// Наружу: window.MM_BUILDER – задачи для подсказок двойника и open() для перехода в конструктор.
(() => {
  const root = document.querySelector('.bld');
  if (!root) return;
  const TG = 'https://t.me/mike_melanin';
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const DATA = {
    use: {
      support: {
        label: 'Агент поддержки клиентов', short: 'агент поддержки', hint: 'отвечает клиентам в чате и мессенджерах',
        channels: [['Чат на сайте и в приложении', 'клиенты'], ['Telegram и мессенджеры', 'клиенты'], ['Рабочее место оператора', 'подсказки и передача диалога']],
        core: [['Agent Runtime', 'сценарии, память диалога, передача человеку'], ['MCP и tools', 'статус заказа, карты, платежей']],
        data: [['Knowledge Layer', 'база ответов и регламентов'], ['CRM и биллинг', 'данные клиента через API']],
        pilot: [6, 8], level: 2, pdn: true
      },
      rag: {
        label: 'Ассистент по регламентам', short: 'ассистент по регламентам', hint: 'ищет ответы в документах компании',
        channels: [['Портал сотрудников', 'поиск и ответы'], ['Корпоративный мессенджер', 'бот для сотрудников']],
        core: [['RAG-пайплайн', 'поиск, ранжирование, ответ со ссылкой']],
        data: [['Knowledge Layer', 'чистка, версии, владельцы документов'], ['СЭД, Confluence, файлы', 'коннекторы и права доступа']],
        pilot: [4, 6], level: 1, pdn: false
      },
      speech: {
        label: 'Речевая аналитика колл-центра', short: 'речевая аналитика', hint: 'разбирает 100% звонков вместо выборки',
        channels: [['Телефония и записи звонков', 'поток или выгрузка'], ['BI-дашборды', 'для руководителей и QA']],
        core: [['ASR', 'распознавание речи и разметка ролей'], ['LLM-аналитика', 'чек-листы, темы, нарушения скрипта']],
        data: [['Хранилище транскриптов', 'поиск и выборки'], ['CRM', 'связка звонка с клиентом и сделкой']],
        pilot: [6, 8], level: 2, pdn: true
      },
      process: {
        label: 'Агент для бэк-офиса', short: 'агент для бэк-офиса', hint: 'обрабатывает заявки и документы',
        channels: [['Почта и СЭД', 'входящие документы и заявки'], ['Рабочее место сотрудника', 'проверка и согласование']],
        core: [['Agent Runtime', 'шаги процесса, проверки, человек в контуре'], ['MCP и tools', 'действия в учётных системах']],
        data: [['Извлечение из документов', 'OCR, поля, сверка'], ['ERP, АБС, СЭД', 'чтение и запись через API']],
        pilot: [8, 10], level: 3, pdn: true
      }
    },
    where: {
      cloud: { label: 'Облако', hint: 'быстрый старт, данные уходят провайдеру', frame: 'Облачные модели + ваш периметр', model: ['LLM по API', 'несколько провайдеров через роутинг'], add: [0, 0], level: 0 },
      hybrid: { label: 'Гибрид', hint: 'чувствительное внутри, остальное в облаке', frame: 'Чувствительное в контуре, остальное в облаке', model: ['Гибрид моделей', 'open-weight в контуре + облачные API'], add: [1, 2], level: .5 },
      onprem: { label: 'Закрытый контур', hint: 'всё внутри периметра, как любят банки', frame: 'Всё внутри защищённого контура заказчика', model: ['Open-weight LLM', 'на своих GPU, inference в контуре'], add: [2, 4], level: 1 }
    },
    scale: {
      team: { label: 'Один отдел', hint: 'до 500 пользователей', prod: [3, 4], level: 0, users: 'до 500 пользователей' },
      multi: { label: 'Несколько подразделений', hint: 'тысячи пользователей', prod: [4, 6], level: .5, users: 'тысячи пользователей' },
      all: { label: 'Вся компания', hint: '10 000+ пользователей', prod: [6, 9], level: 1, users: '10 000+ пользователей' }
    },
    pdn: {
      yes: { label: 'Да', hint: 'ФИО, телефоны, счета, записи звонков' },
      no: { label: 'Нет', hint: 'только внутренние документы и данные' }
    }
  };

  // слова, по которым задача из свободного текста попадает в один из вариантов (по началу слова)
  const WORDS = {
    support: ['клиент', 'поддерж', 'чат', 'обращен', 'оператор', 'мессенджер', 'бот', 'faq', 'вопрос', 'жалоб', 'support', 'контакт'],
    rag: ['документ', 'регламент', 'инструкц', 'база знан', 'поиск', 'найти', 'confluence', 'политик', 'норматив', 'сотрудник', 'знани', 'rag', 'ассистент'],
    speech: ['звон', 'колл', 'call', 'речев', 'разговор', 'запис', 'телефон', 'скрипт', 'контроль качеств', 'qa'],
    process: ['заявк', 'бэк', 'back', 'офис', 'счет', 'счёт', 'договор', 'накладн', 'документооборот', 'сэд', 'erp', '1с', 'обработ', 'автоматиз', 'процесс', 'сверк', 'кредит']
  };
  const matchUse = text => {
    const t = ' ' + text.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ') + ' ';
    let best = null, top = 0;
    Object.entries(WORDS).forEach(([k, ws]) => {
      const score = ws.filter(w => t.includes(' ' + w.replace(/ё/g, 'е'))).length;
      if (score > top) { top = score; best = k; }
    });
    return best;
  };

  const QUESTIONS = [
    { key: 'use', short: 'Задача', title: 'Какую задачу решаем?' },
    { key: 'where', short: 'Контур', title: 'Где должны работать модели?' },
    { key: 'scale', short: 'Масштаб', title: 'Сколько будет пользователей?' },
    { key: 'pdn', short: 'ПДн', title: 'Есть персональные данные клиентов?' }
  ];

  const state = { use: null, where: null, scale: null, pdn: null };
  let text = '', guessed = false, draft = '';
  let step = 0;
  let prev = new Set();

  root.innerHTML = `
    <div class="bld-q"></div>
    <div class="bld-out"><div class="bld-diagram" aria-live="polite"></div></div>`;
  const qEl = root.querySelector('.bld-q');
  const diagEl = root.querySelector('.bld-diagram');

  const firstOpen = () => { const i = QUESTIONS.findIndex(q => state[q.key] === null); return i < 0 ? QUESTIONS.length : i; };
  const range = ([a, b], unit) => `${a}–${b} ${unit}`;
  const add = (x, y) => [x[0] + y[0], x[1] + y[1]];
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clip = (s, n) => s.length > n ? s.slice(0, n - 1).trim() + '…' : s;
  const TG_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 18.7 19.5c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2l-11 6.9-4.7-1.5c-1-.3-1-1 .2-1.5L20.5 3c.9-.3 1.6.2 1.4 1.3Z"/></svg>';
  const RESET_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';

  const calc = () => {
    const u = DATA.use[state.use], w = DATA.where[state.where], s = DATA.scale[state.scale], pdn = state.pdn === 'yes';
    const pilot = add(add(u.pilot, w.add), pdn ? [1, 2] : [0, 0]);
    const prod = add(s.prod, state.where === 'onprem' ? [1, 2] : [0, 0]);
    const task = text ? `"${text}"` : u.short;
    const summary = `Собрал на сайте архитектуру. Задача: ${task}. ${w.label}, ${s.label.toLowerCase()} (${s.users})${pdn ? ', есть ПДн' : ''}. Хочу обсудить.`;
    return { u, w, s, pilot, prod, summary };
  };

  const reset = () => {
    Object.keys(state).forEach(k => state[k] = null);
    text = ''; draft = ''; guessed = false;
    step = 0; prev = new Set();
  };

  // ---------- question card ----------
  const head = open => `
    <div class="bld-top">
      <div class="bld-dots" aria-hidden="true">${QUESTIONS.map((_, i) => `<i class="${i < open ? 'is-done' : ''}${i === step ? ' is-on' : ''}"></i>`).join('')}</div>
      ${state.use ? `<button type="button" class="bld-reset" data-reset>${RESET_ICON}Заново</button>` : ''}
    </div>`;

  const renderQ = () => {
    const open = firstOpen();
    if (step === 0) {
      qEl.innerHTML = `
        ${head(open)}
        <p class="bld-step">Шаг 1 из ${QUESTIONS.length}</p>
        <h3 tabindex="-1">${QUESTIONS[0].title}</h3>
        <form class="bld-ask">
          <label class="sr-only" for="bld-text">Опишите задачу</label>
          <textarea id="bld-text" rows="3" placeholder="Своими словами: например, разгрузить колл-центр от типовых вопросов">${esc(draft || text)}</textarea>
          <button type="submit" class="btn btn-blue">Собрать схему</button>
        </form>
        <p class="bld-or">или начните с примера</p>
        <div class="bld-chips">${Object.entries(DATA.use).map(([k, o]) => `<button type="button" data-v="${k}"${state.use === k && !text ? ' class="is-on" aria-pressed="true"' : ''}>${o.label}</button>`).join('')}</div>`;
      return;
    }
    if (step < QUESTIONS.length) {
      const q = QUESTIONS[step];
      const usual = q.key === 'pdn' && state.use ? (DATA.use[state.use].pdn ? 'yes' : 'no') : null;
      qEl.innerHTML = `
        ${head(open)}
        <p class="bld-step">Шаг ${step + 1} из ${QUESTIONS.length}</p>
        <h3 tabindex="-1">${q.title}</h3>
        <div class="bld-opts">${Object.entries(DATA[q.key]).map(([k, o]) => `
          <button type="button" data-v="${k}"${state[q.key] === k ? ' class="is-on" aria-pressed="true"' : ''}>
            <strong>${o.label}${usual === k ? '<em>обычно для этой задачи</em>' : ''}</strong><span>${o.hint}</span>
          </button>`).join('')}
        </div>
        <button type="button" class="bld-back" data-back>← Назад</button>`;
      return;
    }
    const r = calc();
    const taskLabel = text ? clip(text, 60) : r.u.label;
    qEl.innerHTML = `
      ${head(open)}
      <p class="bld-step">Готово</p>
      <h3 tabindex="-1">${esc(taskLabel)}</h3>
      ${guessed ? `<p class="bld-guess">Ближе всего к шаблону: ${r.u.label.toLowerCase()}. Схема примерная.</p>` : ''}
      <ul class="bld-answers">${QUESTIONS.map((q, i) => `<li><span>${q.short}</span><button type="button" data-edit="${i}">${i === 0 && text ? esc(clip(text, 28)) : DATA[q.key][state[q.key]].label}</button></li>`).join('')}</ul>
      <p class="bld-time">Пилот <strong>${range(r.pilot, 'нед')}</strong>, production <strong>${range(r.prod, 'мес')}</strong></p>
      <div class="bld-actions">
        <a class="btn btn-blue" href="${TG}?text=${encodeURIComponent(r.summary)}" target="_blank" rel="noopener" data-copy="${esc(r.summary)}">${TG_ICON}<span>Обсудить в Telegram</span></a>
        <button type="button" class="bld-back" data-twin>Спросить AI-двойника</button>
      </div>
      <p class="bld-note">Ориентиры по опыту проектов. Точная оценка – после discovery на ваших данных.</p>`;
  };

  // ---------- diagram: fills in as answers come ----------
  const block = ([t, d], cls = '') => `<div class="bld-block ${cls}" data-k="${t}"><strong>${t}</strong><span>${d}</span></div>`;
  const wait = n => `<div class="bld-block is-wait">после шага ${n}</div>`;
  const row = (label, items) => `<div class="bld-row"><p class="bld-row-label">${label}</p><div class="bld-row-items">${items.join('')}</div></div>`;

  const renderDiagram = () => {
    const u = state.use && DATA.use[state.use], w = state.where && DATA.where[state.where];
    const pdn = state.pdn === 'yes';
    const gateway = !state.scale ? null : state.scale === 'team'
      ? ['AI Gateway', 'единая точка доступа, логи, лимиты']
      : ['AI Gateway и роутинг', 'балансировка, кэш, лимиты по командам'];
    const control = [];
    if (u) {
      if (pdn) control.push(['Обезличивание ПДн', 'ФЗ-152, до попадания в модель']);
      control.push(['Guardrails', 'фильтры на входе и выходе'], ['Evals', 'качество на ваших примерах'], ['Observability', 'трейсинг, стоимость, latency']);
      if (state.scale && (state.where !== 'cloud' || state.scale === 'all')) control.push(['SLA и DR', 'отказоустойчивость, RTO/RPO']);
    }
    diagEl.innerHTML = `
      <div class="bld-frame ${w ? 'bld-' + state.where : 'bld-pending'}">
        <p class="bld-frame-label">${w ? w.frame : u ? 'Контур – после шага 2' : 'Схема соберётся по вашим ответам'}</p>
        <div class="bld-main">
          ${u ? '<span class="bld-flow" aria-hidden="true"></span>' : ''}
          ${row('Каналы', u ? u.channels.map(c => block(c)) : [wait(1)])}
          ${row('Шлюз', gateway ? [block(gateway)] : [wait(3)])}
          ${row('Логика', u ? u.core.map(c => block(c, 'is-core')) : [wait(1)])}
          ${row('Модели', w ? [block(w.model, 'is-model')] : [wait(2)])}
          ${row('Данные', u ? u.data.map(c => block(c)) : [wait(1)])}
        </div>
        <div class="bld-rail">
          <p class="bld-row-label">Контроль</p>
          ${u ? control.map(c => block(c, c[0] === 'Обезличивание ПДн' ? 'is-pdn' : '')).join('') : wait(1)}
        </div>
      </div>`;

    // подсвечиваем блоки, которые появились после последнего ответа
    const now = new Set();
    diagEl.querySelectorAll('.bld-block[data-k]').forEach(b => {
      now.add(b.dataset.k);
      if (!prev.has(b.dataset.k) && !still) b.classList.add('is-new');
    });
    prev = now;
  };

  const render = focus => {
    renderQ();
    renderDiagram();
    if (focus) qEl.querySelector('h3').focus({ preventScroll: true });
  };

  const setTask = (use, t = '') => {
    text = t; draft = ''; guessed = false;
    if (!use) { use = matchUse(t) || 'rag'; guessed = !matchUse(t); }
    state.use = use;
    step = firstOpen();
  };

  qEl.addEventListener('submit', e => {
    e.preventDefault();
    const t = qEl.querySelector('textarea').value.trim().replace(/\s+/g, ' ');
    if (!t) { qEl.querySelector('textarea').focus(); return; }
    setTask(null, t);
    render(true);
  });
  qEl.addEventListener('input', e => { if (e.target.matches('textarea')) draft = e.target.value; });
  qEl.addEventListener('keydown', e => {
    if (e.target.matches('textarea') && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.form.requestSubmit(); }
  });

  qEl.addEventListener('click', e => {
    const opt = e.target.closest('[data-v]');
    if (opt) {
      if (step === 0) setTask(opt.dataset.v);
      else { state[QUESTIONS[step].key] = opt.dataset.v; step = firstOpen(); }
      return render(true);
    }
    const edit = e.target.closest('[data-edit]');
    if (edit) { step = +edit.dataset.edit; return render(true); }
    if (e.target.closest('[data-back]')) { step = Math.max(0, step - 1); return render(true); }
    if (e.target.closest('[data-reset]')) { reset(); return render(true); }
    if (e.target.closest('[data-twin]') && window.MM_TWIN) {
      const r = calc();
      window.MM_TWIN.ask(text ? `Есть задача: ${text}. ${r.w.label}, ${r.s.label.toLowerCase()}${state.pdn === 'yes' ? ', есть ПДн' : ''}.` : `Есть задача: ${r.u.short}. ${r.w.label}, ${r.s.label.toLowerCase()}${state.pdn === 'yes' ? ', есть ПДн' : ''}.`);
      return;
    }
    const a = e.target.closest('[data-copy]');
    if (a && navigator.clipboard) navigator.clipboard.writeText(a.dataset.copy).catch(() => {});
  });

  // для двойника: те же задачи-подсказки и переход в конструктор с выбранной задачей
  window.MM_BUILDER = {
    tasks: Object.entries(DATA.use).map(([id, o]) => ({ id, label: o.label, hint: o.hint, pilot: o.pilot })),
    open(use, t = '') {
      reset();
      setTask(use || null, t);
      render(false);
      const sec = document.getElementById('builder');
      sec.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
      setTimeout(() => qEl.querySelector('h3').focus({ preventScroll: true }), still ? 0 : 600);
    }
  };

  render(false);
})();

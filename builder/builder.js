// Конструктор AI-архитектуры: 4 вопроса по одному, схема справа собирается по мере ответов.
// Сроки, команда и риски появляются в конце. Все цифры – ориентиры по опыту проектов, не смета.
// Тексты правятся в DATA и QUESTIONS.
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
        pilot: [6, 8], level: 2, pdn: true,
        kpi: ['Доля диалогов без оператора', 'Среднее время обработки (AHT)', 'CSAT и доля эскалаций'],
        risks: ['Агент обещает то, чего нет в регламенте – нужны guardrails и evals на реальных диалогах', 'Слабая передача диалога оператору портит CSAT']
      },
      rag: {
        label: 'Ассистент по регламентам', short: 'ассистент по регламентам', hint: 'ищет ответы в документах компании',
        channels: [['Портал сотрудников', 'поиск и ответы'], ['Корпоративный мессенджер', 'бот для сотрудников']],
        core: [['RAG-пайплайн', 'поиск, ранжирование, ответ со ссылкой']],
        data: [['Knowledge Layer', 'чистка, версии, владельцы документов'], ['СЭД, Confluence, файлы', 'коннекторы и права доступа']],
        pilot: [4, 6], level: 1, pdn: false,
        kpi: ['Время поиска ответа', 'Доля ответов со ссылкой на источник', 'Нагрузка на экспертов и линию 2'],
        risks: ['Устаревшие документы дают уверенные неверные ответы – нужен владелец базы знаний', 'Права доступа: ассистент не должен показывать чужие документы']
      },
      speech: {
        label: 'Речевая аналитика колл-центра', short: 'речевая аналитика', hint: 'разбирает 100% звонков вместо выборки',
        channels: [['Телефония и записи звонков', 'поток или выгрузка'], ['BI-дашборды', 'для руководителей и QA']],
        core: [['ASR', 'распознавание речи и разметка ролей'], ['LLM-аналитика', 'чек-листы, темы, нарушения скрипта']],
        data: [['Хранилище транскриптов', 'поиск и выборки'], ['CRM', 'связка звонка с клиентом и сделкой']],
        pilot: [6, 8], level: 2, pdn: true,
        kpi: ['Доля проверенных звонков: 100% вместо выборки', 'Конверсия и соблюдение скрипта', 'Время QA-проверки'],
        risks: ['Качество ASR на шумных звонках – проверяем на ваших записях до старта', 'Записи звонков – персональные данные, обезличивание обязательно']
      },
      process: {
        label: 'Агент для бэк-офиса', short: 'агент для бэк-офиса', hint: 'обрабатывает заявки и документы',
        channels: [['Почта и СЭД', 'входящие документы и заявки'], ['Рабочее место сотрудника', 'проверка и согласование']],
        core: [['Agent Runtime', 'шаги процесса, проверки, человек в контуре'], ['MCP и tools', 'действия в учётных системах']],
        data: [['Извлечение из документов', 'OCR, поля, сверка'], ['ERP, АБС, СЭД', 'чтение и запись через API']],
        pilot: [8, 10], level: 3, pdn: true,
        kpi: ['Время обработки заявки', 'Доля заявок без ручной работы', 'Ошибки и возвраты'],
        risks: ['Агент с правом записи в учётные системы – нужен человек в контуре на старте', 'Интеграции с legacy-системами съедают больше всего времени']
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

  const QUESTIONS = [
    { key: 'use', short: 'Задача', title: 'Какую задачу решаем?' },
    { key: 'where', short: 'Контур', title: 'Где должны работать модели?' },
    { key: 'scale', short: 'Масштаб', title: 'Сколько будет пользователей?' },
    { key: 'pdn', short: 'ПДн', title: 'Есть персональные данные клиентов?' }
  ];

  const state = { use: null, where: null, scale: null, pdn: null };
  let step = 0;
  let prev = new Set();

  root.innerHTML = `
    <div class="bld-q"></div>
    <div class="bld-out">
      <div class="bld-diagram" aria-live="polite"></div>
      <div class="bld-lists" hidden></div>
    </div>`;
  const qEl = root.querySelector('.bld-q');
  const diagEl = root.querySelector('.bld-diagram');
  const listsEl = root.querySelector('.bld-lists');

  const firstOpen = () => { const i = QUESTIONS.findIndex(q => state[q.key] === null); return i < 0 ? QUESTIONS.length : i; };
  const range = ([a, b], unit) => `${a}–${b} ${unit}`;
  const add = (x, y) => [x[0] + y[0], x[1] + y[1]];
  const LEVELS = ['', 'Низкая', 'Умеренная', 'Средняя', 'Высокая', 'Очень высокая'];
  const TG_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 18.7 19.5c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2l-11 6.9-4.7-1.5c-1-.3-1-1 .2-1.5L20.5 3c.9-.3 1.6.2 1.4 1.3Z"/></svg>';

  const calc = () => {
    const u = DATA.use[state.use], w = DATA.where[state.where], s = DATA.scale[state.scale], pdn = state.pdn === 'yes';
    const pilot = add(add(u.pilot, w.add), pdn ? [1, 2] : [0, 0]);
    const prod = add(s.prod, state.where === 'onprem' ? [1, 2] : [0, 0]);
    const level = Math.max(1, Math.min(5, Math.round(u.level + w.level + s.level + (pdn ? .5 : 0))));
    const team = ['AI-архитектор', '2–3 FDE-инженера', 'Бизнес-аналитик'];
    if (state.where !== 'cloud') team.push('MLOps / DevOps');
    if (state.use === 'speech') team.push('Data-аналитик');
    if (pdn) team.push('ИБ заказчика с первого дня');
    if (state.scale === 'all') team.push('Владелец продукта от бизнеса');
    const risks = [...u.risks];
    if (state.where === 'onprem') risks.push('GPU и закупка железа – часто самый длинный срок, закладываем сразу');
    if (state.where === 'cloud' && pdn) risks.push('ПДн и облачные модели: нужна юридическая проверка и обезличивание');
    if (state.scale === 'all') risks.push('Масштаб на всю компанию упирается в change management, а не в модель');
    const summary = `Собрал на сайте архитектуру: ${u.short}, ${w.label.toLowerCase()}, ${s.label.toLowerCase()} (${s.users})${pdn ? ', есть ПДн' : ''}. Хочу обсудить.`;
    return { u, w, s, pilot, prod, level, team, risks, summary };
  };

  // ---------- question card ----------
  const renderQ = () => {
    const open = firstOpen();
    const dots = QUESTIONS.map((_, i) => `<i class="${i < open ? 'is-done' : ''}${i === step ? ' is-on' : ''}"></i>`).join('');
    if (step < QUESTIONS.length) {
      const q = QUESTIONS[step];
      const usual = q.key === 'pdn' && state.use ? (DATA.use[state.use].pdn ? 'yes' : 'no') : null;
      qEl.innerHTML = `
        <div class="bld-dots" aria-hidden="true">${dots}</div>
        <p class="bld-step">Вопрос ${step + 1} из ${QUESTIONS.length}</p>
        <h3 tabindex="-1">${q.title}</h3>
        <div class="bld-opts">${Object.entries(DATA[q.key]).map(([k, o]) => `
          <button type="button" data-v="${k}"${state[q.key] === k ? ' class="is-on" aria-pressed="true"' : ''}>
            <strong>${o.label}${usual === k ? '<em>обычно для этой задачи</em>' : ''}</strong><span>${o.hint}</span>
          </button>`).join('')}
        </div>
        ${step > 0 ? '<button type="button" class="bld-back" data-back>← Назад</button>' : ''}`;
      return;
    }
    const r = calc();
    qEl.innerHTML = `
      <div class="bld-dots" aria-hidden="true">${dots}</div>
      <p class="bld-step">Готово</p>
      <h3 tabindex="-1">${r.u.label}, ${r.w.label.toLowerCase()}</h3>
      <ul class="bld-answers">${QUESTIONS.map((q, i) => `<li><span>${q.short}</span><button type="button" data-edit="${i}">${DATA[q.key][state[q.key]].label}</button></li>`).join('')}</ul>
      <div class="bld-stats">
        <div class="bld-stat"><span>До пилота</span><strong>${range(r.pilot, 'нед')}</strong></div>
        <div class="bld-stat"><span>До production</span><strong>${range(r.prod, 'мес')}</strong></div>
        <div class="bld-stat"><span>Сложность</span><strong>${LEVELS[r.level]}</strong><i class="bld-meter" style="--v:${r.level}" aria-hidden="true"></i></div>
      </div>
      <div class="bld-actions">
        <a class="btn btn-blue" href="${TG}?text=${encodeURIComponent(r.summary)}" target="_blank" rel="noopener" data-copy="${r.summary}">${TG_ICON}<span>Обсудить эту архитектуру</span></a>
        <button type="button" class="bld-back" data-reset>Собрать заново</button>
      </div>
      <p class="bld-note">Ориентиры по опыту проектов. Точная оценка – после discovery на ваших данных.</p>`;
  };

  // ---------- diagram: fills in as answers come ----------
  const block = ([t, d], cls = '') => `<div class="bld-block ${cls}" data-k="${t}"><strong>${t}</strong><span>${d}</span></div>`;
  const wait = n => `<div class="bld-block is-wait">после вопроса ${n}</div>`;
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
        <p class="bld-frame-label">${w ? w.frame : u ? 'Контур – после вопроса 2' : 'Схема соберётся по вашим ответам'}</p>
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

    if (step === QUESTIONS.length) {
      const r = calc();
      listsEl.innerHTML = `
        <div class="bld-list bld-team"><h3>Команда</h3><ul>${r.team.map(t => `<li>${t}</li>`).join('')}</ul></div>
        <div class="bld-list"><h3>Метрики эффекта</h3><ul>${r.u.kpi.map(t => `<li>${t}</li>`).join('')}</ul></div>
        <div class="bld-list bld-risks"><h3>Главные риски</h3><ul>${r.risks.map(t => `<li>${t}</li>`).join('')}</ul></div>`;
      listsEl.hidden = false;
    } else listsEl.hidden = true;
  };

  const render = focus => {
    renderQ();
    renderDiagram();
    if (focus) qEl.querySelector('h3').focus({ preventScroll: true });
  };

  qEl.addEventListener('click', e => {
    const opt = e.target.closest('[data-v]');
    if (opt) {
      state[QUESTIONS[step].key] = opt.dataset.v;
      step = firstOpen();
      return render(true);
    }
    const edit = e.target.closest('[data-edit]');
    if (edit) { step = +edit.dataset.edit; return render(true); }
    if (e.target.closest('[data-back]')) { step = Math.max(0, step - 1); return render(true); }
    if (e.target.closest('[data-reset]')) {
      Object.keys(state).forEach(k => state[k] = null);
      step = 0; prev = new Set();
      return render(true);
    }
    const a = e.target.closest('[data-copy]');
    if (a && navigator.clipboard) navigator.clipboard.writeText(a.dataset.copy).catch(() => {});
  });

  render(false);
})();

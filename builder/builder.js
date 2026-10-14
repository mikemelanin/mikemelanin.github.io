// Конструктор AI-архитектуры: задача + контур + масштаб -> схема, сроки, команда, риски.
// Все цифры – ориентиры по опыту проектов, не смета. Тексты правятся в DATA.
(() => {
  const root = document.querySelector('.bld');
  if (!root) return;
  const TG = 'https://t.me/mike_melanin';
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const DATA = {
    use: {
      support: {
        label: 'Агент поддержки клиентов', short: 'агент поддержки',
        channels: [['Чат на сайте и в приложении', 'клиенты'], ['Telegram и мессенджеры', 'клиенты'], ['Рабочее место оператора', 'подсказки и передача диалога']],
        core: [['Agent Runtime', 'сценарии, память диалога, передача человеку'], ['MCP и tools', 'статус заказа, карты, платежей']],
        data: [['Knowledge Layer', 'база ответов и регламентов'], ['CRM и биллинг', 'данные клиента через API']],
        pilot: [6, 8], level: 2, pdn: true,
        kpi: ['Доля диалогов без оператора', 'Среднее время обработки (AHT)', 'CSAT и доля эскалаций'],
        risks: ['Агент обещает то, чего нет в регламенте – нужны guardrails и evals на реальных диалогах', 'Слабая передача диалога оператору портит CSAT']
      },
      rag: {
        label: 'Ассистент по регламентам', short: 'ассистент по регламентам',
        channels: [['Портал сотрудников', 'поиск и ответы'], ['Корпоративный мессенджер', 'бот для сотрудников']],
        core: [['RAG-пайплайн', 'поиск, ранжирование, ответ со ссылкой']],
        data: [['Knowledge Layer', 'чистка, версии, владельцы документов'], ['СЭД, Confluence, файлы', 'коннекторы и права доступа']],
        pilot: [4, 6], level: 1, pdn: false,
        kpi: ['Время поиска ответа', 'Доля ответов со ссылкой на источник', 'Нагрузка на экспертов и линию 2'],
        risks: ['Устаревшие документы дают уверенные неверные ответы – нужен владелец базы знаний', 'Права доступа: ассистент не должен показывать чужие документы']
      },
      speech: {
        label: 'Речевая аналитика колл-центра', short: 'речевая аналитика',
        channels: [['Телефония и записи звонков', 'поток или выгрузка'], ['BI-дашборды', 'для руководителей и QA']],
        core: [['ASR', 'распознавание речи и разметка ролей'], ['LLM-аналитика', 'чек-листы, темы, нарушения скрипта']],
        data: [['Хранилище транскриптов', 'поиск и выборки'], ['CRM', 'связка звонка с клиентом и сделкой']],
        pilot: [6, 8], level: 2, pdn: true,
        kpi: ['Доля проверенных звонков: 100% вместо выборки', 'Конверсия и соблюдение скрипта', 'Время QA-проверки'],
        risks: ['Качество ASR на шумных звонках – проверяем на ваших записях до старта', 'Записи звонков – персональные данные, обезличивание обязательно']
      },
      process: {
        label: 'Агент для бэк-офиса', short: 'агент для бэк-офиса',
        channels: [['Почта и СЭД', 'входящие документы и заявки'], ['Рабочее место сотрудника', 'проверка и согласование']],
        core: [['Agent Runtime', 'шаги процесса, проверки, человек в контуре'], ['MCP и tools', 'действия в учётных системах']],
        data: [['Извлечение из документов', 'OCR, поля, сверка'], ['ERP, АБС, СЭД', 'чтение и запись через API']],
        pilot: [8, 10], level: 3, pdn: true,
        kpi: ['Время обработки заявки', 'Доля заявок без ручной работы', 'Ошибки и возвраты'],
        risks: ['Агент с правом записи в учётные системы – нужен человек в контуре на старте', 'Интеграции с legacy-системами съедают больше всего времени']
      }
    },
    where: {
      cloud: { label: 'Облако', frame: 'Облачные модели + ваш периметр', model: ['LLM по API', 'несколько провайдеров через роутинг'], add: [0, 0], level: 0 },
      hybrid: { label: 'Гибрид', frame: 'Чувствительное в контуре, остальное в облаке', model: ['Гибрид моделей', 'open-weight в контуре + облачные API'], add: [1, 2], level: .5 },
      onprem: { label: 'Закрытый контур', frame: 'Всё внутри защищённого контура заказчика', model: ['Open-weight LLM', 'на своих GPU, inference в контуре'], add: [2, 4], level: 1 }
    },
    scale: {
      team: { label: 'Один отдел', prod: [3, 4], level: 0, users: 'до 500 пользователей' },
      multi: { label: 'Несколько подразделений', prod: [4, 6], level: .5, users: 'тысячи пользователей' },
      all: { label: 'Вся компания', prod: [6, 9], level: 1, users: '10 000+ пользователей' }
    }
  };

  const state = { use: 'support', where: 'onprem', scale: 'multi', pdn: true };
  const form = root.querySelector('.bld-controls');
  const out = root.querySelector('.bld-out');

  // ---------- controls ----------
  const group = (name, legend, opts) => `
    <fieldset class="bld-group">
      <legend>${legend}</legend>
      <div class="bld-opts">${Object.entries(opts).map(([k, o]) => `
        <label class="bld-opt"><input type="radio" name="${name}" value="${k}"${state[name] === k ? ' checked' : ''}><span>${o.label}</span></label>`).join('')}
      </div>
    </fieldset>`;
  form.innerHTML =
    group('use', 'Задача', DATA.use) +
    group('where', 'Где работают модели', DATA.where) +
    group('scale', 'Масштаб', DATA.scale) +
    `<label class="bld-switch"><input type="checkbox" name="pdn"${state.pdn ? ' checked' : ''}><span class="bld-toggle" aria-hidden="true"></span><span>Есть персональные данные клиентов</span></label>`;

  form.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'pdn') state.pdn = t.checked;
    else {
      state[t.name] = t.value;
      if (t.name === 'use') { state.pdn = DATA.use[t.value].pdn; form.querySelector('[name=pdn]').checked = state.pdn; }
    }
    render();
  });

  // ---------- output ----------
  const range = ([a, b], unit) => `${a}–${b} ${unit}`;
  const add = (x, y) => [x[0] + y[0], x[1] + y[1]];
  let prev = new Set();

  const block = ([t, d], cls = '') => `<div class="bld-block ${cls}" data-k="${t}"><strong>${t}</strong><span>${d}</span></div>`;
  const row = (label, items) => `<div class="bld-row"><p class="bld-row-label">${label}</p><div class="bld-row-items">${items.join('')}</div></div>`;

  const render = () => {
    const u = DATA.use[state.use], w = DATA.where[state.where], s = DATA.scale[state.scale];

    const gateway = state.scale === 'team'
      ? ['AI Gateway', 'единая точка доступа, логи, лимиты']
      : ['AI Gateway и роутинг', 'балансировка, кэш, лимиты по командам'];
    const control = [
      ['Guardrails', 'фильтры на входе и выходе'],
      ['Evals', 'качество на ваших примерах'],
      ['Observability', 'трейсинг, стоимость, latency']
    ];
    if (state.pdn) control.unshift(['Обезличивание ПДн', 'ФЗ-152, до попадания в модель']);
    if (state.where !== 'cloud' || state.scale === 'all') control.push(['SLA и DR', 'отказоустойчивость, RTO/RPO']);

    const diagram = `
      <div class="bld-frame bld-${state.where}">
        <p class="bld-frame-label">${w.frame}</p>
        <div class="bld-main">
          <span class="bld-flow" aria-hidden="true"></span>
          ${row('Каналы', u.channels.map(c => block(c)))}
          ${row('Шлюз', [block(gateway)])}
          ${row('Логика', u.core.map(c => block(c, 'is-core')))}
          ${row('Модели', [block(w.model, 'is-model')])}
          ${row('Данные', u.data.map(c => block(c)))}
        </div>
        <div class="bld-rail">
          <p class="bld-row-label">Контроль</p>
          ${control.map(c => block(c, c[0] === 'Обезличивание ПДн' ? 'is-pdn' : '')).join('')}
        </div>
      </div>`;

    const pilot = add(add(u.pilot, w.add), state.pdn ? [1, 2] : [0, 0]);
    const prod = add(s.prod, state.where === 'onprem' ? [1, 2] : [0, 0]);
    const level = Math.max(1, Math.min(5, Math.round(u.level + w.level + s.level + (state.pdn ? .5 : 0))));
    const LEVELS = ['', 'Низкая', 'Умеренная', 'Средняя', 'Высокая', 'Очень высокая'];

    const team = ['AI-архитектор', '2–3 FDE-инженера', 'Бизнес-аналитик'];
    if (state.where !== 'cloud') team.push('MLOps / DevOps');
    if (state.use === 'speech') team.push('Data-аналитик');
    if (state.pdn) team.push('ИБ заказчика с первого дня');
    if (state.scale === 'all') team.push('Владелец продукта от бизнеса');

    const risks = [...u.risks];
    if (state.where === 'onprem') risks.push('GPU и закупка железа – часто самый длинный срок, закладываем сразу');
    if (state.where === 'cloud' && state.pdn) risks.push('ПДн и облачные модели: нужна юридическая проверка и обезличивание');
    if (state.scale === 'all') risks.push('Масштаб на всю компанию упирается в change management, а не в модель');

    const stats = `
      <div class="bld-stat"><span>До пилота</span><strong>${range(pilot, 'нед')}</strong></div>
      <div class="bld-stat"><span>До production</span><strong>${range(prod, 'мес')}</strong></div>
      <div class="bld-stat"><span>Сложность</span><strong>${LEVELS[level]}</strong><i class="bld-meter" style="--v:${level}" aria-hidden="true"></i></div>`;

    const lists = `
      <div class="bld-list bld-team"><h3>Команда</h3><ul>${team.map(t => `<li>${t}</li>`).join('')}</ul></div>
      <div class="bld-list"><h3>Метрики эффекта</h3><ul>${u.kpi.map(t => `<li>${t}</li>`).join('')}</ul></div>
      <div class="bld-list bld-risks"><h3>Главные риски</h3><ul>${risks.map(t => `<li>${t}</li>`).join('')}</ul></div>`;

    const summary = `Собрал на сайте архитектуру: ${u.short}, ${w.label.toLowerCase()}, ${s.label.toLowerCase()} (${s.users})${state.pdn ? ', есть ПДн' : ''}. Хочу обсудить.`;
    const cta = `
      <p>Ориентиры по опыту проектов. Точная оценка – после discovery на ваших данных.</p>
      <a class="btn btn-blue" href="${TG}?text=${encodeURIComponent(summary)}" target="_blank" rel="noopener" data-copy="${summary}"><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 18.7 19.5c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2l-11 6.9-4.7-1.5c-1-.3-1-1 .2-1.5L20.5 3c.9-.3 1.6.2 1.4 1.3Z"/></svg><span>Обсудить эту архитектуру</span></a>`;

    out.querySelector('.bld-diagram').innerHTML = diagram;
    out.querySelector('.bld-stats').innerHTML = stats;
    out.querySelector('.bld-lists').innerHTML = lists;
    out.querySelector('.bld-cta').innerHTML = cta;

    // подсвечиваем блоки, которые появились после последнего выбора
    const now = new Set();
    out.querySelectorAll('.bld-block').forEach(b => {
      now.add(b.dataset.k);
      if (prev.size && !prev.has(b.dataset.k) && !still) b.classList.add('is-new');
    });
    prev = now;
  };

  out.addEventListener('click', e => {
    const a = e.target.closest('[data-copy]');
    if (a && navigator.clipboard) navigator.clipboard.writeText(a.dataset.copy).catch(() => {});
  });

  render();
})();

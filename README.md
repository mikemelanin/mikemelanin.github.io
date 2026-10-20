# Mike Melanin CV

Папка для HTML/PDF CV и связанных публичных материалов профиля.

## Project Map

- `index.html` + `img/` - главная https://mikemelanin.github.io/: герой, подход с анимациями, игра, AI-двойник и контакты. Меню одно на всех страницах (`.topbar`).
- `experience.html` - опыт (таймлайн и места работы), ключевые проекты, навыки.
- `css/site.css`, `js/site.js` - общие стили и скрипт обеих страниц.
- `game/game.js` - игра-раннер на canvas с героем Clawd (маскот Claude Code): этапы в `STAGES`, препятствия в `KINDS`, финальный босс-инвесткомитет в `BOSS`, реплики героя в `QUIPS`, советы при проигрыше в `ENDS`. Музыка и звуки – WebAudio, без файлов.
- `game/fx.js` + `game/vendor/phaser-3.90.0.min.js` - слой эффектов на Phaser: свечение, частицы, тряска. Грузится только по кнопке Играть; если WebGL нет, игра идёт без него.
- `cv/index.html` - HTML-версия CV для печати.
- `builder/builder.js` - конструктор AI-архитектуры, сейчас скрыт: чтобы вернуть, добавить в `index.html` секцию `#builder` с `<div class="bld"></div>` и подключить скрипт до `twin/twin.js`.
- `twin/` - AI-двойник: `kb.js` база ответов (правится руками), `twin.js` чат. Кнопки-вопросы отвечают из базы, свободные вопросы идут в LLM через `ENDPOINT`, при сбое – снова база.
- `worker/` - бэкенд двойника на Cloudflare Workers (https://mike-twin.m-v-melanin.workers.dev): промпт из `twin/kb.js`, модель NeuralDeep (`wrangler.toml`), пускает только запросы с mikemelanin.github.io, 20 вопросов в час с IP и 300 в день всего. Ключ – секрет `LLM_KEY` в Cloudflare, в репо его нет.
- `cv/img/` - изображения для HTML-версии.
- `.gitignore` - правила исключения локальных файлов.

## Рабочий порядок

- HTML в `index.html`, `experience.html` и `cv/index.html` (CV) считать редактируемыми источниками.
- Локально: `python3 -m http.server 8765` в этой папке, затем http://localhost:8765/.
- PDF для кнопки Скачать CV: после правок `cv/index.html` запустить `scripts/build-cv-pdf.sh`.
- Публикация: push в `main` – GitHub Pages обновляется сам.
- После правок `twin/kb.js` передеплоить двойника, иначе LLM будет знать старую базу: `cd worker && npx wrangler@4 deploy`.
- PDF считать экспортом или отдельной сохраненной версией.
- Перед изменениями публичных материалов проверять, какая версия сейчас актуальна.

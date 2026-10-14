# Mike Melanin CV

Папка для HTML/PDF CV и связанных публичных материалов профиля.

## Project Map

- `index.html` + `img/` - главная https://mikemelanin.github.io/: герой, конструктор, игра, AI-двойник и контакты.
- `experience.html` - опыт и кейсы: подход, проекты, карьера, навыки.
- `css/site.css`, `js/site.js` - общие стили и скрипт обеих страниц.
- `game/game.js` - мини-игра: развилки, шкалы и концовки в `STAGES`, `ENDS`, `RANKS`.
- `cv/index.html` - HTML-версия CV для печати.
- `builder/builder.js` - конструктор AI-архитектуры: варианты, сроки, риски и метрики в `DATA`.
- `twin/` - AI-двойник: `kb.js` база ответов (правится руками), `twin.js` чат. Для LLM вписать адрес бэкенда в `ENDPOINT` в `twin.js`.
- `cv/img/` - изображения для HTML-версии.
- `.gitignore` - правила исключения локальных файлов.

## Рабочий порядок

- HTML в `index.html`, `experience.html` и `cv/index.html` (CV) считать редактируемыми источниками.
- Локально: `python3 -m http.server 8765` в этой папке, затем http://localhost:8765/.
- PDF для кнопки Скачать CV: после правок `cv/index.html` запустить `scripts/build-cv-pdf.sh`.
- Публикация: push в `main` – GitHub Pages обновляется сам.
- PDF считать экспортом или отдельной сохраненной версией.
- Перед изменениями публичных материалов проверять, какая версия сейчас актуальна.

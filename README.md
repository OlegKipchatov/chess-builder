# GachaChess · React migration

Устанавливаемые офлайн-шахматы с коллекционными фигурами, адаптивным ИИ, разбором партий, «Охотой», Autochess и PvE. Русский интерфейс и локальный прогресс без обязательного сервера.

Эта ветка содержит архитектурную миграцию v132 на React и TypeScript. Проверка полного визуального и браузерного соответствия ещё не завершена. Публичная версия GitHub Pages не заменяется этой веткой.

## Разработка

Нужен Node.js 22.12+ (или поддерживаемый более новый LTS).

```sh
npm ci
npm run dev
```

`predev` и `prebuild` подготавливают закреплённые Stockfish 19 WASM/NNUE в `public/vendor/`, проверяя контрольные суммы. После первой подготовки файлы используются локально. Бинарники не хранятся в git. Нужен доступ к источникам, указанным в `scripts/prepare-stockfish19.mjs`. Лицензия, исходники и инструкции доступны в `public/engine-info.html`.

```sh
npm run typecheck
npm run lint
npm test
npm run motion:check
npm run build
```

`npm test` сначала собирает приложение, затем запускает доменные регрессии Node/tsx и React/Vitest/Testing Library. `npm run test:unit` и `npm run test:react` запускают слои отдельно. PWA-тестам нужен свежий `dist/`.

Для Chromium в обычной среде разработки или CI:

```sh
npx playwright install --with-deps chromium
npm run test:pwa:browser
npm run test:stockfish:browser
npm run test:pwa:single
```

В управляемой среде ChatGPT Sites локальная браузерная проверка выполняется только предусмотренным окружением способом; отсутствие браузера не считается успешной проверкой. Ограничения текущей проверки записаны в [инвентаризации](docs/react-migration/inventory.md).

## Архитектура

React управляет всей структурой интерфейса. Vite генерирует `dist/`; редактировать его нельзя. TanStack Router использует hash history для прямых ссылок на GitHub Pages. Тяжёлые страницы и Worker загружаются по требованию, а service worker сохраняет весь выпуск для холодного офлайн-запуска. Сервер, SSR и гидратация для игры не требуются.

- `src/app`: bootstrap, router, providers, оболочка.
- `src/pages`: композиция экранов.
- `src/features`: сеанс партии, доска, просмотр/тренировка, Hunt, Autochess, PvE.
- `src/domain`: чистые типизированные правила шахмат, экономики, рейтинга, активности и режимов.
- `src/services`: движки, анализ, транзакционное хранение, PWA.
- `src/workers`: Stockfish, Cognitive и PvE.
- `src/shared`: UI, hooks, типы, графика и семантические CSS-токены.

Подробности: [архитектура](docs/architecture.md), [UI-модули](docs/ui-modules.md), [поставка PWA](docs/pwa-deployment.md), [инвентаризация миграции](docs/react-migration/inventory.md).

## Данные и правила продукта

Сохраняются ключи `chess-vault-v3`, предыдущие форматы v1/v2, `gachachess-autochess-v1` и `gachachess-theme`. Покупки и награды записываются одним снимком до публикации состояния подписчикам. Сбой хранения не разрешает частичное начисление. Импорт PGN остаётся просмотром и не влияет на личную историю или награды. При обновлении не очищаются localStorage/IndexedDB.

Экономические формулы и алгоритмы перенесены из v132. Cognitive v2 использует внутреннюю шкалу сложности; это не измеренный человеческий Elo. Сохраняются отчёты и ограничения калибровки в `docs/ai/`. Рейтинг: `expected = 1 / (1 + 10 ** ((botRating - playerRating) / 400))`; K=64 до десятой партии, затем 32; диапазон 100–2400. Верхняя граница ИИ использует Stockfish 19, с capability-based выбором threaded/single WASM.

Перед изменением UI обязательны [дизайн-система](docs/design-system.md), [типографика](docs/typography.md), [motion](docs/motion.md), [layout](docs/page-layout.md) и [контракт календаря](docs/calendar-rewards.md). Лаймовый акцент, золотой цвет валюты `#f8ea45`, редкости и обе темы сохраняются.

## Публикация

GitHub Actions проверяет main, PR и `migration/**`. Job GitHub Pages разрешён только main и зависит от проверок. Миграционную ветку нельзя сливать или публиковать в production без отдельного разрешения. Внутренний preview должен иметь новый уникальный адрес и пройти проверку фактически опубликованной сборки. Непроверенный preview не является завершением миграции.

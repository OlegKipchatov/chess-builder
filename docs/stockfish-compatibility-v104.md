# Stockfish 19: совместимость и lifecycle, выпуск v104

## Причина

До изменения все потребители запускали единственный `sf_19_smallnet` из
`@lichess-org/stockfish-web@0.5.0`. JS/WASM загружались из `dist/vendor/sf19`,
сеть `nn-61e7af4bb97d.nnue` — отдельным fetch. Это pthread-сборка:
`Threads=1` не отменяет требования SAB, изоляции и shared WASM memory.
Single-threaded варианта в исходном репозитории не было. Ассеты генерируются
проверяемым prepare-скриптом, а не хранятся в git.

Общий `createEngineWorker` используется двумя потребителями: Stockfish client
(обычная игра, анализ, тренировка мата, экономика) и Autochess engine.
Существовавший retirement ожидал `ENGINE_STOPPED`, затем завершал root Worker;
после 750 мс принудительно завершал неответивший worker. Обёртка threaded
отслеживала и завершала дочерние pthread workers. Autochess и экономика имели
собственные три попытки; анализ останавливал pipeline при ошибке.

## Точные сборки

| Назначение | Пакет и файлы | NNUE |
|---|---|---|
| Предпочтительная | `@lichess-org/stockfish-web@0.5.0`, `sf_19_smallnet.js/.wasm` | отдельная `nn-61e7af4bb97d.nnue` |
| Fallback | `stockfish@19.0.0`, `stockfish-19-lite-single.js/.wasm` | та же `nn-61e7af4bb97d`, встроена в WASM |

Single port: https://github.com/nmrugg/stockfish.js/tree/54fde71d90c7c403964f6cacef48f7bbec495df1

Оба архива проверяются по закреплённым SHA-512. Для fallback поставляется GPLv3
`COPYING.txt`; прежняя лицензия AGPL сохраняется. Архив fallback хранится вне
`dist`, в `node_modules/.cache`, и не раздувает публикацию. Runtime fallback:
около 1,8 МБ WASM, 24 КБ JS, обёртка и лицензия.

Проверяемая модификация JS-порта заменяет ровно одно выражение пути к WASM
на `self.STOCKFISH_WASM_URL`. Обёртка задаёт точный локальный URL `?v=104`.
Движковый код и сеть не изменены. Изначальный upstream locator через fragment
не подходит: при ответе из Service Worker fragment может исчезнуть из
WorkerLocation. Эта проблема воспроизведена и исправлена офлайн-тестом.

## Выбор и fallback

`stockfish-capabilities.js` проверяет WebAssembly, `crossOriginIsolated === true`,
наличие конструктора SAB и фактическое создание shared WebAssembly.Memory
с проверкой типа buffer. User-Agent не используется.

При отсутствии threaded capabilities сразу запускается single. При их наличии
lifecycle запускает threaded, сам проверяет `uci → uciok → isready → readyok`,
а команды потребителя до готовности держит в очереди. После готовности очередь
передаётся движку, интерфейс потребителя остаётся прежним.

Ошибки совместимости/инициализации WASM и тайм-аут startup разрешают один
переход threaded → single. ReferenceError/SyntaxError и ошибки прикладной
логики не считаются совместимостью. Недоступная сеть NNUE сообщается как ошибка
ресурса. После успешной готовности сбой относится к runtime и передаётся
существующему retry/restart механизму, без смены варианта. Неудачный threaded
startup запоминается только до перезагрузки страницы: повторные запросы не
пытаются заново запускать заведомо неработающую сборку.

Перед заменой очищаются startup timer и обработчики, worker отсоединяется,
отправляется STOP, дочерние workers завершаются, затем приходит ACK и завершается
root. Следующий heap создаётся только после retirement. Отмена до создания,
во время startup, перехода или поиска не оставляет отложенного запуска.
Тайм-аут принудительного завершения сохранён — 750 мс.

Диагностика: `console.debug` с выбором варианта, capabilities, причиной fallback,
ошибкой инициализации, runtime failure/restart. Постоянного хранилища логов нет.

## Бюджеты и функциональность

Сила игры, Skill/Elo, nodes, MultiPV, баланс и интерфейс не менялись.
Обе реализации используют существующие UCI-параметры. Точное побитовое совпадение
результатов разных портов не обещается даже с одинаковой сетью.

Startup: 20 секунд на вариант; внешний лимит 42 секунды включает обе попытки
и retirement. Экономический request deadline — 65 секунд, чтобы вместить
startup и прежний 20-секундный запас поиска. Search watchdog и точность анализа
не уменьшены; лимиты централизованы в `stockfish-config.js`.

## Изменённые файлы

- `dist/stockfish-capabilities.js` — новый capability probe.
- `dist/stockfish-lifecycle.js` — выбор, UCI startup, fallback, retirement, диагностика.
- `dist/stockfish19-worker.js` — структурированные startup ошибки, отмена,
  точные версии JS/WASM/NNUE и вложенных workers.
- `dist/stockfish19-single-worker.js` — classic Worker адаптер fallback.
- `dist/stockfish-config.js`, `stockfish-client.js`, `autochess-engine.js`,
  `economy-analysis.js` — бюджеты startup и диагностика restart.
- `scripts/prepare-stockfish19.mjs` — загрузка, integrity, extraction, лицензия,
  проверяемая настройка WASM locator для single.
- `dist/sw.js`, `dist/index.html` и URL импортов runtime-графа — выпуск v104.
- `dist/engine-info.html` — сведения о двух сборках, лицензия и исходники.
- `tests/stockfish-compatibility.test.js`, `tests/pwa.test.js`,
  `scripts/test-stockfish-compatibility-browser.mjs`, `scripts/test-pwa-browser.mjs`
  — новые/расширенные проверки. Остальные browser scripts и UI module test:
  только согласование URL выпуска.
- `package.json`, `.github/workflows/pages.yml` — запуск обеих браузерных матриц в CI.

## Service Worker

Кэш `chess-vault-v104`; обновлены HTML build marker и версии всего runtime-графа.
Fallback wrapper/JS/WASM/license входят в обязательный precache. NNUE fallback
встроена, отдельной загрузки не требует. Для WASM/NNUE добавлены точные
versioned cache entries. COOP/COEP/CORP сохранены. Install остаётся атомарным,
обновление активируется пользователем, предыдущий выпуск удерживается,
`ignoreSearch` не добавлен, пользовательские данные не очищаются.

## Проверки

- `npm test`: 346 тестов, 0 ошибок на финальном полном прогоне перед небольшим
  расширением сообщений restart; эти пути затем проверены отдельно: 49 тестов, 0 ошибок.
- Lifecycle: capabilities, успешный threaded startup, single сразу, fallback,
  единственная финальная ошибка, programming error, startup timeout,
  отмена до создания/во время startup/retirement/search, повторные игры,
  завершение дочерних workers, отсутствие наложения heaps при замене,
  сохранность retry policy.
- Настоящий Chromium и WASM: обычные ходы, награды, полный post-game pipeline,
  Autochess до мата, отмена анализа/поиска. Проверены threaded, single без SAB
  и искусственно повреждённый threaded WASM с успешным fallback.
- В браузерной серии каждого варианта: максимум 1 живой root Worker,
  после завершения/отмены — 0. Завершение дочерних workers отдельно покрыто тестом.
- `test:pwa:browser` и `test:pwa:single`: холодный offline startup, перезагрузка,
  сохранённая партия, награда, разбор, матовые упражнения, обе области `/`
  и `/chess-builder/`, переход с реального commit выпуска v103, неуспешная
  установка обновления, сохранность прогресса и точные URL предыдущего выпуска.
- Дополнительно Autochess до мата из offline cache после обновления для обеих сборок.

| Среда | Результат |
|---|---|
| Chromium с изоляцией | threaded, проверено автоматически |
| Chromium без изоляции и SAB | single, проверено автоматически |
| Ошибка threaded WASM при доступных capabilities | single, проверено автоматически |
| PWA онлайн/офлайн | обе сборки, проверено автоматически |
| Обновление v103 → v104 | проверено с обеими конфигурациями изоляции |
| Физический Mi Browser / Android WebView | устройство недоступно; ручная проверка не выполнена |

Физическое измерение RAM Android и длительный device memory soak не проводились.
Счётчик workers подтверждает очистку в проверенных сценариях, но не является
измерением всей памяти процесса браузера. Нужны WebAssembly и Web Workers;
браузеры без них не поддерживаются. На слабых устройствах single может быть
медленнее и упираться в существующие search watchdogs. Серверного fallback нет.

Изменения подготовлены локально. GitHub Pages в рамках этой задачи не публиковался.

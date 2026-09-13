# Аудит и план интеграции — до реализации

## Фактическая архитектура

`rating.value → opponentFor (округление /50, clamp 400–1600) → stockfishProfile → Skill Level round(12s), nodes 1500+18500s², movetime 1500 → bestmove`.

- Новая партия: `session.js:createStartedGame`; снимок параметров и случайная сторона в `state.game`, localStorage `chess-vault-v3`, PGN сохраняется после каждого хода.
- `app.js:requestBot` запрашивает ход, когда `game.turn() !== playerColor`, и проверяет taskId, блокировку анимации, завершение. `applyMove` использует локальный chess.js (правила, история, рокировки, превращения, повторения).
- `stockfish-client.js` — существующий Worker-compatible adapter. В `uciok → isready → readyok` инициализируется движок. Перед каждым поиском: Hash 16, UCI_LimitStrength false, Skill Level 0–12, ucinewgame, position с полной историей, go nodes N movetime 1500. Watchdog 15 секунд, инициализация 60 секунд. Игнорирует все info/cp/mate/PV; возвращает только проверенный legal bestmove.
- `stockfish19-worker.js` загружает локальный WASM smallnet + NNUE в module Worker. Нужны COOP/COEP, SharedArrayBuffer; PWA кэширует файлы. Реальный UCI banner: Stockfish 19, MultiPV 1–256, Skill 0–20, UCI_Elo 1320–3190. `scripts/stockfish19-cli.mjs` запускает тот же WASM в Node для тестов.
- Сохранения с stockfish18-v1 используют старый WASM; совсем старые без профиля — `bot-worker.js` и JS-поиск. Сохраняем эту совместимость.
- Ни MultiPV, ни UCI_Elo не задаются. Матовые и CP оценки не обрабатываются. RNG выбора хода движка не управляется приложением; RNG случайной стороны injectable, seed партии отсутствует.
- Уже есть тесты реального SF18/SF19, истории UCI, отмены, миграции, мата; нет проверки статистической силы.

Причина чрезмерной силы: внутренняя шкала приложения без калибровки названа рейтингом, её ступенчатое сопоставление Skill Level/узлам не управляет человеческой частотой ошибок. Один bestmove не позволяет приложению контролировать качество выбора. Меньший поиск сам по себе не делает сильный движок моделью новичка.

## Gap analysis и решения

Переиспользуем adapter, worker, правила chess.js, PGN, снимок партии, интерфейс `{id,fen,pgn,engineProfile} → {id,move}`. Добавляем pure difficulty-model/config, нормализатор MultiPV, подготовку контекста позиции. Выбор отделён от engine I/O. Новые профили versioned, старые продолжаются без изменений. Seed и effective Elo фиксируются на партию; seed хода выводится из seed партии и позиции. Типы описываем JSDoc в существующем JS проекте.

Риски: знак CP (UCI perspective side-to-move, НЕ всегда white), mate нельзя считать обычными CP; неполный последний depth MultiPV; пустые категории усиливают слабого бота; слишком малый бюджет даёт шумные оценки; максимальный MultiPV увеличивает задержку; native-смешивание может нарушить монотонность; simulation selection ≠ human Elo или матчевый рейтинг. Проверяем всё явно.

## Последовательность интеграции

1. `difficulty-config.js`, `difficulty-model.js`: единая конфигурация, target/effective/skill, seed RNG, непрерывные вероятности, quality, loss, weighted selection, fallback, mate recognition. Тесты границ, монотонности, RNG, modifiers.
2. `candidate-analysis.js`: parse UCI info, CP/mate нормализация, полный MultiPV одной глубины, legal candidates, фаза/complexity/guardrails. Тесты обоих цветов, mates, bounds, незаконных PV.
3. Расширить `stockfish-client.js`: новые профили анализируют MultiPV при Skill20/LimitStrength=false, старые используют текущий путь. Один поиск на ход; без индивидуального поиска каждого кандидата. Проверка fake worker и реального WASM.
4. `strength.js`, `session.js`, `state.js`, `app.js`, `rating.js`: versioned session profile, фиксированная variance и seed, запуск SF19 для нового профиля, новый target без округления. Сохранение интерфейса adapter, миграция старых партий без пересчёта силы. Обновить FAQ/кэш.
5. Harness `scripts/simulation`: 13+ документированных FEN, один сбор реальных MultiPV на позицию, >=10000 выборов/Elo, зафиксированные seeds. CSV/JSON, регрессионные assert с допуском. Отдельный более глубокий reference для независимой оценки ошибки и сравнения со старой моделью.
6. Проверить 400..1600: loss, best+good, mistake, blunder, mates, fallback, guardrails; сравнить старый adapter на 600/800/1000/1200. Если 8 PV дают слабому боту почти идеальные ходы — увеличить в пределах 12 и проверить ограничение, не добавлять random legal moves.
7. Измерить cold/warm search latency, число поисков. Исправить нарушения, повторить симуляции. Финальный отчёт содержит реальные коэффициенты, результаты и границы доказательства.

Native-переход: configurable, по умолчанию выключен до отдельной калибровки стыка. Иначе 1600 может скачком изменить силу, а native RNG не воспроизводится seed приложения. Сначала проверяем непрерывный humanized диапазон. Это осознанное изменение первоначальной гипотезы, допускающей native, а не требующей его.

Без telemetry, без изменений экономики/календаря, без новых UI-настроек сложности. GitHub — после проверки приватной версии.

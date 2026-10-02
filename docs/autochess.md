# Autochess first playable version

Release 94: deployment spans the nearest four ranks (white 1–4, black 5–8),
with pawns excluded from ranks 1 and 8. Enemy pieces, square accessibility
labels and check markers are concealed during preparation and revealed on
start, even if the FEN did not change. Ordinary legality checks still apply.
Main-wallet reward: min(30, 3 * wins + min(draws, 5)), credited incrementally
with idempotent receipts. The final credit may be partial. Previously earned
coins are never removed from old saved runs that already exceeded the new cap.

## Current draft: random shop (save format 4)

New runs start with 3 series coins. Random purchases cost 1, 2, 3… across
the entire run; sales and round transitions never reset this counter. Shop
levels range from 1 to 10, with upgrade prices 3, 5, 7…19 (99 total).
At level L, let s=L-1. Odds in percent: pawn 40-4s, knight 25-s,
bishop 25-s, queen 1+2s, rook takes the remainder. The UI exposes all odds.
Draws are seeded by the run and purchase count; reloads cannot reroll them.
Sales return min(nominal material value, actual paid price), preventing profit
from purchasing and immediately selling a cheap queen. Unplaced figures must
be placed; a full army blocks purchases. Level 10 cannot be upgraded further.

Income for the next round is 5/3/2 for win/draw/loss. The old 24-coin player
budget cap does not apply to format 4. Opponent templates still grow by round
to material budget 24 and do not react to player purchases. This is an initial
economy, not a claim of balance. Older saved runs retain their shop and budget.
Main-wallet rewards follow the release-94 capped formula documented above.

Start/resume stays directly below the board, above the shop. Exit pauses the
engine and offers save, discard, or return. Discard removes only this run;
already awarded wallet coins remain. Browser/tab hiding still saves the run.

Engine lifecycle: complete/pause/dispose releases the controller position;
next round drops the preceding move list, keeping compact result records.
The managed wrapper requests shutdown of all nested Emscripten workers and
waits for acknowledgement before another heap is allocated; a 750 ms watchdog
force-terminates a nonresponsive parent. Autoplay Hash is 4 MiB. WASM has
64 MiB initial / 128 MiB maximum: a 64 MiB maximum failed real engine tests.
An already terminal starting position is resolved without launching Stockfish.
These changes do not constitute an iOS memory regression test.

## Historical implementation notes

Implemented from GachaChess_Autochess_Concept_v0.1.docx. Entry lives beside Hunt.
Prototype defaults: five rounds, series coins 3 + 3 per completed round, eight pieces
including the free king, material prices, full refunds, revealed seeded opponent.
Rewards are 3/1/0 main-wallet coins per win/draw/loss, up to 15 per series. No rating, calendar or normal-game
statistics changes. UI and FAQ state these rules explicitly.

## Boundaries

- `dist/autochess.js`: immutable economy, placements, seeded equal-budget armies,
  castling rights, replay, outcome rules and saved-state validation.
- `dist/autochess-engine.js`: explicit Stockfish autoplay contract, shared local
  SF19 worker/WASM/NNUE, Skill 20, no Elo, MultiPV 1, Threads 1, Hash 16 MiB,
  movetime 100 ms, one ucinewgame per worker/battle. History sent with every search.
- `dist/autochess-battle.js`: monotonic active clock, at most 120 plies/30 seconds,
  cancellation generations, immutable checkpoints, pauses excluding engine setup.
- `dist/ui/pages/autochess.js`: existing board/skins/dialogs, tap and drag placement,
  mobile shop beneath board, result sheet, navigation and error recovery.

A move at or after the deadline is rejected. An accepted mating move wins even
on ply 120; ordinary chess draws precede the move limit. No eval/material adjudication.
Hidden document/pagehide and exit pause the clock and terminate the worker. Resume
replays saved moves and continues remaining time. Saved series use a separate
versioned localStorage key; Web Locks prevent two tabs mutating the same series.
A storage failure leaves the last confirmed state and reports failure. Corrupt or
incompatible state is retained and reported, never silently erased.

New runtime files are in v92 precache. Main game, Hunt, quality rewards and analysis
retain their own rules. An ongoing quality evaluation blocks entry; normal analysis
is stopped before mounting. Engine init does not consume battle time.

## Validation

`npm test`; `PWA_BROWSER_EXECUTABLE=... npm run test:pwa:browser`;
`PWA_BROWSER_EXECUTABLE=... node scripts/test-autochess-browser.mjs`.
Browser coverage: offline real SF battle, cold resume, exclusive tab access,
mobile/desktop layout, full-width result action, next round and unchanged main progress.
PWA upgrade fixture is the published GitHub v89 commit 303fbb2.

No target-iPhone measurements are claimed. Actual mate frequency and device search
depth remain prototype observations, not established balance/performance guarantees.

Rules v2 start at three series coins. Existing v1 series retain their original twelve-coin budget and opponent schedule; they are not reset or silently reduced. The wallet sits beside the shop heading. Desktop uses a board/shop grid; mobile keeps the shop below the board with compact spacing.

Rewards use the existing wallet state: balance and receipt with outcome/reason are persisted in one write. The saved battle remains replayable if that write fails; result/exit/next-round retry idempotently by battleId. Autochess Web Lock prevents duplicate settlement from two mode windows. Reloading state preserves receipts. Series summaries add already paid receipts without paying twice.

### v93: память и результаты

Stockfish получает shared WebAssembly.Memory с начальным размером 64 MiB и
максимумом 128 MiB вместо стандартного максимума 2 GiB. Профили по-прежнему
используют один поток и Hash 16 MiB. Контроллер и доска продолжают сохранённую
позицию по одному ходу, без повторного проигрывания всей истории при каждом
обновлении. Ошибка создания или запуска движка переводит бой на паузу и
сохраняет ходы и прошедшее время.

Результаты боёв 1–4 и награда показываются на странице с кнопкой следующего
боя. Модальное окно появляется только после пятого боя с итогами серии.
Повторное открытие результатов не начисляет награду второй раз.

### v94: спокойная доска и два шага итогов

Подсветка последнего хода в автошахматах отключена. Анимация перемещения,
шах и подсказки расстановки сохраняются. После последнего боя первый диалог
показывает только победы, ничьи и поражения за серию. «Далее» переводит
ко второму диалогу с общей суммой начисленных монет за всю серию. Повторное
открытие и переход между шагами не меняют уже сохранённую награду.

### Формат до 10 побед или 3 поражений

Новые и сохранённые серии продолжаются до 10 побед или 3 поражений. Ничьи
сохраняются в результатах, но не меняют условия завершения. Бюджет игрока
и соперника растёт на 3 между боями до 24; продажа возвращает монеты в запас.
Старые серии сохраняют начальный бюджет и прогресс. Пять боёв больше
не являются пределом. Награды остаются +3/+1/0 за победу/ничью/поражение.

Расстановка с недостаточным материалом разрешена с предупреждением о
немедленной ничьей. В частности, это два короля и слоны на клетках одного
цвета. Возможность взятия первым ходом не является запретом на запуск.

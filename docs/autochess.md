## Изменения 101 — утверждённый баланс

Первая предложенная таблица: только пешки на уровне 1, лёгкие фигуры с уровня 2,
ладьи с уровня 4, ферзи с уровня 6. Общая функция вероятностей используется
покупками игрока, ботом, прогнозом бота и FAQ. Серия до 15 побед или 5 поражений.
Доход 4/3/3 плюс уровень минус 1 одинаков для игрока и бота. Максимум награды
в основной кошелёк 30 сохранён. У каждого результата записана версия дохода:
старые результаты учитываются по 5/3/2, новые — по 4/3/3, без пересчёта
уже начисленного баланса.
Незавершённые старые серии переходят на 15/5, уже законченные при 10/3 сохраняют
свой итог. Купленные фигуры и результаты не удаляются.

## Изменения 100

Продажа оформлена outlined-кнопкой с акцентной рамкой и прозрачным фоном.
При выборе фигуры меняется только цена, без скачка яркости и размеров.

## Изменения 99

Бой не ограничен временем; лимит 120 полуходов сохранён. История и накопленное
время по-прежнему сохраняются для продолжения, включая бои длиннее 30 секунд.
Счётчик ходов объединён со строкой статуса; таймер и дублирующая ошибка удалены.
Размер доски и резерв места под статус сохраняются. Продажа имеет одинаковую
контурную поверхность при любом выборе; доступность обозначает цена вместо тире.
Белые всегда начинают. Перед боем бот корректирует только собственные позиции,
если чёрный король под шахом; состав армий и экономика сохраняются. Шах белому
королю допустим. Если безопасную позицию подобрать не удалось, бой не запускается
и показывается уведомление, без незаконного взятия короля.

# Autochess first playable version

## Release 98 — compact screen and reserve

Validation: 299 unit/integration tests pass. Browser scenarios cover 360×740,
390×844, 430×932, 360×640 and 1280×900, empty/one/four reserve pieces,
full-reserve return refusal, atomic king swap, sale, duplicate purchase clicks,
double touch return, overflow migration, 200% text, real offline Stockfish play
and stable result geometry. Full offline suite passes root/subpath cold starts
and the published v97 → v98 upgrade. Screenshots are in docs/screenshots.

Limits: tests ran in Chromium on Linux, not physical iOS Safari. Enlarged text
and exceptionally short viewports may scroll for accessibility. Existing saves
with excess reserve intentionally require manual resolution. Internal Sites
uses a new origin, so existing public-site local progress is not transferred.


Four fixed slots store all undeployed pieces, including a benched king. A buy
requires cash, army capacity and a free reserve slot. A reserve/board swap is
atomic and reuses the incoming piece’s slot. Pawns still cannot enter ranks
1/8, kings cannot be sold and a benched king prevents starting. Purchased pieces
may stay in reserve during a battle. Opponent planning is unchanged; it places
its acquired batch before purchasing into an already full reserve.

Old saves without reserveRule migrate without deleting or automatically placing
any pieces. More than four reserve pieces are preserved with an explicit
legacyReserveOverflow marker. A dialog lists every piece and lets the player
select one to place or sell; an always available “Разобрать” action reopens it.
Purchases, returning more pieces and starting the next battle are blocked until
the excess is resolved. A currently paused battle remains resumable.

The screen retains the global header, 64 squares, four reserve slots and a
fixed sale button. Purchase/upgrade share the same row, and start/next-battle
is last. Controls remain present but disabled in battle/result. Board size
uses viewport height and fixed panel geometry, never piece count or selection.
At enlarged text, content may scroll instead of being clipped.


## Release 97 draft

Modern army capacity is min(16, 7 + shopLevel), including king and bench:
8 at level 1, 9 at level 2, through 16 at levels 9 and 10. Player, opponent
forecast, purchases, setup validation and restored saves share the same rule.
Legacy fixed-price formats retain eight slots. A full modern shop button says
«Армия заполнена». Upgrading immediately opens the next slot up to level 9.

Sale returns max(1, floor(paidPrice / 2)) for both participants. The selection
row always reserves label and button space; an unavailable sale button is
invisible, disabled and excluded from accessibility/focus. Selecting/deselecting
a piece does not move the shop.

Opponent safety/economy follow-up: shelter scoring now rewards free king escape
squares off its rank, penalizes a blocked king, and prefers supported exits.
A reconstructed back-rank rook-mate fixture and its colour-rotated equivalent
verify that the same inventory no longer permits mate in one. The planner does
not see player placement; it cannot guarantee safety against every hidden army.

The old one-step shop ratio is replaced by a numerical beam forecast of up to
eight rounds (12 retained states, three spending actions per forecast round).
It compares expected draws, upgrades, cash retention and fielded material;
forecast income uses the opponent's last result and its own level. The horizon
shrinks as the player approaches ten wins. Actual purchases still use the same
shop and paid-price ledger. No bonus money, guaranteed drops or extra Stockfish
workers. The 5/3/2 income rule still creates a winner/loser budget gap.

Local comparison against the pre-fix planner in commit 7d3b148: 100 seeds
(`benchmark-0` through `benchmark-99`), eight consecutive opponent losses,
material before battle 9 averaged 13.10 previously and 15.98 now. Same budgets,
shop odds and random-draw seeds; no extra funds. This measures army material,
not win rate or equal strength. The reconstructed mate fixture, both colours,
long-series budget checks and 295 tests pass, together with offline browser
and v96-to-v97 PWA upgrade checks.

## Release 96

Double-click/tap removes a piece from the board and clears selection; the
remove button is gone. Purchase labels are «Фигура» and «Уровень»; level is
outlined and disabled at level 10. Capacity, instruction and level-counter
paragraphs are removed. Intermediate results show one outcome/reason and a
next-round action, without duplicate currency explanations. Sale returns
floor(paidPrice / 2); old nominal-price runs track sale losses for validation.

Modern opponents have an independent deterministic shop planner, starting with
three coins and a king. They use the same random shop odds, persistent purchase
prices, upgrade prices and 50% sale refunds as the player. Income uses their own
result and level. A bounded (32-action) planner compares expected material per
coin with an upgrade's future odds/income benefit, or saves until affordable.
A full army sells its weakest piece BEFORE the random purchase, only when the
expected replacement gain is positive. No free replacements or hidden previews.
The planner never receives the player's inventory, level, cash or placement.

Two bounded placement passes score friendly protection, king shelter and open
lines using only the opponent's pieces. This is a heuristic, not Stockfish or
a learned model, and does not promise optimal play. The planner currently fields
all owned pieces; it does not bench pieces without a reason to reduce its force.
No extra worker, WASM allocation or retained search tree is introduced.

Economy persists as reserve/level/purchases/sales/income/openingBalance; restore
checks the cash identity. Legacy armies migrate without reset and retain their
existing cash; missing historical paid prices use the old nominal prices.
Old shop formats retain their original opponent schedule. New format-4 runs
start with the bot immediately. Release 96 remains unpublished, so all changed
assets keep the same pending v96 cache URLs (public upgrade baseline is v95).

Board cells use semantic piece/style keys so transient animation style
attributes cannot cause stationary SVG nodes to be replaced. The browser
test checks node identity after a move. Consecutive completed rounds reuse
one Stockfish worker, sending ucinewgame/isready between rounds. Pending or
failed searches are terminated; exit, hiding and disposal release the pool.
A browser test runs 20 searches with new-game resets on one worker and checks
that it is terminated on disposal. This reduces repeated WASM allocation,
but does not prove that an iOS process reload was a memory crash or is fixed.

## Release 95 draft

Figures can be explicitly benched, including the king. Ownership and paid
price persist; a benched king prevents starting. Newly bought figures must
be placed or explicitly benched. Repeat selection, Escape and empty panel
clicks clear selection. Four-rank placement limits remain unchanged.
When colour changes, both axes rotate so every piece retains its screen cell.

Sales refund the actual paid price (legacy pieces retain their original
nominal price). Level income is base 5/3/2 plus shopLevel-1. Completed results
store the level; older results without this field use level 1, so existing
balances are not recalculated. Probabilities and rules live in FAQ; the two
shop actions share one row and have labelled decorative icons.

Board animation cleanup is synchronous and idempotent before each render:
old completion handlers cannot reveal an icon hidden by a newer animation.
Worker retirement waits for all pending shutdowns, not just the last one.
The browser regression runs sixteen real engine starts/searches/shutdowns
and checks one live parent worker at most, zero after shutdown. It also
interrupts overlapping animations and checks for hidden icons or overlays.
This is a Chromium regression check, not a measurement of iOS memory use.

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


## Совместимость состава со Stockfish — v102

Ограничение относится только к выставленным фигурам. `compositionIssue` — единый
источник проверки для расстановки игрока, обмена, планировщика соперника и запуска
движка: пешек ≤ 8; сумма превышений N−2, B−2, R−2, Q−1 (каждое не ниже нуля)
плюс число пешек ≤ 8. Общая вместимость армии и четыре слота резерва не меняются.
Покупки не ограничиваются составом поля. Обмен проверяет итоговый состав атомарно.

Недопустимое размещение не меняет состояние, уведомление объясняет исправление.
Старые армии загружаются без удаления фигур, даже если состав несовместим; разрешено
исправлять его постепенно. Кнопка «Исправить состав» открывает пояснение. Для старого
незавершённого боя возврат к подготовке требует явного действия в диалоге; сбрасываются
только ходы этого боя, покупки, монеты и прошлые результаты сохраняются.
Новые строки под доской не добавляются, размер панели и доски не меняется.

Бот использует тот же валидатор, сначала размещает сильные фигуры и продаёт
неиспользуемые остатки через общую транзакцию продажи с учётом возврата в бюджете.
Если ни один тип из текущей таблицы не может дополнить или усилить допустимый
состав, вместо покупки он рассматривает повышение уровня или накопление. Случайный
результат не подсматривается. Прогноз на восемь раундов и настройки силы сохранены.

Перед выделением Worker проверяется исходный FEN, в том числе при продолжении.
Ответы Stockfish `Unsupported position` и `Invalid FEN` немедленно завершают запрос
с сообщением о составе/расстановке, без ожидания таймаута и ложной ошибки памяти.

Проверка v102: полный набор 313 тестов прошёл; отдельные регрессии проверяют
четыре ранее отклонённых FEN, полный резерв и атомарный обмен, сохранность старой
армии, бюджет и развитие бота, немедленную обработку отказа Stockfish. Браузерная
проверка прошла на 360×740, 390×844, 430×932, 360×640 и 1280×900: стабильная
геометрия, пояснение состава, отказ постановки, исправляющий обмен, явный возврат
старого боя к подготовке без потери имущества. Проверены офлайн-бой и результат,
обновление PWA v100 → v102 с сохранением прогресса и холодный офлайн-запуск.


## Восстановление движка — v103

После результата каждого боя Worker завершается вместе с дочерними потоками;
следующий бой получает новый экземпляр WASM. При паузе и выходе он также завершается.
Очередь `stockfish-lifecycle` ждёт подтверждение остановки или защитные 750 мс
перед созданием следующего Worker. Завершённая очередь не хранит вложенные
результаты предыдущих остановок. Сборку мусора и срок возврата памяти ОС определяет
браузер; само приложение не может принудительно вызвать GC.

На один нерассчитанный ход даются три попытки суммарно, включая подготовку
Worker. Таймаут или ошибка освобождают старый Worker и запускают новый, передавая
тот же initialFen и только подтверждённые ходы. Успешный ход сбрасывает счётчик.
Ошибка выводится только после третьей неудачи, бой остаётся сохранённым на паузе.
Недопустимый состав и ошибки записи сохранения не повторяются. Пауза/выход
отменяют весь цикл; поздние ответы не могут добавить ход или запустить новый Worker.
Во время восстановления общая строка статуса показывает «Повтор расчёта · 2/3».

Проверки: полный прогон 322 тестов успешен; дополнительный тест принудительной
остановки зависшего Worker также прошёл. `scripts/test-autochess-retry-browser.mjs`
проверяет настоящий Stockfish: два принудительных таймаута → успешная третья
попытка, три таймаута → одна ошибка без хода/награды; пять последующих боёв
офлайн → ноль основных Worker после каждого завершения, пик — один.
`test:pwa:browser` подтвердил холодный офлайн-запуск и обновление v102 → v103
с сохранением прогресса. Это проверка жизненного цикла Worker, а не замер
памяти Safari/iOS или доказательство причины конкретного пользовательского сбоя.

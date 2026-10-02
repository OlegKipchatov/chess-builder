# Autochess first playable version

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

# Game economy V2

Wallet source: device-local state (`chess-vault-v3`). Existing balances and legacy
history are retained, never repriced. Initial wallet: 100 coins. Only games mint
additional coins; chests cost 100, duplicates give shards, crafting spends shards.
No automatic chest purchase and no wallet cap.

Eligible games pay completion 5 + result (win 18 / draw 10 / loss 5).
No length component. Player resignation before 10 own canonical moves pays zero;
no own moves cancels the game. Natural short endings pay normally. Legacy local
matches do not mint V2 rewards. Failed/unfinished games do not pay.

Base settlement atomically persists wallet, archive and reset active game. The
archive stores `rewardVersion`, breakdown and pending quality status. During the
player's idle turn, a cancellable background job evaluates completed own moves
using exactly the same fixed-node profile. It starts after the board animation
and a 200 ms idle delay; there is no analysis during the opponent's search.
Moving, resigning, changing game, leaving the screen or hiding the application
cancels the job and releases its Stockfish Worker. The cognitive opponent uses
its existing separate Worker; searches never run concurrently with reward work.

Each fully evaluated decision is persisted in the active game's
`rewardCheckpoint`: profile version, player color, initial FEN, canonical move
prefix and decisions. On reload, only matching history is reused. Changed
history/color/profile or malformed checkpoints are recalculated. An interrupted
decision is retried; completed decisions are retained. Settlement transfers the
checkpoint to the archive atomically with the game result. A sequential local
queue evaluates only missing decisions, then atomically writes bonus and final
status and discards the checkpoint. A fully evaluated game needs no Worker.
Old pending games pause while a new game is active. Foreground/background
cancellation is never a failure or a reason to pay the reserve bonus.
Background failures leave unfinished work for final processing; a background
checkpoint storage failure cannot award coins or modify the gameplay state.
Saving the checkpoint is optional for final processing: a storage failure cannot
replace an earned exact bonus with the fallback; the existing save retry keeps
the calculated bonus in memory.

Final states are idempotent. Restart resumes pending analysis; viewing history
never reprices completed rewards. A failed search is retried up to three attempts,
recreating the Worker/client and validating the request id and WDL. Exhausted
retries pay a fixed 5-coin reserve bonus in addition to base coins, with final
status `fallback`. Earlier `unavailable` (zero bonus) records are eligible for
recovery once; completed/fallback rewards are never paid twice, including reload.
The last nine failures retain ply, search stage, attempt and a bounded error
message. This records evidence for future failures; the original reported failure
cannot be attributed to a specific cause without its diagnostics. Economy requests
no longer build unused bot candidate explanations in the Stockfish adapter.

Profile `economy-sf19-v1`: shipped SF19 smallnet, full strength, 1 thread, 16 MB
hash, MultiPV 1, UCI_ShowWDL, 50,000 nodes per search, cleared hash. Compare best
and played (`searchmoves`) at the same root with canonical move history. Use
(W + D/2)/1000; signed mate maps to 1/0. Bound scores/timeouts never award quality.
Forced legal moves have zero weight. Adaptive opponent scores are never reused.

Quality: exp(-8 * expected-score loss), prior 4 decisions at .5. Launch accuracy
window is explicitly [0,1], not invented P10/P90 calibration. Accuracy/stability/
best-share weights are 5/3/2; largest-remainder rounding keeps displayed component
coins equal to the rounded total. Thresholds: .005/.025/.060/.150. Stability error
weights: 0/0/.25/.6/1. These launch parameters require real-game calibration under
a new reward version. No claim that the average bonus is already calibrated to 5.

UI shows base coins immediately and explains pending analysis; completion updates
the result or shows a toast if it was dismissed. FAQ describes the same rules.

# React migration parity inventory

Baseline: `ee7df974635bf7dd514c24e4d4a6b04bce3af8c6` (v132). Work branch: `migration/react-architecture-20261017`.
The checked-in legacy runtime remains the reference until replacement and regression validation are complete. No production publication or main merge is authorized.

| Feature | Current source / dependencies | Replacement ownership | Required parity |
|---|---|---|---|
| Shell, themes, dialogs | app.js, ui/shell, theme, ui/dialog | app providers; shared UI | prepaint system/light/dark; modal focus/return; mobile sheets; safe area |
| Classic chess | session, archive, chess.js, board | game-session; chessboard; domain/chess | random side, legal moves, castle/en passant/promotion, keyboard, replay, resignation |
| Adaptive AI | bot-client, cognitive-*, conversion-*, stockfish-* | engine services + dedicated workers | seeded profile, target 1400 native boundary, stale response fencing, timeouts, fallback |
| Reward settlement | engine, reward-quality, economy-analysis | domain/economy; rewards | exactly-once base and quality reward; resumable analysis; transactional failures |
| Archive and PGN | archive, pgn-import/export | history and review features | virtualization, return position, export dates, import never awards or enters own history |
| Analysis/training | analysis/*, ui/pages/analysis | domain/analysis; game-review | fact-based explanations, grouped episodes, hints, PV, mate training, cached replay |
| Collections | catalog, collection-model, pieces | inventory; collection page | own-only filter, individual item/preset, craft confirmation, named sets, visuals |
| Chests | economy, chest-card | rewards; chests page | 100 coins, pity, duplicates, shard-only, persistence before reveal |
| Activity | activity-model, calendar-rewards | activity; daily-tasks | both calendar screens, timezone/midnight, v1 migration, tasks, claims, freeze |
| Hunt | hunt, ui/pages/hunt | hunt page/domain | timed AND endless, spawn, life recovery, clock, two result screens, record/ledger |
| Autochess | autochess, autochess-battle/engine/rewards | autochess page/domain | shop, 4 reserve slots, placement constraints, planner, retries, pause/restore, series |
| PvE | pve-model/battle/ai/worker | pve page/domain | campaign, army/XP/stones/evolution, HP attacks and returns, king risks, en passant |
| Persistence | state, autochess restore, theme | typed persistence service | chess-vault-v3 plus v2/v1; gachachess-autochess-v1; gachachess-theme; no destructive migration |
| PWA | sw, manifest, app lifecycle | services/pwa + injectManifest | complete release cache, explicit update, cold offline, isolation and single-thread |
| Delivery | pages workflow, scripts | generated dist from Vite | all tests + strict typecheck/lint/build; private unique preview; production untouched |

## Architecture decisions

Use Vite SPA + TanStack Router hash history. GitHub Pages provides static hosting without request-time SSR or route fallback. TanStack Start would add a server/build/hydration layer without current product value. Browser-free domains and injected adapters retain the option of future server rendering. Lazy routes and engine workers must all belong to the release precache.

Prefer narrow external-store subscriptions with useSyncExternalStore for saved state; providers own services, not a giant per-move context. Feature-local reducers own async/view transitions. Transaction writes must complete before publication to React subscribers. Game/review generations invalidate stale async work; all external resources have explicit disposal.

## Validation status

Audit and implementation in progress. No acceptance check is considered complete until its replacement test passes. No internal preview published.

### Checkpoint: React integration

React routes and mode interfaces now exist in `src/`; Vite production packaging to a temporary `build/react` output passes. Strict TypeScript passes. Initial React regression coverage passes 8 tests, including Strict Mode engine retirement, local-game restoration, corrupt PGN recovery and atomic purchases. Adapted engine compatibility suite passes 34 tests. Existing domain tests now import TypeScript sources; UI/source-contract tests still reference the preserved vanilla baseline and must be replaced with equivalent React assertions before legacy removal. Browser installation failed (truncated Chromium archive); no browser/PWA upgrade verification or preview publication claimed.

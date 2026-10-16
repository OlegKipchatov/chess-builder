# React migration parity inventory

Baseline: `ee7df974635bf7dd514c24e4d4a6b04bce3af8c6` (v132). Work branch: `migration/react-architecture-20261017`.
The unmodified legacy runtime remains available in the baseline commit for reference and the installed-PWA upgrade fixture. The migration build uses only React/TypeScript sources. No production publication or main merge is authorized.

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

## Validation results

All listed features have React owners and typed first-party domain/service replacements. The production runtime contains no legacy DOM bootstrap, HTML-template renderer, parallel navigation controller or old JavaScript application entry point. `dist/` is generated; v132 remains preserved in Git and in the upgrade harness.

375 Node domain/service regressions and 59 React tests pass, alongside strict TypeScript, lint, motion token verification and the production build. Five real v132-generated fixtures cover legacy v1/v2/v3 storage, active games, analysis, equipment/activity, PvE and Autochess.

Browser acceptance has passed on the migrated application code:

- Live chess and archive playback at 320–1280 px; compact, standalone and simulated safe-area geometry; keyboard and animation identity.
- Analysis, hints, principal variations, mate practice, failed/partial retries, cached review without new Workers, and no incidental board/scroll movement.
- PGN text/file import, preserved headers, export/clipboard feedback, mobile sizing and unchanged rewards/history.
- Collection filters, equipment, named sets, crafting/reward domain transactions and aligned actions; chest double-click protection and reward deep links.
- Calendar/daily claims, frozen streaks, theme persistence/system changes, modal focus/return, profile, statistics and FAQ.
- Timed/endless Hunt, Autochess shop/reserve/drag/repair/retry/offline battles, and PvE map/army/bag/evolution/combat/pause/settlement.
- Stockfish 19 threaded, single-threaded and initialization fallback; real mate-in-3/4 checks; bounded timeouts; peak one parent Worker and none left alive.
- Complete cold-offline application and installed v132 upgrade, including rejected-asset recovery, old Worker URL retention, preserved progress and unrelated caches, with and without isolation.

The validation matrix, CI references and measured performance tradeoffs are in [validation.md](validation.md). The local managed environment has no permitted `control-browser`; Chromium runs in GitHub Actions. Physical Safari/Firefox/mobile device testing remains outside this evidence.

A new private preview has been published and its live runtime files verified against the CI artifact; see the [delivery report](validation.md#internal-delivery). Production/main stays at the original baseline until explicitly approved.

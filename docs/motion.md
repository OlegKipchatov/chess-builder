# Motion contract

Общие визуальные требования: [дизайн-система GachaChess](design-system.md).

`src/shared/styles/motion.ts` is the source of truth for Web Animations and generated CSS tokens.
After changing it, run `npm run motion:generate`; `npm run motion:check` verifies CSS synchronization.

| Layer | Duration | Usage |
| --- | --- | --- |
| Instant | 0 ms | Navigation, focus, disabled and accessibility states |
| Fast | 160 ms | Hover, pressed, short feedback, disappearance |
| Standard | 200 ms | Local UI changes, functional mobile sheet resizing, game start |
| Enter | 260 ms | Existing bottom sheet entry and future large overlays |
| Exit | 180 ms | Overlay dismissal; always shorter than Enter |
| Board | 420 ms | Piece movement, including castling |
| Reveal | 500 ms | Reward scale/opacity and simultaneous rarity glow |

Use semantic easing: local/enter ease-out, exit ease-in, sheet deceleration,
neutral board movement, reward ease-out. Select the layer before adding an effect.
Do not add arbitrary durations, transition:all or decorative page transitions.
Main and nested navigation stays instant. Do not animate PageHeader, statistics
sections, card heights, width, margin, padding or page geometry. The existing
mobile dialog content-height animation is a functional exception that removes a jump.

Lazy navigation keeps the currently presented screen until its replacement is
ready. Shell classes and navigation visibility follow committed route matches,
not the requested URL. Never replace an existing page with a transient loading
placeholder; test delayed chunks and superseded navigation frame by frame.

Buttons animate filter (actual brightness feedback) and background-color, never
outline or disabled opacity. Focus is immediate; disabling cancels feedback immediately.
Read-only chess squares retain full opacity and contrast: aria-disabled blocks moves, not visibility.
Hover applies only to hover-capable devices; pressed feedback uses the same Fast layer.

Change application state immediately, then visualize it. Do not use an animation
or timeout to defer starting the action. Preserve deliberate post-game sequencing.
Replay pauses are pacing, not Board duration. Native smooth scroll communicates
position in the catalog; it has no fixed UI duration.

Every new effect must support prefers-reduced-motion: CSS disables animations and
transitions; JavaScript checks the preference before animating or awaiting motion;
programmatic scroll uses instant. Preserve feedback and functionality, with no extra
wait, spinner or removed information. Reward rarity retains its static accent.

Autochess uses `autoBoard` (160 ms). Apply successive plies at least 200 ms
apart and only after the previous presentation settles. The next engine search
may run concurrently; pause/disposal invalidates its uncommitted result.
Persist terminal results immediately but show result controls after motion.
Reduced motion removes presentation without changing the 200 ms logical pace.

RPG persists each action immediately, then presents the previous position until
impact. Quiet moves use Board (420 ms). Attacks approach in full Board (420 ms),
apply visible HP/capture at contact, animate the original overlaid HP strip
for Standard (200 ms), then return in full Board (420 ms) if the target survives. A small
damage number sits just above the right edge of that strip and fades over Board (420 ms), concurrently
with the HP change. Finish damage feedback before starting the return.
Approach, damage and return are three sequential phases, never subdivisions of
one Board duration (1260 ms total for a surviving target). The strip shrinks to zero on a lethal hit; it never
shows the attacker’s HP as damage. Lethal attackers remain on the target square.
Input, next AI turn and result dialogs wait for the entire presentation. Exit,
resignation and disposal cancel it; reduced motion applies the final view at once.

## Autochess geometry (v98)

Keep the same 8×8 board bounds across preparation, battle and result for a fixed
viewport. Reserve always renders four fixed-size slots and a fixed-width sale
action. Do not collapse preparation controls during battle; disable them.
Selection, price labels and reserve occupancy must not resize the panels.
Use viewport/header geometry to size the board on short screens; no clipping,
scroll locking or height animations. Enlarged text takes priority over fit.
Notifications use the existing overlay toast. Check 360×740, 390×844, 430×932,
a short portrait screen, desktop and 200% text before changing this layout.

RPG pieces retain their centered 78% width/height. Never shrink or offset artwork
to make room for HP. Keep the original overlaid level/HP geometry during damage
feedback as well; position the damage number absolutely without resizing the bar.

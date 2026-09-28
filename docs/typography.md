# Typography contract

Keep the system font and existing visual hierarchy. Roles live in `dist/ui/styles/tokens.css`:

| Role | Existing size | Use |
| --- | --- | --- |
| Page | 1.75rem | Main page heading |
| Section | 1.25rem | Local section heading |
| Item | 1rem | Item and set names |
| Body | 1rem | Explanations and dialogs |
| Secondary | .875rem | Metadata and supporting labels |
| Micro | .8125rem | Compact navigation and auxiliary copy |
| Eyebrow | .75rem | Short labels only |
| Metric | 1.75rem | Main statistic, with a secondary label |

The existing 1.375rem dialog heading and larger streak/reward emphasis remain
contextual variants, not new semantic roles. Do not normalize every existing
heading to one visual size. Eyebrows must never hold explanatory sentences.

Canonical terms: предмет (generic collectible), фигура (chess piece), доска,
набор (saved/composed appearance). Keep Коллекция/Коллекции as section names.

Post-game heading comes from the history result. Show its termination reason
separately; live game status, cancellation and engine failure remain separate.

All numbers inherit tabular numerals, including balances, rewards, counters and
button labels. Tabular numerals alone do not reserve space for additional digits.
Dynamic controls use `.stable-label` and a `data-size-label` sizing label in the
same grid cell as `.control-label`. An optional `data-size-alt` reserves another
long form (e.g. a longer currency inflection). The sizing copy has no accessible text.
Reserve the longest relevant label at the current breakpoint; never truncate or
shrink text to fit. Enlarged text may grow the control, but switching runtime
states at the same text size must not change its height. Craft controls retain
Создать · N ✧ while disabled. Chest controls retain the missing-coins message.

Verify 320/390px and desktop, 200% text, affordability changes, crafting/equipping,
9→10 and 99→100 numeric transitions, and long draw reasons. Preserve page-layout
and motion contracts. FAQ probability lists use semantic dl pairs, without a
heavy table grid; all odds and guarantee conditions must stay intact.

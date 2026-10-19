# Page layout

React pages use `.tab[data-page-kind] > .page-header + .page-content`.
`root`, `subpage` and `detail` share geometry through `shared/ui/Page.tsx`.
The archive viewer owns its detail route. Active gameplay retains its hidden heading.

Page tokens live in `src/shared/styles/tokens.css`, layout rules in `shell.css`:

- Horizontal inset: 16px mobile, 26px desktop; main max-width stays 1120px.
- App header to page header: 20px mobile, 24px desktop.
- Heading row: minimum 44px to accommodate the unchanged BackButton.
- All header returns use `shared/ui/BackButton.tsx` through `Page`, including
  custom `onBack` actions in PvE. Use one 44px control with `--control` background, a 22px SVG,
  and a 16px header gap (`--page-related-gap`) on mobile and desktop.
  Header margins stay zero: the back control aligns with the content inset.
  Long titles wrap naturally; never reduce spacing or use negative margins to force one line.
  Do not override its background or header gutters by
  page ID. Hover, pressed and keyboard focus retain visible feedback.
- Header to content: `.page-content` owns 20px/24px padding, never margins.
- Major sections: 24px gap; related groups: 16px; supporting metadata: 8px.
- Bottom reserve: measured navigation height + 14px offset + safe area + 24px.
- Hidden navigation: only 24px + safe area. Top geometry does not change.

Keep page-level margins at zero. Use a parent gap for sections and groups.
Components own their internal spacing only. Technical wrappers around content
must not add margins or padding. Header spacing remains padding-owned whether
the page uses block, flex or grid. Collection lists no longer reserve viewport
height below their last item. Centered cards keep their existing width limits.
Calendar layouts explicitly use `width: 100%` and `max-width: 540px` inside the
flex page content. Auto inline margins must not shrink them to text width.
The header calendar (`/streak`) is titled «Календарь активности». Its month card
starts with «Текущая серия» and a large accent count, followed by the month and
spacious square day cells. Keep the frozen-day treatment and legend. Do not
replace this summary with a chip alongside the month.
The navigation ResizeObserver also accommodates changes in text size.

Browser validation lives in `scripts/test-live-layout.mjs`, `test-review-layout.mjs`,
`test-autochess-browser.mjs`, `test-hunt-browser.mjs` and `test-pve-browser.mjs`.
They measure mobile/desktop geometry, safe-area spacing, enlarged text, history
return and stable board bounds. Current execution results are recorded in
[the migration inventory](react-migration/inventory.md); historical pre-React
validation does not establish parity for the replacement UI.

### Высота экрана активной партии

На мобильном игровой блок начинается сразу после стандартного отступа page-shell под шапкой (20px). Вертикального центрирования и дополнительных растягиваемых промежутков сверху нет: увеличение высоты viewport не должно опускать участников и доску. Высота доступной области и максимальный размер доски учитывают фактическую высоту шапки (`--app-header-height`) и нижнюю safe area. Проверять одинаковую ширину с разной доступной высотой, включая standalone PWA и safe areas: обычная проверка размеров viewport не воспроизводит отступы iOS.

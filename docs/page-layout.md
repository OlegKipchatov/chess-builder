# Page layout

All eight screens use `.tab[data-page-kind] > .page-header + .page-content`.
`root` and `subpage` share geometry; the archive viewer changes `#play` to
`detail`. Active gameplay retains its existing hidden heading.

Page tokens live in `ui/styles/tokens.css`, layout rules in `shell.css`:

- Horizontal inset: 16px mobile, 26px desktop; main max-width stays 1120px.
- App header to page header: 20px mobile, 24px desktop.
- Heading row: minimum 44px to accommodate the unchanged BackButton.
- Header to content: `.page-content` owns 20px/24px padding, never margins.
- Major sections: 24px gap; related groups: 16px; supporting metadata: 8px.
- Bottom reserve: measured navigation height + 14px offset + safe area + 24px.
- Hidden navigation: only 24px + safe area. Top geometry does not change.

Keep page-level margins at zero. Use a parent gap for sections and groups.
Components own their internal spacing only. Technical wrappers around content
must not add margins or padding. Header spacing remains padding-owned whether
the page uses block, flex or grid. Collection lists no longer reserve viewport
height below their last item. Centered cards keep their existing width limits.
The navigation ResizeObserver also accommodates changes in text size.

Validation for release 53: 29 targeted UI/navigation/PWA tests pass; shell HTML
is balanced. The worker harness verifies v52 cache cleanup and reload requests.
Browser mobile/desktop QA and real installed-PWA upgrade remain unverified:
supervised preview failed before startup (environment mount permission error).
Check 390px and desktop, expanded FAQ, final collection item, history scrolling,
profile/statistics/calendar, and history → detail → history. Repeat header-gap
measurement after adding a technical wrapper and switching block/flex/grid.

### Высота экрана активной партии

На мобильном свободное место распределяется вокруг игрового блока, но дополнительный верхний промежуток ограничен 32px. Высота доступной области и максимальный размер доски учитывают фактическую высоту шапки (`--app-header-height`) и нижнюю safe area. На коротких экранах верхний промежуток сжимается до нуля. Проверять одинаковую ширину с разной доступной высотой, включая standalone PWA и safe areas: обычная проверка размеров viewport не воспроизводит отступы iOS.

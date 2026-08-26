# E2E selector contract

Playwright runs `shell.spec.ts` in the eight required QA viewports, once in dark
mode and once in light mode (16 projects). The higher-cost transactional suite
`product-flows.spec.ts` runs only in two representative projects: desktop
1366x768 dark and mobile 390x844 light. Tests prefer semantic roles and
accessible names; `data-testid` is reserved for stable structural hooks that
cannot be located reliably by user-facing text.

Required shell hooks:

- `app-shell`: outer application shell.
- `primary-navigation`: desktop/sidebar navigation. The responsive bottom bar
  is located semantically by `aria-label="Navegación móvil"` so only the visible
  navigation participates in each viewport test.
- `theme-toggle`: icon-only button with `aria-pressed` and an accessible name.
- `sound-toggle`: icon-only button with `aria-pressed` and an accessible name.
- `instant-games-grid`: container for the complete instant-games catalog.
- `instant-game-card`: repeated exactly nine times inside the grid.

Theme contract:

- `<html data-theme="dark|light">` is authoritative for visual tokens.
- The persisted theme key is `quinie_theme`, matching the v25 source of truth.
- Sound preference remains compatible with the v25 key `quinie_sound`.

The functional suite does not require additional test IDs. Login, logout,
top-up, active reels, receipts opened from history, results, and role-based access are all
located by their roles, labels, headings, or visible names. API assertions use
the browser context so its HttpOnly mock-session cookie and the UI always refer
to the same server-side session.

Do not add test IDs instead of labels, roles, headings, or link names when a
real user-visible selector is available.

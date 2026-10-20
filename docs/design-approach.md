# Design approach

How the frontend gets its look. Decision recorded on [#7](https://github.com/BekaKOKE/Docura/issues/7) on 20.10.2026.

## Decision

**Design source: the references route.** The assignment allows a design agent "or good references for the coding agent". Docura uses
references. No external design agent (Claude Design, v0, Lovable) generates code that is then imported. The software-engineer builds
`frontend/` by hand from the design files below, and every later M1 screen follows the same files.

## Reference files used

| file | used for |
| --- | --- |
| `replica/design/brief.md` | the identity ("site notebook"), the colour roles, fonts, Russian text rules, phone and desktop layout, the screen list |
| `replica/design/tokens.css` | imported as is by `frontend/src/styles/index.css`. It is the only source of colours, type, spacing, radius, shadows, motion and sizes (`--dc-*`), plus `.dc-money`, `.dc-code`, `.dc-label` and the focus ring |
| `replica/design/tokens.json` | the source of `tokens.css`; edited only through `python replica/design/build_tokens.py` |
| `replica/design/components.md` | §0 rules (wrapping labels, `minmax(0,1fr)`, at most 2 buttons side by side, 48 px targets, atomic money and identifiers), the layout shell, the primitives (Button, Card, StatusBadge, EmptyState, ListRow…) and the icon map |
| `replica/design/specimen/specimen.html` (+ the two PNGs) | the reference rendering: the CSS recipes for buttons, badges, cards, rows and totals, and the checks for overflow and horizontal scroll at 360 px |
| `replica/design/contrast-report.txt` | which text and fill pairs pass WCAG AA |

Not used: `tailwind.v4.css` and `tailwind.preset.cjs`. The frontend has no Tailwind. Plain CSS on the `--dc-*` custom properties
covers the same roles and keeps the dependency list shorter.

## Installed skills used

| skill | how |
| --- | --- |
| `design-taste-frontend` (the "taste" skill) | used only as a quality checklist, never as a source of style. Applied: full states (loading, empty, error), one accent used the same way everywhere, one radius scale with a written rule, button and form contrast, `:active` press feedback, `min-height: 100dvh` instead of `100vh`, a documented z-index scale (the tokens), no decorative dots, no section-number labels, no fake screenshots, no emoji, a copy read-through. **Overridden by Docura's identity:** its Lucide warning (`components.md` names Lucide), its warm-paper palette warning (the brief names these colours), its mandatory dark mode (light only, chosen for sunlight), its Tailwind and Motion defaults (not on the agreed dependency list), and its "CTA labels never wrap" rule (`components.md` §0: Russian labels wrap at word boundaries on a phone). Russian typography keeps the dash where the copy in `components.md` uses it |

## What makes the result non-generic

- **The "site notebook" identity:** a warm paper background (`bg`), white cards with a 1 px border (`surface`, `border`), ruled
  lists, tabular figures. No shadows except on floating things: bars, sheets, toasts.
- **One saffron action colour** (`accent`) with an **ink label, never white**. Saffron is a fill, not a signal: switches,
  checkboxes, progress and selected states use ink (`control-on`), and links use `accent-text`.
- **Onest + IBM Plex Mono.** Onest for everything, with tabular numbers for amounts. Plex Mono only for identifiers (КП-2026-0012,
  БИН, ИИК). The `cyrillic`, `cyrillic-ext` and `latin-ext` subsets load, so ₸ and the Kazakh letters come from the web font, not
  a fallback.
- **No gradients.** No purple or blue glow, no glassmorphism, no default shadcn zinc palette, no stock illustrations, no emoji.
- **Lucide icons**, 24 px, stroke 2, from the icon map in `components.md` (house, files, users, package, file-text, receipt,
  clipboard-check…).
- **The 360 px rules:** `minmax(0,1fr)` grids and `min-width: 0` flex children; button labels wrap at word boundaries and are
  never truncated, hyphenated or shrunk; at most 2 buttons side by side; touch targets of 48 px or more; amounts and document
  numbers never wrap; no horizontal scroll.
- **Radius rule:** 4 px for small marks, 8 px for controls, 12 px for cards and sheets, pill for badges and chips.
- **Russian copy written fresh** in Docura's own voice, with ё and «ёлочки», through `t()`. Nothing from Khosmos.

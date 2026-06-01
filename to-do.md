# SRE Co-Pilot — UI/UX Fix Tracker

> Audit against `design.md` (IQM Design System). Items ordered by priority.
> Branch: `CR/new-design`

---

## 🔴 Critical — Broken or Invisible

- [x] **#1 — `accent-primary` token undefined**
  - Affects: `ControlRoom.js` — tabs (`border-accent-primary`, `text-accent-primary`), remediation card (`bg-accent-primary/5`, `bg-accent-primary/20`), AI badge (`bg-accent-primary/10`)
  - Fix: Replace all `accent-primary` references with `Primary-600` tokens → `text-primary-600` / `border-primary-600` / `bg-primary-50`

- [x] **#2 — Terminal card forced dark background is broken**
  - Affects: `ControlRoom.js` — Diagnostic Stream bento card uses `!bg-background-dark !border-surface-hover-dark` with `!important` override
  - `background-dark` now resolves to `#FAFAFA` (light), making the terminal unreadable
  - Fix: Replace Tailwind `!important` overrides with inline style `background:#0F1117; border-color:#E6E6E6`

- [x] **#3 — `text-cyan-200/80` invalid in terminal output**
  - Affects: `ControlRoom.js` — terminal `<pre>` text color
  - Fix: Replace with inline style `color:#a5f3fc` (terminal is an intentional dark-surface exception)

---

## 🟠 High — Wrong Design Tokens

- [x] **#4 — Off-system severity colors across all views**
  - Affects: `Dashboard.js`, `ActiveIncidents.js`, `ControlRoom.js`, `Archive.js`, `Rules.js`
  - Replace raw Tailwind colors with IQM semantic tokens:

  | Current | IQM Token | Hex |
  |---|---|---|
  | `text-red-400` | Danger-500 | `#CC0909` |
  | `bg-red-500/10` | Danger-50 | `#FFF2F2` |
  | `border-red-500/30` | Danger-75 | `#FCDEDE` |
  | `text-yellow-400` | Warning-500 | `#A36701` |
  | `bg-yellow-500/10` | Warning-50 | `#FFF3DE` |
  | `border-yellow-500/30` | Warning-75 | `#F7D8A3` |
  | `text-blue-400` | Info-500 | `#0874AA` |
  | `bg-blue-500/10` | Info-50 | `#F2FAFF` |
  | `border-blue-500/30` | Info-75 | `#D7EBF5` |
  | `text-amber-400` | Warning-400 | `#CC870E` |
  | `bg-amber-500/10` | Warning-50 | `#FFF3DE` |
  | `border-amber-500/20` | Warning-75 | `#F7D8A3` |

- [x] **#5 — Opacity-based color syntax not in IQM system**
  - Affects: All views — `bg-black/20`, `bg-black/30`, `border-white/5`, `bg-primary-light/10`, `bg-surface-hover-dark/40` etc.
  - IQM uses flat palette tokens only, never Tailwind opacity modifiers for semantic color
  - Fix: Replace each with the nearest IQM `-50` or `-75` shade

- [x] **#6 — `font-black` (weight 900) not in IQM type scale**
  - Affects: `Dashboard.js` (KPI numbers), `Rules.js` (stat numbers), `ActiveIncidents.js` (count)
  - IQM only defines: Regular (400), Demi (600), Bold (700)
  - Fix: Replace all `font-black` → `font-bold`

---

## 🟡 Medium — Spec Violations

- [x] **#7 — Border radius inconsistency**
  - IQM standard: `borderRadius-4` = 4px for all components
  - Fix the following violations across all views:

  | Current class | Correct | Used in |
  |---|---|---|
  | `rounded-xl` (12px) | `rounded` (4px) | Fleet matrix cards, modal inner elements, remediation card |
  | `rounded-lg` (8px) | `rounded` (4px) | Buttons in ControlRoom/Archive, info boxes, runbook inner |
  | `rounded-md` (6px) | `rounded` (4px) | Filter dropdown in ActiveIncidents |
  | `rounded-full` on badge chips | `rounded` (4px) | Severity badges in ActiveIncidents, ControlRoom, QuickView modal |
  | Note: `rounded-full` is valid only for pill-style count badges (runbook count, dedup count) | | |

- [x] **#8 — Text sizes below IQM 12px label minimum**
  - IQM `Label-12` is the minimum label size. Current violations:
  - `text-[9px]` → raise to `text-[11px]` minimum (used in: pane-header labels, KPI sublabels, table column headers, badge text, timeline timestamps)
  - `text-[10px]` → raise to `text-xs` = 12px (used in: activity feed, quickview metadata, filter labels, sort icons)
  - Affects: `Dashboard.js`, `ActiveIncidents.js`, `ControlRoom.js`, `Archive.js`, `Rules.js`, `SSL.js`

- [x] **#9 — Buttons not following IQM spec**
  - IQM button spec: height 34px (Medium), border-radius 2px, use `.btn-primary` or `.btn-outline` classes
  - Violations to fix:

  | Location | Current | Fix |
  |---|---|---|
  | ActiveIncidents — "View" quickview button | Custom `px-3 py-1 rounded` | `.btn-outline` |
  | ActiveIncidents QuickView modal — "Open Control Room →" | `px-4 py-2 bg-primary-light rounded-lg` | `.btn-primary` |
  | ControlRoom — "Retry" button | `px-6 py-2 bg-primary-light rounded-lg` | `.btn-primary` |
  | ControlRoom — "View Full Runbook" button | `rounded-lg bg-blue-500/10` | `.btn-outline` with IQM tokens |
  | Archive — delete/action buttons | Various custom styles | `.btn-outline` or `.btn-primary` |

- [ ] **#10 — Horizontal Tabs in ControlRoom don't follow IQM spec**
  - Current: `border-b-2 border-accent-primary` (now broken — accent-primary undefined)
  - IQM Horizontal Tabs spec: height 34px (Medium), 2px bottom border in `Primary-600` (#134AC1) for active, `text-muted` + transparent border for inactive, padding 12px outer / 4px inner
  - Fix: Rewrite tab indicator logic in `ControlRoom.js` using IQM tokens

- [x] **#11 — Modal overlay inconsistency**
  - Affects: `ActiveIncidents.js` quickview modal — `bg-black/60 backdrop-blur-sm`
  - backdrop-blur removed from new design system
  - Fix: Replace with `.glass` class (`background:rgba(0,0,0,0.4)`) consistent with `Header.js` diagnostic modal

- [x] **#12 — KPI card gradient hover overlays**
  - Affects: `Dashboard.js` — `bg-gradient-to-br from-primary-light/10 to-transparent` on hover
  - IQM uses flat `Primary-75` (`#E2EBFF`) for hover states, no gradients in card backgrounds
  - Fix: Replace gradient overlays with flat `hover:bg-primary-75` or remove

- [x] **#13 — KPI card left-border accent colors**
  - Affects: `Dashboard.js` — `border-l-red-500/50`, `border-l-yellow-500/50`, `border-l-blue-500/50`
  - Fix: Replace with IQM semantic colors → `border-danger-500`, `border-warning-500`, `border-info-500`

---

## 🔵 Low — Polish & Typography

- [ ] **#14 — Typography hierarchy (H→B→L) not consistently applied**
  - IQM rule: every container must follow Heading → Body → Label order
  - Card section titles should be: 13–15px / Demi (600) / `Neutral-1000`
  - Body text: 13px / Regular (400) / `Neutral-1000`
  - Metadata/labels: 12px / Demi (600) / `Neutral-500`
  - Audit each card in Dashboard, ControlRoom, Rules and enforce the hierarchy

- [ ] **#15 — `uppercase + tracking-widest` overused**
  - IQM reserves uppercase for secondary metadata labels only
  - Currently applied to: KPI card labels, table column headers, loading messages, nav tooltip titles, badge text, pane-header — creates visual noise
  - Fix: Keep uppercase only for `pane-header` labels and secondary metadata. Remove from primary content labels, KPI titles, button text

- [x] **#16 — Loading states inconsistent styling**
  - `ControlRoom.js`: `animate-pulse font-mono text-primary-light` → use `color: #666666` (Neutral-500), 13px body
  - `Rules.js`: `animate-pulse font-heading text-lg uppercase` → replace with neutral body text loading state
  - Fix: Standardize all loading states to: centered spinner (existing IQM spinner from `index.html`) + 12px Neutral-500 label below

- [x] **#17 — Elevation tokens not used**
  - IQM defines `--shadow-100` through `--shadow-400` in `style.css`
  - Current code uses Tailwind `shadow-2xl`, `shadow-lg` instead
  - Fix: Replace `shadow-2xl` (modals) → `var(--shadow-400)`, `shadow-lg` (cards) → `var(--shadow-300)`

- [x] **#18 — Dead `dark:` variant classes throughout all views**
  - Every view file contains dead `dark:bg-*`, `dark:text-*`, `dark:border-*`, `dark:hover:*` variants
  - Dark mode is disabled — these classes never activate
  - Fix: Remove all `dark:` prefixed classes from all view files (low risk, reduces noise)

---

## 📋 File-by-File Fix Map

| File | Issues |
|---|---|
| `views/Dashboard.js` | #4, #5, #6, #7, #12, #13, #15, #18 |
| `views/ActiveIncidents.js` | #4, #5, #7, #9, #11, #15, #18 |
| `views/ControlRoom.js` | #1, #2, #3, #4, #5, #7, #9, #10, #15, #17, #18 |
| `views/Archive.js` | #4, #5, #7, #9, #15, #18 |
| `views/Rules.js` | #4, #5, #8, #15, #16, #18 |
| `views/SSL.js` | #4, #7, #8, #15, #18 |
| `views/Chaos.js` | #4, #5, #7, #15, #18 |
| `views/Pods.js` | #4, #5, #7, #15, #18 |
| `views/Runbooks.js` | #4, #5, #7, #15, #18 |
| `views/Settings.js` | #4, #5, #7, #9, #15, #18 |

---

## ✅ Already Done

- [x] Tailwind config replaced with IQM token palette (Primary Blue, Neutral, Semantic scales)
- [x] `style.css` rewritten with IQM CSS custom properties, component classes, elevation tokens
- [x] `index.html` — removed dark class, light surface shell, IQM loading spinner
- [x] `Sidebar.js` — IQM Vertical Tabs design (2px left border, Primary-50 active BG, Primary-75 hover)
- [x] `Header.js` — IQM surface, 34px outline buttons, updated diagnostic modal
- [x] `state.js` — `applyTheme()` removes dark class
- [x] Logo and icon assets added (`logo.png`, `icon.png`)
- [x] Product name updated to "SRE Co-Pilot" throughout
- [x] `design-system/` folder removed from branch

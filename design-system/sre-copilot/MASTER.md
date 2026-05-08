# SRE Copilot — Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** SRE Copilot  
**Updated:** 2026-05-08  
**Stack:** Vite + Vanilla JS + Tailwind CSS v3 + Fira Code / Fira Sans  
**Dark mode:** Enabled permanently via `html.dark` class (class strategy)

---

## Color Palette

All colors are defined in `tailwind.config.js` under `theme.extend.colors`.

| Role | Light Token | Dark Token | Hex (Light) | Hex (Dark) |
|------|------------|-----------|-------------|------------|
| Primary (interactive) | `primary-light` | `primary-dark` | `#7C3AED` | `#8B5CF6` |
| Background | `background-light` | `background-dark` | `#FAF5FF` | `#0B0A1A` |
| Surface (cards) | `surface-light` | `surface-dark` | `#FFFFFF` | `#16142E` |
| Surface hover | `surface-hover-light` | `surface-hover-dark` | `#F3E8FF` | `#242145` |
| Body text | `text-light` | `text-dark` | `#1E1B4B` | `#F8FAFC` |
| Muted text | `muted` | `muted` | `#475569` | `#94a3b8` |
| Alert red | `alert-red` | — | `#EF4444` | — |
| Alert orange | `alert-orange` | — | `#F59E0B` | — |
| Alert green | `alert-green` | — | `#10B981` | — |

**CSS Variables (root):**
```css
--accent-primary: #38bdf8;   /* cyan — code highlights, links */
--accent-success: #22c55e;   /* green — success states */
--accent-warning: #f59e0b;   /* orange — warnings */
--accent-danger:  #ef4444;   /* red — errors, destructive */
```

### Severity Color Mapping

| Severity | Background | Text | Border |
|----------|-----------|------|--------|
| critical / page | `rgba(239,68,68,0.1)` | `#f87171` | `rgba(239,68,68,0.2)` |
| warning | `rgba(245,158,11,0.1)` | `#fbbf24` | `rgba(245,158,11,0.2)` |
| info / other | `rgba(56,189,248,0.1)` | `#7dd3fc` | `rgba(56,189,248,0.2)` |

---

## Typography

| Role | Font | Tailwind class |
|------|------|---------------|
| Headings, display, IDs | Fira Code (monospace) | `font-heading` or `font-mono` |
| Body, labels, UI text | Fira Sans (sans-serif) | `font-body` (default) |

**Google Fonts import (in style.css):**
```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap');
```

### Type Scale in Use

| Use | Size | Classes |
|-----|------|---------|
| Section labels / metadata | 9px | `text-[9px] font-bold uppercase tracking-widest` |
| Table headers / badges | 10px | `text-[10px] font-bold uppercase tracking-widest` |
| Pane headers | 10px | handled by `.pane-header` |
| Body / table rows | 11–13px | `text-[11px]` / `text-[13px]` |
| Card values / KPIs | 24–32px | `text-2xl` / `text-3xl font-heading font-black` |
| Page titles (header bar) | 18px | `text-lg font-bold tracking-tight uppercase` |

**Rule:** Never use plain `text-sm` (14px) in pane-headers or modal title spans — the `.pane-header` class supplies font sizing. Inner `<span>` elements must not override it.

---

## Layout Structure

```
<body class="h-screen flex overflow-hidden">
│
├── <nav>  w-[80px]  shrink-0
│   Icon-only sidebar. bg-surface-light/dark. Right border divider.
│
└── <main id="app-content">  flex-grow flex flex-col min-w-0
    │
    ├── <header>  h-[72px] shrink-0  ← MUST have shrink-0
    │   Sticky top bar. bg-surface-light/80 + backdrop-blur-xl.
    │   Left: view title + WS status dot.
    │   Right: "Fire Alert" button.
    │
    └── <div id="main-view">  flex-grow p-6 overflow-y-auto min-h-0
        View content rendered here by view JS files.
```

**Critical layout rules:**
- `<header>` must always carry `shrink-0` — without it, flex-col can compress the header on content-heavy pages.
- `#main-view` must carry `min-h-0` so flex allows it to scroll rather than expand the parent.
- View root divs that need internal scrolling must either set `h-full` on themselves **and** `flex-grow` on the scrolling child, or use `overflow-y-auto` on the root div directly.

---

## Component Library

All custom components live in `frontend/src/style.css` as Tailwind `@apply` classes.

### `.pane`
Theme-aware card container. Use for all surface cards.

```css
.pane {
  @apply bg-surface-light dark:bg-surface-dark
         border border-surface-hover-light dark:border-surface-hover-dark
         rounded-2xl overflow-hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.pane:hover { @apply shadow-lg; }
```

### `.pane-header`
Standard header row inside a `.pane`. Provides all font styling — **do not add text-size or font-weight to inner spans**.

```css
.pane-header {
  @apply px-6 py-4 border-b border-surface-hover-light dark:border-surface-hover-dark
         font-mono text-[10px] font-bold uppercase tracking-widest text-muted;
}
```

**Usage pattern:**
```html
<div class="pane flex flex-col">
  <div class="pane-header flex items-center justify-between">
    <span>Section Title <span class="text-text-light dark:text-text-dark font-black">${count}</span></span>
    <button ...>Action</button>
  </div>
  <!-- content -->
</div>
```

### `.bento-card`
Extends `.pane` for grid dashboard layouts.

```css
.bento-card { @apply pane p-6 flex flex-col h-full; }
```

### `.empty-state`
Standardized no-data placeholder. Use inside `<td>` for tables or a `<div>` for card content. Text should be uppercase and concise.

```css
.empty-state {
  @apply p-16 text-center text-muted text-[11px] font-mono uppercase tracking-widest;
}
```

**Usage:**
```html
<!-- Table -->
<tr><td colspan="N" class="empty-state">No Filter Rules Defined</td></tr>

<!-- Card -->
<div class="empty-state">Registry Empty for Current Context</div>

<!-- With color override for positive/healthy state -->
<td class="empty-state text-primary-light dark:text-primary-dark">All Clear — No Active Incidents</td>
```

### `.table-header`
Sticky `<thead>` row. Applies background, border, and text styling consistently.

```css
.table-header {
  @apply sticky top-0
         bg-surface-light dark:bg-surface-dark
         border-b border-surface-hover-light dark:border-surface-hover-dark
         text-[10px] uppercase text-muted font-bold;
}
```

**Usage:** `<thead class="table-header">`  
Do **not** use `bg-surface-hover-light/10 backdrop-blur-md` — use the standard token.

### `.modal-close-btn`
Standardized X close button for all modals and overlays.

```css
.modal-close-btn {
  @apply p-2 rounded-lg
         hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark
         hover:text-alert-red text-muted transition-all;
}
```

**Usage:** `<button class="modal-close-btn"><!-- X SVG --></button>`  
Never use `rounded-full` or `hover:bg-alert-red hover:text-white` — those are non-standard variants.

### `.btn-primary`
Gradient CTA button. Cyan → blue gradient with glow shadow.

```css
.btn-primary {
  @apply h-10 px-6 rounded-lg font-bold text-xs uppercase tracking-widest
         transition-all active:scale-95 flex items-center justify-center gap-2;
  background: linear-gradient(135deg, #38bdf8 0%, #1d4ed8 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(56, 189, 248, 0.2);
}
```

### `.btn-outline`
Secondary / border-only button.

```css
.btn-outline {
  @apply h-10 px-6 rounded-lg font-bold text-xs uppercase tracking-widest
         border border-surface-hover-light dark:border-surface-hover-dark
         hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark
         text-text-light dark:text-text-dark transition-all active:scale-95;
}
```

### `.badge`, `.badge-sev1`, `.badge-sev2`, `.badge-sev3`
Severity indicator pills. Never apply `scale-110` externally — size is fixed.

```css
.badge { @apply px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center; }
.badge-sev1 { background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
.badge-sev2 { background: rgba(245,158,11,0.1); color: #fbbf24; border: 1px solid rgba(245,158,11,0.2); }
.badge-sev3 { background: rgba(56,189,248,0.1); color: #7dd3fc; border: 1px solid rgba(56,189,248,0.2); }
```

| Class | Severity |
|-------|---------|
| `badge-sev1` | critical, page |
| `badge-sev2` | warning |
| `badge-sev3` | info, other |

### `.glass`
Glassmorphic overlay background — used for modal overlays. Always dark.

```css
.glass {
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
```

### `.terminal`
Always-dark code/log display box. Never inherits theme.

```css
.terminal {
  @apply font-mono text-[11px] leading-relaxed p-4 rounded-lg;
  background: rgba(11, 10, 26, 0.85);
  border: 1px solid rgba(139, 92, 246, 0.15);
  color: #a5f3fc;
}
```

### `.input-modern`
Standard form input.

```css
.input-modern {
  @apply w-full h-10 bg-surface-hover-light dark:bg-surface-hover-dark
         border border-surface-hover-light dark:border-surface-hover-dark
         rounded-lg px-3 text-sm text-text-light dark:text-text-dark
         placeholder:text-muted focus:ring-1 ring-primary-light dark:ring-primary-dark
         outline-none transition-all;
}
```

### `.animate-fade-in`
Entrance animation for views and modals.

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
```

---

## Modal Pattern

All modals follow this structure:

```html
<!-- Overlay -->
<div class="fixed inset-0 glass z-50 flex items-center justify-center p-4 animate-fade-in">
  <!-- Modal card -->
  <div class="pane w-full max-w-[SIZE] flex flex-col shadow-2xl">

    <!-- Header -->
    <div class="pane-header flex justify-between items-center h-14">
      <span>Modal Title</span>
      <button class="modal-close-btn" id="close-modal">
        <!-- X SVG 18x18 or 20x20 -->
      </button>
    </div>

    <!-- Scrollable body -->
    <div class="flex-grow overflow-auto p-6">
      <!-- content -->
    </div>

    <!-- Footer (optional) -->
    <div class="shrink-0 px-6 py-4 border-t border-surface-hover-light dark:border-surface-hover-dark flex justify-end">
      <button class="btn-primary">Confirm</button>
    </div>

  </div>
</div>
```

**Rules:**
- Overlay always `glass` + `z-50` (or `z-[100]` if above other overlays)
- Close button always `.modal-close-btn`
- Modal header always `.pane-header` — no custom font sizes on inner spans
- Modal card must be `flex flex-col` so the body can `flex-grow overflow-auto`

---

## Page / View Pattern

Each view is a JS function that writes into `<div id="main-view">`. Every view must:

1. Have a root div that fills the container (`h-full min-h-0` for scrollable content, or `overflow-y-auto` for self-scrolling)
2. Use `.pane` for all card surfaces
3. Use `.pane-header` with a section title and optionally a count/action on the right
4. Use `.table-header` on all `<thead>` elements
5. Use `.empty-state` for all empty / no-data states

### View root patterns

**Full-height table view** (e.g. Active Incidents, Pods):
```html
<div class="h-full min-h-0 pane flex flex-col">
  <div class="pane-header ...">Title</div>
  <div class="flex-grow overflow-auto">
    <table>
      <thead class="table-header">...</thead>
      <tbody>...</tbody>
    </table>
  </div>
</div>
```

**Full-height card list** (e.g. Archive):
```html
<div class="flex flex-col gap-6 h-full min-h-0">
  <div class="pane flex flex-col flex-grow min-h-0">   ← needs flex-grow
    <div class="pane-header ...">Title</div>
    <div class="p-6 border-b ..."><!-- filters --></div>
    <div class="flex-grow overflow-auto p-6 flex flex-col gap-4">
      <!-- cards or empty-state -->
    </div>
  </div>
</div>
```

**Self-scrolling grid** (e.g. Dashboard):
```html
<div class="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full min-h-0 overflow-y-auto pb-10">
  <!-- bento-cards and panes -->
</div>
```

---

## Sidebar Navigation

Icon-only, `w-[80px]`, `shrink-0`. No labels visible.

| View key | Title | Active also on |
|----------|-------|---------------|
| `dashboard` | Global Dashboard | — |
| `active` | Active Incidents | `control` |
| `archive` | Post-Mortem Ledger | — |
| `chaos` | Chaos Engine | — |
| `rules` | Rules & Suppression | — |
| `pods` | Resource Registry | — |
| `settings` | Connectors & Keys | — |

**Icon states:**
- Inactive: `text-primary-light/60 dark:text-muted`, hover `bg-surface-hover-light dark:bg-surface-hover-dark`
- Active: `bg-primary-light dark:bg-primary-dark text-white shadow-lg shadow-primary-light/30`

---

## Animation & Motion

| Effect | Class / Value |
|--------|--------------|
| Entrance (views, modals) | `.animate-fade-in` (opacity + translateY, 0.4s ease-out) |
| Pulse (live indicators) | `animate-pulse` |
| Spin (loading) | `animate-spin` |
| All hover transitions | `transition-all` with duration `0.3s cubic-bezier(0.4, 0, 0.2, 1)` |
| Button press | `active:scale-95` |
| Card hover slide | `hover:translate-x-1 duration-300` (Archive cards only) |

---

## Scrollbar

Styled globally via `::-webkit-scrollbar`. Width/height 6px, purple in light mode, white/10 opacity in dark mode.

---

## Anti-Patterns

| ❌ Don't | ✅ Do instead |
|---------|------------|
| `scale-110` on badges | Use badge at natural size |
| `rounded-full` on modal close buttons | Use `.modal-close-btn` |
| `hover:bg-alert-red hover:text-white` on close buttons | Use `.modal-close-btn` |
| `text-sm font-bold tracking-widest uppercase` inside a `.pane-header` span | Remove — pane-header CSS already provides it |
| `text-xs font-black` inside a modal pane-header span | Same — remove |
| `bg-surface-hover-light/10 backdrop-blur-md` on table `<thead>` | Use `.table-header` |
| `p-10 text-center text-muted italic text-xs` for empty states | Use `.empty-state` |
| Missing `shrink-0` on `<header>` in flex-col layout | Always add `shrink-0` to the sticky header |
| Pane without `flex-grow` inside a flex-col container that needs internal scroll | Add `flex-grow` to the pane |
| Light mode as default | Always `html.dark` — dark mode is permanent |
| Emojis as icons | SVG icons only (Lucide / Heroicons style) |
| `cursor-default` on clickable elements | All clickable elements get `cursor-pointer` |
| Instant state changes | Always use `transition-all` (150–300ms) |

---

## Pre-Delivery Checklist

- [ ] `<header>` carries `shrink-0` in any flex-col layout
- [ ] All `<thead>` elements use `.table-header`
- [ ] All modal close (X) buttons use `.modal-close-btn`
- [ ] All empty / no-data states use `.empty-state`
- [ ] No inner spans inside `.pane-header` override font-size or font-weight
- [ ] Severity badges use `.badge-sev1/2/3` — no external `scale-*` applied
- [ ] New views have a `.pane-header` with section title + count
- [ ] Full-height views: pane has both `h-full` (or `flex-grow`) and the scroll child has `overflow-auto flex-grow`
- [ ] All clickable elements have `cursor-pointer`
- [ ] Hover states use `transition-all` (no abrupt jumps)
- [ ] No horizontal overflow on any viewport width

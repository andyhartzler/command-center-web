# UI Redesign: Notion-Inspired Warm Muted Dark Theme

**Goal:** Replace the current cold blue glassmorphic aesthetic with a warm, muted dark theme inspired by Notion's dark mode. Clean solid surfaces, restrained color use, no transparency effects.

**Reference:** Notion dark mode - warm charcoal backgrounds, subtle borders, off-white text, muted blue accents only for interactive elements.

---

## Color System

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#1c1c1e` | Page/app background |
| `--surface` | `#252528` | Widget containers, cards |
| `--surface-hover` | `#2c2c30` | Hovered surfaces |
| `--border` | `rgba(255,255,255,0.06)` | All borders/dividers |
| `--border-hover` | `rgba(255,255,255,0.1)` | Hovered borders |
| `--foreground` | `#ebebeb` | Primary text |
| `--foreground-secondary` | `rgba(235,235,235,0.5)` | Secondary/muted text |
| `--foreground-tertiary` | `rgba(235,235,235,0.3)` | Tertiary/hint text |
| `--accent` | `#6b8aab` | Interactive elements, links |
| `--accent-hover` | `#7d9bbc` | Hovered accent |
| `--shadow` | `0 2px 8px rgba(0,0,0,0.3)` | Card shadow |

## Widget Containers

**Current:** `.widget-glass` with backdrop-filter blur, blue-tinted gradient background, gradient border shimmer `::before`, multi-layered blue shadows.

**New:** Solid dark card with minimal styling.

```css
.widget-card {
  background: #252528;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  overflow: hidden;
}

.widget-card-media {
  background: #1a1a1c;
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  overflow: hidden;
}
```

No `::before` pseudo-element. No backdrop-filter. No gradient borders.

## Background Themes

Replace animated blue/navy gradients with flat warm tones. Remove `::before`/`::after` animated drift layers entirely.

| Theme | Background Color |
|-------|-----------------|
| Deep Space | `#1c1c1e` |
| Midnight | `#1a1a1e` |
| Aurora | `#1c1e1c` (slight green tint) |
| Ember | `#1e1c1a` (slight warm tint) |
| Ocean | `#1a1c1e` (slight cool tint) |
| Slate | `#1e1e1e` |

All themes are subtle variations of warm charcoal. No animations.

## Sun Widget Redesign

Remove the orange/yellow sun arc and emoji moon. Replace with clean data layout:
- Sunrise time + sunset time displayed as clean text
- Horizontal progress bar (muted, thin) showing day progress
- Moon phase shown as text label, not emoji
- All in off-white/grey tones, no bright colors

## Editor & Toolbar

- Sidebar: `#1a1a1c` background, same border style
- Toolbar: Same warm charcoal with subtle border
- Buttons: Muted blue accent for primary actions
- Display toolbar: Same treatment, warm tones

## Scrollbars

Warm neutral instead of blue-tinted:
```css
scrollbar-color: rgba(255,255,255,0.06) transparent;
thumb:hover: rgba(255,255,255,0.12);
```

## Scope

Files to modify:
- `src/app/globals.css` — color vars, widget-glass replacement, background themes, scrollbars, toolbar
- `src/components/display/WidgetContainer.tsx` — swap class names
- `src/components/widgets/SunWidget.tsx` — full redesign
- `src/components/editor/DashboardEditor.tsx` — sidebar/toolbar colors
- `src/components/editor/WidgetSidebar.tsx` — sidebar styling
- `src/components/display/DashboardDisplay.tsx` — toolbar styling
- Individual widget files — remove any hardcoded blue-tinted colors

## Out of Scope

- Widget layout/functionality changes
- New widgets
- API changes

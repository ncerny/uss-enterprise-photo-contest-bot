# photo-471.3: Research Mobile-First Responsive Design Patterns

## Current State Analysis

The web app already has a solid CSS foundation:
- **CSS Modules** for component-scoped styles
- **CSS Custom Properties** for theming (colors, radii)
- **Dark theme** as default
- **Basic responsive** patterns with `@media (max-width: 640px)`

## 1. Tailwind CSS vs Current CSS Modules

### Current Approach: CSS Modules + Custom Properties

**Pros:**
- Already implemented and working
- No additional dependencies
- Strong encapsulation (no class name collisions)
- Full control over styles
- Smaller bundle size (only used styles)

**Cons:**
- More verbose for common patterns
- No utility classes for rapid prototyping
- Must define responsive patterns manually

### Tailwind CSS

**Pros:**
- Utility-first approach speeds development
- Built-in responsive prefixes (`sm:`, `md:`, `lg:`)
- Consistent design tokens
- Tree-shaking removes unused utilities

**Cons:**
- Learning curve for team
- Would require migration of existing styles
- Larger initial bundle (mitigated by purging)
- Class name verbosity in JSX

### Recommendation: **Keep CSS Modules**

The app already has a working CSS Modules setup with custom properties. Migrating to Tailwind would add complexity without significant benefit for this project size. Instead, enhance the current approach with:
1. Standardized breakpoint variables
2. Utility class additions to `index.css`
3. Mobile-first media query pattern

---

## 2. Mobile Breakpoints

### Recommended Breakpoints

```css
:root {
  /* Mobile-first breakpoints (min-width) */
  --breakpoint-sm: 640px;   /* Small tablets, large phones landscape */
  --breakpoint-md: 768px;   /* Tablets */
  --breakpoint-lg: 1024px;  /* Small laptops */
  --breakpoint-xl: 1280px;  /* Desktops */
}
```

### Usage Pattern (Mobile-First)

```css
/* Base styles = mobile */
.component {
  padding: 1rem;
  flex-direction: column;
}

/* Tablet and up */
@media (min-width: 768px) {
  .component {
    padding: 2rem;
    flex-direction: row;
  }
}
```

### Key Considerations
- **Primary target**: Mobile phones (Discord users often on mobile)
- **Touch targets**: Minimum 44x44px (Apple HIG) / 48x48px (Material)
- **Content width**: Max 1200px for readability

---

## 3. Touch-Friendly UI Patterns

### Minimum Touch Target Sizes
```css
:root {
  --touch-target-min: 44px;  /* iOS Human Interface Guidelines */
  --touch-target-comfortable: 48px;  /* Material Design */
}
```

### Patterns to Implement

1. **Large tap targets** - Buttons, links, cards should be easily tappable
2. **Spacing between interactive elements** - Prevent accidental taps
3. **Swipe gestures** - For image galleries, card actions
4. **Pull-to-refresh** - Native feel for lists
5. **Bottom navigation** - Thumb-friendly on mobile
6. **Avoid hover-dependent UI** - Use click/tap instead

### Button Sizing
```css
button {
  min-height: var(--touch-target-min);
  padding: 0.75rem 1.5rem;
}

/* Full-width on mobile */
@media (max-width: 640px) {
  .btn-block-mobile {
    width: 100%;
  }
}
```

---

## 4. Dark Mode Implementation Strategies

### Current State
The app already uses a dark theme as the **only** theme via CSS custom properties:

```css
:root {
  --color-background: #1a1a2e;
  --color-surface: #16213e;
  --color-text: #e4e6eb;
  /* ... */
}
```

### Strategy for Light Mode Support

**Option A: CSS Custom Properties with data-theme (Recommended)**
```css
:root,
[data-theme="dark"] {
  --color-background: #1a1a2e;
  --color-text: #e4e6eb;
}

[data-theme="light"] {
  --color-background: #ffffff;
  --color-text: #1a1a2e;
}
```

**Option B: prefers-color-scheme**
```css
@media (prefers-color-scheme: light) {
  :root {
    --color-background: #ffffff;
    --color-text: #1a1a2e;
  }
}
```

### Recommendation: Hybrid Approach

1. Default to system preference via `prefers-color-scheme`
2. Allow manual override via `data-theme` attribute
3. Store preference in localStorage
4. Sync with React context

```typescript
// ThemeContext.tsx pattern
const getInitialTheme = () => {
  const stored = localStorage.getItem('theme');
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};
```

---

## Implementation Plan

### Phase 1: Enhance Current CSS (Low effort)
1. Add breakpoint CSS variables to `:root`
2. Add touch-target size variables
3. Add utility classes for common patterns
4. Refactor existing media queries to mobile-first

### Phase 2: Dark Mode Toggle (photo-471.9)
1. Define light theme color palette
2. Add `data-theme` support to CSS
3. Create ThemeContext
4. Add toggle to UI

### Phase 3: Responsive Components
1. Update Layout component with mobile menu
2. Make all forms mobile-friendly
3. Optimize image galleries for touch

---

## Summary

| Criterion | Decision |
|-----------|----------|
| CSS Framework | Keep CSS Modules + enhance utilities |
| Breakpoints | 640px / 768px / 1024px / 1280px (mobile-first) |
| Touch Targets | 44-48px minimum |
| Dark Mode | data-theme + prefers-color-scheme hybrid |

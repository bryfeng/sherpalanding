# 🎨 Sherpa AI Front-End Visual Refresh  
**Objective:** tighten color, elevation, and component hierarchy to achieve a more cohesive “graphite + electric blue” look with strong focus cues and fewer competing accents.

---

## 🔍 Visual Issues Detected
- Too many accent colors (blue + green) → visual noise.  
- Insufficient surface contrast between header, card, and chat canvas.  
- Over-rounded corners and deep shadows create a “bubbly” feel.  
- CTA (Call-to-Action) hierarchy unclear — Send button and chips compete.

---

## 🌈 New Visual System (Token Replacement)

```css
:root {
  /* Neutrals */
  --bg: #0b0d12;
  --bg-elev: #11161d;
  --surface: #131a22;
  --surface-2: #171f29;
  --line: #1e2733;

  /* Text */
  --text: #e7eef7;
  --text-muted: #a8b3c2;
  --text-inverse: #0b0d12;

  /* Accent (single brand) */
  --accent: #5aa4ff;
  --accent-600: #3e93ff;
  --accent-700: #297ff0;
  --accent-800: #1e68c7;

  /* Semantic */
  --success: #5fd39a;
  --warning: #ffcc66;
  --danger: #ff6b6b;

  /* States */
  --hover: rgba(255,255,255,.04);
  --active: rgba(255,255,255,.06);
  --focus-ring: #5aa4ff;

  /* Radii */
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 16px;
  --r-xl: 20px;

  /* Shadows */
  --shadow-1: 0 1px 2px rgba(0,0,0,.38);
  --shadow-2: 0 6px 18px rgba(0,0,0,.32);
  --shadow-inset: inset 0 1px 0 rgba(255,255,255,.04);

  /* Spacing */
  --s-1: 4px; --s0: 8px; --s1: 12px; --s2: 16px;
  --s3: 20px; --s4: 24px; --s5: 32px; --s6: 40px;

  /* Font sizes */
  --fs-xs: 12px; --fs-sm: 13px; --fs-md: 15px;
  --fs-lg: 17px; --fs-xl: 20px; --fs-2xl: 24px; --fs-3xl: 28px;
}
```

---

## 🧱 Base Elements

```css
body { background: var(--bg); color: var(--text); }

.app-chrome {
  background: var(--bg-elev);
  border-bottom: 1px solid var(--line);
}

.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-xl);
  box-shadow: var(--shadow-2);
}

.subtle {
  background: var(--surface-2);
  box-shadow: var(--shadow-inset);
}
```

---

## 🔘 Buttons and Chips

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--r-lg);
  border: 1px solid transparent;
  font-size: var(--fs-md);
}

.btn-primary {
  background: var(--accent);
  color: var(--text-inverse);
  box-shadow: 0 4px 12px rgba(90,164,255,.24);
}
.btn-primary:hover { background: var(--accent-600); }
.btn-primary:active { background: var(--accent-700); }

.btn-secondary {
  background: transparent;
  color: var(--text);
  border-color: var(--line);
}
.btn-secondary:hover { background: var(--hover); }
.btn-secondary:active { background: var(--active); }

.chip {
  background: var(--surface-2);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: var(--fs-sm);
}
.chip--accent {
  background: rgba(90,164,255,.14);
  border-color: rgba(90,164,255,.28);
  color: #cfe4ff;
}
```

---

## 🏷️ Badges and Tabs

```css
.badge {
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 6px 10px;
  font-size: var(--fs-sm);
  color: var(--text-muted);
}
.badge--valueup { color: var(--success); }

.tabs { display: flex; gap: var(--s1); }
.tab {
  padding: 10px 14px;
  border-radius: var(--r-md);
  background: transparent;
  border: 1px solid var(--line);
  color: var(--text-muted);
}
.tab[aria-selected="true"] {
  color: var(--text);
  background: var(--surface-2);
  box-shadow: var(--shadow-inset);
}
```

---

## 💬 Input Field

```css
.input {
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--r-xl);
  color: var(--text);
  padding: 14px 16px;
}
.input::placeholder { color: var(--text-muted); }
.input:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
```

---

## ✨ Interaction Polish

```css
*[role="button"], .btn, .chip {
  transition: background-color .12s ease, border-color .12s ease, transform .02s ease;
}
.btn:active { transform: translateY(1px); }

@media (prefers-reduced-motion: reduce) {
  * { transition-duration: .01ms !important; animation-duration: .01ms !important; }
}
```

---

## 🧩 Component Mapping

| Component | Style |
|------------|--------|
| **Send button** | `.btn.btn-primary` |
| **Secondary actions** (“Open workspace”, “Pin latest panel”) | `.btn.btn-secondary` |
| **Quick chips** (“Show portfolio”, etc.) | `.chip` + `.chip--accent` for active |
| **Header badges** (network, wallet, balance) | `.badge` |
| **Portfolio growth** | `.badge.badge--valueup` |
| **Tabs** | `.tab` in `.tabs` container |

---

## 🧠 Design Notes
- Use green **only** for numeric growth values — never for buttons or surfaces.  
- Keep **one accent (blue)** for all interactive elements.  
- Restrict heavy shadows to cards only.  
- Corner radius hierarchy: card > button > chip/badge.  
- Maintain focus visibility for keyboard users.

---

## ✅ Implementation Steps
1. Replace existing token variables with the new block.  
2. Apply `.card`, `.btn-*`, `.chip`, `.badge`, `.tab`, `.input` classes across your components.  
3. Remove redundant shadows and overly rounded corners.  
4. Test color contrast — all text/background combos pass WCAG AA+.  
5. Verify hover, focus, and motion-reduced behavior.

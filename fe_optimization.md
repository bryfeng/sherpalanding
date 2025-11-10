# MVP Front‑End Optimization Spec (Agent‑Ready, Low‑Dependency)

This spec is formatted for an advanced coding agent (IDE assistant). No timelines; only **purpose**, **goals**, **desired outcomes**, and **implementation steps**. Bias toward minimal third‑party deps.

---

## Global

### Purpose
Deliver a premium, responsive front‑end with minimal dependencies by isolating UI concerns, standardizing widgets, and enforcing a cohesive design system.

### Goals
- Minimize bundle size and complexity.
- Improve layout scalability and discoverability of the Workspace.
- Establish a consistent widget contract and rendering pipeline.
- Ensure accessibility, performance, and explainability.

### Desired Outcomes
- Thin page shell; feature slices are independently testable.
- Widgets render via a single host with a simple density model.
- Users reliably find/understand the Workspace.
- A11y and perf baselines are met without external libs.

---

## Workstream 1 — Shell Split (Monolith → Feature Slices)

### Purpose
Reduce re‑renders and coupling by extracting surfaces and shared components.

### Goals
- `DeFiChatAdaptiveUI.tsx` becomes a thin router/layout.
- Surfaces own only their sub‑trees; shared UI moves to components.

### Desired Outcomes
- `DeFiChatAdaptiveUI.tsx` ≤ ~200 lines.
- Independent unit tests for surfaces and header.

### Steps
1. **Create components**
   - `components/surfaces/ChatSurface.tsx`
   - `components/surfaces/WorkspaceSurface.tsx`
   - `components/header/HeaderBar.tsx`
   - `components/panels/PanelHost.tsx`, `components/panels/PanelCard.tsx`
2. **Move rendering**
   - Lift message list/input into `ChatSurface`.
   - Move widget/panel rendering into `PanelHost`.
3. **State wiring**
   - Keep current state source; pass via props/context.
   - Extract ephemeral UI state via `useReducer` in `DeFiChatAdaptiveUI` (no new deps).
4. **Memoization**
   - `React.memo` for `HeaderBar`, `PanelCard`.

---

## Workstream 2 — Widget Contract & Grid Layout

### Purpose
Unify how widgets are defined, rendered, and arranged without drag‑drop dependencies.

### Goals
- Introduce a minimal `Widget` TS type and density model.
- CSS Grid layout with three breakpoints; simple reorder via up/down controls.

### Desired Outcomes
- All existing panels conform to `Widget` type.
- Consistent card header, actions, sources footer.

### Steps
1. **Type** (`types/widgets.ts`)
```ts
export type WidgetDensity = "rail" | "full";
export type WidgetAction = { id: string; label: string; onClick: () => void; ariaLabel?: string };
export type Widget<T = unknown> = {
  id: string; kind: string; title: string; payload: T;
  sources?: Array<{ label: string; href?: string }>; density: WidgetDensity; order?: number;
};
```
2. **Host** (`PanelHost.tsx`)
   - Accepts `widgets: Widget[]`.
   - Sort by `order`.
   - Render `PanelCard` with `actions` (Pin, Expand).
3. **CSS Grid** (`styles/panel-host.css`)
```css
.panel-host{display:grid;gap:var(--s4);grid-template-columns:repeat(12,1fr)}
.card.density-rail{grid-column:span 4;min-height:180px}
.card.density-full{grid-column:1/-1;min-height:280px}
@media(max-width:1200px){.card.density-rail{grid-column:span 6}}
@media(max-width:860px){.card.density-rail,.card.density-full{grid-column:1/-1}}
```
4. **Refactor panels**
   - Map `portfolio_overview`, `top_coins`, `trending_tokens` → `Widget`.
   - Provide `sources[]` to display in footer.

---

## Workstream 3 — Workspace Discoverability

### Purpose
Ensure first‑time users see and understand the Workspace and widgets.

### Goals
- One‑time auto‑switch to Workspace on first widget creation.
- Inline coach‑mark; persisted dismissal.

### Desired Outcomes
- Increased Workspace engagement (open/expand events).

### Steps
1. **Local flag** (`utils/prefs.ts`)
```ts
export const getFlag=(k:string)=>localStorage.getItem(k)==="1";
export const setFlag=(k:string,v:boolean)=>localStorage.setItem(k,v?"1":"0");
```
2. **Auto‑switch** (in shell)
   - On first `widgets.length>0` and `!getFlag('ws.nudged')`: set activeSurface="workspace"; `setFlag('ws.nudged',true)`.
3. **Coach‑mark**
   - Small inline tip inside `WorkspaceSurface` (dismiss → setFlag('ws.tip.dismissed',true)).

---

## Workstream 4 — Accessibility & Input Ergonomics

### Purpose
Guarantee keyboardability, labeling, and motion preferences compliance.

### Goals
- Surface toggle as a proper roving‑tab interface.
- Visible focus rings; aria‑live announcements for panel highlights.

### Desired Outcomes
- Axe‑core passes on key screens (manually/locally, no dep required to ship).

### Steps
1. **Toggle group**
   - `role="tablist"`; each button `role="tab"`, `aria-selected`.
   - Left/Right arrow to switch focus; Enter/Space to select.
2. **Focus styles**
```css
:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
```
3. **Reduced motion**
```css
@media (prefers-reduced-motion: reduce){ *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important} }
```
4. **Announcements**
   - `aria-live="polite"` region in `PanelHost` to announce: "Opened {title}", "Highlighted {title}".

---

## Workstream 5 — Performance & Loading

### Purpose
Keep UI responsive on average devices without adding heavy libs.

### Goals
- Lazy‑load non‑critical widgets.
- Reduce unnecessary renders.

### Desired Outcomes
- Main route bundle growth ≤ ~25KB.

### Steps
1. **Lazy widgets**
```tsx
const TrendingWidget = React.lazy(()=>import('./TrendingWidget'));
```
2. **Suspense boundaries**
```tsx
<Suspense fallback={<CardSkeleton/>}>
  <TrendingWidget .../>
</Suspense>
```
3. **Memoization**
   - `React.memo(PanelCard)`; `useCallback` for handlers.
4. **Content visibility**
```css
.workspace{content-visibility:auto;contain-intrinsic-size: 800px}
```

---

## Workstream 6 — Pro Gating (Entitlements)

### Purpose
Centralize upsell logic and UI.

### Goals
- `useEntitlements()` hook; `<Entitled>` wrapper component.

### Desired Outcomes
- No duplicated gating logic in buttons or panels.

### Steps
1. **Hook** (`hooks/useEntitlements.ts`)
```ts
export function useEntitlements(){
  const isPro=false; // wire to real flag later
  return { isPro };
}
```
2. **Wrapper** (`components/Entitled.tsx`)
```tsx
export const Entitled:React.FC<{children:React.ReactNode, fallback?:React.ReactNode}> = ({children,fallback})=>{
  const {isPro}=useEntitlements();
  return isPro? <>{children}</> : (fallback??<button>Upgrade to Pro</button>);
};
```
3. **Usage**
   - Wrap gated actions in `<Entitled>`.

---

## Workstream 7 — Analytics & Explainability (Minimal)

### Purpose
Instrument key interactions locally and standardize source attributions.

### Goals
- Local event sink (console/localStorage) for `open/close/reorder`.
- Uniform `sources[]` footer UI.

### Desired Outcomes
- Inspectable usage without external services.

### Steps
1. **Event bus** (`utils/events.ts`)
```ts
export type Event={name:string; payload?:any; ts:number};
export const emit=(e:Event)=>{ try{ const k='events'; const arr=JSON.parse(localStorage.getItem(k)??'[]'); arr.push(e); localStorage.setItem(k,JSON.stringify(arr)); }catch{ /* noop */ } console.debug('[evt]',e); };
```
2. **Emit points**
   - On panel open/close, expand/pin, reorder.
3. **Sources footer** (`PanelCard`)
   - Render `sources[]` as small muted links.

---

## Workstream 8 — Design System (Tokens & Components)

### Purpose
Establish a cohesive visual language via CSS variables.

### Goals
- Centralize color/spacing/radius/shadow/type.
- Apply to cards, headers, chips, and buttons.

### Desired Outcomes
- Consistent rhythm and premium look without adding a UI lib.

### Steps
1. **Tokens** (`styles/tokens.css`)
```css
:root{--bg:#0b0d10;--bg-elev:#12161b;--card:#151a21;--line:#1f2630;--text:#e8eef7;--muted:#aeb6c2;--brand:#6ea8fe;--accent:#7de3c3;--danger:#ff6b6b;--warning:#ffc466;--success:#6be37d;--s-1:4px;--s0:8px;--s1:12px;--s2:16px;--s3:20px;--s4:24px;--s5:32px;--s6:40px;--s7:56px;--s8:72px;--r-sm:8px;--r-md:14px;--r-lg:20px;--r-xl:28px;--r-2xl:36px;--shadow-1:0 1px 2px rgba(0,0,0,.25);--shadow-2:0 6px 18px rgba(0,0,0,.35);--fs-xs:12px;--fs-sm:13px;--fs-md:15px;--fs-lg:17px;--fs-xl:20px;--fs-2xl:24px;--fs-3xl:28px}
```
2. **Card pattern** (`styles/components/card.css`)
```css
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-xl);box-shadow:var(--shadow-2);padding:var(--s4)}
.card header{display:flex;align-items:center;gap:var(--s2);justify-content:space-between;margin-bottom:var(--s2)}
.card .overline{font-size:var(--fs-xs);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
```
3. **Apply tokens** across header, buttons, chips.

---

## Workstream 9 — Empty & Error States

### Purpose
Provide clear feedback during loading/failure.

### Goals
- Shimmer skeleton for loading.
- Friendly retry affordance on error.

### Desired Outcomes
- Reduced bounce when data is pending or fails.

### Steps
1. **Skeleton** (`components/Skeleton.tsx`) — pure CSS keyframes.
2. **ErrorView** (`components/ErrorView.tsx`) with `onRetry` prop.
3. **Integrate** into `PanelCard` and lazy widget fallbacks.

---

## Workstream 10 — Header/Footer Simplification

### Purpose
Declutter chrome and standardize action placement.

### Goals
- Consolidate export/dev items under a single menu.
- Standardize chat footer CTAs.

### Desired Outcomes
- Cleaner small‑screen experience; fewer visual traps.

### Steps
1. **Kebab menu** in `HeaderBar` → contains Export JSON, Dev Tools, etc.
2. **Footer** → consistent layout with primary (Send) and secondary (Open in Workspace/Pin) actions.

---

## Acceptance (Global)
- Shell split achieved; surfaces/host components compiled without regressions.
- All panels conform to `Widget` type; grid responsive at 3 breakpoints with no CLS.
- First panel creation triggers Workspace nudge once per user (flagged).
- A11y roles/labels/focus visible; reduced‑motion respected; announcements present.
- Non‑critical widgets lazy‑loaded; memoization in place; content‑visibility applied.
- Upsell centralized via `<Entitled>`; sources footer standardized.
- Tokens applied; cards/headers/chips/buttons visually consistent.
- Skeleton/error components used universally.
- Header menu consolidated; footer actions standardized.


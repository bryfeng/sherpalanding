# Frontend Architecture Reference

**Last Updated:** 2026-01-12

This document provides a comprehensive architectural overview of the Sherpa frontend codebase. It serves as a reference for developers working on the project.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Component Hierarchy](#component-hierarchy)
3. [State Management](#state-management)
4. [Hooks Reference](#hooks-reference)
5. [Services & API Layer](#services--api-layer)
6. [Routing](#routing)
7. [Styling System](#styling-system)
8. [Convex Integration](#convex-integration)
9. [Key Architectural Patterns](#key-architectural-patterns)
10. [Data Flow Examples](#data-flow-examples)
11. [Build & Development](#build--development)
12. [Entry Point Flow](#entry-point-flow)

---

## Project Structure

```
frontend/
├── src/
│   ├── App.tsx                 # Main app entry, wallet sync, LLM providers
│   ├── main.tsx                # React root with Convex, React Query, Web3Provider
│   ├── index.css               # Global styles
│   │
│   ├── components/             # Reusable React components (organized by domain)
│   │   ├── shell/              # Shell layouts (DeFiChatShell)
│   │   ├── surfaces/           # Page surfaces (ChatSurface, ArtifactPanel)
│   │   ├── chat/               # Chat interface components
│   │   ├── header/             # Header bar components
│   │   ├── sidebar/            # Conversation history sidebar
│   │   ├── artifacts/          # Artifact panel system (tabs, picker)
│   │   ├── panels/             # Data visualization panels (charts, history)
│   │   ├── strategies/         # Strategy form and widgets
│   │   ├── policy/             # Risk policy components
│   │   ├── portfolio/          # Portfolio display components
│   │   ├── modals/             # Modal dialogs (Swap, Bridge, Relay, Simulate)
│   │   ├── transactions/       # Transaction history components
│   │   ├── inline/             # Inline component renderer
│   │   ├── widgets/            # Widget system components
│   │   ├── charts/             # Chart visualization components
│   │   ├── ui/                 # Primitives (Button, Card, Textarea)
│   │   └── personas/           # Persona selector UI
│   │
│   ├── hooks/                  # Custom React hooks
│   ├── store/                  # Zustand state management
│   ├── services/               # API clients and data transformers
│   ├── styles/                 # Design system and CSS
│   ├── types/                  # TypeScript type definitions
│   ├── pages/                  # Page components
│   ├── providers/              # React context/provider setup
│   ├── workspace/              # Workspace/portfolio features
│   ├── lib/                    # Utilities and helpers
│   ├── constants/              # Constants (widget IDs, chains)
│   └── utils/                  # Helper functions
│
├── convex/                     # Backend serverless functions
│   ├── schema.ts               # Database schema (23 tables)
│   ├── auth.ts                 # SIWE authentication
│   ├── conversations.ts        # Conversation queries/mutations
│   ├── strategies.ts           # Strategy CRUD
│   ├── strategyExecutions.ts   # Execution state machine
│   ├── transactions.ts         # Transaction logging & history
│   ├── sessionKeys.ts          # Signing session keys
│   └── ...                     # Other domain modules
│
├── package.json                # Dependencies
├── vite.config.ts              # Vite build config + vitest
├── tailwind.config.cjs         # Tailwind CSS configuration
└── tsconfig.json               # TypeScript configuration
```

---

## Component Hierarchy

### Main Layout Structure

```
App.tsx
├── MainApp() [core app logic]
│   └── DeFiChatAdaptiveUI [page component]
│       └── DeFiChatShell [layout shell]
│           ├── HeaderBar
│           ├── ConversationSidebar (left)
│           │   ├── ConversationList
│           │   └── ConversationItem
│           ├── ChatSurface (center)
│           │   ├── ChatInterface
│           │   ├── ChatInput
│           │   └── MessageBubble
│           └── ArtifactPanel (right)
│               ├── ArtifactTabs
│               ├── ArtifactContent
│               └── ArtifactPicker
```

### Component Categories

| Category | Location | Purpose |
|----------|----------|---------|
| **Shell** | `components/shell/` | Main layout containers |
| **Surfaces** | `components/surfaces/` | Major UI regions (chat, artifacts) |
| **Chat** | `components/chat/` | Messaging interface |
| **Artifacts** | `components/artifacts/` | Right panel widget system |
| **Panels** | `components/panels/` | Data visualization widgets |
| **Strategies** | `components/strategies/` | DCA/strategy management |
| **Policy** | `components/policy/` | Risk policy configuration |
| **Modals** | `components/modals/` | Transaction dialogs |
| **Transactions** | `components/transactions/` | Transaction history widget |
| **Widgets** | `components/widgets/` | Widget grid system |
| **UI** | `components/ui/` | Primitive components |

---

## State Management

### Zustand Stores

The frontend uses two independent Zustand stores:

#### Main Store (`store/index.ts`)

```typescript
useSherpaStore // 6 slices:

// APP SLICE - Theme, persona, LLM, health
{ theme, setTheme, toggleTheme, persona, setPersona, llmModel, setLlmModel }

// WALLET SLICE - Web3 state
{ wallet, setWallet, clearWallet, entitlement, isPro(), isGatingActive() }

// CHAT SLICE - Messages and conversation
{ conversationId, messages, isTyping, inputValue, addMessage, updateMessage }

// WORKSPACE SLICE - Artifact panel and widgets
{ artifactTabs, activeArtifactId, panelWidth, openArtifactTab, closeArtifactTab }

// CONVERSATION SIDEBAR SLICE
{ sidebarVisible, toggleSidebar, sidebarSearchQuery }

// UI SLICE - Modals, accessibility
{ modals, openModal, closeModal, ariaAnnouncement }
```

#### Widget Store (`store/widget-store.ts`)

```typescript
useWidgetStore // Separate workspace widget system:
{ widgets, addWidget, removeWidget, updateWidget, presets, pickerState }
```

### Persistence

- **localStorage**: Theme, persona, artifact tabs, sidebar state
- **Convex**: Conversations, strategies, policies (real-time sync)

### Convenience Hooks

```typescript
useTheme()      // Theme state + toggle
useWallet()     // Wallet connection state
useChat()       // Chat messages + actions
useWorkspace()  // Widget management
useArtifacts()  // Artifact panel state
```

---

## Hooks Reference

| Hook | File | Purpose |
|------|------|---------|
| `useDeFiChatController` | `hooks/useDeFiChatController.tsx` | **Orchestrator** - Coordinates chat, panels, modals |
| `useChatEngine` | `hooks/useChatEngine.ts` | Chat messages, conversation ID, API calls |
| `useConversations` | `hooks/useConversations.ts` | Load conversation history from Convex |
| `useEntitlements` | `hooks/useEntitlements.tsx` | Pro status, token gating validation |
| `useMarketData` | `hooks/useMarketData.ts` | Token prices, trending tokens |
| `useSessionKeys` | `hooks/useSessionKeys.ts` | Create/revoke signing session keys |
| `useStrategies` | `hooks/useStrategies.ts` | DCA strategy CRUD operations |
| `useStrategyExecution` | `hooks/useStrategyExecution.ts` | Execution state machine, approvals |
| `useRiskPolicy` | `hooks/useRiskPolicy.ts` | Risk evaluation, policy checks |
| `usePolicyStatus` | `hooks/usePolicyStatus.ts` | Current policy state tracking |
| `usePolicyEvaluation` | `hooks/usePolicyEvaluation.ts` | Transaction intent evaluation |
| `useTransactionHistory` | `hooks/useTransactionHistory.ts` | Transaction & execution history |

### Workspace Hooks (`workspace/hooks/`)

| Hook | Purpose |
|------|---------|
| `usePortfolioSummary` | Portfolio data fetching and caching |
| `usePendingApprovals` | Pending execution approvals |
| `useExecutionSigning` | Signing modal state + transaction logging |
| `useExecutionMutations` | Execution state change mutations |

---

## Services & API Layer

### API Client (`services/api.ts`)

```typescript
// Core API methods (axios-based)
health()                      // Backend health check
chat(payload)                 // Single chat request
chatStream(payload, onDelta)  // Streaming chat with delta updates
llmProviders()                // Available LLM models
entitlement(address, chain)   // Pro status check
```

### Data Services

| Service | File | Purpose |
|---------|------|---------|
| `panels` | `services/panels.ts` | Transform backend panels → widgets |
| `wallet` | `services/wallet.ts` | Address utilities, explorer URLs |
| `quotes` | `services/quotes.ts` | Swap quote retrieval |
| `prices` | `services/prices.ts` | Token price data (CoinGecko) |
| `trending` | `services/trending.ts` | Trending token fetching |
| `defi` | `services/defi.ts` | DeFi protocol data |
| `relay` | `services/relay.ts` | Cross-chain relay service |

---

## Routing

The frontend uses simple pathname checking (no React Router):

```typescript
// App.tsx
if (pathname.includes('widget-playground')) {
  return <WidgetPlayground />  // Dev/testing page
} else {
  return <DeFiChatAdaptiveUI /> // Main chat interface
}
```

**Routes:**
- `/` → `DeFiChatAdaptiveUI` - Main chat interface
- `/widget-playground` → `WidgetPlayground` - Development sandbox

---

## Styling System

### Design Philosophy

"Alpine Precision" - Clean lines with warm accents

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Framework** | TailwindCSS 3.4 |
| **Design Tokens** | CSS Variables (`styles/tokens.css`) |
| **Design System** | Custom CSS (`styles/design-system.css`) |
| **Animations** | Framer Motion 11.3 |

### Typography

| Font | Usage |
|------|-------|
| DM Sans | Body text |
| Outfit | Display/headings |
| JetBrains Mono | Code/monospace |

### Color Themes

```css
/* Dark Theme */
--bg: #0a0c10;        /* Ink gray background */
--accent: #f5a623;    /* Amber accent */

/* Light Theme */
--bg: #ffffff;        /* White background */
--accent: #2563eb;    /* Blue accent */
```

### Persona Styling

```html
<!-- Data attributes for persona-specific styles -->
<div data-persona="friendly">...</div>
<div data-persona="technical">...</div>
```

---

## Convex Integration

### Query Pattern

```typescript
import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'

// Read operations (real-time subscriptions)
const conversations = useQuery(api.conversations.list, { address })
const strategies = useQuery(api.strategies.listByWallet, { walletAddress })

// Write operations
const createStrategy = useMutation(api.strategies.create)
const approveExecution = useMutation(api.strategyExecutions.approve)
```

### Schema Overview (23 tables)

| Category | Tables |
|----------|--------|
| **Auth** | users, wallets, sessionKeys |
| **Chat** | conversations, messages |
| **Strategies** | strategies, strategyExecutions, dca |
| **Policy** | riskPolicies, systemPolicy |
| **Trading** | copyTrading, transactions |
| **Data** | news, tokenCatalog, walletActivity |

---

## Key Architectural Patterns

### 1. Wallet Sync Pattern

```typescript
// App.tsx - useWalletSync()
// Monitors: wagmi (EVM), AppKit (EVM + Solana)
// Priority: Solana > wagmi EVM > AppKit EVM
// Updates: useSherpaStore.setWallet()
```

### 2. Entitlement Gating

```typescript
// Check pro status for feature gating
const { isPro, isGatingActive } = useEntitlements()
const hasAccess = isPro() || !isGatingActive()
```

### 3. Artifact Panel System

```typescript
// Widget tabs in right panel
artifactTabs: string[]           // Widget IDs in tab order
activeArtifactId: string | null  // Currently visible widget
panelWidth: number               // Resizable width

// Actions
openArtifactTab(widgetId)        // Add to tabs, show
closeArtifactTab(widgetId)       // Remove from tabs
```

### 4. Panel Transformation

```typescript
// Backend panels → Frontend widgets
transformBackendPanels(panels) {
  return panels.map(p => ({
    id: p.id,
    kind: p.kind,       // 'chart', 'prices', 'portfolio'
    title: p.title,
    payload: p.payload, // Type-specific data
    sources: p.sources, // Data attribution
  }))
}
```

### 5. Streaming Chat

```typescript
// Progressive text rendering
api.chatStream(payload, (delta) => {
  // Called per stream chunk
  updateMessage(msgId, { text: accumulatedText })
})
// Final response includes actions/panels
```

---

## Data Flow Examples

### Chat Message Flow

```
User Input → ChatInput → useChatEngine.sendMessage()
    ↓
api.chatStream() → incremental deltas
    ↓
useSherpaStore.updateMessage() → UI re-render
    ↓
Response with { panels, actions } → Transform to widgets
    ↓
useSherpaStore.addWidget() → Show in ArtifactPanel
```

### Strategy Execution Flow

```
StrategyForm → useStrategies.create()
    ↓
Convex: strategies.create() → returns strategyId
    ↓
useStrategyExecution (subscription)
    ↓
strategyExecutions table state changes
    ↓
ExecutionSigningModal watches → user approves/rejects
    ↓
strategyExecutions.approve() → state machine progresses
```

### Portfolio Fetch Flow

```
usePortfolioSummary({ walletAddress, chain })
    ↓
API call → DefiLlama or Zerion
    ↓
Transform → PortfolioSummaryViewModel
    ↓
Components re-render with data
```

---

## Build & Development

### Commands

```bash
npm run dev       # Dev server (port 5173)
npm run build     # TypeScript check + vite build
npm run test      # Vitest tests
npm run typecheck # Type checking only
npm run lint      # ESLint
```

### Environment Variables

```bash
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_API_BASE_URL=http://localhost:8000
VITE_WALLETCONNECT_PROJECT_ID=your-project-id
```

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | 18.x | UI framework |
| typescript | 5.x | Type safety |
| vite | 5.4 | Build tool |
| zustand | 4.5 | State management |
| convex | 1.31 | Backend DB |
| wagmi | 2.12 | EVM wallet |
| viem | 2.21 | EVM interactions |
| framer-motion | 11.3 | Animations |
| tailwindcss | 3.4 | Styling |
| recharts | 2.12 | Charts |

---

## Entry Point Flow

```typescript
// main.tsx
ReactDOM.render(
  <ConvexProvider>          // Convex DB access
    <QueryClientProvider>   // React Query caching
      <Web3Provider>        // Wagmi + AppKit setup
        <App />
      </Web3Provider>
    </QueryClientProvider>
  </ConvexProvider>
)

// App.tsx
function App() {
  useWalletSync()           // Monitor wallet connection
  useHealthCheck()          // Backend health
  useLLMProviders()         // Get available models
  useEntitlementSync()      // Check pro status

  // Route to page
  return pathname.includes('widget-playground')
    ? <WidgetPlayground />
    : <DeFiChatAdaptiveUI />
}

// DeFiChatAdaptiveUI
function DeFiChatAdaptiveUI() {
  const controller = useDeFiChatController()
  return <DeFiChatShell {...controller} />
}
```

---

## Testing

### Structure

```
components/
├── strategies/
│   └── __tests__/
│       ├── StrategyForm.test.tsx
│       ├── StrategyList.test.tsx
│       └── StrategyCard.test.tsx
├── policy/
│   └── __tests__/
│       └── PolicyCheckList.test.tsx
```

### Setup

- **Framework**: Vitest + jsdom
- **Setup File**: `src/test/setup.ts`
- **Coverage**: v8 provider with HTML reporter

---

## Quick Reference

### File Locations

| What | Where |
|------|-------|
| Main store | `src/store/index.ts` |
| Widget store | `src/store/widget-store.ts` |
| API client | `src/services/api.ts` |
| Design tokens | `src/styles/design-system.css` |
| Convex schema | `convex/schema.ts` |
| Main page | `src/pages/DeFiChatAdaptiveUI.tsx` |
| Shell layout | `src/components/shell/DeFiChatShell.tsx` |
| Transaction history | `src/components/transactions/TransactionHistoryWidget.tsx` |
| Execution signing | `src/workspace/hooks/useExecutionSigning.ts` |

### Adding New Features

1. **New Component**: Add to appropriate `components/` subdirectory
2. **New Hook**: Add to `hooks/` with `use` prefix
3. **New Store Slice**: Add to `store/index.ts` slices
4. **New Convex Function**: Add to `convex/` with schema update
5. **New Widget**: Register in `lib/widget-registry.ts`

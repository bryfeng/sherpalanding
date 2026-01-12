# Frontend Production Roadmap

## MVP → Production-Grade Application

**Goal:** Build a polished, performant React application for DeFi portfolio management

**Last Updated:** 2026-01-12

---

## Current State Summary

The frontend has solid foundations:
- React 18 + TypeScript + Vite build system
- Zustand for state management
- Convex for real-time database
- TailwindCSS for styling
- Wallet connection via RainbowKit/wagmi

### Existing Architecture

```
frontend/src/
├── components/
│   ├── chat/             # Chat interface components
│   ├── header/           # App header, persona selector
│   ├── panels/           # Widget cards, panel host
│   ├── portfolio/        # Portfolio display components
│   ├── shell/            # App shell, layout
│   ├── surfaces/         # Modals, overlays
│   ├── ui/               # Primitive components
│   └── widgets/          # Widget system components
├── hooks/                # Custom React hooks
├── store/                # Zustand state management
├── styles/               # Design system CSS
├── services/             # API client services
├── providers/            # React context providers
├── pages/                # Page components
├── types/                # TypeScript types
├── lib/                  # Widget registry, utilities
├── workspace/            # Workspace types and hooks
└── utils/                # Utility functions
```

### Current Technology Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Framework** | React 18 | UI framework |
| **Build** | Vite | Dev server & bundler |
| **Language** | TypeScript 5 | Type safety |
| **State (Client)** | Zustand | Global state management |
| **State (Server)** | React Query | Async state & caching |
| **Database** | Convex | Real-time reactive database |
| **Styling** | TailwindCSS | Utility-first CSS |
| **Animation** | Framer Motion | Animations & transitions |
| **Wallet** | RainbowKit + wagmi | Wallet connection |
| **Charts** | Recharts | Data visualization |
| **Drag & Drop** | dnd-kit | Widget reordering |

---

## Implementation Phases

### Phase 1: Core Infrastructure
| Item | Status | Description |
|------|--------|-------------|
| Convex Integration | ✅ | Schema, queries, mutations |
| Wallet Connection | ✅ | RainbowKit/WalletConnect handles wallet auth |
| Real-time Subscriptions | 🔲 | Using React Query polling, not Convex subscriptions |
| Error Boundaries | 🚧 | Panel-level only, no global/chat boundaries |
| Loading States | 🚧 | Skeletons exist, animations incomplete |

### Phase 2: Chat & Agent Interface
| Item | Status | Description |
|------|--------|-------------|
| Chat Redesign | ✅ | Premium ChatInterface.tsx with animations |
| Persona Theming | ✅ | Full CSS vars + component integration |
| Message Streaming | ✅ | Progressive text rendering with streaming cursor |
| Action Confirmations | 🚧 | Modals exist, need polish |
| Chat History | 🔲 | Backend API ready, no UI/loading |

### Phase 2.6: Conversation History
| Item | Status | Description |
|------|--------|-------------|
| Conversation Sidebar | ✅ | Collapsible left sidebar showing past conversations |
| Conversation List | ✅ | List view with title, timestamp, grouped by date |
| New Conversation | ✅ | Button to start new conversation |
| Load Conversation | ✅ | Click to load previous messages into chat interface |
| Search Conversations | ✅ | Filter conversations by title |
| Archive/Delete | ✅ | Context menu actions to archive/delete/rename conversations |
| Conversation Sync | ✅ | Real-time Convex subscriptions for instant updates |

> **Backend APIs Available (Convex):**
> - `conversations.listByWallet` - List all conversations for wallet
> - `conversations.getWithMessages` - Load conversation with full message history
> - `conversations.create` - Create new conversation
> - `conversations.updateTitle` - Rename conversation
> - `conversations.archive` / `unarchive` - Archive management
> - `conversations.remove` - Delete conversation and messages

#### Phase 2.6 Implementation Details

**Layout Change:**
```
NEW (with sidebar):
┌──────────┬─────────────┬───────────┐
│ Convo    │    Chat     │  Artifact │
│ History  │             │   Panel   │
│          │             │           │
│ [Today]  │             │           │
│  · Swap  │             │           │
│  · Port. │             │           │
│ [Yester] │             │           │
│  · DCA   │             │           │
│          │             │           │
│ [+ New]  │             │           │
└──────────┴─────────────┴───────────┘
```

**Components to Build:**
1. `src/components/conversations/ConversationSidebar.tsx` - Collapsible sidebar container
2. `src/components/conversations/ConversationList.tsx` - Grouped list with date headers
3. `src/components/conversations/ConversationItem.tsx` - Individual conversation row (title, preview, time)
4. `src/components/conversations/ConversationSearch.tsx` - Search input with results
5. `src/components/conversations/NewConversationButton.tsx` - Floating or fixed button

**Zustand Store Extensions:**
```typescript
// Add to src/store/index.ts
conversationSlice: {
  conversations: Conversation[];
  activeConversationId: Id<"conversations"> | null;
  sidebarOpen: boolean;
  searchQuery: string;
  loadConversations: (walletId: Id<"wallets">) => void;
  selectConversation: (id: Id<"conversations">) => void;
  createConversation: () => void;
  archiveConversation: (id: Id<"conversations">) => void;
  deleteConversation: (id: Id<"conversations">) => void;
  toggleSidebar: () => void;
}
```

**Hooks to Create:**
- `useConversations(walletId)` - Fetch and subscribe to conversation list
- `useConversationMessages(conversationId)` - Load messages for selected conversation
- `useConversationSearch(query)` - Search across conversations

**Key Behaviors:**
1. **Auto-title**: First user message → LLM summarizes into ~5 word title
2. **Persistence**: All messages saved to Convex in real-time via `addMessage`
3. **Loading state**: Skeleton UI while loading conversation history
4. **Empty state**: Welcoming message when no conversations exist
5. **Keyboard shortcuts**: `Cmd+N` new, `Cmd+K` search, `Esc` close sidebar
6. **Mobile**: Sidebar becomes full-width overlay on small screens

### Phase 2.5: Artifact System
| Item | Status | Description |
|------|--------|-------------|
| Side Panel Layout | ✅ | Claude-style artifact panel (right side, resizable) |
| On-demand Panel | ✅ | Panel slides in when artifact created, collapsible |
| Tabbed Artifacts | ✅ | Multiple artifacts in tabs, switch between them |
| Pin from Chat | ✅ | User can pin any chat-generated artifact to panel |
| Keyboard Shortcuts | ✅ | Escape to close panel |
| Artifact Persistence | ✅ | LocalStorage persistence via Zustand persist |
| Immersive Mode | 🔲 | Expand artifact to full-width or modal view |

#### Phase 2.5 Completion Details (2026-01-02)

**Artifact Panel Implementation:**
- Files created:
  - `src/components/artifacts/ArtifactTabs.tsx` - Horizontal tab bar with close buttons
  - `src/components/artifacts/ArtifactHeader.tsx` - Panel header with title & collapse button
  - `src/components/artifacts/ArtifactContent.tsx` - Widget renderer with lazy loading
  - `src/components/artifacts/index.ts` - Barrel export
  - `src/components/surfaces/ArtifactPanel.tsx` - Main panel with Framer Motion animations
- Files modified:
  - `src/store/index.ts` - Added artifact tab state (artifactTabs, activeArtifactId, panelWidth) and actions
  - `src/components/shell/DeFiChatShell.tsx` - Integrated ArtifactPanel instead of WorkspaceSurface
  - `src/pages/DeFiChatAdaptiveUI.tsx` - Connected artifact store to shell, pin handler
  - `src/components/surfaces/ChatSurface.tsx` - Updated "Pin to Artifacts" button
- Key features:
  - Resizable panel with 350-800px width range
  - Slide-in/out animations using Framer Motion
  - Tab system with close buttons for multi-artifact support
  - Escape key to close panel
  - Auto-show panel when artifact pinned
  - Empty state with usage hints

#### Phase 2.6 Completion Details (2026-01-02)

**Conversation History Sidebar Implementation:**
- Files created:
  - `src/components/sidebar/ConversationSidebar.tsx` - Collapsible sidebar with header, search, and conversation list
  - `src/components/sidebar/ConversationList.tsx` - Grouped list with date headers (Today, Yesterday, etc.)
  - `src/components/sidebar/ConversationItem.tsx` - Single row with title, relative time, context menu (rename/archive/delete)
  - `src/components/sidebar/index.ts` - Barrel exports
  - `src/hooks/useConversations.ts` - Conversation management hook with Convex integration
  - `src/utils/dateGroups.ts` - Date grouping utility and search filtering
- Files modified:
  - `src/store/index.ts` - Added ConversationSidebarSlice (sidebarVisible, searchQuery, toggle actions)
  - `convex/conversations.ts` - Added `listByWalletAddress` query for wallet-based lookup
  - `src/components/shell/DeFiChatShell.tsx` - Integrated sidebar with History toggle button
  - `src/pages/DeFiChatAdaptiveUI.tsx` - Wired sidebar state from Zustand store
  - `src/hooks/useDeFiChatController.tsx` - Added effect to load conversation when selected from sidebar
- Key features:
  - Slide-in animation from left using Framer Motion
  - Real-time conversation list via Convex subscriptions
  - Date grouping (Today, Yesterday, This Week, This Month, Older)
  - Search/filter by conversation title
  - Context menu with rename (inline edit), archive, and delete actions
  - Auto-start new chat when current conversation archived/deleted
  - Loads full message history when conversation selected

#### Phase 2.7 Message Streaming (2026-01-05)

**Streaming Implementation:**
- Files modified:
  - `src/services/api.ts` - `chatStream()` SSE client with delta/final event parsing
  - `src/hooks/useDeFiChatController.tsx` - `sendPrompt()` uses streaming with RAF batching
  - `src/hooks/useChatEngine.ts` - Added `sendMessageStream()` function
  - `src/components/surfaces/ChatSurface.tsx` - Streaming cursor UI (pulsing accent block)
  - `src/types/defi-ui.ts` - Added `streaming?: boolean` flag to `AgentMessage`
- Key features:
  - Progressive text rendering as tokens arrive from backend
  - Pulsing cursor animation while streaming active
  - `requestAnimationFrame` batching for smooth 60fps updates (not `flushSync` which caused remounts)
  - Graceful fallback if streaming fails
- Technical notes:
  - Backend sends SSE events: `type: 'delta'` (text chunks), `type: 'final'` (complete response with panels/sources)
  - Frontend accumulates deltas and updates message text progressively
  - RAF batching prevents render thrashing from rapid delta callbacks

### Phase 3: Widget System
| Item | Status | Description |
|------|--------|-------------|
| Widget Registry | ✅ | 31 widgets, full metadata, factory functions |
| Widget State Persistence | 🚧 | localStorage only, Convex not implemented |
| Drag & Drop | ✅ | dnd-kit fully integrated |
| Widget Settings | 🔲 | Store methods exist, no UI |
| Widget Templates | ✅ | 3 presets + save capability |

### Phase 4: Portfolio & Trading
| Item | Status | Description |
|------|--------|-------------|
| Portfolio Dashboard | 🚧 | Basic display, no multi-chain |
| Position Cards | ✅ | Full UI with actions menu |
| Trade Execution UI | 🔲 | Stub modals only, no execution |
| Transaction History | ✅ | Full summary view with exports |
| P/L Tracking | 🔲 | 24h trend only, no detailed analytics |

### Phase 5: Strategy Management
| Item | Status | Description |
|------|--------|-------------|
| Strategy Types | ✅ | `types/strategy.ts` - DCA types, forms, filters |
| Strategy Hook | ✅ | `hooks/useStrategies.ts` - Convex integration |
| Strategy Cards | ✅ | `StrategyCard.tsx` - Display with status badges & actions |
| Strategy List | ✅ | `StrategyList.tsx` - List with search, filter, empty states |
| Strategy Form | ✅ | `StrategyForm.tsx` - Full create/edit form with validation |
| Strategies Widget | ✅ | `StrategiesWidget.tsx` - Artifact panel integration |
| Widget Registry | ✅ | Added `dca-strategies` to widget system |
| Navigation | ✅ | Header menu action to open strategies |
| Execution Logs | 🔲 | Backend ready, no detailed execution UI |
| Approval Queue | 🔲 | Backend ready, no frontend UI |
| Notifications | 🚧 | Basic Toast system, no strategy alerts |

#### Phase 5 Completion Details (2026-01-05)

**Strategy UI Implementation:**
- `src/types/strategy.ts` - Complete type system: `DCAStrategy`, `DCAExecution`, `DCAFormData`, `TokenInfo`, status/frequency enums
- `src/hooks/useStrategies.ts` - Hooks: `useStrategies`, `useStrategy`, `useStrategyExecutions`, `useStrategyMutations`, `useStrategyStats`
- `src/components/strategies/StrategyCard.tsx` - Card with token pair, frequency, status badge, menu actions
- `src/components/strategies/StrategyList.tsx` - List with search, status filter, loading skeletons, empty state
- `src/components/strategies/StrategyForm.tsx` - Multi-step form with token selection, schedule, advanced constraints
- `src/components/strategies/StrategiesWidget.tsx` - Artifact widget with list/create/edit/details views
- `src/components/artifacts/ArtifactContent.tsx` - Added `dca-strategies` renderer case
- `src/types/widget-system.ts` - Added `'dca-strategies'` to `WidgetKind` with payload type
- `src/lib/widget-registry.ts` - Added `dca-strategies` metadata and default payload
- `src/hooks/useDeFiChatController.tsx` - Added `openStrategies()` function and menu action

### Phase 6: Polish & Performance
| Item | Status | Description |
|------|--------|-------------|
| Code Splitting | 🚧 | React.lazy in panels, no route splitting |
| PWA Support | 🔲 | Not implemented |
| Performance Audit | 🚧 | Good memo/callback usage, no monitoring |
| Accessibility Audit | 🚧 | ARIA labels exist, incomplete keyboard nav |
| Mobile Optimization | 🚧 | Basic responsive, needs mobile menu |

### Phase 7: Policy Engine UI
| Item | Status | Description |
|------|--------|-------------|
| Risk Policy Settings | ✅ | User-configurable trading risk preferences |
| Session Key Management | ✅ | Create, view, revoke, extend session keys for agents |
| Policy Status Widget | ✅ | System status display with operational indicators |
| Policy Widgets in Artifacts | ✅ | Risk policy, session keys, and status as pinnable widgets |
| Policy Evaluation Feedback | ✅ | Real-time validation in swap/trade flows |
| System Policy Admin Panel | 🔲 | Admin-only emergency controls & blocklists |

> **📖 IMPLEMENTATION GUIDE:** For detailed specifications, UI mockups, data models, API endpoints, and Convex schema, see **[`planning/policy-ui-guide.md`](./policy-ui-guide.md)**

#### Phase 7 Completion Details (2026-01-02)

**Convex Schema & Functions:**
- `convex/schema.ts` - Added `riskPolicies` and `systemPolicy` tables
- `convex/riskPolicies.ts` - CRUD operations: `getByWallet`, `getOrDefault`, `upsert`, `reset`, `remove`
- `convex/systemPolicy.ts` - Singleton policy: `get`, `getStatus`, blocklist queries, admin mutations
- `convex/sessionKeys.ts` - Extended with `extend` and `getActiveCount` functions

**Types & Registry:**
- `src/types/policy.ts` - `RiskPolicyConfig`, presets (conservative/moderate/aggressive), `SessionKeyConfig`, `Permission`, `SystemPolicyStatus`
- `src/types/widget-system.ts` - Added `'risk-policy'`, `'session-keys'`, `'policy-status'` widget kinds with payloads
- `src/lib/widget-registry.ts` - Registered 3 policy widgets with metadata

**Hooks:**
- `src/hooks/useRiskPolicy.ts` - Policy CRUD with save/reset callbacks
- `src/hooks/useSessionKeys.ts` - Session management with create/revoke/extend
- `src/hooks/usePolicyStatus.ts` - System status with operational checks

**UI Components (`src/components/policy/`):**
- `RiskPolicyForm.tsx` - Full settings form with sliders, inputs, presets, save/reset
- `RiskPolicyWidget.tsx` - Compact artifact widget with expand to edit
- `SessionKeyForm.tsx` - Create session with permissions, limits, duration
- `SessionKeyCard.tsx` - Session display with progress bar, revoke/extend
- `SessionKeyList.tsx` - Sorted session list with expiry/active indicators
- `SessionKeysWidget.tsx` - Tabbed widget (list/create views)
- `PolicyStatusWidget.tsx` - System status with chain support display

**Integration:**
- `src/components/artifacts/ArtifactContent.tsx` - Policy widgets route to components
- `src/hooks/useDeFiChatController.tsx` - "Manage Policies" menu action opens risk-policy widget
- `src/components/header/SettingsMenu.tsx` - Policies button enabled with callback

#### Phase 7.1 - Policy Evaluation Feedback (2026-01-07)

**Types Added (`src/types/policy.ts`):**
- `TransactionIntent` - Pending transaction data (type, tokens, amounts, slippage, gas)
- `PolicyCheck` - Individual check result (id, label, status, message, details)
- `PolicyCheckStatus` - 'pass' | 'warn' | 'fail'
- `PolicyEvaluationResult` - Aggregated result (canProceed, checks, blockingCount, warningCount)
- Helper functions: `createPassCheck()`, `createWarnCheck()`, `createFailCheck()`

**Utility (`src/utils/extractTransactionIntent.ts`):**
- Extracts `TransactionIntent` from RelayQuoteWidget payload
- Handles swap/bridge detection, token info, USD amounts, slippage, gas

**Hook (`src/hooks/usePolicyEvaluation.ts`):**
- Evaluates transaction intent against all 3 policy layers:
  - **System Policy**: emergency stop, maintenance, chain/token/contract blocklists
  - **Risk Policy**: transaction limits, slippage limits, gas percentage limits
  - **Session Keys**: permissions, budgets, allowlists (if active session)
- Returns `PolicyEvaluationResult` with pass/warn/fail checks

**Component (`src/components/policy/PolicyCheckList.tsx`):**
- Visual checklist showing policy check results
- Status icons: ✅ pass, ⚠️ warn, 🚫 fail
- Expandable details for each check
- Summary badge showing counts
- Compact mode for collapsed widget state
- Loading state with skeleton

**Integration (`src/components/widgets/RelayQuoteWidget.tsx`):**
- Imports `usePolicyEvaluation`, `extractTransactionIntent`, `PolicyCheckList`
- Extracts intent from panel payload
- Shows PolicyCheckList before action buttons
- Disables confirm button if `!policyResult.canProceed`

**Tests (15 passing):**
- `src/utils/__tests__/extractTransactionIntent.test.ts` - 6 tests for intent extraction
- `src/components/policy/__tests__/PolicyCheckList.test.tsx` - 9 tests for component

#### Policy UI Summary

The policy engine has **three layers**, each requiring different UI:

| Layer | Who Controls | UI Location | Purpose |
|-------|--------------|-------------|---------|
| **System Policy** | Admins only | Admin Panel (`/admin/system-policy`) | Platform safety controls, emergency stop, blocklists |
| **Session Policy** | User (at creation) | Strategy Setup / Session Creation | Delegated access scoping for agents |
| **Risk Policy** | User | Settings (`/settings/risk`) | Personal risk preferences (limits, slippage, gas) |

**Key Components to Build:**
1. **Risk Settings Form** - Sliders/inputs for position limits, daily limits, transaction limits, slippage/gas tolerances
2. **Session Key Creator** - Permissions checkboxes, spending limits, chain/token allowlists, duration selector
3. **Active Sessions List** - Cards showing usage, budget remaining, expiry, revoke/extend actions
4. **Policy Check Display** - Real-time validation feedback showing ✅ passed / ⚠️ warnings / 🚫 blocks
5. **Blocked Action Modal** - Clear explanation of violations with recovery suggestions

### Phase 8: Strategy Execution System
| Item | Status | Description |
|------|--------|-------------|
| Pending Approvals Hook | ✅ | `usePendingApprovals` - Fetch awaiting_approval executions |
| Execution Mutations | ✅ | `useExecutionMutations` - approve/skip/complete/fail |
| Execution Signing Hook | ✅ | `useExecutionSigning` - Wallet signing flow state machine |
| Pending Approvals Widget | ✅ | Widget showing pending executions with approve/skip actions |
| Execution Signing Modal | ✅ | Global modal for wallet signing with quote display |
| Convex Execution Queries | ✅ | `getPendingApprovals`, `getReadyToSign`, `getByStrategy` |
| Convex Execution Mutations | ✅ | `approve`, `skip`, `complete`, `fail`, `transitionState` |
| Error Handling | ✅ | Recoverable vs non-recoverable error states |
| Notification Badge | ✅ | Header badge showing pending approval count |
| Unit Tests | ✅ | Tests for hooks and components (48 tests) |

> **📖 IMPLEMENTATION GUIDE:** For detailed architecture, state machine, hook API, and integration patterns, see **Phase 8 Implementation Details** below.

#### Phase 8 Completion Details (2026-01-09)

**Convex Schema & Functions (`convex/strategyExecutions.ts`):**
- `strategyExecutions` table with state machine fields, approval tracking, error handling
- Indexes: `by_strategy`, `by_state`, `by_wallet`, `by_wallet_state`
- Queries: `getPendingApprovals`, `getReadyToSign`, `get`, `getByStrategy`, `getByWallet`, `getStats`
- Mutations: `createPendingExecution`, `approve`, `skip`, `complete`, `fail`, `transitionState`, `checkDueStrategies`

**Hooks (`src/workspace/hooks/`):**
- `usePendingApprovals.ts` - Fetch pending executions, formatters (time, urgency, strategy type)
- `useExecutionMutations()` - approve/skip/complete/fail mutation wrappers
- `useExecution()` - Single execution details
- `useExecutionHistory()` - Strategy execution history
- `useExecutionSigning.ts` - Full signing flow state machine with wagmi integration

**Components:**
- `ExecutionSigningModal.tsx` - Global modal with quote display, status indicator, action buttons
- `ExecutionSigningBadge` - Pulsing badge for active signing
- `PendingApprovalsWidget` - Widget for artifact panel (in `WidgetContents.tsx`)
- `PendingExecutionsBadge` - Header notification badge (in `HeaderBar.tsx`)

**Widget Registry:**
- `pending-approvals` widget kind registered with metadata

**Tests (48 tests):**
- `usePendingApprovals.test.ts` - 19 tests for formatters, hook behavior
- `useExecutionSigning.test.ts` - 12 tests for state machine, loading, errors
- `ExecutionSigningModal.test.tsx` - 17 tests for modal UI states and interactions

---

## Implementation Order

| Phase | Focus | Status | Completion |
|-------|-------|--------|------------|
| **Phase 1** | Core Infrastructure | 🚧 In Progress | ~50% |
| **Phase 2** | Chat & Agent | 🚧 In Progress | ~85% |
| **Phase 2.5** | Artifact System | ✅ Complete | 100% |
| **Phase 2.6** | Conversation History | ✅ Complete | 100% |
| **Phase 3** | Widget System | 🚧 In Progress | ~75% |
| **Phase 4** | Portfolio & Trading | 🚧 In Progress | ~50% |
| **Phase 5** | Strategy Management | 🚧 In Progress | ~75% (core UI done, needs execution logs) |
| **Phase 6** | Polish & Performance | 🚧 In Progress | ~40% |
| **Phase 7** | Policy Engine UI | 🚧 In Progress | ~85% |
| **Phase 8** | Strategy Execution System | ✅ Complete | 100% |

---

## Phase 2.5: Artifact System Design

### Layout Change

```
CURRENT:                          NEW (Claude-style):
┌─────────────────────┐           ┌─────────────┬───────────┐
│       Chat          │           │    Chat     │  Artifact │
│                     │           │             │   Panel   │
│                     │           │             │           │
├─────────────────────┤           │             │ [Tab1|Tab2]│
│  Widgets/Portfolio  │           │             │           │
│    (underneath)     │           │             │ (pinned,  │
└─────────────────────┘           │             │ resizable)│
                                  └─────────────┴───────────┘
```

### Artifact Types

| Category | Examples |
|----------|----------|
| **Data Views** | Portfolio summary, token details, wallet overview |
| **Charts** | Price charts, allocation pie, P/L over time |
| **Actions** | Swap interface, bridge form, strategy builder |
| **References** | Transaction history, execution logs, saved searches |
| **AI Generated** | Analysis reports, recommendations, comparisons |

### Key Behaviors

1. **On-demand panel**: Slides in when artifact created/pinned, can be collapsed
2. **Tabbed interface**: Multiple artifacts open in tabs, switch between them
3. **Pin sources**: Pin from chat response OR access standalone (not chat-dependent)
4. **Persistence**: LocalStorage - artifacts persist across sessions on same device
5. **Immersive mode**: Option to expand artifact to full-width or modal for detailed work

### Implementation Notes

- Leverage existing widget components as artifact content
- New `ArtifactPanel` component with tab management
- New Zustand slice for artifact state (tabs, active tab, collapsed state)
- Resizable panel using existing `ResizablePanel` pattern
- Animate panel slide-in with Framer Motion

---

## Completion Details

### Phase 1.1 - Convex Integration (2025-12-26)

**Database Schema:**
- ✅ `frontend/convex/schema.ts` - Full schema with users, wallets, conversations, strategies, transactions
- ✅ `frontend/convex/users.ts` - User CRUD operations
- ✅ `frontend/convex/wallets.ts` - Wallet management
- ✅ `frontend/convex/conversations.ts` - Chat persistence
- ✅ `frontend/convex/strategies.ts` - Strategy management
- ✅ `frontend/convex/executions.ts` - Execution tracking
- ✅ `frontend/convex/transactions.ts` - Transaction logging
- ✅ `frontend/convex/scheduler.ts` - Strategy scheduling
- ✅ `frontend/convex/crons.ts` - Background jobs
- ✅ `frontend/convex/auth.ts` - Auth helpers (nonce, sessions)
- ✅ `frontend/convex/rateLimit.ts` - Rate limiting
- ✅ `frontend/convex/sessionKeys.ts` - Session key management

### Phase 2.1 - Chat Redesign (2025-12-27)

**Chat Components:**
- ✅ `src/components/chat/ChatInterface.tsx` - Premium chat with persona styling
- ✅ `src/components/chat/MessageBubble.tsx` - Message display
- ✅ `src/components/chat/ChatInput.tsx` - Input component
- ✅ `src/components/chat/ChatContainer.tsx` - Container component
- ✅ `src/styles/design-system.css` - Persona colors, animations, utility classes
- ✅ `src/store/index.ts` - Zustand store with 5 slices (App, Wallet, Chat, Workspace, UI)
- ✅ `src/hooks/useChatEngine.ts` - Focused chat hook
- ✅ `src/hooks/useMarketData.ts` - Market data fetching

### Phase 3.1 - Widget System (2025-12-28)

**Widget Infrastructure:**
- ✅ `src/lib/widget-registry.ts` - 31 widget types, metadata, factory functions
- ✅ `src/types/widget-system.ts` - Full type definitions
- ✅ `src/store/widget-store.ts` - Widget state with localStorage persistence
- ✅ `src/components/widgets/WidgetGrid.tsx` - dnd-kit grid with drag/drop
- ✅ `src/components/widgets/WidgetBase.tsx` - Widget wrapper with context menu
- ✅ `src/components/widgets/WidgetPicker.tsx` - Widget browser modal

### Phase 4.1 - Portfolio Display (2025-12-29)

**Portfolio Components:**
- ✅ `src/components/portfolio/PortfolioPanel.tsx` - Full-screen portfolio modal
- ✅ `src/components/portfolio/EnhancedPortfolioCard.tsx` - Expandable portfolio card
- ✅ `src/components/portfolio/PortfolioTokenRow.tsx` - Token row with expand/collapse
- ✅ `src/components/portfolio/PortfolioTokenActions.tsx` - Action menu (Swap, Send, Chart)
- ✅ `src/workspace/hooks/usePortfolioSummary.ts` - Portfolio data fetching

**Transaction History:**
- ✅ `src/components/panels/history/HistorySummaryPanel.tsx` - Transaction summary
- ✅ `src/components/panels/history/HistoryTrendCard.tsx` - Event indicators
- ✅ `src/components/panels/history/HistoryComparisonTable.tsx` - Comparison metrics
- ✅ `src/components/transactions/TransactionHistoryWidget.tsx` - Activity feed widget (transactions + executions)
- ✅ `src/hooks/useTransactionHistory.ts` - Transaction & execution data hooks

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main application component |
| `src/store/index.ts` | Zustand store (5 slices) |
| `src/store/widget-store.ts` | Widget state management |
| `src/lib/widget-registry.ts` | Widget metadata registry |
| `src/styles/design-system.css` | Design tokens, persona colors |
| `src/hooks/useChatEngine.ts` | Chat conversation logic |
| `src/hooks/useMarketData.ts` | Market data fetching |
| `src/services/api.ts` | API client with streaming support |
| `convex/schema.ts` | Database schema |
| `convex/transactions.ts` | Transaction logging & queries |
| `convex/_generated/` | Auto-generated Convex types |

---

## Environment Variables

```bash
# .env.local
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_API_BASE_URL=http://localhost:8000
VITE_WALLET_CONNECT_PROJECT_ID=your-project-id
```

---

## Priority Next Steps

### High Priority
1. **Trade Execution** - Integrate swap quotes (Jupiter/1inch), add execution flow
2. **System Policy Admin Panel** - Admin-only emergency controls & blocklists

### Medium Priority
3. **Strategy Execution Logs** - Detailed execution history per strategy
4. **Widget Settings UI** - Implement per-widget configuration modals
5. **Global Error Boundaries** - Wrap app, chat, and navigation sections

### Lower Priority
6. **Convex Widget Persistence** - Save layouts to Convex for cross-device sync
7. **PWA Support** - Add vite-plugin-pwa, service worker, manifest
8. **Mobile Menu** - Add hamburger navigation for small screens
9. **P/L Analytics** - Portfolio performance charts, cost basis tracking
10. **Accessibility Audit** - Complete WCAG 2.1 AA compliance

### Optional (Security Hardening)
11. **SIWE Auth Flow** - Backend already built (`/auth/*` endpoints). Only needed if you want server-side verified identity for rate limiting, audit logs, or sensitive operations. Wallet connection + transaction signing is sufficient for MVP.

### Recently Completed
- ✅ **Transaction History Widget** (2026-01-12) - Activity feed showing transactions + strategy executions with filter tabs
- ✅ **Transaction Logging** (2026-01-12) - Execution signing now logs transactions to Convex (pending → submitted → confirmed)
- ✅ **Policy Evaluation Feedback** (2026-01-07) - Real-time policy validation in swap/bridge flows with pass/warn/fail checks
- ✅ **Strategy UI** (2026-01-05) - Full DCA strategy management with create/edit/list/details views

---

## Phase 8: Strategy Execution System - Implementation Details

This section provides detailed implementation guidance for the strategy execution approval and signing system.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │ usePendingApprovals│    │ useExecutionSigning│                │
│  │                  │    │                  │                   │
│  │ • Pending list   │    │ • Ready to sign  │                   │
│  │ • Approve/Skip   │    │ • Quote fetch    │                   │
│  └────────┬─────────┘    │ • Wallet signing │                   │
│           │              │ • Tx confirmation│                   │
│           │              └────────┬─────────┘                   │
│           ▼                       ▼                             │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │ PendingApprovals │    │ExecutionSigningModal│                │
│  │     Widget       │    │   (Global Modal)  │                   │
│  └──────────────────┘    └──────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Convex (Real-time DB)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Queries:                    Mutations:                          │
│  • getPendingApprovals       • approve                           │
│  • getReadyToSign            • skip                              │
│  • get                       • complete                          │
│  • getByStrategy             • fail                              │
│  • getByWallet               • transitionState                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Execution State Machine

```
                    ┌─────────┐
                    │  idle   │
                    └────┬────┘
                         │ Strategy due
                         ▼
               ┌──────────────────┐
               │ awaiting_approval │◄──────────────────┐
               └────────┬─────────┘                    │
                        │                              │
           ┌────────────┼────────────┐                 │
           │            │            │                 │
           ▼            ▼            ▼                 │
      ┌─────────┐  ┌─────────┐  ┌─────────┐           │
      │ skipped │  │executing│  │cancelled│           │
      └─────────┘  └────┬────┘  └─────────┘           │
                        │                              │
                        │ Wallet signs                 │
                        ▼                              │
                  ┌───────────┐                        │
                  │ monitoring │                       │
                  └─────┬─────┘                        │
                        │                              │
           ┌────────────┴────────────┐                 │
           ▼                         ▼                 │
      ┌─────────┐              ┌─────────┐            │
      │completed│              │ failed  │────────────┘
      └─────────┘              └─────────┘  (if recoverable)
```

**State Descriptions:**

| State | Description | Frontend Action |
|-------|-------------|-----------------|
| `awaiting_approval` | Pending user approval | Show in PendingApprovals widget |
| `executing` | Approved, ready for wallet signing | Show ExecutionSigningModal |
| `monitoring` | Transaction submitted, awaiting confirmation | Show confirming status |
| `completed` | Transaction confirmed on-chain | Show success, record tx_hash |
| `failed` | Execution failed (may be recoverable) | Show error, allow retry |
| `skipped` | User skipped this execution | Schedule next execution |
| `cancelled` | Strategy deactivated | No action |

### Key Files to Create

```
frontend/
├── convex/
│   └── strategyExecutions.ts      # Convex queries & mutations
├── src/
│   ├── workspace/
│   │   ├── hooks/
│   │   │   ├── usePendingApprovals.ts   # Pending executions hook
│   │   │   ├── useExecutionSigning.ts   # Wallet signing hook
│   │   │   └── index.ts                 # Hook exports
│   │   └── components/
│   │       └── ExecutionSigningModal.tsx # Signing modal UI
│   └── components/
│       └── widgets/
│           └── PendingApprovalsWidget.tsx # Approval list widget
```

### Hook API Reference

#### `usePendingApprovals(walletAddress)`

Fetches pending executions awaiting user approval.

```typescript
const {
  executions,      // PendingExecution[]
  count,           // number
  isLoading,       // boolean
  isEmpty,         // boolean
} = usePendingApprovals(address ?? null)
```

**Return Type:**
```typescript
interface PendingExecution {
  _id: Id<'strategyExecutions'>
  strategyId: Id<'strategies'>
  walletAddress: string
  currentState: 'awaiting_approval'
  stateEnteredAt: number
  requiresApproval: boolean
  approvalReason?: string
  createdAt: number
  strategy: {
    _id: Id<'strategies'>
    name: string
    strategyType: 'dca' | 'rebalance' | 'limit_order' | 'stop_loss' | 'take_profit' | 'custom'
    config: Record<string, unknown>
  } | null
}
```

#### `useExecutionMutations()`

Provides mutation functions for execution state changes.

```typescript
const { approve, skip, complete, fail } = useExecutionMutations()

await approve(executionId, approverAddress)  // → "executing" state
await skip(executionId, 'User skipped')      // → "skipped" state
await complete(executionId, txHash, outputData)
await fail(executionId, errorMessage, errorCode, recoverable)
```

#### `useExecutionSigning()`

Watches for executions ready to sign and handles the wallet signing flow.

```typescript
const {
  // State
  state,           // SigningState
  isActive,        // boolean - should modal be visible?
  pendingCount,    // number
  statusMessage,   // string

  // Loading states
  isLoading,       // boolean
  isSuccess,       // boolean

  // Transaction data
  txHash,          // string | undefined
  approvalTxHash,  // string | undefined (for ERC20 approvals)
  quote,           // SwapQuoteResponse | null
  execution,       // ExecutionReadyToSign | null

  // Errors
  error,           // string | undefined

  // Actions
  signTransaction, // () => Promise<void>
  dismiss,         // () => Promise<void>
  reset,           // () => void
} = useExecutionSigning()
```

**Signing Status Flow:**
```typescript
type SigningStatus =
  | 'idle'              // No active signing
  | 'fetching_quote'    // Getting swap quote from backend
  | 'awaiting_signature'// Quote ready, waiting for user action
  | 'signing'           // User prompted in wallet
  | 'confirming'        // Tx submitted, waiting for confirmation
  | 'completed'         // Tx confirmed successfully
  | 'failed'            // Error occurred
  | 'dismissed'         // User dismissed modal
```

### Convex Schema & Queries

**strategyExecutions table fields:**
- `strategyId` - Reference to parent strategy
- `walletAddress` - Wallet that owns the strategy
- `currentState` - State machine state
- `stateEnteredAt` - Timestamp of last state change
- `requiresApproval` - Whether manual approval needed
- `approvalReason` - Why approval is required
- `txHash` - On-chain transaction hash (when completed)
- `errorMessage`, `errorCode` - Failure details
- `inputData`, `outputData` - Execution parameters and results

**Queries:**
```typescript
getPendingApprovals({ walletAddress })  // awaiting_approval executions
getReadyToSign({ walletAddress })       // executing state executions
get({ executionId })                    // Single execution
getByStrategy({ strategyId, limit })    // Execution history
getByWallet({ walletAddress, limit })   // All wallet executions
```

**Mutations:**
```typescript
approve({ executionId, approverAddress })
skip({ executionId, reason })
complete({ executionId, txHash, outputData })
fail({ executionId, errorMessage, errorCode, recoverable })
transitionState({ executionId, newState })
```

### Integration Guide

**Step 1: Add ExecutionSigningModal to App**
```tsx
// App.tsx
import { ExecutionSigningModal } from './workspace/components/ExecutionSigningModal'

function App() {
  const { address } = useAccount()
  return (
    <div>
      <MainContent />
      {address && <ExecutionSigningModal />}
    </div>
  )
}
```

**Step 2: Add Pending Approvals Widget**
```tsx
// Register in widget-registry.ts
{
  kind: 'pending-approvals',
  title: 'Pending Approvals',
  icon: ClockIcon,
  description: 'Strategy executions awaiting approval',
}
```

**Step 3: Add Header Notification Badge**
```tsx
// components/header/HeaderBar.tsx
const { count } = usePendingApprovals(address ?? null)

{count > 0 && (
  <span className="badge badge-amber">{count}</span>
)}
```

### Wallet Integration

Uses wagmi hooks for wallet interaction:
```typescript
import {
  useSendTransaction,
  useWaitForTransactionReceipt,
  useWriteContract,
  useAccount,
  usePublicClient,
} from 'wagmi'
```

**ERC20 Approval Flow:**
1. Check current allowance: `publicClient.readContract()`
2. If insufficient, prompt approval: `writeContract({ functionName: 'approve' })`
3. Wait for approval confirmation
4. Execute swap transaction

### Error Handling

| Error Code | Cause | Recovery |
|------------|-------|----------|
| `INSUFFICIENT_BALANCE` | Not enough tokens | Show balance, suggest deposit |
| `SLIPPAGE_EXCEEDED` | Price moved too much | Retry with higher slippage |
| `USER_REJECTED` | User rejected in wallet | Allow retry |
| `QUOTE_EXPIRED` | Quote took too long | Fetch new quote |
| `NETWORK_ERROR` | RPC/API failure | Retry with backoff |

### Testing Patterns

**Unit Tests:**
```typescript
describe('useExecutionSigning', () => {
  it('detects new executions ready to sign')
  it('handles successful signing flow')
  it('handles user dismissal')
  it('handles recoverable errors')
})
```

**Component Tests:**
```typescript
describe('ExecutionSigningModal', () => {
  it('shows quote details when ready to sign')
  it('calls signTransaction when button clicked')
  it('shows error state on failure')
})
```

### Troubleshooting

**Modal Not Appearing:**
1. Check wallet connection - Modal only renders when `wallet.address` exists
2. Check execution state - Must be in "executing" state (not "awaiting_approval")
3. Check Convex subscription - Verify `getReadyToSign` query is returning data

**Transaction Failing:**
1. Insufficient balance - Check wallet has enough tokens + gas
2. Approval needed - For ERC20 tokens, approval tx may be required first
3. Quote expired - Quotes have limited validity (~30 seconds)
4. Wrong chain - Ensure wallet is on correct network

**Quote Not Loading:**
1. Backend health - Check API is responding
2. Token support - Verify tokens are supported by swap provider
3. Amount too small - Some providers have minimum amounts

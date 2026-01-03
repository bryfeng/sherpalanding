# Copy Trading UI Guide

This guide covers building the frontend for copy trading functionality, allowing users to follow and automatically replicate trades from successful wallets.

## Overview

Copy trading enables users to automatically mirror the trades of skilled traders ("leaders"). When a leader executes a swap, the system detects the transaction and replicates it for all followers based on their configured sizing and risk parameters.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Copy Trading Flow                            │
│                                                                  │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│   │   Leader    │     │   Event     │     │   Copy      │       │
│   │   Wallet    │────▶│   Monitor   │────▶│   Manager   │       │
│   │   (Swap)    │     │  (Detect)   │     │ (Validate)  │       │
│   └─────────────┘     └─────────────┘     └──────┬──────┘       │
│                                                   │              │
│                                                   ▼              │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│   │  Follower   │◀────│   Copy      │◀────│   Sizing    │       │
│   │   Wallet    │     │  Executor   │     │  Strategy   │       │
│   │   (Trade)   │     │  (Execute)  │     │ (Calculate) │       │
│   └─────────────┘     └─────────────┘     └─────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Leader** | A wallet being copied (the trader to follow) |
| **Follower** | The user's wallet that replicates trades |
| **Relationship** | The connection between a follower and leader with config |
| **Signal** | A detected trade from a leader that may trigger a copy |
| **Execution** | The result of attempting to copy a trade |

---

## Data Model

### CopyConfig

Configuration for how to copy a leader's trades.

```typescript
interface CopyConfig {
  // Leader identification
  leaderAddress: string;          // Wallet address to follow
  leaderChain: string;            // Chain (e.g., "ethereum", "base")
  leaderLabel?: string;           // Display name (e.g., "DeFi Whale")

  // Position sizing
  sizingMode: SizingMode;         // How to calculate trade size
  sizeValue: string;              // Value for sizing calculation

  // Trade limits
  minTradeUsd: string;            // Minimum trade value to copy
  maxTradeUsd?: string;           // Maximum trade value per copy

  // Token filtering
  tokenWhitelist?: string[];      // Only copy these tokens (optional)
  tokenBlacklist?: string[];      // Never copy these tokens (optional)
  allowedActions: string[];       // Actions to copy (e.g., ["swap"])

  // Execution settings
  delaySeconds: number;           // Min delay before copying (0 = instant)
  maxDelaySeconds: number;        // Max delay (for randomization)
  maxSlippageBps: number;         // Max slippage in basis points

  // Daily limits
  maxDailyTrades: number;         // Max copies per day
  maxDailyVolumeUsd: string;      // Max daily copy volume

  // Session key (for autonomous execution)
  sessionKeyId?: string;          // Session key to use for trades
}

type SizingMode =
  | "percentage"    // % of leader's trade size
  | "fixed"         // Fixed USD amount per trade
  | "proportional"; // Based on follower's portfolio size

// Examples:
// { sizingMode: "percentage", sizeValue: "50" } → Copy at 50% of leader's size
// { sizingMode: "fixed", sizeValue: "100" } → Always trade $100
// { sizingMode: "proportional", sizeValue: "1" } → Match leader's % of portfolio
```

### CopyRelationship

The active copy relationship between a follower and leader.

```typescript
interface CopyRelationship {
  // Identity
  id: string;                     // Unique relationship ID
  userId: string;                 // Privy user ID
  followerAddress: string;        // Follower wallet address
  followerChain: string;          // Follower chain

  // Configuration
  config: CopyConfig;             // Copy settings

  // Status
  isActive: boolean;              // Whether copying is enabled
  isPaused: boolean;              // Temporarily paused
  pauseReason?: string;           // Why paused (if applicable)

  // Daily tracking (resets daily)
  dailyTradeCount: number;        // Trades today
  dailyVolumeUsd: string;         // Volume today
  dailyResetAt: number;           // When to reset (timestamp)

  // Lifetime stats
  totalTrades: number;            // Total copies attempted
  successfulTrades: number;       // Successful executions
  failedTrades: number;           // Failed executions
  skippedTrades: number;          // Skipped (filtered out)
  totalVolumeUsd: string;         // Total volume copied
  totalPnlUsd?: string;           // Estimated P&L

  // Timestamps
  createdAt: number;
  updatedAt: number;
  lastCopyAt?: number;            // Last successful copy
}
```

### CopyExecution

Record of a single copy trade attempt.

```typescript
interface CopyExecution {
  // Identity
  id: string;
  relationshipId: string;

  // Source signal (leader's trade)
  signal: TradeSignal;

  // Execution status
  status: ExecutionStatus;
  skipReason?: string;            // If skipped, why

  // Trade details
  calculatedSizeUsd?: string;     // Planned size
  actualSizeUsd?: string;         // Actual size executed
  txHash?: string;                // Transaction hash
  tokenOutAmount?: string;        // Tokens received
  slippageBps?: number;           // Actual slippage

  // Gas
  gasUsed?: number;
  gasPriceGwei?: string;
  gasCostUsd?: string;

  // Error handling
  errorMessage?: string;

  // Timestamps
  signalReceivedAt: number;
  executionStartedAt?: number;
  executionCompletedAt?: number;
}

type ExecutionStatus =
  | "pending"     // Waiting to execute
  | "executing"   // Currently executing
  | "completed"   // Successfully completed
  | "failed"      // Execution failed
  | "skipped";    // Filtered out (didn't meet criteria)

interface TradeSignal {
  leaderAddress: string;
  leaderChain: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  action: string;                 // "swap", "bridge", etc.
  tokenInAddress: string;
  tokenInSymbol?: string;
  tokenInAmount: string;
  tokenOutAddress: string;
  tokenOutSymbol?: string;
  tokenOutAmount?: string;
  valueUsd?: string;
  dex?: string;
}
```

### LeaderProfile

Analytics and profile for a leader wallet.

```typescript
interface LeaderProfile {
  // Identity
  address: string;
  chain: string;
  label?: string;                 // Display name
  notes?: string;                 // User notes

  // Performance metrics
  totalTrades: number;
  winRate?: number;               // 0-100%
  avgTradePnlPercent?: number;    // Average P&L per trade
  totalPnlUsd?: number;           // Total P&L
  sharpeRatio?: number;           // Risk-adjusted return
  maxDrawdownPercent?: number;    // Maximum drawdown

  // Trading behavior
  avgTradesPerDay?: number;
  mostTradedTokens: string[];     // Top tokens by volume
  preferredSectors: string[];     // DeFi, NFT, etc.

  // Copy stats
  followerCount: number;          // How many are copying
  totalCopiedVolumeUsd: number;   // Total volume copied

  // Status
  isActive: boolean;
  firstSeenAt: number;
  lastActiveAt: number;
  dataQualityScore: number;       // 0-100 (data reliability)
  lastAnalyzedAt?: number;
}
```

---

## API Endpoints

### REST API

```typescript
// Base URL: /api/copy-trading

// === Relationships ===

// Create a new copy relationship
POST /relationships
Body: {
  followerAddress: string;
  followerChain: string;
  config: CopyConfig;
}
Response: CopyRelationship

// List user's copy relationships
GET /relationships
Query: { userId: string }
Response: CopyRelationship[]

// Get specific relationship
GET /relationships/{id}
Response: CopyRelationship

// Update configuration
PATCH /relationships/{id}/config
Body: Partial<CopyConfig>
Response: CopyRelationship

// Pause/resume copying
POST /relationships/{id}/pause
Body: { reason?: string }
Response: CopyRelationship

POST /relationships/{id}/resume
Response: CopyRelationship

// Stop copying (deactivate)
POST /relationships/{id}/stop
Response: CopyRelationship

// Activate with session key
POST /relationships/{id}/activate
Body: { sessionKeyId: string }
Response: CopyRelationship

// === Executions ===

// Get execution history
GET /relationships/{id}/executions
Query: { limit?: number, status?: string }
Response: CopyExecution[]

// === Leaders ===

// Get leader profile
GET /leaders/{chain}/{address}
Response: LeaderProfile

// Get leaderboard
GET /leaderboard
Query: {
  chain?: string;
  sortBy?: "winRate" | "totalPnlUsd" | "sharpeRatio";
  minTrades?: number;
  limit?: number;
}
Response: LeaderProfile[]

// === Stats ===

// Get user's copy trading stats
GET /stats
Query: { userId: string }
Response: {
  totalRelationships: number;
  activeRelationships: number;
  totalCopiedVolumeUsd: string;
  totalPnlUsd: string;
  successRate: number;
}

// Estimate copy trade
POST /estimate
Body: {
  leaderAddress: string;
  leaderChain: string;
  followerAddress: string;
  config: CopyConfig;
  signalValueUsd: string;
}
Response: {
  estimatedSizeUsd: string;
  wouldExecute: boolean;
  skipReason?: string;
}
```

---

## Convex Functions

### Queries

```typescript
import { api } from "../convex/_generated/api";

// Get a relationship by ID
const relationship = await convex.query(api.copyTrading.getRelationship, {
  id: "rel_abc123",
});

// List relationships for a user
const relationships = await convex.query(api.copyTrading.listByUser, {
  userId: "user_xyz",
});

// List followers of a leader
const followers = await convex.query(api.copyTrading.listByLeader, {
  leaderAddress: "0x...",
  leaderChain: "ethereum",
});

// Get execution history
const executions = await convex.query(api.copyTrading.listExecutions, {
  relationshipId: "rel_abc123",
  limit: 50,
  status: "completed", // optional filter
});

// Get leaderboard
const leaders = await convex.query(api.copyTrading.getLeaderboard, {
  chain: "ethereum",
  sortBy: "totalPnlUsd",
  minTrades: 10,
  limit: 50,
});

// Get watched wallet (leader profile)
const leader = await convex.query(api.copyTrading.getWatchedWallet, {
  address: "0x...",
  chain: "ethereum",
});
```

### Mutations

```typescript
// Create or update relationship
await convex.mutation(api.copyTrading.upsertRelationship, {
  id: "rel_abc123",
  userId: "user_xyz",
  followerAddress: "0x...",
  followerChain: "ethereum",
  config: {
    leaderAddress: "0x...",
    leaderChain: "ethereum",
    leaderLabel: "DeFi Whale",
    sizingMode: "percentage",
    sizeValue: "50",
    minTradeUsd: "10",
    maxTradeUsd: "1000",
    allowedActions: ["swap"],
    delaySeconds: 0,
    maxDelaySeconds: 30,
    maxSlippageBps: 100,
    maxDailyTrades: 10,
    maxDailyVolumeUsd: "5000",
  },
  isActive: true,
  isPaused: false,
  dailyTradeCount: 0,
  dailyVolumeUsd: "0",
  dailyResetAt: Date.now() + 24 * 60 * 60 * 1000,
  totalTrades: 0,
  successfulTrades: 0,
  failedTrades: 0,
  skippedTrades: 0,
  totalVolumeUsd: "0",
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

// Insert execution record
await convex.mutation(api.copyTrading.insertExecution, {
  id: "exec_xyz",
  relationshipId: "rel_abc123",
  signal: {
    leaderAddress: "0x...",
    leaderChain: "ethereum",
    txHash: "0x...",
    blockNumber: 12345678,
    timestamp: Date.now(),
    action: "swap",
    tokenInAddress: "0x...",
    tokenInSymbol: "USDC",
    tokenInAmount: "1000",
    tokenOutAddress: "0x...",
    tokenOutSymbol: "ETH",
    valueUsd: "1000",
  },
  status: "completed",
  calculatedSizeUsd: "500",
  actualSizeUsd: "498.50",
  txHash: "0x...",
  signalReceivedAt: Date.now(),
  executionCompletedAt: Date.now(),
});

// Update watched wallet (leader profile)
await convex.mutation(api.copyTrading.upsertWatchedWallet, {
  address: "0x...",
  chain: "ethereum",
  label: "DeFi Whale",
  totalTrades: 150,
  winRate: 68.5,
  avgTradePnlPercent: 12.3,
  totalPnlUsd: 125000,
  sharpeRatio: 2.1,
  maxDrawdownPercent: 15.2,
  avgTradesPerDay: 3.5,
  mostTradedTokens: ["ETH", "USDC", "ARB"],
  preferredSectors: ["DeFi", "L2"],
  followerCount: 45,
  totalCopiedVolumeUsd: 2500000,
  isActive: true,
  firstSeenAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
  lastActiveAt: Date.now(),
  dataQualityScore: 95,
});
```

---

## UI Components

### 1. Leaderboard / Discovery

The main entry point for finding leaders to copy.

```
┌─────────────────────────────────────────────────────────────────┐
│  Copy Trading                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [My Copies (3)]    [Discover Leaders]    [Analytics]           │
│                          ▲ selected                              │
│                                                                  │
│  ┌─ Filters ──────────────────────────────────────────────────┐ │
│  │                                                             │ │
│  │  Chain: [All ▾]   Min Trades: [10 ▾]   Sort: [P&L ▾]       │ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  #1  🏆                                                     │ │
│  │  ┌──────┐  DeFi Whale                      [Copy Trader]   │ │
│  │  │ 🐋  │  0x7a2f...8c3d                                    │ │
│  │  └──────┘  Ethereum                                         │ │
│  │                                                             │ │
│  │  Win Rate     Total P&L      Sharpe     Trades    Copiers  │ │
│  │  68.5%        +$125,000      2.1        150       45       │ │
│  │  ████████░░   ██████████░    ████░░░░   ████████  ████░░   │ │
│  │                                                             │ │
│  │  Top Tokens: ETH, USDC, ARB  |  Sectors: DeFi, L2          │ │
│  │  Avg Trade: $2,500  |  Last Active: 2 hours ago            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  #2                                                         │ │
│  │  ┌──────┐  Arbitrage Bot                   [Copy Trader]   │ │
│  │  │ 🤖  │  0x3f1c...2e9a                                    │ │
│  │  └──────┘  Base                                             │ │
│  │                                                             │ │
│  │  Win Rate     Total P&L      Sharpe     Trades    Copiers  │ │
│  │  82.1%        +$89,500       3.2        420       32       │ │
│  │                                                             │ │
│  │  Top Tokens: USDC, ETH  |  Sectors: Arbitrage              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  #3                                                         │ │
│  │  ┌──────┐  NFT Flipper                     [Copy Trader]   │ │
│  │  │ 🎨  │  0x9c4d...7b2e                                    │ │
│  │  └──────┘  Ethereum                                         │ │
│  │                                                             │ │
│  │  Win Rate     Total P&L      Sharpe     Trades    Copiers  │ │
│  │  55.2%        +$67,200       1.4        85        18       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [Load More]                                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Leader Profile Detail

Detailed view when clicking on a leader.

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Leaderboard                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ┌────────┐                                              │   │
│  │  │  🐋   │  DeFi Whale                                   │   │
│  │  │        │  0x7a2f...8c3d                               │   │
│  │  └────────┘  Ethereum   ● Active (2h ago)                │   │
│  │                                                          │   │
│  │              [Copy This Trader]                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Performance Overview ───────────────────────────────────┐   │
│  │                                                          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │   │
│  │  │ Win Rate │ │Total P&L │ │  Sharpe  │ │ Drawdown │    │   │
│  │  │  68.5%   │ │ +$125K   │ │   2.1    │ │  -15.2%  │    │   │
│  │  │    ↑5%   │ │   ↑12%   │ │   ↑0.3   │ │   ↓2%    │    │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ P&L Chart (90 days) ────────────────────────────────────┐   │
│  │                                                          │   │
│  │    $150k ┤                                    ╭──────    │   │
│  │          │                              ╭─────╯          │   │
│  │    $100k ┤                    ╭────────╯                 │   │
│  │          │          ╭────────╯                           │   │
│  │     $50k ┤   ╭──────╯                                    │   │
│  │          │───╯                                           │   │
│  │       $0 ┼───────────────────────────────────────────    │   │
│  │          Oct       Nov       Dec       Jan               │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Trading Stats ──────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  Total Trades: 150        Avg Trade Size: $2,500         │   │
│  │  Trades/Day: 3.5          Avg Hold Time: 4.2 hours       │   │
│  │  Biggest Win: +$15,200    Biggest Loss: -$3,800          │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Top Tokens ─────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  ETH      ████████████████████████  45%                  │   │
│  │  USDC     ████████████░░░░░░░░░░░░  28%                  │   │
│  │  ARB      ████████░░░░░░░░░░░░░░░░  15%                  │   │
│  │  Other    ████░░░░░░░░░░░░░░░░░░░░  12%                  │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Recent Trades ──────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  2h ago   swap   1,500 USDC → 0.52 ETH    +$45    ✓     │   │
│  │  5h ago   swap   2,000 ARB  → 1,850 USDC  -$12    ✓     │   │
│  │  8h ago   swap   0.8 ETH   → 2,300 USDC   +$180   ✓     │   │
│  │  1d ago   swap   5,000 USDC → 2.1 ETH     +$320   ✓     │   │
│  │                                                          │   │
│  │  [View All Trades]                                       │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Copy Stats ─────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  👥 45 Copiers   |   💰 $2.5M Total Copied Volume        │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Copy Setup Flow

Multi-step wizard when copying a trader.

#### Step 1: Position Sizing

```
┌─────────────────────────────────────────────────────────────────┐
│  Copy DeFi Whale                                        [✕]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1 of 4: Position Sizing                                   │
│  ○────●────○────○                                               │
│                                                                  │
│  How should your trade sizes be calculated?                     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ○ Percentage of Leader                                     ││
│  │    Copy at a percentage of the leader's trade size          ││
│  │                                                             ││
│  │    When leader trades $1,000, you trade:                    ││
│  │    [    50    ] %  →  $500                                  ││
│  │                                                             ││
│  │    ├──────────●──────────┤                                  ││
│  │    10%      50%       100%                                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ● Fixed Amount (Selected)                                  ││
│  │    Trade a fixed USD amount regardless of leader's size     ││
│  │                                                             ││
│  │    Trade size per copy:                                     ││
│  │    $ [    100    ]                                          ││
│  │                                                             ││
│  │    💡 Leader averages $2,500 per trade                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ○ Proportional to Portfolio                                ││
│  │    Match leader's portfolio percentage                      ││
│  │                                                             ││
│  │    If leader uses 5% of their portfolio, you use 5%         ││
│  │    of your portfolio.                                       ││
│  │                                                             ││
│  │    Your portfolio: $10,000                                  ││
│  │    If leader trades 5% → You trade $500                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  [Cancel]                                       [Continue →]    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Step 2: Risk Limits

```
┌─────────────────────────────────────────────────────────────────┐
│  Copy DeFi Whale                                        [✕]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 2 of 4: Risk Limits                                       │
│  ●────●────○────○                                               │
│                                                                  │
│  Set limits to protect your portfolio.                          │
│                                                                  │
│  ┌─ Trade Size Limits ─────────────────────────────────────────┐│
│  │                                                             ││
│  │  Minimum trade to copy:                                     ││
│  │  $ [    10    ]                                             ││
│  │  Trades below this value will be skipped                    ││
│  │                                                             ││
│  │  Maximum trade to copy:                                     ││
│  │  $ [   500    ]                                             ││
│  │  Larger leader trades will be capped at this amount         ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Daily Limits ──────────────────────────────────────────────┐│
│  │                                                             ││
│  │  Maximum trades per day:                                    ││
│  │  [    10    ] trades                                        ││
│  │                                                             ││
│  │  Maximum daily volume:                                      ││
│  │  $ [  2,000   ]                                             ││
│  │                                                             ││
│  │  💡 Leader averages 3.5 trades/day                          ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Execution Settings ────────────────────────────────────────┐│
│  │                                                             ││
│  │  Maximum slippage:                                          ││
│  │  [   1.0    ] %  (100 bps)                                  ││
│  │                                                             ││
│  │  Copy delay:                                                ││
│  │  [   0 - 30   ] seconds (randomized)                        ││
│  │  Adding delay helps avoid detection by bots                 ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  [← Back]                                       [Continue →]    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Step 3: Token Filters

```
┌─────────────────────────────────────────────────────────────────┐
│  Copy DeFi Whale                                        [✕]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 3 of 4: Token Filters                                     │
│  ●────●────●────○                                               │
│                                                                  │
│  Which tokens should be copied?                                 │
│                                                                  │
│  ┌─ Token Filter Mode ─────────────────────────────────────────┐│
│  │                                                             ││
│  │  ● Copy all tokens                                          ││
│  │    Replicate all trades from this leader                    ││
│  │                                                             ││
│  │  ○ Whitelist only                                           ││
│  │    Only copy trades involving specific tokens               ││
│  │                                                             ││
│  │  ○ Blacklist                                                ││
│  │    Copy all tokens except specific ones                     ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Leader's Top Tokens ───────────────────────────────────────┐│
│  │                                                             ││
│  │  These are the tokens this leader trades most:              ││
│  │                                                             ││
│  │  ☑️ ETH   (45% of trades)                                   ││
│  │  ☑️ USDC  (28% of trades)                                   ││
│  │  ☑️ ARB   (15% of trades)                                   ││
│  │  ☑️ WBTC  (8% of trades)                                    ││
│  │  ☐ Other (4% of trades)                                     ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Actions to Copy ───────────────────────────────────────────┐│
│  │                                                             ││
│  │  ☑️ Swap       Exchange tokens                              ││
│  │  ☐ Bridge     Cross-chain transfers (higher risk)          ││
│  │  ☐ Stake      DeFi staking (may lock funds)                 ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  [← Back]                                       [Continue →]    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Step 4: Review & Confirm

```
┌─────────────────────────────────────────────────────────────────┐
│  Copy DeFi Whale                                        [✕]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 4 of 4: Review & Confirm                                  │
│  ●────●────●────●                                               │
│                                                                  │
│  You're about to start copying this trader:                     │
│                                                                  │
│  ┌─ Leader ────────────────────────────────────────────────────┐│
│  │  🐋 DeFi Whale  •  0x7a2f...8c3d  •  Ethereum               ││
│  │  Win Rate: 68.5%  •  Total P&L: +$125,000                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Your Settings ─────────────────────────────────────────────┐│
│  │                                                             ││
│  │  Sizing:          Fixed $100 per trade                      ││
│  │  Trade Range:     $10 - $500                                ││
│  │  Daily Limits:    10 trades / $2,000 volume                 ││
│  │  Max Slippage:    1.0%                                      ││
│  │  Copy Delay:      0-30 seconds                              ││
│  │  Tokens:          All tokens                                ││
│  │  Actions:         Swaps only                                ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Session Key Required ──────────────────────────────────────┐│
│  │                                                             ││
│  │  ⚠️ To execute trades automatically, you need to create     ││
│  │  a session key that authorizes the agent to trade.          ││
│  │                                                             ││
│  │  ○ Create new session key (recommended)                     ││
│  │    We'll set up a session key with appropriate limits       ││
│  │                                                             ││
│  │  ○ Use existing session key                                 ││
│  │    Select from your active session keys                     ││
│  │    [Select session key ▾]                                   ││
│  │                                                             ││
│  │  ○ Manual mode (no auto-execute)                            ││
│  │    You'll approve each trade manually                       ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ⓘ By starting copy trading, the agent will               │   │
│  │   automatically execute trades within your limits when   │   │
│  │   this leader makes a qualifying trade.                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [← Back]                               [Start Copying →]       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4. My Copies Dashboard

View and manage active copy relationships.

```
┌─────────────────────────────────────────────────────────────────┐
│  Copy Trading                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [My Copies (3)]    [Discover Leaders]    [Analytics]           │
│       ▲ selected                                                 │
│                                                                  │
│  ┌─ Summary ───────────────────────────────────────────────────┐│
│  │                                                             ││
│  │  Active Copies: 3    Total Volume: $12,450    P&L: +$890   ││
│  │  Success Rate: 94%   Today: 5 trades, $450                  ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  🟢 Active                                                  ││
│  │  ┌────────┐                                                 ││
│  │  │  🐋   │  DeFi Whale                       [Pause] [⚙️]  ││
│  │  └────────┘  0x7a2f...8c3d  •  Ethereum                     ││
│  │                                                             ││
│  │  Sizing: Fixed $100   |   Today: 2 trades, $195             ││
│  │                                                             ││
│  │  Total Copied         Success Rate      P&L                 ││
│  │  $5,230               96%               +$412               ││
│  │  ██████████░░░░░      ██████████████░   ███████░░░░         ││
│  │  52 trades            50 / 52           +7.9%               ││
│  │                                                             ││
│  │  Last copy: 2 hours ago                                     ││
│  │  USDC → ETH • $98.50 • +$4.20                               ││
│  │                                                             ││
│  │  [View History]                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  🟢 Active                                                  ││
│  │  ┌────────┐                                                 ││
│  │  │  🤖   │  Arbitrage Bot                    [Pause] [⚙️]  ││
│  │  └────────┘  0x3f1c...2e9a  •  Base                         ││
│  │                                                             ││
│  │  Sizing: 25% of leader   |   Today: 3 trades, $255          ││
│  │                                                             ││
│  │  Total Copied         Success Rate      P&L                 ││
│  │  $4,120               98%               +$380               ││
│  │                                                             ││
│  │  [View History]                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  🟡 Paused                                                  ││
│  │  ┌────────┐                                                 ││
│  │  │  🎨   │  NFT Flipper                     [Resume] [⚙️]  ││
│  │  └────────┘  0x9c4d...7b2e  •  Ethereum                     ││
│  │                                                             ││
│  │  ⚠️ Paused: Session key expired                             ││
│  │                                                             ││
│  │  [Renew Session Key]                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  [+ Copy New Trader]                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Relationship Detail & History

Detailed view of a single copy relationship.

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to My Copies                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ Header ────────────────────────────────────────────────────┐│
│  │                                                             ││
│  │  ┌────────┐  Copying: DeFi Whale                           ││
│  │  │  🐋   │  0x7a2f...8c3d  •  Ethereum                     ││
│  │  └────────┘  Status: 🟢 Active                              ││
│  │                                                             ││
│  │  [Pause]   [Edit Settings]   [Stop Copying]                 ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Performance ───────────────────────────────────────────────┐│
│  │                                                             ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       ││
│  │  │Copied Vol│ │Success % │ │  P&L     │ │ Trades   │       ││
│  │  │  $5,230  │ │   96%    │ │  +$412   │ │   52     │       ││
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Daily Usage ───────────────────────────────────────────────┐│
│  │                                                             ││
│  │  Trades today: 2 / 10                                       ││
│  │  ██░░░░░░░░                                                 ││
│  │                                                             ││
│  │  Volume today: $195 / $2,000                                ││
│  │  █░░░░░░░░░░░░░░░░░░░                                       ││
│  │                                                             ││
│  │  Resets in: 14 hours                                        ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Current Settings ──────────────────────────────────────────┐│
│  │                                                             ││
│  │  Sizing:        Fixed $100 per trade            [Edit]      ││
│  │  Trade Range:   $10 - $500                                  ││
│  │  Daily Limits:  10 trades / $2,000 volume                   ││
│  │  Max Slippage:  1.0%                                        ││
│  │  Tokens:        All tokens                                  ││
│  │  Actions:       Swaps only                                  ││
│  │  Session Key:   sess_7k2m...  (expires in 82 days)          ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Execution History ─────────────────────────────────────────┐│
│  │                                                             ││
│  │  Filter: [All ▾]   [Completed ▾]   [Last 7 days ▾]         ││
│  │                                                             ││
│  │  ┌───────────────────────────────────────────────────────┐  ││
│  │  │ ✓ Completed                              2 hours ago  │  ││
│  │  │                                                       │  ││
│  │  │ Leader: 1,500 USDC → 0.52 ETH ($1,500)               │  ││
│  │  │ You:    100 USDC → 0.0347 ETH ($98.50)               │  ││
│  │  │                                                       │  ││
│  │  │ P&L: +$4.20 (+4.3%)                                   │  ││
│  │  │ Slippage: 0.15%   Gas: $2.30                          │  ││
│  │  │ Tx: 0x7a2f...8c3d                           [View ↗]  │  ││
│  │  └───────────────────────────────────────────────────────┘  ││
│  │                                                             ││
│  │  ┌───────────────────────────────────────────────────────┐  ││
│  │  │ ⊘ Skipped                               5 hours ago   │  ││
│  │  │                                                       │  ││
│  │  │ Leader: 50 USDC → 0.017 ETH ($50)                     │  ││
│  │  │ Reason: Below minimum trade size ($10)                │  ││
│  │  └───────────────────────────────────────────────────────┘  ││
│  │                                                             ││
│  │  ┌───────────────────────────────────────────────────────┐  ││
│  │  │ ✓ Completed                              8 hours ago  │  ││
│  │  │                                                       │  ││
│  │  │ Leader: 2,000 ARB → 1,850 USDC ($1,850)               │  ││
│  │  │ You:    100 USDC value → 96.20 USDC received          │  ││
│  │  │                                                       │  ││
│  │  │ P&L: -$3.80 (-3.8%)                                   │  ││
│  │  │ Slippage: 0.42%   Gas: $1.85                          │  ││
│  │  └───────────────────────────────────────────────────────┘  ││
│  │                                                             ││
│  │  [Load More]                                                ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6. Stop Copying Confirmation

```
┌─────────────────────────────────────────────────────────────────┐
│  Stop Copying?                                          [✕]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⚠️ Are you sure you want to stop copying this trader?          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  🐋 DeFi Whale                                           │   │
│  │  0x7a2f...8c3d  •  Ethereum                              │   │
│  │                                                          │   │
│  │  Total Copied: $5,230                                    │   │
│  │  Total P&L: +$412 (+7.9%)                                │   │
│  │  Active Since: Dec 15, 2024                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  This will:                                                      │
│  • Stop all future copy trades from this leader                 │
│  • Keep your execution history for reference                    │
│  • NOT affect your current token positions                      │
│                                                                  │
│  You can restart copying this trader at any time.               │
│                                                                  │
│  [Cancel]                              [Stop Copying]           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7. Analytics Dashboard

Aggregate view of copy trading performance.

```
┌─────────────────────────────────────────────────────────────────┐
│  Copy Trading                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [My Copies (3)]    [Discover Leaders]    [Analytics]           │
│                                                ▲ selected        │
│                                                                  │
│  ┌─ Overall Performance ───────────────────────────────────────┐│
│  │                                                             ││
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ ││
│  │  │Total Volume│ │  Total P&L │ │Success Rate│ │ Leaders  │ ││
│  │  │  $12,450   │ │   +$890    │ │    94%     │ │    3     │ ││
│  │  │   ↑ 23%    │ │  ↑ $120    │ │   ↑ 2%     │ │          │ ││
│  │  │  vs 7d ago │ │ vs 7d ago  │ │ vs 7d ago  │ │          │ ││
│  │  └────────────┘ └────────────┘ └────────────┘ └──────────┘ ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ P&L Over Time ─────────────────────────────────────────────┐│
│  │                                                             ││
│  │  [7D]  [30D]  [90D]  [ALL]                                  ││
│  │                                                             ││
│  │  +$1000 ┤                                   ╭────           ││
│  │         │                           ╭───────╯               ││
│  │   +$500 ┤               ╭───────────╯                       ││
│  │         │       ╭───────╯                                   ││
│  │      $0 ┼───────╯                                           ││
│  │         │                                                   ││
│  │   -$500 ┤                                                   ││
│  │         Mon     Tue     Wed     Thu     Fri     Sat     Sun ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Performance by Leader ─────────────────────────────────────┐│
│  │                                                             ││
│  │  Leader           Copied     P&L        Success   Trades    ││
│  │  ─────────────────────────────────────────────────────────  ││
│  │  🐋 DeFi Whale    $5,230    +$412      96%       52        ││
│  │  🤖 Arb Bot       $4,120    +$380      98%       38        ││
│  │  🎨 NFT Flipper   $3,100    +$98       88%       25        ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Trade Distribution ────────────────────────────────────────┐│
│  │                                                             ││
│  │  By Outcome                    By Token                     ││
│  │  ┌───────────────────┐        ┌───────────────────┐        ││
│  │  │ ✓ Completed  108  │        │ ETH      45%     │        ││
│  │  │ ⊘ Skipped     12  │        │ USDC     30%     │        ││
│  │  │ ✗ Failed       3  │        │ ARB      15%     │        ││
│  │  └───────────────────┘        │ Other    10%     │        ││
│  │                               └───────────────────┘        ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Recent Activity ───────────────────────────────────────────┐│
│  │                                                             ││
│  │  2h ago   🐋 DeFi Whale   USDC→ETH   $98.50    +$4.20  ✓  ││
│  │  4h ago   🤖 Arb Bot      ETH→USDC   $85.00    +$2.10  ✓  ││
│  │  5h ago   🐋 DeFi Whale   USDC→ETH   $50.00    skipped ⊘  ││
│  │  6h ago   🤖 Arb Bot      USDC→ETH   $92.30    +$3.40  ✓  ││
│  │                                                             ││
│  │  [View All Activity]                                        ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Real-Time Updates

### Convex Subscriptions

```typescript
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

// Subscribe to relationship updates
function useCopyRelationships(userId: string) {
  return useQuery(api.copyTrading.listByUser, { userId });
}

// Subscribe to execution updates for a relationship
function useCopyExecutions(relationshipId: string) {
  return useQuery(api.copyTrading.listExecutions, {
    relationshipId,
    limit: 50,
  });
}

// Subscribe to leaderboard updates
function useLeaderboard(chain?: string) {
  return useQuery(api.copyTrading.getLeaderboard, {
    chain,
    sortBy: "totalPnlUsd",
    minTrades: 10,
    limit: 50,
  });
}

// Example component
function CopyDashboard({ userId }: { userId: string }) {
  const relationships = useCopyRelationships(userId);

  if (!relationships) return <Loading />;

  return (
    <div>
      {relationships.map((rel) => (
        <CopyRelationshipCard key={rel.id} relationship={rel} />
      ))}
    </div>
  );
}
```

### WebSocket Events (Optional)

For real-time trade notifications:

```typescript
// Listen for new executions
socket.on("copy:execution", (data: CopyExecution) => {
  // Show toast notification
  toast({
    title: `Copied trade from ${data.signal.leaderAddress}`,
    description: `${data.signal.tokenInSymbol} → ${data.signal.tokenOutSymbol}`,
    status: data.status === "completed" ? "success" : "error",
  });
});

// Listen for relationship status changes
socket.on("copy:status", (data: { relationshipId: string; status: string }) => {
  // Update UI state
  queryClient.invalidateQueries(["copy-relationship", data.relationshipId]);
});
```

---

## Implementation Notes

### Generating IDs

```typescript
function generateRelationshipId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `rel_${hex}`;
}

function generateExecutionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `exec_${hex}`;
}
```

### Sizing Calculation Examples

```typescript
function calculateCopySize(
  config: CopyConfig,
  leaderTradeUsd: number,
  followerPortfolioUsd?: number,
  leaderPortfolioUsd?: number
): number {
  let size: number;

  switch (config.sizingMode) {
    case "percentage":
      // e.g., 50% of leader's $1000 trade = $500
      size = leaderTradeUsd * (parseFloat(config.sizeValue) / 100);
      break;

    case "fixed":
      // e.g., always $100
      size = parseFloat(config.sizeValue);
      break;

    case "proportional":
      // Match leader's portfolio percentage
      if (!followerPortfolioUsd || !leaderPortfolioUsd) {
        throw new Error("Portfolio values required for proportional sizing");
      }
      const leaderPercent = leaderTradeUsd / leaderPortfolioUsd;
      size = followerPortfolioUsd * leaderPercent;
      break;

    default:
      throw new Error(`Unknown sizing mode: ${config.sizingMode}`);
  }

  // Apply min/max limits
  const minTrade = parseFloat(config.minTradeUsd);
  const maxTrade = config.maxTradeUsd ? parseFloat(config.maxTradeUsd) : Infinity;

  if (size < minTrade) return 0; // Skip trade
  return Math.min(size, maxTrade);
}
```

### Skip Reasons

```typescript
const SKIP_REASONS = {
  BELOW_MIN_TRADE: "Trade value below minimum",
  ABOVE_MAX_TRADE: "Trade value above maximum (capped)",
  DAILY_TRADE_LIMIT: "Daily trade limit reached",
  DAILY_VOLUME_LIMIT: "Daily volume limit reached",
  TOKEN_BLACKLISTED: "Token is blacklisted",
  TOKEN_NOT_WHITELISTED: "Token not in whitelist",
  ACTION_NOT_ALLOWED: "Action type not allowed",
  SESSION_KEY_EXPIRED: "Session key expired",
  INSUFFICIENT_BALANCE: "Insufficient balance for trade",
  HIGH_SLIPPAGE: "Slippage exceeds maximum",
  PAUSED: "Copy trading is paused",
};
```

### Status Color Mapping

```typescript
const STATUS_COLORS = {
  completed: "green",
  pending: "yellow",
  executing: "blue",
  failed: "red",
  skipped: "gray",
};

const RELATIONSHIP_STATUS = {
  active: { color: "green", icon: "🟢", label: "Active" },
  paused: { color: "yellow", icon: "🟡", label: "Paused" },
  inactive: { color: "gray", icon: "⚪", label: "Inactive" },
  error: { color: "red", icon: "🔴", label: "Error" },
};
```

---

## Error Handling

### Common Errors

| Error | User Message | Action |
|-------|--------------|--------|
| Session key expired | "Your session key has expired" | Show "Renew Session Key" button |
| Insufficient balance | "Insufficient balance for trade" | Show balance warning |
| Slippage too high | "Trade skipped: slippage exceeded limit" | Log in history as skipped |
| Leader inactive | "Leader hasn't traded in 30 days" | Show warning badge |
| Daily limit reached | "Daily limit reached, resuming tomorrow" | Show reset countdown |

### Error States

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Session Key Issue                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Your session key for copying DeFi Whale has expired.           │
│  Copy trading is paused until you renew it.                     │
│                                                                  │
│  [Renew Session Key]    [Dismiss]                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Daily Limit Reached                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  You've reached your daily copy limit for DeFi Whale.           │
│                                                                  │
│  Trades: 10 / 10                                                │
│  Volume: $1,850 / $2,000                                        │
│                                                                  │
│  Resets in: 8 hours 23 minutes                                  │
│                                                                  │
│  [Increase Limits]    [Dismiss]                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mobile Responsiveness

### Compact Leader Card

```
┌─────────────────────────────────────┐
│  🐋 DeFi Whale        [Copy]       │
│  0x7a2f...8c3d • Ethereum          │
│                                     │
│  Win: 68.5%  P&L: +$125K  45 👥    │
│  ████████░░  ██████████  Copiers   │
└─────────────────────────────────────┘
```

### Compact Execution Row

```
┌─────────────────────────────────────┐
│  ✓  2h ago  USDC→ETH  $98.50       │
│     +$4.20 (+4.3%)                  │
└─────────────────────────────────────┘
```

---

## Testing Checklist

- [ ] Create new copy relationship
- [ ] Edit copy configuration
- [ ] Pause and resume copying
- [ ] Stop copying entirely
- [ ] View execution history
- [ ] Filter executions by status
- [ ] View leader profiles
- [ ] Browse leaderboard with filters
- [ ] Session key creation flow
- [ ] Session key renewal
- [ ] Daily limit warnings
- [ ] Error state handling
- [ ] Real-time updates via Convex
- [ ] Mobile responsive layouts

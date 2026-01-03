# Backend Production Roadmap

## MVP → Production-Grade Analysis

**Goal:** Create a framework for agents to execute web3/onchain portfolio management workflows autonomously

**Date:** 2025-12-25

---

## Current State Summary

The backend has solid foundations:
- Well-structured FastAPI application with modular architecture
- LangGraph-based agent orchestration
- Multi-chain support (EVM + Solana)
- Pluggable provider pattern for LLM, indexers, pricing
- Good separation of concerns (core, services, tools, providers)

### Existing Architecture

```
sherpa/
├── app/
│   ├── api/              # API endpoints
│   ├── core/             # Core business logic
│   │   ├── agent/        # AI agent system (main orchestrator)
│   │   ├── bridge/       # Cross-chain bridge handling
│   │   ├── chat.py       # Chat/LLM integration
│   │   ├── perps/        # Perpetuals derivatives trading
│   │   ├── planning/     # Plan/strategy management
│   │   └── swap/         # Token swap execution
│   ├── providers/        # External API integrations
│   │   └── llm/          # LLM provider abstractions
│   ├── services/         # Business services
│   ├── tools/            # Tool implementations
│   ├── types/            # Data models/schemas
│   ├── agent_runtime/    # Background strategy execution
│   ├── telemetry/        # Activity tracking
│   └── workers/          # Background jobs
├── activities/           # YAML activity definitions
├── personas/             # YAML persona configurations
├── tests/                # Test suite
├── config.py             # Configuration management
├── main.py               # FastAPI app setup
└── cli.py                # CLI tools
```

### Current Technology Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Framework** | FastAPI 0.104+ | REST API framework |
| **Async Runtime** | asyncio | Async/await patterns |
| **LLM Integration** | LangGraph 0.6+ | Agent orchestration pipeline |
| **Data Validation** | Pydantic v2 | Request/response schemas |
| **Configuration** | pydantic-settings | Environment variable management |
| **Blockchain - EVM** | Alchemy API | Ethereum/L2 balances, transfers |
| **Blockchain - Solana** | Helius API | Solana token balances |
| **Pricing** | CoinGecko API | Token price data |
| **Bridges** | Relay API | Cross-chain bridging quotes |
| **Cache** | In-memory TTL Cache | Response caching |
| **Storage** | Redis (optional) | Conversation summaries |
| **File Export** | AWS S3 (optional) | History export artifacts |

---

## 🔴 Critical (Must Fix Before Production)

### 1. Persistent Database Layer

**Current Problem:** Everything is in-memory (`Dict[str, ConversationContext]`), lost on restart.

**What to Add:**
- User/wallet registration & preferences
- Strategy definitions & execution history
- Transaction logs with blockchain tx hashes
- Agent decision audit trail
- Position tracking over time

**Recommended Stack:** Convex (https://convex.dev)

**Why Convex:**
- Real-time subscriptions out of the box (perfect for live portfolio updates)
- Serverless functions with automatic scaling
- ACID transactions with strong consistency
- TypeScript-first with excellent type safety
- Built-in scheduling for cron jobs (strategy execution)
- No infrastructure to manage

**Integration Architecture:**

```
┌─────────────────┐     HTTP Actions      ┌─────────────────┐
│  FastAPI        │ ◄──────────────────►  │  Convex         │
│  (Python)       │                       │  (TypeScript)   │
│                 │                       │                 │
│  - Agent Logic  │     Real-time Sub     │  - Data Storage │
│  - LLM Calls    │ ◄──────────────────►  │  - Mutations    │
│  - Web3 Txns    │                       │  - Queries      │
└─────────────────┘                       │  - Scheduling   │
                                          └─────────────────┘
```

**Convex Schema (convex/schema.ts):**

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users & Wallets
  users: defineTable({
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  wallets: defineTable({
    userId: v.id("users"),
    address: v.string(),
    chain: v.string(),
    label: v.optional(v.string()),
    isPrimary: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_address_chain", ["address", "chain"]),

  // Conversations
  conversations: defineTable({
    walletId: v.id("wallets"),
    title: v.optional(v.string()),
    archived: v.boolean(),
    totalTokens: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_wallet", ["walletId"])
    .index("by_wallet_archived", ["walletId", "archived"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    tokenCount: v.optional(v.number()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId"]),

  // Strategies & Execution
  strategies: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    config: v.any(), // Strategy configuration object
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),

  strategyExecutions: defineTable({
    strategyId: v.id("strategies"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_strategy", ["strategyId"])
    .index("by_status", ["status"]),

  // Transactions
  transactions: defineTable({
    executionId: v.optional(v.id("strategyExecutions")),
    walletId: v.id("wallets"),
    txHash: v.optional(v.string()),
    chain: v.string(),
    type: v.union(
      v.literal("swap"),
      v.literal("bridge"),
      v.literal("transfer"),
      v.literal("approve")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("submitted"),
      v.literal("confirmed"),
      v.literal("failed"),
      v.literal("reverted")
    ),
    inputData: v.any(),
    outputData: v.optional(v.any()),
    gasUsed: v.optional(v.number()),
    gasPrice: v.optional(v.number()),
    createdAt: v.number(),
    confirmedAt: v.optional(v.number()),
  })
    .index("by_wallet", ["walletId"])
    .index("by_execution", ["executionId"])
    .index("by_tx_hash", ["txHash"])
    .index("by_status", ["status"]),

  // Audit Trail
  agentDecisions: defineTable({
    executionId: v.id("strategyExecutions"),
    decisionType: v.string(),
    inputContext: v.any(),
    reasoning: v.string(),
    actionTaken: v.any(),
    riskAssessment: v.any(),
    createdAt: v.number(),
  }).index("by_execution", ["executionId"]),

  // Rate Limiting & Sessions
  sessions: defineTable({
    walletAddress: v.string(),
    chainId: v.number(),
    nonce: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_wallet", ["walletAddress"])
    .index("by_expiry", ["expiresAt"]),

  rateLimits: defineTable({
    key: v.string(), // e.g., "chat:0x123..." or "global:alchemy"
    count: v.number(),
    windowStart: v.number(),
    windowSeconds: v.number(),
  }).index("by_key", ["key"]),
});
```

**Convex Functions (convex/strategies.ts):**

```typescript
import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";

// Query: Get user's strategies
export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("strategies")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Mutation: Create a new strategy
export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    config: v.any(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("strategies", {
      ...args,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Mutation: Update strategy status
export const updateStatus = mutation({
  args: {
    strategyId: v.id("strategies"),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.strategyId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

// Action: Called by FastAPI to trigger strategy execution
export const triggerExecution = action({
  args: { strategyId: v.id("strategies") },
  handler: async (ctx, args) => {
    // Create execution record
    const executionId = await ctx.runMutation(internal.executions.create, {
      strategyId: args.strategyId,
    });

    // Call FastAPI to run the actual strategy
    const response = await fetch(`${process.env.FASTAPI_URL}/internal/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": process.env.INTERNAL_API_KEY!,
      },
      body: JSON.stringify({
        executionId,
        strategyId: args.strategyId,
      }),
    });

    return { executionId, triggered: response.ok };
  },
});
```

**Python Client Integration (app/db/convex_client.py):**

```python
import httpx
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

class ConvexClient:
    """Client for interacting with Convex from Python."""

    def __init__(self, deployment_url: str, deploy_key: str):
        self.base_url = deployment_url
        self.headers = {
            "Authorization": f"Convex {deploy_key}",
            "Content-Type": "application/json",
        }
        self.client = httpx.AsyncClient()

    async def query(self, function_name: str, args: Dict[str, Any] = None) -> Any:
        """Run a Convex query function."""
        response = await self.client.post(
            f"{self.base_url}/api/query",
            headers=self.headers,
            json={"path": function_name, "args": args or {}},
        )
        response.raise_for_status()
        return response.json()["value"]

    async def mutation(self, function_name: str, args: Dict[str, Any] = None) -> Any:
        """Run a Convex mutation function."""
        response = await self.client.post(
            f"{self.base_url}/api/mutation",
            headers=self.headers,
            json={"path": function_name, "args": args or {}},
        )
        response.raise_for_status()
        return response.json()["value"]

    async def action(self, function_name: str, args: Dict[str, Any] = None) -> Any:
        """Run a Convex action function."""
        response = await self.client.post(
            f"{self.base_url}/api/action",
            headers=self.headers,
            json={"path": function_name, "args": args or {}},
        )
        response.raise_for_status()
        return response.json()["value"]


# Usage in FastAPI
from app.db.convex_client import ConvexClient

convex = ConvexClient(
    deployment_url=settings.convex_url,
    deploy_key=settings.convex_deploy_key,
)

# Example: Create a strategy
async def create_strategy(user_id: str, name: str, config: dict):
    return await convex.mutation("strategies:create", {
        "userId": user_id,
        "name": name,
        "config": config,
    })

# Example: Get user's conversations with real-time updates
async def get_conversations(wallet_id: str):
    return await convex.query("conversations:listByWallet", {
        "walletId": wallet_id,
    })
```

**Convex Scheduled Jobs (for autonomous execution):**

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Check for strategies that need execution every minute
crons.interval(
  "check-strategy-triggers",
  { minutes: 1 },
  internal.scheduler.checkTriggers
);

// Clean up expired sessions every hour
crons.interval(
  "cleanup-sessions",
  { hours: 1 },
  internal.sessions.cleanupExpired
);

// Aggregate daily metrics
crons.daily(
  "daily-metrics",
  { hourUTC: 0, minuteUTC: 0 },
  internal.metrics.aggregateDaily
);

export default crons;
```

**Environment Variables to Add:**

```bash
# .env
CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOY_KEY=prod:your-deploy-key
```

---

### 2. Transaction Execution Layer

**Current Problem:** Implementation stops at quoting (relay/quote, swap/quote). No actual execution.

**What to Add:**

```python
# New module: app/core/execution/

class TransactionExecutor:
    async def execute_bridge(
        self,
        quote: BridgeQuote,
        wallet: WalletContext
    ) -> TransactionResult:
        """Execute a cross-chain bridge transaction."""
        pass

    async def execute_swap(
        self,
        quote: SwapQuote,
        wallet: WalletContext
    ) -> TransactionResult:
        """Execute a token swap."""
        pass

    async def monitor_transaction(
        self,
        tx_hash: str,
        chain: str,
        timeout_seconds: int = 300
    ) -> TransactionStatus:
        """Monitor transaction until confirmation or timeout."""
        pass

    async def estimate_gas(
        self,
        transaction: PreparedTransaction
    ) -> GasEstimate:
        """Estimate gas for a transaction."""
        pass


class NonceManager:
    """Manage nonces for concurrent transactions."""

    async def get_next_nonce(self, address: str, chain: str) -> int:
        pass

    async def release_nonce(self, address: str, chain: str, nonce: int):
        pass


class TransactionBuilder:
    """Build transactions for various protocols."""

    async def build_erc20_approve(
        self,
        token: str,
        spender: str,
        amount: int
    ) -> PreparedTransaction:
        pass

    async def build_swap(
        self,
        quote: SwapQuote
    ) -> PreparedTransaction:
        pass
```

---

### 3. Agent Wallet Management

**Current Problem:** No wallet access control for autonomous execution.

**Architecture Options:**

| Approach | Pros | Cons | Recommended For |
|----------|------|------|-----------------|
| **Custodial** | Simple, full control | Trust issues, liability | Internal/demo only |
| **MPC/TSS** | Secure, no single point of failure | Complex, expensive | Enterprise |
| **Smart Contract Wallets** | On-chain rules, recoverable | Gas overhead, complexity | High-value accounts |
| **Session Keys (EIP-4337)** | Limited permissions, time-bound | Newer standard, less tooling | **Recommended** |

**Session Keys Implementation:**

```python
class SessionKeyManager:
    """Manage time-limited, permission-scoped session keys."""

    async def create_session(
        self,
        wallet_address: str,
        permissions: List[Permission],
        expires_at: datetime,
        max_value_per_tx: Decimal,
        allowed_contracts: List[str]
    ) -> SessionKey:
        pass

    async def validate_action(
        self,
        session_key: SessionKey,
        action: Action
    ) -> ValidationResult:
        pass

    async def revoke_session(self, session_id: str):
        pass


class Permission(Enum):
    SWAP = "swap"
    BRIDGE = "bridge"
    TRANSFER = "transfer"
    APPROVE = "approve"
    STAKE = "stake"
    UNSTAKE = "unstake"
```

---

### 4. Rate Limiting & Request Throttling

**Current Problem:** No protection against abuse.

**Implementation:**

```python
# New module: app/middleware/rate_limit.py

from redis import Redis
from fastapi import Request, HTTPException

class RateLimiter:
    def __init__(self, redis: Redis):
        self.redis = redis

    async def check_limit(
        self,
        key: str,
        limit: int,
        window_seconds: int
    ) -> bool:
        """Sliding window rate limiter."""
        pass


# Limits to implement:
RATE_LIMITS = {
    "chat": {"limit": 30, "window": 60},          # 30 req/min
    "strategy_execute": {"limit": 10, "window": 3600},  # 10/hour
    "transaction": {"limit": 100, "window": 86400},     # 100/day
    "portfolio": {"limit": 60, "window": 60},     # 60 req/min
}

# Global limits:
PROVIDER_BUDGETS = {
    "alchemy": {"daily_calls": 100000},
    "coingecko": {"daily_calls": 10000},
    "anthropic": {"daily_tokens": 1000000},
}
```

---

### 5. Authentication & Authorization

**Current Problem:** Anyone can call any endpoint with any address.

**Implementation (SIWE - Sign In With Ethereum):**

```python
# New module: app/auth/

from siwe import SiweMessage

class AuthService:
    async def generate_nonce(self) -> str:
        """Generate a random nonce for SIWE."""
        pass

    async def verify_signature(
        self,
        message: str,
        signature: str
    ) -> VerifiedWallet:
        """Verify SIWE signature and return wallet info."""
        siwe_message = SiweMessage.from_message(message)
        siwe_message.verify(signature)
        return VerifiedWallet(
            address=siwe_message.address,
            chain_id=siwe_message.chain_id
        )

    async def create_session(
        self,
        wallet: VerifiedWallet
    ) -> AuthSession:
        """Create JWT session for authenticated wallet."""
        pass

    async def refresh_session(self, refresh_token: str) -> AuthSession:
        pass


# API Key management for programmatic access
class APIKeyService:
    async def create_key(
        self,
        user_id: UUID,
        name: str,
        scopes: List[str],
        expires_at: Optional[datetime]
    ) -> APIKey:
        pass

    async def validate_key(self, key: str) -> APIKeyContext:
        pass

    async def revoke_key(self, key_id: UUID):
        pass


# Permission scopes
class Scope(Enum):
    READ_PORTFOLIO = "read:portfolio"
    READ_HISTORY = "read:history"
    EXECUTE_STRATEGY = "execute:strategy"
    MANAGE_STRATEGIES = "manage:strategies"
    ADMIN = "admin"
```

---

## 🟠 High Priority (Production Stability)

### 6. Error Recovery & Retry Logic

```python
# New module: app/core/execution/recovery.py

class ExecutionContext:
    max_retries: int = 3
    retry_delay_seconds: float = 5.0
    fallback_strategies: List[Strategy]

    async def execute_with_recovery(self, action: Action) -> Result:
        for attempt in range(self.max_retries):
            try:
                return await self.execute(action)
            except RecoverableError as e:
                await self.handle_retry(attempt, e)
            except UnrecoverableError as e:
                await self.escalate_to_human(e)

        # All retries exhausted
        await self.try_fallback_strategies()


class RecoverableError(Exception):
    """Errors that can be retried (network issues, rate limits)."""
    pass


class UnrecoverableError(Exception):
    """Errors that require human intervention (insufficient funds, reverts)."""
    pass
```

---

### 7. Observability Stack

**Components to Add:**

```yaml
# docker-compose.observability.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    depends_on:
      - prometheus

  loki:
    image: grafana/loki

  tempo:
    image: grafana/tempo
```

**Metrics to Track:**

```python
# app/telemetry/metrics.py
from prometheus_client import Counter, Histogram, Gauge

# Agent metrics
agent_executions = Counter(
    'agent_executions_total',
    'Total agent executions',
    ['strategy_type', 'status']
)

agent_execution_duration = Histogram(
    'agent_execution_duration_seconds',
    'Agent execution duration',
    ['strategy_type']
)

# Transaction metrics
transactions_total = Counter(
    'transactions_total',
    'Total transactions',
    ['chain', 'type', 'status']
)

transaction_value_usd = Histogram(
    'transaction_value_usd',
    'Transaction value in USD',
    ['chain', 'type']
)

# Provider metrics
provider_requests = Counter(
    'provider_requests_total',
    'Provider API requests',
    ['provider', 'endpoint', 'status']
)

provider_latency = Histogram(
    'provider_latency_seconds',
    'Provider request latency',
    ['provider', 'endpoint']
)

# LLM metrics
llm_tokens_used = Counter(
    'llm_tokens_total',
    'LLM tokens used',
    ['provider', 'model', 'type']  # type: input/output
)

llm_request_duration = Histogram(
    'llm_request_duration_seconds',
    'LLM request duration',
    ['provider', 'model']
)
```

---

### 8. Strategy State Machine

```python
# New module: app/core/strategy/state_machine.py

from enum import Enum
from typing import Callable, Dict, List

class StrategyState(Enum):
    IDLE = "idle"
    ANALYZING = "analyzing"
    PLANNING = "planning"
    AWAITING_APPROVAL = "awaiting_approval"
    EXECUTING = "executing"
    MONITORING = "monitoring"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


class StrategyStateMachine:
    TRANSITIONS: Dict[StrategyState, List[StrategyState]] = {
        StrategyState.IDLE: [StrategyState.ANALYZING],
        StrategyState.ANALYZING: [StrategyState.PLANNING, StrategyState.FAILED],
        StrategyState.PLANNING: [StrategyState.AWAITING_APPROVAL, StrategyState.EXECUTING],
        StrategyState.AWAITING_APPROVAL: [StrategyState.EXECUTING, StrategyState.PAUSED],
        StrategyState.EXECUTING: [StrategyState.MONITORING, StrategyState.FAILED],
        StrategyState.MONITORING: [StrategyState.COMPLETED, StrategyState.FAILED],
        StrategyState.PAUSED: [StrategyState.ANALYZING, StrategyState.IDLE],
        StrategyState.FAILED: [StrategyState.IDLE],
        StrategyState.COMPLETED: [StrategyState.IDLE],
    }

    def __init__(self, strategy_id: str, initial_state: StrategyState = StrategyState.IDLE):
        self.strategy_id = strategy_id
        self.current_state = initial_state
        self.state_history: List[StateTransition] = []

    async def transition_to(self, new_state: StrategyState, context: Dict = None):
        if new_state not in self.TRANSITIONS[self.current_state]:
            raise InvalidTransitionError(
                f"Cannot transition from {self.current_state} to {new_state}"
            )

        transition = StateTransition(
            from_state=self.current_state,
            to_state=new_state,
            context=context,
            timestamp=datetime.utcnow()
        )

        self.state_history.append(transition)
        self.current_state = new_state

        await self.persist_state()
        await self.emit_state_change_event(transition)
```

---

### 9. Risk Management Engine

```python
# New module: app/core/risk/

class RiskEngine:
    def __init__(self, config: RiskConfig):
        self.config = config
        self.checks = [
            PositionLimitCheck(),
            DailyLossLimitCheck(),
            ConcentrationRiskCheck(),
            SlippageToleranceCheck(),
            GasCostCheck(),
            ContractRiskCheck(),
        ]

    async def evaluate(
        self,
        action: Action,
        context: ExecutionContext
    ) -> RiskAssessment:
        results = await asyncio.gather(*[
            check.evaluate(action, context)
            for check in self.checks
        ])

        return RiskAssessment(
            approved=all(r.passed for r in results),
            risk_score=self.calculate_risk_score(results),
            warnings=[r.warning for r in results if r.warning],
            blocked_by=[r for r in results if not r.passed],
            requires_approval=any(r.requires_human_approval for r in results)
        )

    def calculate_risk_score(self, results: List[CheckResult]) -> float:
        """0.0 (safe) to 1.0 (high risk)"""
        weights = {
            "position_limit": 0.2,
            "daily_loss": 0.25,
            "concentration": 0.15,
            "slippage": 0.15,
            "gas_cost": 0.1,
            "contract_risk": 0.15,
        }
        return sum(
            r.risk_contribution * weights.get(r.check_name, 0.1)
            for r in results
        )


class RiskConfig:
    max_position_size_usd: Decimal = Decimal("10000")
    max_daily_loss_usd: Decimal = Decimal("500")
    max_concentration_pct: float = 0.25  # Max 25% in single asset
    max_slippage_pct: float = 0.02  # 2% slippage tolerance
    max_gas_cost_pct: float = 0.05  # Max 5% of tx value for gas
    blocked_contracts: List[str] = []
    require_approval_above_usd: Decimal = Decimal("1000")
```

---

### 10. Event-Driven Architecture

```python
# New module: app/events/

from enum import Enum
from typing import Callable, Dict, List
import redis.asyncio as redis

class EventType(Enum):
    PORTFOLIO_UPDATED = "portfolio.updated"
    PRICE_ALERT_TRIGGERED = "price.alert.triggered"
    STRATEGY_TRIGGERED = "strategy.triggered"
    STRATEGY_STATE_CHANGED = "strategy.state.changed"
    TRANSACTION_SUBMITTED = "transaction.submitted"
    TRANSACTION_CONFIRMED = "transaction.confirmed"
    TRANSACTION_FAILED = "transaction.failed"
    RISK_LIMIT_BREACHED = "risk.limit.breached"
    SESSION_EXPIRED = "session.expired"


class EventBus:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.handlers: Dict[EventType, List[Callable]] = {}

    async def publish(self, event: Event):
        """Publish event to Redis stream."""
        await self.redis.xadd(
            f"events:{event.type.value}",
            {
                "payload": event.json(),
                "timestamp": event.timestamp.isoformat()
            }
        )

    def subscribe(self, event_type: EventType, handler: Callable):
        """Register handler for event type."""
        if event_type not in self.handlers:
            self.handlers[event_type] = []
        self.handlers[event_type].append(handler)

    async def start_consumer(self):
        """Start consuming events from Redis streams."""
        while True:
            for event_type in self.handlers.keys():
                events = await self.redis.xread(
                    {f"events:{event_type.value}": "$"},
                    block=1000
                )
                for event in events:
                    await self.dispatch(event_type, event)


# Example handlers
class StrategyExecutor:
    @event_handler(EventType.STRATEGY_TRIGGERED)
    async def handle_trigger(self, event: StrategyTriggeredEvent):
        strategy = await self.load_strategy(event.strategy_id)
        await self.execute(strategy)


class NotificationService:
    @event_handler(EventType.TRANSACTION_CONFIRMED)
    async def handle_confirmation(self, event: TransactionConfirmedEvent):
        await self.send_notification(
            user_id=event.user_id,
            message=f"Transaction confirmed: {event.tx_hash}"
        )
```

---

## 🟡 Medium Priority (Scale & Reliability)

### 11. Multi-Tenancy & Isolation

```python
# app/core/tenancy.py

class Tenant:
    id: UUID
    name: str
    wallets: List[Wallet]
    strategies: List[Strategy]
    resource_limits: ResourceLimits
    created_at: datetime


class ResourceLimits:
    max_strategies: int = 10
    max_executions_per_day: int = 100
    max_api_calls_per_minute: int = 60
    max_llm_tokens_per_day: int = 100000
    max_transaction_value_per_day_usd: Decimal = Decimal("10000")


class TenantContext:
    """Thread-local tenant context for request isolation."""

    @classmethod
    def get_current(cls) -> Tenant:
        pass

    @classmethod
    def set_current(cls, tenant: Tenant):
        pass
```

---

### 12. Horizontal Scaling Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Load Balancer                            │
│                    (nginx / AWS ALB / Cloudflare)               │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  API Server   │     │  API Server   │     │  API Server   │
│  (Stateless)  │     │  (Stateless)  │     │  (Stateless)  │
└───────────────┘     └───────────────┘     └───────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ Agent Worker  │     │ Agent Worker  │     │ Agent Worker  │
│   (Python)    │     │   (Python)    │     │   (Python)    │
└───────────────┘     └───────────────┘     └───────────────┘
                                │
                                ▼
                    ┌───────────────────┐
                    │      Convex       │
                    │  (Auto-scaling)   │
                    │  - Database       │
                    │  - Functions      │
                    │  - Cron Jobs      │
                    └───────────────────┘
```

**Note:** Convex handles its own scaling automatically. You only need to scale your FastAPI servers and agent workers horizontally. No need for separate Redis/PostgreSQL infrastructure.

---

### 13. Circuit Breakers

```python
# app/core/resilience/circuit_breaker.py

from enum import Enum

class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing recovery


class CircuitBreaker:
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        success_threshold: int = 3,
        timeout_seconds: int = 60
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.success_threshold = success_threshold
        self.timeout_seconds = timeout_seconds
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None

    async def call(self, func: Callable, *args, **kwargs):
        if self.state == CircuitState.OPEN:
            if self.should_attempt_reset():
                self.state = CircuitState.HALF_OPEN
            else:
                raise CircuitOpenError(f"Circuit {self.name} is open")

        try:
            result = await func(*args, **kwargs)
            self.record_success()
            return result
        except Exception as e:
            self.record_failure()
            raise

    def record_success(self):
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                self.state = CircuitState.CLOSED
                self.reset_counts()
        else:
            self.failure_count = 0

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = datetime.utcnow()

        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN


# Usage
alchemy_circuit = CircuitBreaker("alchemy", failure_threshold=5)

async def get_balance(address: str):
    return await alchemy_circuit.call(alchemy_provider.get_balance, address)
```

---

### 14. Scheduled Strategy Execution

```python
# app/scheduler/

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

class StrategyScheduler:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()

    async def schedule_strategy(
        self,
        strategy: Strategy,
        cron_expression: str,  # e.g., "0 */4 * * *" (every 4 hours)
        conditions: List[Condition] = None
    ):
        self.scheduler.add_job(
            self.execute_strategy,
            CronTrigger.from_crontab(cron_expression),
            args=[strategy.id],
            id=f"strategy-{strategy.id}",
            replace_existing=True
        )

    async def execute_strategy(self, strategy_id: str):
        strategy = await self.load_strategy(strategy_id)

        # Check conditions before executing
        if strategy.conditions:
            conditions_met = await self.evaluate_conditions(strategy.conditions)
            if not conditions_met:
                return  # Skip this execution

        await self.strategy_executor.execute(strategy)

    def start(self):
        self.scheduler.start()

    def stop(self):
        self.scheduler.shutdown()
```

---

### 15. Webhook & Notification System

```python
# app/notifications/

class NotificationService:
    def __init__(self):
        self.channels = {
            "discord": DiscordNotifier(),
            "telegram": TelegramNotifier(),
            "email": EmailNotifier(),
            "webhook": WebhookNotifier(),
        }

    async def send(
        self,
        user_id: UUID,
        notification: Notification
    ):
        preferences = await self.get_user_preferences(user_id)

        for channel_name in preferences.enabled_channels:
            channel = self.channels[channel_name]
            await channel.send(notification)


class WebhookNotifier:
    async def send(self, notification: Notification):
        webhook_url = notification.user.webhook_url
        if not webhook_url:
            return

        async with httpx.AsyncClient() as client:
            await client.post(
                webhook_url,
                json={
                    "event": notification.event_type,
                    "data": notification.data,
                    "timestamp": notification.timestamp.isoformat()
                },
                headers={
                    "X-Signature": self.sign_payload(notification)
                }
            )


class Notification:
    event_type: str
    title: str
    message: str
    data: Dict
    priority: str  # low, medium, high, critical
    timestamp: datetime
```

---

## 🟢 Nice to Have (Polish & UX)

### 16. Backtesting Framework

```python
# app/backtesting/

class BacktestEngine:
    async def run(
        self,
        strategy: Strategy,
        start_date: datetime,
        end_date: datetime,
        initial_portfolio: Portfolio
    ) -> BacktestResult:
        """Simulate strategy execution over historical data."""

        historical_data = await self.fetch_historical_data(
            tokens=strategy.target_tokens,
            start_date=start_date,
            end_date=end_date
        )

        simulator = PortfolioSimulator(initial_portfolio)

        for timestamp, market_state in historical_data.iterate():
            # Evaluate strategy at each point
            actions = await strategy.evaluate(market_state, simulator.portfolio)

            for action in actions:
                await simulator.execute(action, market_state)

        return BacktestResult(
            final_portfolio=simulator.portfolio,
            total_return_pct=simulator.calculate_return(),
            sharpe_ratio=simulator.calculate_sharpe(),
            max_drawdown=simulator.calculate_max_drawdown(),
            trades=simulator.trades,
            daily_values=simulator.daily_values
        )
```

---

### 17. Strategy Marketplace

```python
# Future feature for monetization

class StrategyMarketplace:
    async def publish_strategy(
        self,
        strategy: Strategy,
        pricing: StrategyPricing
    ) -> ListedStrategy:
        pass

    async def subscribe_to_strategy(
        self,
        user_id: UUID,
        strategy_id: UUID
    ) -> Subscription:
        pass

    async def get_strategy_performance(
        self,
        strategy_id: UUID
    ) -> StrategyPerformance:
        pass
```

---

## Implementation Order

| Phase | Focus | Status | Description |
|-------|-------|--------|-------------|
| **Phase 1** | Database, Auth, Rate Limiting | ✅ **COMPLETE** | Foundation for all other features |
| **Phase 2.1** | Transaction Execution Layer | ✅ **COMPLETE** | Execute swaps, bridges, approvals |
| **Phase 2.2** | Agent Wallet Management | ✅ **COMPLETE** | Session keys for autonomous execution |
| **Phase 2.3** | Jupiter Integration (Solana) | ✅ **COMPLETE** | Solana swap execution via Jupiter |
| **Phase 2.4** | LLM-Driven Tool Selection | ✅ **COMPLETE** | ReAct loop replaces keyword detection |
| **Phase 3** | Policy Engine, State Machine, Error Recovery | ✅ **COMPLETE** | Safety and reliability |
| **Phase 4** | Observability, Event System | 🔲 Pending | Operations and monitoring |
| **Phase 5** | Scaling, Circuit Breakers, Multi-tenancy | 🔲 Pending | Growth and resilience |
| **Phase 6** | Backtesting, Notifications, Polish | 🔲 Pending | User experience |
| **Phase 7** | Token Intelligence & Personalized News | ✅ **COMPLETE** | Wallet personalization |

### Phase 1 Completion Details (2025-12-26)

**Database Layer (Convex):**
- ✅ Schema defined in `frontend/convex/schema.ts`
- ✅ User/wallet management functions in `frontend/convex/users.ts`, `wallets.ts`
- ✅ Conversation persistence in `frontend/convex/conversations.ts`
- ✅ Strategy & execution tracking in `frontend/convex/strategies.ts`, `executions.ts`
- ✅ Transaction logging in `frontend/convex/transactions.ts`
- ✅ Scheduler for strategy triggers in `frontend/convex/scheduler.ts`
- ✅ Cron jobs for cleanup in `frontend/convex/crons.ts`
- ✅ Python client in `sherpa/app/db/convex_client.py`

**Authentication (SIWE):**
- ✅ Auth service with SIWE verification in `sherpa/app/auth/service.py`
- ✅ JWT token generation (access + refresh tokens)
- ✅ Auth middleware dependencies in `sherpa/app/auth/middleware.py`
- ✅ Permission scopes (READ_PORTFOLIO, READ_HISTORY, EXECUTE_STRATEGY, etc.)
- ✅ Nonce management in Convex (`frontend/convex/auth.ts`)
- ✅ Session storage and refresh in Convex
- ✅ API endpoints: `/auth/nonce`, `/auth/verify`, `/auth/refresh`, `/auth/me`, `/auth/logout`

**Rate Limiting:**
- ✅ Rate limiter using Convex storage in `sherpa/app/middleware/rate_limit.py`
- ✅ Sliding window algorithm implementation
- ✅ Per-endpoint configurable limits
- ✅ Provider-level limits (Alchemy, CoinGecko, Anthropic)
- ✅ Rate limit Convex functions in `frontend/convex/rateLimit.ts`
- ✅ Cleanup cron job for expired rate limit records
- ✅ Middleware integrated into FastAPI

**Dependencies Added:**
- `siwe>=4.0.0` - SIWE signature verification
- `PyJWT>=2.8.0` - JWT token handling

**Environment Variables:**
- `CONVEX_URL` - Convex deployment URL
- `CONVEX_DEPLOY_KEY` - Convex deploy key for server-side access
- `CONVEX_INTERNAL_API_KEY` - Internal API key (also used as JWT secret)
- `RATE_LIMIT_ENABLED` - Toggle rate limiting on/off

### Phase 2.1 Completion Details (2025-12-27)

**Transaction Execution Layer:**
- ✅ `app/core/execution/models.py` - Transaction types, statuses, quotes, gas estimates
- ✅ `app/core/execution/nonce_manager.py` - Concurrent nonce management with chain sync
- ✅ `app/core/execution/tx_builder.py` - Build transactions from quotes, approvals, transfers
- ✅ `app/core/execution/executor.py` - Execute swaps, bridges, monitor confirmations

**Key Classes:**
- `TransactionExecutor` - Main executor for swaps, bridges, approvals
- `NonceManager` - Tracks pending/confirmed nonces per address/chain
- `TransactionBuilder` - Builds PreparedTransaction from SwapQuote/BridgeQuote
- `ExecutionContext` - Settings for gas, retries, timeouts

**Features:**
- Gas estimation via eth_estimateGas + eth_feeHistory (EIP-1559)
- Nonce tracking for concurrent transactions
- Transaction monitoring with configurable confirmations
- Integration with Convex for transaction logging
- Support for ERC20 approvals, native transfers

### Phase 2.2 Completion Details (2025-12-27)

**Session Key Management:**
- ✅ `app/core/wallet/models.py` - SessionKey, Permission, ValueLimit, allowlists
- ✅ `app/core/wallet/session_manager.py` - SessionKeyManager for CRUD operations
- ✅ `frontend/convex/sessionKeys.ts` - Convex functions for session storage
- ✅ `frontend/convex/schema.ts` - Added sessionKeys table

**Key Classes:**
- `SessionKey` - Time-limited, permission-scoped access token
- `SessionKeyManager` - Create, validate, record usage, revoke sessions
- `Permission` enum - SWAP, BRIDGE, TRANSFER, APPROVE, STAKE, etc.
- `ValueLimit` - Per-tx and total value limits
- `ChainAllowlist`, `ContractAllowlist`, `TokenAllowlist` - Restriction configs

**Features:**
- Time-limited sessions (configurable, default 24h)
- Permission scoping (swap-only, bridge-only, etc.)
- Value limits (per-transaction and total)
- Chain/contract/token allowlisting
- Usage tracking and audit log
- Auto-expiry via cron job
- Limit exhaustion detection

**Cron Jobs Added:**
- `cleanup-session-keys` - Marks expired, deletes old sessions (hourly)

---

### Phase 2.3 Completion Details (2025-12-27)

**Jupiter Swap Provider:**
- ✅ `app/providers/jupiter.py` - Extended with swap quote and transaction building
- ✅ `JupiterSwapProvider` class with `get_swap_quote()` and `build_swap_transaction()`
- ✅ `JupiterQuote` dataclass with route plan, amounts, token metadata
- ✅ `JupiterSwapResult` dataclass with base64 transaction, block height, fees
- ✅ Priority fee estimation support (low, medium, high, veryHigh)
- ✅ Quote expiry validation (30 second validity window)

**Solana Transaction Executor:**
- ✅ `app/core/execution/solana_executor.py` - Send and monitor Solana transactions
- ✅ `SolanaExecutor` class for transaction submission and confirmation
- ✅ `SolanaRpcConfig` for RPC connection settings
- ✅ `SolanaTransactionResult` with status, slot, blockTime, fee
- ✅ `SolanaTransactionStatus` enum (PENDING, CONFIRMED, FINALIZED, FAILED, EXPIRED)

**Features:**
- Swap quote with slippage tolerance and route optimization
- Transaction building with SOL wrap/unwrap handling
- Automatic priority fee estimation
- Transaction simulation before sending
- Confirmation waiting with exponential backoff
- Balance and token account queries
- Multi-hop routing support via Jupiter

**Key Classes:**
- `JupiterSwapProvider` - Get quotes and build swap transactions
- `SolanaExecutor` - Send, monitor, and confirm transactions
- `JupiterQuote` - Quote with pricing, route, and token metadata
- `JupiterSwapResult` - Built transaction ready for signing

**Singleton Functions:**
- `get_jupiter_provider()` - Token list and price provider
- `get_jupiter_swap_provider()` - Swap quote and transaction provider
- `get_solana_executor()` - Transaction executor singleton

**Well-Known Token Mints:**
- `NATIVE_SOL_MINT` - Wrapped SOL
- `USDC_MINT` - USDC on Solana
- `USDT_MINT` - USDT on Solana

**Environment Variables:**
- `SOLANA_RPC_URL` - (Optional) Explicit Solana RPC endpoint
- `ALCHEMY_API_KEY` - If set, automatically used for Solana RPC

**RPC URL Resolution Order:**
1. Explicit `SOLANA_RPC_URL` if set
2. Alchemy Solana (`https://solana-mainnet.g.alchemy.com/v2/{ALCHEMY_API_KEY}`)
3. Public Solana RPC (fallback, rate limited)

**Note:** Jupiter API requires NO API key. If you already have `ALCHEMY_API_KEY` set, no additional configuration is needed for Solana.

---

### Phase 2.4 Completion Details (2025-12-27)

**Agent Pipeline Refactor - LLM-Driven Tool Selection:**

The agent pipeline has been refactored from keyword-based tool detection to LLM-driven tool selection using Claude's native function/tool calling capabilities.

**Problem Solved:**
- Previous approach used keyword matching (e.g., "portfolio", "chart", "trending") to decide which tools to execute
- This was brittle and missed semantic intent (e.g., "morpho's price history" wouldn't trigger chart tool)
- New approach lets the LLM semantically understand user intent and decide which tools to call

**Files Created/Modified:**

| File | Change |
|------|--------|
| `app/providers/llm/base.py` | Added `ToolParameterType`, `ToolParameter`, `ToolDefinition`, `ToolCall`, `ToolResult` models; Extended `LLMMessage` and `LLMResponse` for tool calling; Added `supports_tools` attribute to `LLMProvider` ABC |
| `app/providers/llm/anthropic.py` | Implemented native tool calling with `supports_tools = True`; Added `_convert_message_to_anthropic()` for tool message handling; Parse `tool_use` blocks from responses |
| `app/providers/llm/zai.py` | Marked `supports_tools = False`; Raises error if tools passed (ZAI doesn't support function calling) |
| `app/core/agent/tools.py` | **NEW** - Tool registry and executor with 5 registered tools and parallel execution |
| `app/core/agent/base.py` | Added `_run_react_loop()` method for LLM-driven tool selection; Added `_map_tool_result_to_legacy_format()` for backward compatibility |
| `app/core/agent/graph.py` | Simplified LangGraph pipeline; Replaced `execute_tools` + `augment_tvl` nodes with `run_react_loop` |

**Registered Tools:**
- `get_portfolio` - Fetch wallet portfolio (tokens, balances, total value)
- `get_token_chart` - Fetch price chart data (candlesticks, stats)
- `get_trending_tokens` - Fetch trending tokens (gainers, losers)
- `get_wallet_history` - Fetch transaction history
- `get_tvl_data` - Fetch DeFi protocol TVL from DefiLlama

**Key Classes:**
- `ToolRegistry` - Registers tools with definitions and handlers
- `ToolExecutor` - Executes tool calls with parallel support via `asyncio.gather()`
- `ToolDefinition` - Describes tool name, description, parameters (converts to Anthropic format)
- `ToolCall` - Represents a tool call requested by the LLM
- `ToolResult` - Result of executing a tool (success or error)

**ReAct Loop Flow:**
```
User Message → LLM + Tool Definitions → LLM Decides Tools → Execute Parallel
    → Return Results to LLM → LLM Generates Response (or calls more tools)
```

**Features:**
- **Semantic understanding**: LLM decides tools based on meaning, not keywords
- **Parallel execution**: Independent tool calls run concurrently
- **Provider flexibility**: Falls back gracefully when provider doesn't support tools (ZAI)
- **Max iterations**: Configurable limit (default 5) to prevent infinite loops
- **Backward compatible**: Response formatting unchanged via legacy format mapping

**Simplified Graph Flow:**
```
handle_style → determine_persona → prepare_context → run_react_loop
    → handle_bridge → handle_swap → format_response → update_conversation
```

**Removed Nodes:** `execute_tools`, `augment_tvl`, `ensure_portfolio`

**Deprecated Methods (still present but unused by graph):**
- `_needs_portfolio_data()`, `_needs_trending_data()`, `_needs_history_summary()`
- `_needs_tvl_data()`, `_extract_token_chart_request()`, `_extract_chart_range()`
- `_extract_trending_query()`, `_extract_history_limit()`, `_mentions_time_window()`
- `_find_token_symbol()`, `_extract_contract_address()`

---

### Phase 3.1 - Policy Engine (2025-12-28)

**Policy Engine** (renamed from "Risk Engine" - broader scope):

The Policy Engine provides unified policy enforcement across three layers:
1. **Session Policy** - Session key constraints (what is allowed)
2. **Risk Policy** - User risk preferences (how much/when)
3. **System Policy** - Platform guardrails (global limits)

**Files Created:**

| File | Description |
|------|-------------|
| `app/core/policy/__init__.py` | Module exports |
| `app/core/policy/models.py` | Core types: PolicyType, PolicyViolation, PolicyResult, ActionContext, RiskPolicyConfig, SystemPolicyConfig |
| `app/core/policy/session_policy.py` | SessionPolicy - wraps session key validation (permissions, value limits, allowlists) |
| `app/core/policy/risk_policy.py` | RiskPolicy - user risk preferences (position limits, daily limits, slippage, gas costs) |
| `app/core/policy/system_policy.py` | SystemPolicy - platform controls (emergency stop, blocked contracts, chain restrictions) |
| `app/core/policy/engine.py` | PolicyEngine - unified evaluation across all policy layers |

**Key Classes:**

- `PolicyEngine` - Main entry point, evaluates all policies in order
- `SessionPolicy` - Validates against session key constraints
- `RiskPolicy` - Evaluates user risk preferences, calculates risk score
- `SystemPolicy` - Enforces platform-wide rules

**Models:**

- `ActionContext` - Input for policy evaluation (action type, value, chain, tokens, etc.)
- `PolicyResult` - Output with approval status, violations, warnings, risk score
- `PolicyViolation` - Individual violation with severity, message, suggestion
- `RiskPolicyConfig` - User-configurable risk settings
- `SystemPolicyConfig` - Platform-wide policy settings

**Evaluation Order:**
1. System policy (emergency stops, blocked contracts) - blocks immediately if violated
2. Session policy (session key constraints) - blocks if session is invalid or action not permitted
3. Risk policy (user preferences) - can block or warn based on limits

**Features:**
- Risk score calculation (0.0-1.0) based on transaction size, concentration, slippage, gas
- Risk levels: LOW, MEDIUM, HIGH, CRITICAL
- Automatic approval requirements for high-value or high-risk actions
- Position limits (max % of portfolio in single asset)
- Daily volume and loss limits
- Slippage and gas cost checks with warning thresholds
- Emergency stop functionality
- Blocked contracts/tokens (scam protection)
- Chain restrictions (whitelist/blacklist)

**Integration with Session Keys:**
The SessionPolicy wraps the existing session key validation from Phase 2.2, providing:
- Permission checking (swap, bridge, transfer, etc.)
- Value limit enforcement (per-tx and total)
- Chain/contract/token allowlist validation
- Session validity checks (expiry, revocation, exhaustion)

**Remaining Phase 3 Work:**
- [x] State Machine implementation
- [x] Error Recovery system
- [ ] Integration of Policy Engine into transaction execution flow

---

### Phase 3.2 - Strategy State Machine (2025-12-28)

**Strategy State Machine** - Manages execution lifecycle with proper state transitions:

**Files Created:**

| File | Description |
|------|-------------|
| `app/core/strategy/__init__.py` | Module exports |
| `app/core/strategy/models.py` | State models: `StrategyState`, `StateTransition`, `ExecutionContext`, `ExecutionStep` |
| `app/core/strategy/state_machine.py` | `StrategyStateMachine` with transition validation and timeout handling |
| `app/core/strategy/persistence.py` | `ExecutionPersistence` for Convex integration |
| `app/core/strategy/handlers.py` | `StateHandlers` for state-specific logic |
| `frontend/convex/schema.ts` | Updated `strategyExecutions` table for state machine |
| `frontend/convex/executions.ts` | Convex functions for state persistence |

**States:**
```
IDLE → ANALYZING → PLANNING → [AWAITING_APPROVAL] → EXECUTING → MONITORING → COMPLETED
                                                          ↑            │
                                                          └────────────┘
                                                       (next step)

Any active state can transition to: PAUSED, CANCELLED, FAILED
Terminal states: COMPLETED, FAILED, CANCELLED
```

**Key Classes:**

- `StrategyStateMachine` - Validates transitions, handles timeouts, emits events
- `ExecutionContext` - Tracks execution state, steps, history
- `ExecutionStep` - Single action (swap, bridge, etc.) with status and retry count
- `StateTransition` - Audit record of each state change
- `StateHandlers` - Pluggable handlers for ANALYZING, PLANNING, EXECUTING, MONITORING
- `ExecutionPersistence` - Convex adapter for state persistence

**Features:**
- Validated state transitions (defined transition map)
- Automatic timeouts for stuck states (configurable per state)
- State history tracking (full audit trail)
- Step-by-step execution with retry logic
- Approval workflow for high-value operations
- Pause/resume/cancel support
- Recovery from crashes (load from Convex)
- Pluggable state handlers

**Timeouts:**
- ANALYZING: 5 minutes
- PLANNING: 2 minutes
- AWAITING_APPROVAL: 1 hour
- EXECUTING: 10 minutes per step
- MONITORING: 30 minutes for tx confirmation

**Convex Integration:**
- Full state persistence after each transition
- Step updates persisted separately
- Queries for active/failed/awaiting approval executions
- Recovery by loading execution from Convex

---

### Phase 3.3 - Error Recovery System (2025-12-28)

**Error Recovery System** - Comprehensive error handling with retry logic and fallbacks:

**Files Created:**

| File | Description |
|------|-------------|
| `app/core/recovery/__init__.py` | Module exports |
| `app/core/recovery/errors.py` | Error classification: `RecoverableError`, `UnrecoverableError`, plus specific types |
| `app/core/recovery/strategies.py` | Recovery strategies: `RetryStrategy`, `ExponentialBackoffStrategy`, `CircuitBreakerStrategy`, `FallbackStrategy` |
| `app/core/recovery/executor.py` | `RecoveryExecutor` - unified executor with all recovery features |

**Tests Created:**

| File | Description |
|------|-------------|
| `tests/core/policy/test_policy_engine.py` | Tests for PolicyEngine, SessionPolicy, RiskPolicy, SystemPolicy |
| `tests/core/strategy/test_state_machine.py` | Tests for StrategyStateMachine, transitions, handlers |
| `tests/core/recovery/test_error_recovery.py` | Tests for error classification, retry strategies, circuit breaker |

**Error Categories:**
- `NETWORK` - Connection issues (recoverable)
- `RATE_LIMIT` - API rate limits (recoverable)
- `TIMEOUT` - Operation timeouts (recoverable)
- `SLIPPAGE` - Slippage exceeded (recoverable)
- `INSUFFICIENT_FUNDS` - Not enough balance (unrecoverable)
- `TRANSACTION_REVERTED` - On-chain revert (unrecoverable)
- `CONTRACT` - Smart contract error (unrecoverable)

**Specific Error Types:**
- `RateLimitError` - With retry_after hint
- `NetworkError` - Connection/DNS issues
- `TimeoutError` - Operation timed out
- `SlippageExceededError` - Price moved too much
- `InsufficientFundsError` - Not enough balance
- `TransactionRevertedError` - With tx_hash and reason
- `ContractError` - Smart contract execution failed

**Recovery Strategies:**

1. **RetryStrategy** - Simple retry with configurable attempts
2. **ExponentialBackoffStrategy** - Increasing delays with jitter
3. **CircuitBreakerStrategy** - Prevents cascading failures
   - CLOSED → OPEN after failure threshold
   - OPEN → HALF_OPEN after timeout
   - HALF_OPEN → CLOSED after success threshold
4. **FallbackStrategy** - Try alternative operations
5. **CompositeStrategy** - Combine multiple strategies

**RecoveryExecutor Features:**
- Automatic error classification
- Per-provider circuit breakers
- Exponential backoff with jitter
- Escalation callbacks for human intervention
- Fallback chain support
- Detailed execution metrics

**Configuration:**
```python
RecoveryConfig(
    max_retries=3,
    initial_delay_seconds=1.0,
    max_delay_seconds=60.0,
    enable_circuit_breaker=True,
    circuit_failure_threshold=5,
    escalate_on_failure=True,
)
```

---

## Phase 3 Status: ✅ COMPLETE

All Phase 3 components implemented:
- [x] Policy Engine (Session, Risk, System policies)
- [x] Strategy State Machine
- [x] Error Recovery System
- [x] Tests for all components

---

## Phase 7 Status: ✅ COMPLETE (2025-01-02)

**Token Intelligence & Personalized News System:**

All Phase 7 components implemented:
- [x] Token Catalog Service (7.1) - CoinGecko integration, category taxonomy
- [x] News Fetcher Service (7.2) - RSS feeds, CoinGecko trending, DefiLlama hacks/TVL
- [x] Batch News Processor (7.3a) - Cost-efficient LLM batch processing with rule-based fallback
- [x] News Processor Worker - Background worker for scheduled news processing
- [x] Relevance Scoring (7.4) - Portfolio-aware news personalization
- [x] Chat Integration (7.5) - News tools wired into agent (get_news, get_personalized_news, get_token_news)
- [x] Tests for all components (37 tests passing)

**Files Created:**

| File | Description |
|------|-------------|
| `app/services/token_catalog/` | Token enrichment and categorization service |
| `app/services/news_fetcher/` | Multi-source news fetching (RSS, CoinGecko, DefiLlama) |
| `app/services/news_fetcher/batch_processor.py` | Cost-efficient batch LLM processing |
| `app/services/news_fetcher/models.py` | NewsItem, ProcessedNews, Sentiment, Importance |
| `app/services/relevance/` | Portfolio-aware relevance scoring |
| `app/workers/news_processor_worker.py` | Background worker for news processing |
| `app/core/agent/tools.py` | Added get_news, get_personalized_news, get_token_news tools |
| `tests/services/test_batch_processor.py` | 24 tests for batch processor |
| `tests/workers/test_news_processor_worker.py` | 13 tests for worker |

**Key Features:**

- **Batch Processing**: Process 10+ news items per LLM call (cost reduction ~10x)
- **Daily Token Budget**: Configurable max_daily_tokens to control LLM costs
- **Rule-Based Fallback**: Keyword classification when LLM unavailable or budget exceeded
- **Multi-Source Fetching**: RSS (CoinDesk, Cointelegraph, TheBlock), CoinGecko trending, DefiLlama hacks
- **Relevance Scoring**: Direct holdings, sector relevance, competitor impact, correlation factors
- **LLM-Driven Tool Selection**: Agent decides when to fetch news based on user intent

**Live Test Results:**
- RSS feeds: CoinDesk (25), Cointelegraph (30), TheBlock (20) items
- CoinGecko: 7 trending items
- DefiLlama: 23 items (hacks + TVL changes)

**Deferred (Optional):**
- 7.3b Agent ensemble - adds cost/complexity, defer until needed
- 7.6 Dashboard widgets - frontend work
- 7.7 News alerts - notification system integration

---

## Target Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway                              │
│              (Auth, Rate Limit, Load Balance)                   │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  Chat API     │     │  Strategy API │     │  Webhook API  │
│  (FastAPI)    │     │  (FastAPI)    │     │  (FastAPI)    │
└───────────────┘     └───────────────┘     └───────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
        ┌───────────────────┐   ┌───────────────────────────────┐
        │  Agent Workers    │   │         Convex                │
        │  (Python)         │   │  ┌─────────────────────────┐  │
        │                   │◄──┼─►│  Reactive Database      │  │
        │  - LLM Calls      │   │  │  - Real-time queries    │  │
        │  - Web3 Txns      │   │  │  - ACID transactions    │  │
        │  - Risk Checks    │   │  └─────────────────────────┘  │
        └───────────────────┘   │  ┌─────────────────────────┐  │
                                │  │  Serverless Functions   │  │
                                │  │  - Mutations            │  │
                                │  │  - Actions              │  │
                                │  └─────────────────────────┘  │
                                │  ┌─────────────────────────┐  │
                                │  │  Scheduled Jobs (Crons) │  │
                                │  │  - Strategy triggers    │  │
                                │  │  - Cleanup tasks        │  │
                                │  └─────────────────────────┘  │
                                └───────────────────────────────┘
```

**Data Flow:**
1. User request → FastAPI (auth, validation)
2. FastAPI → Convex (persist data, real-time updates)
3. Convex Crons → Trigger strategy checks
4. Convex Actions → Call FastAPI internal endpoints for execution
5. FastAPI Workers → Execute LLM/Web3 logic → Update Convex

---

## External Services to Register

### Database
- [ ] **Convex** - https://convex.dev (Reactive database + serverless functions + scheduling)
  - Sign up at https://dashboard.convex.dev
  - Create a new project
  - Get your deployment URL and deploy key

### Cache/Queue (Optional - Convex handles most of this)
- [ ] **Upstash** - https://upstash.com (Serverless Redis) - Only if you need additional caching beyond Convex

### Observability
- [ ] **Grafana Cloud** - https://grafana.com/cloud (Logs, Metrics, Traces)
- [ ] **Datadog** - https://datadoghq.com
- [ ] **New Relic** - https://newrelic.com

### Notifications
- [ ] **Resend** - https://resend.com (Email)
- [ ] **Twilio** - https://twilio.com (SMS)
- [ ] **Discord Webhook** - Create in Discord server settings

---

---

## 🧠 Phase 7: Token Intelligence & Personalized News System

**Goal:** Transform the wallet from a passive portfolio viewer into an intelligent, personalized information hub that understands what coins the user holds, their categories, and surfaces relevant news/signals.

### 7.1 Token Taxonomy & Catalog

**Problem:** Currently tokens are just addresses with prices. No semantic understanding of what they represent.

**Token Classification Schema:**

```typescript
// convex/schema.ts - Token catalog
tokenCatalog: defineTable({
  // Identity
  address: v.string(),
  chainId: v.number(),
  symbol: v.string(),
  name: v.string(),
  decimals: v.number(),
  logoUrl: v.optional(v.string()),

  // Taxonomy (multi-label)
  categories: v.array(v.string()),       // ["defi", "lending", "governance"]
  sector: v.optional(v.string()),        // "DeFi", "Gaming", "Infrastructure"
  subsector: v.optional(v.string()),     // "DEX", "Lending", "L2"

  // Protocol/Project info
  projectName: v.optional(v.string()),   // "Aave", "Uniswap"
  projectSlug: v.optional(v.string()),   // For API lookups
  website: v.optional(v.string()),
  twitter: v.optional(v.string()),
  discord: v.optional(v.string()),
  github: v.optional(v.string()),

  // Market context
  marketCapTier: v.optional(v.string()), // "mega", "large", "mid", "small", "micro"
  isStablecoin: v.boolean(),
  isWrapped: v.boolean(),
  isLpToken: v.boolean(),
  isGovernanceToken: v.boolean(),

  // Related tokens (for correlation)
  relatedTokens: v.array(v.object({
    address: v.string(),
    chainId: v.number(),
    relationship: v.string(), // "same_project", "competitor", "derivative"
  })),

  // Data freshness
  lastUpdated: v.number(),
  dataSource: v.string(),
})
  .index("by_chain_address", ["chainId", "address"])
  .index("by_symbol", ["symbol"])
  .index("by_project", ["projectSlug"])
  .index("by_sector", ["sector"]),
```

**Category Hierarchy:**

```
├── DeFi
│   ├── DEX (UNI, SUSHI, CRV)
│   ├── Lending (AAVE, COMP, MKR)
│   ├── Derivatives (GMX, DYDX, SNX)
│   ├── Yield (CONVEX, YFI)
│   └── Stablecoins (USDC, DAI, FRAX)
├── Infrastructure
│   ├── L1 (ETH, SOL, AVAX)
│   ├── L2/Rollups (ARB, OP, MATIC)
│   ├── Oracles (LINK, PYTH)
│   └── Bridges (LDO, rETH derivatives)
├── Gaming/Metaverse
│   ├── Gaming (IMX, GALA, AXS)
│   └── Metaverse (MANA, SAND)
├── Social/Creator
│   ├── Social (FRIEND, DESO)
│   └── NFT Infrastructure
├── AI/Data
│   ├── AI Tokens (FET, AGIX, TAO)
│   └── Data (GRT, OCEAN)
└── Meme/Speculative
    └── Meme (DOGE, SHIB, PEPE)
```

**Data Sources for Token Catalog:**

| Source | Data Provided | Cost |
|--------|---------------|------|
| **CoinGecko API** | Categories, market data, links | Free tier limited |
| **DefiLlama** | DeFi protocol mappings | Free |
| **Token Lists** (Uniswap, 1inch) | Curated addresses, logos | Free |
| **DexScreener** | New tokens, pairs | Free tier |
| **LlamaNodes** | Token metadata | Free |

**Token Catalog Service:**

```python
# app/services/token_catalog.py

class TokenCatalogService:
    """Maintains enriched token metadata with categorization."""

    async def enrich_token(self, address: str, chain_id: int) -> EnrichedToken:
        """Fetch and merge data from multiple sources."""
        # 1. Check Convex cache first
        cached = await self.convex.query("tokenCatalog:get", {
            "address": address.lower(),
            "chainId": chain_id,
        })
        if cached and not self._is_stale(cached):
            return EnrichedToken.from_dict(cached)

        # 2. Fetch from sources in parallel
        coingecko, defillama, token_list = await asyncio.gather(
            self.coingecko.get_token_info(address, chain_id),
            self.defillama.get_protocol_for_token(address),
            self.token_lists.lookup(address, chain_id),
        )

        # 3. Merge and classify
        enriched = self._merge_sources(coingecko, defillama, token_list)
        enriched.categories = self._classify_token(enriched)

        # 4. Persist to Convex
        await self.convex.mutation("tokenCatalog:upsert", enriched.to_dict())

        return enriched

    async def get_portfolio_profile(
        self,
        tokens: List[TokenHolding]
    ) -> PortfolioProfile:
        """Analyze portfolio composition by category."""
        enriched = await asyncio.gather(*[
            self.enrich_token(t.address, t.chain_id) for t in tokens
        ])

        return PortfolioProfile(
            sector_allocation=self._calc_sector_weights(enriched, tokens),
            category_exposure=self._calc_category_weights(enriched, tokens),
            risk_profile=self._assess_risk_profile(enriched, tokens),
            correlated_groups=self._find_correlations(enriched),
        )
```

---

### 7.2 News & Social Sentiment Data Sources

**Recommended Data Sources:**

| Source | Type | Data | API Cost | Latency |
|--------|------|------|----------|---------|
| **The Block Data API** | News | Crypto news feed | $$ | Minutes |
| **Messari** | Research | Research reports, news | $$$ | Hours |
| **LunarCrush** | Social | Twitter/social metrics | $$ | Real-time |
| **Santiment** | On-chain + Social | Development activity, social | $$$ | Hours |
| **Nansen** | On-chain | Smart money movements | $$$$ | Minutes |
| **CryptoCompare** | News | Aggregated news | $ | Minutes |
| **RSS Feeds** | News | Protocol blogs, Medium | Free | Varies |
| **Twitter/X API** | Social | Direct mentions, CT | $$ | Real-time |
| **Discord/Telegram Bots** | Social | Community sentiment | Custom | Real-time |
| **GitHub API** | Development | Commit activity, issues | Free | Hours |

**Pragmatic Starting Point:**

```python
# Start with these (good value/cost ratio):
NEWS_SOURCES = [
    # Free/cheap
    "rss:protocol_blogs",      # Direct from projects
    "coingecko:news",          # Included in API
    "defillama:news",          # Free

    # Paid but valuable
    "lunarcrush:social",       # Social sentiment
    "cryptocompare:news",      # Aggregated news
]
```

**News Item Schema:**

```typescript
// convex/schema.ts
newsItems: defineTable({
  // Identity
  externalId: v.string(),        // Source's ID
  source: v.string(),            // "lunarcrush", "cryptocompare", etc.

  // Content
  title: v.string(),
  summary: v.optional(v.string()),
  url: v.string(),
  imageUrl: v.optional(v.string()),

  // Classification
  tokens: v.array(v.string()),   // Token symbols mentioned
  tokenAddresses: v.array(v.object({
    address: v.string(),
    chainId: v.number(),
  })),
  categories: v.array(v.string()),
  sentiment: v.optional(v.number()),  // -1 to 1
  importance: v.number(),             // 0 to 1

  // Timing
  publishedAt: v.number(),
  fetchedAt: v.number(),

  // Agent processing (see 7.3)
  agentDigest: v.optional(v.string()),
  agentRelevanceScores: v.optional(v.any()),
  processedAt: v.optional(v.number()),
})
  .index("by_published", ["publishedAt"])
  .index("by_token", ["tokens"])
  .index("by_source", ["source", "publishedAt"]),
```

---

### 7.3 Multi-Agent News Processing

**The Concept:** Cache raw news, have specialized agents process/analyze it, then surface to users.

**Architecture Options:**

#### Option A: Background Processing Pipeline (Recommended)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  News Fetcher   │────►│  News Processor │────►│  Relevance      │
│  (Cron, 15min)  │     │  (LLM Analysis) │     │  Scorer         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
                              ┌───────────────────────────────────────┐
                              │         Processed News Cache          │
                              │  (Convex - pre-computed relevance)    │
                              └───────────────────────────────────────┘
                                                         │
                                                         ▼
                              ┌───────────────────────────────────────┐
                              │     User Query (Chat or Dashboard)    │
                              │  - Fast lookup by token/category      │
                              │  - Already has relevance scores       │
                              └───────────────────────────────────────┘
```

**Pros:** Fast user queries, predictable costs, simple architecture
**Cons:** Slight delay on breaking news (15-60 min)

#### Option B: Agent Ensemble (More Complex)

```
┌─────────────────┐
│   Raw News      │
│   Cache         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Summarizer     │     │  Sentiment      │     │  Impact         │
│  Agent          │     │  Agent          │     │  Analyst Agent  │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────┐
                    │  Synthesizer Agent  │
                    │  (Combines views)   │
                    └─────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────┐
                    │  User-Facing Agent  │
                    │  (Personalizes)     │
                    └─────────────────────┘
```

**Pros:** Richer analysis, multiple perspectives
**Cons:** Higher cost (multiple LLM calls), latency, complexity

#### Recommended: Hybrid Approach

```python
# app/workers/news_processor.py

class NewsProcessor:
    """Background processor for news items."""

    async def process_batch(self, news_items: List[NewsItem]) -> List[ProcessedNews]:
        """Process news in batch (cost-efficient)."""

        # 1. Single LLM call for batch classification + summarization
        batch_prompt = self._build_batch_prompt(news_items)

        response = await self.llm.generate(
            messages=[
                {"role": "system", "content": NEWS_PROCESSOR_SYSTEM_PROMPT},
                {"role": "user", "content": batch_prompt},
            ],
            # Use structured output for reliability
            tools=[self.news_analysis_tool],
        )

        # 2. Parse structured output
        analyses = self._parse_analyses(response)

        # 3. Compute relevance scores for each token category
        for news, analysis in zip(news_items, analyses):
            analysis.relevance_scores = self._compute_relevance(
                news, analysis,
                self.token_catalog  # Reference catalog for matching
            )

        return analyses


NEWS_PROCESSOR_SYSTEM_PROMPT = """
You are a crypto news analyst. For each news item, provide:
1. A 1-2 sentence summary
2. Affected tokens/protocols (be specific, use symbols)
3. Sentiment: -1 (bearish) to +1 (bullish)
4. Impact level: 0 (noise) to 1 (major event)
5. Categories: regulatory, technical, partnership, tokenomics, market, hack, upgrade
6. Time sensitivity: breaking, developing, background

Be concise and factual. Focus on actionable information for portfolio holders.
"""
```

**Cost Control:**

```python
# Batch processing keeps costs low
# Example: 100 news items/day
#
# Option A (batch): ~$0.50/day (one summarization call per batch)
# Option B (ensemble): ~$5-10/day (multiple agents per item)
#
# Recommendation: Start with Option A, add ensemble for high-impact news only

class NewsProcessingConfig:
    batch_size: int = 20
    process_interval_minutes: int = 15
    high_impact_threshold: float = 0.8  # Use ensemble only above this

    # Cost limits
    max_daily_llm_tokens: int = 100_000
    max_news_items_per_day: int = 500
```

---

### 7.4 Portfolio-Aware Personalization

**The Key Insight:** Every piece of information should be scored for relevance to the user's specific holdings.

**Relevance Scoring:**

```python
# app/services/relevance.py

class RelevanceScorer:
    """Scores content relevance to a user's portfolio."""

    def score_news_for_portfolio(
        self,
        news: ProcessedNews,
        portfolio: PortfolioProfile
    ) -> RelevanceScore:
        """Multi-factor relevance scoring."""

        scores = {
            # Direct holdings
            "direct_holding": self._score_direct_holdings(
                news.tokens, portfolio.holdings
            ),

            # Same project (e.g., news about Uniswap affects UNI holders)
            "same_project": self._score_project_relevance(
                news, portfolio
            ),

            # Same sector (e.g., lending news affects all DeFi lending holders)
            "sector_relevance": self._score_sector_overlap(
                news.categories, portfolio.sector_allocation
            ),

            # Competitor dynamics (e.g., Aave news affects Compound holders)
            "competitor_impact": self._score_competitor_relevance(
                news, portfolio
            ),

            # Correlated assets (e.g., ETH news affects L2 tokens)
            "correlation": self._score_correlation(
                news.tokens, portfolio.correlated_groups
            ),

            # Portfolio size factor (bigger position = more relevant)
            "position_weight": self._weight_by_position_size(
                news.tokens, portfolio.holdings
            ),
        }

        # Weighted combination
        weights = {
            "direct_holding": 0.4,
            "same_project": 0.2,
            "sector_relevance": 0.15,
            "competitor_impact": 0.1,
            "correlation": 0.1,
            "position_weight": 0.05,
        }

        final_score = sum(
            scores[k] * weights[k] for k in weights
        )

        return RelevanceScore(
            score=final_score,
            breakdown=scores,
            explanation=self._generate_explanation(scores, news, portfolio),
        )
```

**Personalized Feed:**

```typescript
// convex/personalizedFeed.ts

export const getPersonalizedFeed = query({
  args: {
    walletId: v.id("wallets"),
    limit: v.optional(v.number()),
    minRelevance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Get user's portfolio profile
    const portfolio = await ctx.db
      .query("portfolioProfiles")
      .withIndex("by_wallet", (q) => q.eq("walletId", args.walletId))
      .first();

    if (!portfolio) return [];

    // 2. Get recent processed news
    const recentNews = await ctx.db
      .query("newsItems")
      .withIndex("by_published")
      .order("desc")
      .take(100);

    // 3. Filter and sort by pre-computed relevance
    const relevantNews = recentNews
      .map(news => ({
        ...news,
        relevance: computeRelevance(news, portfolio),
      }))
      .filter(n => n.relevance >= (args.minRelevance ?? 0.3))
      .sort((a, b) => {
        // Balance recency and relevance
        const recencyScore = (a, b) => b.publishedAt - a.publishedAt;
        const relevanceScore = (a, b) => b.relevance - a.relevance;
        return relevanceScore(a, b) * 0.6 + recencyScore(a, b) * 0.4;
      })
      .slice(0, args.limit ?? 20);

    return relevantNews;
  },
});
```

---

### 7.5 User Experience Integration

**Chat Integration:**

```python
# When user asks about their portfolio, include relevant news

PORTFOLIO_WITH_NEWS_PROMPT = """
{portfolio_summary}

## Recent Relevant News

{personalized_news_digest}

Based on your holdings, here are the key developments you should know about...
"""
```

**Dashboard Widgets:**

```typescript
// Frontend components
<PersonalizedNewsFeed walletAddress={address} />
<SectorExposureChart portfolio={portfolio} />
<RelevantAlerts holdings={holdings} />
<ProjectUpdates followedTokens={tokens} />
```

**Notification Triggers:**

```python
# app/notifications/news_alerts.py

class NewsAlertService:
    """Send alerts for high-impact relevant news."""

    async def check_alerts(self, news: ProcessedNews):
        # Find users who should be notified
        if news.impact < 0.7:
            return  # Only alert on high-impact news

        affected_users = await self.find_holders(news.tokens)

        for user in affected_users:
            relevance = await self.scorer.score_news_for_portfolio(
                news, user.portfolio
            )

            if relevance.score > 0.8:  # High relevance
                await self.notifications.send(
                    user_id=user.id,
                    type="high_impact_news",
                    title=f"📰 {news.title}",
                    body=news.summary,
                    data={"newsId": news.id, "relevance": relevance.score},
                )
```

---

### 7.6 Implementation Phases

| Phase | Scope | Effort | Value |
|-------|-------|--------|-------|
| **7.1a** | Token catalog with CoinGecko | 2-3 days | High - foundation |
| **7.1b** | Category taxonomy & classification | 2 days | High - intelligence |
| **7.2a** | News fetcher (free sources) | 1-2 days | Medium |
| **7.2b** | LunarCrush/paid integration | 1 day | Medium |
| **7.3a** | Batch news processor | 2-3 days | High |
| **7.3b** | Agent ensemble (optional) | 3-4 days | Medium |
| **7.4** | Relevance scoring | 2 days | High - personalization |
| **7.5** | Chat integration | 1 day | High - UX |
| **7.6** | Dashboard widgets | 2-3 days | Medium |
| **7.7** | News alerts | 1-2 days | Medium |

**Recommended Order:**
1. Token catalog + taxonomy (7.1a, 7.1b) - required foundation
2. Portfolio profile service (part of 7.4) - know what user holds
3. News fetcher with free sources (7.2a) - start getting data
4. Batch processor (7.3a) - efficient classification
5. Relevance scoring (7.4) - personalization core
6. Chat integration (7.5) - immediate user value

**Defer until proven value:**
- Agent ensemble (7.3b) - adds cost/complexity
- Paid news sources (7.2b) - validate with free first
- Dashboard widgets (7.6) - once news flow is solid

---

### 7.7 Cost Estimates

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| **CoinGecko Pro** | $129 | Token metadata, higher limits |
| **LunarCrush** | $99-299 | Social sentiment |
| **CryptoCompare** | $79 | News aggregation |
| **LLM (news processing)** | ~$50-100 | Batch processing 500 items/day |
| **Convex (storage)** | Included | Within free tier for MVP |

**Total:** ~$350-600/month for full news intelligence stack

**MVP (free/minimal):**
- CoinGecko free tier + caching
- RSS feeds + GitHub API
- LLM batch processing with cost limits
- **Total:** ~$50-100/month

---

---

## 🔵 Phase 8: Wallet Copy Trading

**Goal:** Allow users to follow and automatically replicate trades from successful wallets.

### 8.1 Wallet Monitoring Service

**Problem:** No infrastructure to watch external wallets for transactions.

**Files to Create:**

| File | Description |
|------|-------------|
| `app/services/wallet_monitor/` | Wallet monitoring service directory |
| `app/services/wallet_monitor/monitor.py` | Core monitoring with webhooks/polling |
| `app/services/wallet_monitor/parser.py` | Transaction parsing and classification |
| `app/services/wallet_monitor/models.py` | WatchedWallet, WalletActivity, TradeEvent |
| `frontend/convex/watchedWallets.ts` | Watched wallet storage |
| `frontend/convex/walletActivity.ts` | Activity log storage |

**Key Classes:**

```python
class WalletMonitorService:
    """Monitor wallets for on-chain activity."""

    async def watch_wallet(
        self,
        address: str,
        chain: str,
        user_id: str,
        label: Optional[str] = None,
    ) -> WatchedWallet:
        """Add a wallet to monitoring list."""
        pass

    async def process_webhook(self, payload: Dict) -> List[WalletActivity]:
        """Process Alchemy/Helius webhook for tracked wallets."""
        pass

    async def poll_activity(self, address: str, chain: str) -> List[WalletActivity]:
        """Fallback polling for chains without webhook support."""
        pass


class TransactionParser:
    """Parse and classify blockchain transactions."""

    async def parse_transaction(
        self,
        tx_hash: str,
        chain: str,
    ) -> ParsedTransaction:
        """Parse transaction into structured format."""
        pass

    def classify_action(self, parsed: ParsedTransaction) -> ActionType:
        """Classify as SWAP, BRIDGE, TRANSFER, LP_ADD, LP_REMOVE, STAKE, etc."""
        pass

    def extract_trade_details(self, parsed: ParsedTransaction) -> Optional[TradeEvent]:
        """Extract swap/trade details if applicable."""
        pass
```

**Webhook Integration:**

```python
# Alchemy Address Activity Webhooks
# https://docs.alchemy.com/reference/address-activity-webhook

class AlchemyWebhookHandler:
    async def handle_address_activity(self, payload: Dict):
        """Handle Alchemy address activity webhook."""
        for activity in payload.get("event", {}).get("activity", []):
            tx_hash = activity.get("hash")
            from_address = activity.get("fromAddress")
            to_address = activity.get("toAddress")

            # Check if this is a watched wallet
            if self.is_watched(from_address) or self.is_watched(to_address):
                await self.process_activity(activity)
```

### 8.2 Copy Trading Engine

**Files to Create:**

| File | Description |
|------|-------------|
| `app/core/copy_trading/` | Copy trading module |
| `app/core/copy_trading/models.py` | CopyConfig, CopyRelationship, CopyExecution |
| `app/core/copy_trading/manager.py` | CopyTradingManager - orchestrates copy trades |
| `app/core/copy_trading/executor.py` | CopyExecutor - executes replicated trades |
| `app/core/copy_trading/sizing.py` | Position sizing strategies |
| `frontend/convex/copyTrading.ts` | Copy relationship storage |
| `frontend/convex/copyExecutions.ts` | Copy execution history |

**Copy Configuration:**

```python
class CopyConfig(BaseModel):
    """Configuration for following a wallet."""

    # Target wallet
    leader_address: str
    leader_chain: str
    leader_label: Optional[str] = None

    # Sizing strategy
    sizing_mode: Literal["percentage", "fixed", "proportional"] = "percentage"
    size_value: Decimal  # % of portfolio, fixed USD, or proportional multiplier

    # Filters
    min_trade_usd: Decimal = Decimal("10")
    max_trade_usd: Optional[Decimal] = None
    token_whitelist: Optional[List[str]] = None
    token_blacklist: Optional[List[str]] = None
    allowed_actions: List[str] = ["swap"]  # swap, bridge, lp_add, stake

    # Timing
    delay_seconds: int = 0  # 0 = immediate, >0 = delayed execution
    max_delay_seconds: int = 300  # Skip trade if older than this

    # Risk controls
    max_slippage_bps: int = 100  # 1%
    max_daily_trades: int = 20
    max_daily_volume_usd: Decimal = Decimal("10000")

    # Session key
    session_key_id: Optional[str] = None  # For autonomous execution


class CopyTradingManager:
    """Manages copy trading relationships and execution."""

    async def start_copying(
        self,
        user_id: str,
        config: CopyConfig,
    ) -> CopyRelationship:
        """Start copying a wallet."""
        pass

    async def handle_leader_trade(
        self,
        trade: TradeEvent,
        relationship: CopyRelationship,
    ) -> Optional[CopyExecution]:
        """Process a trade from a followed wallet."""
        # 1. Check filters (whitelist, blacklist, min/max size)
        # 2. Calculate position size
        # 3. Check daily limits
        # 4. Queue or execute trade
        pass

    async def execute_copy(
        self,
        execution: CopyExecution,
    ) -> CopyExecutionResult:
        """Execute a copy trade."""
        pass
```

**Position Sizing:**

```python
class SizingStrategy(ABC):
    @abstractmethod
    def calculate_size(
        self,
        leader_trade: TradeEvent,
        follower_portfolio: Portfolio,
        config: CopyConfig,
    ) -> Decimal:
        pass


class PercentageSizing(SizingStrategy):
    """Size as % of follower's portfolio."""

    def calculate_size(self, leader_trade, follower_portfolio, config):
        portfolio_value = follower_portfolio.total_value_usd
        return portfolio_value * (config.size_value / 100)


class ProportionalSizing(SizingStrategy):
    """Size proportional to leader's trade relative to their portfolio."""

    def calculate_size(self, leader_trade, follower_portfolio, config):
        # If leader traded 5% of their portfolio, follower trades 5% * multiplier
        leader_portfolio_value = self.get_leader_portfolio_value(leader_trade.address)
        leader_trade_pct = leader_trade.value_usd / leader_portfolio_value
        return follower_portfolio.total_value_usd * leader_trade_pct * config.size_value
```

### 8.3 Leader Discovery & Performance Tracking

**Files to Create:**

| File | Description |
|------|-------------|
| `app/services/leader_analytics/` | Leader performance tracking |
| `app/services/leader_analytics/tracker.py` | LeaderTracker - tracks P&L, win rate |
| `app/services/leader_analytics/rankings.py` | Leaderboard generation |
| `frontend/convex/leaderProfiles.ts` | Leader performance storage |
| `frontend/convex/leaderboards.ts` | Cached leaderboards |

**Leader Profile:**

```python
class LeaderProfile(BaseModel):
    """Performance profile for a copyable wallet."""

    address: str
    chain: str

    # Performance metrics
    total_trades: int
    win_rate: float  # % of profitable trades
    avg_trade_pnl_pct: float
    total_pnl_usd: Decimal
    sharpe_ratio: Optional[float]
    max_drawdown_pct: float

    # Activity metrics
    avg_trades_per_day: float
    avg_hold_time_hours: float
    most_traded_tokens: List[str]
    preferred_sectors: List[str]

    # Risk metrics
    avg_position_size_pct: float
    max_position_size_pct: float
    uses_leverage: bool

    # Social proof
    follower_count: int
    total_copied_volume_usd: Decimal

    # Metadata
    first_seen: datetime
    last_active: datetime
    data_quality_score: float  # How much history we have
```

### 8.4 Session Key Permissions for Copy Trading

```python
# Add to app/core/wallet/models.py

class Permission(str, Enum):
    # ... existing permissions ...

    # Copy trading permissions
    COPY_TRADE = "copy_trade"
    MANAGE_COPY_RELATIONSHIPS = "manage_copy_relationships"
```

---

## 🟣 Phase 9: Polymarket Integration

**Goal:** Enable trading on Polymarket prediction markets.

### 9.1 Polymarket API Client

**Files to Create:**

| File | Description |
|------|-------------|
| `app/providers/polymarket/` | Polymarket provider directory |
| `app/providers/polymarket/client.py` | PolymarketClient - API wrapper |
| `app/providers/polymarket/models.py` | Market, Position, Order, Outcome |
| `app/providers/polymarket/auth.py` | API key / wallet auth handling |

**Polymarket Client:**

```python
class PolymarketClient:
    """Client for Polymarket API (CLOB + REST)."""

    BASE_URL = "https://clob.polymarket.com"
    GAMMA_URL = "https://gamma-api.polymarket.com"

    async def get_markets(
        self,
        active: bool = True,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Market]:
        """Get list of markets."""
        pass

    async def get_market(self, condition_id: str) -> Market:
        """Get single market details."""
        pass

    async def get_orderbook(
        self,
        token_id: str,
    ) -> OrderBook:
        """Get orderbook for a market outcome."""
        pass

    async def get_positions(
        self,
        address: str,
    ) -> List[Position]:
        """Get user's positions."""
        pass

    async def place_order(
        self,
        order: OrderRequest,
        signature: str,
    ) -> OrderResult:
        """Place a limit order."""
        pass

    async def cancel_order(
        self,
        order_id: str,
        signature: str,
    ) -> bool:
        """Cancel an open order."""
        pass


class Market(BaseModel):
    """Polymarket market."""

    condition_id: str
    question: str
    description: str
    end_date: datetime

    outcomes: List[Outcome]

    # Market state
    volume_usd: Decimal
    liquidity_usd: Decimal
    is_active: bool
    is_resolved: bool
    winning_outcome: Optional[str]

    # Metadata
    category: str
    tags: List[str]
    image_url: Optional[str]


class Outcome(BaseModel):
    """Market outcome (e.g., "Yes" or "No")."""

    token_id: str
    name: str
    price: Decimal  # 0.00 to 1.00

    # For display
    implied_probability: float  # price as percentage
```

### 9.2 Polymarket Trading Service

**Files to Create:**

| File | Description |
|------|-------------|
| `app/core/polymarket/` | Polymarket trading module |
| `app/core/polymarket/trading.py` | PolymarketTradingService |
| `app/core/polymarket/positions.py` | Position tracking and P&L |
| `frontend/convex/polymarketPositions.ts` | Position storage |
| `frontend/convex/polymarketOrders.ts` | Order history |

**Trading Service:**

```python
class PolymarketTradingService:
    """Service for trading on Polymarket."""

    async def buy_outcome(
        self,
        market_id: str,
        outcome: str,  # "Yes" or "No" or custom
        amount_usd: Decimal,
        max_price: Optional[Decimal] = None,
        session_key: Optional[SessionKey] = None,
    ) -> TradeResult:
        """Buy shares of an outcome."""
        pass

    async def sell_position(
        self,
        position_id: str,
        amount_shares: Optional[Decimal] = None,  # None = sell all
        min_price: Optional[Decimal] = None,
        session_key: Optional[SessionKey] = None,
    ) -> TradeResult:
        """Sell shares of a position."""
        pass

    async def get_portfolio(
        self,
        address: str,
    ) -> PolymarketPortfolio:
        """Get user's Polymarket portfolio with P&L."""
        pass

    async def get_market_analysis(
        self,
        market_id: str,
    ) -> MarketAnalysis:
        """Get AI analysis of a market."""
        # Use LLM to analyze market question, news, sentiment
        pass
```

### 9.3 Market Discovery & Categories

```python
class MarketDiscoveryService:
    """Discover and categorize Polymarket markets."""

    CATEGORIES = [
        "politics",
        "crypto",
        "sports",
        "entertainment",
        "science",
        "economics",
        "weather",
        "current_events",
    ]

    async def get_trending_markets(
        self,
        category: Optional[str] = None,
        limit: int = 20,
    ) -> List[Market]:
        """Get trending markets by volume."""
        pass

    async def get_closing_soon(
        self,
        hours: int = 24,
    ) -> List[Market]:
        """Get markets closing within timeframe."""
        pass

    async def search_markets(
        self,
        query: str,
    ) -> List[Market]:
        """Search markets by question text."""
        pass
```

### 9.4 Agent Tools for Polymarket

```python
# Add to app/core/agent/tools.py

POLYMARKET_TOOLS = [
    ToolDefinition(
        name="get_polymarket_markets",
        description="Get prediction markets from Polymarket. Can filter by category (politics, crypto, sports, etc.) or search by query.",
        parameters=[
            ToolParameter(name="category", type=ToolParameterType.STRING, required=False),
            ToolParameter(name="query", type=ToolParameterType.STRING, required=False),
            ToolParameter(name="limit", type=ToolParameterType.INTEGER, required=False, default=10),
        ]
    ),
    ToolDefinition(
        name="get_polymarket_positions",
        description="Get user's Polymarket positions and P&L.",
        parameters=[]
    ),
    ToolDefinition(
        name="analyze_polymarket",
        description="Get AI analysis of a specific Polymarket question including relevant news and sentiment.",
        parameters=[
            ToolParameter(name="market_id", type=ToolParameterType.STRING, required=True),
        ]
    ),
]
```

---

## 🟠 Phase 10: Polymarket Copy Trading

**Goal:** Follow and copy successful Polymarket traders.

### 10.1 Polymarket Trader Tracking

**Files to Create:**

| File | Description |
|------|-------------|
| `app/services/polymarket_analytics/` | PM trader analytics |
| `app/services/polymarket_analytics/tracker.py` | Track PM trader positions |
| `app/services/polymarket_analytics/leaderboard.py` | PM trader leaderboards |
| `frontend/convex/polymarketTraders.ts` | Trader profiles |

**Trader Analytics:**

```python
class PolymarketTraderTracker:
    """Track Polymarket trader performance."""

    async def get_trader_profile(
        self,
        address: str,
    ) -> PolymarketTraderProfile:
        """Get comprehensive trader profile."""
        pass

    async def get_trader_positions(
        self,
        address: str,
    ) -> List[Position]:
        """Get trader's current positions."""
        pass

    async def get_trader_history(
        self,
        address: str,
        days: int = 30,
    ) -> List[HistoricalTrade]:
        """Get trader's trade history."""
        pass

    async def calculate_performance(
        self,
        address: str,
    ) -> PerformanceMetrics:
        """Calculate ROI, win rate, Brier score."""
        pass


class PolymarketTraderProfile(BaseModel):
    """Profile of a Polymarket trader."""

    address: str

    # Performance
    total_volume_usd: Decimal
    total_pnl_usd: Decimal
    roi_pct: float
    win_rate: float  # % of positions that were profitable

    # Prediction quality
    brier_score: float  # Lower is better (0-1)
    calibration_score: float

    # Activity
    active_positions: int
    avg_position_size_usd: Decimal
    preferred_categories: List[str]
    avg_hold_time_days: float

    # Risk
    max_single_bet_pct: float
    uses_leverage: bool
    diversification_score: float
```

### 10.2 Polymarket Copy Engine

**Files to Create:**

| File | Description |
|------|-------------|
| `app/core/polymarket/copy_trading.py` | PM copy trading logic |
| `frontend/convex/polymarketCopyConfig.ts` | Copy config storage |

**Copy Logic:**

```python
class PolymarketCopyManager:
    """Manage Polymarket copy trading."""

    async def start_copying(
        self,
        user_id: str,
        leader_address: str,
        config: PolymarketCopyConfig,
    ) -> CopyRelationship:
        """Start copying a Polymarket trader."""
        pass

    async def sync_positions(
        self,
        relationship: CopyRelationship,
    ) -> List[CopyExecution]:
        """Sync positions with leader (for new followers)."""
        pass

    async def handle_leader_trade(
        self,
        trade: PolymarketTrade,
        relationship: CopyRelationship,
    ) -> Optional[CopyExecution]:
        """Copy a trade from the leader."""
        pass


class PolymarketCopyConfig(BaseModel):
    """Config for copying a Polymarket trader."""

    leader_address: str

    # Sizing
    sizing_mode: Literal["percentage", "fixed", "proportional"]
    size_value: Decimal

    # Filters
    min_position_usd: Decimal = Decimal("5")
    max_position_usd: Optional[Decimal] = None
    category_whitelist: Optional[List[str]] = None
    category_blacklist: Optional[List[str]] = None

    # Timing
    copy_new_positions: bool = True
    copy_exits: bool = True
    sync_existing: bool = False  # Copy existing positions on start

    # Risk
    max_positions: int = 20
    max_exposure_usd: Decimal = Decimal("1000")
```

---

## 🟢 Phase 11: Yield Earning (DeFi Yield Strategies)

**Goal:** Enable users to earn yield through DeFi protocols with automated strategies.

### 11.1 Protocol Adapter Framework

**Files to Create:**

| File | Description |
|------|-------------|
| `app/providers/yield/` | Yield protocol adapters |
| `app/providers/yield/base.py` | Abstract YieldProtocol interface |
| `app/providers/yield/aave.py` | Aave adapter |
| `app/providers/yield/compound.py` | Compound adapter |
| `app/providers/yield/lido.py` | Lido staking adapter |
| `app/providers/yield/yearn.py` | Yearn vaults adapter |
| `app/providers/yield/pendle.py` | Pendle yield trading |

**Protocol Interface:**

```python
class YieldProtocol(ABC):
    """Abstract interface for yield protocols."""

    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @property
    @abstractmethod
    def supported_chains(self) -> List[str]:
        pass

    @abstractmethod
    async def get_opportunities(
        self,
        chain: str,
    ) -> List[YieldOpportunity]:
        """Get available yield opportunities."""
        pass

    @abstractmethod
    async def get_position(
        self,
        address: str,
        chain: str,
    ) -> Optional[YieldPosition]:
        """Get user's position in this protocol."""
        pass

    @abstractmethod
    async def deposit(
        self,
        opportunity_id: str,
        amount: Decimal,
        address: str,
        session_key: Optional[SessionKey] = None,
    ) -> TransactionResult:
        """Deposit into a yield opportunity."""
        pass

    @abstractmethod
    async def withdraw(
        self,
        position_id: str,
        amount: Optional[Decimal] = None,  # None = withdraw all
        address: str = None,
        session_key: Optional[SessionKey] = None,
    ) -> TransactionResult:
        """Withdraw from a position."""
        pass

    @abstractmethod
    async def claim_rewards(
        self,
        position_id: str,
        address: str,
        session_key: Optional[SessionKey] = None,
    ) -> TransactionResult:
        """Claim pending rewards."""
        pass


class YieldOpportunity(BaseModel):
    """A yield-earning opportunity."""

    id: str
    protocol: str
    chain: str

    # Asset info
    deposit_token: str  # Token to deposit
    deposit_token_address: str
    reward_tokens: List[str]  # Tokens earned as rewards

    # Yield info
    apy: float  # Current APY
    apy_base: float  # Base APY (from protocol)
    apy_reward: float  # Reward APY (from incentives)
    apy_7d_avg: float
    apy_30d_avg: float

    # Risk info
    tvl_usd: Decimal
    utilization_rate: Optional[float]
    risk_score: float  # 0 (safe) to 1 (risky)
    is_audited: bool

    # Type
    opportunity_type: Literal["lending", "staking", "lp", "vault", "fixed"]

    # Liquidity
    available_liquidity_usd: Decimal
    min_deposit_usd: Decimal
    withdrawal_delay_hours: Optional[float]  # Unstaking period


class YieldPosition(BaseModel):
    """User's position in a yield protocol."""

    id: str
    opportunity_id: str
    protocol: str
    chain: str

    # Position
    deposited_amount: Decimal
    deposited_token: str
    deposited_value_usd: Decimal

    # Earnings
    pending_rewards: List[RewardBalance]
    total_earned_usd: Decimal
    realized_apy: float  # Actual APY earned

    # Timing
    deposited_at: datetime
    last_harvest_at: Optional[datetime]
```

### 11.2 Yield Aggregation Service

**Files to Create:**

| File | Description |
|------|-------------|
| `app/services/yield/` | Yield aggregation service |
| `app/services/yield/aggregator.py` | YieldAggregator - unified view |
| `app/services/yield/optimizer.py` | YieldOptimizer - find best yields |
| `app/services/yield/risk_scorer.py` | Protocol risk assessment |

**Aggregator:**

```python
class YieldAggregator:
    """Aggregate yield opportunities across protocols."""

    def __init__(self):
        self.protocols: Dict[str, YieldProtocol] = {
            "aave": AaveAdapter(),
            "compound": CompoundAdapter(),
            "lido": LidoAdapter(),
            "yearn": YearnAdapter(),
            "pendle": PendleAdapter(),
        }

    async def get_all_opportunities(
        self,
        chains: Optional[List[str]] = None,
        min_apy: Optional[float] = None,
        max_risk: Optional[float] = None,
        deposit_token: Optional[str] = None,
    ) -> List[YieldOpportunity]:
        """Get all yield opportunities with filters."""
        pass

    async def get_best_yield(
        self,
        token: str,
        chain: str,
        amount_usd: Decimal,
    ) -> List[YieldOpportunity]:
        """Find best yield for a specific token."""
        pass

    async def get_user_positions(
        self,
        address: str,
    ) -> List[YieldPosition]:
        """Get all yield positions for a user."""
        pass

    async def get_total_yield_earned(
        self,
        address: str,
        since: Optional[datetime] = None,
    ) -> YieldSummary:
        """Calculate total yield earned across all protocols."""
        pass


class YieldOptimizer:
    """Optimize yield across protocols."""

    async def suggest_rebalance(
        self,
        current_positions: List[YieldPosition],
        available_capital: Decimal,
        risk_tolerance: float,
    ) -> List[RebalanceAction]:
        """Suggest rebalancing for better yield."""
        pass

    async def find_arbitrage(
        self,
        token: str,
    ) -> List[YieldArbitrage]:
        """Find yield arbitrage opportunities."""
        pass
```

### 11.3 Yield Strategies

**Files to Create:**

| File | Description |
|------|-------------|
| `app/core/strategies/yield/` | Yield strategy implementations |
| `app/core/strategies/yield/auto_compound.py` | Auto-compounding strategy |
| `app/core/strategies/yield/yield_farming.py` | Multi-protocol farming |
| `app/core/strategies/yield/lsd_strategy.py` | Liquid staking derivatives |

**Auto-Compound Strategy:**

```python
class AutoCompoundStrategy:
    """Automatically compound yield rewards."""

    async def check_and_compound(
        self,
        position: YieldPosition,
        min_reward_usd: Decimal = Decimal("10"),
    ) -> Optional[CompoundResult]:
        """Check if rewards should be compounded and execute."""
        # 1. Check pending rewards value
        # 2. Estimate gas cost
        # 3. Only compound if reward > gas + min threshold
        # 4. Claim and reinvest
        pass

    async def estimate_optimal_frequency(
        self,
        position: YieldPosition,
    ) -> timedelta:
        """Calculate optimal compounding frequency."""
        # Balance gas costs vs compound gains
        pass


class LSDStrategy:
    """Liquid staking derivative strategy."""

    async def stake_eth(
        self,
        amount: Decimal,
        protocol: Literal["lido", "rocketpool", "frax"] = "lido",
        session_key: Optional[SessionKey] = None,
    ) -> StakeResult:
        """Stake ETH and receive LST."""
        pass

    async def unstake(
        self,
        amount: Decimal,
        protocol: str,
        session_key: Optional[SessionKey] = None,
    ) -> UnstakeResult:
        """Unstake LST back to ETH."""
        pass

    async def get_best_lst_yield(self) -> List[LSTOpportunity]:
        """Compare yields across LST protocols."""
        pass
```

### 11.4 Session Key Permissions for Yield

```python
# Add to app/core/wallet/models.py

class Permission(str, Enum):
    # ... existing permissions ...

    # Yield permissions
    YIELD_DEPOSIT = "yield_deposit"
    YIELD_WITHDRAW = "yield_withdraw"
    YIELD_CLAIM = "yield_claim"
    YIELD_COMPOUND = "yield_compound"
```

### 11.5 Agent Tools for Yield

```python
# Add to app/core/agent/tools.py

YIELD_TOOLS = [
    ToolDefinition(
        name="get_yield_opportunities",
        description="Find yield earning opportunities across DeFi protocols. Can filter by token, chain, minimum APY, or risk level.",
        parameters=[
            ToolParameter(name="token", type=ToolParameterType.STRING, required=False),
            ToolParameter(name="chain", type=ToolParameterType.STRING, required=False),
            ToolParameter(name="min_apy", type=ToolParameterType.NUMBER, required=False),
            ToolParameter(name="max_risk", type=ToolParameterType.NUMBER, required=False),
        ]
    ),
    ToolDefinition(
        name="get_yield_positions",
        description="Get user's current yield positions across all protocols with earnings.",
        parameters=[]
    ),
    ToolDefinition(
        name="analyze_yield_protocol",
        description="Get detailed analysis of a yield protocol including risks, historical APY, and TVL trends.",
        parameters=[
            ToolParameter(name="protocol", type=ToolParameterType.STRING, required=True),
            ToolParameter(name="opportunity_id", type=ToolParameterType.STRING, required=False),
        ]
    ),
]
```

---

## 🔶 Phase 12: Shared Infrastructure Enhancements

**Goal:** Build common infrastructure needed by copy trading, Polymarket, and yield features.

### 12.1 Enhanced Event Monitoring

**Files to Create:**

| File | Description |
|------|-------------|
| `app/services/events/` | Event monitoring service |
| `app/services/events/webhook_handler.py` | Unified webhook handler |
| `app/services/events/event_processor.py` | Event classification and routing |

**Unified Event System:**

```python
class EventMonitoringService:
    """Unified event monitoring across chains and protocols."""

    async def subscribe_address(
        self,
        address: str,
        chain: str,
        event_types: List[EventType],
        callback: Callable,
    ) -> Subscription:
        """Subscribe to events for an address."""
        pass

    async def subscribe_contract(
        self,
        contract: str,
        chain: str,
        event_signatures: List[str],
        callback: Callable,
    ) -> Subscription:
        """Subscribe to contract events."""
        pass


class EventType(str, Enum):
    # Wallet events
    TRANSFER_IN = "transfer_in"
    TRANSFER_OUT = "transfer_out"
    SWAP = "swap"

    # DeFi events
    DEPOSIT = "deposit"
    WITHDRAW = "withdraw"
    BORROW = "borrow"
    REPAY = "repay"
    LIQUIDATION = "liquidation"

    # Polymarket events
    ORDER_PLACED = "order_placed"
    ORDER_FILLED = "order_filled"
    POSITION_OPENED = "position_opened"
    POSITION_CLOSED = "position_closed"
    MARKET_RESOLVED = "market_resolved"
```

### 12.2 Performance Analytics

**Files to Create:**

| File | Description |
|------|-------------|
| `app/services/analytics/` | Performance analytics |
| `app/services/analytics/pnl_calculator.py` | P&L calculation |
| `app/services/analytics/metrics.py` | ROI, Sharpe, drawdown |

**Analytics Service:**

```python
class PerformanceAnalytics:
    """Calculate performance metrics across all activity types."""

    async def calculate_pnl(
        self,
        address: str,
        activity_type: Literal["trading", "copy_trading", "polymarket", "yield"],
        period: timedelta,
    ) -> PnLReport:
        """Calculate P&L for a specific activity type."""
        pass

    async def get_portfolio_metrics(
        self,
        address: str,
    ) -> PortfolioMetrics:
        """Get comprehensive portfolio metrics."""
        return PortfolioMetrics(
            total_value_usd=...,
            daily_pnl_usd=...,
            weekly_pnl_usd=...,
            monthly_pnl_usd=...,
            roi_pct=...,
            sharpe_ratio=...,
            max_drawdown_pct=...,
            win_rate=...,
            # Breakdown by source
            trading_pnl=...,
            copy_trading_pnl=...,
            polymarket_pnl=...,
            yield_earned=...,
        )
```

### 12.3 Enhanced Notifications

```python
# Add notification types for new features

class NotificationType(str, Enum):
    # ... existing types ...

    # Copy trading
    COPY_TRADE_EXECUTED = "copy_trade_executed"
    LEADER_TRADE_SKIPPED = "leader_trade_skipped"
    COPY_LIMIT_REACHED = "copy_limit_reached"

    # Polymarket
    PM_ORDER_FILLED = "pm_order_filled"
    PM_MARKET_RESOLVING = "pm_market_resolving"
    PM_POSITION_SETTLED = "pm_position_settled"

    # Yield
    YIELD_REWARDS_READY = "yield_rewards_ready"
    YIELD_APY_CHANGED = "yield_apy_changed"
    YIELD_COMPOUNDED = "yield_compounded"
```

---

## Updated Implementation Order

| Phase | Focus | Status | Dependencies |
|-------|-------|--------|--------------|
| **Phase 1** | Database, Auth, Rate Limiting | ✅ Complete | - |
| **Phase 2.1-2.4** | Transaction Execution, Session Keys, Jupiter, LLM Tools | ✅ Complete | Phase 1 |
| **Phase 3** | Policy Engine, State Machine, Error Recovery | ✅ Complete | Phase 2 |
| **Phase 4** | Observability, Event System | 🔲 Pending | Phase 3 |
| **Phase 5** | Scaling, Circuit Breakers | 🔲 Pending | Phase 4 |
| **Phase 6** | Backtesting, Notifications | 🔲 Pending | Phase 5 |
| **Phase 7** | Token Intelligence, News | ✅ Complete | Phase 1 |
| **Phase 8** | Wallet Copy Trading | 🔲 Pending | Phase 3, 12.1 |
| **Phase 9** | Polymarket Integration | 🔲 Pending | Phase 3 |
| **Phase 10** | Polymarket Copy Trading | 🔲 Pending | Phase 8, 9 |
| **Phase 11** | Yield Earning | 🔲 Pending | Phase 3 |
| **Phase 12** | Shared Infrastructure | 🔲 Pending | - |

**Recommended Build Order for New Features:**

1. **Phase 12.1** - Event Monitoring (foundation for copy trading)
2. **Phase 8.1-8.2** - Wallet Monitoring + Copy Engine
3. **Phase 9.1-9.2** - Polymarket API + Trading
4. **Phase 11.1-11.2** - Yield Protocol Adapters
5. **Phase 8.3** - Leader Discovery
6. **Phase 10** - Polymarket Copy Trading
7. **Phase 11.3** - Yield Strategies
8. **Phase 12.2-12.3** - Analytics + Enhanced Notifications

---

## Next Steps
2. Create a new Convex project and initialize in your repo
3. Set up the Convex schema (convex/schema.ts)
4. Create the Python client for FastAPI integration
5. Implement authentication with SIWE
6. Add rate limiting (can use Convex tables for this)
7. Build transaction execution layer

### Convex Setup Commands

```bash
# In your project root, create a convex directory
npx convex init

# This will:
# - Create convex/ directory with schema.ts, tsconfig.json
# - Add convex to package.json
# - Create .env.local with CONVEX_URL

# Deploy your schema
npx convex dev  # for development (watches for changes)
npx convex deploy  # for production

# Get your deploy key for Python integration
# Go to Dashboard > Settings > Deploy Keys
```

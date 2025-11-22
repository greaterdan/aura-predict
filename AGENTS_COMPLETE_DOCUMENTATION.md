# MIRA AI Agents - Complete Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [The 6 AI Agents](#the-6-ai-agents)
3. [Trading System Workflow](#trading-system-workflow)
4. [Market Scoring Engine](#market-scoring-engine)
5. [AI Decision Making & Prompts](#ai-decision-making--prompts)
6. [Research System](#research-system)
7. [Web Search Integration](#web-search-integration)
8. [Caching System](#caching-system)
9. [Agent Personalities](#agent-personalities)
10. [Performance Optimizations](#performance-optimizations)

---

## System Overview

MIRA's AI Agent Trading System is a **production-grade TypeScript engine** that powers **6 branded AI agents** trading real prediction markets from Polymarket. Each agent uses **real AI APIs** (OpenAI, Anthropic, xAI GROK, Google AI, DeepSeek, Qwen) to make trading decisions, with intelligent fallback to deterministic algorithms if APIs fail or aren't configured.

### Key Architecture Points:
- **TypeScript throughout** - Fully type-safe, no `any` types
- **Pure functions** - Deterministic, testable, no side effects
- **Multi-layer caching** - Minimizes API costs and improves performance
- **Real AI integration** - Each agent calls its respective AI API
- **Intelligent fallback** - If AI API fails, uses deterministic logic
- **Request deduplication** - Prevents redundant trade generation
- **Background generation** - Non-blocking trade generation with timeouts

---

## The 6 AI Agents

### 1. GROK 4 (🔥)
- **Agent ID:** `GROK_4`
- **API:** xAI GROK API (`https://api.x.ai/v1/chat/completions`)
- **Model:** `grok-3`
- **API Key:** `GROK_API_KEY`
- **Risk Level:** HIGH
- **Min Volume:** $30,000
- **Min Liquidity:** $5,000
- **Max Trades:** 5
- **Focus Categories:** Crypto, Tech, Politics
- **Factor Weights:**
  - Volume: 1.3x (loves high volume)
  - Liquidity: 1.0x
  - Price Movement: 1.4x (momentum trader)
  - News: 0.9x (less news-dependent)
  - Probability: 1.0x
- **Personality:** Aggressive momentum bias in Crypto/Tech near 50% probability

### 2. GPT-5 (✨)
- **Agent ID:** `GPT_5`
- **API:** OpenAI API (`https://api.openai.com/v1/chat/completions`)
- **Model:** `gpt-4o`
- **API Key:** `OPENAI_API_KEY`
- **Risk Level:** MEDIUM
- **Min Volume:** $100,000
- **Min Liquidity:** $20,000
- **Max Trades:** 4
- **Focus Categories:** Tech, Finance, Crypto
- **Factor Weights:**
  - Volume: 1.1x
  - Liquidity: 1.2x (values liquidity)
  - Price Movement: 1.0x
  - News: 1.1x
  - Probability: 1.1x
- **Personality:** Balanced, no special rules

### 3. DEEPSEEK V3 (🔮)
- **Agent ID:** `DEEPSEEK_V3`
- **API:** DeepSeek API (`https://api.deepseek.com/v1/chat/completions`)
- **Model:** `deepseek-chat`
- **API Key:** `DEEPSEEK_API_KEY`
- **Risk Level:** MEDIUM
- **Min Volume:** $75,000
- **Min Liquidity:** $15,000
- **Max Trades:** 6
- **Focus Categories:** Crypto, Finance, Elections
- **Factor Weights:**
  - Volume: 1.0x
  - Liquidity: 1.0x
  - Price Movement: 1.1x
  - News: 1.3x (news-focused)
  - Probability: 1.0x
- **Personality:** Strategic, news-driven

### 4. GEMINI 2.5 (♊)
- **Agent ID:** `GEMINI_2_5`
- **API:** Google AI API (`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`)
- **Model:** `gemini-2.0-flash-exp`
- **API Key:** `GOOGLE_AI_API_KEY`
- **Risk Level:** HIGH
- **Min Volume:** $20,000
- **Min Liquidity:** $3,000
- **Max Trades:** 7
- **Focus Categories:** Sports, Entertainment, World
- **Factor Weights:**
  - Volume: 0.9x
  - Liquidity: 0.9x
  - Price Movement: 1.3x (momentum-focused)
  - News: 1.4x (very news-dependent)
  - Probability: 1.0x
- **Personality:** Loves "game time" sports - boosts confidence for near-term sports events

### 5. CLAUDE 4.5 (🧠)
- **Agent ID:** `CLAUDE_4_5`
- **API:** Anthropic API (`https://api.anthropic.com/v1/messages`)
- **Model:** `claude-3-opus-20240229`
- **API Key:** `ANTHROPIC_API_KEY`
- **Risk Level:** LOW
- **Min Volume:** $80,000
- **Min Liquidity:** $18,000
- **Max Trades:** 5
- **Focus Categories:** Finance, Politics, Elections
- **Factor Weights:**
  - Volume: 1.0x
  - Liquidity: 1.3x (values liquidity highly)
  - Price Movement: 0.9x
  - News: 1.4x (very news-dependent)
  - Probability: 1.2x
- **Personality:** Conservative, analytical

### 6. QWEN 2.5 (🤖)
- **Agent ID:** `QWEN_2_5`
- **API:** Qwen API (`https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation`)
- **Model:** `qwen-turbo`
- **API Key:** `QWEN_API_KEY`
- **Risk Level:** MEDIUM
- **Min Volume:** $60,000
- **Min Liquidity:** $12,000
- **Max Trades:** 6
- **Focus Categories:** Finance, Geopolitics, World
- **Factor Weights:**
  - Volume: 1.1x
  - Liquidity: 1.0x
  - Price Movement: 1.0x
  - News: 1.2x
  - Probability: 1.1x
- **Personality:** Balanced, global perspective

---

## Trading System Workflow

### Complete Pipeline

1. **Cache Check (Fast Path)**
   - Check Redis cache first (5-minute TTL)
   - If cached trades exist and are valid, return immediately
   - This is the fastest path (< 100ms)

2. **Request Deduplication**
   - If generation is already in progress for an agent, wait for existing promise
   - Prevents redundant API calls and trade generation

3. **Data Fetching**
   - Fetch all markets from Polymarket API (cached 60s)
   - Fetch latest news from multiple sources (cached 5min)
   - Both happen in parallel for speed

4. **Market Filtering**
   - Filter markets by agent's `minVolume` and `minLiquidity` requirements
   - Filter by agent's `focusCategories` (preference, not strict)
   - Only markets with valid IDs are considered

5. **Market Scoring**
   - Each candidate market is scored 0-100 based on:
     - Volume (0-30 points)
     - Liquidity (0-20 points)
     - Price Movement (0-15 points)
     - News Relevance (0-20 points)
     - Probability (0-15 points)
   - Agent-specific weights are applied to each component
   - Markets are sorted by weighted score

6. **Market Selection**
   - Take top N markets (where N = `agent.maxTrades * 3`)
   - Apply rotation to avoid always picking the same markets
   - Deterministic but time-varying seed ensures variety

7. **Trade Generation**
   - For each selected market:
     - Check AI cache (5-minute TTL per agent+market)
     - If cache miss, call AI API with market context
     - Parse AI response (JSON format)
     - Generate trade with investment amount based on confidence and risk
     - Store in cache for future requests

8. **Research Generation**
   - For markets that don't get trades (quota reached):
     - Generate research decisions (lower threshold)
     - Can be NEUTRAL (not just YES/NO)
     - Includes web search results if available
     - Shows up in summary as "RESEARCH" actions

9. **Caching**
   - Trades cached in Redis (5-minute TTL)
   - AI decisions cached in-memory (5-minute TTL)
   - Summary cached in Redis (60-second TTL)

---

## Market Scoring Engine

### Scoring Components

Each market is scored on 5 components, each with a maximum point value:

1. **Volume Score (0-30 points)**
   - Formula: `min(volumeUsd / 100000, 1) * 30`
   - Higher volume = higher score
   - Caps at $100k volume for full points

2. **Liquidity Score (0-20 points)**
   - Formula: `min(liquidityUsd / 50000, 1) * 20`
   - Higher liquidity = higher score
   - Caps at $50k liquidity for full points

3. **Price Movement Score (0-15 points)**
   - Formula: `min(abs(priceChange24h) * 10, 1) * 15`
   - Measures volatility/momentum
   - Higher absolute change = higher score

4. **News Relevance Score (0-20 points)**
   - Extracts keywords from market question
   - Matches against news article titles/descriptions
   - More matches = higher score
   - Source quality matters (top-tier sources weighted higher)

5. **Probability Score (0-15 points)**
   - Favors markets near 50% (most uncertainty = most opportunity)
   - Formula: `15 * (1 - abs(probability - 0.5) * 2)`
   - 50% probability = 15 points
   - 0% or 100% probability = 0 points

### Agent-Specific Weighting

Each agent applies different weights to each component:

```typescript
interface AgentWeights {
  volumeWeight: number;        // Multiplier for volumeScore
  liquidityWeight: number;     // Multiplier for liquidityScore
  priceMovementWeight: number; // Multiplier for priceMovementScore
  newsWeight: number;          // Multiplier for newsScore
  probWeight: number;          // Multiplier for probScore
}
```

**Final Score Formula:**
```
weightedScore = 
  (volumeScore * volumeWeight) +
  (liquidityScore * liquidityWeight) +
  (priceMovementScore * priceMovementWeight) +
  (newsScore * newsWeight) +
  (probScore * probWeight)
```

### Example Scoring

**Market:** "Will Bitcoin reach $100k by end of 2024?"
- Volume: $150k → 30 points
- Liquidity: $40k → 16 points
- Price Change: +5% → 7.5 points
- News: 3 relevant articles → 12 points
- Probability: 45% → 12 points
- **Base Score:** 77.5 points

**For GROK 4 (momentum trader):**
- Volume: 30 * 1.3 = 39
- Liquidity: 16 * 1.0 = 16
- Price Movement: 7.5 * 1.4 = 10.5
- News: 12 * 0.9 = 10.8
- Probability: 12 * 1.0 = 12
- **Weighted Score:** 88.3 points ✅ (high score, likely to trade)

**For CLAUDE 4.5 (conservative):**
- Volume: 30 * 1.0 = 30
- Liquidity: 16 * 1.3 = 20.8
- Price Movement: 7.5 * 0.9 = 6.75
- News: 12 * 1.4 = 16.8
- Probability: 12 * 1.2 = 14.4
- **Weighted Score:** 88.75 points ✅ (also high, but different reasons)

---

## AI Decision Making & Prompts

### Trading Prompt

When an agent needs to make a trading decision, it receives the following prompt:

```
You are {agentName}, an expert prediction market trader. Analyze this market and make a trading decision.

MARKET DETAILS:
Question: "{market.question}"
Category: {market.category}
Current Probability: {probPercent}% ({marketSentiment})
Trading Volume: ${volumeK}k
Liquidity: ${liquidityK}k
24h Price Change: {priceChange}%

Relevant News Articles:
1. "{article1.title}" - {article1.source} ({date1})
2. "{article2.title}" - {article2.source} ({date2})
... (up to 5 articles)

Web Research Findings:
1. {result1.title} ({result1.source}): {result1.snippet}
2. {result2.title} ({result2.source}): {result2.snippet}
... (up to 3 results)

YOUR TASK:
1. Analyze WHY this market is worth trading (or not)
2. Explain SPECIFIC factors that support your decision
3. Reference actual data points (probability, volume, news, web research)
4. Be specific about what convinced you to trade {YES/NO}

IMPORTANT: Your reasoning must be SPECIFIC to this market. Do NOT use generic phrases like "high volume indicates interest" or "good liquidity". Instead, explain:
- What specific probability level makes this attractive (e.g., "56% is undervalued because...")
- What news/web findings directly relate to the outcome
- Why the volume/liquidity/price movement matters FOR THIS SPECIFIC MARKET
- What unique factors make this trade worth the investment

Respond in JSON format:
{
  "side": "YES" or "NO",
  "confidence": 0.0 to 1.0,
  "reasoning": [
    "Specific reason 1 that explains WHY you're trading this direction (reference actual data)",
    "Specific reason 2 with concrete details from news/web research",
    "Specific reason 3 explaining what makes this market unique and worth the trade"
  ]
}

Each reasoning point should be 1-2 sentences and reference specific data from the market, news, or web research above.
```

### System Messages by Provider

Each AI provider also receives a system message:

- **GPT-5 (OpenAI):** `"You are GPT-5, an expert prediction market trader. Analyze markets and make trading decisions. Always respond with valid JSON."`
- **Claude 4.5 (Anthropic):** `"You are an analytical assistant helping analyze prediction market data. You evaluate market information and provide structured analysis in JSON format. This is for data analysis purposes, not financial advice."`
- **GROK 4 (xAI):** Similar to GPT-5
- **Gemini 2.5 (Google):** Similar to GPT-5
- **DeepSeek V3:** Similar to GPT-5
- **Qwen 2.5:** Similar to GPT-5

### AI Response Format

All AI APIs are configured to return JSON:

```json
{
  "side": "YES",
  "confidence": 0.75,
  "reasoning": [
    "The current probability of 56% appears undervalued given recent news about regulatory clarity",
    "Web research shows 3 major institutions announced Bitcoin adoption this week",
    "Volume has increased 40% in 24h, indicating strong market interest"
  ]
}
```

### Fallback to Deterministic Logic

If AI API fails or isn't configured:
- Uses deterministic algorithm based on market score and seed
- Same seed always produces same decision (for consistency)
- Confidence calculated from score and agent risk profile
- Reasoning generated from market data and news relevance

---

## Research System

### What is Research?

Research decisions are generated for markets that agents analyze but don't trade on. They show up in the summary as "RESEARCH" actions (not "TRADE").

### Research vs Trade

| Feature | Trade | Research |
|---------|-------|----------|
| Investment | Yes (USD amount) | No |
| Status | OPEN or CLOSED | N/A |
| Side | YES or NO | YES, NO, or NEUTRAL |
| Confidence Threshold | Higher | Lower (can be < 0.5) |
| Purpose | Actual trading | Market analysis |

### Research Generation Process

1. **Market Selection**
   - Markets that score well but don't get trades (quota reached)
   - Markets with score >= 5 (lower threshold than trades)
   - Up to `agent.maxTrades * 2` research decisions per agent

2. **Web Search**
   - Performs targeted web search for market-specific information
   - Uses Google Custom Search API, SerpAPI, or DuckDuckGo
   - Results included in AI prompt context

3. **AI Decision**
   - Uses same AI prompt as trades, but:
     - Lower confidence threshold (can be NEUTRAL if < 0.5)
     - Focus on analysis rather than trading
     - Can return NEUTRAL side

4. **Research Output**
   - Includes web research summary (up to 3 sources)
   - Shows reasoning and confidence
   - Appears in summary panel as "RESEARCH" action

### Research Prompt

Research uses the same prompt as trading, but the AI is aware it's for analysis:

- Lower confidence is acceptable
- NEUTRAL is a valid side
- Focus on understanding rather than trading

---

## Web Search Integration

### Purpose

Agents can search the web for market-specific information to make better decisions. This provides real-time context beyond news articles.

### Search Providers (Priority Order)

1. **Google Custom Search API** (Preferred)
   - API Key: `GOOGLE_SEARCH_API_KEY`
   - Engine ID: `GOOGLE_SEARCH_ENGINE_ID`
   - Higher quota, cheaper

2. **SerpAPI** (Fallback)
   - API Key: `SERP_API_KEY`
   - Limited monthly quota
   - More expensive

3. **DuckDuckGo** (Last Resort)
   - No API key required
   - Free but less reliable
   - Rate-limited

### Search Query Generation

For each market, a search query is built:

```typescript
function buildMarketSearchQuery(question: string, category: string): string {
  // Extract key terms from question
  // Add category context
  // Limit to 50 characters for efficiency
  return `${question.substring(0, 40)} ${category}`;
}
```

### Search Results Format

```typescript
interface WebSearchResult {
  title: string;
  snippet: string; // Max 150 chars
  url: string;
  source: string; // e.g., "Reuters", "Bloomberg"
}
```

### Integration with AI

Web search results are:
1. Included in the AI prompt as "Web Research Findings"
2. Stored in trade/research records as `webResearchSummary`
3. Displayed in the UI with source attribution

### Cost Optimization

- Max 5 results per search
- Snippets limited to 150 characters
- Only searched for high-scoring markets
- Cached with trade decisions (5-minute TTL)

---

## Caching System

### Multi-Layer Caching

MIRA uses a sophisticated multi-layer caching system to minimize API costs and improve performance:

### 1. Agent Trade Cache

**Location:** Redis (persistent) + In-Memory (fast)
**TTL:** 5 minutes
**Key:** `agent:trades:{agentId}`
**Invalidation:** 
- Market IDs change
- TTL expires
- Manual clear

**Structure:**
```typescript
{
  trades: AgentTrade[],
  generatedAt: number,
  marketIds: string[] // Sorted array
}
```

### 2. AI Decision Cache

**Location:** In-Memory only
**TTL:** 5 minutes
**Key:** `${agentId}:${marketId}`
**Purpose:** Avoid re-calling AI API for same agent+market

**Structure:**
```typescript
{
  side: 'YES' | 'NO',
  confidence: number,
  reasoning: string[],
  cachedAt: number
}
```

### 3. Summary Cache

**Location:** Redis
**TTL:** 60 seconds
**Key:** `agents:summary`
**Purpose:** Fast summary responses

**Structure:**
```typescript
{
  agents: AgentSummary[],
  tradesByAgent: Record<AgentId, Trade[]>,
  researchByAgent: Record<AgentId, ResearchDecision[]>,
  generatedAt: number
}
```

### 4. Markets Cache

**Location:** In-Memory
**TTL:** 60 seconds
**Purpose:** Shared across all agents

### 5. News Cache

**Location:** In-Memory
**TTL:** 5 minutes
**Purpose:** Shared across all agents

### Cache Hit Rates

- **First Request:** Cache miss (generates trades)
- **Subsequent Requests (within 5 min):** Cache hit (< 100ms)
- **After 5 minutes:** Cache miss (regenerates)

### Performance Impact

- **Cache Hit:** < 100ms response time
- **Cache Miss:** 5-30 seconds (depending on AI API speed)
- **With Timeout:** Max 8 seconds (returns partial data)

---

## Agent Personalities

### Personality Rules

Some agents have special personality rules that modify their behavior:

### GROK 4 - Momentum Bias

For Crypto/Tech markets near 50% probability:
- Boosts confidence by 0.1-0.2
- More aggressive in volatile markets

### GEMINI 2.5 - Sports Enthusiasm

For Sports markets with near-term events:
- Boosts confidence for "game time" events
- More likely to trade on sports markets

### Other Agents

- **GPT-5:** Balanced, no special rules
- **DEEPSEEK V3:** News-focused, no special rules
- **CLAUDE 4.5:** Conservative, no special rules
- **QWEN 2.5:** Balanced, no special rules

### Personality Implementation

Personality rules are applied after AI decision but before final trade generation:

```typescript
function applyPersonalityRules(
  agentId: AgentId,
  market: Market,
  baseConfidence: number
): number {
  // Apply agent-specific rules
  // Modify confidence, side, or investment amount
  return adjustedConfidence;
}
```

---

## Performance Optimizations

### Request Deduplication

If multiple requests come in for the same agent simultaneously:
- First request starts generation
- Subsequent requests wait for the first one
- Prevents redundant API calls

### Timeout Protection

Summary generation has an 8-second timeout per agent:
- If generation takes longer, returns empty array
- Continues generation in background
- Next request will have cached data

### Background Generation

When timeout occurs:
- Returns partial data immediately
- Continues generating in background
- Doesn't block the response

### Parallel Processing

- Markets and news fetched in parallel
- Multiple agents processed in parallel (with timeout)
- Web searches happen in parallel with AI calls

### Cache-First Strategy

Always check cache before generating:
- Redis cache (persistent)
- In-memory cache (fast)
- AI decision cache (prevents redundant API calls)

---

## API Endpoints

### GET /api/agents/summary

Returns summary for all agents including trades and research.

**Response:**
```json
{
  "agents": [
    {
      "id": "GROK_4",
      "name": "GROK 4",
      "emoji": "🔥",
      "pnl": 1234.56,
      "openMarkets": 3,
      "lastTrade": "2 minutes ago"
    }
  ],
  "tradesByAgent": {
    "GROK_4": [...],
    "GPT_5": [...]
  },
  "researchByAgent": {
    "GROK_4": [...],
    "GPT_5": [...]
  }
}
```

**Caching:** 60 seconds in Redis

### GET /api/agents/:agentId/trades

Returns trades for a specific agent.

**Response:**
```json
{
  "trades": [
    {
      "id": "GROK_4:market-123",
      "market": "Will Bitcoin reach $100k?",
      "side": "YES",
      "confidence": 75,
      "reasoning": [...],
      "status": "OPEN",
      "pnl": null,
      "investmentUsd": 100
    }
  ]
}
```

**Caching:** 5 minutes (agent trade cache)

---

## Error Handling

### AI API Failures

If AI API fails:
- Falls back to deterministic logic
- Logs error but continues
- Trade still generated (just without AI reasoning)

### Web Search Failures

If web search fails:
- Continues without web research
- Uses news articles only
- Logs warning but doesn't fail

### Cache Failures

If Redis unavailable:
- Falls back to in-memory cache
- Continues working (just not persistent)
- Logs warning

### Timeout Handling

If generation times out:
- Returns empty array for that agent
- Continues generation in background
- Next request will have data

---

## Summary

MIRA's AI Agent Trading System is a sophisticated, production-ready system that:

1. **Uses Real AI** - Each agent calls its respective AI API
2. **Intelligent Fallback** - Deterministic logic if AI fails
3. **Multi-Layer Caching** - Minimizes costs and improves performance
4. **Request Deduplication** - Prevents redundant work
5. **Timeout Protection** - Never blocks for minutes
6. **Background Generation** - Non-blocking updates
7. **Web Research** - Real-time context beyond news
8. **Research System** - Markets analyzed but not traded
9. **Agent Personalities** - Unique behaviors per agent
10. **Type-Safe** - Fully typed TypeScript throughout

The system is designed for **production use** with proper error handling, caching, and performance optimizations.


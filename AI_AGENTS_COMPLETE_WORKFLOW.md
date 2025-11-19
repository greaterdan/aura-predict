# AI AGENTS COMPLETE WORKFLOW - EVERY SINGLE DETAIL

## Table of Contents
1. [System Overview](#system-overview)
2. [The 6 AI Agents](#the-6-ai-agents)
3. [Complete Data Flow](#complete-data-flow)
4. [Market Fetching Process](#market-fetching-process)
5. [News Aggregation Process](#news-aggregation-process)
6. [Market Scoring Engine](#market-scoring-engine)
7. [AI Decision Making](#ai-decision-making)
8. [Trade Generation Process](#trade-generation-process)
9. [Caching System](#caching-system)
10. [API Endpoints](#api-endpoints)
11. [Personality Rules](#personality-rules)
12. [Adaptive Tuning](#adaptive-tuning)
13. [Portfolio Management](#portfolio-management)
14. [Trade Lifecycle](#trade-lifecycle)
15. [Error Handling & Fallbacks](#error-handling--fallbacks)

---

## System Overview

The AI Agent Trading System is a **production-grade TypeScript engine** that powers **6 branded AI agents** trading real prediction markets from Polymarket. Each agent uses **real AI APIs** (OpenAI, Anthropic, xAI GROK, Google AI, DeepSeek, Qwen) to make trading decisions, with intelligent fallback to deterministic algorithms if APIs fail or aren't configured.

### Key Architecture Points:
- **TypeScript throughout** - No `any` types, fully type-safe
- **Pure functions** - Deterministic, testable, no side effects
- **Multi-layer caching** - Minimizes API costs and improves performance
- **Same API structure as bubble maps** - Uses `fetchAllMarkets()` from `server/services/polymarketService.js`
- **Real AI integration** - Each agent calls its respective AI API
- **Intelligent fallback** - If AI API fails, uses deterministic logic
- **Modular design** - Each component has a single responsibility

---

## The 6 AI Agents

### 1. GROK 4 (🔥)
- **Agent ID:** `GROK_4`
- **API:** xAI GROK API (`https://api.x.ai/v1/chat/completions`)
- **Model:** `grok-3`
- **API Key:** `GROK_API_KEY`
- **Risk Level:** HIGH
- **Min Volume:** $50,000
- **Min Liquidity:** $10,000
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
- **Min Volume:** $30,000
- **Min Liquidity:** $5,000
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
  - Liquidity: 1.3x (very liquidity-focused)
  - Price Movement: 0.9x (less momentum-focused)
  - News: 1.4x (news-driven)
  - Probability: 1.2x (probability-focused)
- **Personality:** Skeptical of crowded, one-sided political markets - reduces confidence for extremely one-sided political markets with high news coverage

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
- **Personality:** Balanced, no special rules

---

## Complete Data Flow

### When a User Requests Agent Trades (`GET /api/agents/:agentId/trades`):

```
1. API Endpoint Receives Request
   └─> server/api/agents.js::getAgentTrades()
   └─> Maps frontend ID (e.g., "grok") to backend ID ("GROK_4")
   └─> Validates agent ID

2. Generate Agent Trades
   └─> src/lib/agents/generator.ts::generateAgentTrades(agentId)
   
3. Check Agent Trade Cache (Layer 2)
   └─> src/lib/agents/cache.ts::getCachedAgentTrades()
   └─> Cache Key: agentId
   └─> TTL: 2 minutes
   └─> If cache valid AND market IDs match → RETURN CACHED TRADES
   
4. Fetch Data Sources (Parallel)
   ├─> Fetch Markets
   │   └─> src/lib/markets/polymarket.ts::fetchAllMarkets()
   │       ├─> Check Market Cache (Layer 3)
   │       │   └─> TTL: 60 seconds
   │       │   └─> If cache valid → RETURN CACHED MARKETS
   │       └─> If cache expired/missing:
   │           └─> server/services/polymarketService.js::fetchAllMarkets()
   │               └─> Uses: POLYMARKET_API_KEY, POLYMARKET_SECRET, POLYMARKET_PASSPHRASE
   │               └─> Fetches up to 5 pages (5000 markets)
   │               └─> Maps to Market[] format
   │               └─> Updates cache
   │
   └─> Fetch News
       └─> src/lib/news/aggregator.ts::fetchLatestNews()
           ├─> Check News Cache
           │   └─> TTL: 5 minutes
           │   └─> If cache valid → RETURN CACHED NEWS
           └─> If cache expired/missing:
               ├─> Get configured news providers from env vars
               ├─> Fetch from all providers in parallel (Promise.allSettled)
               │   ├─> NewsAPI (NEWS_API_KEY)
               │   ├─> NewsData.io (NEWSDATA_API_KEY)
               │   ├─> GNews (GNEWS_API_KEY)
               │   ├─> World News API (WORLD_NEWS_API_KEY)
               │   └─> Mediastack (MEDIASTACK_API_KEY)
               ├─> Deduplicate by title
               └─> Update cache

5. Filter Candidate Markets
   └─> src/lib/agents/scoring.ts::filterCandidateMarkets()
   └─> Filters by:
       ├─> volumeUsd >= agent.minVolume
       ├─> liquidityUsd >= agent.minLiquidity
       └─> If agent has focusCategories:
           ├─> Prefer markets in focus categories
           └─> If not enough focus markets, fall back to all categories

6. Score All Candidate Markets
   └─> For each candidate market:
       └─> src/lib/agents/scoring.ts::scoreMarketForAgent()
           ├─> Compute base component scores:
           │   ├─> Volume Score (0-30)
           │   ├─> Liquidity Score (0-20)
           │   ├─> Price Movement Score (0-15)
           │   ├─> News Score (0-25) - RECENCY-WEIGHTED
           │   └─> Probability Score (0-10)
           └─> Apply agent-specific weights:
               └─> src/lib/agents/scoring.ts::computeWeightedTotalScore()
                   ├─> Multiply each component by agent's weight
                   ├─> Sum weighted components
                   ├─> Normalize by sum of weights
                   └─> Optionally apply adaptive category bias

7. Sort Markets by Score
   └─> Sort scoredMarkets descending by score
   └─> Take top (agent.maxTrades * 2) markets

8. Generate Trades for Top Markets
   └─> For each top market (until we have agent.maxTrades trades):
       └─> src/lib/agents/generator.ts::generateTradeForMarket() [MISSING FILE - NEEDS IMPLEMENTATION]
           ├─> Skip if score < 45
           ├─> Create deterministic seed: `${agentId}:${marketId}:${index}`
           │
           ├─> AI DECISION PATH (if AI API configured):
           │   ├─> Check AI Cache (Layer 1)
           │   │   └─> src/lib/agents/ai-cache.ts::getCachedAIDecision()
           │   │       └─> Cache Key: `${agentId}:${marketId}`
           │   │       └─> TTL: 5 minutes
           │   │       └─> If cache valid → USE CACHED DECISION
           │   │
           │   └─> If cache miss:
           │       └─> src/lib/agents/ai-clients.ts::getAITradeDecision()
           │           ├─> Filter relevant news articles (keyword matching)
           │           ├─> Build market context:
           │           │   ├─> question, category, probability
           │           │   ├─> volume, liquidity, priceChange24h
           │           │   └─> relevantNews (top 5)
           │           ├─> Build AI prompt with market context
           │           ├─> Call agent's AI API:
           │           │   ├─> GROK_4 → callGroq() → xAI API
           │           │   ├─> GPT_5 → callOpenAI() → OpenAI API
           │           │   ├─> CLAUDE_4_5 → callAnthropic() → Anthropic API
           │           │   ├─> GEMINI_2_5 → callGoogleAI() → Google AI API
           │           │   ├─> DEEPSEEK_V3 → callDeepSeek() → DeepSeek API
           │           │   └─> QWEN_2_5 → callQwen() → Qwen API
           │           ├─> Parse AI response (extract JSON from markdown if needed)
           │           ├─> Validate response format
           │           ├─> Cache AI decision
           │           └─> Return: { side, confidence, reasoning }
           │
           ├─> FALLBACK PATH (if AI API not configured or fails):
           │   └─> Deterministic logic:
           │       ├─> Side: Based on probability and market score
           │       ├─> Confidence: Based on score and risk level
           │       └─> Reasoning: Based on market components
           │
           ├─> Apply Risk Adjustment to Confidence:
           │   ├─> If HIGH risk → confidence * 1.05 (max 0.95)
           │   ├─> If LOW risk → confidence * 0.9 (min 0.4)
           │   └─> If MEDIUM risk → no adjustment
           │
           ├─> Apply Personality Rules:
           │   └─> src/lib/agents/personality.ts::applyPersonalityRules()
           │       ├─> Get agent's personality rules
           │       ├─> For each rule:
           │       │   └─> Apply rule to context
           │       │       └─> May modify: side, confidence, sizeUsd
           │       └─> Return final personality-adjusted decision
           │
           ├─> Determine Trade Status:
           │   ├─> OPEN: New trade
           │   └─> CLOSED: If market resolved or deterministic logic says so
           │
           ├─> Calculate PnL (if CLOSED):
           │   └─> Based on side, entry probability, exit probability
           │
           ├─> Generate Timestamps:
           │   ├─> openedAt: Deterministic based on seed
           │   └─> closedAt: If CLOSED, deterministic based on seed
           │
           ├─> Generate Summary Decision:
           │   └─> 1-2 sentence explanation of trade
           │
           └─> Create AgentTrade object:
               ├─> id: `${agentId}:${marketId}` (deterministic)
               ├─> agentId, marketId, side, confidence, score
               ├─> reasoning (array of strings)
               ├─> status, pnl, openedAt, closedAt
               ├─> summaryDecision, seed
               └─> RETURN trade

9. Cache Agent Trades (Layer 2)
   └─> src/lib/agents/cache.ts::setCachedAgentTrades()
   └─> Store trades with current market IDs
   └─> TTL: 2 minutes

10. Return Trades to API
    └─> Map trades to frontend format
    └─> Return JSON response

```

---

## Market Fetching Process

### Location: `src/lib/markets/polymarket.ts`

**Function:** `fetchAllMarkets(): Promise<Market[]>`

**Process:**
1. **Check Cache First**
   - Cache stored in memory: `marketCache`
   - TTL: 60 seconds (`MARKET_CACHE_TTL`)
   - If cache exists and age < 60s → return cached markets immediately

2. **If Cache Expired/Missing:**
   - **Server-side (Node.js):**
     - Import `fetchAllMarkets` from `server/services/polymarketService.js`
     - Call with params:
       ```typescript
       {
         category: null,
         active: true,
         maxPages: 5,        // Fetch up to 5000 markets
         limitPerPage: 1000
       }
       ```
     - Uses **SAME API keys as bubble maps:**
       - `POLYMARKET_API_KEY`
       - `POLYMARKET_SECRET`
       - `POLYMARKET_PASSPHRASE`
     - Maps raw Polymarket response to `Market[]` format:
       ```typescript
       {
         id: conditionId,
         question: market.question,
         category: mappedCategory,
         volumeUsd: volume,
         liquidityUsd: liquidity,
         currentProbability: probability,
         priceChange24h: 0,
         raw: actualMarket
       }
       ```
     - Filters out invalid markets (missing id, question, or NaN values)
     - Updates cache with new markets

   - **Client-side fallback (shouldn't happen):**
     - Uses `POLYMARKET_API_URL` or default URL
     - Uses `POLYMARKET_API_KEY` if available
     - Fetches via fetch API
     - Maps and caches results

3. **Error Handling:**
   - If API fails → return stale cache if available
   - If no cache → return empty array
   - Never throws - always returns array

**Cache Structure:**
```typescript
interface MarketCache {
  markets: Market[];
  cachedAt: number; // timestamp
}
```

---

## News Aggregation Process

### Location: `src/lib/news/aggregator.ts`

**Function:** `fetchLatestNews(): Promise<NewsArticle[]>`

**Process:**
1. **Check Cache First**
   - Cache stored in memory: `newsCache`
   - TTL: 5 minutes (`NEWS_REFRESH_MS`)
   - If cache exists and age < 5min → return cached articles immediately

2. **If Cache Expired/Missing:**
   - **Get Configured Providers:**
     - Checks environment variables for API keys:
       - `NEWS_API_KEY` → NewsAPI.org
       - `NEWSDATA_API_KEY` → NewsData.io
       - `GNEWS_API_KEY` → GNews
       - `WORLD_NEWS_API_KEY` → World News API
       - `MEDIASTACK_API_KEY` → Mediastack
     - Only includes providers with API keys set

   - **Fetch from All Providers in Parallel:**
     - Uses `Promise.allSettled()` to fetch from all providers simultaneously
     - Each provider has 10-second timeout
     - Each provider uses different query parameters:
       - **NewsAPI:** `q=prediction OR election OR cryptocurrency...`, `pageSize=20`
       - **NewsData.io:** `q=prediction OR election OR cryptocurrency`, `size=10`
       - **GNews:** `q=prediction OR election OR cryptocurrency`, `max=10`
       - **World News API:** `text=prediction OR election OR cryptocurrency`, `number=10`
       - **Mediastack:** `keywords=prediction,election,cryptocurrency`, `limit=10`

   - **Map Provider Responses:**
     - Each provider returns different response structure
     - Maps to unified `NewsArticle` format:
       ```typescript
       {
         id: `${providerName}:${url}`,
         title: article.title,
         description: article.description,
         content: article.content,
         source: article.source.name || providerName,
         publishedAt: article.publishedAt || article.pubDate,
         url: article.url,
         sourceApi: providerName
       }
       ```

   - **Collect All Articles:**
     - Combines articles from all successful providers
     - Logs errors for failed providers (doesn't fail entire fetch)

   - **Deduplicate:**
     - Removes duplicates by normalized title (lowercase, trimmed)
     - Keeps first occurrence of each unique title

   - **Update Cache:**
     - Stores deduplicated articles with timestamp

3. **Error Handling:**
   - If all providers fail → return stale cache if available
   - If no cache → return empty array
   - Never throws - always returns array

**Cache Structure:**
```typescript
interface NewsCache {
  articles: NewsArticle[];
  cachedAt: number; // timestamp
}
```

---

## Market Scoring Engine

### Location: `src/lib/agents/scoring.ts`

**Function:** `scoreMarketForAgent(market, articles, agent, now, adaptiveConfig?): ScoredMarket`

**Process:**

### Step 1: Compute Base Component Scores

Each component is scored independently on a fixed scale:

1. **Volume Score (0-30)**
   - Formula: `Math.min(volumeUsd / 100000, 1) * 30`
   - Max score at $100k+ volume
   - Example: $50k volume = 15 points

2. **Liquidity Score (0-20)**
   - Formula: `Math.min(liquidityUsd / 50000, 1) * 20`
   - Max score at $50k+ liquidity
   - Example: $25k liquidity = 10 points

3. **Price Movement Score (0-15)**
   - Formula: `Math.min(Math.abs(priceChange24h) * 10, 1) * 15`
   - Based on absolute 24h price change
   - Max score at 10%+ movement
   - Example: 5% movement = 7.5 points

4. **News Score (0-25) - RECENCY-WEIGHTED**
   - Uses `computeRecencyWeightedNewsScore()`:
     - Extracts keywords from market question (words >= 4 chars, filters common words)
     - For each matching news article:
       - **Recency Weight:**
         - Last hour: 1.0
         - 1-6 hours: 0.7
         - 6-24 hours: 0.4
         - 1-3 days: 0.25
         - Older: 0.1
       - **Source Quality Weight:**
         - TOP_TIER (Reuters, Bloomberg, etc.): 1.0
         - MAJOR (CNN, BBC, etc.): 0.8
         - LONG_TAIL (small blogs): 0.5
       - Contribution = recency * sourceQuality
     - Sums all contributions
     - Applies soft cap at 6.0 raw intensity
     - Converts to 0-25 score: `(rawIntensity / 6.0) * 25`

5. **Probability Score (0-10)**
   - Formula: `(1 - Math.abs(probability - 0.5) * 2) * 10`
   - Markets near 50% get highest score (most tradeable)
   - Example: 50% prob = 10 points, 60% prob = 8 points

### Step 2: Apply Agent-Specific Weights

**Function:** `computeWeightedTotalScore(scored, agent, adaptiveConfig?)`

1. **Multiply each component by agent's weight:**
   ```typescript
   weighted = 
     volumeScore * agent.weights.volumeWeight +
     liquidityScore * agent.weights.liquidityWeight +
     priceMovementScore * agent.weights.priceMovementWeight +
     newsScore * agent.weights.newsWeight +
     probScore * agent.weights.probWeight
   ```

2. **Normalize by sum of weights:**
   ```typescript
   finalScore = weighted / (sum of all weights)
   ```
   - Keeps score roughly in 0-100 range

3. **Apply Adaptive Category Bias (if available):**
   - If `adaptiveConfig` provided:
     - Get category multiplier from `adaptiveConfig.categoryBias[category]`
     - Default: 1.0 if category not in bias
     - Multiply final score by category multiplier (range 0.7-1.3)

### Step 3: Return ScoredMarket

```typescript
{
  ...market,                    // All original market fields
  score: finalScore,            // Weighted total score
  components: {
    volumeScore,
    liquidityScore,
    priceMovementScore,
    newsScore,
    probScore
  }
}
```

---

## AI Decision Making

### Location: `src/lib/agents/ai-clients.ts`

**Function:** `getAITradeDecision(agentId, market, newsArticles): Promise<AITradeDecision>`

### Step 1: Check AI Cache (Layer 1)

**Location:** `src/lib/agents/ai-cache.ts`

- **Cache Key:** `${agentId}:${marketId}`
- **TTL:** 5 minutes (`AI_CACHE_TTL`)
- **If cache hit:** Return cached decision immediately (NO API CALL)

### Step 2: Prepare Market Context

1. **Filter Relevant News:**
   - Extract keywords from market question (words > 4 chars)
   - Match against article titles/descriptions
   - Take top 5 matching articles

2. **Build MarketContext:**
   ```typescript
   {
     question: market.question,
     category: market.category,
     currentProbability: market.currentProbability,
     volumeUsd: market.volumeUsd,
     liquidityUsd: market.liquidityUsd,
     priceChange24h: market.priceChange24h,
     relevantNews: [
       {
         title: article.title,
         source: article.source,
         publishedAt: article.publishedAt
       },
       ... (up to 5)
     ]
   }
   ```

### Step 3: Build AI Prompt

**Function:** `buildTradePrompt(context, agentName): string`

Prompt includes:
- Market question
- Category
- Current probability (%)
- Trading volume ($k)
- Liquidity ($k)
- 24h price change (%)
- Relevant news (top 5, with source and date)
- Instructions to respond with JSON:
  ```json
  {
    "side": "YES" or "NO",
    "confidence": 0.0 to 1.0,
    "reasoning": ["reason 1", "reason 2", "reason 3"]
  }
  ```

### Step 4: Call Agent's AI API

**Switch based on agentId:**

1. **GROK_4** → `callGroq(context)`
   - Endpoint: `https://api.x.ai/v1/chat/completions`
   - Model: `grok-3`
   - Headers: `Authorization: Bearer ${GROK_API_KEY}`
   - Body: `{ model, messages, temperature: 0.8, response_format: { type: 'json_object' } }`
   - Timeout: 30 seconds

2. **GPT_5** → `callOpenAI(context)`
   - Endpoint: `https://api.openai.com/v1/chat/completions`
   - Model: `gpt-4o`
   - Headers: `Authorization: Bearer ${OPENAI_API_KEY}`
   - Body: `{ model, messages, temperature: 0.7, response_format: { type: 'json_object' } }`
   - Timeout: 30 seconds

3. **CLAUDE_4_5** → `callAnthropic(context)`
   - Endpoint: `https://api.anthropic.com/v1/messages`
   - Model: `claude-3-opus-20240229`
   - Headers: `x-api-key: ${ANTHROPIC_API_KEY}`, `anthropic-version: 2023-06-01`
   - Body: `{ model, max_tokens: 1000, messages, temperature: 0.7 }`
   - Timeout: 30 seconds

4. **GEMINI_2_5** → `callGoogleAI(context)`
   - Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_AI_API_KEY}`
   - Model: `gemini-2.0-flash-exp`
   - Body: `{ contents, generationConfig: { temperature: 0.7, responseMimeType: 'application/json' } }`
   - Timeout: 30 seconds

5. **DEEPSEEK_V3** → `callDeepSeek(context)`
   - Endpoint: `https://api.deepseek.com/v1/chat/completions`
   - Model: `deepseek-chat`
   - Headers: `Authorization: Bearer ${DEEPSEEK_API_KEY}`
   - Body: `{ model, messages, temperature: 0.7, response_format: { type: 'json_object' } }`
   - Timeout: 30 seconds

6. **QWEN_2_5** → `callQwen(context)`
   - Endpoint: `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation`
   - Model: `qwen-turbo`
   - Headers: `Authorization: Bearer ${QWEN_API_KEY}`
   - Body: `{ model, input: { messages }, parameters: { temperature: 0.7, result_format: 'message' } }`
   - Timeout: 30 seconds

### Step 5: Parse AI Response

**Function:** `parseAIResponse(content): AITradeDecision`

1. **Extract JSON from response:**
   - Try to find JSON in markdown code blocks: ````json { ... } ````
   - If not found, try to find JSON object: `{ ... }`
   - Some APIs (like Anthropic) may add explanatory text before JSON

2. **Parse JSON:**
   ```typescript
   {
     side: "YES" | "NO",
     confidence: number (0-1),
     reasoning: string[] | string
   }
   ```

3. **Validate and normalize:**
   - Side: Convert to uppercase "YES" or "NO" (default "NO")
   - Confidence: Clamp to 0-1 range (default 0.5)
   - Reasoning: Convert to array of strings (default ["AI analysis based on market data"])

4. **Return AITradeDecision:**
   ```typescript
   {
     side: 'YES' | 'NO',
     confidence: number, // 0-1
     reasoning: string[] // Array of reasoning bullets
   }
   ```

### Step 6: Cache AI Decision

- Store in AI cache with key `${agentId}:${marketId}`
- TTL: 5 minutes
- Next time same agent analyzes same market within 5min → use cache

### Step 7: Error Handling

- If API call fails → throw error (will be caught by fallback)
- If parsing fails → throw error (will be caught by fallback)
- Errors are logged but don't crash the system

---

## Trade Generation Process

### Location: `src/lib/agents/generator.ts` (calls missing `engine.ts`)

**Function:** `generateTradeForMarket(agent, scored, newsRelevance, newsArticles, index, now): Promise<AgentTrade | null>`

**NOTE:** This function is imported but the file `src/lib/agents/engine.ts` is missing. Based on the code structure and domain types, here's what it should do:

### Process:

1. **Skip Low-Score Markets:**
   - If `scored.score < 45` → return `null` (skip this market)

2. **Create Deterministic Seed:**
   - Seed: `${agent.id}:${scored.id}:${index}`
   - Used for all deterministic calculations

3. **Get AI Decision (if configured):**
   - Check: `isAIConfigured(agent.id)`
   - If configured:
     - Call `getAITradeDecision(agent.id, scored, newsArticles)`
     - Get: `{ side, confidence, reasoning }`
     - Apply risk adjustment:
       - HIGH risk → `confidence = Math.min(confidence * 1.05, 0.95)`
       - LOW risk → `confidence = Math.max(confidence * 0.9, 0.4)`
       - MEDIUM risk → no change
   - If not configured or fails:
     - Use deterministic logic:
       - Side: Based on probability (if prob > 0.5 → YES, else NO, with some randomness)
       - Confidence: Based on score and risk level
       - Reasoning: Based on market components

4. **Apply Personality Rules:**
   - Get agent's personality rules: `getPersonalityRules(agent.id)`
   - Create context:
     ```typescript
     {
       market: scored,
       agent: agent,
       baseSide: side,
       baseConfidence: confidence,
       baseSizeUsd: calculatedSize
     }
     ```
   - Apply rules: `applyPersonalityRules(context, rules)`
   - Rules may modify: side, confidence, sizeUsd
   - Returns final personality-adjusted decision

5. **Determine Trade Status:**
   - OPEN: New trade (default)
   - CLOSED: If market resolved or deterministic logic says so

6. **Calculate PnL (if CLOSED):**
   - Based on side, entry probability, exit probability
   - Formula depends on prediction market mechanics

7. **Generate Timestamps:**
   - `openedAt`: Deterministic based on seed (consistent for same seed)
   - `closedAt`: If CLOSED, deterministic based on seed

8. **Generate Summary Decision:**
   - 1-2 sentence explanation of trade
   - Based on side, confidence, reasoning

9. **Create AgentTrade:**
   ```typescript
   {
     id: `${agent.id}:${scored.id}`, // Deterministic
     agentId: agent.id,
     marketId: scored.id,
     side: finalSide,
     confidence: finalConfidence,
     score: scored.score,
     reasoning: reasoningArray,
     status: 'OPEN' | 'CLOSED',
     pnl: pnlValue | null,
     openedAt: openedAtISO,
     closedAt: closedAtISO | undefined,
     summaryDecision: summaryString,
     seed: seedString
   }
   ```

10. **Return Trade:**
    - Return `AgentTrade` object
    - Or `null` if market skipped

---

## Caching System

### Three-Layer Caching Strategy

### Layer 1: AI Response Cache
**Location:** `src/lib/agents/ai-cache.ts`
- **Cache Key:** `${agentId}:${marketId}`
- **TTL:** 5 minutes
- **Purpose:** Prevents calling same AI API for same market within 5 minutes
- **Storage:** In-memory `Map<string, AICacheEntry>`
- **Impact:** If same agent analyzes same market within 5min → **ZERO API CALLS**

### Layer 2: Agent Trade Cache
**Location:** `src/lib/agents/cache.ts`
- **Cache Key:** `agentId`
- **TTL:** 2 minutes
- **Invalidation:** If market IDs change (new markets appear)
- **Purpose:** Prevents regenerating entire trade set for an agent
- **Storage:** In-memory `Map<string, AgentCacheEntry>`
- **Structure:**
  ```typescript
  {
    trades: AgentTrade[],
    generatedAt: number,
    marketIds: string[] // Sorted array of market IDs used
  }
  ```
- **Impact:** If markets haven't changed and cache valid → **NO MARKET FETCHING, NO SCORING, NO AI CALLS**

### Layer 3: Market Data Cache
**Location:** `src/lib/markets/polymarket.ts`
- **TTL:** 60 seconds
- **Purpose:** Prevents fetching same market data repeatedly
- **Storage:** In-memory `marketCache` variable
- **Impact:** Multiple agents can use same cached market data

### Layer 4: News Cache
**Location:** `src/lib/news/aggregator.ts`
- **TTL:** 5 minutes
- **Purpose:** Prevents fetching same news repeatedly
- **Storage:** In-memory `newsCache` variable
- **Impact:** All agents share same news pool

### Cache Flow Example:

**Scenario:** User requests trades for GROK_4, then GPT_5 30 seconds later

1. **First Request (GROK_4):**
   - Market cache: MISS → Fetch markets → Cache for 60s
   - News cache: MISS → Fetch news → Cache for 5min
   - Agent cache: MISS → Generate trades → Cache for 2min
   - AI cache: MISS (for each market) → Call AI APIs → Cache for 5min

2. **Second Request (GPT_5) 30s later:**
   - Market cache: **HIT** → Use cached markets (saved API call)
   - News cache: **HIT** → Use cached news (saved API calls)
   - Agent cache: MISS → Generate trades → Cache for 2min
   - AI cache: **HIT** (if GPT_5 analyzes same markets) → Use cached AI decisions (saved API calls)

**Credit Savings:**
- Without caching: 2 market fetches + 2 news fetches + many AI calls
- With caching: 1 market fetch + 1 news fetch + fewer AI calls

---

## API Endpoints

### Location: `server/api/agents.js`

### 1. GET `/api/agents/:agentId/trades`

**Purpose:** Fetch trades for a specific agent

**Process:**
1. Map frontend agent ID to backend ID:
   - `grok` → `GROK_4`
   - `gpt5` → `GPT_5`
   - `deepseek` → `DEEPSEEK_V3`
   - `gemini` → `GEMINI_2_5`
   - `claude` → `CLAUDE_4_5`
   - `qwen` → `QWEN_2_5`

2. Validate agent ID

3. Call `generateAgentTrades(backendAgentId)`
   - Uses all caching layers
   - Returns `AgentTrade[]`

4. Map trades to frontend format:
   ```typescript
   {
     id: trade.id,
     timestamp: new Date(trade.openedAt),
     market: trade.marketId,
     decision: trade.side,
     confidence: Math.round(trade.confidence * 100),
     reasoning: trade.reasoning.join(' '),
     pnl: trade.pnl,
     status: trade.status,
     predictionId: trade.marketId
   }
   ```

5. Return JSON:
   ```json
   {
     "agent": {
       "id": "grok",
       "name": "GROK 4",
       "emoji": "🔥"
     },
     "trades": [...]
   }
   ```

**Error Handling:**
- Invalid agent ID → 400 Bad Request
- Generation fails → 500 Internal Server Error
- Always returns JSON (never throws)

### 2. GET `/api/agents/summary`

**Purpose:** Fetch summary for all agents

**Process:**
1. Get all agent IDs: `ALL_AGENT_IDS`

2. Fetch trades for all agents in parallel:
   - `Promise.allSettled()` to handle failures gracefully
   - Each agent's trades fetched independently
   - Failed agents return empty array (don't fail entire request)

3. Compute summary stats:
   - Total PnL across all agents
   - Open trades count
   - Closed trades count
   - Best agent by PnL

4. Build agent summaries:
   - For each agent: `buildAgentSummary(trades, agent)`
   - Human-readable sentence per agent

5. Map to frontend format:
   ```typescript
   {
     agents: [
       {
         id: "grok",
         name: "GROK 4",
         emoji: "🔥",
         isActive: false,
         pnl: totalPnl,
         openMarkets: openTrades.length,
         lastTrade: "YES on market-id @ 75%"
       },
       ...
     ],
     tradesByAgent: {
       GROK_4: [...],
       GPT_5: [...],
       ...
     },
     summary: {
       totalPnl: number,
       openTradesCount: number,
       closedTradesCount: number,
       bestAgentByPnl: string | null,
       agentSummaries: [...]
     }
   }
   ```

6. Return JSON

**Error Handling:**
- Individual agent failures → logged, returns empty array for that agent
- Overall failure → 500 Internal Server Error
- Always returns JSON

---

## Personality Rules

### Location: `src/lib/agents/personality.ts`

**Purpose:** Deterministic rules that nudge trading decisions based on agent personality

**How It Works:**
1. Rules are applied **after** base side, confidence, and size are computed
2. Rules are **pure functions** - deterministic, no side effects
3. Rules can modify: `side`, `confidence`, `sizeUsd`
4. Rules can add `notes` to explain the personality adjustment

### Current Rules:

#### 1. GROK 4 - Momentum Rule
**Function:** `grokMomentumRule(ctx): PersonalityResult`

**Trigger Conditions:**
- Market category is Crypto OR Tech
- Price movement score >= 70% of max (10.5 points)
- Probability between 45% and 55% (near 50%)

**Effect:**
- Boost confidence: `+0.05` (max 0.95)
- Boost size: `* 1.15`
- Add note: "Aggressive momentum bias in Crypto/Tech near 50% probability."

#### 2. CLAUDE 4.5 - Crowd Rule
**Function:** `claudeCrowdRule(ctx): PersonalityResult`

**Trigger Conditions:**
- Market category is Politics OR Elections
- News score >= 70% of max (17.5 points)
- Probability >= 90% OR <= 10% (extremely one-sided)

**Effect:**
- Reduce confidence: `-0.05` (min 0.4)
- Reduce size: `* 0.75`
- Add note: "Conservative stance in extremely crowded political markets."

#### 3. GEMINI 2.5 - Sports Rule
**Function:** `geminiSportsRule(ctx): PersonalityResult`

**Trigger Conditions:**
- Market category is Sports
- Market question contains "today", "tonight", or year (2024-2029)

**Effect:**
- Boost confidence: `+0.03` (max 0.95)
- Boost size: `* 1.1`
- Add note: "Increased conviction in near-term sports event."

### Applying Rules:

**Function:** `applyPersonalityRules(ctx, rules): PersonalityResult`

1. Start with base values from context
2. For each rule in order:
   - Execute rule function
   - Apply rule's modifications
   - Update context for next rule (rules can chain)
3. Return final result with all notes combined

**Rules are executed in order** - later rules can override earlier changes.

---

## Adaptive Tuning

### Location: `src/lib/agents/adaptive.ts`

**Purpose:** Adjust agent risk and category preferences based on historical performance

**Cadence:** Runs once per day (separate background job)

### Process:

1. **Load Trade History:**
   - Get all trades for agent from last 30 days
   - From persistence layer

2. **Compute Performance Snapshot:**
   ```typescript
   {
     agentId: AgentId,
     pnlPct30d: number,              // 30-day PnL %
     maxDrawdownPct30d: number,      // Max drawdown
     categoryPnl30d: Record<Category, number>,  // PnL per category
     categoryTrades30d: Record<Category, number>  // Trade count per category
   }
   ```

3. **Compute Risk Multiplier:**
   - **Function:** `computeRiskMultiplier(snapshot): number`
   - Range: 0.5 - 1.5
   - Logic:
     - If drawdown > 35% OR PnL < -10% → `multiplier *= 0.75` (reduce risk)
     - Else if PnL > 25% AND drawdown < 25% → `multiplier *= 1.1` (cautiously increase risk)
   - Clamp to 0.5-1.5 range

4. **Compute Category Bias:**
   - **Function:** `computeCategoryBias(snapshot): Partial<Record<Category, number>>`
   - For each category:
     - Calculate average PnL per trade
     - Normalize: `avgPnl / 50` (clamp -1 to +1)
     - Convert to multiplier: `1 + normalized * 0.3`
     - Range: 0.7 - 1.3
   - Categories with positive PnL get higher multipliers (preferred)
   - Categories with negative PnL get lower multipliers (avoided)

5. **Create Adaptive Config:**
   ```typescript
   {
     agentId: AgentId,
     riskMultiplier: number,          // 0.5-1.5
     categoryBias: Record<Category, number>,  // 0.7-1.3 per category
     computedAt: string              // ISO timestamp
   }
   ```

6. **Persist Config:**
   - Store in persistence layer
   - Used by scoring engine for next trading cycle

### Usage in Scoring:

- Adaptive config is read once per day (static for intraday)
- Applied in `computeWeightedTotalScore()`:
  ```typescript
  if (adaptiveConfig) {
    const categoryMultiplier = adaptiveConfig.categoryBias[category] ?? 1.0;
    finalScore = finalScore * categoryMultiplier;
  }
  ```

---

## Portfolio Management

### Location: `src/lib/agents/portfolio.ts`

**Purpose:** Track agent capital, positions, and PnL

**NOTE:** File appears to be empty or not fully implemented. Based on domain types and system design, here's what it should do:

### Portfolio Structure:
```typescript
{
  agentId: AgentId,
  startingCapitalUsd: 3000,        // Starting capital
  currentCapitalUsd: number,       // Current capital
  realizedPnlUsd: number,          // Closed position PnL
  unrealizedPnlUsd: number,        // Open position PnL
  maxEquityUsd: number,            // Peak equity
  maxDrawdownPct: number,          // Max drawdown %
  openPositions: Record<string, AgentPosition>,
  lastUpdated: string              // ISO timestamp
}
```

### Position Structure:
```typescript
{
  marketId: string,
  side: 'YES' | 'NO',
  sizeUsd: number,                  // Position size
  entryProbability: number,        // Entry price (0-1)
  currentProbability: number,      // Current price
  openedAt: string,                // ISO timestamp
  unrealizedPnl: number           // Current PnL
}
```

### Risk Budgets (by Risk Level):
- LOW: $50 per trade
- MEDIUM: $100 per trade
- HIGH: $150 per trade

### Position Sizing:
- Base size = `RISK_BUDGET[agent.risk]`
- Confidence multiplier = `baseSize * confidence`
- Apply personality adjustments
- Hard caps:
  - Max single market exposure: 20% of capital
  - Max category exposure: 40% of capital

---

## Trade Lifecycle

### Location: `src/lib/agents/lifecycle.ts`

**Purpose:** Manage trade lifecycle (OPEN → CLOSING → CLOSED)

**NOTE:** File appears to be empty or not fully implemented. Based on system design:

### Lifecycle States:
- **NONE:** No position
- **OPEN:** Active position
- **CLOSING:** Exit conditions met, closing position

### Exit Conditions:

1. **Take-Profit:**
   - YES position: probability >= target (e.g., 0.8)
   - NO position: probability <= target (e.g., 0.2)

2. **Stop-Loss:**
   - YES position: probability <= stop (e.g., 0.3)
   - NO position: probability >= stop (e.g., 0.7)

3. **Time-Based:**
   - Position open for > X days
   - Market resolution date approaching

4. **Score Decay:**
   - Market score drops below threshold
   - Market no longer attractive

### Close vs. Flip:
- **Close:** Exit position, realize PnL
- **Flip:** Close current position, open opposite side (if confidence high enough)

### PnL Calculation:
- **Realized PnL (CLOSED):**
  - YES: `(exitProb - entryProb) * sizeUsd`
  - NO: `(entryProb - exitProb) * sizeUsd`
- **Unrealized PnL (OPEN):**
  - Same formula using current probability

---

## Error Handling & Fallbacks

### Error Handling Strategy:

1. **Market Fetching:**
   - API fails → return stale cache if available
   - No cache → return empty array
   - **Never throws** - always returns array

2. **News Fetching:**
   - Provider fails → log error, continue with other providers
   - All providers fail → return stale cache if available
   - No cache → return empty array
   - **Never throws** - always returns array

3. **AI API Calls:**
   - API fails → catch error, use deterministic fallback
   - Parse fails → catch error, use deterministic fallback
   - Timeout (30s) → catch error, use deterministic fallback
   - **Never crashes** - always falls back to deterministic logic

4. **Trade Generation:**
   - Market fails → log error, continue to next market
   - AI call fails → use deterministic logic
   - **Never stops** - continues processing other markets

5. **API Endpoints:**
   - Invalid agent ID → 400 Bad Request with error message
   - Generation fails → 500 Internal Server Error with error message
   - **Always returns JSON** - never throws unhandled errors

### Fallback Logic:

**When AI API not configured or fails:**

1. **Side Selection:**
   - Based on probability and market score
   - Some randomness based on deterministic seed

2. **Confidence:**
   - Based on market score and risk level
   - Formula: `baseConfidence = score / 100 * riskMultiplier`

3. **Reasoning:**
   - Based on market components:
     - "High volume and liquidity"
     - "Strong price movement"
     - "Relevant news coverage"
     - "Probability near 50%"

### Determinism:

- All calculations use deterministic seeds
- Same inputs always produce same outputs
- Critical for caching and consistency
- Seed format: `${agentId}:${marketId}:${index}`

---

## Environment Variables Required

### Polymarket API (Same as Bubble Maps):
- `POLYMARKET_API_KEY`
- `POLYMARKET_SECRET`
- `POLYMARKET_PASSPHRASE`

### News APIs (Optional):
- `NEWS_API_KEY` (NewsAPI.org)
- `NEWSDATA_API_KEY` (NewsData.io)
- `GNEWS_API_KEY` (GNews)
- `WORLD_NEWS_API_KEY` (World News API)
- `MEDIASTACK_API_KEY` (Mediastack)

### AI APIs (Optional - one per agent):
- `OPENAI_API_KEY` (GPT-5)
- `ANTHROPIC_API_KEY` (Claude 4.5)
- `GROK_API_KEY` (GROK 4)
- `GOOGLE_AI_API_KEY` (Gemini 2.5)
- `DEEPSEEK_API_KEY` (DEEPSEEK V3)
- `QWEN_API_KEY` (QWEN 2.5)

**Note:** If an AI API key is not set, that agent will use deterministic fallback logic.

---

## Summary

The AI Agent Trading System is a **sophisticated, production-grade engine** that:

1. **Fetches real market data** from Polymarket (same API as bubble maps)
2. **Aggregates news** from 5 different APIs with deduplication
3. **Scores markets** using 5 factors with agent-specific weights
4. **Calls real AI APIs** for each agent to make trading decisions
5. **Falls back intelligently** to deterministic logic if APIs fail
6. **Applies personality rules** to nudge decisions based on agent traits
7. **Caches aggressively** at 4 layers to minimize API costs
8. **Handles errors gracefully** - never crashes, always returns data
9. **Is fully deterministic** - same inputs produce same outputs
10. **Is type-safe** - full TypeScript with no `any` types

The system is designed to be **cost-efficient**, **reliable**, and **scalable**, with intelligent caching and fallback mechanisms ensuring it works even if some APIs fail or aren't configured.


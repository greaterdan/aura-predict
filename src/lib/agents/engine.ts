/**
 * Trade generation engine
 * 
 * Core logic for generating individual trades for markets.
 * Handles AI API calls, deterministic fallbacks, and personality rules.
 */

import type { AgentProfile, ScoredMarket, AgentTrade, TradeSide, NewsRelevance, NewsArticle } from './domain';
import { getAITradeDecision, isAIConfigured } from './ai-clients';
import { getPersonalityRules, applyPersonalityRules } from './personality';
import { createHash } from 'crypto';

/**
 * Create deterministic seed for a market
 */
function deterministicSeed(agentId: string, marketId: string, index: number): string {
  return `${agentId}:${marketId}:${index}`;
}

/**
 * Generate deterministic number from seed (0-1)
 */
function deterministicNumber(seed: string): number {
  const hash = createHash('sha256').update(seed).digest();
  const num = hash.readUInt32BE(0);
  return num / 0xFFFFFFFF;
}

/**
 * Get deterministic side based on market and seed
 */
function getDeterministicSide(scored: ScoredMarket, seed: string): TradeSide {
  const num = deterministicNumber(seed);
  // Bias towards YES if probability > 0.5, NO if < 0.5
  const probBias = scored.currentProbability > 0.5 ? 0.6 : 0.4;
  return (num < probBias) ? 'YES' : 'NO';
}

/**
 * Get deterministic confidence based on score and risk
 */
function getDeterministicConfidence(scored: ScoredMarket, agent: AgentProfile, seed: string): number {
  const baseConfidence = scored.score / 100;
  const riskMultiplier = agent.risk === 'HIGH' ? 1.1 : agent.risk === 'LOW' ? 0.9 : 1.0;
  const jitter = (deterministicNumber(seed + 'jitter') - 0.5) * 0.1; // ±5% jitter
  return Math.max(0.4, Math.min(0.95, baseConfidence * riskMultiplier + jitter));
}

/**
 * Get deterministic reasoning based on market components
 */
function getDeterministicReasoning(scored: ScoredMarket, newsRelevance: NewsRelevance): string[] {
  const reasons: string[] = [];
  
  if (scored.components.volumeScore > 20) {
    reasons.push('High trading volume indicates strong market interest');
  }
  if (scored.components.liquidityScore > 15) {
    reasons.push('Strong liquidity provides good entry/exit opportunities');
  }
  if (scored.components.priceMovementScore > 10) {
    reasons.push('Significant price movement suggests momentum');
  }
  if (scored.components.newsScore > 15) {
    reasons.push(`Recent news coverage (${newsRelevance.count} articles) supports market activity`);
  }
  if (scored.components.probScore > 7) {
    reasons.push('Probability near 50% provides good risk/reward');
  }
  
  if (reasons.length === 0) {
    reasons.push('Market meets minimum criteria for trading');
  }
  
  return reasons;
}

/**
 * Generate trade for a single market
 * 
 * @param agent - Agent profile
 * @param scored - Scored market
 * @param newsRelevance - News relevance result
 * @param newsArticles - All news articles
 * @param index - Market index (for determinism)
 * @param now - Current timestamp (ms)
 * @returns AgentTrade or null if market skipped
 */
export async function generateTradeForMarket(
  agent: AgentProfile,
  scored: ScoredMarket,
  newsRelevance: NewsRelevance,
  newsArticles: NewsArticle[],
  index: number,
  now: number
): Promise<AgentTrade | null> {
  // Skip low-score markets (use relative threshold - top markets should pass)
  // Threshold lowered from 45 to 8 to allow markets with decent scores to trade
  // The scoring system normalizes scores, so 8-15 is actually reasonable for top markets
  // Lowered to 8 to help GROK and GEMINI find more trading opportunities
  if (scored.score < 8) {
    console.log(`[Engine:${agent.id}] ⏭️ Skipping market "${scored.question.substring(0, 40)}..." - score too low (${scored.score.toFixed(1)} < 8)`);
    return null;
  }
  
  // Create deterministic seed
  const seed = deterministicSeed(agent.id, scored.id, index);
  
  let side: TradeSide;
  let confidence: number;
  let reasoning: string[];
  
  // Try AI API if configured
  if (isAIConfigured(agent.id)) {
    try {
      const aiDecision = await getAITradeDecision(agent.id, scored, newsArticles);
      side = aiDecision.side;
      confidence = aiDecision.confidence;
      reasoning = aiDecision.reasoning;
      
      // Apply risk adjustment to AI confidence
      if (agent.risk === 'HIGH') {
        confidence = Math.min(confidence * 1.05, 0.95);
      } else if (agent.risk === 'LOW') {
        confidence = Math.max(confidence * 0.9, 0.4);
      }
    } catch (error) {
      // Only log non-access-denied errors (access denied is expected if account not eligible)
      const isAccessDenied = (error as any)?.isAccessDenied || 
                            (error instanceof Error && error.message.includes('access denied'));
      
      if (!isAccessDenied) {
        console.warn(`[AI] Failed to get AI decision for ${agent.id}, using fallback:`, error);
      }
      // Fallback to deterministic
      side = getDeterministicSide(scored, seed);
      confidence = getDeterministicConfidence(scored, agent, seed);
      reasoning = getDeterministicReasoning(scored, newsRelevance);
    }
  } else {
    // Use deterministic logic
    side = getDeterministicSide(scored, seed);
    confidence = getDeterministicConfidence(scored, agent, seed);
    reasoning = getDeterministicReasoning(scored, newsRelevance);
  }
  
  // Calculate base position size (simplified - would use portfolio logic)
  const baseSizeUsd = 100; // Default size
  
  // Apply personality rules
  const personalityRules = getPersonalityRules(agent.id);
  const personalityResult = applyPersonalityRules(
    {
      market: scored,
      agent,
      baseSide: side,
      baseConfidence: confidence,
      baseSizeUsd,
    },
    personalityRules
  );
  
  // Use personality-adjusted values
  side = personalityResult.side;
  confidence = personalityResult.confidence;
  
  // Calculate sophisticated position size based on multiple factors
  // AI-driven position sizing: Let the AI's confidence and market score determine investment
  const STARTING_CAPITAL = 3000;
  
  // Base risk budget by agent risk level (higher base for more aggressive agents)
  const RISK_BUDGET: Record<'LOW' | 'MEDIUM' | 'HIGH', number> = {
    LOW: 80,      // Increased from 50
    MEDIUM: 150,  // Increased from 100
    HIGH: 250,    // Increased from 150 - HIGH risk agents invest more
  };
  
  const baseRisk = RISK_BUDGET[agent.risk];
  
  // Confidence multiplier (0.5x to 2.5x) - MUCH more aggressive
  // Higher confidence = significantly larger position
  // AI confidence is 0-1, so map to 0.5-2.5 range
  const confidenceMultiplier = 0.5 + (confidence * 2.0); // 0.5 to 2.5 range
  
  // Score multiplier (0.4x to 2.0x) - MUCH more aggressive
  // Higher market score = significantly larger position
  // Scores are typically 10-50, normalize to 0-1, then scale to 0.4-2.0
  const normalizedScore = Math.min(1.0, Math.max(0, (scored.score - 10) / 40)); // 0-1 range (score 10-50)
  const scoreMultiplier = 0.4 + (normalizedScore * 1.6); // 0.4 to 2.0 range
  
  // Calculate base size with more aggressive multipliers
  let investmentUsd = baseRisk * confidenceMultiplier * scoreMultiplier;
  
  // Apply personality adjustments (personality rules can boost/reduce)
  const personalitySizeMultiplier = personalityResult.sizeUsd / baseSizeUsd;
  investmentUsd = investmentUsd * personalitySizeMultiplier;
  
  // Add some deterministic variation based on market ID (so same market = same size, but different markets vary)
  // This ensures variety across different markets
  const marketVariation = (scored.id.charCodeAt(0) % 20) / 100; // 0-20% variation
  investmentUsd = investmentUsd * (1 + marketVariation);
  
  // Apply hard caps and floors
  const MIN_INVESTMENT = 130; // Minimum $130 per trade (user requirement)
  const MAX_INVESTMENT = STARTING_CAPITAL * 0.20; // 20% max per market ($600)
  investmentUsd = Math.max(MIN_INVESTMENT, Math.min(investmentUsd, MAX_INVESTMENT));
  
  // Round to nearest $10 for cleaner display (was $5, but $10 gives more variety)
  const finalInvestment = Math.round(investmentUsd / 10) * 10;
  
  // Determine trade status - close some trades to show history
  // Close trades deterministically based on market ID hash (so same market = same status)
  const marketHash = scored.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const shouldClose = (marketHash % 3) === 0; // Close ~33% of trades
  const status: 'OPEN' | 'CLOSED' = shouldClose ? 'CLOSED' : 'OPEN';
  
  // Generate timestamps deterministically
  const openedAt = new Date(now - (index * 1000)).toISOString(); // Stagger by 1 second per market
  const closedAt = shouldClose ? new Date(now - (index * 1000) + (Math.abs(marketHash % 3600000))).toISOString() : undefined;
  
  // Calculate PnL for closed trades (mock calculation based on confidence and score)
  // Higher confidence + better score = more likely to win
  let pnl: number | null = null;
  if (shouldClose) {
    // Deterministic PnL calculation based on confidence, score, and market hash
    const winProbability = Math.min(0.95, confidence * 0.8 + (scored.score / 100) * 0.2);
    const isWin = (marketHash % 100) < (winProbability * 100);
    
    if (isWin) {
      // Win: PnL is positive, based on confidence and investment
      const winMultiplier = 0.3 + (confidence * 0.4) + ((scored.score / 100) * 0.3); // 0.3 to 1.0
      pnl = finalInvestment * winMultiplier;
    } else {
      // Loss: PnL is negative, lose part of investment
      const lossMultiplier = 0.2 + (confidence * 0.3); // Lose 20-50% of investment
      pnl = -finalInvestment * lossMultiplier;
    }
    
    // Round to 2 decimal places
    pnl = Math.round(pnl * 100) / 100;
  }
  
  // Generate summary decision
  const summaryDecision = `${agent.displayName} decided to trade ${side} on "${scored.question}" with ${Math.round(confidence * 100)}% confidence based on ${reasoning.length} key factors.`;
  
  // Create trade
  const trade: AgentTrade = {
    id: `${agent.id}:${scored.id}`,
    agentId: agent.id,
    marketId: scored.id, // This MUST match prediction IDs
    marketQuestion: scored.question, // Include market question for display
    side,
    confidence,
    score: scored.score,
    reasoning,
    status,
    pnl, // PnL for closed trades, null for open
    investmentUsd: finalInvestment, // Amount invested in this trade
    openedAt,
    closedAt, // Only for closed trades
    summaryDecision,
    seed,
  };
  
  // Log trade creation with market ID for debugging
  console.log(`[Engine:${agent.id}] ✅ Created trade: ${trade.side} on market "${scored.question.substring(0, 50)}..." (ID: ${trade.marketId})`);
  
  return trade;
}


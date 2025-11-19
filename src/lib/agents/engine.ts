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
  // Threshold lowered from 45 to 10 to allow markets with decent scores to trade
  // The scoring system normalizes scores, so 10-15 is actually reasonable for top markets
  if (scored.score < 10) {
    console.log(`[Engine:${agent.id}] ⏭️ Skipping market "${scored.question.substring(0, 40)}..." - score too low (${scored.score.toFixed(1)} < 10)`);
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
  const STARTING_CAPITAL = 3000;
  
  // Base risk budget by agent risk level
  const RISK_BUDGET: Record<'LOW' | 'MEDIUM' | 'HIGH', number> = {
    LOW: 50,
    MEDIUM: 100,
    HIGH: 150,
  };
  
  const baseRisk = RISK_BUDGET[agent.risk];
  
  // Confidence multiplier (0.5x to 1.5x) - higher confidence = larger position
  const confidenceMultiplier = Math.max(0.5, Math.min(1.5, confidence));
  
  // Score multiplier (0.8x to 1.2x) - higher market score = larger position
  const scoreMultiplier = Math.max(0.8, Math.min(1.2, scored.score / 50)); // Normalize score to 0-1 range
  
  // Calculate base size
  let investmentUsd = baseRisk * confidenceMultiplier * scoreMultiplier;
  
  // Apply personality adjustments (personality rules can boost/reduce)
  const personalitySizeMultiplier = personalityResult.sizeUsd / baseSizeUsd;
  investmentUsd = investmentUsd * personalitySizeMultiplier;
  
  // Apply hard caps and floors
  const MIN_INVESTMENT = 30; // Minimum $30 per trade
  const MAX_INVESTMENT = STARTING_CAPITAL * 0.20; // 20% max per market ($600)
  investmentUsd = Math.max(MIN_INVESTMENT, Math.min(investmentUsd, MAX_INVESTMENT));
  
  // Round to nearest $5 for cleaner display
  const finalInvestment = Math.round(investmentUsd / 5) * 5;
  
  // Determine trade status (simplified - all new trades are OPEN)
  const status: 'OPEN' | 'CLOSED' = 'OPEN';
  
  // Generate timestamps deterministically
  const openedAt = new Date(now - (index * 1000)).toISOString(); // Stagger by 1 second per market
  
  // Generate summary decision
  const summaryDecision = `${agent.displayName} decided to trade ${side} on "${scored.question}" with ${Math.round(confidence * 100)}% confidence based on ${reasoning.length} key factors.`;
  
  // Create trade
  const trade: AgentTrade = {
    id: `${agent.id}:${scored.id}`,
    agentId: agent.id,
    marketId: scored.id,
    marketQuestion: scored.question, // Include market question for display
    side,
    confidence,
    score: scored.score,
    reasoning,
    status,
    pnl: null, // OPEN trades have no PnL yet
    investmentUsd: finalInvestment, // Amount invested in this trade
    openedAt,
    summaryDecision,
    seed,
  };
  
  return trade;
}


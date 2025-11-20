/**
 * Trade generation engine
 *
 * Core logic for generating individual trades for markets.
 * Handles AI API calls, deterministic fallbacks, and personality rules.
 */
import { getAITradeDecision, isAIConfigured } from './ai-clients';
import { getPersonalityRules, applyPersonalityRules } from './personality';
import { createHash } from 'crypto';
/**
 * Create deterministic seed for a market
 */
export function deterministicSeed(agentId, marketId, index) {
    return `${agentId}:${marketId}:${index}`;
}
/**
 * Generate deterministic number from seed (0-1)
 */
function deterministicNumber(seed) {
    const hash = createHash('sha256').update(seed).digest();
    const num = hash.readUInt32BE(0);
    return num / 0xFFFFFFFF;
}
/**
 * Get deterministic side based on market and seed
 */
export function getDeterministicSide(scored, seed) {
    const num = deterministicNumber(seed);
    // Bias towards YES if probability > 0.5, NO if < 0.5
    const probBias = scored.currentProbability > 0.5 ? 0.6 : 0.4;
    return (num < probBias) ? 'YES' : 'NO';
}
/**
 * Get deterministic confidence based on score and risk
 */
export function getDeterministicConfidence(scored, agent, seed) {
    const baseConfidence = scored.score / 100;
    const riskMultiplier = agent.risk === 'HIGH' ? 1.1 : agent.risk === 'LOW' ? 0.9 : 1.0;
    const jitter = (deterministicNumber(seed + 'jitter') - 0.5) * 0.1; // ±5% jitter
    return Math.max(0.4, Math.min(0.95, baseConfidence * riskMultiplier + jitter));
}
/**
 * Get deterministic reasoning based on market components
 * Makes reasoning specific to the actual market data
 */
export function getDeterministicReasoning(scored, newsRelevance, agent) {
    const reasons = [];
    const probPercent = (scored.currentProbability * 100).toFixed(1);
    const volumeK = (scored.volumeUsd / 1000).toFixed(1);
    const priceChange = (scored.priceChange24h * 100).toFixed(1);
    // Specific probability analysis
    if (scored.currentProbability > 0.55 && scored.currentProbability < 0.65) {
        reasons.push(`${probPercent}% probability suggests slight YES lean, but market may be undervaluing the outcome - potential value play`);
    }
    else if (scored.currentProbability < 0.45 && scored.currentProbability > 0.35) {
        reasons.push(`${probPercent}% probability indicates NO is favored, but if outcome occurs, payoff would be significant`);
    }
    else if (scored.currentProbability >= 0.45 && scored.currentProbability <= 0.55) {
        reasons.push(`Probability at ${probPercent}% is near 50/50 - balanced risk/reward with potential for either outcome`);
    }
    else {
        reasons.push(`Current ${probPercent}% probability ${scored.currentProbability > 0.5 ? 'favors YES' : 'favors NO'} - ${scored.currentProbability > 0.5 ? 'market expects outcome' : 'market expects no outcome'}`);
    }
    // Specific volume/liquidity analysis
    if (scored.components.volumeScore > 20) {
        reasons.push(`$${volumeK}k trading volume shows active market participation - ${scored.volumeUsd > 50000 ? 'high' : 'moderate'} interest from traders`);
    }
    if (scored.components.liquidityScore > 15) {
        const liquidityK = (scored.liquidityUsd / 1000).toFixed(1);
        reasons.push(`$${liquidityK}k liquidity allows for ${scored.liquidityUsd > 20000 ? 'large' : 'moderate'} position sizes with minimal slippage`);
    }
    // Specific price movement analysis
    if (scored.components.priceMovementScore > 10) {
        const direction = scored.priceChange24h > 0 ? 'upward' : 'downward';
        reasons.push(`${priceChange.startsWith('-') ? '' : '+'}${priceChange}% price movement in last 24h shows ${direction} momentum - ${scored.priceChange24h > 0 ? 'YES gaining' : 'NO gaining'} traction`);
    }
    // Specific news analysis
    if (scored.components.newsScore > 15 && newsRelevance.count > 0) {
        reasons.push(`${newsRelevance.count} recent news article${newsRelevance.count > 1 ? 's' : ''} directly relate to "${scored.question.substring(0, 40)}..." - indicates active information flow`);
    }
    // Agent-specific focus
    if (scored.category !== 'Other' && agent.focusCategories.includes(scored.category)) {
        reasons.push(`This ${scored.category} market aligns with ${agent.displayName}'s expertise - agent has specialized knowledge in this category`);
    }
    if (reasons.length === 0) {
        reasons.push(`Market "${scored.question.substring(0, 50)}..." meets trading criteria with ${probPercent}% probability and $${volumeK}k volume`);
    }
    return reasons.slice(0, 4); // Max 4 specific reasons
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
export async function generateTradeForMarket(agent, scored, newsRelevance, newsArticles, index, now) {
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
    let side;
    let confidence;
    let reasoning;
    // Search web for market-specific information (concise search)
    let webSearchResults = [];
    try {
        const { searchWebForMarket, buildMarketSearchQuery } = await import('./web-search');
        const searchQuery = buildMarketSearchQuery(scored.question, scored.category);
        console.log(`[Engine:${agent.id}] 🔍 Searching web for: "${searchQuery}"`);
        webSearchResults = await searchWebForMarket(searchQuery);
        if (webSearchResults.length > 0) {
            console.log(`[Engine:${agent.id}] ✅ Found ${webSearchResults.length} web results`);
        }
    }
    catch (error) {
        console.warn(`[Engine:${agent.id}] ⚠️ Web search failed (using news/articles only):`, error);
        // Continue without web search - use news/articles instead
    }
    // Try AI API if configured - include web search results
    if (isAIConfigured(agent.id)) {
        try {
            // Combine news articles with web search results
            const combinedContext = [...newsArticles];
            if (webSearchResults.length > 0) {
                const webArticles = webSearchResults.map((result, idx) => ({
                    id: `web-search-${scored.id}-${idx}`,
                    title: result.title || '',
                    description: result.snippet || '',
                    content: result.snippet || '',
                    source: result.source || 'Web',
                    publishedAt: new Date().toISOString(),
                    url: result.url || '',
                    sourceApi: 'web-search',
                }));
                combinedContext.push(...webArticles);
            }
            const aiDecision = await getAITradeDecision(agent.id, scored, combinedContext, webSearchResults);
            side = aiDecision.side;
            confidence = aiDecision.confidence;
            reasoning = aiDecision.reasoning; // AI already includes web search in reasoning via prompt
            // Apply risk adjustment to AI confidence
            if (agent.risk === 'HIGH') {
                confidence = Math.min(confidence * 1.05, 0.95);
            }
            else if (agent.risk === 'LOW') {
                confidence = Math.max(confidence * 0.9, 0.4);
            }
        }
        catch (error) {
            // Only log non-access-denied errors (access denied is expected if account not eligible)
            const isAccessDenied = error?.isAccessDenied ||
                (error instanceof Error && error.message.includes('access denied'));
            if (!isAccessDenied) {
                console.warn(`[AI] Failed to get AI decision for ${agent.id}, using fallback:`, error);
            }
            // Fallback to deterministic
            side = getDeterministicSide(scored, seed);
            confidence = getDeterministicConfidence(scored, agent, seed);
            reasoning = getDeterministicReasoning(scored, newsRelevance, agent);
            // Add web search context if available
            if (webSearchResults.length > 0) {
                const webInsight = `Web research found ${webSearchResults.length} source${webSearchResults.length > 1 ? 's' : ''} - ${webSearchResults[0]?.snippet?.substring(0, 80) || 'relevant information'}...`;
                reasoning = [webInsight, ...reasoning].slice(0, 4);
            }
        }
    }
    else {
        // Use deterministic logic
        side = getDeterministicSide(scored, seed);
        confidence = getDeterministicConfidence(scored, agent, seed);
        reasoning = getDeterministicReasoning(scored, newsRelevance, agent);
        // Add web search context if available
        if (webSearchResults.length > 0) {
            const webInsight = `Web research found ${webSearchResults.length} source${webSearchResults.length > 1 ? 's' : ''} - ${webSearchResults[0]?.snippet?.substring(0, 80) || 'relevant information'}...`;
            reasoning = [webInsight, ...reasoning].slice(0, 4);
        }
    }
    // Calculate base position size (simplified - would use portfolio logic)
    const baseSizeUsd = 100; // Default size
    // Apply personality rules
    const personalityRules = getPersonalityRules(agent.id);
    const personalityResult = applyPersonalityRules({
        market: scored,
        agent,
        baseSide: side,
        baseConfidence: confidence,
        baseSizeUsd,
    }, personalityRules);
    // Use personality-adjusted values
    side = personalityResult.side;
    confidence = personalityResult.confidence;
    // Calculate sophisticated position size based on multiple factors
    // AI-driven position sizing: Let the AI's confidence and market score determine investment
    const STARTING_CAPITAL = 3000;
    // Base risk budget by agent risk level (higher base for more aggressive agents)
    const RISK_BUDGET = {
        LOW: 80, // Increased from 50
        MEDIUM: 150, // Increased from 100
        HIGH: 250, // Increased from 150 - HIGH risk agents invest more
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
    const status = shouldClose ? 'CLOSED' : 'OPEN';
    // Generate timestamps deterministically
    const openedAt = new Date(now - (index * 1000)).toISOString(); // Stagger by 1 second per market
    const closedAt = shouldClose ? new Date(now - (index * 1000) + (Math.abs(marketHash % 3600000))).toISOString() : undefined;
    // Calculate PnL for closed trades (mock calculation based on confidence and score)
    // Higher confidence + better score = more likely to win
    let pnl = null;
    if (shouldClose) {
        // Deterministic PnL calculation based on confidence, score, and market hash
        const winProbability = Math.min(0.95, confidence * 0.8 + (scored.score / 100) * 0.2);
        const isWin = (marketHash % 100) < (winProbability * 100);
        if (isWin) {
            // Win: PnL is positive, based on confidence and investment
            const winMultiplier = 0.3 + (confidence * 0.4) + ((scored.score / 100) * 0.3); // 0.3 to 1.0
            pnl = finalInvestment * winMultiplier;
        }
        else {
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
    const trade = {
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

/**
 * Agent trade cache
 *
 * Caches generated trades for each agent to avoid redundant computation.
 * Cache invalidates if market IDs change (new markets appear).
 * TTL: 2 minutes
 */
/**
 * Cache TTL: 30 seconds (balance between freshness and performance)
 * Summary requests use cached data, individual agent requests can regenerate if needed
 */
const CACHE_TTL_MS = 30 * 1000;
/**
 * In-memory cache: agentId -> cache entry
 */
const agentCache = new Map();
/**
 * Get cached agent trades
 *
 * @param agentId - Agent identifier
 * @param currentMarketIds - Sorted array of current market IDs
 * @returns Cached trades or null if cache miss/invalid
 */
export function getCachedAgentTrades(agentId, currentMarketIds) {
    const entry = agentCache.get(agentId);
    if (!entry) {
        return null; // Cache miss
    }
    // Check TTL
    const age = Date.now() - entry.generatedAt;
    if (age >= CACHE_TTL_MS) {
        agentCache.delete(agentId);
        return null; // Cache expired
    }
    // Check if market IDs match (invalidate if markets changed)
    if (entry.marketIds.length !== currentMarketIds.length) {
        agentCache.delete(agentId);
        return null; // Markets changed
    }
    // Compare market IDs (both are sorted)
    for (let i = 0; i < entry.marketIds.length; i++) {
        if (entry.marketIds[i] !== currentMarketIds[i]) {
            agentCache.delete(agentId);
            return null; // Markets changed
        }
    }
    // Cache hit - return cached trades
    // For summary requests, we can use older cache (up to TTL)
    // For individual requests, we might want fresher data, but that's handled by the caller
    return entry.trades;
}
/**
 * Set cached agent trades
 *
 * @param agentId - Agent identifier
 * @param trades - Trades to cache
 * @param marketIds - Sorted array of market IDs used
 */
export function setCachedAgentTrades(agentId, trades, marketIds) {
    // Only cache if we have trades OR if we explicitly want to cache empty (after full analysis)
    // For now, always cache (even 0 trades) to prevent repeated expensive computations
    agentCache.set(agentId, {
        trades,
        generatedAt: Date.now(),
        marketIds: [...marketIds], // Copy array
    });
    console.log(`[Cache:${agentId}] 💾 Cached ${trades.length} trades for ${marketIds.length} markets`);
}
/**
 * Get cached trades without market ID validation (for summary/quick access)
 * This is faster as it doesn't require fetching markets first
 *
 * @param agentId - Agent identifier
 * @returns Cached trades or null if cache miss/expired
 */
export function getCachedTradesQuick(agentId) {
    const entry = agentCache.get(agentId);
    if (!entry) {
        return null; // Cache miss
    }
    // Check TTL only (no market ID validation for speed)
    const age = Date.now() - entry.generatedAt;
    if (age >= CACHE_TTL_MS) {
        agentCache.delete(agentId);
        return null; // Cache expired
    }
    return entry.trades;
}
/**
 * Clear agent cache (useful for testing)
 */
export function clearAgentCache() {
    agentCache.clear();
}

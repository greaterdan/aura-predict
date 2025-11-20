/**
 * Persistence layer for agent trades and portfolios
 *
 * Placeholder implementation - can be extended with database integration
 */
/**
 * Get persistence adapter (placeholder)
 */
export function getPersistenceAdapter() {
    return {
        savePortfolio: async (_portfolio) => { },
        loadPortfolio: async (_agentId) => null,
        getPortfolio: async (_agentId) => null,
        saveTrade: async (_trade) => { },
        loadTrades: async (_agentId) => [],
        updatePortfolio: async (_portfolio) => { },
    };
}
/**
 * Convert portfolio to record
 */
export function portfolioToRecord(portfolio) {
    return {
        agentId: portfolio.agentId,
        portfolio,
        updatedAt: portfolio.lastUpdated,
    };
}

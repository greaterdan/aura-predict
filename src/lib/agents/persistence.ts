/**
 * Persistence layer for agent trades and portfolios
 * 
 * Placeholder implementation - can be extended with database integration
 */

import type { AgentId, Category } from './domain';
import type { AgentPortfolio } from './portfolio';

/**
 * Agent trade record for persistence
 */
export interface AgentTradeRecord {
  id: string;
  agentId: AgentId;
  marketId: string;
  category?: Category | 'Other';
  side: 'YES' | 'NO';
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  pnlUsd: number | null;
}

/**
 * Agent portfolio record for persistence
 */
export interface AgentPortfolioRecord {
  agentId: AgentId;
  portfolio: AgentPortfolio;
  updatedAt: string;
}

/**
 * Get persistence adapter (placeholder)
 */
export function getPersistenceAdapter() {
  return {
    savePortfolio: async (_portfolio: AgentPortfolio) => {},
    loadPortfolio: async (_agentId: AgentId): Promise<AgentPortfolio | null> => null,
    getPortfolio: async (_agentId: AgentId): Promise<AgentPortfolio | null> => null,
    saveTrade: async (_trade: AgentTradeRecord) => {},
    loadTrades: async (_agentId: AgentId): Promise<AgentTradeRecord[]> => [],
    updatePortfolio: async (_portfolio: AgentPortfolio) => {},
  };
}

/**
 * Convert portfolio to record
 */
export function portfolioToRecord(portfolio: AgentPortfolio): AgentPortfolioRecord {
  return {
    agentId: portfolio.agentId,
    portfolio,
    updatedAt: portfolio.lastUpdated,
  };
}


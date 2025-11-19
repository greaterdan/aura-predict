/**
 * Bridge to load TypeScript agent trading modules
 * Uses tsx to dynamically import TypeScript files
 * 
 * NOTE: This requires the server to be run with: node --import tsx server/index.js
 * Or use tsx directly: tsx server/index.js
 */

// Try to use tsx register if available
let tsxRegistered = false;
try {
  const { register } = await import('tsx/esm/api').catch(() => null);
  if (register) {
    register();
    tsxRegistered = true;
  }
} catch (e) {
  // tsx not available - will try direct import
}

let generateAgentTrades, getAgentProfile, isValidAgentId, ALL_AGENT_IDS, buildAgentSummary, computeSummaryStats, calculateAllAgentStats, getCachedTradesQuick;

try {
  // Import TypeScript modules (tsx will handle .ts extension)
  console.log('[API] Attempting to load TypeScript modules...');
  
  const agentsModule = await import('../../src/lib/agents/generator.ts');
  console.log('[API] generator.ts loaded, exports:', Object.keys(agentsModule));
  
  const domainModule = await import('../../src/lib/agents/domain.ts');
  console.log('[API] domain.ts loaded, exports:', Object.keys(domainModule));
  
  const summaryModule = await import('../../src/lib/agents/summary.ts');
  console.log('[API] summary.ts loaded, exports:', Object.keys(summaryModule));
  
  const statsModule = await import('../../src/lib/agents/stats.ts');
  console.log('[API] stats.ts loaded, exports:', Object.keys(statsModule));
  
  const cacheModule = await import('../../src/lib/agents/cache.ts');
  console.log('[API] cache.ts loaded, exports:', Object.keys(cacheModule));
  
  // Verify exports exist
  if (!agentsModule.generateAgentTrades) {
    throw new Error('generateAgentTrades not found in generator.ts');
  }
  if (!domainModule.getAgentProfile) {
    throw new Error('getAgentProfile not found in domain.ts');
  }
  if (!domainModule.isValidAgentId) {
    throw new Error('isValidAgentId not found in domain.ts');
  }
  if (!domainModule.ALL_AGENT_IDS) {
    throw new Error('ALL_AGENT_IDS not found in domain.ts');
  }
  if (!summaryModule.buildAgentSummary) {
    throw new Error('buildAgentSummary not found in summary.ts');
  }
  if (!summaryModule.computeSummaryStats) {
    throw new Error('computeSummaryStats not found in summary.ts');
  }
  if (!statsModule.calculateAllAgentStats) {
    throw new Error('calculateAllAgentStats not found in stats.ts');
  }
  
  generateAgentTrades = agentsModule.generateAgentTrades;
  getAgentProfile = domainModule.getAgentProfile;
  isValidAgentId = domainModule.isValidAgentId;
  ALL_AGENT_IDS = domainModule.ALL_AGENT_IDS;
  buildAgentSummary = summaryModule.buildAgentSummary;
  computeSummaryStats = summaryModule.computeSummaryStats;
  calculateAllAgentStats = statsModule.calculateAllAgentStats;
  getCachedTradesQuick = cacheModule.getCachedTradesQuick;
  
  console.log('[API] ✅ Successfully loaded TypeScript trading engine modules');
  console.log('[API] generateAgentTrades type:', typeof generateAgentTrades);
} catch (error) {
  console.error('[API] ❌ Failed to load TypeScript modules:', error.message);
  console.error('[API] Stack:', error.stack);
  console.error('[API] Make sure server is run with: node --import tsx server/index.js');
  throw error;
}

export {
  generateAgentTrades,
  getAgentProfile,
  isValidAgentId,
  ALL_AGENT_IDS,
  buildAgentSummary,
  computeSummaryStats,
  calculateAllAgentStats,
  getCachedTradesQuick,
};

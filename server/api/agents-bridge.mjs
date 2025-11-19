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

let generateAgentTrades, getAgentProfile, isValidAgentId, ALL_AGENT_IDS, buildAgentSummary, computeSummaryStats;

try {
  // Import TypeScript modules (tsx will handle .ts extension)
  const agentsModule = await import('../../src/lib/agents/generator.ts');
  const domainModule = await import('../../src/lib/agents/domain.ts');
  const summaryModule = await import('../../src/lib/agents/summary.ts');
  
  generateAgentTrades = agentsModule.generateAgentTrades;
  getAgentProfile = domainModule.getAgentProfile;
  isValidAgentId = domainModule.isValidAgentId;
  ALL_AGENT_IDS = domainModule.ALL_AGENT_IDS;
  buildAgentSummary = summaryModule.buildAgentSummary;
  computeSummaryStats = summaryModule.computeSummaryStats;
  
  console.log('[API] Successfully loaded TypeScript trading engine modules');
} catch (error) {
  console.error('[API] Failed to load TypeScript modules:', error.message);
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
};

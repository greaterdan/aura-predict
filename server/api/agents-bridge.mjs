/**
 * Bridge to load TypeScript agent trading modules
 * Uses tsx to dynamically import TypeScript files
 * 
 * NOTE: This requires the server to be run with: node --import tsx server/index.js
 * Or use tsx directly: tsx server/index.js
 */

// CRITICAL: Register tsx BEFORE any TypeScript imports
// This MUST happen synchronously at module load time
let tsxRegistered = false;
try {
  // Method 1: Try tsx/esm/api register (for tsx v4+)
  const tsxApi = await import('tsx/esm/api').catch(() => null);
  if (tsxApi?.register) {
    tsxApi.register();
    tsxRegistered = true;
    console.log('[API] ✅ tsx/esm/api registered');
  }
} catch (e) {
  // Continue to next method
}

// If Method 1 failed, try Method 2: Use createRequire
if (!tsxRegistered) {
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    require('tsx/esm/api');
    tsxRegistered = true;
    console.log('[API] ✅ tsx registered via require');
  } catch (e) {
    console.warn('[API] ⚠️ tsx require failed:', e.message);
  }
}

// If still not registered, log warning but continue
// The --import tsx flag should handle it
if (!tsxRegistered) {
  console.warn('[API] ⚠️ tsx not registered in bridge - relying on --import tsx flag');
  console.warn('[API] ⚠️ If you see "Unexpected token" errors, ensure server starts with: node --import tsx server/index.js');
}

let generateAgentTrades, getAgentProfile, isValidAgentId, ALL_AGENT_IDS, buildAgentSummary, computeSummaryStats, calculateAllAgentStats, getCachedTradesQuick, getAgentResearch;

try {
  // CRITICAL: Wait a moment to ensure tsx is fully registered
  if (!tsxRegistered) {
    console.log('[API] ⏳ Waiting for tsx registration...');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Import TypeScript modules (tsx will handle .ts extension)
  console.log('[API] Attempting to load TypeScript modules...');
  console.log('[API] tsx registered:', tsxRegistered);
  
  // Try importing compiled JS first, then fallback to TS
  let agentsModule;
  try {
    // Try compiled JS first (production)
    agentsModule = await import('../../dist-server/lib/agents/generator.js');
    console.log('[API] ✅ Loaded from compiled JS');
  } catch (jsError) {
    try {
      // Fallback to TypeScript (development with tsx)
      agentsModule = await import('../../src/lib/agents/generator.ts');
      console.log('[API] ✅ Loaded from TypeScript');
    } catch (tsError) {
      // Last resort: try without extension
      console.warn('[API] ⚠️ Both JS and TS imports failed, trying without extension');
      agentsModule = await import('../../src/lib/agents/generator');
    }
  }
  
  console.log('[API] generator.ts loaded, exports:', Object.keys(agentsModule));
  
  // Import other modules - try compiled JS first, then TS
  let domainModule, summaryModule, statsModule, cacheModule;
  
  try {
    domainModule = await import('../../dist-server/lib/agents/domain.js');
  } catch (e) {
    try {
      domainModule = await import('../../src/lib/agents/domain.ts');
    } catch (e2) {
      domainModule = await import('../../src/lib/agents/domain');
    }
  }
  console.log('[API] domain loaded, exports:', Object.keys(domainModule));
  
  try {
    summaryModule = await import('../../dist-server/lib/agents/summary.js');
  } catch (e) {
    try {
      summaryModule = await import('../../src/lib/agents/summary.ts');
    } catch (e2) {
      summaryModule = await import('../../src/lib/agents/summary');
    }
  }
  console.log('[API] summary loaded, exports:', Object.keys(summaryModule));
  
  try {
    statsModule = await import('../../dist-server/lib/agents/stats.js');
  } catch (e) {
    try {
      statsModule = await import('../../src/lib/agents/stats.ts');
    } catch (e2) {
      statsModule = await import('../../src/lib/agents/stats');
    }
  }
  console.log('[API] stats loaded, exports:', Object.keys(statsModule));
  
  try {
    cacheModule = await import('../../dist-server/lib/agents/cache.js');
  } catch (e) {
    try {
      cacheModule = await import('../../src/lib/agents/cache.ts');
    } catch (e2) {
      cacheModule = await import('../../src/lib/agents/cache');
    }
  }
  console.log('[API] cache loaded, exports:', Object.keys(cacheModule));
  
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
  getAgentResearch = agentsModule.getAgentResearch;
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
  getAgentResearch,
  getAgentProfile,
  isValidAgentId,
  ALL_AGENT_IDS,
  buildAgentSummary,
  computeSummaryStats,
  calculateAllAgentStats,
  getCachedTradesQuick,
};

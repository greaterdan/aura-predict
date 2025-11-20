/**
 * Bridge to load agent trading modules
 * 
 * PRODUCTION (Railway): Loads compiled JavaScript from dist-server/
 * DEVELOPMENT: Falls back to TypeScript with tsx if compiled JS not found
 */

// Detect environment - Railway sets NODE_ENV=production
const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production';

if (isProduction) {
  console.log('[API] 🚀 Production mode: Only loading compiled JavaScript');
} else {
  console.log('[API] 🔧 Development mode: May use TypeScript fallback');
  
  // CRITICAL: Only register tsx in development
  // In production, we MUST use compiled JS
  let tsxRegistered = false;
  try {
    const tsxApi = await import('tsx/esm/api').catch(() => null);
    if (tsxApi?.register) {
      tsxApi.register();
      tsxRegistered = true;
      console.log('[API] ✅ tsx/esm/api registered (development)');
    }
  } catch (e) {
    // Continue
  }
  
  if (!tsxRegistered) {
    try {
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      require('tsx/esm/api');
      tsxRegistered = true;
      console.log('[API] ✅ tsx registered via require (development)');
    } catch (e) {
      console.warn('[API] ⚠️ tsx require failed:', e.message);
    }
  }
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
  
  // CRITICAL: In production, ONLY load compiled JS - NEVER TypeScript
  // Railway must have compiled JS files from build:server
  let agentsModule;
  
  if (isProduction) {
    // PRODUCTION: Only try compiled JS, fail fast if not found
    // NEVER try TypeScript in production - Node.js can't parse it
    // Use path.resolve to ensure we're looking in the right place
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const jsPath = path.resolve(__dirname, '../../dist-server/lib/agents/generator.js');
    
    console.log('[API] 🔍 Production mode - attempting to load compiled JS');
    console.log('[API] 🔍 Resolved path:', jsPath);
    
    try {
      // Try relative path first (works in most cases)
      agentsModule = await import('../../dist-server/lib/agents/generator.js');
      console.log('[API] ✅ Loaded generator from compiled JS (production)');
    } catch (jsError) {
      console.error('[API] ❌ CRITICAL: Compiled JS not found in production!');
      console.error('[API] ❌ Error:', jsError.message);
      console.error('[API] ❌ Code:', jsError.code);
      console.error('[API] ❌ Relative path attempted: ../../dist-server/lib/agents/generator.js');
      console.error('[API] ❌ Absolute path would be:', jsPath);
      console.error('[API] ❌ This means "npm run build:server" did not run during Railway build');
      console.error('[API] ❌ Check Railway build logs for TypeScript compilation errors');
      console.error('[API] ❌ DO NOT attempt to load TypeScript - this will cause "Unexpected token" error');
      throw new Error('CRITICAL: Compiled JS not found. Railway build must include "npm run build:server". Check build logs.');
    }
  } else {
    // DEVELOPMENT: Try compiled JS first, fallback to TS with tsx
    try {
      agentsModule = await import('../../dist-server/lib/agents/generator.js');
      console.log('[API] ✅ Loaded generator from compiled JS (development)');
    } catch (jsError) {
      console.warn('[API] ⚠️ Compiled JS not found, trying TypeScript (development mode)');
      try {
        agentsModule = await import('../../src/lib/agents/generator.ts');
        console.log('[API] ✅ Loaded generator from TypeScript (development)');
      } catch (tsError) {
        throw new Error(`Failed to load generator: JS error: ${jsError.message}, TS error: ${tsError.message}`);
      }
    }
  }
  
  console.log('[API] generator.ts loaded, exports:', Object.keys(agentsModule));
  
  // Import other modules - ALWAYS try compiled JS first in production
  let domainModule, summaryModule, statsModule, cacheModule;
  
  const loadModule = async (modulePath, moduleName) => {
    if (isProduction) {
      // PRODUCTION: Only compiled JS - NEVER TypeScript
      const jsPath = `../../dist-server/lib/agents/${modulePath}.js`;
      try {
        const module = await import(jsPath);
        console.log(`[API] ✅ Loaded ${moduleName} from compiled JS (production)`);
        return module;
      } catch (jsError) {
        console.error(`[API] ❌ CRITICAL: Compiled ${moduleName} not found in production!`);
        console.error(`[API] ❌ Path attempted: ${jsPath}`);
        console.error(`[API] ❌ Error: ${jsError.message}`);
        throw new Error(`CRITICAL: Compiled ${moduleName} not found. Railway build must include "npm run build:server". Check build logs.`);
      }
    } else {
      // DEVELOPMENT: Try JS first, fallback to TS
      try {
        const jsPath = `../../dist-server/lib/agents/${modulePath}.js`;
        const module = await import(jsPath);
        console.log(`[API] ✅ Loaded ${moduleName} from compiled JS (development)`);
        return module;
      } catch (jsError) {
        try {
          const tsPath = `../../src/lib/agents/${modulePath}.ts`;
          const module = await import(tsPath);
          console.log(`[API] ✅ Loaded ${moduleName} from TypeScript (development)`);
          return module;
        } catch (tsError) {
          throw new Error(`Failed to load ${moduleName}: ${jsError.message}`);
        }
      }
    }
  };
  
  domainModule = await loadModule('domain', 'domain');
  summaryModule = await loadModule('summary', 'summary');
  statsModule = await loadModule('stats', 'stats');
  cacheModule = await loadModule('cache', 'cache');
  
  console.log('[API] domain loaded, exports:', Object.keys(domainModule));
  console.log('[API] summary loaded, exports:', Object.keys(summaryModule));
  console.log('[API] stats loaded, exports:', Object.keys(statsModule));
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

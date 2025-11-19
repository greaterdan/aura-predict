/**
 * Agent trading API endpoints
 * 
 * Express routes for fetching agent trades and summaries.
 * 
 * Uses tsx to run TypeScript modules directly.
 */

// Import TypeScript modules via bridge (uses tsx)
let generateAgentTrades, getAgentProfile, isValidAgentId, ALL_AGENT_IDS, buildAgentSummary, computeSummaryStats;

try {
  // Try to import via tsx bridge
  const bridge = await import('./agents-bridge.mjs');
  
  // Validate all required exports exist and are functions
  if (typeof bridge.generateAgentTrades !== 'function') {
    throw new Error('generateAgentTrades is not a function in bridge');
  }
  if (typeof bridge.getAgentProfile !== 'function') {
    throw new Error('getAgentProfile is not a function in bridge');
  }
  if (typeof bridge.isValidAgentId !== 'function') {
    throw new Error('isValidAgentId is not a function in bridge');
  }
  if (!bridge.ALL_AGENT_IDS || !Array.isArray(bridge.ALL_AGENT_IDS)) {
    throw new Error('ALL_AGENT_IDS is not an array in bridge');
  }
  if (typeof bridge.buildAgentSummary !== 'function') {
    throw new Error('buildAgentSummary is not a function in bridge');
  }
  if (typeof bridge.computeSummaryStats !== 'function') {
    throw new Error('computeSummaryStats is not a function in bridge');
  }
  
  generateAgentTrades = bridge.generateAgentTrades;
  getAgentProfile = bridge.getAgentProfile;
  isValidAgentId = bridge.isValidAgentId;
  ALL_AGENT_IDS = bridge.ALL_AGENT_IDS;
  buildAgentSummary = bridge.buildAgentSummary;
  computeSummaryStats = bridge.computeSummaryStats;
  
  console.log('[API] ✅ TypeScript modules loaded successfully');
} catch (error) {
  console.warn('[API] ⚠️ TypeScript modules not available. Using fallback.');
  console.warn('[API] Error:', error.message);
  console.warn('[API] Stack:', error.stack);
  console.warn('[API] Make sure tsx is installed and server is run with: node --import tsx server/index.js');
  
  // Fallback: Return placeholder data until TS is compiled
  const AGENT_PROFILES = {
    GROK_4: { id: 'GROK_4', displayName: 'GROK 4', avatar: '🔥' },
    GPT_5: { id: 'GPT_5', displayName: 'GPT-5', avatar: '✨' },
    DEEPSEEK_V3: { id: 'DEEPSEEK_V3', displayName: 'DEEPSEEK V3', avatar: '🔮' },
    GEMINI_2_5: { id: 'GEMINI_2_5', displayName: 'GEMINI 2.5', avatar: '♊' },
    CLAUDE_4_5: { id: 'CLAUDE_4_5', displayName: 'CLAUDE 4.5', avatar: '🧠' },
    QWEN_2_5: { id: 'QWEN_2_5', displayName: 'QWEN 2.5', avatar: '🤖' },
  };
  
  function isValidAgentId(id) {
    return id in AGENT_PROFILES;
  }
  
  function getAgentProfile(agentId) {
    return AGENT_PROFILES[agentId];
  }
  
  async function generateAgentTrades(agentId) {
    throw new Error('Trading engine not loaded. Please run server with: node --loader tsx server/index.js');
  }
  
  function buildAgentSummary(trades, agent) {
    return `${agent.displayName} has ${trades.length} trades.`;
  }
  
  function computeSummaryStats(tradesByAgent) {
    return {
      totalPnl: 0,
      openTradesCount: 0,
      closedTradesCount: 0,
      bestAgentByPnl: null,
    };
  }
  
  ALL_AGENT_IDS = Object.keys(AGENT_PROFILES);
}

/**
 * GET /api/agents/:agentId/trades
 * 
 * Fetch trades for a specific agent
 */
export async function getAgentTrades(req, res) {
  const requestStart = Date.now();
  try {
    const { agentId } = req.params;
    console.log(`[API:${req.id}] 📥 GET /api/agents/${agentId}/trades`);
    
    // Map frontend agent IDs to backend agent IDs
    const agentIdMap = {
      'grok': 'GROK_4',
      'gpt5': 'GPT_5',
      'deepseek': 'DEEPSEEK_V3',
      'gemini': 'GEMINI_2_5',
      'claude': 'CLAUDE_4_5',
      'qwen': 'QWEN_2_5',
    };
    
    const backendAgentId = agentIdMap[agentId.toLowerCase()] || agentId;
    
    // Validate agent ID
    if (!isValidAgentId(backendAgentId)) {
      return res.status(400).json({
        error: 'Invalid agent ID',
        provided: agentId,
        validIds: Object.keys(agentIdMap),
      });
    }
    
    // Generate trades (uses cache internally)
    console.log(`[API:${req.id}] 🤖 Generating trades for agent ${backendAgentId}...`);
    const trades = await generateAgentTrades(backendAgentId);
    console.log(`[API:${req.id}] ✅ Generated ${trades.length} trades for ${backendAgentId}`);
    
    const agent = getAgentProfile(backendAgentId);
    
    // Map trades to frontend format
    const mappedTrades = trades.map(trade => {
      const mapped = {
        id: trade.id,
        timestamp: new Date(trade.openedAt),
        market: trade.marketQuestion || trade.marketId, // Use marketQuestion if available, fallback to marketId
        decision: trade.side,
        confidence: Math.round(trade.confidence * 100),
        reasoning: trade.reasoning.join(' '),
        pnl: trade.pnl,
        status: trade.status,
        investmentUsd: trade.investmentUsd || 0, // Amount invested in this trade
        predictionId: trade.marketId, // Use marketId as predictionId for matching - MUST match prediction IDs
      };
      
      // Log for debugging
      if (trades.indexOf(trade) < 3) {
        console.log(`[API:${req.id}] 📋 Trade ${trades.indexOf(trade) + 1}: marketId="${trade.marketId}", marketQuestion="${trade.marketQuestion?.substring(0, 50)}..."`);
      }
      
      return mapped;
    });
    
    const duration = Date.now() - requestStart;
    console.log(`[API:${req.id}] ✅ Returning ${mappedTrades.length} trades (${duration}ms)`);
    
    res.json({
      agent: {
        id: agentId, // Return frontend ID
        name: agent.displayName,
        emoji: agent.avatar,
      },
      trades: mappedTrades,
    });
  } catch (error) {
    console.error(`[API:${req.id}] ❌ Error fetching trades for ${req.params.agentId}:`, error.message);
    console.error(`[API:${req.id}] Stack:`, error.stack);
    res.status(500).json({
      error: 'Failed to fetch agent trades',
      message: error.message,
    });
  }
}

/**
 * GET /api/agents/summary
 * 
 * Fetch summary for all agents
 */
export async function getAgentsSummary(req, res) {
  const requestStart = Date.now();
  try {
    console.log(`[API:${req.id}] 📥 GET /api/agents/summary`);
    
    const agentIds = ALL_AGENT_IDS || Object.keys(agentIdMap || {});
    console.log(`[API:${req.id}] 🤖 Generating trades for ${agentIds.length} agents: ${agentIds.join(', ')}`);
    
    // Fetch trades for all agents in parallel
    const results = await Promise.allSettled(
      agentIds.map(agentId => generateAgentTrades(agentId).catch(err => {
        console.warn(`[API] Failed to get trades for agent ${agentId} for summary: ${err.message}`);
        return []; // Return empty array for failed agents
      }))
    );
    
    const allTrades = results.map(r => r.status === 'fulfilled' ? r.value : []);
    const tradesByAgent = agentIds.reduce((acc, agentId, index) => {
      acc[agentId] = allTrades[index];
      const result = results[index];
      const tradeCount = allTrades[index]?.length || 0;
      if (result.status === 'fulfilled') {
        console.log(`[API:${req.id}] ✅ Agent ${agentId}: ${tradeCount} trades`);
      } else {
        console.log(`[API:${req.id}] ❌ Agent ${agentId}: Failed - ${result.reason?.message || 'Unknown error'}`);
      }
      return acc;
    }, {});
    
    const totalTrades = Object.values(tradesByAgent).reduce((sum, trades) => sum + (trades?.length || 0), 0);
    console.log(`[API:${req.id}] 📊 Total trades across all agents: ${totalTrades}`);
    
    const summaryStats = computeSummaryStats(tradesByAgent);
    const agentSummaries = agentIds.map(agentId => {
      const agent = getAgentProfile(agentId);
      const trades = tradesByAgent[agentId];
      return {
        agentId,
        summary: buildAgentSummary(trades, agent),
      };
    });
    
    // Map to frontend format
    const frontendAgentIdMap = {
      'GROK_4': 'grok',
      'GPT_5': 'gpt5',
      'DEEPSEEK_V3': 'deepseek',
      'GEMINI_2_5': 'gemini',
      'CLAUDE_4_5': 'claude',
      'QWEN_2_5': 'qwen',
    };
    
    const agents = agentIds.map(agentId => {
      const agent = getAgentProfile(agentId);
      const trades = tradesByAgent[agentId] || [];
      const openTrades = trades.filter(t => t.status === 'OPEN');
      const closedTrades = trades.filter(t => t.status === 'CLOSED');
      const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const lastTrade = trades.length > 0 ? trades[0] : null;
      
      // Generate status message based on activity
      let statusMessage = 'Analyzing markets...';
      if (trades.length > 0) {
        statusMessage = lastTrade ? `${lastTrade.side} on market @ ${(lastTrade.confidence * 100).toFixed(0)}% confidence` : `${trades.length} trades active`;
      } else {
        statusMessage = `Researching ${agent.focusCategories.join(', ')} markets...`;
      }
      
      return {
        id: frontendAgentIdMap[agentId] || agentId.toLowerCase(),
        name: agent.displayName,
        emoji: agent.avatar,
        isActive: trades.length > 0, // Active if has trades
        pnl: totalPnl,
        openMarkets: openTrades.length,
        lastTrade: lastTrade ? `${lastTrade.side} on ${lastTrade.marketId} @ $${(lastTrade.confidence * 100).toFixed(0)}%` : statusMessage,
        status: statusMessage, // Add status field for UI
      };
    });
    
    const duration = Date.now() - requestStart;
    console.log(`[API:${req.id}] ✅ Summary complete: ${agents.length} agents, ${totalTrades} total trades (${duration}ms)`);
    
    res.json({
      agents,
      tradesByAgent,
      summary: {
        ...summaryStats,
        agentSummaries,
      },
    });
  } catch (error) {
    console.error(`[API:${req.id}] ❌ Error fetching agents summary:`, error.message);
    console.error(`[API:${req.id}] Stack:`, error.stack);
    res.status(500).json({
      error: 'Failed to fetch agents summary',
      message: error.message,
    });
  }
}





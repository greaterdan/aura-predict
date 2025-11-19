/**
 * Polymarket market data fetching
 * 
 * Fetches all markets from Polymarket API with in-memory caching.
 * Cache TTL: 60 seconds to balance freshness with API rate limits.
 */

import type { Market } from '../agents/domain';

/**
 * In-memory cache for Polymarket markets
 */
interface MarketCache {
  markets: Market[];
  cachedAt: number;
}

const MARKET_CACHE_TTL = 60 * 1000; // 60 seconds
let marketCache: MarketCache | null = null;

/**
 * Map Polymarket API response to our Market type
 * 
 * TODO: Adapt this to actual Polymarket API response structure
 * The interface is designed to make this mapping trivial once we have
 * the real API response format.
 * 
 * @param rawMarket - Raw market data from Polymarket API
 * @returns Market object
 */
function mapPolymarketMarket(rawMarket: any): Market {
  // TODO: Replace with actual Polymarket response mapping
  // This is a placeholder structure - adjust based on real API
  
  return {
    id: rawMarket.id || rawMarket.conditionId || String(rawMarket.slug),
    question: rawMarket.question || rawMarket.title || '',
    category: mapCategory(rawMarket.category || rawMarket.tags?.[0] || 'Other'),
    volumeUsd: parseFloat(rawMarket.volume || rawMarket.volume24h || '0'),
    liquidityUsd: parseFloat(rawMarket.liquidity || rawMarket.liquidityUsd || '0'),
    currentProbability: parseFloat(rawMarket.probability || rawMarket.currentPrice || '0.5'),
    priceChange24h: parseFloat(rawMarket.priceChange24h || rawMarket.change24h || '0'),
    raw: rawMarket, // Store raw for debugging
  };
}

/**
 * Map Polymarket category string to our Category type
 * 
 * Handles null, undefined, and non-string values safely.
 */
function mapCategory(category: string | null | undefined | unknown): Market['category'] {
  // Handle null, undefined, or non-string values
  if (!category || typeof category !== 'string') {
    return 'Other';
  }
  
  const normalized = category.trim();
  if (!normalized) {
    return 'Other';
  }
  
  const categoryMap: Record<string, Market['category']> = {
    'crypto': 'Crypto',
    'cryptocurrency': 'Crypto',
    'technology': 'Tech',
    'tech': 'Tech',
    'finance': 'Finance',
    'financial': 'Finance',
    'politics': 'Politics',
    'political': 'Politics',
    'elections': 'Elections',
    'election': 'Elections',
    'sports': 'Sports',
    'entertainment': 'Entertainment',
    'world': 'World',
    'geopolitics': 'Geopolitics',
    'geopolitical': 'Geopolitics',
  };
  
  return categoryMap[normalized.toLowerCase()] || 'Other';
}

/**
 * Fetch all markets from Polymarket API
 * 
 * Uses in-memory cache with 60-second TTL.
 * If API fails, returns last cached copy if available.
 * 
 * @returns Array of Market objects
 * 
 * @throws Never throws - always returns array (empty on error)
 */
export async function fetchAllMarkets(): Promise<Market[]> {
  // Check cache first
  if (marketCache) {
    const age = Date.now() - marketCache.cachedAt;
    if (age < MARKET_CACHE_TTL) {
      console.log(`[Polymarket] 💾 Cache hit: ${marketCache.markets.length} markets (age: ${Math.round(age / 1000)}s)`);
      return marketCache.markets;
    }
    console.log(`[Polymarket] ⏰ Cache expired (age: ${Math.round(age / 1000)}s), fetching new markets...`);
  } else {
    console.log(`[Polymarket] 📊 No cache - fetching markets...`);
  }
  
  try {
    // Use the SAME API structure as bubble maps
    // Bubble maps use: /api/predictions -> server/services/polymarketService.js -> fetchAllMarkets()
    // Trading engine uses: This function -> server/services/polymarketService.js -> fetchAllMarkets()
    // Same API keys, same function, same structure - just different cache
    
    // Check if we're running server-side (Node.js environment)
    const isServerSide = typeof process !== 'undefined' && process.versions?.node;
    
    if (isServerSide) {
      // Server-side: Use the EXACT same function as bubble maps
      const { fetchAllMarkets } = await import('../../../server/services/polymarketService.js');
      
      // Fetch markets using the same function as bubble maps
      // Uses same API keys: POLYMARKET_API_KEY, POLYMARKET_SECRET, POLYMARKET_PASSPHRASE
      const rawMarkets = await fetchAllMarkets({
        category: null,
        active: true,
        maxPages: 5, // Get enough markets for trading (5 pages = ~5000 markets)
        limitPerPage: 1000,
      });
      
      console.log(`[Polymarket] ✅ Fetched ${rawMarkets.length} raw markets from API`);
      
      // Map Polymarket response to trading engine Market format
      // IMPORTANT: Use EXACT same ID extraction logic as marketTransformer.js to ensure matching
      const markets = rawMarkets.map((rawMarket: any) => {
        const actualMarket = rawMarket.market || rawMarket;
        
        const question = actualMarket.question || actualMarket.title || '';
        
        // Extract market ID using EXACT same logic as predictions (marketTransformer.js line 624-635)
        // This ensures market IDs match prediction IDs exactly
        // Predictions use: condition_id || question_id || slug || id || market_id
        let marketId = actualMarket.condition_id || 
                      actualMarket.question_id || 
                      actualMarket.slug || 
                      actualMarket.id ||
                      actualMarket.market_id ||
                      rawMarket.condition_id ||
                      rawMarket.question_id ||
                      rawMarket.slug ||
                      rawMarket.id;
        
        // If no ID found, generate one using EXACT same logic as predictions (line 630-635)
        if (!marketId && question) {
          const questionHash = question.split('').reduce((acc: number, char: string) => {
            return ((acc << 5) - acc) + char.charCodeAt(0);
          }, 0);
          marketId = `market-${question.substring(0, 30).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}-${Math.abs(questionHash).toString(36)}`;
        }
        
        if (!marketId) {
          // Skip markets without any ID
          return null;
        }
        
        const volume = parseFloat(actualMarket.volume || actualMarket.volume24h || '0');
        const liquidity = parseFloat(actualMarket.liquidity || actualMarket.liquidityUsd || '0');
        const probability = parseFloat(actualMarket.probability || actualMarket.currentPrice || '0.5');
        
        // Safely extract category - handle arrays, objects, null, undefined
        let categoryValue: string | null | undefined = null;
        if (actualMarket.category) {
          categoryValue = typeof actualMarket.category === 'string' 
            ? actualMarket.category 
            : String(actualMarket.category);
        } else if (actualMarket.tags && Array.isArray(actualMarket.tags) && actualMarket.tags.length > 0) {
          const firstTag = actualMarket.tags[0];
          categoryValue = typeof firstTag === 'string' ? firstTag : String(firstTag);
        }
        
        // Use marketId - MUST match prediction IDs exactly
        // Don't filter out slug-based IDs - they're valid prediction IDs
        // Only skip generated IDs (market-* prefix) if they don't have condition_id or slug
        marketId = String(marketId);
        
        return {
          id: marketId, // Use condition_id to match prediction IDs
          question,
          category: mapCategory(categoryValue),
          volumeUsd: volume,
          liquidityUsd: liquidity,
          currentProbability: probability,
          priceChange24h: 0, // Will be calculated if needed
          raw: actualMarket,
        };
      }).filter((m: Market | null): m is Market => {
        return m !== null && m.id && m.question && !isNaN(m.volumeUsd) && !isNaN(m.currentProbability);
      });
      
      console.log(`[Polymarket] ✅ Mapped to ${markets.length} valid markets`);
      
      // Update cache (separate cache from bubble maps to avoid conflicts)
      marketCache = {
        markets,
        cachedAt: Date.now(),
      };
      
      return markets;
    }
    
    // Client-side fallback (shouldn't happen for trading engine)
    // Use environment variables for URL and key
    const apiUrl = process.env.POLYMARKET_API_URL || 'https://gamma-api.polymarket.com/markets';
    const apiKey = process.env.POLYMARKET_API_KEY;
    
    const headers: HeadersInit = {
      'Accept': 'application/json',
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const rawMarkets = Array.isArray(data) ? data : (data.markets || data.results || []);
    
    const markets = rawMarkets.map(mapPolymarketMarket).filter((m: Market) => {
      return m.id && m.question && !isNaN(m.volumeUsd) && !isNaN(m.currentProbability);
    });
    
    // Update cache
    marketCache = {
      markets,
      cachedAt: Date.now(),
    };
    
    return markets;
  } catch (error) {
    console.error('[Polymarket] Failed to fetch markets:', error);
    
    // Return cached data if available, even if expired
    if (marketCache) {
      console.warn('[Polymarket] Returning stale cache due to API error');
      return marketCache.markets;
    }
    
    // No cache available - return empty array
    return [];
  }
}

/**
 * Clear the market cache (useful for testing)
 */
export function clearMarketCache(): void {
  marketCache = null;
}







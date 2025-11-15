// Polymarket API Service
// Note: In production, these credentials should be stored in environment variables
// and API calls should be made through a backend proxy to avoid exposing secrets

// Using Polymarket's API endpoints
// Note: Polymarket's public API structure - trying multiple known endpoints
const POLYMARKET_API_BASE = 'https://clob.polymarket.com';
const POLYMARKET_DATA_API = 'https://data-api.polymarket.com';
const POLYMARKET_GRAPHQL = 'https://data-api.polymarket.com/graphql';
// Polymarket's public frontend API (used by their website)
const POLYMARKET_PUBLIC_API = 'https://api.polymarket.com';
const POLYMARKET_WEBSITE_API = 'https://polymarket.com';

// API Credentials (should be moved to environment variables in production)
export const POLYMARKET_CONFIG = {
  apiKey: '019a8543-9674-7c1f-8f77-8b1a1365fe67',
  secret: 'EXKuOeXjqt0lRIM-KBpdPQyth34ZilHKJLYv6jTXa5w=',
  passphrase: 'e7694b050d029d85fe3efe00353017f8bd3e53f617b410d09dc55346efd7889d',
};

export interface PolymarketMarket {
  condition_id: string;
  question: string;
  slug: string;
  resolution_source: string;
  end_date_iso: string;
  image?: string;
  description?: string;
  icon?: string;
  active: boolean;
  closed: boolean;
  new?: boolean;
  featured?: boolean;
  liquidity?: number;
  volume?: number;
  volume_24h?: number;
  volume_7d?: number;
  current_price?: number;
  outcome_prices?: {
    '0': string; // YES price
    '1': string; // NO price
  };
  tags?: string[];
  category?: string;
  subcategory?: string;
  token_id?: string;
  end_date?: string;
  start_date?: string;
  created_at?: string;
}

export interface PolymarketMarketsResponse {
  markets?: PolymarketMarket[];
  data?: PolymarketMarket[];
  count?: number;
  cursor?: string;
}

// Helper function to map Polymarket category to our categories
export const mapPolymarketCategory = (category: string | undefined, tags: string[] = []): string => {
  const categoryLower = category?.toLowerCase() || '';
  const tagsLower = tags?.map(t => t.toLowerCase()) || [];
  
  // Check for specific categories
  if (categoryLower.includes('politics') || categoryLower.includes('election') || 
      tagsLower.some(t => t.includes('politics') || t.includes('election') || t.includes('trump'))) {
    return 'Politics';
  }
  if (categoryLower.includes('sports') || tagsLower.some(t => t.includes('sports') || t.includes('football') || t.includes('basketball'))) {
    return 'Sports';
  }
  if (categoryLower.includes('crypto') || categoryLower.includes('cryptocurrency') ||
      tagsLower.some(t => t.includes('crypto') || t.includes('bitcoin') || t.includes('ethereum') || t.includes('btc') || t.includes('eth'))) {
    return 'Crypto';
  }
  if (categoryLower.includes('entertainment') || tagsLower.some(t => t.includes('movie') || t.includes('tv') || t.includes('film'))) {
    return 'Breaking';
  }
  if (categoryLower.includes('tech') || categoryLower.includes('technology') ||
      tagsLower.some(t => t.includes('tech') || t.includes('ai') || t.includes('artificial intelligence'))) {
    return 'Tech';
  }
  if (tagsLower.some(t => t.includes('trending'))) {
    return 'Trending';
  }
  if (tagsLower.some(t => t.includes('breaking'))) {
    return 'Breaking';
  }
  return 'World';
};

// Use local proxy server to avoid CORS issues
const PROXY_BASE = 'http://localhost:3002';

// Fetch markets from Polymarket via proxy server
export const fetchPolymarketMarkets = async (
  limit: number = 50,
  cursor?: string,
  category?: string,
  active: boolean = false // Default to false to get ALL markets
): Promise<PolymarketMarketsResponse> => {
  console.log('🔍 Fetching Polymarket markets via proxy...');
  
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      active: active.toString(),
      ...(cursor && { cursor }),
      ...(category && { category: category.toLowerCase() }),
    });

    // Call our proxy server
    const response = await fetch(`${PROXY_BASE}/api/polymarket/markets?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Proxy server error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Proxy response:', data);
    
    if (data.markets && Array.isArray(data.markets)) {
      console.log(`✅ Found ${data.markets.length} markets from Polymarket API`);
      return { markets: data.markets, count: data.markets.length };
    }
    
    throw new Error('Invalid response format from proxy');
  } catch (error) {
    console.error('❌ Error fetching via proxy:', error);
    // Return empty to trigger fallback
    return { markets: [], count: 0 };
  }
};

// Fetch featured/trending markets via proxy
export const fetchFeaturedMarkets = async (): Promise<PolymarketMarket[]> => {
  try {
    const response = await fetch(`${PROXY_BASE}/api/polymarket/markets?featured=true&limit=20&active=true`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Proxy server error: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data.markets) ? data.markets : [];
  } catch (error) {
    console.error('Error fetching featured markets:', error);
    return [];
  }
};

// Fetch markets by category via proxy
export const fetchMarketsByCategory = async (category: string): Promise<PolymarketMarket[]> => {
  try {
    const response = await fetch(`${PROXY_BASE}/api/polymarket/markets?category=${encodeURIComponent(category)}&limit=50&active=true`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Proxy server error: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data.markets) ? data.markets : [];
  } catch (error) {
    console.error('Error fetching markets by category:', error);
    return [];
  }
};

// Helper to transform Polymarket market to PredictionNodeData format
export const transformPolymarketToPrediction = (
  market: any, // Using any to handle different Polymarket API response structures
  agentName: string
): import('@/components/PredictionNode').PredictionNodeData | null => {
  try {
    // Skip if no question (required field)
    if (!market.question || market.question.trim() === '') {
      return null;
    }
    
    // Handle different Polymarket API response structures
    let yesPrice = 0.5;
    let noPrice = 0.5;
    
    // Check if market has tokens array (newer API structure) - this is the most common format
    if (market.tokens && Array.isArray(market.tokens) && market.tokens.length >= 2) {
      // Find YES token (usually "Yes" or first token)
      const yesToken = market.tokens.find((t: any) => 
        t.outcome === 'Yes' || t.outcome === 'YES' || 
        t.outcome?.toLowerCase().includes('yes')
      ) || market.tokens[0];
      
      // Find NO token (usually "No" or second token)
      const noToken = market.tokens.find((t: any) => 
        t.outcome === 'No' || t.outcome === 'NO' || 
        (t.outcome?.toLowerCase().includes('no') && t !== yesToken)
      ) || market.tokens[1];
      
      yesPrice = parseFloat(yesToken?.price || '0.5');
      noPrice = parseFloat(noToken?.price || (1 - yesPrice).toString());
    } 
    // Check if market has tokens array with only one token (use it as YES, calculate NO)
    else if (market.tokens && Array.isArray(market.tokens) && market.tokens.length === 1) {
      yesPrice = parseFloat(market.tokens[0]?.price || '0.5');
      noPrice = 1 - yesPrice;
    }
    // Check if market has outcome_prices (older API structure)
    else if (market.outcome_prices) {
      yesPrice = parseFloat(market.outcome_prices['0'] || '0.5');
      noPrice = parseFloat(market.outcome_prices['1'] || (1 - yesPrice).toString());
    }
    // Check if market has current_price
    else if (market.current_price !== undefined && market.current_price !== null) {
      yesPrice = parseFloat(market.current_price);
      noPrice = 1 - yesPrice;
    }
    // Default: use 50/50 if no price info available
    else {
      yesPrice = 0.5;
      noPrice = 0.5;
    }
    
    // Ensure prices are valid
    if (isNaN(yesPrice) || yesPrice < 0) yesPrice = 0.5;
    if (isNaN(noPrice) || noPrice < 0) noPrice = 0.5;
    
    // Normalize if they don't sum to 1
    const total = yesPrice + noPrice;
    if (total > 0) {
      yesPrice = yesPrice / total;
      noPrice = noPrice / total;
    }
    
    // Determine position based on which price is higher
    const position: 'YES' | 'NO' = yesPrice >= noPrice ? 'YES' : 'NO';
    const currentPrice = position === 'YES' ? yesPrice : noPrice;
    const probability = Math.max(1, Math.min(99, Math.round(currentPrice * 100)));
    
    // Calculate change (mock for now, would need historical data)
    const change = parseFloat((Math.random() * 10 - 5).toFixed(1)); // Random change between -5 and +5
    
    // Get market ID - use multiple fallbacks
    const marketId = market.condition_id || 
                     market.question_id || 
                     market.slug || 
                     market.id ||
                     `market-${market.question?.substring(0, 30).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}` ||
                     `market-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: marketId,
      question: market.question.trim(),
      probability,
      position,
      price: currentPrice,
      change,
      agentName,
      agentEmoji: '', // Will be replaced with logo
      reasoning: market.description || `Market analysis based on ${market.category || market.tags?.[0] || 'general'} category.`,
    };
  } catch (error) {
    console.error('Error transforming Polymarket market:', error, market);
    return null;
  }
};


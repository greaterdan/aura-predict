// Vercel serverless function for /api/predictions
import { fetchAllMarkets } from '../server/services/polymarketService.js';
import { transformMarkets } from '../server/services/marketTransformer.js';
import { mapCategoryToPolymarket } from '../server/utils/categoryMapper.js';

// Cache for predictions (5 minute cache)
let predictionsCache = {
  data: null,
  timestamp: null,
  category: null,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
};

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { category = 'All Markets', limit = 10000, search = null } = req.query;
    
    // Check cache first (but don't cache search results - they should be fresh)
    const cacheNow = Date.now();
    const isSearching = search && search.trim();
    if (!isSearching && predictionsCache.data && 
        predictionsCache.category === category &&
        predictionsCache.timestamp && 
        (cacheNow - predictionsCache.timestamp) < predictionsCache.CACHE_DURATION) {
      console.log(`[CACHE HIT] Returning cached predictions for category: ${category}`);
      return res.json(predictionsCache.data);
    }
    
    console.log(`[CACHE MISS] Fetching fresh predictions for category: ${category}${isSearching ? ` (search: ${search})` : ''}`);
    
    // Map category to Polymarket category
    let polymarketCategory = null;
    if (category !== 'All Markets' && category !== 'Trending' && category !== 'Breaking' && category !== 'New') {
      polymarketCategory = mapCategoryToPolymarket(category);
    }
    
    // Fetch markets from Polymarket
    const maxMarkets = isSearching 
      ? 10000
      : category === 'All Markets' ? 500 : 5000;
    
    let markets = await fetchAllMarkets({
      category: polymarketCategory,
      active: true,
      maxPages: Math.ceil(maxMarkets / 1000) + 1,
      limitPerPage: 1000,
      searchQuery: isSearching ? search.trim() : null,
    });
    
    // ALWAYS fetch all markets for Earnings, Geopolitics, and Elections
    if (category === 'Earnings' || category === 'Geopolitics' || category === 'Elections') {
      console.log(`Fetching ALL markets for ${category} category (will filter by detection)...`);
      const allMarkets = await fetchAllMarkets({
        category: null,
        active: true,
        maxPages: Math.ceil(3000 / 1000) + 1,
        limitPerPage: 1000,
        searchQuery: isSearching ? search.trim() : null,
      });
      markets = allMarkets;
      console.log(`Fetched ${markets.length} total markets for ${category} detection`);
    } else if (markets.length < 50 && polymarketCategory) {
      console.log(`Category search for ${category} returned only ${markets.length} markets. Trying without category filter...`);
      const allMarkets = await fetchAllMarkets({
        category: null,
        active: true,
        maxPages: Math.ceil(2000 / 1000) + 1,
        limitPerPage: 1000,
        searchQuery: isSearching ? search.trim() : null,
      });
      markets = allMarkets;
    }
    
    // Limit markets for "All Markets" category
    const limitedMarkets = (category === 'All Markets' && !isSearching) 
      ? markets.slice(0, 500) 
      : markets;
    
    // Transform markets to predictions
    const predictions = await transformMarkets(limitedMarkets);
    
    // Apply server-side search filtering if search query provided
    let searchFilteredPredictions = predictions;
    if (isSearching) {
      const searchLower = search.toLowerCase().trim();
      searchFilteredPredictions = predictions.filter(p => {
        const question = (p.question || '').toLowerCase();
        const category = (p.category || '').toLowerCase();
        const description = (p.description || '').toLowerCase();
        return question.includes(searchLower) || 
               category.includes(searchLower) || 
               description.includes(searchLower);
      });
      console.log(`Search "${search}" filtered ${predictions.length} predictions down to ${searchFilteredPredictions.length}`);
    }
    
    // Filter by category if needed
    let filteredPredictions = searchFilteredPredictions;
    if (category !== 'All Markets') {
      filteredPredictions = searchFilteredPredictions.filter(p => {
        if (category === 'Trending' || category === 'Breaking' || category === 'New') {
          return true;
        }
        const marketCategory = (p.category || 'World');
        if (marketCategory === category) {
          return true;
        }
        if (category === 'Elections' && marketCategory === 'Politics') {
          return true;
        }
        if (category === 'Geopolitics' && marketCategory === 'Politics') {
          return true;
        }
        if (category === 'Earnings' && marketCategory === 'Finance') {
          return true;
        }
        return false;
      });
      console.log(`Filtered ${filteredPredictions.length} predictions for category: ${category}`);
    }
    
    // Apply limit if specified
    if (limit && parseInt(limit) > 0) {
      filteredPredictions = filteredPredictions.slice(0, parseInt(limit));
    }
    
    // Cache the response AFTER filtering
    const responseData = {
      predictions: filteredPredictions,
      count: filteredPredictions.length,
      totalFetched: markets.length,
      totalTransformed: predictions.length,
    };
    
    if (!isSearching) {
      predictionsCache = {
        data: responseData,
        timestamp: Date.now(),
        category: category,
        CACHE_DURATION: 5 * 60 * 1000,
      };
    }
    
    return res.json(responseData);
  } catch (error) {
    console.error('Error in predictions endpoint:', error);
    return res.status(500).json({ 
      error: error.message,
      predictions: [],
      count: 0,
    });
  }
}


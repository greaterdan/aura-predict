// Express proxy server for Polymarket API
// All market processing happens server-side

import express from 'express';
import cors from 'cors';
import { fetchAllMarkets } from './services/polymarketService.js';
import { transformMarkets } from './services/marketTransformer.js';
import { mapCategoryToPolymarket } from './utils/categoryMapper.js';

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// Health check endpoints
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Polymarket proxy server is running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Polymarket proxy server is running', timestamp: new Date().toISOString() });
});

// Cache for predictions (5 minute cache - markets don't change that frequently)
let predictionsCache = {
  data: null,
  timestamp: null,
  category: null,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
};

// Main endpoint: Get predictions (ready-to-use format)
app.get('/api/predictions', async (req, res) => {
  try {
    const { category = 'All Markets', limit = 10000 } = req.query;
    
    // Check cache first
    const cacheNow = Date.now();
    if (predictionsCache.data && 
        predictionsCache.category === category &&
        predictionsCache.timestamp && 
        (cacheNow - predictionsCache.timestamp) < predictionsCache.CACHE_DURATION) {
      console.log(`[CACHE HIT] Returning cached predictions for category: ${category}`);
      return res.json(predictionsCache.data);
    }
    
    console.log(`[CACHE MISS] Fetching fresh predictions for category: ${category}`);
    
    // Map category to Polymarket category
    let polymarketCategory = null;
    if (category !== 'All Markets' && category !== 'Trending' && category !== 'Breaking' && category !== 'New') {
      polymarketCategory = mapCategoryToPolymarket(category);
    }
    
    // Fetch markets from Polymarket - limit to 100 for "All Markets" to reduce glitchiness
    // For specific categories, fetch more markets to ensure we get enough
    const maxMarkets = category === 'All Markets' ? 100 : 2000;
    let markets = await fetchAllMarkets({
      category: polymarketCategory,
      active: true,
      maxPages: Math.ceil(maxMarkets / 1000) + 1, // Fetch more pages for category searches
      limitPerPage: 1000,
    });
    
    // ALWAYS fetch all markets for Earnings, Geopolitics, and Elections
    // and rely on category detection from actual market data
    if (category === 'Earnings' || category === 'Geopolitics' || category === 'Elections') {
      console.log(`Fetching ALL markets for ${category} category (will filter by detection)...`);
      const allMarkets = await fetchAllMarkets({
        category: null, // Fetch all markets - don't filter by API category
        active: true,
        maxPages: Math.ceil(3000 / 1000) + 1, // Fetch more to find enough markets
        limitPerPage: 1000,
      });
      markets = allMarkets; // Use all markets, will filter by detection below
      console.log(`Fetched ${markets.length} total markets for ${category} detection`);
    } else if (markets.length < 50 && polymarketCategory) {
      console.log(`Category search for ${category} returned only ${markets.length} markets. Trying without category filter...`);
      const allMarkets = await fetchAllMarkets({
        category: null, // Fetch all markets
        active: true,
        maxPages: Math.ceil(2000 / 1000) + 1,
        limitPerPage: 1000,
      });
      markets = allMarkets; // Use all markets, will filter by detection below
    }
    
    // Limit markets for "All Markets" category
    const limitedMarkets = category === 'All Markets' ? markets.slice(0, 100) : markets;
    
    // Transform markets to predictions (server-side filtering and transformation)
    // Note: transformMarkets is now async to fetch prices from /prices endpoint
    const predictions = await transformMarkets(limitedMarkets);
    
    // DEBUG: Log category distribution
    const categoryCounts = {};
    predictions.forEach(p => {
      const cat = p.category || 'World';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    console.log(`Category distribution:`, categoryCounts);
    console.log(`Total predictions: ${predictions.length}`);
    
    // Filter by category if needed (client-side category filtering)
    let filteredPredictions = predictions;
    if (category !== 'All Markets') {
      filteredPredictions = predictions.filter(p => {
        if (category === 'Trending' || category === 'Breaking' || category === 'New') {
          // For these, show all (or implement specific logic)
          return true;
        }
        // Match category - be flexible with category names
        const marketCategory = (p.category || 'World');
        // Allow matching if category matches or if it's a related category
        if (marketCategory === category) {
          return true;
        }
        // For Elections, also accept Politics markets
        if (category === 'Elections' && marketCategory === 'Politics') {
          return true;
        }
        // For Geopolitics, also accept Politics markets
        if (category === 'Geopolitics' && marketCategory === 'Politics') {
          return true;
        }
        // For Earnings, also accept Finance markets
        if (category === 'Earnings' && marketCategory === 'Finance') {
          return true;
        }
        return false;
      });
      console.log(`Filtered ${filteredPredictions.length} predictions for category: ${category}`);
      if (filteredPredictions.length > 0) {
        console.log(`Sample filtered prediction:`, {
          question: filteredPredictions[0].question?.substring(0, 50),
          category: filteredPredictions[0].category
        });
      }
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
    
    predictionsCache = {
      data: responseData,
      timestamp: Date.now(),
      category: category,
      CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
    };
    
    res.json(responseData);
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      predictions: [],
      count: 0,
    });
  }
});

// Legacy endpoint for backwards compatibility
app.get('/api/polymarket/markets', async (req, res) => {
  try {
    const { limit = 50, active = 'true', category, offset = 0 } = req.query;
    
    // Map category
    let polymarketCategory = null;
    if (category) {
      polymarketCategory = mapCategoryToPolymarket(category);
    }
    
    // Fetch markets
    const markets = await fetchAllMarkets({
      category: polymarketCategory,
      active: active === 'true',
      maxPages: Math.ceil((parseInt(limit) || 50) / 1000) + 1,
      limitPerPage: 1000,
    });
    
    // Apply offset and limit
    const offsetNum = parseInt(offset) || 0;
    const limitNum = parseInt(limit) || 50;
    const paginatedMarkets = markets.slice(offsetNum, offsetNum + limitNum);
    
    res.json({
      markets: paginatedMarkets,
      count: paginatedMarkets.length,
      total: markets.length,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      markets: [],
      count: 0,
    });
  }
});

// News API proxy endpoint with caching
const NEWS_API_KEY = '245568e9eb38441fbe7f2e48527932d8';
const NEWS_API_URL = 'https://newsapi.org/v2/everything';
const NEWSDATA_API_KEY = 'pub_c8c2a4c6f89848319fc7c5798cd1c287';
const NEWSDATA_API_URL = 'https://newsdata.io/api/1/news';
// GNews API - Get your free API key from https://gnews.io/register
// You can either set it as an environment variable: GNEWS_API_KEY=your_key_here
// Or replace the empty string below with your API key
const GNEWS_API_KEY = process.env.GNEWS_API_KEY || 'ff4c132f93616db0e87009c771ea52db';
const GNEWS_API_URL = 'https://gnews.io/api/v4/search';

// Simple in-memory cache (refresh every 5 minutes)
let newsCache = {
  data: null,
  timestamp: null,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
};

// Helper function to normalize title for deduplication
const normalizeTitle = (title) => {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// Deduplicate articles based on title similarity and URL
const deduplicateArticles = (articles) => {
  const seen = new Map();
  const uniqueArticles = [];
  
  for (const article of articles) {
    const normalizedTitle = normalizeTitle(article.title || '');
    const url = article.url || '';
    
    // Check if we've seen a similar title (exact match or very similar)
    let isDuplicate = false;
    for (const [key, existing] of seen.entries()) {
      const existingTitle = normalizeTitle(existing.title || '');
      
      // Check for exact URL match
      if (url && existing.url && url === existing.url) {
        isDuplicate = true;
        break;
      }
      
      // Check for very similar titles (same normalized title)
      if (normalizedTitle && existingTitle && normalizedTitle === existingTitle) {
        isDuplicate = true;
        break;
      }
      
      // Check for high similarity (one title contains the other or vice versa)
      if (normalizedTitle.length > 20 && existingTitle.length > 20) {
        if (normalizedTitle.includes(existingTitle) || existingTitle.includes(normalizedTitle)) {
          // If one is significantly longer, prefer the longer one
          if (Math.abs(normalizedTitle.length - existingTitle.length) < 10) {
            isDuplicate = true;
            break;
          }
        }
      }
    }
    
    if (!isDuplicate) {
      const key = normalizedTitle || url || `article-${uniqueArticles.length}`;
      seen.set(key, article);
      uniqueArticles.push(article);
    }
  }
  
  return uniqueArticles;
};

// Fetch news from NewsAPI
const fetchNewsAPI = async () => {
  // Get date from last 24 hours for freshest news
  const fromDate = new Date();
  fromDate.setHours(fromDate.getHours() - 24); // Last 24 hours
  const fromDateStr = fromDate.toISOString();
  
  // Get current date for 'to' parameter
  const toDate = new Date();
  const toDateStr = toDate.toISOString();
  
  // Try multiple queries to get more results
  const queries = [
    'prediction OR election',
    'cryptocurrency',
    'bitcoin',
    'ethereum',
    'blockchain',
    'stock market OR economy',
    'technology OR AI',
    'sports OR climate'
  ];
  
  const fetchPromises = queries.map(async (query) => {
    try {
      // Use from and to parameters for last 24 hours, sort by publishedAt (newest first)
      const url = `${NEWS_API_URL}?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=20&from=${fromDateStr}&to=${toDateStr}&apiKey=${NEWS_API_KEY}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        return [];
      }
      
      const data = await response.json();
      
      if (data.status === 'ok' && data.articles) {
        // Filter to only articles from last 24 hours (double-check)
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        return data.articles
          .filter(article => {
            if (!article.publishedAt) return false;
            const publishedDate = new Date(article.publishedAt);
            return publishedDate >= twentyFourHoursAgo;
          })
          .map(article => ({
            ...article,
            sourceApi: 'newsapi',
          }));
      }
      
      return [];
    } catch (error) {
      return [];
    }
  });
  
  const results = await Promise.all(fetchPromises);
  const allArticles = results.flat();
  
  // Remove duplicates based on URL
  const uniqueArticles = [];
  const seenUrls = new Set();
  
  for (const article of allArticles) {
    if (article.url && !seenUrls.has(article.url)) {
      seenUrls.add(article.url);
      uniqueArticles.push(article);
    }
  }
  
  return uniqueArticles;
};

// Fetch news from NewsData.io
const fetchNewsData = async () => {
  // Get date from last 24 hours for freshest news
  const fromDate = new Date();
  fromDate.setHours(fromDate.getHours() - 24);
  const fromDateStr = fromDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  
  // NewsData.io uses different query parameters - try multiple queries
  const queries = [
    'prediction',
    'election',
    'cryptocurrency',
    'bitcoin',
    'ethereum',
    'blockchain',
    'stock market',
    'economy',
    'technology',
    'sports',
    'climate'
  ];
  
  // Fetch from multiple queries and combine results
  const fetchPromises = queries.map(async (query) => {
    try {
      // NewsData.io supports time_from parameter for filtering by date
      const url = `${NEWSDATA_API_URL}?apikey=${NEWSDATA_API_KEY}&q=${encodeURIComponent(query)}&language=en&size=10&time_from=${fromDateStr}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        return [];
      }
      
      const data = await response.json();
      
      if (data.status === 'success' && data.results) {
        // Filter to only articles from last 24 hours (double-check)
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        return data.results.filter(article => {
          if (!article.pubDate) return false;
          const publishedDate = new Date(article.pubDate);
          return publishedDate >= twentyFourHoursAgo;
        });
      }
      
      return [];
    } catch (error) {
      return [];
    }
  });
  
  const results = await Promise.all(fetchPromises);
  const allArticles = results.flat();
  
  // Remove duplicates based on link
  const uniqueArticles = [];
  const seenLinks = new Set();
  
  for (const article of allArticles) {
    const link = article.link || article.guid;
    if (link && !seenLinks.has(link)) {
      seenLinks.add(link);
      uniqueArticles.push(article);
    }
  }
  
  // Transform NewsData.io format to match NewsAPI format
  return uniqueArticles.map(article => ({
    source: {
      id: article.source_id || null,
      name: article.source_name || 'Unknown',
    },
    author: article.creator?.[0] || null,
    title: article.title || '',
    description: article.description || null,
    url: article.link || article.guid || '',
    urlToImage: article.image_url || null,
    publishedAt: article.pubDate || new Date().toISOString(),
    content: article.content || null,
    sourceApi: 'newsdata',
  }));
};

// Fetch news from GNews
const fetchGNews = async () => {
  if (!GNEWS_API_KEY) {
    return [];
  }
  
  // Get date from last 24 hours for freshest news
  const fromDate = new Date();
  fromDate.setHours(fromDate.getHours() - 24);
  const fromDateStr = fromDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  
  // GNews has rate limits, so use fewer broader queries
  // Using broader queries to get more diverse results with fewer API calls
  const queries = [
    'prediction OR election',
    'cryptocurrency OR bitcoin OR ethereum OR crypto OR blockchain OR stock market',
    'technology OR economy',
    'sports OR climate'
  ];
  
  // Fetch sequentially with delays to avoid rate limits
  const allArticles = [];
  
  for (const query of queries) {
    try {
      // Add delay between requests to avoid rate limits
      if (allArticles.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
      }
      
      // GNews supports 'from' and 'to' parameters for time filtering
      const url = `${GNEWS_API_URL}?q=${encodeURIComponent(query)}&lang=en&max=20&from=${fromDateStr}&apikey=${GNEWS_API_KEY}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 429) {
          break; // Stop if we hit rate limit
        }
        continue;
      }
      
      const data = await response.json();
      
      if (data.articles && Array.isArray(data.articles)) {
        // Filter to only articles from last 24 hours (double-check)
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const filteredArticles = data.articles.filter(article => {
          if (!article.publishedAt && !article.pubDate) return false;
          const publishedDate = new Date(article.publishedAt || article.pubDate);
          return publishedDate >= twentyFourHoursAgo;
        });
        
        allArticles.push(...filteredArticles);
      }
    } catch (error) {
      // Continue to next query
    }
  }
  
  // Remove duplicates based on url
  const uniqueArticles = [];
  const seenUrls = new Set();
  
  for (const article of allArticles) {
    const url = article.url || article.link;
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      uniqueArticles.push(article);
    }
  }
  
  // Transform GNews format to match NewsAPI format
  return uniqueArticles.map(article => ({
    source: {
      id: article.source?.id || null,
      name: article.source?.name || 'Unknown',
    },
    author: article.author || null,
    title: article.title || '',
    description: article.description || null,
    url: article.url || article.link || '',
    urlToImage: article.image || null,
    publishedAt: article.publishedAt || article.pubDate || new Date().toISOString(),
    content: article.content || null,
    sourceApi: 'gnews',
  }));
};

app.get('/api/news', async (req, res) => {
  const { source = 'all' } = req.query; // 'all', 'newsapi', 'newsdata', or 'gnews'
  
  try {
    // Check cache
    const cacheKey = `news-${source}`;
    const cacheNow = Date.now();
    if (newsCache.data && newsCache.timestamp && (cacheNow - newsCache.timestamp) < newsCache.CACHE_DURATION) {
      // Filter by source if needed
      if (source === 'all') {
      return res.json(newsCache.data);
      } else {
        const filtered = {
          ...newsCache.data,
          articles: newsCache.data.articles.filter(a => a.sourceApi === source),
        };
        return res.json(filtered);
      }
    }

    // Fetch from all APIs in parallel
    const fetchPromises = [];
    
    if (source === 'all' || source === 'newsapi') {
      fetchPromises.push(fetchNewsAPI().catch(() => []));
    }
    
    if (source === 'all' || source === 'newsdata') {
      fetchPromises.push(fetchNewsData().catch(() => []));
    }
    
    if (source === 'all' || source === 'gnews') {
      fetchPromises.push(fetchGNews().catch(() => []));
    }
    
    const results = await Promise.all(fetchPromises);
    let allArticles = results.flat();
    
    // Deduplicate articles
    allArticles = deduplicateArticles(allArticles);
    
    // Final filter: Only show articles from last 24 hours (safety check)
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    allArticles = allArticles.filter(article => {
      if (!article.publishedAt) return false;
      const publishedDate = new Date(article.publishedAt);
      return publishedDate >= twentyFourHoursAgo;
    });
    
    // Sort by published date (newest first)
    allArticles.sort((a, b) => {
      const dateA = new Date(a.publishedAt || 0).getTime();
      const dateB = new Date(b.publishedAt || 0).getTime();
      return dateB - dateA;
    });
    
    // Limit to 100 articles
    allArticles = allArticles.slice(0, 100);
    
    const responseData = {
      status: 'ok',
      totalResults: allArticles.length,
      articles: allArticles,
      sources: {
        newsapi: allArticles.filter(a => a.sourceApi === 'newsapi').length,
        newsdata: allArticles.filter(a => a.sourceApi === 'newsdata').length,
        gnews: allArticles.filter(a => a.sourceApi === 'gnews').length,
      },
    };
    
      // Cache the response - reduced to 2 minutes for fresher news
      newsCache = {
      data: responseData,
        timestamp: Date.now(),
        CACHE_DURATION: 2 * 60 * 1000, // 2 minutes instead of 5
      };
      
    // Filter by source if needed
    if (source !== 'all') {
      responseData.articles = responseData.articles.filter(a => a.sourceApi === source);
      responseData.totalResults = responseData.articles.length;
    }
    
    res.json(responseData);
  } catch (error) {
    // Return cached data if available, even if expired
    if (newsCache.data) {
      let cachedData = newsCache.data;
      
      if (source !== 'all') {
        cachedData = {
          ...cachedData,
          articles: cachedData.articles.filter(a => a.sourceApi === source),
          totalResults: cachedData.articles.filter(a => a.sourceApi === source).length,
        };
      }
      
      return res.json(cachedData);
    }
    
    res.status(500).json({ 
      error: error.message,
      articles: [],
      status: 'error',
    });
  }
});

app.listen(PORT, () => {
  // Server started
});


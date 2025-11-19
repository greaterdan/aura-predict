// Express proxy server for Polymarket API
// All market processing happens server-side

import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { fetchAllMarkets } from './services/polymarketService.js';
import { transformMarkets } from './services/marketTransformer.js';
import { mapCategoryToPolymarket } from './utils/categoryMapper.js';

// Get directory paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;
const isProduction = process.env.NODE_ENV === 'production';

// SECURITY: Trust proxy if behind reverse proxy (Railway, etc.)
app.set('trust proxy', 1);

// SECURITY: Add security headers using Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.mainnet-beta.solana.com", "https://gamma-api.polymarket.com", "https://data-api.polymarket.com", "https://clob.polymarket.com", "https://newsapi.org", "https://newsdata.io", "https://gnews.io"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow external resources
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow external resources
}));

// Log startup info immediately
console.log('🚀 Starting server...');
console.log(`📋 PORT: ${PORT}`);
console.log(`📋 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`📋 Process PID: ${process.pid}`);
console.log(`📋 Railway PORT env: ${process.env.PORT || 'NOT SET'}`);

// Check if dist folder exists (frontend build)
const distPath = path.join(__dirname, '..', 'dist');
try {
  const distExists = fs.existsSync(distPath);
  if (distExists) {
    console.log(`✅ Frontend build found at: ${distPath}`);
  } else {
    console.warn(`⚠️  Frontend build not found at: ${distPath}`);
    console.warn(`   Run "npm run build" to build the frontend`);
  }
} catch (err) {
  console.warn(`⚠️  Could not check for frontend build: ${err.message}`);
}

// CRITICAL: Define healthcheck endpoints FIRST, before any middleware
// Railway healthchecks need these to work immediately
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  // Minimal response for Railway healthcheck - must be fast
  res.status(200).json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Polymarket proxy server is running' });
});

// Security: CORS - restrict to specific origins instead of wildcard
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000', 'https://probly.tech']; // Default for development

// CORS configuration - allow healthcheck without origin check
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, healthchecks, etc.)
    // Railway healthchecks don't send an origin header, so we must allow this
    if (!origin) return callback(null, true);
    
    // SECURITY: In production, only allow configured origins
    // In development, allow localhost origins
    if (isProduction) {
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // Development: Allow localhost and configured origins
      if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true
}));

// Security: Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const predictionsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit predictions endpoint to 30 requests per minute
  message: 'Too many prediction requests, please try again later.',
});

const waitlistLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit waitlist submissions to 5 per hour per IP
  message: 'Too many waitlist submissions, please try again later.',
});

// Apply rate limiting to API routes (but NOT /api/health - healthchecks need to work)
app.use('/api/', (req, res, next) => {
  // Skip rate limiting for healthcheck endpoint
  if (req.path === '/health') {
    return next();
  }
  apiLimiter(req, res, next);
});
app.use(express.json({ limit: '1mb' })); // Limit request body size

// SECURITY: Add request ID for logging and tracking
app.use((req, res, next) => {
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Cache for predictions (5 minute cache - markets don't change that frequently)
let predictionsCache = {
  data: null,
  timestamp: null,
  category: null,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
};

// Main endpoint: Get predictions (ready-to-use format)
// SECURITY: Apply rate limiting and input validation
app.get('/api/predictions', predictionsLimiter, async (req, res) => {
  try {
    // SECURITY: Input validation and limits
    let { category = 'All Markets', limit = 5000, search = null } = req.query;
    
    // Validate and sanitize inputs
    const MAX_LIMIT = 10000;
    const MAX_SEARCH_LENGTH = 200;
    const MAX_CATEGORY_LENGTH = 50;
    
    // Enforce maximum limit to prevent DoS
    limit = Math.min(Math.max(parseInt(limit) || 5000, 1), MAX_LIMIT);
    
    // Validate category
    if (typeof category !== 'string' || category.length > MAX_CATEGORY_LENGTH) {
      return res.status(400).json({ error: 'Invalid category parameter' });
    }
    
    // Validate and sanitize search query
    if (search) {
      if (typeof search !== 'string' || search.length > MAX_SEARCH_LENGTH) {
        return res.status(400).json({ error: 'Invalid search parameter' });
      }
      search = search.trim().substring(0, MAX_SEARCH_LENGTH);
    }
    
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
    
    // Fetch markets from Polymarket - increased limits for better coverage
    // When searching, fetch more markets to increase search pool
    const maxMarkets = isSearching 
      ? 10000 // Fetch more markets when searching
      : category === 'All Markets' ? 500 : 5000;
    
    let markets = await fetchAllMarkets({
      category: polymarketCategory,
      active: true,
      maxPages: Math.ceil(maxMarkets / 1000) + 1, // Fetch more pages for category searches
      limitPerPage: 1000,
      searchQuery: isSearching ? search.trim() : null, // Pass search query to API
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
        searchQuery: isSearching ? search.trim() : null,
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
        searchQuery: isSearching ? search.trim() : null,
      });
      markets = allMarkets; // Use all markets, will filter by detection below
    }
    
    // Limit markets for "All Markets" category (but allow more when searching or for other categories)
    const limitedMarkets = (category === 'All Markets' && !isSearching) 
      ? markets.slice(0, 500) 
      : markets;
    
    // Transform markets to predictions (server-side filtering and transformation)
    // Note: transformMarkets is now async to fetch prices from /prices endpoint
    const predictions = await transformMarkets(limitedMarkets);
    
    // Apply server-side search filtering if search query provided
    // (Since Polymarket API doesn't support text search, we filter client-side)
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
    
    // DEBUG: Log category distribution
    const categoryCounts = {};
    predictions.forEach(p => {
      const cat = p.category || 'World';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    console.log(`Category distribution:`, categoryCounts);
    console.log(`Total predictions: ${predictions.length}`);
    
    // Filter by category if needed (client-side category filtering)
    // Use search-filtered predictions if search was applied
    let filteredPredictions = searchFilteredPredictions;
    if (category !== 'All Markets') {
      filteredPredictions = searchFilteredPredictions.filter(p => {
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
    console.error(`[${req.id}] Error in /api/predictions:`, error);
    // SECURITY: Don't expose error details to clients
    res.status(500).json({ 
      error: isProduction ? 'Internal server error' : error.message,
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
    console.error(`[${req.id}] Error in /api/polymarket/markets:`, error);
    // SECURITY: Don't expose error details to clients
    res.status(500).json({
      error: isProduction ? 'Internal server error' : error.message,
      markets: [],
      count: 0,
    });
  }
});

// News API proxy endpoint with caching
// SECURITY: All API keys must be in environment variables - never hardcode
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_URL = 'https://newsapi.org/v2/everything';
const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const NEWSDATA_API_URL = 'https://newsdata.io/api/1/news';
// GNews API - Get your free API key from https://gnews.io/register
const GNEWS_API_KEY = process.env.GNEWS_API_KEY;
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
  // SECURITY: Check if API key is configured
  if (!NEWS_API_KEY) {
    console.warn('NEWS_API_KEY not configured, skipping NewsAPI');
    return [];
  }
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
  // SECURITY: Check if API key is configured
  if (!NEWSDATA_API_KEY) {
    console.warn('NEWSDATA_API_KEY not configured, skipping NewsData.io');
    return [];
  }
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
  // SECURITY: Check if API key is configured
  if (!GNEWS_API_KEY) {
    console.warn('GNEWS_API_KEY not configured, skipping GNews');
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
    console.error(`[${req.id}] Error in /api/news:`, error);
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
    
    // SECURITY: Don't expose error details to clients
    res.status(500).json({ 
      error: isProduction ? 'Internal server error' : error.message,
      articles: [],
      status: 'error',
    });
  }
});

// Waitlist endpoint - sends email notification
// SECURITY: Apply rate limiting and input sanitization
app.post('/api/waitlist', waitlistLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    // SECURITY: Strict email validation and length limit
    const MAX_EMAIL_LENGTH = 254; // RFC 5321
    if (email.length > MAX_EMAIL_LENGTH) {
      return res.status(400).json({ error: 'Email too long' });
    }
    
    // Trim and sanitize email
    const sanitizedEmail = email.trim().toLowerCase().substring(0, MAX_EMAIL_LENGTH);
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // SECURITY: Additional validation - check for common injection patterns
    if (/[<>\"'%;()&+]/.test(sanitizedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Send email notification to dev@probly.tech
    const notificationEmail = process.env.NOTIFICATION_EMAIL || 'dev@probly.tech';
    
    // SECURITY: Sanitize email for HTML output to prevent injection
    // Escape HTML special characters
    const escapeHtml = (text) => {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, (m) => map[m]);
    };
    
    const safeEmail = escapeHtml(sanitizedEmail);
    const timestamp = new Date().toISOString();
    
    const subject = `New Waitlist Signup: ${safeEmail}`;
    const htmlMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Agent Builder Waitlist Signup</h2>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Timestamp:</strong> ${timestamp}</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated notification from the Probly waitlist system.</p>
      </div>
    `;
    const textMessage = `
New user joined the Agent Builder waitlist:

Email: ${sanitizedEmail}
Timestamp: ${timestamp}
    `.trim();

    console.log(`\n=== WAITLIST SIGNUP ===`);
    console.log(`Email: ${sanitizedEmail}`);
    console.log(`Time: ${timestamp}`);
    console.log(`Sending notification to: ${notificationEmail}`);
    console.log(`========================\n`);

    // Send email notification using nodemailer
    // Configure via environment variables:
    // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
    // Or use Gmail with app password
    try {
      // Create transporter - configure based on your email service
      // For Gmail: Use app password (not regular password)
      // For other services: Update SMTP settings accordingly
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER || process.env.EMAIL_USER,
          pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
        },
      });

      // Only send email if credentials are configured
      if (process.env.SMTP_USER || process.env.EMAIL_USER) {
        const mailOptions = {
          from: process.env.SMTP_USER || process.env.EMAIL_USER,
          to: notificationEmail,
          subject: subject,
          text: textMessage,
          html: htmlMessage,
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Email notification sent to ${notificationEmail}`);
      } else {
        console.log(`⚠️  Email credentials not configured. Email would be sent to: ${notificationEmail}`);
        console.log(`   Configure SMTP_USER and SMTP_PASS environment variables to enable email sending.`);
      }
    } catch (emailError) {
      console.error('Error sending notification email:', emailError);
      // Don't fail the request if email fails - still return success to user
      // Log the error for debugging
      console.error('Email error details:', emailError.message);
    }

    res.json({ 
      success: true, 
      message: 'Successfully joined waitlist',
      email: sanitizedEmail 
    });
  } catch (error) {
    console.error(`[${req.id}] Waitlist endpoint error:`, error);
    // SECURITY: Don't expose error details to clients
    res.status(500).json({ 
      error: 'Failed to process waitlist signup',
      message: isProduction ? undefined : error.message 
    });
  }
});

// Serve static files from the React app build directory
// This must come AFTER all API routes
// distPath is already defined above, reuse it

// Serve static assets (JS, CSS, images, etc.)
app.use(express.static(distPath, {
  maxAge: '1y', // Cache static assets for 1 year
  etag: true,
}));

// Handle React Router - serve index.html for all non-API routes
// This allows client-side routing to work
app.get('*', (req, res, next) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
    return next();
  }
  
  // Serve index.html for all other routes (SPA routing)
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      console.error(`Error serving index.html: ${err.message}`);
      // If dist folder doesn't exist, return a helpful message
      if (err.code === 'ENOENT') {
        res.status(500).json({
          error: 'Frontend not built',
          message: 'Please run "npm run build" to build the frontend',
        });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });
});

// Export app for serverless functions (Railway, etc.)
export default app;

// Only start server if not in serverless environment
// Serverless platforms (like AWS Lambda) don't need app.listen
// Railway needs app.listen on 0.0.0.0 to be accessible
if (process.env.VERCEL !== '1' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  console.log('🔧 Starting server on Railway...');
  console.log(`🔧 Attempting to listen on 0.0.0.0:${PORT}...`);
  
  try {
    // Start server with error handling
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`✅ Healthcheck available at http://0.0.0.0:${PORT}/api/health`);
      console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✅ Railway PORT: ${process.env.PORT || 'not set (using fallback)'}`);
      console.log(`✅ Server started successfully - ready for healthchecks`);
    });

    server.on('error', (err) => {
      console.error('❌ Server failed to start:', err);
      console.error('Error details:', {
        code: err.code,
        message: err.message,
        port: PORT
      });
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
      }
      process.exit(1);
    });

    // Handle uncaught errors gracefully - log but don't crash immediately
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      console.error('Stack:', error.stack);
      // Don't exit immediately - let Railway handle it
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise);
      console.error('Reason:', reason);
      // Don't exit - let Railway restart it
    });
    
    // Keep process alive
    process.on('SIGTERM', () => {
      console.log('📴 Received SIGTERM, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ CRITICAL: Failed to start server:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}


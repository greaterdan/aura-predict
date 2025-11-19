// Polymarket API Service - Server Side
// Handles all API communication with Polymarket
// SECURITY: All credentials must be in environment variables - never hardcode

import crypto from 'crypto';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// SECURITY: Get credentials from environment variables
const POLYMARKET_CONFIG = {
  apiKey: process.env.POLYMARKET_API_KEY,
  secret: process.env.POLYMARKET_SECRET,
  passphrase: process.env.POLYMARKET_PASSPHRASE,
};

// Validate that credentials are configured
if (!POLYMARKET_CONFIG.apiKey || !POLYMARKET_CONFIG.secret || !POLYMARKET_CONFIG.passphrase) {
  console.error('ERROR: Polymarket API credentials not configured in environment variables!');
  console.error('Required: POLYMARKET_API_KEY, POLYMARKET_SECRET, POLYMARKET_PASSPHRASE');
}

const POLYMARKET_GAMMA_API = 'https://gamma-api.polymarket.com';
const POLYMARKET_DATA_API = 'https://data-api.polymarket.com';
const POLYMARKET_BASE = 'https://clob.polymarket.com';

// Create HMAC signature for authenticated requests
function createSignature(timestamp, method, path, body) {
  // SECURITY: Validate credentials before using
  if (!POLYMARKET_CONFIG.secret) {
    throw new Error('Polymarket API secret not configured');
  }
  
  const message = timestamp + method + path + (body || '');
  const hmac = crypto.createHmac('sha256', Buffer.from(POLYMARKET_CONFIG.secret, 'base64'));
  return hmac.update(message).digest('base64');
}

// Fetch markets from Polymarket Gamma API
export async function fetchMarketsFromPolymarket({
  limit = 1000,
  offset = 0,
  category = null,
  active = true,
  order = 'volume',
  ascending = false,
  searchQuery = null, // Add search query parameter
}) {
  const gammaParams = new URLSearchParams({
    active: active.toString(),
    closed: 'false',
    archived: 'false',
    limit: Math.min(limit, 1000).toString(),
    offset: offset.toString(),
    order: order,
    ascending: ascending.toString(),
  });

  // Add search query if provided (try multiple parameter names)
  if (searchQuery && searchQuery.trim()) {
    gammaParams.set('q', searchQuery.trim());
    gammaParams.set('query', searchQuery.trim());
    gammaParams.set('search', searchQuery.trim());
  }

  // Add category/topic filter if provided
  // Try multiple parameter names as Polymarket API might use different ones
  if (category) {
    // Try both topic and category parameters
    gammaParams.set('topic', category);
    gammaParams.set('category', category);
    // Also try tags parameter
    gammaParams.set('tags', category);
  }

  // Try /events endpoint first
  let gammaPath = `/events?${gammaParams.toString()}`;
  let gammaUrl = `${POLYMARKET_GAMMA_API}${gammaPath}`;
  
  const timestamp = Date.now().toString();
  let signature = createSignature(timestamp, 'GET', gammaPath, '');
  let authHeaders = {
    'POLY_API_KEY': POLYMARKET_CONFIG.apiKey,
    'POLY_SIGNATURE': signature,
    'POLY_TIMESTAMP': timestamp,
    'POLY_PASSPHRASE': POLYMARKET_CONFIG.passphrase,
  };

  let response = await fetch(gammaUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...authHeaders,
    },
  });

  // If /events fails, try /public-search
  if (!response.ok) {
    gammaPath = `/public-search?${gammaParams.toString()}`;
    gammaUrl = `${POLYMARKET_GAMMA_API}${gammaPath}`;
    signature = createSignature(timestamp, 'GET', gammaPath, '');
    authHeaders = {
      'POLY_API_KEY': POLYMARKET_CONFIG.apiKey,
      'POLY_SIGNATURE': signature,
      'POLY_TIMESTAMP': timestamp,
      'POLY_PASSPHRASE': POLYMARKET_CONFIG.passphrase,
    };

    response = await fetch(gammaUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Polymarket API error: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  
  // DEBUG: Log sample market to see actual structure and categories
  if (data.results && data.results.length > 0) {
    const sample = data.results[0];
    console.log('=== SAMPLE MARKET FROM API ===');
    console.log('Sample keys:', Object.keys(sample));
    console.log('Sample category:', sample.category);
    console.log('Sample tags:', sample.tags);
    console.log('Sample topic:', sample.topic);
    console.log('Sample question:', sample.question || sample.title);
    if (sample.market) {
      console.log('Sample market.category:', sample.market.category);
      console.log('Sample market.tags:', sample.market.tags);
    }
    if (sample.markets && sample.markets.length > 0) {
      console.log('Sample markets[0].category:', sample.markets[0].category);
      console.log('Sample markets[0].tags:', sample.markets[0].tags);
    }
    console.log('=== END SAMPLE ===');
  }
  
  // Extract markets from response (handle different structures)
  let markets = [];
  
  if (data.results && Array.isArray(data.results)) {
    // Results are events with markets inside, or markets directly
    for (const item of data.results) {
      if (item.markets && Array.isArray(item.markets) && item.markets.length > 0) {
        // Event with markets array - extract ALL markets from the array
        // Each market in the array is a separate prediction market
        for (const market of item.markets) {
          // Add the market with its parent event data for context
          markets.push({
            ...market,
            eventId: item.id,
            eventTitle: item.title || item.question,
          });
        }
      } else if (item.market) {
        // Event with single market
        markets.push(item.market);
      } else if (item.question || item.condition_id || item.title) {
        // Direct market object (could be event or market)
        // If it has markets array, extract those
        if (item.markets && Array.isArray(item.markets) && item.markets.length > 0) {
          for (const market of item.markets) {
            markets.push({
              ...market,
              eventId: item.id,
              eventTitle: item.title || item.question,
            });
          }
        } else {
          // It's a direct market
          markets.push(item);
        }
      }
    }
  } else if (Array.isArray(data)) {
    markets = data;
  } else if (data.data && Array.isArray(data.data)) {
    markets = data.data;
  } else if (data.markets && Array.isArray(data.markets)) {
    markets = data.markets;
  }

  return markets;
}

// Fetch markets with pagination
export async function fetchAllMarkets({
  category = null,
  active = true,
  maxPages = 50,
  limitPerPage = 1000,
  searchQuery = null, // Add search query parameter
}) {
  let allMarkets = [];
  const seenIds = new Set();

  for (let page = 0; page < maxPages; page++) {
    const offset = page * limitPerPage;
    
    try {
      const markets = await fetchMarketsFromPolymarket({
        limit: limitPerPage,
        offset,
        category,
        active,
        searchQuery, // Pass search query
      });

      if (markets.length === 0) {
        break;
      }

      // Filter out duplicates - use more reliable ID detection
      const newMarkets = markets.filter(m => {
        // Try multiple ID sources, with fallback to question hash
        const actualMarket = m.market || m;
        let id = actualMarket.condition_id || 
                 actualMarket.question_id || 
                 actualMarket.id ||
                 actualMarket.market_id ||
                 m.condition_id || 
                 m.question_id || 
                 m.id;
        
        // If no ID, create one from question
        if (!id) {
          const question = actualMarket.question || actualMarket.title || actualMarket.name || m.question || m.title || '';
          if (question) {
            // Create hash from question
            id = question.split('').reduce((acc, char) => {
              return ((acc << 5) - acc) + char.charCodeAt(0);
            }, 0).toString(36);
          } else {
            // No question either, skip this market
            return false;
          }
        }
        
        if (seenIds.has(id)) {
          return false;
        }
        seenIds.add(id);
        return true;
      });

      // Continue even if all are duplicates - API might return same markets on multiple pages
      // but different markets on later pages
      if (newMarkets.length === 0) {
        // Don't break - continue to next page in case API returns different markets
        // Only break if we've had many consecutive pages with no new markets
        if (page > 10 && allMarkets.length > 0) {
          // After page 10, if we still have no new markets, likely API is repeating
          break;
        }
      } else {
        allMarkets = allMarkets.concat(newMarkets);
      }

      // Stop if we got fewer than requested (end of data)
      // But continue for at least a few pages to ensure we get all markets
      if (markets.length < limitPerPage && page > 2) {
        break;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      if (page === 0) {
        throw error;
      }
      break;
    }
  }

  return allMarkets;
}

// Fetch prices for multiple tokens from Polymarket CLOB API
// Uses the /price endpoint for each token_id to get BUY and SELL prices
// Format: GET /price?token_id=X&side=BUY or GET /price?token_id=X&side=SELL
export async function fetchMarketPrices(tokenIds) {
  const allPrices = {};
  
  if (!tokenIds || tokenIds.length === 0) {
    return allPrices;
  }
  
  try {
    console.log(`Fetching prices for ${tokenIds.length} tokens using /price endpoint...`);
    
    // Fetch prices for each token (both BUY and SELL)
    // Increased limit to 300 tokens to support more markets and multi-outcome markets
    const tokensToFetch = Array.from(new Set(tokenIds)).slice(0, 300);
    
    const pricePromises = [];
    for (const tokenId of tokensToFetch) {
      // Fetch BUY price
      pricePromises.push(
        fetch(`${POLYMARKET_BASE}/price?token_id=${encodeURIComponent(tokenId)}&side=BUY`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        }).then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            return { tokenId, side: 'BUY', price: data.price };
          }
          return null;
        }).catch(() => null)
      );
      
      // Fetch SELL price
      pricePromises.push(
        fetch(`${POLYMARKET_BASE}/price?token_id=${encodeURIComponent(tokenId)}&side=SELL`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        }).then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            return { tokenId, side: 'SELL', price: data.price };
          }
          return null;
        }).catch(() => null)
      );
      
      // Small delay to avoid rate limiting
      if (pricePromises.length % 20 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Wait for all price fetches (in batches to avoid overwhelming the API)
    const batchSize = 50;
    for (let i = 0; i < pricePromises.length; i += batchSize) {
      const batch = pricePromises.slice(i, i + batchSize);
      const results = await Promise.all(batch);
      
      // Process results
      for (const result of results) {
        if (result) {
          if (!allPrices[result.tokenId]) {
            allPrices[result.tokenId] = {};
          }
          allPrices[result.tokenId][result.side] = result.price;
        }
      }
      
      // Delay between batches
      if (i + batchSize < pricePromises.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log(`Fetched prices for ${Object.keys(allPrices).length} tokens`);
    if (Object.keys(allPrices).length > 0) {
      const sample = Object.entries(allPrices)[0];
      console.log(`Sample price for token ${sample[0]}:`, sample[1]);
    }
    
    return allPrices;
  } catch (error) {
    console.warn(`Error fetching market prices: ${error.message}`);
    console.error(error);
    return allPrices;
  }
}


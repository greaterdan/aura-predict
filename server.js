// Simple Express proxy server for Polymarket API
// Handles CORS and authentication

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fetch from 'node-fetch';

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// Polymarket API configuration
const POLYMARKET_CONFIG = {
  apiKey: '019a8543-9674-7c1f-8f77-8b1a1365fe67',
  secret: 'EXKuOeXjqt0lRIM-KBpdPQyth34ZilHKJLYv6jTXa5w=',
  passphrase: 'e7694b050d029d85fe3efe00353017f8bd3e53f617b410d09dc55346efd7889d',
};

const POLYMARKET_BASE = 'https://clob.polymarket.com';
const POLYMARKET_DATA_API = 'https://data-api.polymarket.com';

// Create HMAC signature for authenticated requests
function createSignature(timestamp, method, path, body) {
  const message = timestamp + method + path + (body || '');
  const hmac = crypto.createHmac('sha256', Buffer.from(POLYMARKET_CONFIG.secret, 'base64'));
  return hmac.update(message).digest('base64');
}

// Proxy endpoint for markets
app.get('/api/polymarket/markets', async (req, res) => {
  try {
    const { limit = 50, active = 'true', category, featured } = req.query;
    // For "All Markets", we want active=true to get active markets
    const shouldFilterActive = active === 'true' || active === true;
    
    // Try multiple endpoints
    const endpoints = [
      // Public GraphQL endpoint
      `${POLYMARKET_DATA_API}/graphql`,
      // Try authenticated CLOB endpoint
      `${POLYMARKET_BASE}/markets`,
      // Public data endpoint
      `https://api.polymarket.com/markets?limit=${limit}&active=${active}`,
    ];

    let markets = null;
    
    // Try GraphQL first
    try {
      const graphqlQuery = {
        query: `
          query GetMarkets($limit: Int, $active: Boolean) {
            markets(limit: $limit, active: $active) {
              condition_id
              question
              slug
              resolution_source
              end_date_iso
              active
              closed
              category
              tags
              outcome_prices {
                0
                1
              }
              volume
              liquidity
              current_price
            }
          }
        `,
        variables: { limit: parseInt(limit), active: active === 'true' }
      };

      const response = await fetch(`${POLYMARKET_DATA_API}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(graphqlQuery),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data?.markets) {
          markets = data.data.markets;
          console.log(`✅ GraphQL returned ${markets.length} markets`);
        }
      }
    } catch (err) {
      console.log('GraphQL failed, trying REST...');
    }

    // If GraphQL failed, try REST endpoint (might need auth)
    if (!markets) {
      const timestamp = Date.now().toString();
      const method = 'GET';
      const path = '/markets';
      
      // Create auth headers
      const signature = createSignature(timestamp, method, path, '');
      const authHeaders = {
        'POLY_API_KEY': POLYMARKET_CONFIG.apiKey,
        'POLY_SIGNATURE': signature,
        'POLY_TIMESTAMP': timestamp,
        'POLY_PASSPHRASE': POLYMARKET_CONFIG.passphrase,
      };

      const params = new URLSearchParams({
        limit: limit.toString(),
        active: active.toString(),
        ...(category && { category }),
        ...(featured && { featured }),
      });

      try {
        const response = await fetch(`${POLYMARKET_BASE}/markets?${params}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...authHeaders,
          },
        });

        if (response.ok) {
          const data = await response.json();
          markets = Array.isArray(data) ? data : (data.markets || data.data || []);
          console.log(`✅ REST returned ${markets?.length || 0} markets`);
        }
      } catch (err) {
        console.error('REST endpoint failed:', err.message);
      }
    }

    // Fallback: Try public API with pagination - use the endpoint that was working
    if (!markets) {
      try {
        const fetchLimit = parseInt(limit) || 1000;
        let allMarkets = [];
        let pageCount = 0;
        const maxPages = 20; // Fetch up to 20 pages (2000 markets max)
        
        // Try to fetch all pages - Polymarket API might return in batches
        while (allMarkets.length < fetchLimit && pageCount < maxPages) {
          // Try different endpoint patterns
          const endpoints = [
            `https://api.polymarket.com/markets?limit=100&active=${active}&page=${pageCount + 1}`,
            `https://api.polymarket.com/markets?limit=100&active=${active}&offset=${pageCount * 100}`,
            `https://api.polymarket.com/markets?limit=100&active=${active}`,
          ];
          
          let pageMarkets = [];
          let success = false;
          
          for (const endpoint of endpoints) {
            try {
              const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                },
              });

              if (response.ok) {
                const data = await response.json();
                pageMarkets = Array.isArray(data) ? data : (data.markets || data.data || []);
                
                if (pageMarkets.length > 0) {
                  success = true;
                  console.log(`📄 Fetched from ${endpoint}: ${pageMarkets.length} markets`);
                  break;
                }
              }
            } catch (e) {
              continue;
            }
          }
          
          if (success && pageMarkets.length > 0) {
            allMarkets = allMarkets.concat(pageMarkets);
            console.log(`📊 Total markets so far: ${allMarkets.length}`);
            
            // Stop if we got fewer markets than requested (end of data)
            if (pageMarkets.length < 100) {
              break;
            }
          } else {
            console.log(`⚠️ No more markets found at page ${pageCount + 1}`);
            break;
          }
          
          pageCount++;
        }
        
        if (allMarkets.length > 0) {
          // Remove duplicates based on condition_id or question
          const uniqueMarkets = [];
          const seen = new Set();
          for (const market of allMarkets) {
            const id = market.condition_id || market.question_id || market.question;
            if (!seen.has(id)) {
              seen.add(id);
              uniqueMarkets.push(market);
            }
          }
          allMarkets = uniqueMarkets; // Store in allMarkets for filtering
          markets = allMarkets;
          console.log(`✅ Public API returned ${markets.length} unique markets (fetched ${allMarkets.length} total)`);
        }
      } catch (err) {
        console.error('Public API failed:', err.message);
      }
    }

    // Filter to only active, non-closed markets if active=true
    // BUT: Be lenient - if filtering removes everything, don't filter
    if (markets && markets.length > 0 && shouldFilterActive) {
      const beforeFilter = markets.length;
      const originalMarkets = [...markets]; // Keep a copy
      
      markets = markets.filter(m => {
        // Handle different data formats - be flexible with boolean/string comparisons
        const isActive = m.active === true || m.active === 'true' || m.active === 1;
        const isNotClosed = m.closed === false || m.closed === 'false' || m.closed === 0 || m.closed === null || m.closed === undefined;
        const isNotArchived = m.archived === false || m.archived === 'false' || m.archived === 0 || m.archived === null || m.archived === undefined;
        
        // If market doesn't have these properties, include it (some markets might not have all fields)
        return (isActive || m.active === undefined) && 
               (isNotClosed || m.closed === undefined) && 
               (isNotArchived || m.archived === undefined);
      });
      
      // If filtering removed all or most markets, use unfiltered data
      if (markets.length === 0 || markets.length < beforeFilter * 0.1) {
        console.log(`⚠️ Filter removed too many markets (${beforeFilter} → ${markets.length}), using unfiltered data`);
        markets = originalMarkets;
      } else {
        console.log(`✅ Filtered ${beforeFilter} markets to ${markets.length} active markets (removed ${beforeFilter - markets.length})`);
      }
    }

    if (markets && markets.length > 0) {
      res.json({ markets, count: markets.length });
    } else {
      res.status(500).json({ error: 'Failed to fetch markets from all endpoints' });
    }
  } catch (error) {
    console.error('Error in proxy:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Polymarket proxy server running on http://localhost:${PORT}`);
});


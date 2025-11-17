// Market Transformer - Server Side
// Transforms Polymarket markets to our prediction format

import { detectCategoryFromMarket } from '../utils/categoryMapper.js';
import { fetchMarketPrices } from './polymarketService.js';

const MOCK_AGENTS = [
  { name: 'GROK 4' },
  { name: 'GPT-5' },
  { name: 'DEEPSEEK V3' },
  { name: 'GEMINI 2.5' },
  { name: 'CLAUDE 4.5' },
  { name: 'QWEN 2.5' },
];

// Filter and validate market
export function filterMarket(market) {
  const now = new Date();
  
  // Handle nested structures
  const actualMarket = market.market || market;
  
  // Check closed/archived
  const closed = actualMarket.closed ?? market.closed;
  const archived = actualMarket.archived ?? market.archived;
  const status = actualMarket.status ?? market.status;
  
  const isClosed = closed === true || closed === 'true' || closed === 1 ||
                   status === 'closed' || status === 'resolved' || status === 'finished' || status === 'settled';
  const isArchived = archived === true || archived === 'true' || archived === 1;
  
  if (isClosed || isArchived) {
    return false;
  }
  
  // Check end date - check multiple field names
  const endDate = actualMarket.endDate || 
                  actualMarket.endDateIso ||
                  actualMarket.end_date_iso || 
                  actualMarket.end_date || 
                  market.endDate ||
                  market.endDateIso ||
                  market.end_date_iso || 
                  market.end_date ||
                  actualMarket.event?.endDate ||
                  actualMarket.event?.endDateIso ||
                  actualMarket.event?.end_date_iso;
  
  if (endDate) {
    try {
      const endDateObj = new Date(endDate);
      // Check if date is valid
      if (isNaN(endDateObj.getTime())) {
        // Invalid date, skip check
      } else {
        // Market is expired if end date is in the past (with 1 hour buffer for timezone issues)
        const buffer = 60 * 60 * 1000; // 1 hour in milliseconds
        if (endDateObj.getTime() < (now.getTime() - buffer)) {
        return false; // Expired
        }
      }
    } catch (e) {
      // Invalid date format, skip check
    }
  }
  
  // Check if has question
  const question = actualMarket.question || actualMarket.title || actualMarket.name || market.question || market.title;
  if (!question || question.trim() === '') {
    return false;
  }
  
  // Check if has slug/URL - markets without URLs are not valid/complete
  const slug = actualMarket.market_slug || 
               actualMarket.slug || 
               actualMarket.event?.slug ||
               market.market_slug ||
               market.slug;
  
  if (!slug || slug.trim() === '') {
    return false; // No URL/slug, skip this market
  }
  
  // Check if has volume - markets without volume are not active/tradeable
  const volume = actualMarket.volume || 
                 actualMarket.totalVolume ||
                 actualMarket.volumeNum ||
                 market.volume ||
                 market.totalVolume ||
                 actualMarket.event?.volume ||
                 actualMarket.event?.totalVolume;
  
  if (!volume || volume === 0 || parseFloat(volume) <= 0) {
    return false; // No volume, skip this market
  }
  
  // Check if has liquidity - markets without liquidity are not tradeable
  const liquidity = actualMarket.liquidity || 
                    actualMarket.liquidityClob ||
                    actualMarket.liquidityNum ||
                    market.liquidity ||
                    market.liquidityClob ||
                    actualMarket.event?.liquidity;
  
  if (!liquidity || liquidity === 0 || parseFloat(liquidity) <= 0) {
    return false; // No liquidity, skip this market
  }
  
  return true;
}

// Transform market to prediction format
export function transformMarket(market, index = 0, pricesMap = {}) {
  const actualMarket = market.market || market;
  
  // Debug: Log first market structure to understand API response format
  if (index === 0) {
    // Check for volume/liquidity in various locations
    const volumeLocations = [
      actualMarket.volume,
      actualMarket.totalVolume,
      actualMarket.volume_24h,
      actualMarket.volume24h,
      market.volume,
      market.totalVolume,
      market.volume_24h,
      market.volume24h,
      actualMarket.event?.volume,
      actualMarket.event?.totalVolume,
    ];
    const hasVolume = volumeLocations.some(v => v !== undefined && v !== null && v > 0);
    if (!hasVolume) {
      // Log available keys to help debug
      const keys = Object.keys(actualMarket).slice(0, 30);
    }
  }
  
  // Get question
  // IMPORTANT: Only create bubbles for actual MARKETS with questions, not for events or outcomes
  const question = (actualMarket.question || actualMarket.title || actualMarket.name || '').trim();
  if (!question) {
    return null; // No question = not a valid market bubble
  }
  
  // Additional check: If this looks like an event (has markets array but no question), skip it
  // Events should not be shown as bubbles - only their nested markets should be bubbles
  if (actualMarket.markets && Array.isArray(actualMarket.markets) && actualMarket.markets.length > 0) {
    // This is an event container, not a market - skip it
    // The nested markets will be handled separately in transformMarkets
    return null;
  }
  
  // Extract ALL outcomes and their prices
  // Markets can have multiple outcomes (not just YES/NO)
  let allOutcomes = [];
  let yesPrice = null;
  let noPrice = null;
  
  // Helper function to extract price from price data
  const extractPrice = (priceData) => {
    if (!priceData) return null;
    
    let buyPrice = null;
    let sellPrice = null;
    
    // Try direct BUY/SELL properties
    if (priceData.BUY !== undefined && priceData.SELL !== undefined) {
      buyPrice = parseFloat(String(priceData.BUY));
      sellPrice = parseFloat(String(priceData.SELL));
    } else if (priceData.buy !== undefined && priceData.sell !== undefined) {
      buyPrice = parseFloat(String(priceData.buy));
      sellPrice = parseFloat(String(priceData.sell));
    } else if (typeof priceData === 'string' || typeof priceData === 'number') {
      // If it's a direct price value
      const price = parseFloat(String(priceData));
      if (!isNaN(price)) {
        buyPrice = price;
        sellPrice = price;
      }
    } else if (typeof priceData === 'object' && priceData !== null) {
      // Try to find any numeric values that might be prices
      const values = Object.values(priceData).filter(v => typeof v === 'string' || typeof v === 'number');
      if (values.length >= 2) {
        buyPrice = parseFloat(String(values[0]));
        sellPrice = parseFloat(String(values[1]));
      } else if (values.length === 1) {
        const price = parseFloat(String(values[0]));
        if (!isNaN(price)) {
          buyPrice = price;
          sellPrice = price;
        }
      }
    }
    
    if (buyPrice !== null && sellPrice !== null && !isNaN(buyPrice) && !isNaN(sellPrice)) {
      // Prices from Polymarket CLOB API /price endpoint are already in 0-1 range
      // They come as strings like "0.003" or "0.996" - already normalized
      // Only convert if they're clearly in a different format (like > 1)
      
      // If prices are > 1, they might be in basis points (divide by 10000)
      // or cents (divide by 100), but typically they're already in 0-1 range
      if (buyPrice > 1 || sellPrice > 1) {
        // Only convert if they're clearly in a different format
        if (buyPrice > 100 || sellPrice > 100) {
          // Likely basis points (0-10000 range)
          buyPrice = buyPrice / 10000;
          sellPrice = sellPrice / 10000;
        } else if (buyPrice > 1 || sellPrice > 1) {
          // Likely cents (0-100 range)
          buyPrice = buyPrice / 100;
          sellPrice = sellPrice / 100;
        }
      }
      
      // Ensure prices are in valid range (0-1)
      if (buyPrice < 0) buyPrice = 0;
      if (buyPrice > 1) buyPrice = 1;
      if (sellPrice < 0) sellPrice = 0;
      if (sellPrice > 1) sellPrice = 1;
      
      // Use mid-price (average of BUY and SELL)
      const midPrice = (buyPrice + sellPrice) / 2;
      
      return {
        price: midPrice,
        buyPrice: buyPrice,
        sellPrice: sellPrice
      };
    }
    
    return null;
  };
  
  // FIRST: Try to get prices from the /prices endpoint (most accurate)
  const conditionId = actualMarket.condition_id || 
                     actualMarket.event?.condition_id ||
                     market.condition_id ||
                     actualMarket.id ||
                     market.id;
  const conditionIdStr = conditionId ? String(conditionId) : null;
  
  if (conditionIdStr && pricesMap[conditionIdStr]) {
    const marketPrices = pricesMap[conditionIdStr];
    
    // DEBUG: Log what we're processing
    if (index === 0 || index < 3) {
      console.log(`\n[Market ${index}] Processing prices for conditionId: ${conditionIdStr}`);
      console.log(`  Available price data:`, Object.keys(marketPrices));
    }
    
    // Extract ALL outcomes with their prices
    // For negative risk markets, show all named outcomes
    for (const [tokenId, priceData] of Object.entries(marketPrices)) {
      const outcomeName = priceData.outcome || 
                         (tokenId === '0' ? 'YES' : tokenId === '1' ? 'NO' : `Outcome ${tokenId}`);
      
      // Skip placeholder outcomes for augmented negative risk
      const isAugmentedNegRisk = actualMarket.negRiskAugmented === true || 
                                 market.negRiskAugmented === true ||
                                 market.parentEvent?.negRiskAugmented === true;
      
      if (isAugmentedNegRisk) {
        const isPlaceholder = outcomeName && (
          outcomeName.toLowerCase().startsWith('person ') ||
          outcomeName.toLowerCase().startsWith('placeholder') ||
          (outcomeName.toLowerCase() === 'other' && Object.keys(marketPrices).length > 3)
        );
        
        if (isPlaceholder) {
          continue; // Skip placeholder outcomes
        }
      }
      
      const priceInfo = extractPrice(priceData);
      
      if (priceInfo && priceInfo.price >= 0 && priceInfo.price <= 1) {
        allOutcomes.push({
          tokenId: tokenId,
          name: outcomeName,
          price: priceInfo.price,
          buyPrice: priceInfo.buyPrice,
          sellPrice: priceInfo.sellPrice,
          probability: priceInfo.price * 100
        });
        
        // Also set yesPrice/noPrice for backward compatibility
        // IMPORTANT: Correctly identify YES vs NO outcomes
        // Check outcome name first (most reliable), then token ID
        const upperName = outcomeName.toUpperCase();
        if (upperName === 'YES' || upperName.includes('YES') || tokenId === '0') {
          yesPrice = priceInfo.price;
        } else if (upperName === 'NO' || upperName.includes('NO') || tokenId === '1') {
          noPrice = priceInfo.price;
        } else {
          // For markets with named outcomes (like team names), we need to determine YES/NO differently
          // If this is a binary market, the first outcome is typically YES, second is NO
          // But we should check the market structure to be sure
          if (allOutcomes.length === 0) {
            // First outcome in binary market is usually YES
            yesPrice = priceInfo.price;
          } else if (allOutcomes.length === 1) {
            // Second outcome in binary market is usually NO
            noPrice = priceInfo.price;
          }
        }
        
        if (index === 0 || index < 3) {
          console.log(`  ✅ Extracted price for ${outcomeName}: $${priceInfo.price.toFixed(3)} (${(priceInfo.price * 100).toFixed(1)}%)`);
        }
      } else {
        if (index === 0 || index < 3) {
          console.log(`  ⚠️  Failed to extract valid price for ${outcomeName} from:`, priceData);
        }
      }
    }
    
    // Sort outcomes by probability (highest first)
    allOutcomes.sort((a, b) => b.probability - a.probability);
    
    if (index === 0 || index < 3) {
      console.log(`  Final outcomes count: ${allOutcomes.length}`);
    }
  } else {
    if (index === 0 || index < 3) {
      console.log(`\n[Market ${index}] ⚠️  NO PRICES FOUND for conditionId: ${conditionIdStr}`);
      console.log(`  Available conditionIds in pricesMap:`, Object.keys(pricesMap).slice(0, 5));
    }
  }
  
  // If we didn't get outcomes from prices endpoint, try to extract from outcomePrices
  if (allOutcomes.length === 0 && actualMarket.outcomePrices) {
    try {
      let outcomePrices = actualMarket.outcomePrices;
      if (typeof outcomePrices === 'string') {
        outcomePrices = JSON.parse(outcomePrices);
      }
      
      let outcomes = [];
      if (actualMarket.outcomes) {
        if (typeof actualMarket.outcomes === 'string') {
          outcomes = JSON.parse(actualMarket.outcomes);
        } else if (Array.isArray(actualMarket.outcomes)) {
          outcomes = actualMarket.outcomes;
        }
      }
      
      if (Array.isArray(outcomePrices)) {
        // Check if augmented negative risk - filter out placeholders
        const isAugmentedNegRisk = actualMarket.negRiskAugmented === true || 
                                   market.negRiskAugmented === true ||
                                   market.parentEvent?.negRiskAugmented === true;
        
        for (let idx = 0; idx < outcomePrices.length; idx++) {
          const price = parseFloat(String(outcomePrices[idx]));
          if (!isNaN(price) && price >= 0 && price <= 1) {
            const outcomeName = outcomes[idx] || (idx === 0 ? 'YES' : idx === 1 ? 'NO' : `Outcome ${idx}`);
            
            // For augmented negative risk, skip placeholder outcomes
            if (isAugmentedNegRisk) {
              const isPlaceholder = outcomeName && (
                outcomeName.toLowerCase().startsWith('person ') ||
                outcomeName.toLowerCase().startsWith('placeholder') ||
                (outcomeName.toLowerCase() === 'other' && outcomePrices.length > 3)
              );
              
              if (isPlaceholder) {
                continue; // Skip placeholder outcomes
              }
            }
            
            allOutcomes.push({
              tokenId: String(idx),
              name: outcomeName,
              price: price,
              probability: price * 100
            });
            
            if (idx === 0 || outcomeName.toUpperCase() === 'YES') {
              yesPrice = price;
            } else if (idx === 1 || outcomeName.toUpperCase() === 'NO') {
              noPrice = price;
            }
          }
        }
        
        allOutcomes.sort((a, b) => b.probability - a.probability);
      }
    } catch (e) {
      // Failed to parse
    }
  }
  
  // If we didn't get prices from the /prices endpoint, try other sources
  if (yesPrice === null || noPrice === null) {
  // Try outcomePrices FIRST (this is the format we see in the API response)
  // outcomePrices is a JSON string like "[\"0.0035\", \"0.9965\"]"
  if (actualMarket.outcomePrices) {
    try {
      let prices = actualMarket.outcomePrices;
      // If it's a string, parse it as JSON
      if (typeof prices === 'string') {
        prices = JSON.parse(prices);
      }
      // Handle array format: ["0.0035", "0.9965"] - first is YES, second is NO
      if (Array.isArray(prices) && prices.length >= 2) {
        const yesVal = parseFloat(String(prices[0]));
        const noVal = parseFloat(String(prices[1]));
        if (!isNaN(yesVal) && yesVal >= 0 && yesVal <= 1) {
          yesPrice = yesVal;
        }
        if (!isNaN(noVal) && noVal >= 0 && noVal <= 1) {
          noPrice = noVal;
        }
      }
    } catch (e) {
      // Failed to parse outcomePrices
    }
  }
  
  // Try tokens array (alternative structure)
  if (actualMarket.tokens && Array.isArray(actualMarket.tokens) && actualMarket.tokens.length >= 2) {
    // Try to find YES/NO tokens by multiple methods
    let yesToken = actualMarket.tokens.find(t => 
      (t.outcome === 'Yes' || t.outcome === 'YES' || (t.outcome && t.outcome.toLowerCase().includes('yes'))) ||
      (t.side === 'yes' || t.side === 'YES') ||
      t.token_id === '0' ||
      t.outcome === '0'
    );
    
    let noToken = actualMarket.tokens.find(t => 
      (t.outcome === 'No' || t.outcome === 'NO' || (t.outcome && t.outcome.toLowerCase().includes('no'))) ||
      (t.side === 'no' || t.side === 'NO') ||
      t.token_id === '1' ||
      t.outcome === '1'
    );
    
    // Fallback: use first two tokens if we can't identify YES/NO
    if (!yesToken) yesToken = actualMarket.tokens[0];
    if (!noToken) noToken = actualMarket.tokens.find(t => t !== yesToken) || actualMarket.tokens[1];
    
    // Try ALL possible price field names - Polymarket API uses various formats
    const priceFields = ['price', 'lastPrice', 'currentPrice', 'last_price', 'current_price', 
                         'lastPriceUsd', 'priceUsd', 'value', 'usdPrice', 'usd_price',
                         'lastPriceUSD', 'priceUSD', 'lastPriceUsdc', 'priceUsdc'];
    
    for (const field of priceFields) {
      if (yesPrice === null && yesToken && yesToken[field] !== undefined && yesToken[field] !== null) {
        yesPrice = parseFloat(String(yesToken[field]));
        if (!isNaN(yesPrice)) break;
      }
    }
    
    for (const field of priceFields) {
      if (noPrice === null && noToken && noToken[field] !== undefined && noToken[field] !== null) {
        noPrice = parseFloat(String(noToken[field]));
        if (!isNaN(noPrice)) break;
      }
    }
  }
  
  // Try outcomePrices (can be string JSON array or object)
  if ((yesPrice === null || noPrice === null) && actualMarket.outcomePrices) {
    try {
      let prices = actualMarket.outcomePrices;
      // If it's a string, parse it
      if (typeof prices === 'string') {
        prices = JSON.parse(prices);
      }
      // Handle array format: ["0.0035", "0.9965"] or [0.0035, 0.9965]
      if (Array.isArray(prices) && prices.length >= 2) {
        if (yesPrice === null) {
          yesPrice = parseFloat(String(prices[0]));
        }
        if (noPrice === null) {
          noPrice = parseFloat(String(prices[1]));
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  // Try outcome_prices object (various formats)
  if ((yesPrice === null || noPrice === null) && actualMarket.outcome_prices) {
    // Try numeric keys
    if (yesPrice === null) {
      yesPrice = actualMarket.outcome_prices['0'] ?? actualMarket.outcome_prices[0] ?? 
                 actualMarket.outcome_prices['yes'] ?? actualMarket.outcome_prices['YES'];
      if (yesPrice !== undefined && yesPrice !== null) {
        yesPrice = parseFloat(String(yesPrice));
      } else {
        yesPrice = null;
      }
    }
    if (noPrice === null) {
      noPrice = actualMarket.outcome_prices['1'] ?? actualMarket.outcome_prices[1] ?? 
                actualMarket.outcome_prices['no'] ?? actualMarket.outcome_prices['NO'];
      if (noPrice !== undefined && noPrice !== null) {
        noPrice = parseFloat(String(noPrice));
      } else {
        noPrice = null;
      }
    }
  }
  
  // Try prices object (alternative format)
  if ((yesPrice === null || noPrice === null) && actualMarket.prices) {
    if (yesPrice === null && actualMarket.prices['0'] !== undefined) {
      yesPrice = parseFloat(String(actualMarket.prices['0']));
    }
    if (noPrice === null && actualMarket.prices['1'] !== undefined) {
      noPrice = parseFloat(String(actualMarket.prices['1']));
    }
  }
  
  // Try current_price (single value, calculate other)
  if (yesPrice === null && actualMarket.current_price !== undefined) {
    yesPrice = parseFloat(String(actualMarket.current_price));
    noPrice = 1 - yesPrice;
  }
  
  // Try price field directly
  if (yesPrice === null && actualMarket.price !== undefined) {
    yesPrice = parseFloat(String(actualMarket.price));
    noPrice = 1 - yesPrice;
  }
  
  // Try market data fields
  if (yesPrice === null && actualMarket.market) {
    const marketData = actualMarket.market;
    if (marketData.outcome_prices) {
      if (marketData.outcome_prices['0'] !== undefined) {
        yesPrice = parseFloat(String(marketData.outcome_prices['0']));
      }
      if (marketData.outcome_prices['1'] !== undefined) {
        noPrice = parseFloat(String(marketData.outcome_prices['1']));
      }
    }
    if (yesPrice === null && marketData.current_price !== undefined) {
      yesPrice = parseFloat(String(marketData.current_price));
      noPrice = 1 - yesPrice;
      }
    }
  }
  
  // If we have one price but not the other, calculate it
  if (yesPrice !== null && noPrice === null) {
    noPrice = 1 - yesPrice;
  } else if (noPrice !== null && yesPrice === null) {
    yesPrice = 1 - noPrice;
  }
  
  // Final fallback - only if we have NO price data
  // BUT: If we have outcomes with prices, use those instead of defaulting to 0.5
  if (yesPrice === null || noPrice === null) {
    // If we have outcomes with prices, use those
    if (allOutcomes.length > 0) {
      // Find YES and NO outcomes - check name first, then token ID
      const yesOutcome = allOutcomes.find(o => {
        const upperName = o.name.toUpperCase();
        return upperName === 'YES' || upperName.includes('YES') || o.tokenId === '0';
      });
      const noOutcome = allOutcomes.find(o => {
        const upperName = o.name.toUpperCase();
        return upperName === 'NO' || upperName.includes('NO') || o.tokenId === '1';
      });
      
      if (yesOutcome && yesPrice === null) {
        yesPrice = yesOutcome.price;
      }
      if (noOutcome && noPrice === null) {
        noPrice = noOutcome.price;
      }
      
      // If still missing and we have exactly 2 outcomes, assume first is YES, second is NO
      if ((yesPrice === null || noPrice === null) && allOutcomes.length === 2) {
        if (yesPrice === null) {
          yesPrice = allOutcomes[0].price;
        }
        if (noPrice === null) {
          noPrice = allOutcomes[1].price;
        }
      }
    }
    
    // Only default to 0.5 if we STILL have no price data
  if (yesPrice === null || noPrice === null) {
    // Default to 50/50 if no price data
    yesPrice = 0.5;
    noPrice = 0.5;
    }
  }
  
  // Validate and normalize prices
  if (isNaN(yesPrice) || yesPrice < 0 || yesPrice > 1) {
    yesPrice = 0.5;
  }
  if (isNaN(noPrice) || noPrice < 0 || noPrice > 1) {
    noPrice = 0.5;
  }
  
  // Normalize to sum to 1
  const total = yesPrice + noPrice;
  if (total > 0 && total !== 1) {
    yesPrice = yesPrice / total;
    noPrice = noPrice / total;
  }
  
  // Determine position - which side has the HIGHER price
  // GREEN (YES) if YES price > NO price
  // RED (NO) if NO price > YES price
  // If equal, default to YES (green)
  const position = yesPrice > noPrice ? 'YES' : 'NO';
  // Use the price of the winning side (the one with higher price)
  const currentPrice = position === 'YES' ? yesPrice : noPrice;
  
  const probability = Math.max(1, Math.min(99, Math.round(currentPrice * 100)));
  
  // Get market ID
  let marketId = actualMarket.condition_id || 
                 actualMarket.question_id || 
                 actualMarket.slug || 
                 actualMarket.id ||
                 actualMarket.market_id;
  
  if (!marketId) {
    const questionHash = question.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    marketId = `market-${question.substring(0, 30).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}-${Math.abs(questionHash).toString(36)}`;
  }
  
  // Get slug and condition ID for Polymarket links
  const marketSlug = actualMarket.market_slug || actualMarket.slug || actualMarket.event?.slug;
  // conditionId already declared above
  
  // Get image from market metadata
  const imageUrl = actualMarket.image || 
                   actualMarket.imageUrl || 
                   actualMarket.image_url ||
                   actualMarket.thumbnail ||
                   actualMarket.thumbnailUrl ||
                   actualMarket.thumbnail_url ||
                   actualMarket.event?.image ||
                   actualMarket.event?.imageUrl ||
                   market.image ||
                   market.imageUrl ||
                   market.thumbnail;
  
  // Detect category - log for debugging
  const category = detectCategoryFromMarket(actualMarket);
  
  // DEBUG: Log category detection for Earnings, Geopolitics, Elections
  const debugCategories = ['Earnings', 'Geopolitics', 'Elections'];
  if (debugCategories.includes(category)) {
    console.log(`[${category}] Market: "${question.substring(0, 50)}..."`);
    console.log(`  - API category: ${actualMarket.category || 'none'}`);
    console.log(`  - API tags: ${JSON.stringify(actualMarket.tags || [])}`);
    console.log(`  - Detected as: ${category}`);
  }
  
  // Extract volume and liquidity data - using actual Polymarket API field names
  const volume = actualMarket.volume || 
                 market.volume ||
                 actualMarket.event?.volume ||
                 0;
                 
  const volume24h = actualMarket.volume24hr || 
                    actualMarket.volume24h || 
                    actualMarket.volume_24h ||
                    market.volume24hr ||
                    market.volume24h ||
                    actualMarket.event?.volume24hr ||
                    0;
                    
  const volume7d = actualMarket.volume1wk || 
                   actualMarket.volume7d || 
                   actualMarket.volume_7d ||
                   market.volume1wk ||
                   market.volume7d ||
                   actualMarket.event?.volume1wk ||
                   0;
                   
  const liquidity = actualMarket.liquidity || 
                    actualMarket.liquidityClob ||
                    market.liquidity ||
                    market.liquidityClob ||
                    actualMarket.event?.liquidity ||
                    0;
  
  // Extract dates - using actual Polymarket API field names
  const endDate = actualMarket.endDate || 
                  actualMarket.end_date_iso || 
                  actualMarket.end_date ||
                  market.endDate ||
                  market.end_date_iso ||
                  actualMarket.event?.endDate ||
                  actualMarket.event?.end_date_iso;
                  
  const startDate = actualMarket.startDate ||
                    actualMarket.start_date ||
                    market.startDate ||
                    market.start_date ||
                    actualMarket.event?.startDate ||
                    actualMarket.event?.start_date;
                    
  const createdAt = actualMarket.creationDate ||
                    actualMarket.createdAt || 
                    actualMarket.created_at ||
                    actualMarket.created ||
                    market.creationDate ||
                    market.createdAt ||
                    actualMarket.event?.creationDate ||
                    actualMarket.event?.createdAt;
  
  // Extract tags - handle both array of strings and array of objects with label property
  let tags = [];
  if (actualMarket.tags && Array.isArray(actualMarket.tags)) {
    tags = actualMarket.tags.map(tag => {
      if (typeof tag === 'string') {
        return tag;
      } else if (tag && typeof tag === 'object' && tag.label) {
        return tag.label;
      } else if (tag && typeof tag === 'object' && tag.name) {
        return tag.name;
      }
      return null;
    }).filter(tag => tag !== null);
  } else if (actualMarket.tag) {
    tags = Array.isArray(actualMarket.tag) ? actualMarket.tag : [actualMarket.tag];
  }
  
  // Extract subcategory
  const subcategory = actualMarket.subcategory || actualMarket.sub_category;
  
  // Extract status flags
  const active = actualMarket.active !== false;
  const closed = actualMarket.closed === true || actualMarket.closed === 'true' || actualMarket.closed === 1;
  const archived = actualMarket.archived === true || actualMarket.archived === 'true' || actualMarket.archived === 1;
  const isNew = actualMarket.new === true || actualMarket.new === 'true' || actualMarket.new === 1;
  const featured = actualMarket.featured === true || actualMarket.featured === 'true' || actualMarket.featured === 1;
  
  // Calculate price change (mock for now, but we can calculate from price history if available)
  const change = parseFloat((Math.random() * 10 - 5).toFixed(1)); // Mock change for now
  
  // Assign agent
  const agent = MOCK_AGENTS[index % MOCK_AGENTS.length];
  
  return {
    id: String(marketId),
    question,
    probability,
    position,
    price: currentPrice,
    change,
    agentName: agent.name,
    agentEmoji: '',
    reasoning: actualMarket.description || actualMarket.summary || `Market analysis based on ${category} category.`,
    category,
    marketSlug: marketSlug ? String(marketSlug) : undefined,
    conditionId: conditionId ? String(conditionId) : undefined,
    imageUrl: imageUrl ? String(imageUrl) : undefined,
    // Additional Polymarket data
    volume: volume > 0 ? volume : undefined,
    volume24h: volume24h > 0 ? volume24h : undefined,
    volume7d: volume7d > 0 ? volume7d : undefined,
    liquidity: liquidity > 0 ? liquidity : undefined,
    yesPrice: yesPrice,
    noPrice: noPrice,
    outcomes: allOutcomes.length > 0 ? allOutcomes : undefined, // All outcomes with prices
    endDate: endDate ? String(endDate) : undefined,
    startDate: startDate ? String(startDate) : undefined,
    createdAt: createdAt ? String(createdAt) : undefined,
    tags: Array.isArray(tags) && tags.length > 0 ? tags : undefined,
    subcategory: subcategory ? String(subcategory) : undefined,
    active: active,
    closed: closed,
    archived: archived,
    new: isNew,
    featured: featured,
  };
}

// Transform multiple markets
export async function transformMarkets(markets) {
  const transformed = [];
  const seenIds = new Set();
  let filteredCount = 0;
  let noQuestionCount = 0;
  let expiredCount = 0;
  let closedCount = 0;
  
  // First, collect ALL tokens/outcomes from valid markets
  // Markets can have multiple outcomes (like "Bad Bunny", "Taylor Swift", etc.)
  // NOTE: Markets from Gamma API can be nested - check for market.markets array
  const allTokenIds = new Set();
  const marketTokenMap = new Map(); // Map conditionId -> { tokenId -> { marketIndex, outcome, outcomeName } }
  
  // Flatten nested markets structure
  // IMPORTANT: Events contain multiple markets (e.g., "Super Bowl Champion 2026" event has markets for each team)
  // We should ONLY show individual markets as bubbles, NOT the event itself
  const flattenedMarkets = [];
  for (let i = 0; i < markets.length; i++) {
    const market = markets[i];
    
    // Check if this market has nested markets array (event with multiple markets)
    if (market.markets && Array.isArray(market.markets) && market.markets.length > 0) {
      // This is an EVENT with multiple markets - extract each MARKET (but NOT the event itself)
      // Each market in the array is a separate bubble (e.g., "Will Los Angeles R win Super Bowl 2026?")
      for (const nestedMarket of market.markets) {
        // Only add if the nested market has a question (it's a real market, not just an outcome)
        const nestedQuestion = nestedMarket.question || nestedMarket.title || nestedMarket.name;
        if (nestedQuestion && nestedQuestion.trim()) {
          flattenedMarkets.push({
            ...nestedMarket,
            parentEvent: market
          });
        }
      }
      // DO NOT add the event itself as a bubble - events are just containers
    } else {
      // This is a single market (not an event)
      // Only add if it has a question (it's a real market)
      const question = (market.question || market.title || market.name || '').trim();
      if (question) {
        flattenedMarkets.push(market);
      }
    }
  }
  
  console.log(`Flattened ${markets.length} items into ${flattenedMarkets.length} actual markets (events excluded)`);
  
  for (let i = 0; i < flattenedMarkets.length; i++) {
    const market = flattenedMarkets[i];
    const actualMarket = market.market || market;
    
    // Get condition_id
    const conditionId = actualMarket.condition_id || 
                       actualMarket.event?.condition_id ||
                       market.condition_id ||
                       actualMarket.id ||
                       market.id;
    
    if (!conditionId) continue;
    
    const conditionIdStr = String(conditionId);
    
    // Extract token_ids from clobTokenIds (this is the actual token_id for the CLOB API)
    if (actualMarket.clobTokenIds) {
      try {
        let tokenIds = actualMarket.clobTokenIds;
        // Parse if it's a JSON string
        if (typeof tokenIds === 'string') {
          tokenIds = JSON.parse(tokenIds);
        }
        
        // Parse outcomes and outcomePrices
        let outcomes = [];
        let outcomePrices = [];
        
        if (actualMarket.outcomes) {
          if (typeof actualMarket.outcomes === 'string') {
            outcomes = JSON.parse(actualMarket.outcomes);
          } else if (Array.isArray(actualMarket.outcomes)) {
            outcomes = actualMarket.outcomes;
          }
        }
        
        if (actualMarket.outcomePrices) {
          if (typeof actualMarket.outcomePrices === 'string') {
            outcomePrices = JSON.parse(actualMarket.outcomePrices);
          } else if (Array.isArray(actualMarket.outcomePrices)) {
            outcomePrices = actualMarket.outcomePrices;
          }
        }
        
        // Check if this is augmented negative risk - only show named outcomes
        const isAugmentedNegRisk = actualMarket.negRiskAugmented === true || 
                                   actualMarket.enableNegRisk === true && actualMarket.negRiskAugmented === true ||
                                   market.negRiskAugmented === true ||
                                   market.parentEvent?.negRiskAugmented === true;
        
        // Store token_ids with their outcomes
        if (Array.isArray(tokenIds) && tokenIds.length > 0) {
          if (!marketTokenMap.has(conditionIdStr)) {
            marketTokenMap.set(conditionIdStr, new Map());
          }
          
          for (let idx = 0; idx < tokenIds.length; idx++) {
            const tokenId = String(tokenIds[idx]);
            const outcomeName = outcomes[idx] || 
                               (idx === 0 ? 'YES' : idx === 1 ? 'NO' : `Outcome ${idx}`);
            
            // For augmented negative risk, skip placeholder/unnamed outcomes
            // Only show named outcomes (not "Person A", "Person B", etc. placeholders)
            // and not "Other" unless it's the only option
            let isPlaceholder = false;
            if (isAugmentedNegRisk) {
              // Skip if it's a placeholder (starts with "Person" or is generic)
              isPlaceholder = outcomeName && (
                outcomeName.toLowerCase().startsWith('person ') ||
                outcomeName.toLowerCase().startsWith('placeholder') ||
                outcomeName.toLowerCase() === 'other' ||
                /^outcome \d+$/i.test(outcomeName)
              );
              
              // Skip placeholder outcomes for augmented negative risk
              if (isPlaceholder && outcomes.length > 3) {
                continue;
              }
            }
            
            allTokenIds.add(tokenId);
            
            marketTokenMap.get(conditionIdStr).set(tokenId, {
              marketIndex: i,
              outcome: outcomeName,
              tokenId: tokenId,
              outcomeIndex: idx,
              fallbackPrice: outcomePrices[idx] ? parseFloat(outcomePrices[idx]) : null,
              isNamed: !isPlaceholder || !isAugmentedNegRisk
            });
          }
        }
      } catch (e) {
        console.warn(`Failed to parse clobTokenIds for market ${conditionIdStr}:`, e.message);
      }
    }
    
    // Fallback: If no clobTokenIds, try tokens array
    if (actualMarket.tokens && Array.isArray(actualMarket.tokens)) {
      for (const token of actualMarket.tokens) {
        const tokenId = token.token_id || token.id || token.outcome_id || token.tokenId;
        if (!tokenId) continue;
        
        const tokenIdStr = String(tokenId);
        allTokenIds.add(tokenIdStr);
        
        if (!marketTokenMap.has(conditionIdStr)) {
          marketTokenMap.set(conditionIdStr, new Map());
        }
        
        const outcomeName = token.outcome || 
                           token.outcomeName || 
                           token.name ||
                           token.label ||
                           (tokenIdStr === '0' ? 'YES' : tokenIdStr === '1' ? 'NO' : `Outcome ${tokenIdStr}`);
        
        marketTokenMap.get(conditionIdStr).set(tokenIdStr, {
          marketIndex: i,
          outcome: outcomeName,
          tokenId: tokenIdStr
        });
      }
    }
  }
  
  // Debug: log token extraction
  console.log(`\n=== TOKEN EXTRACTION DEBUG ===`);
  console.log(`Extracted ${allTokenIds.size} unique token_ids from ${flattenedMarkets.length} markets`);
  console.log(`Markets with token maps: ${marketTokenMap.size}`);
  
  // Debug: Check first few markets to see their structure
  if (flattenedMarkets.length > 0) {
    console.log(`\nSample market structures (first 2):`);
    for (let i = 0; i < Math.min(2, flattenedMarkets.length); i++) {
      const market = flattenedMarkets[i];
      const actualMarket = market.market || market;
      const conditionId = actualMarket.condition_id || actualMarket.event?.condition_id || market.condition_id || actualMarket.id || market.id;
      
      console.log(`\nMarket ${i}:`);
      console.log(`  condition_id: ${conditionId}`);
      console.log(`  has clobTokenIds: ${!!actualMarket.clobTokenIds}`);
      console.log(`  has outcomePrices: ${!!actualMarket.outcomePrices}`);
      console.log(`  has outcomes: ${!!actualMarket.outcomes}`);
      
      if (actualMarket.clobTokenIds) {
        try {
          const tokenIds = typeof actualMarket.clobTokenIds === 'string' 
            ? JSON.parse(actualMarket.clobTokenIds) 
            : actualMarket.clobTokenIds;
          console.log(`  clobTokenIds:`, Array.isArray(tokenIds) ? `${tokenIds.length} tokens` : 'invalid format');
          if (Array.isArray(tokenIds) && tokenIds.length > 0) {
            console.log(`  First token_id: ${tokenIds[0]}`);
          }
        } catch (e) {
          console.log(`  Failed to parse clobTokenIds`);
        }
      }
      
      if (actualMarket.outcomePrices) {
        try {
          const prices = typeof actualMarket.outcomePrices === 'string'
            ? JSON.parse(actualMarket.outcomePrices)
            : actualMarket.outcomePrices;
          console.log(`  outcomePrices:`, Array.isArray(prices) ? prices : 'invalid format');
        } catch (e) {
          console.log(`  Failed to parse outcomePrices`);
        }
      }
      
      if (!actualMarket.clobTokenIds && !actualMarket.outcomePrices) {
        console.log(`  ⚠️  No price data found! Market keys:`, Object.keys(actualMarket).slice(0, 20));
      }
    }
  }
  
  if (marketTokenMap.size > 0) {
    const firstMarket = Array.from(marketTokenMap.entries())[0];
    console.log(`\nSample market (${firstMarket[0]}) has ${firstMarket[1].size} outcomes:`, 
      Array.from(firstMarket[1].values()).map(v => `${v.outcome} (token: ${v.tokenId})`));
  }
  console.log(`=== END TOKEN EXTRACTION DEBUG ===\n`);
  
  // Fetch prices for all token_ids
  // The /prices endpoint uses token_id as the key
  let pricesMap = {};
  if (allTokenIds.size > 0) {
    try {
      console.log(`Fetching prices for ${allTokenIds.size} tokens...`);
      // Fetch all prices from the endpoint
      const allPrices = await fetchMarketPrices(Array.from(allTokenIds));
      
      // DEBUG: Log what we got from the API
      console.log(`\n=== PRICE FETCHING DEBUG ===`);
      console.log(`Total prices returned from API: ${Object.keys(allPrices).length}`);
      console.log(`Sample API price keys (first 10):`, Object.keys(allPrices).slice(0, 10));
      console.log(`Sample API price values (first 3):`, 
        Object.entries(allPrices).slice(0, 3).map(([k, v]) => ({ key: k, value: v })));
      
      // Map prices back to markets by condition_id and token_id
      let matchedCount = 0;
      let unmatchedCount = 0;
      
      for (const [conditionId, tokens] of marketTokenMap.entries()) {
        if (!pricesMap[conditionId]) {
          pricesMap[conditionId] = {};
        }
        
        for (const [tokenId, tokenInfo] of tokens.entries()) {
          // The prices endpoint returns { tokenId: { BUY: price, SELL: price } }
          const priceData = allPrices[tokenId];
          
          if (priceData && priceData.BUY && priceData.SELL) {
            pricesMap[conditionId][tokenId] = {
              BUY: priceData.BUY,
              SELL: priceData.SELL,
              outcome: tokenInfo.outcome,
              fallbackPrice: tokenInfo.fallbackPrice
            };
            matchedCount++;
          } else {
            // Use fallback price from outcomePrices if available
            if (tokenInfo.fallbackPrice !== null && tokenInfo.fallbackPrice !== undefined) {
              pricesMap[conditionId][tokenId] = {
                BUY: String(tokenInfo.fallbackPrice),
                SELL: String(tokenInfo.fallbackPrice),
                outcome: tokenInfo.outcome,
                fallbackPrice: tokenInfo.fallbackPrice,
                isFallback: true
              };
              matchedCount++;
            } else {
              unmatchedCount++;
              if (unmatchedCount <= 5) {
                console.log(`⚠️  No price found for conditionId=${conditionId}, tokenId=${tokenId}, outcome=${tokenInfo.outcome}`);
                console.log(`   Available token_ids in prices:`, Object.keys(allPrices).slice(0, 10));
              }
            }
          }
        }
      }
      
      const marketsWithPrices = Object.keys(pricesMap).length;
      const totalOutcomesWithPrices = Object.values(pricesMap).reduce((sum, tokens) => sum + Object.keys(tokens).length, 0);
      console.log(`\n=== PRICE MATCHING RESULTS ===`);
      console.log(`Markets with prices: ${marketsWithPrices}/${marketTokenMap.size}`);
      console.log(`Outcomes matched: ${matchedCount}, unmatched: ${unmatchedCount}`);
      
      if (marketsWithPrices > 0) {
        // Log first market's prices in detail
        const firstMarket = Object.entries(pricesMap)[0];
        console.log(`\n✅ Sample market ${firstMarket[0]} has ${Object.keys(firstMarket[1]).length} outcomes with prices:`);
        Object.entries(firstMarket[1]).forEach(([tokenId, data]) => {
          console.log(`   - ${data.outcome || tokenId} (token: ${tokenId}):`, JSON.stringify(data));
        });
      } else {
        console.log(`\n❌ NO MARKETS GOT PRICES! This is a problem.`);
        console.log(`Available price keys in API response:`, Object.keys(allPrices).slice(0, 20));
        console.log(`Sample market condition_ids we're looking for:`, Array.from(marketTokenMap.keys()).slice(0, 5));
      }
      console.log(`=== END PRICE DEBUG ===\n`);
    } catch (error) {
      console.warn(`Error fetching prices: ${error.message}`);
      console.error(error);
    }
  } else {
    console.warn('No token_ids found to fetch prices for');
  }
  
  // Now transform markets with prices (use flattened markets)
  for (let i = 0; i < flattenedMarkets.length; i++) {
    const market = flattenedMarkets[i];
    
    // Filter out invalid markets
    if (!filterMarket(market)) {
      filteredCount++;
      // Log first few filtered markets for debugging
      if (filteredCount <= 5) {
        const actualMarket = market.market || market;
        const question = actualMarket.question || actualMarket.title || actualMarket.name || 'NO QUESTION';
        const closed = actualMarket.closed ?? market.closed;
        const archived = actualMarket.archived ?? market.archived;
        const endDate = actualMarket.end_date_iso || actualMarket.end_date || market.end_date_iso || market.end_date;
        const now = new Date();
        
        if (closed || archived) closedCount++;
        if (endDate && new Date(endDate) < now) expiredCount++;
        if (!question || question.trim() === '') noQuestionCount++;
      }
      continue;
    }
    
    const prediction = transformMarket(market, i, pricesMap);
    if (!prediction) {
      continue;
    }
    
    // Additional filter: Check if prediction is expired (double-check after transformation)
    if (prediction.endDate) {
      try {
        const endDateObj = new Date(prediction.endDate);
        const now = new Date();
        // Add 1 hour buffer for timezone issues
        const buffer = 60 * 60 * 1000; // 1 hour in milliseconds
        if (!isNaN(endDateObj.getTime()) && endDateObj.getTime() < (now.getTime() - buffer)) {
          // Market has expired, skip it
          filteredCount++;
          expiredCount++;
          continue;
        }
      } catch (e) {
        // Invalid date, continue
      }
    }
    
    // Filter out markets with default 0.5 prices (no real price data)
    // Only include markets that have real prices OR outcomes with prices
    if (prediction.yesPrice === 0.5 && prediction.noPrice === 0.5) {
      // Check if we have outcomes with real prices
      const hasRealPrices = prediction.outcomes && prediction.outcomes.some(o => 
        o.price !== 0.5 && o.price > 0 && o.price < 1
      );
      
      if (!hasRealPrices) {
        // No real prices, skip this market
        filteredCount++;
        continue;
      }
    }
    
    // Filter out markets without volume or liquidity (double-check after transformation)
    if (!prediction.volume || prediction.volume <= 0) {
      filteredCount++;
      continue;
    }
    
    if (!prediction.liquidity || prediction.liquidity <= 0) {
      filteredCount++;
      continue;
    }
    
    // Filter out markets without slug/URL (double-check after transformation)
    if (!prediction.marketSlug || prediction.marketSlug.trim() === '') {
      filteredCount++;
      continue;
    }
    
    // DEBUG: Log if we have outcomes/prices
    if (i < 3) {
      console.log(`\n[Transform ${i}] Market: ${prediction.question.substring(0, 50)}...`);
      console.log(`  Has outcomes: ${prediction.outcomes ? prediction.outcomes.length : 0}`);
      console.log(`  yesPrice: ${prediction.yesPrice}, noPrice: ${prediction.noPrice}`);
      if (prediction.outcomes && prediction.outcomes.length > 0) {
        console.log(`  Outcomes:`, prediction.outcomes.map(o => `${o.name}: $${o.price.toFixed(3)}`));
      }
    }
    
    // Check for duplicates
    if (seenIds.has(prediction.id)) {
      prediction.id = `${prediction.id}-${i}`;
    }
    seenIds.add(prediction.id);
    
    transformed.push(prediction);
  }
  
  return transformed;
}


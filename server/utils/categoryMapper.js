// Category Mapping Utility
// Maps Polymarket categories/tags to our category system

export function mapCategoryToPolymarket(category) {
  const categoryMap = {
    'Politics': 'politics',
    'Elections': 'elections', // Try elections as separate category
    'Sports': 'sports',
    'Crypto': 'crypto',
    'Finance': 'finance',
    'Tech': 'tech',
    'Geopolitics': 'geopolitics', // Try geopolitics as separate category
    'Earnings': 'earnings', // Try earnings as separate category
    'World': null,
    'Breaking': null,
    'Trending': null,
    'New': null,
  };
  return categoryMap[category] || null;
}

export function detectCategoryFromMarket(market) {
  // Check multiple possible category fields
  const category = (market.category || market.topic || market.subcategory || '').toLowerCase();
  const tags = (market.tags || []).map(t => String(t || '').toLowerCase()).filter(t => t);
  const question = (market.question || market.title || market.name || '').toLowerCase();
  const description = (market.description || market.summary || '').toLowerCase();

  // Elections - check FIRST before Politics (more specific)
  if (category === 'elections' || category.includes('election') ||
      tags.some(t => (t.includes('election') || t.includes('vote') || t.includes('ballot') || t.includes('presidential') || t.includes('congressional') || t.includes('senate') || t.includes('house')) && !t.includes('politics')) ||
      (question.includes('election') || question.includes('vote') || question.includes('ballot') || question.includes('presidential election') || question.includes('congressional election') || question.includes('senate election') || question.includes('house election')) ||
      description.includes('election') || description.includes('vote') || description.includes('ballot')) {
    return 'Elections';
  }

  // Politics - check after Elections
  if (category.includes('politics') ||
      tags.some(t => t.includes('politics') || t.includes('trump') || t.includes('biden')) ||
      question.includes('president') || question.includes('trump') || question.includes('biden') ||
      question.includes('congress') || question.includes('senate') || question.includes('house') || question.includes('government')) {
    return 'Politics';
  }

  // Sports
  if (category.includes('sports') ||
      tags.some(t => t.includes('sports') || t.includes('football') || t.includes('basketball') || t.includes('soccer') || t.includes('nfl') || t.includes('nba')) ||
      question.includes('super bowl') || question.includes('nfl') || question.includes('nba') ||
      question.includes('football') || question.includes('basketball') || question.includes('soccer') ||
      question.includes('baseball') || question.includes('hockey') || question.includes('tennis') ||
      question.includes('championship') || question.includes('playoff') || question.includes('world cup') ||
      question.includes('olympics') || question.includes('ncaa') || question.includes('ufc')) {
    return 'Sports';
  }

  // Crypto
  if (category.includes('crypto') || category.includes('cryptocurrency') ||
      tags.some(t => t.includes('crypto') || t.includes('bitcoin') || t.includes('ethereum') || t.includes('btc') || t.includes('eth') || t.includes('solana')) ||
      question.includes('bitcoin') || question.includes('ethereum') || question.includes('crypto') ||
      question.includes('btc') || question.includes('eth') || question.includes('solana') ||
      question.includes('blockchain') || question.includes('defi') || question.includes('nft')) {
    return 'Crypto';
  }

  // Earnings - check FIRST before Finance (more specific)
  // Look for company earnings reports, quarterly results, revenue, EPS, etc.
  // EXCLUDE: "top grossing" (box office), "grossing movie" (entertainment revenue)
  const earningsKeywords = ['earnings', 'quarterly', 'q1', 'q2', 'q3', 'q4', 'revenue', 'eps', 'earnings per share', 'earnings report', 'quarterly earnings', 'earnings call', 'earnings announcement'];
  const companyNames = ['apple', 'microsoft', 'google', 'amazon', 'meta', 'tesla', 'nvidia', 'netflix', 'disney', 'nike', 'coca-cola', 'pepsi', 'walmart', 'target', 'mcdonald', 'starbucks', 'boeing', 'jpmorgan', 'bank of america', 'goldman sachs', 'morgan stanley'];
  
  // Exclude false positives - box office revenue is NOT company earnings
  const earningsFalsePositives = ['top grossing', 'grossing movie', 'box office', 'movie revenue', 'film revenue'];
  const isEarningsFalsePositive = earningsFalsePositives.some(k => question.includes(k) || description.includes(k));
  
  if (!isEarningsFalsePositive && (
      category.includes('earnings') || 
      tags.some(t => earningsKeywords.some(k => t.includes(k))) ||
      question.includes('earnings') || 
      (question.includes('quarterly') && !question.includes('movie') && !question.includes('film')) ||
      (question.includes('revenue') && !question.includes('movie') && !question.includes('film') && !question.includes('box office')) ||
      question.includes('eps') || 
      question.includes('earnings per share') || question.includes('earnings report') ||
      question.includes('earnings call') || question.includes('earnings announcement') ||
      (companyNames.some(company => question.includes(company)) && (question.includes('earnings') || question.includes('revenue') || question.includes('quarterly') || question.includes('profit'))) ||
      description.includes('earnings') || 
      (description.includes('quarterly') && !description.includes('movie')) ||
      (description.includes('revenue') && !description.includes('movie') && !description.includes('box office')) ||
      description.includes('eps') ||
      description.includes('earnings report') || description.includes('earnings call'))) {
    return 'Earnings';
  }

  // Finance - check after Earnings
  if (category.includes('finance') || category.includes('stocks') ||
      tags.some(t => t.includes('finance') || t.includes('stock') || t.includes('trading')) ||
      question.includes('stock') || question.includes('dow') || question.includes('s&p') ||
      question.includes('nasdaq') || question.includes('fed') || question.includes('interest rate')) {
    return 'Finance';
  }

  // Tech - be specific, don't just match company names
  if (category.includes('tech') || category.includes('technology') ||
      tags.some(t => t.includes('tech') || t.includes('ai') || t.includes('artificial intelligence') || t.includes('software')) ||
      question.includes('artificial intelligence') || question.includes('chatgpt') ||
      question.includes('gpt') || question.includes('openai') ||
      question.includes('software') || question.includes('algorithm') ||
      question.includes('machine learning') || question.includes('neural network')) {
    return 'Tech';
  }

  // Entertainment/Movies - check BEFORE Geopolitics to avoid false positives
  // Movies often mention "war", "military", "invasion" etc. but are not geopolitical
  const entertainmentKeywords = ['movie', 'film', 'cinema', 'box office', 'top grossing', 'grossing movie', 'entertainment', 'celebrity', 'actor', 'actress', 'director', 'oscar', 'emmy', 'grammy', 'premiere', 'release date', 'trailer', 'sequel', 'franchise', 'studio', 'hollywood', 'netflix', 'disney+', 'hbo', 'streaming', 'tv show', 'series', 'episode'];
  const hasEntertainmentTag = tags.some(t => entertainmentKeywords.some(k => t.includes(k)));
  const hasEntertainmentQuestion = entertainmentKeywords.some(k => question.includes(k));
  const hasEntertainmentDesc = entertainmentKeywords.some(k => description.includes(k));
  
  if (category.includes('entertainment') || category.includes('movies') || category.includes('film') || category.includes('tv') ||
      hasEntertainmentTag || hasEntertainmentQuestion || hasEntertainmentDesc) {
    return 'World'; // Return 'World' for entertainment (or could add 'Entertainment' category)
  }

  // Geopolitics - check for geopolitical keywords (be specific, avoid false positives)
  // Only match if it's clearly about international relations, conflicts, wars, etc.
  // IMPORTANT: This must come AFTER Entertainment check to avoid false positives
  // Use more specific keywords that are less likely to appear in movies/entertainment
  const strongGeopoliticsKeywords = ['geopolitics', 'geopolitical', 'ukraine', 'russia', 'china', 'taiwan', 'israel', 'palestine', 'iran', 'nato', 'sanctions', 'embargo', 'diplomacy', 'treaty', 'alliance', 'middle east', 'gaza', 'lebanon', 'syria', 'putin', 'zelenskyy', 'netanyahu', 'xi jinping', 'trump', 'biden', 'president', 'prime minister', 'supreme leader'];
  const weakGeopoliticsKeywords = ['war', 'conflict', 'military', 'invasion', 'attack', 'strike', 'ceasefire', 'peace deal'];
  
  // Count how many strong indicators we have
  const strongCount = [
    category.includes('geopolitics') || category.includes('geopolitical'),
    tags.some(t => strongGeopoliticsKeywords.some(k => t.includes(k))),
    strongGeopoliticsKeywords.some(k => question.includes(k)),
    strongGeopoliticsKeywords.some(k => description.includes(k))
  ].filter(Boolean).length;
  
  // Count weak indicators (these could be in movies, so require strong indicators too)
  const hasWeakIndicator = tags.some(t => weakGeopoliticsKeywords.some(k => t.includes(k))) ||
                          weakGeopoliticsKeywords.some(k => question.includes(k)) ||
                          weakGeopoliticsKeywords.some(k => description.includes(k));
  
  // Exclude false positives - don't match if it's about movies, entertainment, etc.
  const falsePositiveKeywords = ['top grossing', 'movie', 'film', 'box office', 'entertainment', 'celebrity', 'actor', 'actress', 'cinema', 'hollywood', 'oscar', 'premiere', 'trailer', 'sequel', 'release date', 'director', 'studio'];
  const isFalsePositive = falsePositiveKeywords.some(k => question.includes(k) || description.includes(k));
  
  // Require at least 2 strong indicators OR 1 strong + category match to avoid false positives
  // This ensures we only match real geopolitical events, not movies about wars
  const hasStrongGeopoliticsSignal = strongCount >= 2 || 
                                     (strongCount >= 1 && (category.includes('geopolitics') || category.includes('geopolitical'))) ||
                                     (strongCount >= 1 && hasWeakIndicator);
  
  if (hasStrongGeopoliticsSignal && !isFalsePositive) {
    return 'Geopolitics';
  }

  // Default
  return 'World';
}


/**
 * Web search integration for agent market research
 *
 * Agents can search the web for market-specific information to make better decisions.
 * Uses SerpAPI or Google Custom Search API for web search.
 * Results are kept concise to minimize API costs.
 */
/**
 * Search the web for market information
 *
 * @param query - Search query (market question + keywords)
 * @returns Array of search results (max 5 to save credits)
 */
export async function searchWebForMarket(query) {
    try {
        // Try SerpAPI first (if configured)
        const serpApiKey = process.env.SERP_API_KEY;
        if (serpApiKey) {
            return await searchWithSerpAPI(query, serpApiKey);
        }
        // Try Google Custom Search API (if configured)
        const googleSearchApiKey = process.env.GOOGLE_SEARCH_API_KEY;
        const googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
        if (googleSearchApiKey && googleSearchEngineId) {
            return await searchWithGoogleCustomSearch(query, googleSearchApiKey, googleSearchEngineId);
        }
        // No search API configured - return empty (agents will use news/articles instead)
        console.log('[WebSearch] No search API configured - using news/articles only');
        return [];
    }
    catch (error) {
        console.error('[WebSearch] Error searching web:', error);
        return []; // Return empty on error - don't block agent decisions
    }
}
/**
 * Search using SerpAPI
 */
async function searchWithSerpAPI(query, apiKey) {
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${apiKey}&num=5`;
    const response = await fetch(url, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    if (!response.ok) {
        throw new Error(`SerpAPI error: ${response.status}`);
    }
    const data = await response.json();
    const results = data.organic_results || [];
    return results.slice(0, 5).map((result) => ({
        title: result.title || '',
        snippet: (result.snippet || '').substring(0, 150), // Keep snippets short
        url: result.link || '',
        source: extractSourceFromUrl(result.link || ''),
    }));
}
/**
 * Search using Google Custom Search API
 */
async function searchWithGoogleCustomSearch(query, apiKey, engineId) {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(query)}&num=5`;
    const response = await fetch(url, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    if (!response.ok) {
        throw new Error(`Google Custom Search error: ${response.status}`);
    }
    const data = await response.json();
    const results = data.items || [];
    return results.slice(0, 5).map((result) => ({
        title: result.title || '',
        snippet: (result.snippet || '').substring(0, 150), // Keep snippets short
        url: result.link || '',
        source: extractSourceFromUrl(result.link || ''),
    }));
}
/**
 * Extract source name from URL
 */
function extractSourceFromUrl(url) {
    try {
        const domain = new URL(url).hostname;
        // Remove www. and common TLDs, extract main domain
        const parts = domain.replace(/^www\./, '').split('.');
        if (parts.length >= 2) {
            return parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
        }
        return domain;
    }
    catch {
        return 'Web';
    }
}
/**
 * Build search query from market question
 *
 * Extracts key terms from market question for focused search
 */
export function buildMarketSearchQuery(marketQuestion, category) {
    // Extract key terms (remove common words)
    const stopWords = ['will', 'the', 'be', 'by', 'in', 'on', 'at', 'to', 'for', 'of', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were'];
    const words = marketQuestion
        .toLowerCase()
        .split(/[\s\-_.,;:!?()]+/)
        .filter(w => w.length >= 3 && !stopWords.includes(w))
        .slice(0, 5); // Take first 5 meaningful words
    let query = words.join(' ');
    // Add category if provided for more focused search
    if (category && category !== 'Other') {
        query = `${query} ${category}`;
    }
    // Add "news" or "prediction" to get relevant results
    query = `${query} news prediction`;
    return query.trim();
}

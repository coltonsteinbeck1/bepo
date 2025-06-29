const STEAM_NEWS_API_URL = 'https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/';
const CS2_APP_ID = 730;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

let patchNotesCache = {
  data: null,
  timestamp: 0
};

/**
 * Fetches CS2 patch notes from Steam News API
 * @param {number} count - Number of news items to fetch
 * @returns {Promise<Array>} Array of patch note objects
 */
async function fetchPatchNotesFromSteam(count = 20) {
  try {
    const url = `${STEAM_NEWS_API_URL}?appid=${CS2_APP_ID}&count=${count}&maxlength=2000&format=json`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.appnews || !data.appnews.newsitems) {
      throw new Error('Invalid API response structure');
    }

    const patchNotes = data.appnews.newsitems
      .filter(item => {
        // Filter for actual patch notes - look for items with patchnotes tag or Update in title
        return (item.tags && item.tags.includes('patchnotes')) || 
               item.title.toLowerCase().includes('counter-strike 2 update') ||
               item.title.toLowerCase().includes('cs2 update');
      })
      .map(item => ({
        title: item.title,
        date: new Date(item.date * 1000), // Convert Unix timestamp to Date
        content: cleanSteamContent(item.contents),
        link: 'https://www.counter-strike.net/news/updates',
        author: item.author,
        tags: item.tags || [],
        gid: item.gid,
        timestamp: Date.now()
      }))
      .sort((a, b) => b.date - a.date); // Sort by date, newest first

    return patchNotes;
  } catch (error) {
    console.error('Error fetching CS2 patch notes from Steam API:', error);
    throw error;
  }
}

/**
 * Clean and format Steam content for Discord display
 * @param {string} content - Raw Steam content
 * @returns {string} Cleaned content
 */
function cleanSteamContent(content) {
  return content
    .replace(/https:\/\/clan\.cloudflare\.steamstatic\.com\/images\/[^\s]+/g, '') // Remove image URLs
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .substring(0, 1500); // Limit length for Discord
}

/**
 * Get cached patch notes or fetch new ones from Steam API
 * @param {boolean} forceRefresh - Force refresh cache
 * @returns {Promise<Array>} Array of patch note objects
 */
async function getCachedPatchNotes(forceRefresh = false) {
  const now = Date.now();
  
  if (!forceRefresh && patchNotesCache.data && (now - patchNotesCache.timestamp) < CACHE_DURATION) {
    return patchNotesCache.data;
  }

  try {
    const freshData = await fetchPatchNotesFromSteam();
    patchNotesCache = {
      data: freshData,
      timestamp: now
    };
    return freshData;
  } catch (error) {
    // If fetch fails but we have cached data, return it
    if (patchNotesCache.data) {
      console.warn('Using cached data due to fetch error:', error.message);
      return patchNotesCache.data;
    }
    // If no cached data, return empty array instead of throwing
    console.error('Failed to fetch patch notes and no cache available:', error.message);
    return [];
  }
}

/**
 * Filter patch notes based on criteria
 * @param {Array} patchNotes - Array of patch notes
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered patch notes
 */
function filterPatchNotes(patchNotes, filters = {}) {
  let filtered = [...patchNotes];

  // Filter by count
  if (filters.count && filters.count > 0) {
    filtered = filtered.slice(0, filters.count);
  }

  // Filter by date range
  if (filters.daysAgo) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - filters.daysAgo);
    filtered = filtered.filter(note => note.date >= cutoffDate);
  }

  // Filter by months ago
  if (filters.monthsAgo) {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - filters.monthsAgo);
    filtered = filtered.filter(note => note.date >= cutoffDate);
  }

  // Filter by keyword
  if (filters.keyword) {
    const keyword = filters.keyword.toLowerCase();
    filtered = filtered.filter(note => 
      note.title.toLowerCase().includes(keyword) || 
      note.content.toLowerCase().includes(keyword)
    );
  }

  return filtered;
}

/**
 * Format patch note content for Discord embed
 * @param {string} content - Raw content
 * @returns {string} Formatted content
 */
function formatContent(content) {
  return content
    .replace(/\[\/?list\]/g, '')        // Remove [list] and [/list] tags
    .replace(/\[\*\]/g, '• ')           // Replace [*] with bullet points
    .replace(/\[\/?\w+(=[^\]]+)?\]/g, '') // Remove other BBCode tags
    .replace(/\r?\n|\r/g, '\n')         // Normalize newlines
    .replace(/\n{2,}/g, '\n')           // Replace multiple newlines with a single newline
    .trim()
    .substring(0, 1024); // Discord embed field limit
}

export {
  fetchPatchNotesFromSteam,
  getCachedPatchNotes,
  filterPatchNotes,
  formatContent,
  cleanSteamContent
};

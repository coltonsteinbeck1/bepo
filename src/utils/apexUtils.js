const APEX_NEWS_URL = 'https://www.ea.com/games/apex-legends/apex-legends/news?type=game-updates';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

let patchNotesCache = {
    data: null,
    timestamp: 0
};

/**
 * Fetches Apex Legends patch notes from EA's news page
 * @param {number} count - Number of news items to fetch
 * @returns {Promise<Array>} Array of patch note objects
 */
async function fetchPatchNotesFromEA(count = 15) {
    try {
        console.log('🎮 Fetching Apex Legends patch notes from EA news page...');

        // Fetch the main news page to get article links
        const response = await fetch(APEX_NEWS_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const html = await response.text();
        const articleLinks = extractArticleLinks(html);

        console.log(`📄 Found ${articleLinks.length} article links`);

        if (articleLinks.length === 0) {
            console.warn('No article links found on news page');
            return [];
        }

        // Fetch content from individual articles
        const patchNotes = [];
        const linksToFetch = articleLinks.slice(0, count);

        for (const link of linksToFetch) {
            try {
                console.log(`📖 Fetching article: ${link.title}`);
                const article = await fetchArticleContent(link);
                if (article && isGameUpdate(article.title, article.content)) {
                    patchNotes.push(article);
                }
            } catch (error) {
                console.error(`Error fetching article ${link.url}:`, error.message);
                // Continue with other articles
            }
        }

        console.log(`✅ Successfully fetched ${patchNotes.length} patch notes`);
        
        // Sort by date (newest first) - ensure proper date sorting
        const sortedNotes = patchNotes.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB.getTime() - dateA.getTime(); // Newest first
        });
        
        console.log('📅 Patch notes sorted by date (newest first):');
        sortedNotes.forEach((note, index) => {
            console.log(`${index + 1}. ${note.title} - ${note.date.toLocaleDateString()}`);
        });
        
        return sortedNotes;

    } catch (error) {
        console.error('Error fetching Apex patch notes:', error);
        throw error;
    }
}

/**
 * Extract article links from the main news page HTML
 * @param {string} html - HTML content of the news page
 * @returns {Array} Array of article link objects
 */
function extractArticleLinks(html) {
    const links = [];

    try {
        // Look for news article paths in multiple formats
        // Pattern 1: news/article-name (most common)
        const pathMatches = html.match(/news\/[a-z0-9-]+(?:-event|-patch-notes|-update)?/g);
        
        // Pattern 2: Full URLs to apex legends news
        const urlMatches = html.match(/https:\/\/www\.ea\.com\/games\/apex-legends\/apex-legends\/news\/[a-z0-9-]+/g);

        const allPaths = new Set();
        
        // Add paths from pattern 1
        if (pathMatches) {
            pathMatches.forEach(path => allPaths.add(path));
        }
        
        // Add paths from pattern 2 (extract just the path part)
        if (urlMatches) {
            urlMatches.forEach(url => {
                const pathMatch = url.match(/news\/([a-z0-9-]+)$/);
                if (pathMatch) {
                    allPaths.add(`news/${pathMatch[1]}`);
                }
            });
        }

        console.log(`Found ${allPaths.size} unique news paths`);

        for (const path of allPaths) {
            const url = `https://www.ea.com/games/apex-legends/apex-legends/${path}`;

            // Create a title from the path
            const pathName = path.split('/')[1]; // Remove 'news/' prefix
            const title = pathName
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

            // Include all game updates - patch notes, events, and updates
            if (isGameUpdate(title, pathName)) {
                links.push({
                    url: url,
                    title: title
                });
            }
        }

        console.log(`Filtered to ${links.length} game update articles`);

    } catch (error) {
        console.error('Error extracting article links:', error);
    }

    return links;
}

/**
 * Fetch and parse content from an individual article
 * @param {Object} linkInfo - Object with url and title
 * @returns {Promise<Object>} Patch note object
 */
async function fetchArticleContent(linkInfo) {
    try {
        const response = await fetch(linkInfo.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const html = await response.text();
        return parseArticleContent(html, linkInfo);

    } catch (error) {
        console.error(`Error fetching article ${linkInfo.url}:`, error);
        return null;
    }
}

/**
 * Parse HTML content from an individual article page
 * @param {string} html - HTML content of the article
 * @param {Object} linkInfo - Object with url and title
 * @returns {Object} Parsed article object
 */
function parseArticleContent(html, linkInfo) {
    try {
        // Extract the main title
        let title = linkInfo.title;
        const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
        if (titleMatch) {
            title = cleanTextContent(titleMatch[1]);
        }

        // Extract date - look for dates in various formats
        let date = new Date();
        
        // Look for date pattern like "May 5, 2025" in the content
        const datePattern = /([A-Za-z]+\s+\d{1,2},\s+\d{4})/;
        const dateMatch = html.match(datePattern);
        if (dateMatch) {
            const parsedDate = new Date(dateMatch[1]);
            if (!isNaN(parsedDate.getTime())) {
                date = parsedDate;
            }
        }

        // Extract PATCH NOTES content specifically
        let content = extractPatchNotesContent(html);
        
        // If no patch notes section found, try balance updates
        if (!content || content.length < 50) {
            content = extractBalanceUpdatesContent(html);
        }
        
        // For events, try extracting game updates or changes section
        if (!content || content.length < 50) {
            content = extractEventUpdatesContent(html);
        }
        
        // If still no content, get a general summary
        if (!content || content.length < 50) {
            content = extractGeneralContent(html);
        }

        return {
            title: title,
            date: date,
            content: content.substring(0, 2000), // Increased limit for better content
            link: linkInfo.url,
            author: 'Respawn Entertainment',
            tags: extractTags(title, content),
            id: generateId(title, date),
            timestamp: date.getTime() // Use actual date for timestamp, not current time
        };

    } catch (error) {
        console.error('Error parsing article content:', error);
        return {
            title: linkInfo.title,
            date: new Date(),
            content: 'Unable to parse article content. Please visit the link for full details.',
            link: linkInfo.url,
            author: 'Respawn Entertainment',
            tags: ['apex-legends'],
            id: generateId(linkInfo.title, new Date()),
            timestamp: Date.now()
        };
    }
}

/**
 * Extract content specifically from the PATCH NOTES section
 * @param {string} html - HTML content
 * @returns {string} Extracted patch notes content
 */
function extractPatchNotesContent(html) {
    try {
        // Look for "## PATCH NOTES" section and everything under it until next major section
        const patchNotesRegex = /<h2[^>]*>[^<]*PATCH\s+NOTES[^<]*<\/h2>(.*?)(?=<h2|<\/body|$)/is;
        const match = html.match(patchNotesRegex);
        
        if (match) {
            let content = match[1];
            
            // Extract structured content from patch notes
            const structuredContent = extractStructuredPatchContent(content);
            return structuredContent;
        }
        
        return '';
    } catch (error) {
        console.error('Error extracting patch notes content:', error);
        return '';
    }
}

/**
 * Extract structured content from patch notes HTML
 * @param {string} html - HTML content from patch notes section
 * @returns {string} Formatted patch notes content
 */
function extractStructuredPatchContent(html) {
    try {
        let content = '';
        
        // Extract Balance Updates section
        const balanceMatch = html.match(/<h3[^>]*>[^<]*BALANCE\s+UPDATES[^<]*<\/h3>(.*?)(?=<h3|<h2|$)/is);
        if (balanceMatch) {
            content += '**BALANCE UPDATES**\n';
            content += cleanAndFormatContent(balanceMatch[1]) + '\n\n';
        }
        
        // Extract Game Updates section
        const gameMatch = html.match(/<h3[^>]*>[^<]*GAME\s+UPDATES[^<]*<\/h3>(.*?)(?=<h3|<h2|$)/is);
        if (gameMatch) {
            content += '**GAME UPDATES**\n';
            content += cleanAndFormatContent(gameMatch[1]) + '\n\n';
        }
        
        // Extract Legends section
        const legendsMatch = html.match(/<h3[^>]*>[^<]*LEGENDS[^<]*<\/h3>(.*?)(?=<h3|<h2|$)/is);
        if (legendsMatch) {
            content += '**LEGENDS**\n';
            content += cleanAndFormatContent(legendsMatch[1]) + '\n\n';
        }
        
        // Extract Weapons section
        const weaponsMatch = html.match(/<h3[^>]*>[^<]*WEAPONS[^<]*<\/h3>(.*?)(?=<h3|<h2|$)/is);
        if (weaponsMatch) {
            content += '**WEAPONS**\n';
            content += cleanAndFormatContent(weaponsMatch[1]) + '\n\n';
        }
        
        // Extract Maps section
        const mapsMatch = html.match(/<h3[^>]*>[^<]*MAPS[^<]*<\/h3>(.*?)(?=<h3|<h2|$)/is);
        if (mapsMatch) {
            content += '**MAPS**\n';
            content += cleanAndFormatContent(mapsMatch[1]) + '\n\n';
        }
        
        // If no specific sections found, clean the entire patch notes content
        if (!content) {
            content = cleanAndFormatContent(html);
        }
        
        return content.trim();
    } catch (error) {
        console.error('Error extracting structured patch content:', error);
        return cleanAndFormatContent(html);
    }
}

/**
 * Clean and format content while preserving structure
 * @param {string} html - HTML content to clean
 * @returns {string} Cleaned and formatted content
 */
function cleanAndFormatContent(html) {
    return html
        // Remove images but keep their alt text
        .replace(/<img[^>]*alt=["']([^"']+)["'][^>]*>/gi, '')
        // Convert headers to markdown-style formatting
        .replace(/<h[4-6][^>]*>(.*?)<\/h[4-6]>/gi, '**$1**\n')
        // Convert strong/bold tags
        .replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gi, '**$2**')
        // Convert em/italic tags
        .replace(/<(em|i)[^>]*>(.*?)<\/\1>/gi, '*$2*')
        // Convert list items
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
        // Convert paragraphs to line breaks
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        // Remove all remaining HTML tags
        .replace(/<[^>]+>/g, ' ')
        // Clean up HTML entities
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&[a-zA-Z0-9#]+;/g, ' ')
        // Clean up whitespace
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Max 2 consecutive newlines
        .replace(/[ \t]+/g, ' ') // Normalize spaces
        .replace(/^\s+|\s+$/gm, '') // Trim lines
        .trim();
}

/**
 * Extract content from Balance Updates section (fallback)
 * @param {string} html - HTML content
 * @returns {string} Extracted balance updates content
 */
function extractBalanceUpdatesContent(html) {
    try {
        const balanceMatch = html.match(/<h2[^>]*>[^<]*BALANCE[^<]*<\/h2>(.*?)(?=<h2|$)/is);
        if (balanceMatch) {
            return cleanAndFormatContent(balanceMatch[1]);
        }
        return '';
    } catch (error) {
        console.error('Error extracting balance updates content:', error);
        return '';
    }
}

/**
 * Extract content from Events that contain game updates
 * @param {string} html - HTML content
 * @returns {string} Extracted event updates content
 */
function extractEventUpdatesContent(html) {
    try {
        // Look for common event sections that contain gameplay changes
        const patterns = [
            /<h2[^>]*>[^<]*GAMEPLAY[^<]*<\/h2>(.*?)(?=<h2|$)/is,
            /<h2[^>]*>[^<]*UPDATES[^<]*<\/h2>(.*?)(?=<h2|$)/is,
            /<h2[^>]*>[^<]*CHANGES[^<]*<\/h2>(.*?)(?=<h2|$)/is,
            /<h3[^>]*>[^<]*ARENA[^<]*<\/h3>(.*?)(?=<h3|<h2|$)/is,
            /<h3[^>]*>[^<]*MODE[^<]*<\/h3>(.*?)(?=<h3|<h2|$)/is
        ];
        
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match) {
                const content = cleanAndFormatContent(match[1]);
                if (content.length > 50) {
                    return content;
                }
            }
        }
        
        return '';
    } catch (error) {
        console.error('Error extracting event updates content:', error);
        return '';
    }
}

/**
 * Extract general content (fallback)
 * @param {string} html - HTML content
 * @returns {string} Extracted general content
 */
function extractGeneralContent(html) {
    try {
        // Get first few paragraphs after title
        const paragraphs = html.match(/<p[^>]*>(.*?)<\/p>/gs);
        if (paragraphs && paragraphs.length > 0) {
            return paragraphs.slice(0, 4)
                .map(p => cleanTextContent(p))
                .filter(text => text.length > 20) // Filter out short/empty paragraphs
                .join('\n\n');
        }
        return 'Click the link above to view the full patch notes.';
    } catch (error) {
        console.error('Error extracting general content:', error);
        return 'Click the link above to view the full patch notes.';
    }
}

/**
 * Clean HTML text content and remove unwanted elements
 * @param {string} html - HTML string to clean
 * @returns {string} Cleaned text
 */
function cleanTextContent(html) {
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
        .replace(/<[^>]+>/g, ' ') // Remove HTML tags
        .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Remove HTML entities
        .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
}

/**
 * Check if content is a game update (broader than just patch notes)
 * @param {string} title - Title of the article
 * @param {string} content - Content or path of the article
 * @returns {boolean} True if it's a game update
 */
function isGameUpdate(title, content) {
    const updateKeywords = [
        'patch notes',
        'update',
        'hotfix',
        'balance changes',
        'bug fixes',
        'season',
        'legend',
        'weapon changes',
        'map update',
        'event', // Include events as they often contain balance changes
        'takeover',
        'prodigy',
        'future icons',
        'fight force',
        'beast mode',
        'astral anomaly',
        'from the rift'
    ];

    const titleLower = title.toLowerCase();
    const contentLower = content.toLowerCase();

    return updateKeywords.some(keyword =>
        titleLower.includes(keyword) || contentLower.includes(keyword)
    );
}

/**
 * Check if content is a patch note or game update
 * @param {string} title - Title of the article
 * @param {string} content - Content of the article
 * @returns {boolean} True if it's a patch note
 */
function isPatchNote(title, content) {
    // Use the broader isGameUpdate function for backwards compatibility
    return isGameUpdate(title, content);
}

/**
 * Extract tags from title and content
 * @param {string} title - Title of the article
 * @param {string} content - Content of the article
 * @returns {Array} Array of tags
 */
function extractTags(title, content) {
    const tags = ['apex-legends'];
    const text = (title + ' ' + content).toLowerCase();

    const tagMap = {
        'patch notes': 'patch-notes',
        'hotfix': 'hotfix',
        'season': 'season',
        'legend': 'legend',
        'weapon': 'weapon',
        'map': 'map',
        'balance': 'balance',
        'bug fix': 'bug-fix',
        'event': 'event'
    };

    Object.entries(tagMap).forEach(([keyword, tag]) => {
        if (text.includes(keyword)) {
            tags.push(tag);
        }
    });

    return tags;
}

/**
 * Generate a unique ID for a patch note
 * @param {string} title - Title of the patch note
 * @param {Date} date - Date of the patch note
 * @returns {string} Unique ID
 */
function generateId(title, date) {
    const titleHash = title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const dateStr = date.toISOString().split('T')[0];
    return `apex-${dateStr}-${titleHash.substring(0, 10)}`;
}



/**
 * Get cached patch notes or fetch new ones
 * @param {boolean} forceRefresh - Force refresh cache
 * @returns {Promise<Array>} Array of patch note objects
 */
async function getCachedPatchNotes(forceRefresh = false) {
    const now = Date.now();

    if (!forceRefresh && patchNotesCache.data && (now - patchNotesCache.timestamp) < CACHE_DURATION) {
        return patchNotesCache.data;
    }

    try {
        const freshData = await fetchPatchNotesFromEA();
        patchNotesCache = {
            data: freshData,
            timestamp: now
        };
        return freshData;
    } catch (error) {
        // If fetch fails but we have cached data, return it
        if (patchNotesCache.data) {
            console.warn('Using cached Apex data due to fetch error:', error.message);
            return patchNotesCache.data;
        }
        // If no cached data, return empty array instead of throwing
        console.error('Failed to fetch Apex patch notes and no cache available:', error.message);
        return [];
    }
}

/**
 * Filter patch notes based on provided criteria
 * @param {Array} patchNotes - Array of patch note objects
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered patch notes
 */
function filterPatchNotes(patchNotes, filters) {
    let filtered = [...patchNotes];

    // Filter by keyword
    if (filters.keyword) {
        const keyword = filters.keyword.toLowerCase();
        filtered = filtered.filter(note =>
            note.title.toLowerCase().includes(keyword) ||
            note.content.toLowerCase().includes(keyword) ||
            note.tags.some(tag => tag.includes(keyword))
        );
    }

    // Filter by days ago
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

    // Limit count
    if (filters.count) {
        filtered = filtered.slice(0, filters.count);
    }

    return filtered;
}

/**
 * Format content for Discord display
 * @param {string} content - Raw content
 * @returns {string} Formatted content
 */
function formatContent(content) {
    if (!content) return '';

    return content
        .replace(/\*\*(.*?)\*\*/g, '**$1**') // Preserve bold
        .replace(/\*(.*?)\*/g, '*$1*') // Preserve italic
        .replace(/```(.*?)```/gs, '```$1```') // Preserve code blocks
        .replace(/`(.*?)`/g, '`$1`') // Preserve inline code
        .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
        .trim();
}

/**
 * Clear the patch notes cache (for testing)
 */
function clearCache() {
    patchNotesCache = {
        data: null,
        timestamp: 0
    };
}

export {
    getCachedPatchNotes,
    filterPatchNotes,
    formatContent,
    fetchPatchNotesFromEA,
    isPatchNote,
    extractArticleLinks,
    fetchArticleContent,
    cleanTextContent as cleanEAContent, // Alias for backwards compatibility
    clearCache // Export for testing
};

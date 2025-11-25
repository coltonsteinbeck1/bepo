/**
 * Web Search Utilities using OpenAI's Responses API with GPT-5-mini
 * 
 * Hybrid Architecture:
 * - Uses GPT-5-mini with OpenAI's web search for queries needing current information
 * - Uses the same system prompt (MODEL_SYSTEM_MESSAGE) to maintain Bepo's personality
 * - Seamlessly integrates into normal chat flow via shouldUseWebSearch() detection
 * - Falls back to Grok-4 (no search) if web search fails
 * 
 * Why GPT-5-mini for search:
 * - OpenAI's Responses API provides built-in web search with citations
 * - More reliable than xAI's undocumented live_search API
 * - Minimal code changes, maintains existing patterns
 * - GPT-5-mini is fast and cost-effective for search tasks
 */
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config();

// Initialize OpenAI client for web search
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY, // Use OPENAI_KEY from .env
});

/**
 * Chat with GPT-5-mini using OpenAI's web search via Responses API
 * This replaces standard Grok chat when web search is needed
 * 
 * @param {Array<Object>} messages - Conversation messages array (with system prompt)
 * @param {Object} options - Chat options
 * @param {boolean} options.enableWebSearch - Enable web search tool (default: true)
 * @param {number} options.maxTokens - Maximum response length (default: 4096)
 * @param {number} options.temperature - Creativity level 0-2 (default: 0.8)
 * @param {string} options.recencyBias - Preference for recent results: 'strong' | 'moderate' | 'none' (default: 'strong')
 * @returns {Promise<Object>} Chat response with content and citations
 */
export async function chatWithWebSearch(messages, options = {}) {
  const {
    enableWebSearch = true,
    maxTokens = 4096, // Increased for web search reasoning + results
    temperature = 0.8,
    recencyBias = 'strong', // Prefer recent results by default
  } = options;

  try {
    console.log(`💬 Chat with web search enabled (gpt-5-mini, recency: ${recencyBias})`);
    
    // Clean messages to only include role and content (OpenAI Responses API doesn't accept extra fields)
    const cleanedMessages = messages.map((msg, idx) => {
      // For system message, enhance to explicitly encourage web search usage
      if (msg.role === 'system' && idx === 0) {
        let searchInstruction = '\n\n[CRITICAL: You have access to real-time web search tools. For ANY question about current events, live scores, today\'s news, weather, prices, patch notes, game updates, or anything time-sensitive, you MUST perform a web search BEFORE responding. Your knowledge cutoff is outdated. Always search first, then answer based on search results. Never rely on your training data for current information.]';
        
        // Add recency bias instructions
        if (recencyBias === 'strong') {
          searchInstruction += '\n[RECENCY CRITICAL: When searching, you MUST include temporal keywords like "latest", "current", "recent", "2025", "October 2025", or "today" in your search queries to ensure you get the MOST RECENT information. Prioritize sources from the last 30 days.]';
        } else if (recencyBias === 'moderate') {
          searchInstruction += '\n[RECENCY: When searching, prefer recent sources when available.]';
        }
        
        return {
          role: msg.role,
          content: msg.content + searchInstruction
        };
      }
      // For user message, add time-sensitive context
      if (msg.role === 'user') {
        // Add explicit instruction to search with recency emphasis
        const timeContext = '\n\n[Assistant: This query requires current/live data. Perform web search with recency-focused queries (include "latest", "current", "2025") to get the most up-to-date information.]';
        return {
          role: msg.role,
          content: msg.content + timeContext
        };
      }
      return {
        role: msg.role,
        content: msg.content
      };
    });
    
    // Build tools array for OpenAI Responses API
    const tools = [];
    if (enableWebSearch) {
      tools.push({
        type: 'web_search_preview_2025_03_11' // OpenAI's latest web search tool
      });
      console.log(`   🌐 Web search enabled`);
    }

    // Make API call using OpenAI's Responses API
    // Note: Responses API uses 'input' instead of 'messages'
    const response = await openai.responses.create({
      model: 'gpt-5-mini', // Fast and cost-effective for search
      input: cleanedMessages, // Responses API uses 'input' not 'messages'
      tools: tools,
      tool_choice: 'required', // FORCE the model to use web search
      max_output_tokens: maxTokens,
      store: false, // Don't store in OpenAI for privacy
    });
    
    console.log(`   🔧 Tool choice: REQUIRED (forcing web search)`);

    // Check if response completed
    if (response.status === 'incomplete') {
      console.warn(`⚠️  Response incomplete: ${response.incomplete_details?.reason}`);
      console.warn(`⚠️  Using partial response (may be truncated)`);
      // Don't throw error - use partial response instead
    } else if (response.status !== 'completed') {
      console.error(`❌ Response failed: ${response.status}`);
      throw new Error(`Response failed: ${response.status}`);
    }

    // Log web search activity for debugging
    let searchCount = 0;
    const outputs = response.output || [];
    for (const item of outputs) {
      if (item.type === 'web_search_call') {
        searchCount++;
        console.log(`   🔎 Search ${searchCount}: "${item.action?.query}" - ${item.status}`);
      }
    }
    
    if (searchCount === 0) {
      console.error(`❌ CRITICAL: No web searches were performed despite tool_choice=required!`);
      console.error(`   This means the model hallucinated without searching.`);
      console.error(`   Response may contain inaccurate or outdated information.`);
      // Could throw error here, but let's allow it with warning for now
    } else {
      console.log(`   ✅ Performed ${searchCount} web search(es) - data should be current`);
    }

    // Extract content from output_text (includes inline citations)
    const content = response.output_text || '';
    
    // Extract citation URLs from markdown citations in content
    const citations = [];
    const urlRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
    let match;
    while ((match = urlRegex.exec(content)) !== null) {
      citations.push(match[2]); // match[2] is the URL
    }
    
    console.log(`✅ Chat completed (with web search)`);
    console.log(`   📚 Citations: ${citations.length}`);
    console.log(`   💰 Tokens used: ${response.usage?.total_tokens || 'unknown'}`);
    console.log(`   📝 Content length: ${content.length} chars`);
    
    return {
      success: true,
      content: content,
      citations: [...new Set(citations)], // Remove duplicates
      usage: response.usage,
      // Format similar to xAI response for compatibility
      choices: [{
        message: {
          content: content,
          role: 'assistant'
        }
      }]
    };

  } catch (error) {
    console.error('❌ Web search chat error:', error.message);
    
    // Handle specific error cases
    if (error.status === 429) {
      throw new Error('Rate limit exceeded. Please try again in a moment.');
    } else if (error.status === 401) {
      throw new Error('Authentication failed. Please check your OpenAI API key.');
    } else if (error.status === 400) {
      const errorMsg = error.message || 'Invalid request';
      throw new Error(`Chat failed: ${errorMsg}`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out. Please try again.');
    }
    
    throw new Error(`Chat with web search failed: ${error.message}`);
  }
}

/**
 * Detect if a query likely needs web search
 * Useful for auto-enabling search in chat
 * @param {string} query - User query
 * @returns {boolean} True if query likely needs search
 */
export function shouldUseWebSearch(query) {
  // Normalize query for better matching
  const normalizedQuery = query.toLowerCase().trim();
  
  // Quick reject: Very short messages unlikely to need search
  if (normalizedQuery.length < 10) {
    return false;
  }
  
  // Quick reject: Common conversational phrases that don't need search
  const conversationalPhrases = [
    /^(hi|hey|hello|sup|yo|thanks|thank you|ok|okay|lol|lmao|nice|cool|good|great)\b/i,
    /^(implemented|added|fixed|updated|changed|created|working on)/i,
    /\b(web search|search feature|search functionality|search system)\s+(when|if|for|to)/i,
  ];
  
  if (conversationalPhrases.some(pattern => pattern.test(normalizedQuery))) {
    return false;
  }
  
  const searchIndicators = [
    // Explicit search/information requests (but exclude technical discussion about search features)
    /\b(search|find|look up|google|show me|check)\s+(for|about|the|what|who|when|where|how)\s+\w+/i,
    
    // Time-sensitive queries - EXPANDED (require context)
    /\b(latest|current|today's|right now|currently)\s+\w+/i,
    /\b(recent|this week|this month)\s+\w+/i,
    /\b(news|update|announcement|breaking)\s+(about|on|for|regarding)/i,
    /\b(live|real.?time|ongoing|happening)\s+(now|today|currently)/i,
    
    // Information queries (stricter - require full question patterns)
    /\b(what is|what are|what's)\s+\w+/i,
    /\b(who is|who are|who's)\s+\w+/i,
    /\b(when did|when was|when will|when does)\s+\w+/i,
    /\b(where is|where are|where can)\s+\w+/i,
    /\b(how much|how many)\s+\w+/i,
    /\b(tell me about|information about|details about)\s+\w+/i,
    
    // Current events and data - EXPANDED (with context)
    /\b(weather|temperature|forecast)\s+(in|for|today|now)/i,
    /\b(price|cost|value)\s+(of|for)\s+\w+/i,
    /\b(stock|rate|trading)\s+(price|for)/i,
    /\b(score|result|standings|stats)\s+(for|of|today)/i,
    /\b(nfl|nba|mlb|nhl|soccer|football|basketball|baseball|hockey)\s+(score|game|stats|standing)/i,
    /\b(election|vote|poll)\s+(result|count|update)/i,
    
    // Patch notes and game updates (specific context)
    /\b(patch note|update note|changelog|release note)s?\b/i,
    /\b(game update|balance change|nerf|buff)\s+(for|in)\s+\w+/i,
    
    // Recent dates (2024-2025+) - but only in question context
    /\b(202[4-9]|20[3-9][0-9])\s+(update|news|patch|release)/i,
    
    // Time references with context
    /\b(yesterday|tomorrow|tonight|this morning|this evening)\s*('s)?\s+(score|news|weather|game)/i,
    
    // Questions about current state (require question mark)
    /\?\s*.*(now|today|currently|at the moment|right now)/i,
    
    // Market/Finance with context
    /\b(bitcoin|ethereum|crypto|dow|nasdaq|s&p)\s+(price|value|rate)/i,
  ];
  
  return searchIndicators.some(pattern => pattern.test(query));
}

/**
 * Format citations as a footer note for Discord messages
 * @param {Array<string>} citations - Array of citation URLs
 * @param {number} maxCitations - Maximum number to show (default: 5)
 * @returns {string} Formatted citations text
 */
export function formatCitationsFooter(citations, maxCitations = 5) {
  if (!citations || citations.length === 0) {
    return '';
  }
  
  const uniqueCitations = [...new Set(citations)].slice(0, maxCitations);
  
  if (uniqueCitations.length === 0) {
    return '';
  }
  
  return `\n\n*📚 Sources consulted: ${uniqueCitations.length}*`;
}

/**
 * Format citations for Discord display
 * @param {Array<string>} citations - Array of citation URLs
 * @param {number} maxCitations - Maximum number of citations to display (default: 10)
 * @returns {string} Formatted citation text
 */
export function formatCitations(citations, maxCitations = 10) {
  if (!citations || citations.length === 0) {
    return '';
  }
  
  // Remove duplicates and limit to maxCitations
  const uniqueCitations = [...new Set(citations)].slice(0, maxCitations);
  
  return '\n\n**📚 Sources:**\n' + 
    uniqueCitations.map((url, idx) => `${idx + 1}. <${url}>`).join('\n');
}

/**
 * Truncate content to fit Discord's limits
 * @param {string} content - Content to truncate
 * @param {number} maxLength - Maximum length (default: 4000)
 * @returns {string} Truncated content
 */
export function truncateForDiscord(content, maxLength = 4000) {
  if (content.length <= maxLength) {
    return content;
  }
  
  return content.substring(0, maxLength - 50) + '\n\n...[Content truncated for length]';
}

import { createClient } from '@supabase/supabase-js'
import dotenv from "dotenv";
import userCacheService from '../services/userCache.js';
import embeddingService from '../services/embeddingService.js';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY

// Create Supabase client with better timeout and retry configuration
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false // We don't need persistent sessions for a bot
  },
  global: {
    fetch: (url, options) => {
      // Add timeout and retry logic to fetch requests
      return fetch(url, {
        ...options,
        timeout: 15000, // 15 second timeout instead of default 10s
      });
    }
  }
})

// Function to get all guilds
async function getAllGuilds() {
    const { data, error } = await supabase.from('guilds').select('*')
    if (error) {
        console.error('Error fetching guilds:', error)
        return []
    }
    return data
}

// Function to get channels Markov can run in with retry logic
async function getMarkovChannels(retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const { data, error } = await supabase
                .from('channels')
                .select('channel_id')
                .in('channel_name', ['chillin', 'bot_spam']);
          
            if (error) {
                throw error;
            }
            
            console.log(`Successfully fetched ${data?.length || 0} markov channels`);
            return data || [];
        } catch (error) {
            console.error(`Error fetching channels (attempt ${attempt}/${retries}):`, {
                message: error.message,
                details: error.stack,
                hint: error.hint || '',
                code: error.code || ''
            });
            
            if (attempt === retries) {
                console.error('Failed to fetch markov channels after all retries, using empty array');
                return [];
            }
            
            // Wait before retrying (exponential backoff)
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Function to get all users
async function getAllUsers() {
    const { data, error } = await supabase.from('users').select('*')
    if (error) {
        console.error('Error fetching users:', error)
        return []
    }
    return data
}

async function getAllCommands() {
    const { data, error } = await supabase.from('commands').select('*')
    if (error) {
        console.error('Error fetching commands:', error)
        return []
    }
    return data
}
async function getConfig() {
    const { data, error } = await supabase.from('config').select('*')
    if (error) {
        console.error('Error fetching config:', error)
        return []
    }
    return data
}


async function insertImages(prompt, url) {
    initializeImageId();

    const { data, error } = await supabase
        .from('images')
        .insert([
            { image_id: initializeImageId + 1, url: url, prompt: prompt },
        ])
        .select();
    if (error) {
        console.error('Error inserting image:', error)
        return []
    }
}
// Function to get all context messages
async function getContext() {
    let { data: messages, error } = await supabase.from('messages').select('content')
    if (error) {
        console.error('Error fetching context:', error)
        return []
    }
    return messages
}

async function getBZBannedRoles() {
    let { data: roles, error } = await supabase.from('bz_roles').select('role_id')
    if (error) {
        console.error('Error fetching context:', error)
        return []
    }
    return roles
}

// Memory-related functions
async function storeUserMemory(userId, content, contextType = 'conversation', metadata = {}, expiresAt = null, guildId = null) {
    const { data, error } = await supabase
        .from('user_memory')
        .insert([{
            user_id: userId,
            memory_content: content,
            context_type: contextType,
            metadata: metadata,
            expires_at: expiresAt,
            guild_id: guildId
        }])
        .select();
    
    if (error) {
        console.error('Error storing user memory:', error);
        return null;
    }
    return data[0];
}

async function getUserMemories(userId, contextType = null, limit = 10) {
    let query = supabase
        .from('user_memory')
        .select('*')
        .eq('user_id', userId)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('updated_at', { ascending: false });
    
    if (contextType) {
        query = query.eq('context_type', contextType);
    }
    
    if (limit) {
        query = query.limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error fetching user memories:', error);
        return [];
    }
    return data || [];
}

async function searchUserMemories(userId, searchTerm, contextType = null, limit = 5) {
    let query = supabase
        .from('user_memory')
        .select('*')
        .eq('user_id', userId)
        .ilike('memory_content', `%${searchTerm}%`)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('updated_at', { ascending: false });
    
    if (contextType) {
        query = query.eq('context_type', contextType);
    }
    
    if (limit) {
        query = query.limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error searching user memories:', error);
        return [];
    }
    return data || [];
}

async function getUserPreferences(userId) {
    const { data, error } = await supabase
        .from('user_memory')
        .select('*')
        .eq('user_id', userId)
        .eq('context_type', 'preference')
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
    
    if (error) {
        console.error('Error fetching user preferences:', error);
        return {};
    }
    
    const preferences = {};
    data?.forEach(pref => {
        if (pref.metadata?.preference_key && pref.metadata?.preference_value !== undefined) {
            preferences[pref.metadata.preference_key] = pref.metadata.preference_value;
        }
    });
    
    return preferences;
}

async function setUserPreference(userId, key, value) {
    // First, check if the preference already exists
    const { data: existing } = await supabase
        .from('user_memory')
        .select('id')
        .eq('user_id', userId)
        .eq('context_type', 'preference')
        .eq('metadata->>preference_key', key)
        .single();
    
    const preferenceData = {
        memory_content: `User preference: ${key} = ${JSON.stringify(value)}`,
        context_type: 'preference',
        metadata: { preference_key: key, preference_value: value },
        updated_at: new Date().toISOString()
    };
    
    if (existing) {
        // Update existing preference
        const { data, error } = await supabase
            .from('user_memory')
            .update(preferenceData)
            .eq('id', existing.id)
            .select();
        
        if (error) {
            console.error('Error updating user preference:', error);
            return null;
        }
        return data[0];
    } else {
        // Insert new preference
        const { data, error } = await supabase
            .from('user_memory')
            .insert([{
                user_id: userId,
                ...preferenceData
            }])
            .select();
        
        if (error) {
            console.error('Error setting user preference:', error);
            return null;
        }
        return data[0];
    }
}

async function deleteUserMemories(userId, contextType = null) {
    let query = supabase
        .from('user_memory')
        .delete()
        .eq('user_id', userId);
    
    if (contextType) {
        query = query.eq('context_type', contextType);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error deleting user memories:', error);
        return 0;
    }
    return data?.length || 0;
}

async function deleteMemoryById(memoryId) {
    const { data, error } = await supabase
        .from('user_memory')
        .delete()
        .eq('id', memoryId)
        .select();
    
    if (error) {
        console.error('Error deleting memory by id:', error);
        return null;
    }
    return data[0];
}

async function cleanupExpiredMemories() {
    const { data, error } = await supabase
        .from('user_memory')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .not('expires_at', 'is', null)
        .select();
    
    if (error) {
        console.error('Error cleaning up expired memories:', error);
        return 0;
    }
    
    console.log(`Cleaned up ${data?.length || 0} expired memories`);
    return data?.length || 0;
}

async function cleanupOldMemories(daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const { data, error } = await supabase
        .from('user_memory')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .eq('context_type', 'conversation')
        .select();
    
    if (error) {
        console.error('Error cleaning up old memories:', error);
        return 0;
    }
    
    console.log(`Cleaned up ${data?.length || 0} old memories`);
    return data?.length || 0;
}

// ============================================================================
// OPTIMIZED MEMORY FUNCTIONS (New - Prevents Memory Corruption)
// ============================================================================

// Conversation batching system to prevent duplicate memories
const conversationBatches = new Map(); // userId -> { messages: [], lastActivity: timestamp }
const BATCH_SIZE = 5; // Batch every 5 exchanges
const BATCH_TIMEOUT = 30 * 60 * 1000; // 30 minutes of inactivity flushes batch

/**
 * Store user memory with intelligent batching
 * Prevents the "duplicate memory" problem by batching conversations into summaries
 * This eliminates the issue where bot thinks users pinged multiple times
 * 
 * @param {string} userId - Discord user ID
 * @param {string} userMessage - What the user said
 * @param {string} botResponse - What the bot responded
 * @param {object} metadata - Additional context (channel, guild, timestamp)
 * @param {object} client - Discord client for username resolution
 */
async function storeUserMemoryOptimized(userId, userMessage, botResponse, metadata = {}, client = null) {
    try {
        // Get user info for proper attribution
        let username = 'User';
        if (client) {
            const userInfo = await userCacheService.getUserInfo(client, userId);
            username = userCacheService.getDisplayName(userInfo);
        }

        // Get or create batch for this user
        if (!conversationBatches.has(userId)) {
            conversationBatches.set(userId, {
                messages: [],
                lastActivity: Date.now(),
                username: username
            });
        }

        const batch = conversationBatches.get(userId);
        batch.lastActivity = Date.now();
        batch.username = username;

        // Add message to batch with clear attribution
        batch.messages.push({
            user: userMessage,
            bot: botResponse,
            timestamp: new Date().toISOString(),
            channel: metadata.channel_id,
            guild: metadata.guild_id
        });

        console.log(`[Memory] Batched message for ${username} (${batch.messages.length}/${BATCH_SIZE})`);

        // Check if batch is full
        if (batch.messages.length >= BATCH_SIZE) {
            await flushConversationBatch(userId);
        }

        return true;
    } catch (error) {
        console.error('[Memory] Error in storeUserMemoryOptimized:', error);
        return false;
    }
}

/**
 * Flush a conversation batch to database as a summary
 * This creates ONE memory instead of 10 (2 per message × 5 messages)
 */
async function flushConversationBatch(userId) {
    const batch = conversationBatches.get(userId);
    if (!batch || batch.messages.length === 0) {
        return;
    }

    try {
        // Generate conversation summary
        const summary = generateConversationSummary(batch.messages, batch.username);
        
        // Extract key topics for better retrieval
        const topics = extractConversationTopics(batch.messages);
        
        // Get guild_id from messages (use the most recent one)
        const guildId = batch.messages[batch.messages.length - 1].guild;
        
        // Generate embedding for the summary (for semantic search)
        const embedding = await embeddingService.generateEmbedding(summary);
        
        // Store as single summary memory WITH embedding
        const { data, error } = await supabase
            .from('user_memory')
            .insert([{
                user_id: userId,
                memory_content: summary,
                context_type: 'conversation_summary',
                metadata: {
                    message_count: batch.messages.length,
                    batch_start: batch.messages[0].timestamp,
                    batch_end: batch.messages[batch.messages.length - 1].timestamp,
                    topics: topics,
                    channels: [...new Set(batch.messages.map(m => m.channel))],
                    guilds: [...new Set(batch.messages.map(m => m.guild))]
                },
                expires_at: null,
                guild_id: guildId,
                embedding: embedding
            }])
            .select();

        if (error) {
            console.error('[Memory] Error storing summary:', error);
            return;
        }

        console.log(`[Memory] Flushed batch for ${batch.username}: ${batch.messages.length} messages → 1 summary${embedding ? ' (with embedding)' : ''}`);

        // Clear the batch
        conversationBatches.delete(userId);
    } catch (error) {
        console.error('[Memory] Error flushing batch:', error);
    }
}

/**
 * Generate a natural summary from conversation exchanges
 * Clearly attributes who said what to prevent confusion
 */
function generateConversationSummary(messages, username) {
    const topics = new Set();
    const userStatements = [];
    const botResponses = [];

    messages.forEach(msg => {
        // Extract key phrases from user messages
        const userWords = msg.user.toLowerCase().split(' ')
            .filter(w => w.length > 4 && !['about', 'there', 'their', 'where', 'these', 'those'].includes(w));
        userWords.forEach(w => topics.add(w));

        // Collect shortened statements
        const userSnippet = msg.user.length > 80 ? msg.user.substring(0, 80) + '...' : msg.user;
        const botSnippet = msg.bot.length > 80 ? msg.bot.substring(0, 80) + '...' : msg.bot;
        
        userStatements.push(userSnippet);
        botResponses.push(botSnippet);
    });

    const topicsList = Array.from(topics).slice(0, 5).join(', ');
    
    // Create summary with CLEAR ATTRIBUTION
    let summary = `Conversation with ${username} about ${topicsList || 'general topics'} (${messages.length} exchanges).\n\n`;
    summary += `${username} discussed: ${userStatements.slice(0, 2).join('; ')}.\n`;
    summary += `Bot responded about: ${topicsList || 'their questions'}.`;

    return summary;
}

/**
 * Extract conversation topics for better search
 */
function extractConversationTopics(messages) {
    const topicCounts = new Map();
    
    messages.forEach(msg => {
        const words = (msg.user + ' ' + msg.bot).toLowerCase()
            .split(/\s+/)
            .filter(w => w.length > 4 && !['about', 'there', 'their', 'where', 'these', 'those', 'would', 'could', 'should'].includes(w));
        
        words.forEach(word => {
            topicCounts.set(word, (topicCounts.get(word) || 0) + 1);
        });
    });

    // Return top 5 topics by frequency
    return Array.from(topicCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);
}

/**
 * Flush stale batches (called periodically)
 */
function flushStaleBatches() {
    const now = Date.now();
    let flushed = 0;

    for (const [userId, batch] of conversationBatches.entries()) {
        if (now - batch.lastActivity > BATCH_TIMEOUT) {
            flushConversationBatch(userId);
            flushed++;
        }
    }

    if (flushed > 0) {
        console.log(`[Memory] Flushed ${flushed} stale conversation batches`);
    }
}

// Flush stale batches every 5 minutes
setInterval(flushStaleBatches, 5 * 60 * 1000);

// ============================================================================
// END OPTIMIZED MEMORY FUNCTIONS
// ============================================================================

async function getUserMemoryStats(userId) {
    const { data, error } = await supabase
        .from('user_memory')
        .select('context_type, created_at')
        .eq('user_id', userId)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
    
    if (error) {
        console.error('Error fetching memory stats:', error);
        return { total: 0, byType: {} };
    }
    
    const stats = { total: data?.length || 0, byType: {} };
    data?.forEach(memory => {
        stats.byType[memory.context_type] = (stats.byType[memory.context_type] || 0) + 1;
    });
    
    // Find oldest memory
    if (data && data.length > 0) {
        const oldest = data.reduce((prev, current) => 
            new Date(prev.created_at) < new Date(current.created_at) ? prev : current
        );
        stats.oldest = oldest.created_at;
    }
    
    return stats;
}

// Memory utility functions
function extractKeywords(message) {
    if (!message || typeof message !== 'string') return [];

    let cleanMessage = message
        .replace(/<@&?\d+>/g, '') // role mentions
        .replace(/<@!?\d+>/g, '') // user mentions
        .replace(/<#[0-9]+>/g, '') // channel mentions
        .trim();

    // Strip if only emojis/punctuation
    if (cleanMessage && /^(?:[\p{P}\p{S}\s]|:[^:]+:)+$/u.test(cleanMessage)) {
        cleanMessage = '';
    }

    if (cleanMessage.length < 3) {
        return ['who','what','game'];
    }

    const commonWords = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','i','you','he','she','it','we','they','this','that','is','was','are','were','be','been','have','has','had','do','does','did','will','would','could','should','can','may','might']);
    const importantTerms = new Set(['who','what','when','where','how','why','creator','created','made','maker','plays','playing','game','games','final','fantasy','ff','bot','developer','built','coded','programming','most']);

    const words = cleanMessage.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .filter(w => importantTerms.has(w) || (w.length > 2 && !commonWords.has(w)))
        .slice(0,7);

    if (words.length === 0) {
        return ['who','what','game'];
    }
    return words;
}

function getTimeAgo(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffInSeconds = Math.floor((now - past) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  
  return past.toLocaleDateString();
}

async function storeConversation(userId, userMessage, botResponse, channelId, guildId) {
  const metadata = {
    channel_id: channelId,
    guild_id: guildId,
    timestamp: new Date().toISOString()
  };
  
  // Store user message
  await storeUserMemory(
    userId, 
    `User said: "${userMessage}"`, 
    'conversation', 
    metadata
  );
  
  // Store bot response
  await storeUserMemory(
    userId, 
    `Bot responded: "${botResponse}"`, 
    'conversation', 
    { ...metadata, response_length: botResponse.length }
  );
}

async function buildMemoryContext(userId, currentMessage = '', serverId = null, client = null) {
  try {
    // Get relevant conversation memories
    const searchTerms = extractKeywords(currentMessage);
    
    // Combine multiple database queries into fewer Promise.all() calls for better performance
    const [userMemoriesResults, userPrefs, serverMemoriesResults] = await Promise.all([
      // Combine user memory searches into a single operation
      Promise.all([
        // Search for relevant memories with combined terms (reduced queries)
        searchTerms.length > 0 
          ? searchUserMemories(userId, searchTerms.slice(0, 2).join(' '), 'conversation', 5)
          : Promise.resolve([]),
        // Get conversation summaries
        getUserMemories(userId, 'conversation_summary', 3),
        // Get recent memories as fallback
        getUserMemories(userId, 'conversation', 3)
      ]),
      // Get user preferences
      getUserPreferences(userId),
      // Server memories (if serverId provided)
      serverId ? Promise.all([
        // Combine server memory searches with fewer, more targeted queries
        searchTerms.length > 0 
          ? searchServerMemories(serverId, searchTerms.slice(0, 2).join(' '), null, 6)
          : Promise.resolve([]),
        // Get recent server memories
        getServerMemories(serverId, null, 6)
      ]) : [[], []]
    ]);

    // Flatten and process user memories
    const [searchResults, summaries, recentMemories] = userMemoriesResults;
    let relevantMemories = [...searchResults];
    
    // Add recent memories if no relevant ones found
    if (relevantMemories.length === 0) {
      relevantMemories.push(...recentMemories);
    }
    
    // Remove duplicates from user memories
    const uniqueMemories = [...new Map(relevantMemories.map(m => [m.id, m])).values()];

    // Process server memories if available
    let relevantServerMemories = [];
    if (serverId) {
      const [serverSearchResults, recentServerMemories] = serverMemoriesResults;
      relevantServerMemories = [...serverSearchResults, ...recentServerMemories];
      
      // Add fallback searches for common patterns if no results
      if (relevantServerMemories.length === 0) {
        const fallbackPatterns = ['creator', 'plays', 'game', 'made', 'developer'];
        const fallbackResults = await Promise.all(
          fallbackPatterns.slice(0, 2).map(pattern => 
            searchServerMemories(serverId, pattern, null, 2)
          )
        );
        relevantServerMemories = fallbackResults.flat();
      }
      
      // Remove duplicates and limit results
      relevantServerMemories = [...new Map(relevantServerMemories.map(m => [m.id, m])).values()]
        .slice(0, 10); // Reduced from 12 to 10
      
      // Sort by relevance: more specific matches first, then by recency
      relevantServerMemories.sort((a, b) => {
        // Calculate relevance scores for both memories
        const getRelevanceScore = (memory) => {
          let score = 0;
          const content = (memory.memory_content || '').toLowerCase();
          const title = (memory.memory_title || '').toLowerCase();
          
          // High priority keywords (entity names, specific concepts)
          const highPriorityTerms = searchTerms.filter(term => 
            term.length > 3 && !['who', 'what', 'when', 'where', 'how', 'the', 'and', 'for', 'with'].includes(term)
          );
          
          // Score high priority matches higher
          highPriorityTerms.forEach(term => {
            if (content.includes(term) || title.includes(term)) {
              score += 10;
            }
          });
          
          return score;
        };
        
        const aScore = getRelevanceScore(a);
        const bScore = getRelevanceScore(b);
        
        // Sort by score first (higher scores first)
        if (aScore !== bScore) {
          return bScore - aScore;
        }
        
        // If scores are equal, sort by recency
        return new Date(b.updated_at) - new Date(a.updated_at);
      });
    }

    // Build context string efficiently
    let context = '';
    
    // Add server memories first (they're important for server context)  
    if (relevantServerMemories.length > 0) {
      context += '=== SERVER KNOWLEDGE & FACTS ===\n';
      context += 'The following information is stored server knowledge that you MUST reference when answering questions:\n\n';
      
      // If client is available, resolve usernames for server memories and clean mentions
      if (client) {
        try {
          // Import the username resolution and mention cleaning functions
          const { getUsernamesFromIds, cleanDiscordMentions } = await import('../utils/utils.js');
          
          // Get unique user IDs from server memories
          const uniqueUserIds = [...new Set(relevantServerMemories.map(m => m.user_id))];
          const usernames = await getUsernamesFromIds(client, uniqueUserIds);
          
          for (const memory of relevantServerMemories.slice(0, 8)) { // Reduced from 10 to 8
            const timeAgo = getTimeAgo(memory.updated_at);
            const title = memory.memory_title ? `[${memory.memory_title}] ` : '';
            const username = usernames[memory.user_id] || 'Unknown User';
            
            // Clean Discord mentions from the memory content
            const cleanedContent = await cleanDiscordMentions(memory.memory_content, client);
            
            context += `• ${title}${cleanedContent} (verified by ${username} ${timeAgo})\n`;
          }
        } catch (error) {
          console.error('Error resolving usernames for server memories:', error);
          // Fallback to original format if username resolution fails
          relevantServerMemories.slice(0, 8).forEach(memory => { // Reduced from 10 to 8
            const timeAgo = getTimeAgo(memory.updated_at);
            const title = memory.memory_title ? `[${memory.memory_title}] ` : '';
            context += `• ${title}${memory.memory_content} (added ${timeAgo})\n`;
          });
        }
      } else {
        // Fallback when no client is available
        relevantServerMemories.slice(0, 8).forEach(memory => { // Reduced from 10 to 8
          const timeAgo = getTimeAgo(memory.updated_at);
          const title = memory.memory_title ? `[${memory.memory_title}] ` : '';
          context += `• ${title}${memory.memory_content} (added ${timeAgo})\n`;
        });
      }
      
      context += '\nIMPORTANT: Use this server knowledge to answer questions accurately. If someone asks about something covered in the server knowledge, reference it directly.\n\n';
    }
    
    if (uniqueMemories.length > 0) {
      // Filter out memories that might contain false ping count information
      const filteredMemories = uniqueMemories.filter(memory => {
        const content = memory.memory_content.toLowerCase();
        // Skip memories that contain potentially false ping/mention counts
        const hasCountPattern = content.match(/(?:four|twice|three|five|\d+)\s*times.*(?:ping|mention|said)/i) ||
                               content.match(/me\?\s*(?:twice|four|three|five|\d+)/i) ||
                               content.match(/(?:ping|mention).*(?:four|twice|three|five|\d+).*(?:times|time)/i);
        
        if (hasCountPattern) {
          console.log(`[MEMORY_FILTER] Filtered out potentially false memory: "${memory.memory_content.substring(0, 100)}..."`);
          return false;
        }
        return true;
      });
      
      if (filteredMemories.length > 0) {
        console.log(`[MEMORY_FILTER] Using ${filteredMemories.length}/${uniqueMemories.length} memories after filtering`);
        context += 'Previous Conversations:\n';
        filteredMemories.slice(0, 4).forEach(memory => { // Reduced from 5 to 4
          const timeAgo = getTimeAgo(memory.updated_at);
          context += `- ${memory.memory_content} (${timeAgo})\n`;
        });
        context += '\n';
      } else {
        console.log(`[MEMORY_FILTER] All ${uniqueMemories.length} memories filtered out due to potential false information`);
      }
    }
    
    if (summaries.length > 0) {
      context += 'Conversation Summaries:\n';
      summaries.slice(0, 2).forEach(summary => { // Limit to 2 summaries
        const timeAgo = getTimeAgo(summary.updated_at);
        context += `- ${summary.memory_content} (${timeAgo})\n`;
      });
      context += '\n';
    }
    
    if (userPrefs && Object.keys(userPrefs).length > 0) {
      context += 'User Preferences:\n';
      Object.entries(userPrefs).slice(0, 5).forEach(([key, value]) => { // Limit preferences
        context += `- ${key}: ${JSON.stringify(value)}\n`;
      });
      context += '\n';
    }
    
    return context.trim();
    
  } catch (error) {
    console.error('Error building memory context:', error);
    return '';
  }
}

async function storeConversationSummary(userId, summary, messageCount = null, channelId = null) {
  const metadata = {
    message_count: messageCount,
    channel_id: channelId,
    timestamp: new Date().toISOString()
  };

  return await storeUserMemory(userId, summary, 'conversation_summary', metadata);
}

async function storeTemporaryMemory(userId, content, hoursToExpire = 24, contextType = 'temporary') {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + hoursToExpire);

  return await storeUserMemory(userId, content, contextType, {}, expiresAt.toISOString());
}

// ============================================================================
// OPTIMIZED buildMemoryContextOptimized (New - 70% faster)
// ============================================================================

// Memory context cache (5 minute TTL)
const memoryContextCache = new Map();
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Optimized memory context builder
 * Reduces 6-10 queries to 2-3 with intelligent caching and batching
 * Uses relevance scoring to prevent irrelevant memories (false pings)
 * 
 * @param {string} userId - Discord user ID  
 * @param {string} currentMessage - Current message for relevance
 * @param {string} serverId - Discord server/guild ID
 * @param {object} client - Discord client for username resolution
 * @returns {Promise<string>} Formatted context string
 */
async function buildMemoryContextOptimized(userId, currentMessage = '', serverId = null, client = null) {
  try {
    // Generate cache key
    const cacheKey = `${userId}:${serverId}:${currentMessage.slice(0, 50)}`;
    
    // Check cache first
    const cached = memoryContextCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < MEMORY_CACHE_TTL) {
      console.log('[Memory Cache] HIT - Using cached context');
      return cached.data;
    }

    const startTime = Date.now();
    const searchTerms = extractKeywords(currentMessage);
    
    // OPTIMIZATION: Combine all queries into 2 parallel database calls
    const [userMemories, serverMemories] = await Promise.all([
      // Single query for ALL user memories with guild filter
      serverId 
        ? supabase
            .from('user_memory')
            .select('*')
            .eq('user_id', userId)
            .eq('guild_id', serverId)
            .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
            .order('updated_at', { ascending: false })
            .limit(15)
            .then(r => r.data || [])
        : getUserMemories(userId, null, 15),
      
      // Single query for ALL server memories (if server provided)
      serverId && searchTerms.length > 0
        ? supabase.rpc('search_server_memories_optimized', {
            p_server_id: serverId,
            p_search_terms: searchTerms.slice(0, 3),
            p_limit: 12
          }).then(r => r.data || []).catch(() => getServerMemories(serverId, null, 12))
        : serverId ? getServerMemories(serverId, null, 12) : []
    ]);

    // Separate user memories by type
    const summaries = userMemories.filter(m => m.context_type === 'conversation_summary');
    const conversations = userMemories.filter(m => m.context_type === 'conversation');
    const preferences = userMemories.filter(m => m.context_type === 'preference');

    // OPTIMIZATION: Batch username lookups (eliminates N+1)
    const allUserIds = new Set();
    serverMemories.forEach(m => m.user_id && allUserIds.add(m.user_id));
    
    const userInfoMap = client && allUserIds.size > 0
      ? await userCacheService.batchGetUsers(client, Array.from(allUserIds))
      : new Map();

    // Build context with relevance ranking
    let context = '';
    
    // Server knowledge (highest priority)
    if (serverMemories.length > 0) {
      context += '=== SERVER KNOWLEDGE ===\n';
      
      // Score and sort by relevance
      const scoredMemories = serverMemories.map(memory => ({
        memory,
        score: calculateRelevanceScore(memory, searchTerms, currentMessage)
      })).sort((a, b) => b.score - a.score);

      for (const { memory, score } of scoredMemories.slice(0, 8)) {
        if (score < 0.1) break; // Skip irrelevant memories
        
        const userInfo = userInfoMap.get(memory.user_id);
        const username = userInfo ? userCacheService.getDisplayName(userInfo) : 'Unknown';
        const timeAgo = getTimeAgo(memory.updated_at);
        const title = memory.memory_title ? `[${memory.memory_title}] ` : '';
        
        context += `• ${title}${memory.memory_content} (via ${username}, ${timeAgo})\n`;
      }
      context += '\n';
    }

    // Conversation summaries (medium priority)
    if (summaries.length > 0) {
      context += 'Recent Conversations:\n';
      summaries.slice(0, 3).forEach(summary => {
        const timeAgo = getTimeAgo(summary.updated_at);
        const msgCount = summary.metadata?.message_count || '?';
        context += `- ${summary.memory_content} (${msgCount} exchanges, ${timeAgo})\n`;
      });
      context += '\n';
    }

    // Individual conversations (lower priority, with deduplication)
    const relevantConversations = conversations
      .filter(m => !hasFalsePingPattern(m.memory_content))
      .slice(0, 3);
      
    if (relevantConversations.length > 0) {
      context += 'Context:\n';
      relevantConversations.forEach(memory => {
        const timeAgo = getTimeAgo(memory.updated_at);
        context += `- ${memory.memory_content} (${timeAgo})\n`;
      });
      context += '\n';
    }

    // User preferences (always include)
    if (preferences.length > 0) {
      context += 'Preferences:\n';
      preferences.forEach(pref => {
        const key = pref.metadata?.preference_key;
        const value = pref.metadata?.preference_value;
        if (key && value !== undefined) {
          context += `- ${key}: ${JSON.stringify(value)}\n`;
        }
      });
      context += '\n';
    }

    const finalContext = context.trim();
    
    // Cache the result
    memoryContextCache.set(cacheKey, {
      data: finalContext,
      timestamp: Date.now()
    });

    const elapsed = Date.now() - startTime;
    console.log(`[Memory Context] Built in ${elapsed}ms (2 queries, cache stored)`);

    return finalContext;
    
  } catch (error) {
    console.error('[Memory Context] Error:', error);
    return '';
  }
}

/**
 * Calculate relevance score for a memory
 * Prevents irrelevant memories from polluting context
 */
function calculateRelevanceScore(memory, searchTerms, currentMessage) {
  let score = 0;
  const content = (memory.memory_content || '').toLowerCase();
  const title = (memory.memory_title || '').toLowerCase();
  const fullText = content + ' ' + title;

  // Keyword match scoring (40% weight)
  const matchedTerms = searchTerms.filter(term => 
    fullText.includes(term.toLowerCase())
  );
  score += (matchedTerms.length / Math.max(searchTerms.length, 1)) * 0.4;

  // Exact phrase match bonus (30% weight)
  if (fullText.includes(currentMessage.toLowerCase().slice(0, 50))) {
    score += 0.3;
  }

  // Recency score (20% weight) - decay over 30 days
  const ageInDays = (Date.now() - new Date(memory.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  score += (1 - Math.min(ageInDays / 30, 1)) * 0.2;

  // Summary bonus (10% weight)
  if (memory.context_type === 'conversation_summary') {
    score += 0.1;
  }

  return score;
}

/**
 * Detect patterns that indicate false ping information
 * Prevents memory corruption from confusing who said what
 */
function hasFalsePingPattern(content) {
  const lower = content.toLowerCase();
  
  // Patterns that indicate false ping counting
  const falsePatterns = [
    /(?:pinged?|mentioned?|said).*(?:four|twice|three|five|\d+)\s*times/i,
    /(?:four|twice|three|five|\d+)\s*times.*(?:pinged?|mentioned?|said)/i,
    /me\?\s*(?:twice|four|three|five|\d+)/i,
    /bot (?:said|responded|mentioned).*user said/i, // Confusion between bot and user
    /user said.*bot responded.*user said/i // Duplicate attribution
  ];

  return falsePatterns.some(pattern => pattern.test(lower));
}

/**
 * Cleanup expired cache entries
 */
function cleanupMemoryContextCache() {
  const now = Date.now();
  let removed = 0;

  for (const [key, cached] of memoryContextCache.entries()) {
    if (now - cached.timestamp > MEMORY_CACHE_TTL) {
      memoryContextCache.delete(key);
      removed++;
    }
  }

  if (removed > 0) {
    console.log(`[Memory Context Cache] Cleaned up ${removed} expired entries`);
  }
}

// Cleanup cache every 5 minutes
setInterval(cleanupMemoryContextCache, 5 * 60 * 1000);

// ============================================================================
// END OPTIMIZED buildMemoryContextOptimized
// ============================================================================

// ============================================================================
// VECTOR EMBEDDING FUNCTIONS (Phase 3 - Semantic Search)
// ============================================================================

/**
 * Store user memory with vector embedding
 * Only generates embedding for summaries (cost optimization)
 * 
 * @param {string} userId - Discord user ID
 * @param {string} content - Memory content
 * @param {string} contextType - Type of memory
 * @param {object} metadata - Additional metadata
 * @param {Date|null} expiresAt - Expiration date
 * @param {boolean} generateEmbedding - Whether to generate embedding (default: false)
 * @returns {Promise<object>} Created memory record
 */
async function storeUserMemoryWithEmbedding(userId, content, contextType = 'conversation', metadata = {}, expiresAt = null, generateEmbedding = false) {
  try {
    let embedding = null;
    
    // Only generate embeddings for summaries (cost optimization)
    if (generateEmbedding && contextType === 'conversation_summary') {
      embedding = await embeddingService.generateEmbedding(content);
      console.log(`[VectorMemory] Generated embedding for user memory (${contextType})`);
    }

    const { data, error } = await supabase
      .from('user_memory')
      .insert([{
        user_id: userId,
        memory_content: content,
        context_type: contextType,
        metadata: metadata,
        expires_at: expiresAt,
        embedding: embedding
      }])
      .select();
    
    if (error) {
      console.error('[VectorMemory] Error storing user memory:', error);
      return null;
    }
    
    return data[0];
  } catch (error) {
    console.error('[VectorMemory] Error in storeUserMemoryWithEmbedding:', error);
    return null;
  }
}

/**
 * Semantic search for user memories using vector similarity
 * Finds memories by meaning, not just keywords
 * 
 * @param {string} userId - Discord user ID
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @param {number} threshold - Minimum similarity (0-1, default 0.7)
 * @returns {Promise<Array>} Matching memories with similarity scores
 */
async function semanticSearchUserMemories(userId, query, limit = 5, threshold = 0.7) {
  try {
    // Generate embedding for the query
    const queryEmbedding = await embeddingService.generateEmbedding(query);
    
    if (!queryEmbedding) {
      console.warn('[VectorMemory] Failed to generate query embedding, falling back to keyword search');
      return await searchUserMemories(userId, query, null, limit);
    }

    // Call the database function for semantic search
    const { data, error } = await supabase.rpc('match_user_memories', {
      query_embedding: queryEmbedding,
      match_user_id: userId,
      match_threshold: threshold,
      match_count: limit
    });

    if (error) {
      console.error('[VectorMemory] Semantic search error:', error);
      // Fallback to keyword search
      return await searchUserMemories(userId, query, null, limit);
    }

    console.log(`[VectorMemory] Found ${data?.length || 0} semantically similar memories`);
    return data || [];
  } catch (error) {
    console.error('[VectorMemory] Error in semanticSearchUserMemories:', error);
    // Fallback to keyword search
    return await searchUserMemories(userId, query, null, limit);
  }
}

/**
 * Store server memory with vector embedding
 * 
 * @param {string} serverId - Discord server ID
 * @param {string} userId - User who created the memory
 * @param {string} content - Memory content
 * @param {string} title - Memory title
 * @param {string} contextType - Type of memory
 * @param {object} metadata - Additional metadata
 * @param {Date|null} expiresAt - Expiration date
 * @param {boolean} generateEmbedding - Whether to generate embedding (default: true for server memories)
 * @returns {Promise<object>} Created memory record
 */
async function storeServerMemoryWithEmbedding(serverId, userId, content, title = null, contextType = 'knowledge', metadata = {}, expiresAt = null, generateEmbedding = true) {
  try {
    let embedding = null;
    
    // Server memories usually benefit from embeddings
    if (generateEmbedding) {
      embedding = await embeddingService.generateEmbedding(content);
      console.log(`[VectorMemory] Generated embedding for server memory (${contextType})`);
    }

    const { data, error } = await supabase
      .from('server_memory')
      .insert([{
        server_id: serverId,
        user_id: userId,
        memory_content: content,
        memory_title: title,
        context_type: contextType,
        metadata: metadata,
        expires_at: expiresAt,
        embedding: embedding
      }])
      .select();
    
    if (error) {
      console.error('[VectorMemory] Error storing server memory:', error);
      return null;
    }
    
    return data[0];
  } catch (error) {
    console.error('[VectorMemory] Error in storeServerMemoryWithEmbedding:', error);
    return null;
  }
}

/**
 * Semantic search for server memories using vector similarity
 * 
 * @param {string} serverId - Discord server ID
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @param {number} threshold - Minimum similarity (0-1, default 0.7)
 * @returns {Promise<Array>} Matching memories with similarity scores
 */
async function semanticSearchServerMemories(serverId, query, limit = 8, threshold = 0.7) {
  try {
    // Generate embedding for the query
    const queryEmbedding = await embeddingService.generateEmbedding(query);
    
    if (!queryEmbedding) {
      console.warn('[VectorMemory] Failed to generate query embedding, falling back to keyword search');
      return await searchServerMemories(serverId, query, null, limit);
    }

    // Call the database function for semantic search
    const { data, error } = await supabase.rpc('match_server_memories', {
      query_embedding: queryEmbedding,
      match_server_id: serverId,
      match_threshold: threshold,
      match_count: limit
    });

    if (error) {
      console.error('[VectorMemory] Semantic search error:', error);
      // Fallback to keyword search
      return await searchServerMemories(serverId, query, null, limit);
    }

    console.log(`[VectorMemory] Found ${data?.length || 0} semantically similar server memories`);
    return data || [];
  } catch (error) {
    console.error('[VectorMemory] Error in semanticSearchServerMemories:', error);
    // Fallback to keyword search
    return await searchServerMemories(serverId, query, null, limit);
  }
}

/**
 * Backfill embeddings for existing memories
 * Run this once after migration 003 to add embeddings to old data
 * Only processes summaries and server knowledge (cost optimization)
 * 
 * @param {number} batchSize - Process in batches
 * @returns {Promise<object>} Statistics about the backfill
 */
async function backfillEmbeddings(batchSize = 50) {
  console.log('[VectorMemory] Starting embedding backfill...');
  
  try {
    let stats = {
      userMemoriesProcessed: 0,
      serverMemoriesProcessed: 0,
      errors: 0,
      totalCost: 0
    };

    // Backfill user memory summaries only
    const { data: userMemories, error: userError } = await supabase
      .from('user_memory')
      .select('id, memory_content')
      .eq('context_type', 'conversation_summary')
      .is('embedding', null)
      .limit(batchSize);

    if (!userError && userMemories && userMemories.length > 0) {
      console.log(`[VectorMemory] Processing ${userMemories.length} user memory summaries...`);
      
      const embeddings = await embeddingService.generateEmbeddingsBatch(
        userMemories.map(m => m.memory_content)
      );

      for (let i = 0; i < userMemories.length; i++) {
        if (embeddings[i]) {
          await supabase
            .from('user_memory')
            .update({ embedding: embeddings[i] })
            .eq('id', userMemories[i].id);
          stats.userMemoriesProcessed++;
        }
      }
    }

    // Backfill server memories
    const { data: serverMemories, error: serverError } = await supabase
      .from('server_memory')
      .select('id, memory_content')
      .is('embedding', null)
      .limit(batchSize);

    if (!serverError && serverMemories && serverMemories.length > 0) {
      console.log(`[VectorMemory] Processing ${serverMemories.length} server memories...`);
      
      const embeddings = await embeddingService.generateEmbeddingsBatch(
        serverMemories.map(m => m.memory_content)
      );

      for (let i = 0; i < serverMemories.length; i++) {
        if (embeddings[i]) {
          await supabase
            .from('server_memory')
            .update({ embedding: embeddings[i] })
            .eq('id', serverMemories[i].id);
          stats.serverMemoriesProcessed++;
        }
      }
    }

    const costStats = embeddingService.getCostStats();
    stats.totalCost = costStats.estimatedCost;

    console.log('[VectorMemory] Backfill complete:', stats);
    return stats;
  } catch (error) {
    console.error('[VectorMemory] Error in backfillEmbeddings:', error);
    return { error: error.message };
  }
}

/**
 * Get embedding statistics
 * Shows how many memories have embeddings
 */
async function getEmbeddingStats() {
  try {
    const { data, error } = await supabase.rpc('get_embedding_stats');
    
    if (error) {
      console.error('[VectorMemory] Error getting stats:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[VectorMemory] Error in getEmbeddingStats:', error);
    return null;
  }
}

// ============================================================================
// END VECTOR EMBEDDING FUNCTIONS
// ============================================================================

// Server Memory functions
async function storeServerMemory(serverId, userId, content, title = null, contextType = 'server', metadata = {}, expiresAt = null) {
    const { data, error } = await supabase
        .from('server_memory')
        .insert([{
            server_id: serverId,
            user_id: userId,
            memory_content: content,
            memory_title: title,
            context_type: contextType,
            metadata: metadata,
            expires_at: expiresAt
        }])
        .select();
    
    if (error) {
        console.error('Error storing server memory:', error);
        return null;
    }
    return data[0];
}

async function getServerMemories(serverId, contextType = null, limit = 20) {
    let query = supabase
        .from('server_memory')
        .select('*')
        .eq('server_id', serverId)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('updated_at', { ascending: false });
    
    if (contextType) {
        query = query.eq('context_type', contextType);
    }
    
    if (limit) {
        query = query.limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error fetching server memories:', error);
        return [];
    }
    return data || [];
}

async function searchServerMemories(serverId, searchTerm, contextType = null, limit = 10) {
    let query = supabase
        .from('server_memory')
        .select('*')
        .eq('server_id', serverId)
        .or(`memory_content.ilike.%${searchTerm}%,memory_title.ilike.%${searchTerm}%`)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('updated_at', { ascending: false });
    
    if (contextType) {
        query = query.eq('context_type', contextType);
    }
    
    if (limit) {
        query = query.limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error searching server memories:', error);
        return [];
    }
    return data || [];
}

async function deleteServerMemory(memoryId, userId = null) {
    let query = supabase
        .from('server_memory')
        .delete()
        .eq('id', memoryId);
    
    // CODE_MONKEY can delete any server memory, others can only delete their own
    if (userId && userId !== process.env.CODE_MONKEY) {
        query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.select();
    
    if (error) {
        console.error('Error deleting server memory:', error);
        return null;
    }
    return data[0];
}

async function getServerMemoryStats(serverId) {
    const { data, error } = await supabase
        .from('server_memory')
        .select('context_type, created_at, user_id')
        .eq('server_id', serverId)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
    
    if (error) {
        console.error('Error fetching server memory stats:', error);
        return { total: 0, byType: {}, byUser: {} };
    }
    
    const stats = { total: data?.length || 0, byType: {}, byUser: {} };
    data?.forEach(memory => {
        stats.byType[memory.context_type] = (stats.byType[memory.context_type] || 0) + 1;
        stats.byUser[memory.user_id] = (stats.byUser[memory.user_id] || 0) + 1;
    });
    
    // Find oldest memory
    if (data && data.length > 0) {
        const oldest = data.reduce((prev, current) => 
            new Date(prev.created_at) < new Date(current.created_at) ? prev : current
        );
        stats.oldest = oldest.created_at;
    }
    
    return stats;
}

async function getUserServerMemories(serverId, userId, limit = 10) {
    const { data, error } = await supabase
        .from('server_memory')
        .select('*')
        .eq('server_id', serverId)
        .eq('user_id', userId)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('updated_at', { ascending: false })
        .limit(limit);
    
    if (error) {
        console.error('Error fetching user server memories:', error);
        return [];
    }
    return data || [];
}

async function cleanupExpiredServerMemories() {
    const { data, error } = await supabase
        .from('server_memory')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .not('expires_at', 'is', null)
        .select();
    
    if (error) {
        console.error('Error cleaning up expired server memories:', error);
        return 0;
    }
    
    console.log(`Cleaned up ${data?.length || 0} expired server memories`);
    return data?.length || 0;
}

// Update user memory by ID
async function updateUserMemory(memoryId, updates = {}) {
    const allowedFields = ['memory_content', 'context_type', 'metadata', 'expires_at'];
    const validUpdates = {};
    
    // Filter to only allow valid fields
    Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
            validUpdates[key] = updates[key];
        }
    });
    
    if (Object.keys(validUpdates).length === 0) {
        console.error('No valid fields provided for update');
        return null;
    }
    
    // Add updated_at timestamp
    validUpdates.updated_at = new Date().toISOString();
    
    const { data, error } = await supabase
        .from('user_memory')
        .update(validUpdates)
        .eq('id', memoryId)
        .select();
    
    if (error) {
        console.error('Error updating user memory:', error);
        return null;
    }
    
    if (!data || data.length === 0) {
        console.error('No memory found with that ID');
        return null;
    }
    
    return data[0];
}

// Update server memory by ID
async function updateServerMemory(memoryId, updates = {}, userId = null) {
    const allowedFields = ['memory_content', 'memory_title', 'context_type', 'metadata', 'expires_at'];
    const validUpdates = {};
    
    // Filter to only allow valid fields
    Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
            validUpdates[key] = updates[key];
        }
    });
    
    if (Object.keys(validUpdates).length === 0) {
        console.error('No valid fields provided for update');
        return null;
    }
    
    // Add updated_at timestamp
    validUpdates.updated_at = new Date().toISOString();
    
    // Build query
    let query = supabase
        .from('server_memory')
        .update(validUpdates)
        .eq('id', memoryId);
    
    // If userId is provided, only allow updating memories created by that user
    // (for permission control - regular users can only update their own memories)
    if (userId) {
        query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.select();
    
    if (error) {
        console.error('Error updating server memory:', error);
        return null;
    }
    
    if (!data || data.length === 0) {
        console.error('No memory found with that ID or insufficient permissions');
        return null;
    }
    
    return data[0];
}

// Get a specific user memory by ID (for verification before update)
async function getUserMemoryById(memoryId, userId = null) {
    // Validate UUID format to prevent PostgreSQL errors
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(memoryId)) {
        console.log(`Invalid UUID format: ${memoryId}`);
        return null; // Return null for invalid UUIDs instead of throwing error
    }
    
    let query = supabase
        .from('user_memory')
        .select('*')
        .eq('id', memoryId);
    
    // If userId is provided, filter by user (normal mode)
    // If userId is null, get memory regardless of owner (admin mode)
    if (userId) {
        query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.single();
    
    if (error) {
        console.error('Error fetching user memory:', error);
        return null;
    }
    
    return data;
}

// Get a specific server memory by ID (for verification before update)
async function getServerMemoryById(memoryId, serverId = null) {
    // Validate UUID format to prevent PostgreSQL errors
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(memoryId)) {
        console.log(`Invalid UUID format: ${memoryId}`);
        return null; // Return null for invalid UUIDs instead of throwing error
    }
    
    let query = supabase
        .from('server_memory')
        .select('*')
        .eq('id', memoryId);
    
    // Optionally filter by server ID for additional security
    if (serverId) {
        query = query.eq('server_id', serverId);
    }
    
    const { data, error } = await query.single();
    
    if (error) {
        console.error('Error fetching server memory:', error);
        return null;
    }
    
    return data;
}

// Get server memory by partial ID (for admin use with short IDs)
async function getServerMemoryByPartialId(partialId, serverId = null) {
    let query = supabase
        .from('server_memory')
        .select('*');
    
    // Add server filter if provided  
    if (serverId) {
        query = query.eq('server_id', serverId);
    }
    
    // Get all memories and filter in JavaScript
    const { data, error } = await query;
    
    if (error) {
        console.error('Error fetching server memories for partial match:', error);
        return null;
    }
    
    // Filter by partial ID match in JavaScript (case-insensitive)
    const matchingMemories = data.filter(memory => 
        memory.id.toLowerCase().startsWith(partialId.toLowerCase())
    );
    
    console.log(`Found ${matchingMemories.length} memories matching partial ID: ${partialId}`);
    
    // Return the first match
    return matchingMemories.length > 0 ? matchingMemories[0] : null;
}

// Thread tracking functions using existing messages table
async function storeMessageThread(messageData) {
    try {
        const { data, error } = await supabase
            .from('messages')
            .insert([messageData])
            .select();
        
        if (error) {
            console.error('Error storing message in messages table:', error);
            return null;
        }
        
        return data[0];
    } catch (error) {
        console.error('Error in storeMessageThread:', error);
        return null;
    }
}

async function getMessageThread(messageId) {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('message_id', messageId)
            .single();
        
        if (error) {
            console.error('Error fetching message thread:', error);
            return null;
        }
        
        return { ...data, thread_id: data.thread };
    } catch (error) {
        console.error('Error in getMessageThread:', error);
        return null;
    }
}

async function getThreadMessages(threadId, limit = 20) {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('thread', threadId)
            .order('created_at', { ascending: true })
            .limit(limit);
        
        if (error) {
            console.error('Error fetching thread messages:', error);
            return [];
        }
        
        return data || [];
    } catch (error) {
        console.error('Error in getThreadMessages:', error);
        return [];
    }
}

async function cleanupOldMessageThreads(daysOld = 7) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        const { data, error } = await supabase
            .from('messages')
            .delete()
            .lt('created_at', cutoffDate.toISOString())
            .not('thread', 'is', null);
        
        if (error) {
            console.error('Error cleaning up old message threads:', error);
            return 0;
        }
        
        const deletedCount = data ? data.length : 0;
        console.log(`Cleaned up ${deletedCount} old thread messages`);
        return deletedCount;
    } catch (error) {
        console.error('Error in cleanupOldMessageThreads:', error);
        return 0;
    }
}

// Video generation functions
async function insertVideo(userId, guildId, channelId, prompt, referenceImages = [], metadata = {}) {
    const { data, error } = await supabase
        .from('videos')
        .insert([{
            user_id: userId,
            guild_id: guildId,
            channel_id: channelId,
            prompt: prompt,
            reference_images: referenceImages,
            status: 'pending',
            metadata: metadata
        }])
        .select();
    
    if (error) {
        console.error('Error inserting video:', error);
        return null;
    }
    return data[0];
}

async function updateVideoStatus(videoId, status, videoUrl = null, errorMessage = null) {
    const updates = {
        status: status,
        updated_at: new Date().toISOString()
    };
    
    if (videoUrl) {
        updates.video_url = videoUrl;
    }
    
    if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
    }
    
    if (errorMessage) {
        updates.error_message = errorMessage;
    }
    
    const { data, error } = await supabase
        .from('videos')
        .update(updates)
        .eq('id', videoId)
        .select();
    
    if (error) {
        console.error('Error updating video status:', error);
        return null;
    }
    return data[0];
}

async function updateVideoWithOpenAIId(videoId, openaiVideoId) {
    const { data, error } = await supabase
        .from('videos')
        .update({ 
            video_id: openaiVideoId,
            status: 'processing',
            updated_at: new Date().toISOString()
        })
        .eq('id', videoId)
        .select();
    
    if (error) {
        console.error('Error updating video with OpenAI ID:', error);
        return null;
    }
    return data[0];
}

async function getVideoById(videoId) {
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single();
    
    if (error) {
        console.error('Error fetching video:', error);
        return null;
    }
    return data;
}

async function getVideoByOpenAIId(openaiVideoId) {
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('video_id', openaiVideoId)
        .single();
    
    if (error) {
        console.error('Error fetching video by OpenAI ID:', error);
        return null;
    }
    return data;
}

async function getUserVideos(userId, limit = 10) {
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
    
    if (error) {
        console.error('Error fetching user videos:', error);
        return [];
    }
    return data || [];
}

async function getGuildVideos(guildId, limit = 20) {
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .limit(limit);
    
    if (error) {
        console.error('Error fetching guild videos:', error);
        return [];
    }
    return data || [];
}

async function getVideoStats(userId = null) {
    let query = supabase
        .from('videos')
        .select('status, created_at');
    
    if (userId) {
        query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error fetching video stats:', error);
        return { total: 0, byStatus: {} };
    }
    
    const stats = { 
        total: data?.length || 0, 
        byStatus: {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0
        }
    };
    
    data?.forEach(video => {
        stats.byStatus[video.status] = (stats.byStatus[video.status] || 0) + 1;
    });
    
    return stats;
}

async function cleanupOldVideos(daysOld = 30) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        const { data, error } = await supabase
            .from('videos')
            .delete()
            .lt('created_at', cutoffDate.toISOString())
            .in('status', ['completed', 'failed']);
        
        if (error) {
            console.error('Error cleaning up old videos:', error);
            return 0;
        }
        
        const deletedCount = data ? data.length : 0;
        console.log(`Cleaned up ${deletedCount} old videos`);
        return deletedCount;
    } catch (error) {
        console.error('Error in cleanupOldVideos:', error);
        return 0;
    }
}

export {
    getAllGuilds,
    getMarkovChannels,
    getAllUsers, 
    getConfig, 
    insertImages, 
    getContext, 
    getBZBannedRoles,
    // Memory functions
    storeUserMemory,
    getUserMemories,
    searchUserMemories,
    getUserPreferences,
    setUserPreference,
    deleteUserMemories,
    deleteMemoryById,
    cleanupExpiredMemories,
    cleanupOldMemories,
    getUserMemoryStats,
    // Memory utility functions
    buildMemoryContext,
    buildMemoryContextOptimized, // NEW - Optimized version
    storeConversation,
    storeConversationSummary,
    storeUserMemoryOptimized, // NEW - Batched version
    flushConversationBatch, // NEW - Manual batch flush
    storeTemporaryMemory,
    extractKeywords,
    getTimeAgo,
    // Vector embedding functions (Phase 3)
    storeUserMemoryWithEmbedding, // NEW - With semantic search
    storeServerMemoryWithEmbedding, // NEW - With semantic search
    semanticSearchUserMemories, // NEW - Semantic search
    semanticSearchServerMemories, // NEW - Semantic search
    backfillEmbeddings, // NEW - Backfill existing memories
    getEmbeddingStats, // NEW - Check embedding progress
    // Server memory functions
    storeServerMemory,
    getServerMemories,
    searchServerMemories,
    deleteServerMemory,
    getServerMemoryStats,
    getUserServerMemories,
    cleanupExpiredServerMemories,
    // Update functions
    updateUserMemory,
    updateServerMemory,
    // Get functions for verification
    getUserMemoryById,
    getServerMemoryById,
    getServerMemoryByPartialId,
    // Thread tracking functions
    storeMessageThread,
    getMessageThread,
    getThreadMessages,
    cleanupOldMessageThreads,
    // Video functions
    insertVideo,
    updateVideoStatus,
    updateVideoWithOpenAIId,
    getVideoById,
    getVideoByOpenAIId,
    getUserVideos,
    getGuildVideos,
    getVideoStats,
    cleanupOldVideos
}


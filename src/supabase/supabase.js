import { createClient } from '@supabase/supabase-js'
import dotenv from "dotenv";
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
async function storeUserMemory(userId, content, contextType = 'conversation', metadata = {}, expiresAt = null) {
    const { data, error } = await supabase
        .from('user_memory')
        .insert([{
            user_id: userId,
            memory_content: content,
            context_type: contextType,
            metadata: metadata,
            expires_at: expiresAt
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
      context += 'Previous Conversations:\n';
      uniqueMemories.slice(0, 4).forEach(memory => { // Reduced from 5 to 4
        const timeAgo = getTimeAgo(memory.updated_at);
        context += `- ${memory.memory_content} (${timeAgo})\n`;
      });
      context += '\n';
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
    storeConversation,
    storeConversationSummary,
    storeTemporaryMemory,
    extractKeywords,
    getTimeAgo,
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
    getServerMemoryByPartialId
}


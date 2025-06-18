import { createClient } from '@supabase/supabase-js'
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// Function to get all guilds
async function getAllGuilds() {
    const { data, error } = await supabase.from('guilds').select('*')
    if (error) {
        console.error('Error fetching guilds:', error)
        return []
    }
    return data
}

// Function to get channels Markov can run in
async function getMarkovChannels() {
    const { data, error } = await supabase
        .from('channels')
        .select('channel_id')
        .in('channel_name', ['chillin', 'bot_spam']);
  
    if (error) {
        console.error('Error fetching channels:', error);
        return [];
    }
    return data;
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
  
  // Remove common words and extract meaningful terms
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'this', 'that', 'is', 'was', 'are', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might'];
  
  const words = message.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.includes(word))
    .slice(0, 5); // Limit to 5 keywords
  
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

async function buildMemoryContext(userId, currentMessage = '') {
  try {
    // Get relevant conversation memories
    const searchTerms = extractKeywords(currentMessage);
    let relevantMemories = [];
    
    for (const term of searchTerms.slice(0, 3)) { // Limit to 3 keywords
      const memories = await searchUserMemories(userId, term, 'conversation', 3);
      relevantMemories.push(...memories);
    }
    
    // Remove duplicates
    const uniqueMemories = [...new Map(relevantMemories.map(m => [m.id, m])).values()];
    
    // Get recent conversations if no relevant ones found
    if (uniqueMemories.length === 0) {
      const recentMemories = await getUserMemories(userId, 'conversation', 5);
      uniqueMemories.push(...recentMemories);
    }
    
    // Get conversation summaries
    const summaries = await getUserMemories(userId, 'conversation_summary', 3);
    
    // Get user preferences
    const preferences = await getUserPreferences(userId);
    
    // Build context string
    let context = '';
    
    if (uniqueMemories.length > 0) {
      context += 'Previous Conversations:\n';
      uniqueMemories.slice(0, 5).forEach(memory => {
        const timeAgo = getTimeAgo(memory.updated_at);
        context += `- ${memory.memory_content} (${timeAgo})\n`;
      });
      context += '\n';
    }
    
    if (summaries.length > 0) {
      context += 'Conversation Summaries:\n';
      summaries.forEach(summary => {
        const timeAgo = getTimeAgo(summary.updated_at);
        context += `- ${summary.memory_content} (${timeAgo})\n`;
      });
      context += '\n';
    }
    
    if (Object.keys(preferences).length > 0) {
      context += 'User Preferences:\n';
      Object.entries(preferences).forEach(([key, value]) => {
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
    getTimeAgo
}


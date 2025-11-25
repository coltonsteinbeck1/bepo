// Reply Chain Tracking Utilities
// Handles Discord reply chains and maintains thread context for bot responses

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Import supabase client
let supabase;
try {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  supabase = createClient(supabaseUrl, supabaseKey);
} catch (error) {
  console.error('Failed to initialize Supabase client in replyUtils:', error);
}

/**
 * Generate a unique thread ID based on the root message
 */
export function generateThreadId(rootMessageId, channelId) {
  return crypto
    .createHash('sha256')
    .update(`${rootMessageId}_${channelId}`)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Check if a message is a reply to another message
 */
export function isReplyMessage(message) {
  return message.reference && message.reference.messageId;
}

/**
 * Get the full thread context for a message by walking up the reply chain
 */
export async function getThreadContext(message, maxDepth = 10) {
  const threadMessages = [];
  let currentMessage = message;
  let depth = 0;

  // Walk up the reply chain to get context
  while (currentMessage && currentMessage.reference && depth < maxDepth) {
    try {
      const referencedMessage = await currentMessage.fetchReference();
      if (!referencedMessage) break;
      
      threadMessages.unshift({
        messageId: referencedMessage.id,
        userId: referencedMessage.author.id,
        username: referencedMessage.author.username,
        content: referencedMessage.content,
        timestamp: referencedMessage.createdTimestamp,
        isBot: referencedMessage.author.bot,
        attachments: referencedMessage.attachments.size > 0
      });
      
      currentMessage = referencedMessage;
      depth++;
    } catch (error) {
      console.error('Error fetching referenced message:', error);
      break;
    }
  }
  
  return threadMessages;
}

/**
 * Store a message in the existing messages table with thread ID
 */
export async function storeMessageInThread(message, threadId = null, rootMessageId = null, parentMessageId = null) {
  if (!supabase) {
    console.error('Supabase not initialized, cannot store thread message');
    return null;
  }
  
  try {
    // If this is a new thread (no parent), it becomes the root
    if (!threadId && !parentMessageId) {
      rootMessageId = message.id;
      threadId = generateThreadId(message.id, message.channelId);
    }
    
    const messageData = {
      message_id: message.id,
      content: message.content,
      thread: threadId, // Store thread ID in the existing thread column
      user_id: message.author.id,
      channel_id: message.channelId,
      guild_id: message.guildId,
      parent_message_id: parentMessageId,
      root_message_id: rootMessageId,
      is_bot_message: message.author.bot,
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('messages')
      .insert([messageData])
      .select();
    
    if (error) {
      console.error('Error storing message in messages table:', error);
      return null;
    }
    
    return { ...data[0], thread_id: threadId };
  } catch (error) {
    console.error('Error in storeMessageInThread:', error);
    return null;
  }
}

/**
 * Get all messages in a thread for context from messages table (with caching)
 */
export async function getThreadMessages(threadId, limit = 20) {
  if (!supabase) {
    console.error('Supabase not initialized, cannot get thread messages');
    return [];
  }
  
  // Check cache first
  const cacheKey = `thread_${threadId}_${limit}`;
  const cached = global.threadCache?.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < 120000) { // 2 minute cache
    return cached.data;
  }
  
  try {
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('thread', threadId)
      .order('created_at', { ascending: true })
      .limit(limit)
      .abortSignal(controller.signal);
    
    clearTimeout(timeoutId);
    
    if (error) {
      console.error('Error fetching thread messages:', error);
      return [];
    }
    
    // Cache the result
    if (!global.threadCache) global.threadCache = new Map();
    global.threadCache.set(cacheKey, {
      data: data || [],
      timestamp: Date.now()
    });
    
    return data || [];
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Thread messages query timed out for:', threadId);
    } else {
      console.error('Error in getThreadMessages:', error);
    }
    return [];
  }
}

/**
 * Get thread information for a message from messages table
 */
export async function getMessageThread(messageId) {
  if (!supabase) {
    console.error('Supabase not initialized, cannot get message thread');
    return null;
  }
  
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

/**
 * Process a new message and handle thread tracking (optimized, non-blocking)
 */
export async function processMessageForThread(message) {
  const timeout = 2000; // 2 second timeout
  
  try {
    // Quick timeout wrapper
    const processWithTimeout = async () => {
      if (!isReplyMessage(message)) {
        return null;
      }

      // Fast check - try to get existing thread info
      const parentThreadInfo = await Promise.race([
        getMessageThread(message.reference.messageId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
      ]);
      
      if (parentThreadInfo?.thread_id) {
        // Quick store in existing thread
        return await Promise.race([
          storeMessageInThread(
            message, 
            parentThreadInfo.thread_id,
            parentThreadInfo.root_message_id,
            message.reference.messageId
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Store timeout')), timeout))
        ]);
      } else {
        // Create new thread - this can be slower so we'll just generate thread ID
        const rootMessageId = message.reference.messageId;
        const threadId = generateThreadId(rootMessageId, message.channelId);
        
        // Store current message only (skip parent for speed)
        return await Promise.race([
          storeMessageInThread(
            message,
            threadId,
            rootMessageId,
            message.reference.messageId
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error('New thread timeout')), timeout))
        ]);
      }
    };
    
    return await processWithTimeout();
    
  } catch (error) {
    if (error.message.includes('Timeout') || error.message.includes('timeout')) {
      console.log(`[THREAD] Processing timed out for message ${message.id} - continuing without thread tracking`);
    } else {
      console.error('[THREAD] Processing error:', error.message);
    }
    return null;
  }
}

/**
 * Build enhanced context including thread history
 */
export function buildThreadContextString(threadMessages) {
  if (!threadMessages || threadMessages.length === 0) {
    return '';
  }
  
  let contextString = '--- Thread Context ---\\n';
  
  threadMessages.forEach((msg, index) => {
    const timestamp = new Date(msg.created_at).toLocaleString();
    const author = msg.is_bot_message ? 'Bot' : `User(${msg.user_id})`;
    const content = msg.content || '[No content]';
    
    contextString += `${index + 1}. [${timestamp}] ${author}: ${content}\\n`;
  });
  
  contextString += '--- End Thread Context ---\\n';
  return contextString;
}

/**
 * Clean up old thread data (run periodically)
 */
export async function cleanupOldThreads(daysOld = 7) {
  if (!supabase) {
    console.error('Supabase not initialized, cannot cleanup threads');
    return 0;
  }
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const { data, error } = await supabase
      .from('messages')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .not('thread', 'is', null); // Only delete messages that are part of threads
    
    if (error) {
      console.error('Error cleaning up old threads:', error);
      return 0;
    }
    
    const deletedCount = data ? data.length : 0;
    console.log(`Cleaned up ${deletedCount} old thread messages`);
    return deletedCount;
  } catch (error) {
    console.error('Error in cleanupOldThreads:', error);
    return 0;
  }
}
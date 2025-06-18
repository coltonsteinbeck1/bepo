import { ChannelType } from "discord.js";
import { markThreadAsBotManaged } from "./utils.js";
import { OpenAI } from "openai";
import dotenv from "dotenv";
dotenv.config();

const xAI = new OpenAI({
  apiKey: process.env.xAI_KEY,
  baseURL: "https://api.x.ai/v1",
});

/**
 * Create a Discord thread for a conversation
 * @param {Message|Interaction} messageOrInteraction - The message or interaction to create a thread from
 * @param {string} topicName - Name for the thread
 * @returns {Promise<ThreadChannel|null>} - The created thread or null if failed
 */
export async function createConversationThread(messageOrInteraction, topicName) {
  try {
    const channel = messageOrInteraction.channel;
    const user = messageOrInteraction.user || messageOrInteraction.author;
    
    // Only create threads in text channels
    if (channel.type !== ChannelType.GuildText) {
      return null;
    }

    const threadName = topicName || `Chat with ${user.username}`;
    
    // For interactions, we need to create the thread differently
    let thread;
    if (messageOrInteraction.isCommand && messageOrInteraction.isCommand()) {
      // For slash commands, create thread in the channel
      thread = await channel.threads.create({
        name: threadName.substring(0, 100), // Discord limit
        autoArchiveDuration: 60, // 1 hour (shortest Discord allows - bot will delete after 1 hour)
        reason: 'Bepo conversation thread - auto-deletes after 1 hour of inactivity'
      });
    } else {
      // For messages, use startThread
      thread = await messageOrInteraction.startThread({
        name: threadName.substring(0, 100), // Discord limit
        autoArchiveDuration: 60, // 1 hour (shortest Discord allows - bot will delete after 1 hour)
        reason: 'Bepo conversation thread - auto-deletes after 1 hour of inactivity'
      });
    }

    return thread;
  } catch (error) {
    console.error('Error creating thread:', error);
    return null;
  }
}

/**
 * Check if a message is in a thread
 * @param {Message} message - The message to check
 * @returns {boolean} - True if message is in a thread
 */
export function isInThread(message) {
  return message.channel.isThread();
}

/**
 * Get thread information
 * @param {Message} message - Message in a thread
 * @returns {Object|null} - Thread info or null
 */
export function getThreadInfo(message) {
  if (!isInThread(message)) return null;
  
  const thread = message.channel;
  return {
    id: thread.id,
    name: thread.name,
    parentChannelId: thread.parentId,
    memberCount: thread.memberCount,
    messageCount: thread.totalMessageSent,
    archived: thread.archived,
    locked: thread.locked,
    createdAt: thread.createdAt
  };
}

/**
 * Auto-create thread for long conversations
 * @param {Message} message - The current message
 * @param {Object} conversationEntry - The conversation data from convoStore
 * @returns {Promise<ThreadChannel|null>} - Created thread or null
 */
export async function autoCreateThreadForConversation(message, conversationEntry) {
  // Don't create thread if already in one
  if (isInThread(message)) return null;
  
  // Create thread after certain number of exchanges
  const messageThreshold = 6; // 3 exchanges (user + bot + user + bot + user + bot)
  
  if (conversationEntry.messageCount >= messageThreshold && !conversationEntry.threadCreated) {
    const topicHint = await generateTopicHint(conversationEntry.history);
    const thread = await createConversationThread(message, topicHint);
    
    if (thread) {
      conversationEntry.threadCreated = true;
      conversationEntry.threadId = thread.id;
      
      // Mark as bot-managed for auto-responses
      const userId = message.author.id;
      const channelId = message.channel.id;
      markThreadAsBotManaged(thread.id, userId, channelId);
      
      // Send a message to the thread
      await thread.send({
        content: `🧵 **Conversation moved to thread!**\n\nThis chat was getting spicy so I made us a cozy thread. I'll respond to all your messages here automatically!\n\n*Topic: ${topicHint}*\n\n⏰ *Auto-deletes after 1 hour of inactivity.*`
      });
    }
    
    return thread;
  }
  
  return null;
}

/**
 * Generate a topic hint based on conversation history using AI
 * @param {Array} history - Conversation history
 * @returns {Promise<string>} - Topic hint
 */
export async function generateTopicHint(history) {
  try {
    // Get recent non-system messages
    const recentMessages = history
      .filter(msg => msg.role !== 'system')
      .slice(-8) // Last 8 messages for better context
      .map(msg => `${msg.role === 'user' ? 'User' : 'Bot'}: ${msg.content}`)
      .join('\n');
    
    if (!recentMessages.trim()) {
      return 'General chat';
    }

    // Use AI to generate a concise topic name
    const response = await xAI.chat.completions.create({
      model: "grok-3-mini-beta",
      messages: [
        { 
          role: "system", 
          content: "Generate a very short, catchy thread name (2-4 words max) based on this conversation. Focus on the main topic being discussed. Be concise and descriptive. Examples: 'Python Help', 'Gaming Chat', 'Code Review', 'Music Discussion'. Just return the topic name, nothing else."
        },
        { 
          role: "user", 
          content: `Conversation:\n${recentMessages}\n\nGenerate a short topic name for this conversation:` 
        }
      ],
      max_tokens: 20,
      temperature: 0.3,
    });

    const topic = response.choices[0].message.content.trim()
      .replace(/['"]/g, '') // Remove quotes
      .substring(0, 50); // Limit length

    return topic || 'General chat';
  } catch (error) {
    console.error('Error generating AI topic hint:', error);
    
    // Fallback to simple keyword extraction
    try {
      const recentMessages = history
        .filter(msg => msg.role !== 'system')
        .slice(-6)
        .map(msg => msg.content)
        .join(' ');
      
      const words = recentMessages.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3)
        .filter(word => !['that', 'this', 'with', 'from', 'they', 'them', 'have', 'been', 'were', 'said', 'what', 'when', 'where', 'will', 'would', 'could', 'should'].includes(word));
      
      const wordCount = {};
      words.forEach(word => {
        wordCount[word] = (wordCount[word] || 0) + 1;
      });
      
      const topWords = Object.entries(wordCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([word]) => word);
      
      if (topWords.length > 0) {
        return `${topWords.join(' & ')} chat`;
      }
      
      return 'General chat';
    } catch (fallbackError) {
      console.error('Error in fallback topic generation:', fallbackError);
      return 'Conversation';
    }
  }
}

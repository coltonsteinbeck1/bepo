import cp from "child_process";
import fs from "fs";
import path from "path";
import url from "url";
import { AttachmentBuilder } from "discord.js";
import { randomizeReaction } from "../../scripts/create-context.js";
import { getAllImagesFromMessage, analyzeImageWithVision } from "./imageUtils.js";
import dotenv from "dotenv";
dotenv.config();

export const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

export const COMMAND_DIR_PATH = path.join(__dirname, "..", "commands");

export const DALLE_DIR_PATH = path.join(__dirname, "..", "dalle");

export const IMAGE_PATH = path.join(__dirname, "images/image.png")

const CHILLIN_CHANNEL = process.env.CHILLIN_CHANNEL;
const JIGGLING_CAT_GIF_PATH = path.join(__dirname, "..", "images", "jigglingCat.gif");
const loveEmojis = ["🥰", "😍", "😘", "❤", "💖", "💕", "😻"];
const dislikeEmojis = ["😒", "🙄", "😕", "😠", "👎", "😡", "😤", "😣"];
const prayEmojis = ["🙏", "🛐", "✝️", "☪️", "📿"];
const probability = 0.18;
const sillyProbability = 0.001; // 1/1000 chance

// Initialize Supabase and get the bot token and prefix, and emojis
const BOT_PREFIX = process.env.PREFIX;

export const convoStore = new Map();
export const botThreadStore = new Map(); // Store for tracking bot-created threads
export const memoryContextCache = new Map(); // Cache for memory contexts to reduce DB queries
export const threadContextCache = new Map(); // Cache for thread contexts to avoid DB queries
export const EXPIRATION_MS = 1000 * 60 * 30;
export const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL
export const THREAD_CACHE_TTL = 2 * 60 * 1000; // 2 minutes cache TTL for threads

// Clean up expired memory context cache entries
export function cleanupMemoryCache() {
  const now = Date.now();
  let cleanedCount = 0;
  for (const [key, value] of memoryContextCache.entries()) {
    if (now - value.timestamp > MEMORY_CACHE_TTL) {
      memoryContextCache.delete(key);
      cleanedCount++;
    }
  }

  // Also cleanup thread cache
  if (global.threadCache) {
    let threadCleanedCount = 0;
    for (const [key, value] of global.threadCache.entries()) {
      if (now - value.timestamp > THREAD_CACHE_TTL) {
        global.threadCache.delete(key);
        threadCleanedCount++;
      }
    }
    cleanedCount += threadCleanedCount;
  }

  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} expired cache entries`);
  }
}

export const loadJSON = (path) =>
  JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));

export const isJSFile = (file) => file.match(/^.*\.(cjs|mjs|js)$/);

export const runScript = (
  scriptPath,
  args = undefined,
  exitCallback = undefined,
) => {
  const res = cp.fork(scriptPath, args);

  res.on("data", (err) => {
    console.error(err);
  });

  if (exitCallback) {
    res.on("exit", (code) => {
      if (code === 0) {
        exitCallback();
      }
    });
  }
};

export const runGenerate = (prompt, exitCallback = undefined) => {
  runScript(path.join(DALLE_DIR_PATH, "generate.js"), [prompt], exitCallback);
};

export const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export const loadConfig = () => {
  return loadJSON(path.join(__dirname, "..", "config.json"));
};
export function isGroupPing(message) {
  return message.content.includes('@everyone') || message.content.includes('@here');
}

export function isBotMessageOrPrefix(message, BOT_PREFIX, validCommands = null) {
  if (message.author.bot) {
    return true;
  }

  if (!BOT_PREFIX || !message.content.startsWith(BOT_PREFIX)) {
    return false;
  }

  // If the message is just the prefix repeated (like ////) or only ASCII art, don't treat as command
  const contentAfterPrefix = message.content.substring(BOT_PREFIX.length);

  // Check if it's ASCII art first
  if (looksLikeAsciiArt(message.content)) {
    return false;
  }

  // Check if it's just repeated prefix characters
  const isJustPrefixRepeat = contentAfterPrefix.split('').every(char => char === BOT_PREFIX);
  if (isJustPrefixRepeat) {
    return false;
  }

  // Extract the potential command name (first word after prefix)
  const potentialCommand = contentAfterPrefix.trim().split(/\s+/)[0].toLowerCase();

  // If it looks like a command attempt (starts with /) but isn't a valid command
  // and is longer than a reasonable command length, treat it as regular text
  if (potentialCommand.length > 20) {
    console.log(`[COMMAND FILTER] Ignoring long potential command: "${potentialCommand.substring(0, 30)}..."`);
    return false;
  }

  // Use dynamic command collection if provided, otherwise fall back to static list
  let commandList;
  if (validCommands && validCommands.has) {
    // Convert Discord.js Collection to array for includes() check
    commandList = Array.from(validCommands.keys());
  } else {
    // Fallback static list for backwards compatibility
    commandList = [
      'play', 'poll', 'draw', 'ping', 'maprotation', 'cs2', 'cs2notify',
      'minecraftserver', 'rolesupport', 'reset', 'cs2prices', 'continue',
      'review', 'memory', 'updatememory', 'servermemory', 'updateservermemory',
      'digest', 'thread', 'yap', 'stopyap', 'markov', 'gif', 'jigglin',
      'debug-memory', 'health', 'apex', 'apexnotify'
    ];
  }

  // If it's a valid command, allow it through
  if (commandList.includes(potentialCommand)) {
    return true;
  }

  // For short text after prefix that isn't a valid command, still allow it
  // (this maintains compatibility for short conversational messages like "/test")
  const hasAlphanumeric = /[a-zA-Z0-9]/.test(contentAfterPrefix);
  const isShortText = contentAfterPrefix.trim().length <= 10;

  return hasAlphanumeric && isShortText;
}

export function isBotMentioned(message, client) {
  // Safeguard against null/undefined values
  if (!message || !client || !client.user) {
    return false;
  }

  // Check for direct bot mention
  if (message.mentions && message.mentions.users && message.mentions.users.has(client.user.id)) {
    return true;
  }

  // Check for role mention (HOMONCULUS role) - only if the role exists and message has role mentions
  if (process.env.HOMONCULUS && message.mentions && message.mentions.roles && message.mentions.roles.has(process.env.HOMONCULUS)) {
    return true;
  }

  // Additional safety check: ensure we're not detecting false positives from embeds or system messages
  if (message.system || message.type !== 0) { // Type 0 is DEFAULT message type
    return false;
  }

  return false;
}

export async function sendTypingIndicator(message) {
  // Send initial typing immediately
  await message.channel.sendTyping();

  // Continue sending typing every 8 seconds (reduced from 15 for more responsive feel)
  // Discord typing indicators last ~10 seconds, so 8 seconds ensures continuous indication
  return setInterval(async () => {
    try {
      await message.channel.sendTyping();
    } catch (error) {
      // Silently handle typing errors (channel might be deleted, etc.)
      console.log('Typing indicator error (non-critical):', error.message);
    }
  }, 8000);
}

export function processPreviousMessages(previousMessages) {
  return previousMessages.map((msg) => {
    const username = msg.author.username
      .replace(/\s+/g, "_")
      .replace(/[^\w\s]/gi, "");
    return { username, content: msg.content };
  });
}

export async function buildConversationContext(message, chatContext) {
  let conversation = [];
  if (message.guild.id === process.env.GUILD_BZ || message.guild.id === process.env.GUILD_HOME) {
    conversation.push({ role: "system", content: process.env.MODEL_SYSTEM_MESSAGE });
    chatContext.forEach((msg) => {
      if (msg.content === null) return;
      conversation.push({ role: msg.role, content: msg.content });
    });
  } else {
    conversation.push({ role: "system", content: process.env.DEFAULT_SYSTEM_MESSAGE });
  }
  return conversation;
}

export function generateThreadId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export async function buildStreamlinedConversationContext(message) {
  // Use thread parent channel for conversation key if in a thread
  const channelId = message.channel.isThread() ? message.channel.parentId : message.channelId;
  const key = `${channelId}:${message.author.id}`;

  // Import OPTIMIZED buildMemoryContext to avoid circular imports
  const { buildMemoryContextOptimized } = await import('../supabase/supabase.js');

  const serverId = message.guild?.id;

  if (!convoStore.has(key)) {
    // Use optimized memory context builder (has built-in caching)
    // No need for manual caching anymore - optimization handles it
    const memoryContext = await buildMemoryContextOptimized(
      message.author.id, 
      message.content, 
      serverId, 
      message.client
    );
    
    console.log(`Built memory context for ${key} (${memoryContext.length} chars)`);

    // Combine system message with memory context and current date/time
    const systemMsg = process.env.MODEL_SYSTEM_MESSAGE;
    
    // Add current date and time for temporal accuracy
    const now = new Date();
    const dateString = now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'America/New_York'
    });
    const timeString = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
      timeZoneName: 'short'
    });
    const dateTimeContext = `\n\n--- Current Date & Time ---\nToday is ${dateString}\nCurrent time: ${timeString}\n--- End DateTime ---`;
    
    let finalSystemMessage = systemMsg + dateTimeContext;
    if (memoryContext.trim()) {
      finalSystemMessage += `\n\n--- Memory & Context ---\n${memoryContext}\n--- End Memory ---`;
    }

    console.log(`Creating new conversation with memory context (${memoryContext.length} chars) for ${key}`);

    convoStore.set(key, {
      history: [{ role: "system", content: finalSystemMessage }],
      timer: setTimeout(() => convoStore.delete(key), EXPIRATION_MS),
      startTime: new Date(),
      threadId: generateThreadId(),
      messageCount: 0,
      isInThread: message.channel.isThread(),
      actualThreadId: message.channel.isThread() ? message.channel.id : null,
      lastMemoryRefresh: new Date(),
    });
  } else {
    // reset the timer on activity
    clearTimeout(convoStore.get(key).timer);
    convoStore.get(key).timer = setTimeout(() => convoStore.delete(key), EXPIRATION_MS);

    // Update thread status if we moved to/from a thread
    const entry = convoStore.get(key);
    entry.isInThread = message.channel.isThread();
    if (message.channel.isThread()) {
      entry.actualThreadId = message.channel.id;
    }

    // Refresh memory context less frequently to reduce DB load (every 10 minutes or every 15 messages)
    const now = new Date();
    const timeSinceRefresh = now - (entry.lastMemoryRefresh || entry.startTime);
    const shouldRefresh = timeSinceRefresh > 10 * 60 * 1000 || // 10 minutes (increased from 2)
      entry.messageCount % 15 === 0; // every 15 messages (increased from 5)

    if (shouldRefresh) {
      console.log(`Refreshing memory context for ${key} (time: ${Math.floor(timeSinceRefresh / 1000)}s, messages: ${entry.messageCount})`);

      // Import OPTIMIZED buildMemoryContext
      const { buildMemoryContextOptimized } = await import('../supabase/supabase.js');
      let memoryContext = '';
      // Use optimized memory context builder (has built-in caching)
      memoryContext = await buildMemoryContextOptimized(
        message.author.id, 
        message.content, 
        serverId, 
        message.client
      );
      
      console.log(`Refreshed memory context for ${key}`);

      // Update the system message with fresh context
      const systemMsg = process.env.MODEL_SYSTEM_MESSAGE;
      let finalSystemMessage = systemMsg;
      if (memoryContext.trim()) {
        finalSystemMessage += `\n\n--- Memory & Context ---\n${memoryContext}\n--- End Memory ---`;
      }

      // Update the system message in the conversation history
      entry.history[0] = { role: "system", content: finalSystemMessage };
      entry.lastMemoryRefresh = now;

      console.log(`Updated system message with memory context (${memoryContext.length} chars)`);
    }

    // Increment message count
    entry.messageCount++;
  }
  return convoStore.get(key).history;
}

export async function processMessageWithImages(message) {
  // Check if message has images
  const imageData = await getAllImagesFromMessage(message);

  return {
    hasImages: imageData.imageUrls.length > 0,
    processedContent: message.content,
    imageUrls: imageData.imageUrls,
    hasGifs: imageData.hasGifs
  };
}

export async function appendToConversation(message, role, content) {
  // Use thread parent channel for conversation key if in a thread
  const channelId = message.channel.isThread() ? message.channel.parentId : message.channelId;
  const key = `${channelId}:${message.author.id}`;
  const entry = convoStore.get(key);
  if (!entry) return;

  entry.history.push({
    role,
    content,
    timestamp: new Date(),
    messageId: message.id
  });

  entry.messageCount = (entry.messageCount || 0) + 1;

  // Trim conversation history if it gets too long (keep system message + last 10 exchanges)
  if (entry.history.length > 21) { // 1 system + 20 messages (10 exchanges)
    const systemMessage = entry.history[0];
    entry.history = [systemMessage, ...entry.history.slice(-20)];
  }
}

export async function getReferencedMessageContext(message) {
  if (!message.reference) return null;

  try {
    const referencedMessage = await message.fetchReference();
    if (!referencedMessage) return null;

    return {
      author: referencedMessage.author.username,
      content: referencedMessage.content,
      timestamp: referencedMessage.createdTimestamp,
      isBot: referencedMessage.author.bot
    };
  } catch (error) {
    console.error("Error fetching referenced message:", error);
    return null;
  }
}

// Function to detect ASCII art and prevent unwanted reactions
export function looksLikeAsciiArt(content) {
  // Skip empty or very short messages
  if (!content || content.trim().length < 3) {
    return false;
  }

  // Count special characters commonly used in ASCII art
  const specialChars = content.match(/[^\w\s]/g) || [];
  const totalChars = content.length;
  const specialCharRatio = specialChars.length / totalChars;

  // Check for common ASCII art patterns
  const hasRepeatingSlashes = /[\/\\]{2,}/.test(content);
  const hasSlashPatterns = /[\/\\]/.test(content) && content.length < 50; // Single slashes in short messages
  const hasBoxDrawing = /[─│┌┐└┘├┤┬┴┼]/.test(content);
  const hasSymbolCombos = /[_\-=+|<>(){}[\]~`^*#@$%&]/.test(content) && specialCharRatio > 0.2;
  const hasHighSpecialCharRatio = specialCharRatio > 0.3; // 30% or more special chars

  // Check for typical ASCII art line patterns
  const hasAsciiLines = /^[\s\/\\|_\-=+*#@$%&^~`(){}\[\]<>]*$/m.test(content);

  // Very short messages with slashes are likely ASCII art
  const isShortWithSlashes = content.length <= 20 && /[\/\\]/.test(content);

  // Consider it ASCII art if it matches any of these patterns
  return hasRepeatingSlashes || hasSlashPatterns || hasBoxDrawing || hasSymbolCombos ||
    hasAsciiLines || isShortWithSlashes ||
    (content.length > 20 && hasHighSpecialCharRatio);
}

export async function memeFilter(message) {
  // Skip reactions for ASCII art
  if (looksLikeAsciiArt(message.content)) {
    return;
  }

  const randomLoveEmoji = loveEmojis[Math.floor(Math.random() * loveEmojis.length)];
  const randomDislikeEmoji = dislikeEmojis[Math.floor(Math.random() * loveEmojis.length)];
  const randomPrayerEmoji = prayEmojis[Math.floor(Math.random() * prayEmojis.length)];

  // Silly reaction - 1/250 chance on any message (using custom lickinglips emoji)
  if (!message.author.bot && Math.random() < sillyProbability) {
    setTimeout(async () => {
      try {
        // Try to find the custom lickinglips emoji
        const lickingLipsEmoji = message.client.emojis.cache.find(emoji => emoji.name === 'lickinglips');

        if (lickingLipsEmoji) {
          // Use the custom emoji
          await message.react(lickingLipsEmoji);
        } else {
          // Fallback to Unicode emoji
          await message.react("😋");
        }
      } catch (error) {
        // Final fallback
        try {
          await message.react("😋");
        } catch (fallbackError) {
          // Silent failure - emoji reactions are not critical
        }
      }
    }, Math.random() * 3000 + 1000); // Random delay between 1-4 seconds
  }

  if (message.content.toLowerCase().includes("pex") && !message.author.bot) {
    setTimeout(async () => {
      if (await randomizeReaction(probability)) {
        message.react(randomLoveEmoji);
      }
    }, 2500);
  }

  if (
    (message.content.toLowerCase().includes("allah") ||
      message.content.toLowerCase().includes("jesus") ||
      message.content.toLowerCase().includes("prayge")) &&
    !message.author.bot
  ) {
    setTimeout(async () => {
      if (await randomizeReaction(probability)) {
        message.react(randomPrayerEmoji);
      }
    }, 2500);
  }

  if (
    (/\bOW\b/i.test(message.content) ||
      message.content.toLowerCase().includes("overwatch") ||
      message.content.toLowerCase().includes("valorant")) &&
    !message.author.bot
  ) {
    setTimeout(async () => {
      if (await randomizeReaction(probability)) {
        message.react(randomDislikeEmoji);
      }
    }, 2500);
  }
}
// Scheduled messaging configuration
export const lastSentMessages = {
  gameTime: null,
  sundayImage: null
};

// Function to check if it's time for game time message (8:30 PM EST, Monday-Friday)
export function isGameTime() {
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = easternTime.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  const hour = easternTime.getHours();
  const minute = easternTime.getMinutes();

  // Monday-Friday (1-5), 8:30 PM (20:30) - check for minute 30
  return day >= 1 && day <= 5 && hour === 20 && minute === 30;
}

// Function to check if it's time for Sunday image (5:00 PM EST, Sunday)
export function isSundayImageTime() {
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = easternTime.getDay(); // 0 = Sunday
  const hour = easternTime.getHours();
  const minute = easternTime.getMinutes();

  // Sunday (0), 5:00-5:04 PM (17:00-17:04) - 5 minute window for reliability
  return day === 0 && hour === 17 && minute >= 0 && minute <= 4;
}

// Function to get current date string for tracking
export function getCurrentDateString() {
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return easternTime.toDateString();
}

// Function to send game time message
export async function sendGameTimeMessage(client) {
  try {
    const channel = await client.channels.fetch(CHILLIN_CHANNEL);
    if (channel) {
      const attachment = new AttachmentBuilder(JIGGLING_CAT_GIF_PATH);
      await channel.send({
        content: "It's game time!!! 🚂🚂🚂",
        files: [attachment]
      });
      console.log("Sent game time message with jiggling cat gif");
    } else {
      console.error(`Channel not found: ${CHILLIN_CHANNEL}`);
    }
  } catch (error) {
    console.error("Error sending game time message:", error);
  }
}

// Function to send Sunday image
export async function sendSundayImage(client) {
  try {
    console.log(`[${new Date().toISOString()}] Attempting to send Sunday image`);
    const channel = await client.channels.fetch(CHILLIN_CHANNEL);
    if (channel) {
      const imagePath = path.join(__dirname, "..", "images", "sunday.jpeg");
      const attachment = new AttachmentBuilder(imagePath);
      await channel.send({ files: [attachment] });
      console.log(`[${new Date().toISOString()}] Successfully sent Sunday image`);
    } else {
      console.error(`[${new Date().toISOString()}] Channel not found: ${CHILLIN_CHANNEL}`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error sending Sunday image:`, error);
  }
}

// Function to mark a thread as bot-managed (responds without @)
export function markThreadAsBotManaged(threadId, userId, channelId) {
  botThreadStore.set(threadId, {
    userId,
    channelId,
    createdAt: Date.now(),
    lastActivity: Date.now() // Track last activity for auto-deletion
  });
  console.log(`Marked thread ${threadId} as bot-managed for user ${userId}`);
}

// Function to update thread activity timestamp
export function updateThreadActivity(threadId) {
  const threadInfo = botThreadStore.get(threadId);
  if (threadInfo) {
    threadInfo.lastActivity = Date.now();
    botThreadStore.set(threadId, threadInfo);
  }
}

// Function to check if a thread is bot-managed
export function isBotManagedThread(threadId) {
  return botThreadStore.has(threadId);
}

// Function to get bot-managed thread info
export function getBotManagedThreadInfo(threadId) {
  return botThreadStore.get(threadId);
}

// Function to clean up old bot-managed threads (call periodically)
export function cleanupOldBotThreads() {
  const now = Date.now();
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

  for (const [threadId, info] of botThreadStore.entries()) {
    if (now - info.createdAt > maxAge) {
      botThreadStore.delete(threadId);
      console.log(`Cleaned up old bot-managed thread: ${threadId}`);
    }
  }
}

// Function to check and delete inactive threads (1 hour)
export async function checkAndDeleteInactiveThreads(client) {
  const now = Date.now();
  const inactivityThreshold = 1 * 60 * 60 * 1000; // 1 hour in milliseconds

  for (const [threadId, info] of botThreadStore.entries()) {
    const timeSinceLastActivity = now - info.lastActivity;

    if (timeSinceLastActivity > inactivityThreshold) {
      try {
        // Fetch the thread
        const thread = await client.channels.fetch(threadId);

        if (thread && thread.isThread()) {
          // Send a final message before deletion
          await thread.send("🧵 This thread has been inactive for 1 hour and will be automatically deleted. Thanks for chatting! ✨");

          // Wait a moment then delete the thread
          setTimeout(async () => {
            try {
              await thread.delete('Auto-deletion due to 1 hour of inactivity');
              console.log(`Auto-deleted inactive thread: ${threadId}`);
            } catch (deleteError) {
              console.error(`Error deleting thread ${threadId}:`, deleteError);
            }
          }, 5000); // 5 second delay

          // Remove from our tracking
          botThreadStore.delete(threadId);
        } else {
          // Thread doesn't exist anymore, remove from tracking
          botThreadStore.delete(threadId);
        }
      } catch (error) {
        console.error(`Error checking thread ${threadId}:`, error);
        // If we can't fetch it, it probably doesn't exist anymore
        botThreadStore.delete(threadId);
      }
    }
  }
}

// Function to validate and recover thread tracking
export async function validateBotManagedThread(client, threadId, userId, channelId) {
  try {
    const thread = await client.channels.fetch(threadId);

    if (!thread || !thread.isThread()) {
      // Thread doesn't exist anymore
      botThreadStore.delete(threadId);
      return { exists: false, thread: null };
    }

    if (thread.archived) {
      // Thread is archived, but still exists
      return { exists: true, thread, archived: true };
    }

    // Ensure it's properly tracked
    if (!isBotManagedThread(threadId)) {
      markThreadAsBotManaged(threadId, userId, channelId);
      console.log(`Restored tracking for thread ${threadId} after validation`);
    }

    return { exists: true, thread, archived: false };
  } catch (error) {
    console.error(`Error validating thread ${threadId}:`, error);
    // If we can't fetch it, assume it doesn't exist
    botThreadStore.delete(threadId);
    return { exists: false, thread: null };
  }
}

// Function to find user's existing bot-managed threads in a channel
export async function findUserBotThreadsInChannel(client, userId, channelId) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return [];
    }

    const threadManager = channel.threads;
    const activeThreads = await threadManager.fetchActive();
    const archivedThreads = await threadManager.fetchArchived();

    const userThreads = [];

    // Check active threads
    for (const [threadId, thread] of activeThreads.threads) {
      const threadInfo = getBotManagedThreadInfo(threadId);
      if (threadInfo && threadInfo.userId === userId && threadInfo.channelId === channelId) {
        userThreads.push({ thread, info: threadInfo, archived: false });
      }
    }

    // Check recently archived threads (in case they were just archived)
    for (const [threadId, thread] of archivedThreads.threads) {
      const threadInfo = getBotManagedThreadInfo(threadId);
      if (threadInfo && threadInfo.userId === userId && threadInfo.channelId === channelId) {
        userThreads.push({ thread, info: threadInfo, archived: true });
      }
    }

    return userThreads;
  } catch (error) {
    console.error(`Error finding user threads in channel ${channelId}:`, error);
    return [];
  }
}

// Function to cleanup stale thread references
export function cleanupStaleThreadReferences() {
  const staleThreads = [];

  for (const [threadId, info] of botThreadStore.entries()) {
    // Mark threads older than 24 hours as potentially stale for validation
    const ageInHours = (Date.now() - info.createdAt) / (1000 * 60 * 60);
    if (ageInHours > 24) {
      staleThreads.push(threadId);
    }
  }

  return staleThreads;
}

// Helper function to resolve user ID to username
export async function getUsernameFromId(client, userId) {
  try {
    const user = await client.users.fetch(userId);
    return user.username;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return `User(${userId.substring(0, 8)})`;
  }
}

// Helper function to resolve multiple user IDs to usernames in bulk
export async function getUsernamesFromIds(client, userIds) {
  const usernames = {};

  for (const userId of userIds) {
    try {
      const user = await client.users.fetch(userId);
      usernames[userId] = user.username;
    } catch (error) {
      console.error(`Failed to fetch user ${userId}:`, error);
      usernames[userId] = `User(${userId.substring(0, 8)})`;
    }
  }

  return usernames;
}

// Helper function to clean Discord mentions from text and replace with usernames
export async function cleanDiscordMentions(text, client) {
  if (!client || !text) return text;

  // Regex to find Discord user mentions <@123456789>
  const mentionRegex = /<@!?(\d+)>/g;
  let cleanedText = text;

  try {
    const matches = text.match(mentionRegex);
    if (matches) {
      // Get unique user IDs from mentions
      const userIds = [...new Set(matches.map(match => {
        const idMatch = match.match(/\d+/);
        return idMatch ? idMatch[0] : null;
      }).filter(Boolean))];

      // Resolve user IDs to usernames
      const usernames = await getUsernamesFromIds(client, userIds);

      // Replace each mention with the username
      cleanedText = cleanedText.replace(mentionRegex, (match) => {
        const idMatch = match.match(/\d+/);
        if (idMatch) {
          const userId = idMatch[0];
          const username = usernames[userId];
          if (username) {
            // Check if the text around the mention already has @ symbol
            const mentionStart = cleanedText.indexOf(match);
            const charBefore = mentionStart > 0 ? cleanedText[mentionStart - 1] : '';

            // Only add @ if there isn't one already
            if (charBefore === '@') {
              return username; // Don't add another @
            } else {
              return `@${username}`; // Add @ prefix
            }
          }
          return match; // Keep original if username not found
        }
        return match;
      });
    }

    // Clean up any double @ symbols that might have been created
    cleanedText = cleanedText.replace(/@@+/g, '@');

  } catch (error) {
    console.error('Error cleaning Discord mentions:', error);
    // Return original text if cleaning fails
    return text;
  }

  return cleanedText;
}
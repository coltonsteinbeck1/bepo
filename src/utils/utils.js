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
const loveEmojis = ["🥰", "😍", "😘", "❤", "💖", "💕", "😻"];
const dislikeEmojis = ["😒", "🙄", "😕", "😠", "👎", "😡", "😤", "😣"];
const prayEmojis = ["🙏", "🛐", "✝️", "☪️", "📿"];
const probability = 0.18;
const sillyProbability = 0.004; // 1/250 chance

// Initialize Supabase and get the bot token and prefix, and emojis
const BOT_PREFIX = process.env.PREFIX;

export const convoStore = new Map();
export const botThreadStore = new Map(); // Store for tracking bot-created threads
export const EXPIRATION_MS = 1000 * 60 * 30;

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

export function isBotMessageOrPrefix(message) {
  return message.author.bot || message.content.startsWith(BOT_PREFIX);
}

export function isBotMentioned(message, client) {
  return message.mentions.has(client.user.id);
}

export async function sendTypingIndicator(message) {
  await message.channel.sendTyping();
  return setInterval(async () => {
    await message.channel.sendTyping();
  }, 15000);
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
  
  // Import buildMemoryContext here to avoid circular imports
  const { buildMemoryContext } = await import('../supabase/supabase.js');
  
  const serverId = message.guild?.id;
  
  if (!convoStore.has(key)) {
    // Build initial memory context
    const memoryContext = await buildMemoryContext(message.author.id, message.content, serverId);
    
    // Combine system message with memory context
    const systemMsg = process.env.MODEL_SYSTEM_MESSAGE;
    let finalSystemMessage = systemMsg;
    if (memoryContext.trim()) {
      finalSystemMessage += `\n\n--- Memory & Context ---\n${memoryContext}\n--- End Memory ---`;
    }
    
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
    
    // Refresh memory context every 5 minutes or every 10 messages to pick up new server memories
    const now = new Date();
    const timeSinceRefresh = now - (entry.lastMemoryRefresh || entry.startTime);
    const shouldRefresh = timeSinceRefresh > 5 * 60 * 1000 || // 5 minutes
                         entry.messageCount % 10 === 0; // every 10 messages
    
    if (shouldRefresh) {
      console.log(`Refreshing memory context for ${key} (time: ${Math.floor(timeSinceRefresh/1000)}s, messages: ${entry.messageCount})`);
      
      // Build fresh memory context
      const memoryContext = await buildMemoryContext(message.author.id, message.content, serverId);
      
      // Update the system message with fresh context
      const systemMsg = process.env.MODEL_SYSTEM_MESSAGE;
      let finalSystemMessage = systemMsg;
      if (memoryContext.trim()) {
        finalSystemMessage += `\n\n--- Memory & Context ---\n${memoryContext}\n--- End Memory ---`;
      }
      
      // Update the system message in the conversation history
      entry.history[0] = { role: "system", content: finalSystemMessage };
      entry.lastMemoryRefresh = now;
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

export async function memeFilter(message) {
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
    (message.content.includes("OW") ||
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
  const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const day = easternTime.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  const hour = easternTime.getHours();
  const minute = easternTime.getMinutes();
  
  // Monday-Friday (1-5), 8:30 PM (20:30) - check for minute 30
  return day >= 1 && day <= 5 && hour === 20 && minute === 30;
}

// Function to check if it's time for Sunday image (5:00 PM EST, Sunday)
export function isSundayImageTime() {
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const day = easternTime.getDay(); // 0 = Sunday
  const hour = easternTime.getHours();
  const minute = easternTime.getMinutes();
  
  // Sunday (0), 5:00-5:04 PM (17:00-17:04) - 5 minute window for reliability
  return day === 0 && hour === 17 && minute >= 0 && minute <= 4;
}

// Function to get current date string for tracking
export function getCurrentDateString() {
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  return easternTime.toDateString();
}

// Function to send game time message
export async function sendGameTimeMessage(client) {
  try {
    const channel = await client.channels.fetch(CHILLIN_CHANNEL);
    if (channel) {
      await channel.send("It's game time (?) 🚂🚂🚂");
      console.log("Sent game time message");
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
      const imagePath = path.join(__dirname, "images", "sunday.jpeg");
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
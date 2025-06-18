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

// Initialize Supabase and get the bot token and prefix, and emojis
const BOT_PREFIX = process.env.PREFIX;

export const convoStore = new Map();
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

export async function buildStreamlinedConversationContext(message) {
  const key = `${message.channelId}:${message.author.id}`;
  if (!convoStore.has(key)) {
    const systemMsg = process.env.MODEL_SYSTEM_MESSAGE;
    convoStore.set(key, {
      history: [{ role: "system", content: systemMsg }],
      timer: setTimeout(() => convoStore.delete(key), EXPIRATION_MS),
    });
  } else {
    // reset the timer on activity
    clearTimeout(convoStore.get(key).timer);
    convoStore.get(key).timer = setTimeout(() => convoStore.delete(key), EXPIRATION_MS);
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
  const key = `${message.channelId}:${message.author.id}`;
  const entry = convoStore.get(key);
  if (!entry) return;
  entry.history.push({ role, content });
  
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
  
  // Sunday (0), 5:00 PM (17:00) - check for minute 0
  return day === 0 && hour === 17 && minute === 0;
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
    const channel = await client.channels.fetch(CHILLIN_CHANNEL);
    if (channel) {
      const imagePath = path.join(__dirname, "images", "sunday.jpeg");
      const attachment = new AttachmentBuilder(imagePath);
      await channel.send({ files: [attachment] });
      console.log("Sent Sunday image");
    }
  } catch (error) {
    console.error("Error sending Sunday image:", error);
  }
}
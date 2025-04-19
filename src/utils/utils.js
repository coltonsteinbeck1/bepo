import cp from "child_process";
import fs from "fs";
import path from "path";
import url from "url";
import { randomizeReaction } from "../../scripts/create-context.js";
import dotenv from "dotenv";
dotenv.config();

export const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

export const COMMAND_DIR_PATH = path.join(__dirname, "..", "commands");

export const DALLE_DIR_PATH = path.join(__dirname, "..", "dalle");

export const IMAGE_PATH = path.join(__dirname, "images/image.png")

const loveEmojis = ["🥰", "😍", "😘", "❤", "💖", "💕", "😻"];
const dislikeEmojis = ["😒", "🙄", "😕", "😠", "👎", "😡", "😤", "😣"];
const prayEmojis = ["🙏", "🛐", "✝️", "☪️", "📿"];
const probability = 0.18;

// Initialize Supabase and get the bot token and prefix, and emojis
const BOT_PREFIX = process.env.PREFIX;


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

export async function fetchPreviousMessages(message) {
  let previousMessages = await message.channel.messages.fetch({ limit: 10 });
  return previousMessages.reverse().filter((msg) => {
    return !(msg.author.bot && msg.author.id != client.id) && !msg.content.startsWith(BOT_PREFIX);
  });
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
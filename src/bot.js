import {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
} from "@discordjs/voice";
import {
  AttachmentBuilder,
  Client,
  Collection,
  EmbedBuilder,
} from "discord.js";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import { runGenerate, IMAGE_PATH } from "./utils.js";
import ytdl from "ytdl-core";
import drawCommand from "./commands/fun/draw.js";
import playCommand from "./commands/fun/play.js";
import pollCommand from "./commands/fun/poll.js";
import { getAllChannels } from "./supabase/supabase.js";

dotenv.config();

const client = new Client({
  intents: [
    "Guilds",
    "GuildMembers",
    "GuildMessages",
    "MessageContent",
    "GuildVoiceStates",
  ],
});

client.commands = new Collection();
client.commands.set("play", playCommand);
client.commands.set("poll", pollCommand);
client.commands.set("draw", drawCommand);

// OpenAI API key
const openAI = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

// Initialize Supabase and get the bot token and prefix, and emojis
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_PREFIX = process.env.PREFIX;
const loveEmojis = ["🥰", "😍", "😘", "❤"];

client.on("ready", () => {
  console.log(`Bot is ready as: ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`Command not found: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: "There was an error while executing this command!",
      ephemeral: true,
    });
  }
});

client.on("messageCreate", async (message) => {
  //Meme reaction for testing -> For Aaron ❤
  const randomLoveEmoji =
    loveEmojis[Math.floor(Math.random() * loveEmojis.length)];
  if (message.content.toLowerCase().includes("pex".toLowerCase())) {
    message.react(randomLoveEmoji);
  }
  //Doesn't respond on group pings
  if (
    message.content.includes("@everyone") ||
    message.content.includes("@here")
  ) {
    return;
  }

  if (message.author.bot) return;
  if (message.content.startsWith(BOT_PREFIX)) return;
  if (!message.mentions.has(client.user.id)) return;
  await message.channel.sendTyping();

  const sendTypingInterval = setInterval(async () => {
    await message.channel.sendTyping();
  }, 15000);

  let conversation = [];
  conversation.push({
    role: "system",
    content: process.env.MODEL_SYSTEM_MESSAGE,
  });
  let previousMessage = await message.channel.messages.fetch({ limit: 30 });

  previousMessage.reverse().forEach((message) => {
    if (message.author.bot && message.author.id != client.id) return;
    if (message.content.startsWith(BOT_PREFIX)) return;

    const username = message.author.username
      .replace(/\s+/g, "_")
      .replace(/[^\w\s]/gi, "");

    if (message.author.id === client.user.id) {
      conversation.push({
        role: "assistant",
        name: username,
        content: message.content,
      });
    }
  });
  clearInterval(sendTypingInterval);
  const response = await openAI.chat.completions
    .create({
      model: "gpt-4",
      messages: [
        {
          //name
          role: "system",
          content: process.env.MODEL_SYSTEM_MESSAGE,
        },
        {
          //name
          role: "user",
          content: message.content,
        },
      ],
    })
    .catch((error) => {
      message.reply("ERROR on OPENAIs end.");
      console.log("OpenAI Error:\n", error);
    });
  clearInterval(sendTypingInterval);

  if (!response) {
    message.reply("I am struggling rn fr fr. Ask me later");
    return;
  }

  const responseMessage = response.choices[0].message.content;
  const chunkSizeLimit = 2000;

  for (let i = 0; i < responseMessage.length; i += chunkSizeLimit) {
    const chunk = responseMessage.substring(i, i + chunkSizeLimit);
    await message.reply(chunk);
  }
});

client.login(BOT_TOKEN);

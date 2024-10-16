import {
    createAudioPlayer,
    createAudioResource,
    joinVoiceChannel,
} from "@discordjs/voice";
import { AttachmentBuilder, Client, Collection, EmbedBuilder } from "discord.js";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import ytdl from "ytdl-core";
import drawCommand from "./commands/fun/draw.js";
import playCommand from "./commands/fun/play.js";
import pollCommand from "./commands/fun/poll.js";
import pingCommand from "./commands/fun/ping.js";
import { getAllChannels } from "./supabase/supabase.js";
import { getAllContext, randomizeReaction } from "../scripts/create-context.js";
import apexMapCommand from "./commands/fun/apexMap.js";

dotenv.config();




const client = new Client({
  intents: ["Guilds", "GuildMembers", "GuildMessages", "MessageContent", "GuildVoiceStates"],
});

client.commands = new Collection();
client.commands.set("play", playCommand);
client.commands.set("poll", pollCommand);
client.commands.set("draw", drawCommand);
client.commands.set("ping", pingCommand);
client.commands.set('maprotation', apexMapCommand);

// OpenAI API key
const openAI = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

// Initialize Supabase and get the bot token and prefix, and emojis
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_PREFIX = process.env.PREFIX;
const DEFAULT_SYSTEM_MESSAGE = process.env.DEFAULT_SYSTEM_MESSAGE;
const loveEmojis = ["🥰", "😍", "😘", "❤", "💖", "💕", "😻"];
const dislikeEmojis = ["😒", "🙄", "😕", "😠", "👎", "😡", "😤", "😣"];
const prayEmojis = ["🙏", "🛐", "✝️", "☪️","📿"];
const probability = 0.15;

const chatContext = await getAllContext();
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
  //Meme reactions
  const randomLoveEmoji = loveEmojis[Math.floor(Math.random() * loveEmojis.length)];
  const randomDislikeEmoji = dislikeEmojis[Math.floor(Math.random() * dislikeEmojis.length)];
  const randomPrayerEmoji = prayEmojis[Math.floor(Math.random() * prayEmojis.length)];

  if (message.content.toLowerCase().includes("pex".toLowerCase())
    && !message.author.bot) {
    setTimeout(async () => {
      if(await randomizeReaction(probability)){
        message.react(randomLoveEmoji);
      }
    }, 2500);
  }
  if ((message.content.toLowerCase().includes("allah".toLowerCase()) 
      || message.content.toLowerCase().includes("jesus".toLowerCase())
      || message.content.toLowerCase().includes("prayge".toLowerCase()))
      && !message.author.bot) {
      setTimeout(async () => {
        if( await randomizeReaction(probability)){
          message.react(randomPrayerEmoji);
        }
      }, 2500);
    }

    if(((message.content.includes("OW")
      || message.content.toLowerCase().includes("overwatch".toLowerCase())
      || message.content.toLowerCase().includes("valorant".toLowerCase()))
      && !message.author.bot)){
      setTimeout(async () => {
        if(await randomizeReaction(probability)){
          message.react(randomDislikeEmoji);
        }
      }, 2500);
    }
  
  //Doesn't respond on group pings
  if (message.content.includes('@everyone') || message.content.includes('@here')) {
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
  if(message.guild.id === process.env.GUILD_BZ || message.guild.id === process.env.GUILD_HOME){
    chatContext.forEach((message) => {
      if(message.content === null) return;
      conversation.push({role: message.role, content: message.content});
    });
  }else {
    conversation.push({role: "system", content: DEFAULT_SYSTEM_MESSAGE});
  }

  let previousMessage = await message.channel.messages.fetch({ limit: 40 });

  previousMessage.reverse().forEach((message) => {
    if (message.author.bot && message.author.id != client.id) return;
    if (message.content.startsWith(BOT_PREFIX)) return;

    const username = message.author.username
      .replace(/\s+/g, "_")
      .replace(/[^\w\s]/gi, "");

    if (message.author.id === client.user.id) {
      conversation.push({
        role: "user",
        name: username,
        content: message.content,
      });
    }
  });
  clearInterval(sendTypingInterval);
  const response = await openAI.chat.completions
      .create({
        model: "gpt-4o-mini",
        messages: [
          //primes the model with the context
          ...conversation,
          //user messages
          { role: "user", content: message.content},
        ],
        temperature: 1.0,
        max_tokens: 500,
        top_p: 1,
        frequency_penalty: 0.5,
        presence_penalty: 0,
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


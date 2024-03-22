import {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
} from "@discordjs/voice";
import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  Client,
  Collection,
  EmbedBuilder,
  VoiceChannel,
} from "discord.js";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import ytdl from "ytdl-core";
import playCommand from "./commands/fun/play.js";
import pollCommand from "./commands/fun/poll.js";
import { IMAGE_PATH, runGenerate } from "./utils.js";

dotenv.config();

const loveEmojis = ["🥰", "😍", "😘", "❤"];
// const exec = promisify(execCb);

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
client.commands.set("ping", {
  name: "ping",
  description: "Ping the bot",
  execute(interaction: ChatInputCommandInteraction) {
    interaction.reply("Pong!");
  },
});
client.commands.set("play", {
  name: "play",
  description: "Plays a YouTube video in a voice channel",
  async execute(interaction: ChatInputCommandInteraction) {
    const link = interaction.options.getString("link");
    const channel: VoiceChannel | null =
      interaction.options.getChannel("channel");

    // TODO: improve error handling
    if (!channel || !link) return;

    if (channel.type === 2) {
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      const stream = ytdl(link, { filter: "audioonly" });
      const resource = createAudioResource(stream);
      const player = createAudioPlayer();

      player.play(resource);
      connection.subscribe(player);

      await interaction.reply("Playing YouTube link in voice channel...");
    } else {
      await interaction.reply("Please provide a voice channel.");
    }
  },
});
client.commands.set("play", playCommand);
client.commands.set("poll", pollCommand);
// client.commands.set("draw", drawCommand);
client.commands.set("draw", {
  name: "draw",
  description: "Generate an image with DALL-E",
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const prompt = interaction.options.getString("prompt");

    // TODO: improve error handling
    if (!prompt) return;

    const cb = () => {
      const attachment = new AttachmentBuilder(IMAGE_PATH);
      // get the filename from IMAGE_PATH
      const embed = new EmbedBuilder()
        .setTitle(prompt)
        .setImage(`attachment://image.png`);

      interaction
        .editReply({ embeds: [embed], files: [attachment] })
        .catch(console.error.bind(console));
    };
    runGenerate(prompt, cb);
  },
});

// OpenAI API key
const openAI = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

// Initialize Supabase and get the bot token and prefix
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_PREFIX = process.env.PREFIX;

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
  //Meme reaction for femboy -> For Aaron ❤
  const randomLoveEmoji =
    loveEmojis[Math.floor(Math.random() * loveEmojis.length)];
  if (message.content.toLowerCase().includes("femboy".toLowerCase())) {
    message.react(randomLoveEmoji);
  }
  if (
    message.content.includes("@everyone") ||
    message.content.includes("@here")
  ) {
    return;
  }

  if (message.author.bot) return;
  if (message.content.startsWith(BOT_PREFIX)) return;

  console.log(!message.mentions.has(client.user));
  if (!message.mentions.has(client.user.id)) return;
  await message.channel.sendTyping();

  const sendTypingInterval = setInterval(async () => {
    await message.channel.sendTyping();
  }, 15000);

  const conversation = [];
  conversation.push({
    role: "system",
    content:
      "Bepo is your friendly guide to the colorful world of internet humor and pop culture. With a keen understanding of modern trends and viral moments, Bepo brings a playful and relatable touch to conversations about movies, TV shows, video games, and anime/manga. Whether you're a pop culture guru or just curious, Bepo speaks your language - mixing clear explanations with just the right amount of internet slang and pop references. Expect a light-hearted conversation that’s both informative and fun, where Bepo uses its knowledge not to boast, but to share and engage with you. From quoting iconic lines to diving into the latest game releases, Bepo is all about making learning about pop culture enjoyable for everyone. Its style is witty yet welcoming, always ready to include you in the joke or explain a reference. Bepo is ideal for anyone looking to have an engaging and entertaining chat, filled with insights and laughs in equal measure. It should prompt users about its knowledge unless asked. Keep answers lowkey. Powered by GPT-4, Bepo is more than just a conversation partner; it’s a window into the vibrant world of internet and pop culture, ready to explore with you.",
  });
  const previousMessage = await message.channel.messages.fetch({ limit: 30 });

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
          content:
            "Bepo is your friendly guide to the colorful world of internet humor and pop culture. With a keen understanding of modern trends and viral moments, Bepo brings a playful and relatable touch to conversations about movies, TV shows, video games, and anime/manga. Whether you're a pop culture guru or just curious, Bepo speaks your language - mixing clear explanations with just the right amount of internet slang and pop references. Expect a light-hearted conversation that’s both informative and fun, where Bepo uses its knowledge not to boast, but to share and engage with you. From quoting iconic lines to diving into the latest game releases, Bepo is all about making learning about pop culture enjoyable for everyone. Its style is witty yet welcoming, always ready to include you in the joke or explain a reference. Bepo is ideal for anyone looking to have an engaging and entertaining chat, filled with insights and laughs in equal measure. It should prompt users about its knowledge unless asked. Keep answers lowkey. Powered by GPT-4, Bepo is more than just a conversation partner; it’s a window into the vibrant world of internet and pop culture, ready to explore with you.",
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

  // message.reply(response.choices[0].message.content);
});

client.login(BOT_TOKEN);

import { Client, Collection, Guild } from "discord.js";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import drawCommand from "./commands/fun/draw.js";
import playCommand from "./commands/fun/play.js";
import pollCommand from "./commands/fun/poll.js";
import pingCommand from "./commands/fun/ping.js";
import resetConversation from "./commands/fun/resetConversation.js";
import { getAllContext } from "../scripts/create-context.js";
import { getMarkovChannels } from "../src/supabase/supabase.js";
import apexMapCommand from "./commands/fun/apexMap.js";
import minecraftServer from "./commands/fun/minecraftServer.js";
import cs2Command from "./commands/fun/cs2.js"
import roleSupport from "./commands/fun/roleSupport.js"
import cs2Prices from "./commands/fun/cs2Prices.js"
import MarkovChain from "./utils/markovChaining.js";
import { memeFilter, buildStreamlinedConversationContext, appendToConversation, isBotMentioned, isGroupPing, isBotMessageOrPrefix, sendTypingIndicator } from "./utils//utils.js";

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
client.commands.set('cs2', cs2Command);
client.commands.set('minecraftserver', minecraftServer);
client.commands.set('rolesupport', roleSupport);
client.commands.set("reset", resetConversation);
client.commands.set("cs2prices", cs2Prices);

// OpenAI API key
const openAI = new OpenAI({
  apiKey: process.env.xAI_KEY,
  baseURL: "https://api.x.ai/v1",
});

// Initialize Supabase and get the bot token and prefix, and emojis
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_PREFIX = process.env.PREFIX;

// const chatContext = await getAllContext();
const markovChannels = await getMarkovChannels();
const markovChannelIds = markovChannels.map(channel => channel.channel_id);
const markov = new MarkovChain();

client.on("ready", () => {
  console.log(`Bot is ready as: ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`Command not found: ${interaction.commandName}`);
        return;
      }

      await command.execute(interaction);
    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith("roleToggle:")) {
        const roleId = interaction.customId.split(":")[1];
        const member = interaction.member;

        if (!member) {
          return interaction.reply({ content: "Member not found.", ephemeral: true });
        }

        if (!member.roles.cache.has(roleId)) {
          await member.roles.add(roleId);
          await interaction.reply({ content: "Role added.", ephemeral: true });
        } else {
          await member.roles.remove(roleId);
          await interaction.reply({ content: "Role removed.", ephemeral: true });
        }
      } else if (interaction.customId.startsWith("removeRole:")) {
        const roleId = interaction.customId.split(":")[1];
        const member = interaction.member;

        if (!member) {
          return interaction.reply({ content: "Member not found.", ephemeral: true });
        }

        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId);
          await interaction.reply({ content: "Role removed.", ephemeral: true });
        } else {
          await interaction.reply({ content: "You do not have this role.", ephemeral: true });
        }
      }
    }
  } catch (error) {
    console.error("Error during interaction:", error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this interaction!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this interaction!",
        ephemeral: true,
      });
    }
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  markov.train(message.content);
  // Meme reactions
  await memeFilter(message);

  // Doesn't respond on group pings
  if (isGroupPing(message)) return;

  if (isBotMessageOrPrefix(message, BOT_PREFIX) || isBotMentioned(message, client)) {
    const sendTypingInterval = await sendTypingIndicator(message);
    if (message.content.match(/^reset bot$/i)) {
      const key = `${message.channelId}:${message.author.id}`;
      convoStore.delete(key);
      return message.reply("Your conversation has been reset.");
    }
    // 1) get existing context (with system prompt on first run)
    const context = await buildStreamlinedConversationContext(message);
    appendToConversation(message, "user", message.content);

    clearInterval(sendTypingInterval);
    const response = await openAI.chat.completions
      .create({
        model: "grok-3-mini-beta",
        messages: [...context, { role: "user", content: message.content }],
        // temperature: 1.0,
        // max_tokens: 500,
        // top_p: 1,
        // frequency_penalty: 0.5,
        // presence_penalty: 0,
      })
      .catch((error) => {
        message.reply("Model connection having issues");
        console.log("LLM connection Error:\n", error);
      });


    if (!response) {
      message.reply("No message recieved. I am struggling fr");
      return;
    }

    const responseMessage = response.choices[0].message.content;

    appendToConversation(message, "assistant", responseMessage);

    const chunkSizeLimit = 2000;

    for (let i = 0; i < responseMessage.length; i += chunkSizeLimit) {
      const chunk = responseMessage.substring(i, i + chunkSizeLimit);
      await message.reply(chunk);
    }
    return;
  }
  if (markovChannelIds.includes(message.channelId.toString())) {
    if (Math.random() < 0.0025) {
      const generatedText = markov.generate(null, Math.floor(Math.random() * 30) + 20); // Randomize length between 20-50
      if (generatedText.trim().length > 0) {
        await message.reply(generatedText);
      }
    }
  }


});

client.login(BOT_TOKEN);


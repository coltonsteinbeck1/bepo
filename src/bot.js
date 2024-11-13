;import {Client, Collection } from "discord.js";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import drawCommand from "./commands/fun/draw.js";
import playCommand from "./commands/fun/play.js";
import pollCommand from "./commands/fun/poll.js";
import pingCommand from "./commands/fun/ping.js";
import { getAllContext} from "../scripts/create-context.js";
import apexMapCommand from "./commands/fun/apexMap.js";
import minecraftServer from "./commands/fun/minecraftServer.js";
import {memeFilter,buildConversationContext,isBotMentioned, isGroupPing,isBotMessageOrPrefix, sendTypingIndicator}from "./utils.js";

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
client.commands.set('minecraftserver', minecraftServer)

// OpenAI API key
const openAI = new OpenAI({
  apiKey: process.env.xAI_KEY,
  baseURL: "https://api.x.ai/v1",
});

// Initialize Supabase and get the bot token and prefix, and emojis
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_PREFIX = process.env.PREFIX;

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
    // Meme reactions
    await memeFilter(message);

    // Doesn't respond on group pings
    if (isGroupPing(message)) return;
  
    if (isBotMessageOrPrefix(message, BOT_PREFIX)) return;
    if (!isBotMentioned(message, client)) return;
  
    const sendTypingInterval = await sendTypingIndicator(message);
  
    let conversation = await buildConversationContext(message, chatContext);
  clearInterval(sendTypingInterval);
  const response = await openAI.chat.completions
      .create({
        model: "grok-beta",
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
        message.reply("Model connection having issues");
        console.log("LLM connection Error:\n", error);
      });

  if (!response) {
    message.reply("No message recieved. I am struggling fr");
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


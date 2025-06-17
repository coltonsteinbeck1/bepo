import { Client, Collection, Guild, AttachmentBuilder } from "discord.js";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import path from "path";
import { fileURLToPath } from "url";
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
import { memeFilter, buildStreamlinedConversationContext, appendToConversation, isBotMentioned, isGroupPing, isBotMessageOrPrefix, sendTypingIndicator, processMessageWithImages, convoStore, getReferencedMessageContext } from "./utils//utils.js";
import { convertImageToBase64, analyzeGifWithFrames } from "./utils/imageUtils.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// OpenAI API key for xAI (Grok)
const xAI = new OpenAI({
  apiKey: process.env.xAI_KEY,
  baseURL: "https://api.x.ai/v1",
});

// OpenAI API for vision capabilities
const openAI = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

// Initialize Supabase and get the bot token and prefix, and emojis
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_PREFIX = process.env.PREFIX;
const CHILLIN_CHANNEL = process.env.CHILLIN_CHANNEL;

// Scheduled messaging configuration
const lastSentMessages = {
  gameTime: null,
  sundayImage: null
};

// Function to check if it's time for game time message (8:30 PM EST, Monday-Friday)
function isGameTime() {
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const day = easternTime.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  const hour = easternTime.getHours();
  const minute = easternTime.getMinutes();
  
  // Monday-Friday (1-5), 8:30 PM (20:30) - check for minute 30
  return day >= 1 && day <= 5 && hour === 20 && minute === 30;
}

// Function to check if it's time for Sunday image (5:00 PM EST, Sunday)
function isSundayImageTime() {
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const day = easternTime.getDay(); // 0 = Sunday
  const hour = easternTime.getHours();
  const minute = easternTime.getMinutes();
  
  // Sunday (0), 5:00 PM (17:00) - check for minute 0
  return day === 0 && hour === 17 && minute === 0;
}

// Function to get current date string for tracking
function getCurrentDateString() {
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  return easternTime.toDateString();
}

// Function to send game time message
async function sendGameTimeMessage(client) {
  try {
    const channel = await client.channels.fetch(CHILLIN_CHANNEL);
    if (channel) {
      await channel.send("The vibe train is departing!! 🚂🚂🚂");
      console.log("Sent game time message");
    }
  } catch (error) {
    console.error("Error sending game time message:", error);
  }
}

async function sendSundayImage(client) {
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

function startScheduledMessaging(client) {
  setInterval(() => {
    const currentDate = getCurrentDateString();
    
    // Check for game time message
    if (isGameTime()) {
      if (lastSentMessages.gameTime !== currentDate) {
        sendGameTimeMessage(client);
        lastSentMessages.gameTime = currentDate;
      }
    }
    
    // Check for Sunday image
    if (isSundayImageTime()) {
      if (lastSentMessages.sundayImage !== currentDate) {
        sendSundayImage(client);
        lastSentMessages.sundayImage = currentDate;
      }
    }
  }, 60000);
}

// Helper function to determine if bot should respond to a reply
async function shouldRespondToReply(message, client) {
  if (!message.reference) return false;
  
  try {
    const referencedMessage = await message.fetchReference();
    
    // Respond if the referenced message is from the bot
    if (referencedMessage.author.id === client.user.id) {
      return true;
    }
    
    // Respond if the referenced message mentioned the bot
    if (referencedMessage.mentions.has(client.user.id)) {
      return true;
    }
    
    // add more conditions here, for example:
    // - Respond to replies in specific channels
    // - Respond to replies to messages containing certain keywords
    // - Respond based on user roles or permissions
    
    return false;
  } catch (error) {
    console.error("Error checking referenced message:", error);
    return false;
  }
}

const markovChannels = await getMarkovChannels();
const markovChannelIds = markovChannels.map(channel => channel.channel_id);
const markov = new MarkovChain();

client.on("ready", () => {
  console.log(`Bot is ready as: ${client.user.tag}`);
  startScheduledMessaging(client);
  console.log("Scheduled messaging started");
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

  // Check if this is a reply to a bot message or if bot should respond
  const shouldRespond = 
    isBotMessageOrPrefix(message, BOT_PREFIX) || 
    isBotMentioned(message, client) ||
    (message.reference && await shouldRespondToReply(message, client));

  if (shouldRespond) {
    const sendTypingInterval = await sendTypingIndicator(message);
    
    if (message.content.match(/^reset bot$/i)) {
      const key = `${message.channelId}:${message.author.id}`;
      convoStore.delete(key);
      clearInterval(sendTypingInterval);
      return message.reply("Your conversation has been reset.");
    }

    // Process message and check for images
    const messageData = await processMessageWithImages(message);
    
    // Build context that includes the referenced message if it exists
    const context = await buildStreamlinedConversationContext(message);
    
    // Add referenced message context if it exists
    if (message.reference) {
      const referencedContext = await getReferencedMessageContext(message);
      if (referencedContext && !referencedContext.isBot) {
        // Add the referenced message as context
        const referenceText = `[Replying to ${referencedContext.author}: "${referencedContext.content}"]`;
        messageData.processedContent = referenceText + "\n" + messageData.processedContent;
      }
    }
    
    let response;
    
    if (messageData.hasImages && messageData.imageUrls.length > 0) {
      // Use OpenAI with vision for image-containing messages
      const visionMessages = [...context];
      
      // Replace the system message with the image-specific one
      visionMessages[0] = { role: "system", content: process.env.IMAGE_SYSTEM_PROMPT };
      
      // Build the user message with image content
      let imagePrompt;
      if (messageData.hasGifs) {
        imagePrompt = message.content || "this is a gif but i can only see the first frame... react to what i can see and acknowledge it's supposed to be animated. keep it real.";
      } else {
        imagePrompt = message.content || "react to this image with your usual chronically online energy. no explanations, just vibes.";
      }
      
      const userMessageContent = [
        {
          type: "text",
          text: imagePrompt
        }
      ];
      
      // Add images to the message
      let processedImages = 0;
      for (const imageUrl of messageData.imageUrls) {
        try {
          // Check if this specific URL is a GIF
          const isGif = imageUrl.toLowerCase().includes('.gif') || 
                       (message.attachments && 
                        Array.from(message.attachments.values()).some(att => 
                          att.url === imageUrl && att.contentType === 'image/gif'));
          
          if (isGif) {
            // For GIFs, use frame extraction for better analysis
            const gifAnalysis = await analyzeGifWithFrames(
              imageUrl, 
              message.content || "analyze this gif animation. react to the movement and sequence.",
              process.env.IMAGE_SYSTEM_PROMPT
            );
            
            if (gifAnalysis) {
              // Store the GIF analysis and skip adding to userMessageContent
              response = {
                choices: [{
                  message: {
                    content: gifAnalysis
                  }
                }]
              };
              processedImages++;
              break; // Process one GIF at a time for now
            } else {
              console.log("GIF frame extraction failed, falling back to single frame");
              // Fall back to single frame processing
              const base64Image = await convertImageToBase64(imageUrl);
              userMessageContent.push({
                type: "image_url",
                image_url: {
                  url: base64Image,
                  detail: "auto"
                }
              });
              processedImages++;
            }
          } else {
            // Regular image processing
            const base64Image = await convertImageToBase64(imageUrl);
            userMessageContent.push({
              type: "image_url",
              image_url: {
                url: base64Image,
                detail: "auto"
              }
            });
            processedImages++;
          }
        } catch (error) {
          console.error("Failed to process image:", error);
          // Skip this image and continue with others
        }
      }
      
      // If no images were successfully processed, fall back to text-only
      if (processedImages === 0) {
        const userContent = messageData.processedContent;
        appendToConversation(message, "user", userContent);
        
        response = await xAI.chat.completions
          .create({
            model: "grok-3-mini-beta",
            messages: [...context, { 
              role: "user", 
              content: userContent
            }],
          })
          .catch((error) => {
            message.reply("Model connection having issues");
            console.log("xAI connection Error:\n", error);
          });
      } else if (!response) {
        // Process with vision model (only if we don't already have a response from GIF processing)
        visionMessages.push({
          role: "user",
          content: userMessageContent
        });
        
        response = await openAI.chat.completions
          .create({
            model: "gpt-4o-mini",
            messages: visionMessages,
            max_tokens: 1000,
          })
          .catch((error) => {
            message.reply("Image model connection having issues");
            console.log("OpenAI Image Error:\n", error);
          });
      }
      
      // Store the processed message in conversation history
      if (response) {
        appendToConversation(message, "user", message.content + " [User shared an image]");
      }
    } else {
      // Use xAI (Grok) for text-only messages
      const userContent = messageData.processedContent;
      appendToConversation(message, "user", userContent);

      response = await xAI.chat.completions
        .create({
          model: "grok-3-mini-beta",
          messages: [...context, { 
            role: "user", 
            content: userContent
          }],
        })
        .catch((error) => {
          message.reply("Model connection having issues");
          console.log("xAI connection Error:\n", error);        });
    }

    clearInterval(sendTypingInterval);

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


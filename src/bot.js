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
import continueCommand from "./commands/fun/continue.js";
import reviewCommand from "./commands/fun/review.js";
import memoryCommand from "./commands/fun/memory.js";
import serverMemoryCommand from "./commands/fun/serverMemory.js";
import updateMemoryCommand from "./commands/fun/updateMemory.js";
import updateServerMemoryCommand from "./commands/fun/updateServerMemory.js";
import digestCommand from "./commands/fun/digest.js";
import threadCommand from "./commands/fun/thread.js";
import debugMemoryCommand from "./commands/fun/debugMemory.js";
import { getAllContext } from "../scripts/create-context.js";
import { getMarkovChannels } from "../src/supabase/supabase.js";
import apexMapCommand from "./commands/fun/apexMap.js";
import minecraftServer from "./commands/fun/minecraftServer.js";
import cs2Command from "./commands/fun/cs2.js"
import roleSupport from "./commands/fun/roleSupport.js"
import cs2Prices from "./commands/fun/cs2Prices.js"
import yapCommand from "./commands/fun/yap.js";
import stopyapCommand from "./commands/fun/stopyap.js";
import MarkovChain from "./utils/markovChaining.js";
import { cleanupExpiredMemories, cleanupOldMemories, storeUserMemory, cleanupExpiredServerMemories } from "./supabase/supabase.js";
import { memeFilter, buildStreamlinedConversationContext, appendToConversation, isBotMentioned, isGroupPing, 
    isBotMessageOrPrefix, sendTypingIndicator, processMessageWithImages, convoStore, isSundayImageTime, getCurrentDateString,
    sendGameTimeMessage, sendSundayImage, lastSentMessages, isGameTime, isBotManagedThread, cleanupOldBotThreads, 
    updateThreadActivity, checkAndDeleteInactiveThreads } from "./utils//utils.js";
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
client.commands.set("continue", continueCommand);
client.commands.set("review", reviewCommand);
client.commands.set("memory", memoryCommand);
client.commands.set("updatememory", updateMemoryCommand);
client.commands.set("servermemory", serverMemoryCommand);
client.commands.set("updateservermemory", updateServerMemoryCommand);
client.commands.set("digest", digestCommand);
client.commands.set("thread", threadCommand);
client.commands.set("yap", yapCommand);
client.commands.set("stopyap",stopyapCommand);
client.commands.set("debug-memory", debugMemoryCommand);


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

// Function to start scheduled messaging
function startScheduledMessaging(client) {
  // Check every minute for scheduled messages
  setInterval(() => {
    const currentDate = getCurrentDateString();
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    
    // Log periodic check (every 10 minutes to avoid spam)
    if (easternTime.getMinutes() % 10 === 0) {
      console.log(`[${now.toISOString()}] Scheduled message check - Eastern Time: ${easternTime}`);
    }
    
    // Check for game time message
    if (isGameTime()) {
      if (lastSentMessages.gameTime !== currentDate) {
        console.log(`[${now.toISOString()}] Triggering game time message`);
        sendGameTimeMessage(client);
        lastSentMessages.gameTime = currentDate;
      }
    }
    
    // Check for Sunday image
    if (isSundayImageTime()) {
      if (lastSentMessages.sundayImage !== currentDate) {
        console.log(`[${now.toISOString()}] Triggering Sunday image - Date: ${currentDate}`);
        sendSundayImage(client);
        lastSentMessages.sundayImage = currentDate;
      } else {
        console.log(`[${now.toISOString()}] Sunday image already sent today: ${currentDate}`);
      }
    }
    
    // Auto digest disabled - use /digest command manually
  }, 60000); // Check every minute
  
  // Clean up old bot-managed threads every hour
  setInterval(() => {
    cleanupOldBotThreads();
  }, 60 * 60 * 1000); // Every hour
  
  // Check for inactive threads to delete every 30 minutes
  setInterval(() => {
    checkAndDeleteInactiveThreads(client);
  }, 30 * 60 * 1000); // Every 30 minutes
}

// const chatContext = await getAllContext();
const markovChannels = await getMarkovChannels();
const markovChannelIds = markovChannels.map(channel => channel.channel_id);
const markov = new MarkovChain();

client.on("ready", () => {
  console.log(`Bot is ready as: ${client.user.tag}`);
  startScheduledMessaging(client);
  console.log("Scheduled messaging started");
  
  // Start memory cleanup task (runs every 6 hours)
  setInterval(async () => {
    try {
      console.log('🧠 Running memory cleanup...');
      const expiredCount = await cleanupExpiredMemories();
      const oldCount = await cleanupOldMemories(90); // Clean up memories older than 90 days
      const expiredServerCount = await cleanupExpiredServerMemories();
      console.log(`🧹 Cleaned up ${expiredCount} expired user memories, ${oldCount} old user memories, and ${expiredServerCount} expired server memories`);
    } catch (error) {
      console.error('Memory cleanup error:', error);
    }
  }, 6 * 60 * 60 * 1000); // Every 6 hours
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

  // Check if message is in a bot-managed thread (auto-respond)
  const isInBotThread = message.channel.isThread() && isBotManagedThread(message.channel.id);
  
  // Update thread activity if message is in a bot-managed thread
  if (isInBotThread) {
    updateThreadActivity(message.channel.id);
  }
  
  if (isBotMessageOrPrefix(message, BOT_PREFIX) || isBotMentioned(message, client) || isInBotThread) {
    const sendTypingInterval = await sendTypingIndicator(message);
    
    if (message.content.match(/^reset bot$/i)) {
      const key = `${message.channelId}:${message.author.id}`;
      convoStore.delete(key);
      clearInterval(sendTypingInterval);
      return message.reply("Your conversation has been reset.");
    }

    // Process message and check for images
    const messageData = await processMessageWithImages(message);
    
    // 1) get existing context (with system prompt on first run)
    const context = await buildStreamlinedConversationContext(message);
    
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
    
    // Store memory after successful conversation
    try {
      // Store the user's message as memory
      await storeUserMemory(
        message.author.id,
        `User said: "${message.content}" in ${message.channel.name || 'DM'}`,
        'conversation',
        {
          channel_id: message.channel.id,
          guild_id: message.guild?.id,
          timestamp: new Date().toISOString()
        }
      );
      
      // Store interesting parts of the bot's response as memory
      if (responseMessage.length > 50) {
        await storeUserMemory(
          message.author.id,
          `Bot responded: "${responseMessage.substring(0, 200)}${responseMessage.length > 200 ? '...' : ''}"`,
          'conversation',
          {
            channel_id: message.channel.id,
            guild_id: message.guild?.id,
            timestamp: new Date().toISOString(),
            response_length: responseMessage.length
          }
        );
      }
    } catch (memoryError) {
      console.error('Error storing memory:', memoryError);
      // Don't fail the response if memory storage fails
    }

    // Auto-thread creation disabled - threads can be created manually if needed

    const chunkSizeLimit = 2000;

    for (let i = 0; i < responseMessage.length; i += chunkSizeLimit) {
      const chunk = responseMessage.substring(i, i + chunkSizeLimit);
      await message.reply(chunk);
    }
    
    // Update thread activity after bot responds (if in bot-managed thread)
    if (isInBotThread) {
      updateThreadActivity(message.channel.id);
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


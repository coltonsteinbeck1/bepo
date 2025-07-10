import { Client, Collection, Guild, AttachmentBuilder, MessageFlags } from "discord.js";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import path from "path";
import { fileURLToPath } from "url";
import drawCommand from "./commands/fun/draw.js";
import playCommand, { handleMusicInteraction } from "./commands/fun/play.js";
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
import healthCommand from "./commands/fun/health.js";
import { getAllContext } from "../scripts/create-context.js";
import { getMarkovChannels } from "../src/supabase/supabase.js";
import apexMapCommand from "./commands/fun/apexMap.js";
import apexCommand from "./commands/fun/apex.js";
import apexNotifyCommand from "./commands/fun/apexnotify.js";
import minecraftServer from "./commands/fun/minecraftServer.js";
import cs2Command from "./commands/fun/cs2.js"
import cs2NotifyCommand from "./commands/fun/cs2notify.js"
import roleSupport from "./commands/fun/roleSupport.js"
import cs2Prices from "./commands/fun/cs2Prices.js"
import yapCommand from "./commands/fun/yap.js";
import stopyapCommand from "./commands/fun/stopyap.js";
import markovCommand from "./commands/fun/markov.js";
import MarkovChain from "./utils/markovChaining.js";
import { MarkovPersistence } from "./utils/markovPersistence.js";
import { cleanupExpiredMemories, cleanupOldMemories, storeUserMemory, cleanupExpiredServerMemories } from "./supabase/supabase.js";
import {
  memeFilter, buildStreamlinedConversationContext, appendToConversation, isBotMentioned, isGroupPing,
  isBotMessageOrPrefix, sendTypingIndicator, processMessageWithImages, convoStore, isSundayImageTime, getCurrentDateString,
  sendGameTimeMessage, sendSundayImage, lastSentMessages, isGameTime, isBotManagedThread, cleanupOldBotThreads,
  updateThreadActivity, checkAndDeleteInactiveThreads, validateBotManagedThread, cleanupStaleThreadReferences,
  getBotManagedThreadInfo
} from "./utils//utils.js";
import { convertImageToBase64, analyzeGifWithFrames } from "./utils/imageUtils.js";
import errorHandler, { safeAsync, handleDiscordError, handleDatabaseError, handleAIError, createRetryWrapper } from "./utils/errorHandler.js";
import healthMonitor from "./utils/healthMonitor.js";
import { getStatusChecker } from "./utils/statusChecker.js";
import { initializeCS2Monitoring } from "./utils/cs2NotificationService.js";
import { initializeApexMonitoring } from "./utils/apexNotificationService.js";
// Import the new unified monitoring service
import UnifiedMonitoringService from '../scripts/monitor-service.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: ["Guilds", "GuildMembers", "GuildMessages", "MessageContent", "GuildVoiceStates"],
});

// Enhanced error handling for Discord client
client.on('error', (error) => {
  console.error('❌ Discord Client Error:', error);
  handleDiscordError(error, null, 'client');
});

client.on('warn', (warning) => {
  console.warn('⚠️ Discord Client Warning:', warning);
});

client.on('debug', (info) => {
  // Only log critical debug info to reduce noise
  if (info.includes('Session') && info.includes('READY')) {
    console.log('🔍 Discord Session Ready');
  }
});

client.on('shardError', (error, shardId) => {
  console.error(`❌ Shard ${shardId} Error:`, error);
  handleDiscordError(error, null, `shard_${shardId}`);
});

client.on('shardDisconnect', (event, shardId) => {
  console.warn(`🔌 Shard ${shardId} Disconnected:`, event);
});

client.on('disconnect', () => {
  console.log('🔌 Discord client disconnected');
});

client.on('shardReconnecting', (shardId) => {
  // Reduced logging - only log if multiple reconnections
});

// Add graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT (Ctrl+C), shutting down gracefully...');
  await gracefulShutdown();
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  await gracefulShutdown();
});

process.on('SHUTDOWN', async () => {
  console.log('🛑 Received SHUTDOWN signal, shutting down gracefully...');
  await gracefulShutdown();
});

async function gracefulShutdown() {
  try {
    console.log('🛑 Bot shutting down gracefully...');

    // Update bot status to offline before shutting down
    const statusChecker = getStatusChecker();
    if (statusChecker) {
      await safeAsync(async () => {
        await statusChecker.updateBotStatus({
          isOnline: false,
          status: "OFFLINE",
          lastSeen: new Date().toISOString(),
          uptime: 0,
          startTime: null
        });
        console.log('📊 Bot status updated to offline');
      }, (error) => {
        console.error('❌ Failed to update bot status on shutdown:', error);
      }, 'status_update_shutdown');
    }

    // Save markov chain before shutdown
    console.log('💾 Saving markov chain...');
    await safeAsync(async () => {
      await markovPersistence.saveChain(markov);
      console.log('📁 Markov chain saved successfully');
    }, (error) => {
      console.error('❌ Failed to save markov chain on shutdown:', error);
    }, 'markov_save_shutdown');

    // Set Discord presence to invisible/offline before destroying
    console.log('🔄 Setting Discord presence to offline...');
    if (client && client.user && client.readyState === 'READY') {
      try {
        await client.user.setPresence({
          status: 'invisible',
          activities: []
        });
        console.log('👻 Discord presence set to invisible');

        // Give Discord a moment to register the status change
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (presenceError) {
        console.error('❌ Failed to set presence:', presenceError);
      }
    }

    // Stop scheduled tasks
    console.log('⏹️ Stopping scheduled tasks...');

    // Cleanup voice connections
    console.log('🎵 Cleaning up voice connections...');
    // This will be handled by individual command cleanup

    // Close database connections
    console.log('🗄️ Closing database connections...');
    // Supabase client will handle this automatically

    // Destroy Discord client
    console.log('🤖 Destroying Discord client...');
    if (client && client.readyState !== 'DESTROYED') {
      try {
        await client.destroy();
        console.log('💥 Discord client destroyed');
      } catch (destroyError) {
        console.error('❌ Error destroying client:', destroyError);
      }
    }

    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (shutdownError) {
    console.error('❌ Error during graceful shutdown:', shutdownError);
    process.exit(1);
  }
}

// Generate status message for offline notifications that matches webhook data
function generateStatusMessage(statusReport) {
  // Handle both old and new status report formats
  const isOnline = statusReport.summary?.operational || statusReport.botStatus?.isOnline || false;
  const statusEmoji = isOnline ? '🟢' : '🔴';
  const statusText = isOnline ? 'ONLINE' : 'OFFLINE';
  
  if (isOnline) {
    // Extract health data for online status
    const healthData = statusReport.health || {};
    const discordData = statusReport.discord || {};
    const botStatus = statusReport.botStatus || {};
    
    let message = `${statusEmoji} **Bepo Status: ${statusText}**\n`;
    message += `✅ All systems operational\n`;
    
    if (botStatus.uptime) {
      const uptime = formatUptime(botStatus.uptime);
      message += `⏱️ Uptime: ${uptime}\n`;
    }
    
    if (healthData.memoryUsage) {
      const memMB = Math.round((healthData.memoryUsage.used / 1024 / 1024) * 100) / 100;
      message += `💾 Memory: ${memMB} MB\n`;
    }
    
    if (discordData.connected) {
      message += `🌐 Discord: Connected (${discordData.guilds || 0} guilds, ${discordData.users || 0} users)\n`;
    }
    
    if (healthData.errorCount !== undefined) {
      message += `🐛 Errors: ${healthData.errorCount}`;
    }
    
    return message;
  } else {
    // Extract offline data - use same timestamp source as webhook
    let lastSeen = 'Unknown';
    
    if (statusReport.botStatus?.lastSeen) {
      lastSeen = `<t:${Math.floor(new Date(statusReport.botStatus.lastSeen).getTime() / 1000)}:R>`;
    } else if (statusReport.bot?.lastSeen) {
      lastSeen = `<t:${Math.floor(new Date(statusReport.bot.lastSeen).getTime() / 1000)}:R>`;
    }
    
    let reason = 'Bot process not detected';
    if (statusReport.botStatus?.reason) {
      reason = statusReport.botStatus.reason;
    } else if (statusReport.bot?.reason) {
      reason = statusReport.bot.reason;
    }
    
    return `${statusEmoji} **Bepo Status: ${statusText}**\n` +
           `🕒 Last seen: ${lastSeen}\n` +
           `❓ Reason: ${reason}\n` +
           `\n*Bepo may be temporarily unavailable. Please try again later.*`;
  }
}

// Helper function to format uptime (matches monitoring service)
function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

client.commands = new Collection();
client.commands.set("play", playCommand);
client.commands.set("poll", pollCommand);
client.commands.set("draw", drawCommand);
client.commands.set("ping", pingCommand);
client.commands.set('maprotation', apexMapCommand);
client.commands.set('cs2', cs2Command);
client.commands.set('cs2notify', cs2NotifyCommand);
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
client.commands.set("stopyap", stopyapCommand);
client.commands.set("markov", markovCommand);
client.commands.set("debug-memory", debugMemoryCommand);
client.commands.set("health", healthCommand);
client.commands.set("apex", apexCommand);
client.commands.set("apexnotify", apexNotifyCommand);



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
    const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));

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

  // Validate and cleanup stale thread references every 2 hours
  setInterval(async () => {
    await safeAsync(async () => {
      console.log('🧵 Validating bot-managed threads...');
      const staleThreads = cleanupStaleThreadReferences();
      let validatedCount = 0;
      let cleanedCount = 0;

      for (const threadId of staleThreads) {
        const threadInfo = getBotManagedThreadInfo(threadId);
        if (threadInfo) {
          const validation = await validateBotManagedThread(
            client,
            threadId,
            threadInfo.userId,
            threadInfo.channelId
          );

          if (validation.exists) {
            validatedCount++;
          } else {
            cleanedCount++;
          }
        }
      }

      if (validatedCount > 0 || cleanedCount > 0) {
        console.log(`🧹 Thread validation complete: ${validatedCount} validated, ${cleanedCount} cleaned up`);
      }
    }, (error) => {
      console.error('Thread validation error - will retry next cycle:', error);
    }, 'thread_validation_cleanup');
  }, 2 * 60 * 60 * 1000); // Every 2 hours

  // Auto-save markov chain every 30 minutes
  setInterval(async () => {
    await safeAsync(async () => {
      await markovPersistence.saveChain(markov);
    }, (error) => {
      console.error('Markov chain auto-save error - will retry next cycle:', error);
    }, 'markov_auto_save');
  }, 30 * 60 * 1000); // Every 30 minutes
}

// const chatContext = await getAllContext();
const markovChannels = await getMarkovChannels();
const markovChannelIds = markovChannels.map(channel => channel.channel_id);
const markov = new MarkovChain(3); // Lower order for more creative output in chat context
const markovPersistence = new MarkovPersistence();

// Load existing markov chain data
await markovPersistence.loadChain(markov);

// Make markov instance available to commands
client.markov = markov;

client.on("ready", async () => {
  console.log(`Bot is ready as: ${client.user.tag}`);

  // Update bot status to online
  const statusChecker = getStatusChecker();
  if (statusChecker) {
    await safeAsync(async () => {
      await statusChecker.updateBotStatus({
        isOnline: true,
        status: "ONLINE",
        lastSeen: new Date().toISOString(),
        uptime: 0,
        startTime: new Date().toISOString()
      });
      console.log('📊 Bot status updated to online');
    }, (error) => {
      console.error('❌ Failed to update bot status on startup:', error);
    }, 'status_update_startup');
  }

  // Initialize health monitoring with Discord client
  healthMonitor.setDiscordClient(client);
  console.log(`🏥 Health monitoring started`);

  // Initialize Unified Monitoring Service - this replaces the old offline notification system
  try {
    const unifiedMonitor = new UnifiedMonitoringService();
    // Store the monitor instance on the client for access elsewhere
    client.unifiedMonitor = unifiedMonitor;
    console.log('🔍 Unified monitoring service initialized');
  } catch (error) {
    console.error('❌ Failed to initialize unified monitoring service:', error);
  }

  startScheduledMessaging(client);
  console.log("Scheduled messaging started");

  // Initialize CS2 patch note monitoring
  await initializeCS2Monitoring(client);

  // Initialize Apex Legends patch note monitoring
  await initializeApexMonitoring(client);

  // Start memory cleanup task (runs every 6 hours)
  setInterval(async () => {
    await safeAsync(async () => {
      console.log('🧠 Running memory cleanup...');
      const expiredCount = await cleanupExpiredMemories();
      const oldCount = await cleanupOldMemories(90); // Clean up memories older than 90 days
      const expiredServerCount = await cleanupExpiredServerMemories();
      console.log(`🧹 Cleaned up ${expiredCount} expired user memories, ${oldCount} old user memories, and ${expiredServerCount} expired server memories`);
    }, (error) => {
      handleDatabaseError(error, 'memory_cleanup');
      console.error('Memory cleanup error - will retry next cycle:', error);
    }, 'memory_cleanup');
  }, 6 * 60 * 60 * 1000); // Every 6 hours

  // Auto-save markov chain every 30 minutes
  setInterval(async () => {
    await safeAsync(async () => {
      await markovPersistence.saveChain(markov);
    }, (error) => {
      console.error('Markov chain auto-save error - will retry next cycle:', error);
    }, 'markov_auto_save');
  }, 30 * 60 * 1000); // Every 30 minutes
});

client.on("interactionCreate", async (interaction) => {
  const retryWrapper = createRetryWrapper(2, 1000); // 2 retries with 1 second base delay

  await safeAsync(async () => {
    if (interaction.isCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`Command not found: ${interaction.commandName}`);
        if (!interaction.replied) {
          await interaction.reply({
            content: '❌ Command not found or temporarily unavailable.',
            flags: MessageFlags.Ephemeral
          });
        }
        return;
      }

      // Execute command with retry wrapper for transient failures
      await retryWrapper(async () => {
        await command.execute(interaction);
      }, `command_${interaction.commandName}`);

    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith("music_")) {
        // Handle music control buttons with retry
        await retryWrapper(async () => {
          await handleMusicInteraction(interaction);
        }, 'music_interaction');
      } else if (interaction.customId.startsWith("roleToggle:")) {
        const roleId = interaction.customId.split(":")[1];
        const member = interaction.member;

        if (!member) {
          return interaction.reply({ content: "Member not found.", flags: MessageFlags.Ephemeral });
        }

        await safeAsync(async () => {
          if (!member.roles.cache.has(roleId)) {
            await member.roles.add(roleId);
            await interaction.reply({ content: "Role added.", flags: MessageFlags.Ephemeral });
          } else {
            await member.roles.remove(roleId);
            await interaction.reply({ content: "Role removed.", flags: MessageFlags.Ephemeral });
          }
        }, async (error) => {
          console.error('Role toggle error:', error);
          if (!interaction.replied) {
            await interaction.reply({
              content: "❌ Failed to toggle role. I might not have the required permissions.",
              flags: MessageFlags.Ephemeral
            });
          }
        }, 'role_toggle');

      } else if (interaction.customId.startsWith("removeRole:")) {
        const roleId = interaction.customId.split(":")[1];
        const member = interaction.member;

        if (!member) {
          return interaction.reply({ content: "Member not found.", flags: MessageFlags.Ephemeral });
        }

        await safeAsync(async () => {
          if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId);
            await interaction.reply({ content: "Role removed.", flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: "You do not have this role.", flags: MessageFlags.Ephemeral });
          }
        }, async (error) => {
          console.error('Role remove error:', error);
          if (!interaction.replied) {
            await interaction.reply({
              content: "❌ Failed to remove role. I might not have the required permissions.",
              flags: MessageFlags.Ephemeral
            });
          }
        }, 'role_remove');
      }
    }
  }, async (error) => {
    // Global interaction error fallback
    console.error("Error during interaction:", error);
    const isDiscordError = handleDiscordError(error, interaction, 'interaction');

    // Try to respond to the user if we haven't already
    const errorMessage = isDiscordError && error.code === 50013
      ? "❌ I don't have the required permissions to perform this action."
      : "❌ Something went wrong while processing your request. Please try again.";

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: errorMessage,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: errorMessage,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (replyError) {
      console.error('Failed to send error reply:', replyError);
    }
  }, 'interaction_handler');
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  
  // Only train on messages that have some substance (longer than 10 characters)
  // and filter out commands and mentions to improve training quality
  if (message.content.length > 10 && 
      !message.content.startsWith(BOT_PREFIX) && 
      !message.mentions.users.has(client.user.id)) {
    markov.train(message.content);
  }
  
  // Meme reactions
  await memeFilter(message);

  // Doesn't respond on group pings
  if (isGroupPing(message)) return;

  // Check if message is in a bot-managed thread (auto-respond)
  const isInBotThread = message.channel.isThread() && isBotManagedThread(message.channel.id);

  // If message is in a thread but not tracked, check if it should be tracked
  if (message.channel.isThread() && !isInBotThread) {
    // Check if this might be a thread we created but lost tracking for
    const threadInfo = await safeAsync(async () => {
      return await validateBotManagedThread(
        client,
        message.channel.id,
        message.author.id,
        message.channel.parentId
      );
    }, null, 'thread_validation');

    if (threadInfo && threadInfo.exists && !threadInfo.archived) {
      console.log(`Recovered tracking for thread ${message.channel.id} after name change or restart`);
    }
  }

  // Update thread activity if message is in a bot-managed thread
  if (isInBotThread) {
    updateThreadActivity(message.channel.id);
  }

  // Check if bot was mentioned and respond with status if needed
  if (isBotMentioned(message, client) && !isBotMessageOrPrefix(message, BOT_PREFIX) && !isInBotThread) {
    // Check current bot health status
    const statusChecker = getStatusChecker();
    const currentStatus = await safeAsync(async () => {
      return await statusChecker.getBotStatus();
    }, null, 'status_check_on_mention');

    // Only send status message if bot is actually offline/unhealthy AND this is a status request
    const messageContent = message.content.toLowerCase();
    const isStatusRequest = messageContent.includes('status') ||
      messageContent.includes('health') ||
      messageContent.includes('/health') ||
      messageContent.includes('ping') ||
      messageContent.includes('online');

    // Only respond with status if explicitly requested or if bot is genuinely offline
    if (isStatusRequest && currentStatus && (!currentStatus.summary.operational || currentStatus.bot.reason)) {
      const statusMessage = generateStatusMessage(currentStatus);
      await safeAsync(async () => {
        await message.reply(statusMessage);
      }, null, 'offline_status_reply');
      return; // Don't process further if sending status message
    }
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
        response = await safeAsync(async () => {
          return await xAI.chat.completions.create({
            model: "grok-3-mini-beta",
            messages: [...context, {
              role: "user",
              content: userContent
            }],
          });
        }, async (error) => {
          const aiErrorResult = handleAIError(error, 'xai');
          console.log("xAI connection Error:", error);

          if (aiErrorResult.retry) {
            // For retryable errors, return null so the retry can happen
            return null;
          } else {
            // For non-retryable errors, send user message and return null
            await safeAsync(async () => {
              await message.reply("Model connection having issues - please try again in a moment");
            }, null, 'ai_error_reply');
            return null;
          }
        }, 'xai_api_call');
      } else if (!response) {
        // Process with vision model (only if we don't already have a response from GIF processing)
        visionMessages.push({
          role: "user",
          content: userMessageContent
        });

        response = await safeAsync(async () => {
          return await openAI.chat.completions.create({
            model: "gpt-4o-mini",
            messages: visionMessages,
            max_tokens: 1000,
          });
        }, async (error) => {
          const aiErrorResult = handleAIError(error, 'openai');
          console.log("OpenAI Image Error:", error);

          await safeAsync(async () => {
            await message.reply("Image model connection having issues - please try again in a moment");
          }, null, 'vision_error_reply');
          return null;
        }, 'openai_vision_call');
      }

      // Store the processed message in conversation history
      if (response) {
        appendToConversation(message, "user", message.content + " [User shared an image]");
      }
    } else {
      // Use xAI (Grok) for text-only messages
      const userContent = messageData.processedContent;
      appendToConversation(message, "user", userContent);

      response = await safeAsync(async () => {
        return await xAI.chat.completions.create({
          model: "grok-3-mini-beta",
          messages: [...context, {
            role: "user",
            content: userContent
          }],
        });
      }, async (error) => {
        const aiErrorResult = handleAIError(error, 'xai');
        console.log("xAI connection Error:", error);

        await safeAsync(async () => {
          await message.reply("Model connection having issues - please try again in a moment");
        }, null, 'ai_error_reply');
        return null;
      }, 'xai_fallback_call');
    }

    clearInterval(sendTypingInterval);

    if (!response) {
      message.reply("No message recieved. I am struggling fr");
      return;
    }

    const responseMessage = response.choices[0].message.content;

    appendToConversation(message, "assistant", responseMessage);

    // Store memory after successful conversation
    await safeAsync(async () => {
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
    }, (error) => {
      handleDatabaseError(error, 'memory_storage');
      // Don't fail the response if memory storage fails - this is graceful degradation
      return null;
    }, 'memory_storage');

    // Auto-thread creation disabled - threads can be created manually if needed

    const chunkSizeLimit = 2000;

    for (let i = 0; i < responseMessage.length; i += chunkSizeLimit) {
      const chunk = responseMessage.substring(i, i + chunkSizeLimit);
      await safeAsync(async () => {
        await message.reply(chunk);
      }, async (error) => {
        console.error('Failed to send message chunk:', error);
        handleDiscordError(error, null, 'message_reply');

        // Try to send a shorter error message instead
        if (i === 0) { // Only send error on first chunk to avoid spam
          await safeAsync(async () => {
            await message.reply("❌ I encountered an error while sending my response. Please try again.");
          }, null, 'error_reply_fallback');
        }
      }, `message_reply_chunk_${i}`);
    }

    // Update thread activity after bot responds (if in bot-managed thread)
    if (isInBotThread) {
      updateThreadActivity(message.channel.id);
    }

    return;
  }
  if (markovChannelIds.includes(message.channelId.toString())) {
    if (Math.random() < 0.0033) {
      // Use enhanced generation with coherence mode enabled
      const targetLength = Math.floor(Math.random() * 40) + 30; // 30-70 words for better sentences
      const generatedText = markov.generate(null, targetLength, true); // Enable coherence mode
      
      if (generatedText.trim().length > 20) { // Ensure minimum quality threshold
        await safeAsync(async () => {
          await message.reply(generatedText);
        }, (error) => {
          console.error('Failed to send markov message:', error);
        }, 'markov_message_send');
      }
    }
  }


});

client.login(BOT_TOKEN);


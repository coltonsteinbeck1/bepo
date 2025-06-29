/**
 * Digest Utilities
 * Handles server activity analysis and AI-powered digest generation
 */
import { ChannelType } from "discord.js";
import { OpenAI } from "openai";
import { safeAsync } from "./errorHandler.js";
import dotenv from "dotenv";
dotenv.config();

const xAI = new OpenAI({
  apiKey: process.env.xAI_KEY,
  baseURL: "https://api.x.ai/v1",
});

/**
 * Digest Management Operations
 */
export class DigestManager {
  /**
   * Calculate time range for digest period
   */
  static getTimeRange(period) {
    const now = new Date();
    let startTime;
    let timeLabel;
    
    switch(period) {
      case 'daily':
        startTime = new Date(now - 24 * 60 * 60 * 1000);
        timeLabel = "past 24 hours";
        break;
      case 'weekly':
        startTime = new Date(now - 7 * 24 * 60 * 60 * 1000);
        timeLabel = "past week";
        break;
      case '12h':
        startTime = new Date(now - 12 * 60 * 60 * 1000);
        timeLabel = "past 12 hours";
        break;
      case '1h':
        startTime = new Date(now - 60 * 60 * 1000);
        timeLabel = "past hour";
        break;
      default:
        startTime = new Date(now - 24 * 60 * 60 * 1000);
        timeLabel = "past 24 hours";
    }

    return { startTime, timeLabel };
  }

  /**
   * Get readable channels from guild
   */
  static getReadableChannels(guild) {
    // Filter for text-based channels only
    const allChannels = guild.channels.cache.filter(ch => {
      return ch.type === ChannelType.GuildText || 
             ch.type === ChannelType.GuildAnnouncement ||
             ch.type === ChannelType.PublicThread ||
             ch.type === ChannelType.PrivateThread ||
             ch.type === ChannelType.AnnouncementThread;
    });
    
    // Filter channels the bot can actually read from
    const readableChannels = allChannels.filter(channel => {
      const permissions = channel.permissionsFor(guild.members.me);
      return permissions && 
             permissions.has('ViewChannel') && 
             permissions.has('ReadMessageHistory');
    });

    return readableChannels;
  }

  /**
   * Collect server activity data
   */
  static async collectServerActivity(guild, startTime, period) {
    return await safeAsync(async () => {
      const readableChannels = this.getReadableChannels(guild);
      
      if (readableChannels.size === 0) {
        return {
          success: false,
          error: "No readable channels found. Bot needs Read Message History permission."
        };
      }

      let recentMessages = [];
      let messageCount = 0;
      let activeUsers = new Set();
      let channelActivity = new Map();
      
      // Limit channels to avoid rate limits
      const maxChannels = period === 'weekly' ? 8 : 5;
      const channelsToCheck = Array.from(readableChannels.values()).slice(0, maxChannels);
      
      for (const channel of channelsToCheck) {
        try {
          const channelMessages = await this.collectChannelMessages(channel, startTime, period);
          
          messageCount += channelMessages.length;
          channelActivity.set(channel.name, channelMessages.length);
          
          // Process messages for analysis
          for (const msg of channelMessages) {
            activeUsers.add(msg.author.id);
            
            // Collect interesting messages for highlights
            if (msg.content.length > 20 && msg.content.length < 200) {
              recentMessages.push({
                content: msg.content,
                author: msg.author.username,
                channel: msg.channel.name,
                timestamp: msg.createdTimestamp
              });
            }
          }
          
        } catch (error) {
          console.error(`Error collecting messages from ${channel.name}:`, error);
          // Continue with other channels
        }
      }

      return {
        success: true,
        data: {
          recentMessages: recentMessages.slice(0, 50), // Limit for AI processing
          messageCount,
          activeUsers: activeUsers.size,
          channelActivity,
          channelsAnalyzed: channelsToCheck.length,
          totalChannels: readableChannels.size
        }
      };
    }, { success: false, error: 'Failed to collect server activity' }, 'digest_collect_activity');
  }

  /**
   * Collect messages from a specific channel
   */
  static async collectChannelMessages(channel, startTime, period) {
    let allRelevantMessages = [];
    let lastMessageId = null;
    let fetchAttempts = 0;
    const maxAttempts = period === 'weekly' ? 6 : period === 'daily' ? 4 : 2;
    
    while (fetchAttempts < maxAttempts) {
      const fetchOptions = { 
        limit: 100,
        ...(lastMessageId && { before: lastMessageId })
      };
      
      const messageBatch = await channel.messages.fetch(fetchOptions);
      if (messageBatch.size === 0) break;
      
      const oldestMessage = messageBatch.last();
      
      // Filter this batch by time
      const timeFilteredBatch = messageBatch.filter(msg => 
        msg.createdTimestamp > startTime.getTime() && !msg.author.bot
      );
      
      if (timeFilteredBatch.size > 0) {
        allRelevantMessages.push(...timeFilteredBatch.values());
      }
      
      // Stop if we've gone past our time window
      if (oldestMessage.createdTimestamp <= startTime.getTime()) {
        break;
      }
      
      lastMessageId = oldestMessage.id;
      fetchAttempts++;
      
      // Small delay to respect rate limits
      if (fetchAttempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }
    
    return allRelevantMessages;
  }

  /**
   * Generate AI digest from collected data
   */
  static async generateDigest(activityData, guild, timeLabel, includeStats) {
    return await safeAsync(async () => {
      const { recentMessages, messageCount, activeUsers, channelActivity } = activityData.data;
      
      if (messageCount === 0) {
        return {
          success: true,
          digest: {
            title: `📊 ${guild.name} Digest - ${timeLabel}`,
            summary: `No activity found in the ${timeLabel}. The server has been quiet! 🤫`,
            stats: includeStats ? this.formatStats(activityData.data) : null
          }
        };
      }

      // Prepare message sample for AI
      const messageSample = recentMessages
        .sort(() => 0.5 - Math.random())
        .slice(0, 20)
        .map(msg => `${msg.author} in #${msg.channel}: ${msg.content}`)
        .join('\n');

      const prompt = `Analyze this Discord server activity from ${timeLabel} and create a fun, engaging digest:

Server: ${guild.name}
Messages analyzed: ${messageCount}
Active users: ${activeUsers}

Sample messages:
${messageSample}

Create a digest that includes:
1. A fun summary of the main topics/themes discussed
2. Any interesting quotes or memorable moments (keep them appropriate)
3. General activity level and mood
4. Brief mention of most active channels

Keep it conversational, positive, and under 1000 characters. Use emojis sparingly. Don't mention specific usernames unless highlighting particularly clever or funny quotes.`;

      let aiSummary;
      try {
        const response = await xAI.chat.completions.create({
          model: "grok-2-1212", // Updated model name
          messages: [{ role: "user", content: prompt }],
          max_tokens: 300,
          temperature: 0.7,
        });

        aiSummary = response.choices[0]?.message?.content || "Unable to generate AI summary";
      } catch (aiError) {
        console.error('AI generation failed, using fallback:', aiError.message);
        // Fallback to simple summary if AI fails
        aiSummary = `Server activity summary for ${timeLabel}:\n\n` +
          `📈 **${messageCount} messages** were posted by **${activeUsers} users**.\n\n` +
          `${channelActivity.size > 0 ? 
            `Most active channels: ${Array.from(channelActivity.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([channel, count]) => `#${channel} (${count})`)
              .join(', ')}` 
            : 'Activity was spread across various channels.'}\n\n` +
          `The server ${messageCount > 50 ? 'was quite active' : messageCount > 10 ? 'had moderate activity' : 'was relatively quiet'} during this period.`;
      }

      return {
        success: true,
        digest: {
          title: `📊 ${guild.name} Digest - ${timeLabel}`,
          summary: aiSummary,
          stats: includeStats ? this.formatStats(activityData.data) : null
        }
      };
    }, { success: false, error: 'Failed to generate digest' }, 'digest_generate');
  }

  /**
   * Format activity statistics
   */
  static formatStats(data) {
    const { messageCount, activeUsers, channelActivity, channelsAnalyzed, totalChannels } = data;
    
    let statsText = `**📈 Activity Statistics:**\n`;
    statsText += `• **Messages:** ${messageCount}\n`;
    statsText += `• **Active Users:** ${activeUsers}\n`;
    statsText += `• **Channels Analyzed:** ${channelsAnalyzed}/${totalChannels}\n\n`;
    
    if (channelActivity.size > 0) {
      const sortedChannels = Array.from(channelActivity.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      statsText += `**🔥 Most Active Channels:**\n`;
      for (const [channel, count] of sortedChannels) {
        if (count > 0) {
          statsText += `• #${channel}: ${count} messages\n`;
        }
      }
    }
    
    return statsText;
  }
}

/**
 * Digest utilities and helpers
 */
export const DigestUtils = {
  /**
   * Validate digest period
   */
  isValidPeriod(period) {
    const validPeriods = ['daily', 'weekly', '12h', '1h'];
    return validPeriods.includes(period);
  },

  /**
   * Get period description
   */
  getPeriodDescription(period) {
    const descriptions = {
      'daily': 'Daily server activity summary',
      'weekly': 'Weekly server activity roundup',
      '12h': 'Last 12 hours activity summary',
      '1h': 'Last hour activity summary'
    };
    return descriptions[period] || 'Server activity summary';
  },

  /**
   * Check if guild has sufficient permissions
   */
  validateGuildPermissions(guild) {
    const botMember = guild.members.me;
    if (!botMember) {
      return { valid: false, error: 'Bot not found in guild' };
    }
    
    if (!botMember.permissions.has('ReadMessageHistory')) {
      return { valid: false, error: 'Bot lacks Read Message History permission' };
    }
    
    return { valid: true };
  }
};

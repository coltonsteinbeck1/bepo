import { SlashCommandBuilder, EmbedBuilder, ChannelType } from "discord.js";
import { OpenAI } from "openai";
import dotenv from "dotenv";
dotenv.config();

const xAI = new OpenAI({
  apiKey: process.env.xAI_KEY,
  baseURL: "https://api.x.ai/v1",
});

const digestCommand = {
    data: new SlashCommandBuilder()
        .setName("digest")
        .setDescription("Generate a server activity digest")
        .addStringOption(option =>
            option
                .setName("period")
                .setDescription("Time period for the digest")
                .setRequired(false)
                .addChoices(
                    { name: "Daily", value: "daily" },
                    { name: "Weekly", value: "weekly" },
                    { name: "Last 12 hours", value: "12h" },
                    { name: "Last hour", value: "1h" }
                )
        )
        .addBooleanOption(option =>
            option
                .setName("include_stats")
                .setDescription("Include detailed server statistics")
                .setRequired(false)
        ),
    async execute(interaction) {
        await interaction.deferReply();
        
        const period = interaction.options.getString('period') || 'daily';
        const includeStats = interaction.options.getBoolean('include_stats') || false;
        
        try {
            // Calculate time range
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

            // Collect server data
            const guild = interaction.guild;
            
            // Filter for text-based channels only (exclude voice channels, categories, etc.)
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

            if (readableChannels.size === 0) {
                await interaction.editReply("⚠️ I don't have permission to read message history in any channels. Please give me the **Read Message History** permission in channels you want me to analyze.");
                return;
            }
            
            // Get recent messages from various channels
            let recentMessages = [];
            let messageCount = 0;
            let activeUsers = new Set();
            let channelActivity = new Map();
            
            // Limit to avoid rate limits, but get more channels for longer periods
            const maxChannels = period === 'weekly' ? 8 : 5;
            const channelsToCheck = Array.from(readableChannels.values()).slice(0, maxChannels);
            
            for (const channel of channelsToCheck) {
                try {
                    let allRelevantMessages = [];
                    let lastMessageId = null;
                    let fetchAttempts = 0;
                    const maxAttempts = period === 'weekly' ? 6 : period === 'daily' ? 4 : 2;
                    let foundMessagesInTimeRange = false;
                    
                    // Keep fetching messages until we have enough or hit time limit
                    while (fetchAttempts < maxAttempts) {
                        const fetchOptions = { 
                            limit: 100,
                            ...(lastMessageId && { before: lastMessageId })
                        };
                        
                        const messageBatch = await channel.messages.fetch(fetchOptions);
                        if (messageBatch.size === 0) break; // No more messages in channel
                        
                        // Check if any messages in this batch are within our time range
                        const newestMessage = messageBatch.first();
                        const oldestMessage = messageBatch.last();
                        
                        // Filter this batch by time
                        const timeFilteredBatch = messageBatch.filter(msg => 
                            msg.createdTimestamp > startTime.getTime() && !msg.author.bot
                        );
                        
                        if (timeFilteredBatch.size > 0) {
                            foundMessagesInTimeRange = true;
                            allRelevantMessages.push(...timeFilteredBatch.values());
                        }
                        
                        // Stop if we've gone past our time window
                        if (oldestMessage.createdTimestamp <= startTime.getTime()) {
                            break; // We've gone back far enough
                        }
                        
                        lastMessageId = oldestMessage.id;
                        fetchAttempts++;
                        
                        // Small delay to respect rate limits
                        if (fetchAttempts < maxAttempts) {
                            await new Promise(resolve => setTimeout(resolve, 150));
                        }
                    }
                    
                    messageCount += allRelevantMessages.length;
                    channelActivity.set(channel.name, allRelevantMessages.length);
                    
                    // Sort messages by timestamp (newest first) for better context
                    allRelevantMessages.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
                    
                    allRelevantMessages.forEach(msg => {
                        activeUsers.add(msg.author.username);
                        if (recentMessages.length < 25) { // Slightly higher limit for AI processing
                            recentMessages.push({
                                author: msg.author.username,
                                content: msg.content.substring(0, 250), // Slightly longer truncation
                                channel: channel.name,
                                timestamp: msg.createdAt
                            });
                        }
                    });
                } catch (error) {
                    // Silently skip channels with errors (permissions, etc.)
                    console.error(`Error fetching from channel ${channel.name}:`, error.message);
                }
            }

            // Check if we found any data to work with
            if (messageCount === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#ffa500')
                    .setTitle(`📊 ${guild.name} Server Digest`)
                    .setDescription(`No messages found in the ${timeLabel}. The server was quieter than a Discord call with everyone muted! 🤐`)
                    .addFields({
                        name: '📈 Stats',
                        value: `Time Period: ${timeLabel}\nChannels Checked: ${channelsToCheck.length}\nMessages Found: 0\nActive Users: 0`,
                        inline: true
                    })
                    .setThumbnail(guild.iconURL())
                    .setTimestamp()
                    .setFooter({ text: `Generated by Bepo • ${new Date().toLocaleDateString()}` });

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            // Prepare data for AI summary
            const serverData = {
                serverName: guild.name,
                memberCount: guild.memberCount,
                timeRange: timeLabel,
                messageCount: messageCount,
                activeUsers: activeUsers.size,
                topChannels: Array.from(channelActivity.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3),
                recentMessages: recentMessages.slice(0, 10) // Limit for AI
            };

            // Generate AI summary
            const hasGoodContent = recentMessages.length > 0 && recentMessages.some(msg => msg.content.trim().length > 10);
            
            let prompt;
            if (hasGoodContent) {
                prompt = `Create a fun, engaging Discord server digest for "${guild.name}" covering the ${timeLabel}. 

Server Stats:
- Total members: ${serverData.memberCount}
- Messages sent: ${serverData.messageCount}
- Active users: ${serverData.activeUsers}
- Most active channels: ${serverData.topChannels.map(([name, count]) => `#${name} (${count} messages)`).join(', ')}

Recent highlights:
${recentMessages.slice(0, 12).map(msg => `${msg.author} in #${msg.channel}: ${msg.content}`).join('\n')}

Write this as Bepo would - casual, chronically online, with some humor. Include:
1. A catchy title
2. Key stats in a fun way
3. Notable moments or funny quotes if any
4. A closing comment

Keep it under 1500 characters total. Don't be too formal - this is Discord, not a corporate newsletter.`;
            } else {
                prompt = `Create a fun, engaging Discord server digest for "${guild.name}" covering the ${timeLabel}. 

Server Stats:
- Total members: ${serverData.memberCount}
- Messages sent: ${serverData.messageCount}
- Active users: ${serverData.activeUsers}
- Most active channels: ${serverData.topChannels.map(([name, count]) => `#${name} (${count} messages)`).join(', ')}

The server had some activity but not many detailed conversations to highlight. Create a digest that acknowledges this in a humorous way while still being informative about the server's activity level.

Write this as Bepo would - casual, chronically online, with some humor. Include:
1. A catchy title about the quiet/light activity
2. Key stats in a fun way
3. A comment about the server being chill/quiet
4. A closing comment

Keep it under 1500 characters total. Don't be too formal - this is Discord, not a corporate newsletter.`;
            }

            const response = await xAI.chat.completions.create({
                model: "grok-3-mini-beta",
                messages: [
                    { 
                        role: "system", 
                        content: "You are Bepo, creating a Discord server digest. Be casual, funny, and engaging. Use Discord slang and keep it real." 
                    },
                    { role: "user", content: prompt }
                ],
                max_tokens: 800,
                temperature: 0.8,
            });

            const digest = response.choices[0].message.content;

            // Create embed
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle(`📊 ${guild.name} Server Digest`)
                .setDescription(digest)
                .addFields({
                    name: '📈 Quick Stats',
                    value: `Messages: ${messageCount}\nActive Users: ${activeUsers.size}\nTime Period: ${timeLabel}\nChannels Scanned: ${channelsToCheck.length}`,
                    inline: true
                })
                .setThumbnail(guild.iconURL())
                .setTimestamp()
                .setFooter({ text: `Generated by Bepo • ${new Date().toLocaleDateString()}` });

            if (includeStats && serverData.topChannels.length > 0) {
                embed.addFields({
                    name: '🔥 Hottest Channels',
                    value: serverData.topChannels
                        .map(([name, count]) => `#${name}: ${count} messages`)
                        .join('\n'),
                    inline: true
                });
            }

            // Add debug info if requested
            if (includeStats) {
                const readableChannelNames = readableChannels.map(ch => `#${ch.name}`).slice(0, 10).join(', ');
                const debugInfo = `Readable Channels (${readableChannels.size}): ${readableChannelNames}${readableChannels.size > 10 ? '...' : ''}\nTime Range: ${startTime.toLocaleString()} - ${now.toLocaleString()}`;
                
                embed.addFields({
                    name: '🔧 Debug Info',
                    value: debugInfo,
                    inline: false
                });
            }

            // Add debug info about channel types if needed
            if (includeStats) {
                const channelTypes = {};
                guild.channels.cache.forEach(ch => {
                    const typeName = Object.keys(ChannelType).find(key => ChannelType[key] === ch.type) || `Unknown(${ch.type})`;
                    channelTypes[typeName] = (channelTypes[typeName] || 0) + 1;
                });
                
                const typesSummary = Object.entries(channelTypes)
                    .map(([type, count]) => `${type}: ${count}`)
                    .join('\n');
                
                embed.addFields({
                    name: '🏗️ Channel Types',
                    value: typesSummary,
                    inline: true
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error generating digest:', error);
            await interaction.editReply('Failed to generate server digest. The chaos was too much to process 😵');
        }
    },
};

export default digestCommand;

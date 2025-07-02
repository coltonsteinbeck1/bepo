import { SlashCommandBuilder, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import errorHandler from '../../utils/errorHandler.js';
import healthMonitor from '../../utils/healthMonitor.js';

const healthCommand = {
    data: new SlashCommandBuilder()
        .setName('health')
        .setDescription('Check bot system health and status'),

    async execute(interaction) {
        try {
            await interaction.deferReply();
        } catch (deferError) {
            console.error('Failed to defer reply:', deferError);
            // Try to reply directly if defer failed
            try {
                await interaction.reply({
                    content: '❌ Failed to defer reply. Attempting direct response...',
                    flags: MessageFlags.Ephemeral
                });
            } catch (replyError) {
                console.error('Failed to reply:', replyError);
                return; // Give up gracefully
            }
        }

        try {
            const { embed, components } = await createHealthEmbed(false);

            const response = await interaction.editReply({
                embeds: [embed],
                components
            });

            // Create collector for button interactions
            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300000 // 5 minutes
            });

            collector.on('collect', async (buttonInteraction) => {
                try {
                    if (buttonInteraction.user.id !== interaction.user.id) {
                        await buttonInteraction.reply({
                            content: '❌ Only the person who ran the command can use these buttons.',
                            ephemeral: true
                        });
                        return;
                    }

                    await buttonInteraction.deferUpdate();

                    // Determine what action to take based on button ID
                    let isDetailed = false;
                    if (buttonInteraction.customId === 'health_detailed') {
                        isDetailed = true;
                    } else if (buttonInteraction.customId === 'health_simple') {
                        isDetailed = false;
                    } else if (buttonInteraction.customId === 'health_refresh') {
                        // Keep current view state but refresh data
                        const currentEmbed = buttonInteraction.message.embeds[0];
                        isDetailed = currentEmbed.title.includes('📈') || currentEmbed.fields.length > 6;
                    }

                    const { embed: newEmbed, components: newComponents } = await createHealthEmbed(isDetailed);

                    await buttonInteraction.editReply({
                        embeds: [newEmbed],
                        components: newComponents
                    });
                } catch (error) {
                    console.error('Button interaction error:', error);
                    try {
                        await buttonInteraction.reply({
                            content: '❌ An error occurred while updating the health status.',
                            ephemeral: true
                        });
                    } catch (replyError) {
                        console.error('Failed to reply to button interaction:', replyError);
                    }
                }
            });

            collector.on('end', async () => {
                try {
                    // Disable buttons when collector expires
                    const disabledComponents = components.map(row => {
                        const newRow = ActionRowBuilder.from(row);
                        newRow.components.forEach(component => {
                            component.setDisabled(true);
                        });
                        return newRow;
                    });

                    await response.edit({ components: disabledComponents });
                } catch (error) {
                    console.error('Failed to disable buttons:', error);
                }
            });

        } catch (error) {
            console.error('Health command error:', error);
            try {
                await interaction.editReply({
                    content: '❌ Failed to retrieve health status. Check console logs for details.',
                });
            } catch (editError) {
                console.error('Failed to edit reply:', editError);
            }
        }
    }
};

// Helper function to create health embed with components
async function createHealthEmbed(detailed = false) {
    const health = errorHandler.getHealthStatus();
    const summary = healthMonitor.getHealthSummary();

    const uptime = Math.floor(health.uptime / 1000);
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);
    const uptimeSeconds = uptime % 60;

    const memoryMB = Math.round((health.memoryUsage?.used || 0) / 1024 / 1024);
    const memoryTotal = Math.round((health.memoryUsage?.total || 0) / 1024 / 1024);

    // Determine online status
    const isOnline = summary.online && summary.discord.connected;
    const statusEmoji = isOnline ? '🟢' : '🔴';
    const statusText = isOnline ? 'ONLINE' : 'OFFLINE';
    const statusColor = isOnline ? (health.healthy ? '#00ff00' : '#ffaa00') : '#ff0000';

    const embed = new EmbedBuilder()
        .setTitle(`${statusEmoji} Bot Health & Status Dashboard`)
        .setColor(statusColor)
        .addFields(
            {
                name: '🤖 Bot Status',
                value: `**Status:** ${statusEmoji} ${statusText}\n**Health:** ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`,
                inline: true
            },
            {
                name: '🔗 Discord Connection',
                value: `**Connected:** ${summary.discord.connected ? '✅ Yes' : '❌ No'}\n**Ping:** ${summary.discord.ping ? `${summary.discord.ping}ms` : 'N/A'}`,
                inline: true
            },
            {
                name: '⏱️ Uptime',
                value: `${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`,
                inline: true
            },
            {
                name: '💾 Memory Usage',
                value: `${memoryMB} MB / ${memoryTotal} MB\n${Math.round((memoryMB / memoryTotal) * 100)}% used`,
                inline: true
            },
            {
                name: '⚠️ Errors (Last Hour)',
                value: health.errorCount.toString(),
                inline: true
            },
            {
                name: '🚨 Critical Errors',
                value: health.criticalErrorCount.toString(),
                inline: true
            }
        );

    // Add detailed information if requested
    if (detailed) {
        embed.addFields(
            {
                name: '📊 Discord Stats',
                value: `**Guilds:** ${summary.discord.guilds}\n**Cached Users:** ${summary.discord.users || 'N/A'}`,
                inline: true
            },
            {
                name: '💻 System Info',
                value: `**Platform:** ${process.platform}\n**Node.js:** ${process.version}\n**PID:** ${process.pid}`,
                inline: true
            },
            {
                name: '🔄 Last Health Check',
                value: `<t:${Math.floor(health.lastHealthCheck / 1000)}:R>`,
                inline: true
            }
        );
    }

    // Add warnings and status descriptions
    let description = '';
    if (!isOnline) {
        description += '🔴 **Bot is currently OFFLINE** - Discord connection lost\n';
    } else if (!health.healthy) {
        description += '⚠️ **Warning**: Bot is online but in an unhealthy state\n';
    } else {
        description += '✅ **All systems operational**\n';
    }

    if (summary.discord.connected && !isOnline) {
        description += '📡 Discord connected but bot marked offline\n';
    }

    embed.setDescription(description);

    // Add memory warning if high usage
    if (memoryMB > 400) {
        embed.addFields({
            name: '⚠️ Memory Warning',
            value: 'High memory usage detected. Consider restarting if performance degrades.',
            inline: false
        });
    }

    // Add last critical error if exists
    if (health.lastCriticalError) {
        const errorText = health.lastCriticalError.message || health.lastCriticalError.error || 'Unknown error';
        const errorTime = Math.floor(new Date(health.lastCriticalError.timestamp).getTime() / 1000);
        embed.addFields({
            name: '🚨 Last Critical Error',
            value: `\`\`\`${errorText.substring(0, 200)}${errorText.length > 200 ? '...' : ''}\`\`\`\n<t:${errorTime}:R>`,
            inline: false
        });
    }

    // Create action buttons
    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('health_refresh')
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(detailed ? 'health_simple' : 'health_detailed')
                .setLabel(detailed ? '📊 Simple View' : '📈 Detailed View')
                .setStyle(ButtonStyle.Secondary)
        );

    embed.setTimestamp()
        .setFooter({ text: 'Health data refreshes every 30 seconds • Interactive for 5 minutes' });

    return {
        embed,
        components: [actionRow]
    };
}

export default healthCommand;

import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import errorHandler from '../../utils/errorHandler.js';

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
            const health = errorHandler.getHealthStatus();
            const uptime = Math.floor(health.uptime / 1000);
            const uptimeHours = Math.floor(uptime / 3600);
            const uptimeMinutes = Math.floor((uptime % 3600) / 60);
            const uptimeSeconds = uptime % 60;
            
            const memoryMB = Math.round((health.memoryUsage?.used || 0) / 1024 / 1024);
            const memoryTotal = Math.round((health.memoryUsage?.total || 0) / 1024 / 1024);
            
            const embed = new EmbedBuilder()
                .setTitle('🏥 Bot Health Status')
                .setColor(health.healthy ? '#00ff00' : '#ff0000')
                .addFields(
                    {
                        name: '📊 Overall Status',
                        value: health.healthy ? '✅ Healthy' : '❌ Unhealthy',
                        inline: true
                    },
                    {
                        name: '⏱️ Uptime',
                        value: `${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`,
                        inline: true
                    },
                    {
                        name: '💾 Memory Usage',
                        value: `${memoryMB} MB / ${memoryTotal} MB`,
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
                    },
                    {
                        name: '🔄 Last Health Check',
                        value: `<t:${Math.floor(health.lastHealthCheck / 1000)}:R>`,
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({ text: 'Health data refreshes every 5 minutes' });

            // Add warning if unhealthy
            if (!health.healthy) {
                embed.setDescription('⚠️ **Warning**: Bot is currently in an unhealthy state. Check logs for details.');
            }

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
                embed.addFields({
                    name: '🚨 Last Critical Error',
                    value: `${health.lastCriticalError.message || health.lastCriticalError.error || 'Unknown error'}\n<t:${Math.floor(new Date(health.lastCriticalError.timestamp).getTime() / 1000)}:R>`,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Health command error:', error);
            await interaction.editReply({
                content: '❌ Failed to retrieve health status. Check console logs for details.',
            });
        }
    }
};

export default healthCommand;

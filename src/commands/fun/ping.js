
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getStatusChecker } from '../../utils/statusChecker.js';

const pingCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Ping the bot and check connection status'),
  async execute(interaction) {
    const startTime = Date.now();
    
    // Defer reply to get accurate timing
    await interaction.deferReply();
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Get detailed status information using the proper async method
    const statusChecker = getStatusChecker();
    const statusReport = await statusChecker.getBotStatus();
    const isOnline = statusReport.summary.operational;
    const statusColor = isOnline ? '#00ff00' : '#ff0000';
    const statusEmoji = isOnline ? '🟢' : '🔴';
    
    const embed = new EmbedBuilder()
      .setTitle(`${statusEmoji} Pong! Bot Status`)
      .setColor(statusColor)
      .addFields(
        {
          name: '📡 Response Time',
          value: `${responseTime}ms`,
          inline: true
        },
        {
          name: '🔗 WebSocket Ping',
          value: interaction.client.ws.ping ? `${interaction.client.ws.ping}ms` : 'N/A',
          inline: true
        },
        {
          name: '📊 Status',
          value: `${statusEmoji} ${statusReport.summary.status}`,
          inline: true
        }
      );

    // Add confidence information if verification is available
    if (statusReport.verification?.enabled) {
      const confidence = Math.round(statusReport.verification.confidence * 100);
      embed.addFields({
        name: '🔍 Status Confidence',
        value: `${confidence}% (${statusReport.verification.consensus})`,
        inline: true
      });
    }

    embed.setTimestamp();

    if (!isOnline) {
      embed.setDescription('⚠️ **Bot may be experiencing issues**');
      
      if (statusReport.bot.lastSeen) {
        embed.addFields({
          name: '🕒 Last Seen',
          value: `<t:${Math.floor(new Date(statusReport.bot.lastSeen).getTime() / 1000)}:R>`,
          inline: true
        });
      }

      // Show shutdown reason if available
      if (statusReport.bot.shutdownReason) {
        embed.addFields({
          name: '📋 Shutdown Reason', 
          value: statusReport.bot.shutdownReason,
          inline: false
        });
      }
    } else {
      embed.setDescription('✅ **All systems operational**');
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

export default pingCommand;

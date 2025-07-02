
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getStatusReport } from '../../utils/statusChecker.js';

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
    
    // Get detailed status information
    const statusReport = getStatusReport();
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
      )
      .setTimestamp();

    if (!isOnline) {
      embed.setDescription('⚠️ **Bot may be experiencing issues**')
        .addFields({
          name: '🕒 Last Seen',
          value: statusReport.bot.lastSeen ? 
            `<t:${Math.floor(new Date(statusReport.bot.lastSeen).getTime() / 1000)}:R>` : 
            'Unknown',
          inline: true
        });
    } else {
      embed.setDescription('✅ **All systems operational**');
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

export default pingCommand;

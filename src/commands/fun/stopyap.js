import { SlashCommandBuilder, ChannelType, MessageFlags } from 'discord.js';
import voiceSessionManager from '../../utils/voiceSessionManager.js';

const stopyapCommand = {
    data: new SlashCommandBuilder()
        .setName('stopyap')
        .setDescription('Stop the yap voice session')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The voice channel to stop (optional - will find active session if not specified)')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildVoice)
        ),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const sessions = voiceSessionManager.getAllSessions();

        if (!sessions || sessions.size === 0) {
            return await interaction.reply({ content: 'No active yap sessions found.', flags: MessageFlags.Ephemeral });
        }

        let sessionToStop = null;
        let channelName = '';

        if (channel) {
            // Specific channel provided
            if (channel.type !== ChannelType.GuildVoice) {
                return await interaction.reply({ content: 'Please provide a valid voice channel.', flags: MessageFlags.Ephemeral });
            }
            
            sessionToStop = voiceSessionManager.getSession(channel.id);
            if (sessionToStop) {
                channelName = channel.name;
            } else {
                return await interaction.reply({ content: `No active yap session in ${channel.name}.`, flags: MessageFlags.Ephemeral });
            }
        } else {
            // No channel specified, find any active session in this guild
            for (const [channelId, session] of sessions.entries()) {
                try {
                    const sessionChannel = await interaction.client.channels.fetch(channelId);
                    if (sessionChannel && sessionChannel.guild.id === interaction.guild.id) {
                        sessionToStop = session;
                        channelName = sessionChannel.name;
                        break;
                    }
                } catch (error) {
                    console.error('Error fetching channel:', error);
                }
            }

            if (!sessionToStop) {
                return await interaction.reply({ content: 'No active yap sessions found in this server.', flags: MessageFlags.Ephemeral });
            }
        }

        // Stop the session
        try {
            sessionToStop.cleanup();
            await interaction.reply(`❌ Stopped yap and disconnected from ${channelName}`);
        } catch (error) {
            console.error('Error cleaning up session:', error);
            await interaction.reply({ content: 'Error stopping yap session.', flags: MessageFlags.Ephemeral });
        }
    },
};

export default stopyapCommand;

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import voiceActivityManager from '../../utils/voiceActivityManager.js';

const voiceStatusCommand = {
    data: new SlashCommandBuilder()
        .setName('voicestatus')
        .setDescription('Check current voice activity status'),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const activity = voiceActivityManager.getActiveActivity(guildId);

        if (!activity) {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🔇 Voice Status')
                .setDescription('No active voice activities in this server.')
                .addFields({
                    name: 'Available Commands',
                    value: '• `/play` - Start music playback\n• `/yap` - Start voice chat',
                    inline: false
                });

            await interaction.reply({ embeds: [embed] });
            return;
        }

        // Get channel information
        let channelName = `<#${activity.channelId}>`;
        try {
            const channel = await interaction.client.channels.fetch(activity.channelId);
            if (channel) {
                channelName = `#${channel.name}`;
            }
        } catch (error) {
            // Use fallback
        }

        const activityName = activity.type === 'music' ? '🎵 Music Playback' : '🗣️ Voice Chat (Yap)';
        const description = activity.type === 'music' 
            ? 'Music is currently playing in this server.' 
            : 'Voice chat session is currently active in this server.';

        const stopCommand = activity.type === 'music' ? '`Stop` button on music player' : '`/stopyap`';

        const embed = new EmbedBuilder()
            .setColor(activity.type === 'music' ? '#1DB954' : '#ff6b6b')
            .setTitle('🔊 Voice Status')
            .setDescription(description)
            .addFields(
                {
                    name: 'Active Service',
                    value: activityName,
                    inline: true
                },
                {
                    name: 'Channel',
                    value: channelName,
                    inline: true
                },
                {
                    name: 'Running Since',
                    value: `<t:${Math.floor(activity.startTime / 1000)}:R>`,
                    inline: true
                },
                {
                    name: 'To Stop',
                    value: stopCommand,
                    inline: false
                }
            );

        await interaction.reply({ embeds: [embed] });
    },
};

export default voiceStatusCommand;

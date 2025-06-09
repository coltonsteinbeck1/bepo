import { SlashCommandBuilder } from 'discord.js';

const stopYapCommand = {
    data: new SlashCommandBuilder()
        .setName('stopyap')
        .setDescription('Disconnect the bot from voice channel and stop the conversation'),
    
    async execute(interaction) {
        const guildId = interaction.guild.id;
        
        // Find active realtime session for this guild
        if (!global.realtimeSessions) {
            return await interaction.reply({ 
                content: '❌ No active voice conversation found.', 
                ephemeral: true 
            });
        }
        
        let sessionFound = false;
        
        for (const [channelId, session] of global.realtimeSessions.entries()) {
            if (session.connection.joinConfig.guildId === guildId) {
                session.cleanup();
                sessionFound = true;
                break;
            }
        }
        
        if (sessionFound) {
            await interaction.reply('✅ Disconnected from voice channel and stopped the conversation.');
        } else {
            await interaction.reply({ 
                content: '❌ No active voice conversation found in this server.', 
                ephemeral: true 
            });
        }
    },
};

export default stopYapCommand;

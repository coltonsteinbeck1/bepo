import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { buildMemoryContext } from '../../supabase/supabase.js';

const debugMemoryCommand = {
    data: new SlashCommandBuilder()
        .setName('debug-memory')
        .setDescription('Debug: Show memory context for a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check memory for (defaults to yourself)')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            // Get the target user (default to the person running the command)
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const userId = targetUser.id;
            const guildId = interaction.guild?.id;

            if (!guildId) {
                return await interaction.reply({
                    content: 'This command can only be used in a server.',
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            console.log(`Debug: Loading memory context for user ${userId} in guild ${guildId}`);

            // Build memory context using the same function as the voice chat
            const memoryContext = await buildMemoryContext(userId, 'voice chat conversation', guildId, interaction.client);

            let response = `**Memory Debug for ${targetUser.displayName || targetUser.username}:**\n`;
            response += `Discord ID: \`${userId}\`\n`;
            response += `Guild ID: \`${guildId}\`\n\n`;

            if (memoryContext && memoryContext.trim()) {
                response += `**Memory Context (${memoryContext.length} characters):**\n`;
                response += '```\n' + memoryContext.substring(0, 1800) + (memoryContext.length > 1800 ? '\n... (truncated)' : '') + '\n```';
            } else {
                response += '**No stored memory found for this user.**';
            }

            await interaction.editReply(response);

        } catch (error) {
            console.error('Error in debug-memory command:', error);
            await interaction.editReply('❌ An error occurred while debugging memory.');
        }
    },
};

export default debugMemoryCommand;

import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { ServerMemoryManager } from '../../utils/memoryUtils.js';

const updateServerMemoryCommand = {
    data: new SlashCommandBuilder()
        .setName('updateservermemory')
        .setDescription('Update a server memory')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('The ID of the server memory to update')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('content')
                .setDescription('New content for the memory')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('title')
                .setDescription('New title for the memory')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('context_type')
                .setDescription('New context type for the memory')
                .setRequired(false)
                .addChoices(
                    { name: 'Server Info', value: 'server' },
                    { name: 'Rules', value: 'rules' },
                    { name: 'FAQ', value: 'faq' },
                    { name: 'Important', value: 'important' }
                )),

    async execute(interaction) {
        const memoryId = interaction.options.getString('id');
        const newContent = interaction.options.getString('content');
        const newTitle = interaction.options.getString('title');
        const newContextType = interaction.options.getString('context_type');
        const userId = interaction.user.id;
        const serverId = interaction.guild?.id;

        if (!serverId) {
            await interaction.reply({
                content: '❌ This command can only be used in a server.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        try {
            // Build update object with only provided fields
            const updates = {};
            if (newContent) updates.memory_content = newContent;
            if (newTitle) updates.memory_title = newTitle;
            if (newContextType) updates.context_type = newContextType;

            if (Object.keys(updates).length === 0) {
                await interaction.reply({
                    content: '❌ Please provide at least one field to update (content, title, or context_type).',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Check if user is admin (CODE_MONKEY)
            const isCodeMonkey = userId === process.env.CODE_MONKEY;

            // Update the memory using memoryUtils
            const result = await ServerMemoryManager.updateMemory(memoryId, updates, userId, serverId, isCodeMonkey);
            
            if (!result.success) {
                await interaction.reply({
                    content: result.error || '❌ Failed to update server memory.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            let response = '✅ **Server Memory Updated Successfully!**\n\n';
            response += `**Memory ID:** \`${result.displayId || memoryId}\`\n`;
            
            // Show admin indicator if CODE_MONKEY is updating someone else's memory
            if (isCodeMonkey && result.wasAdminUpdate) {
                response += `**Admin Update:** Updated memory created by <@${result.originalUserId}>\n`;
            }
            
            if (newContent) {
                response += `**Updated Content:** ${newContent}\n`;
            }
            
            if (newTitle) {
                response += `**Updated Title:** ${newTitle}\n`;
            }
            
            if (newContextType) {
                response += `**Updated Type:** ${newContextType}\n`;
            }
            
            response += `\n*Last Updated:* <t:${Math.floor(Date.now() / 1000)}:R>`;

            // Add admin footer if CODE_MONKEY
            if (isCodeMonkey) {
                response += '\n\n*🔧 Admin privileges enabled*';
            }

            await interaction.reply({
                content: response,
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Error updating server memory:', error);
            await interaction.reply({
                content: '❌ An error occurred while updating the server memory. Please try again.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};

export default updateServerMemoryCommand;


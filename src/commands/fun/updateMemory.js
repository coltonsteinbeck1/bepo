import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { UserMemoryManager } from '../../utils/memoryUtils.js';

const updateMemoryCommand = {
    data: new SlashCommandBuilder()
        .setName('updatememory')
        .setDescription('Update one of your personal memories')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('The ID of the memory to update')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('content')
                .setDescription('New content for the memory')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('context_type')
                .setDescription('New context type for the memory')
                .setRequired(false)
                .addChoices(
                    { name: 'Conversation', value: 'conversation' },
                    { name: 'Summary', value: 'conversation_summary' },
                    { name: 'Temporary', value: 'temporary' },
                    { name: 'Personal Note', value: 'personal_note' }
                )),

    async execute(interaction) {
        const memoryId = interaction.options.getString('id');
        const newContent = interaction.options.getString('content');
        const newContextType = interaction.options.getString('context_type');
        const userId = interaction.user.id;

        try {
            // Build update object with only provided fields
            const updates = {};
            if (newContent) updates.memory_content = newContent;
            if (newContextType) updates.context_type = newContextType;

            if (Object.keys(updates).length === 0) {
                await interaction.reply({
                    content: '❌ Please provide at least one field to update (content or context_type).',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Check if user is admin (CODE_MONKEY)
            const isCodeMonkey = userId === process.env.CODE_MONKEY;

            // Update the memory using memoryUtils
            const result = await UserMemoryManager.updateMemory(memoryId, updates, isCodeMonkey ? null : userId);
            
            if (!result.success) {
                await interaction.reply({
                    content: result.error || '❌ Failed to update memory.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            let response = '✅ **Memory Updated Successfully!**\n\n';
            response += `**Memory ID:** \`${memoryId}\`\n`;
            
            // Show admin indicator if CODE_MONKEY is updating someone else's memory
            if (isCodeMonkey && result.wasAdminUpdate) {
                response += `**Admin Update:** Updated memory for <@${result.originalUserId}>\n`;
            }
            
            if (newContent) {
                response += `**Updated Content:** ${newContent}\n`;
            }
            
            if (newContextType) {
                response += `**Updated Type:** ${newContextType}\n`;
            }
            
            response += `\n*Last Updated:* <t:${Math.floor(Date.now() / 1000)}:R>`;

            await interaction.reply({
                content: response,
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Error updating memory:', error);
            await interaction.reply({
                content: '❌ An error occurred while updating the memory. Please try again.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};

export default updateMemoryCommand;


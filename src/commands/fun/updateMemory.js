import { SlashCommandBuilder } from 'discord.js';
import { updateUserMemory, getUserMemoryById } from '../../supabase/supabase.js';

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
            // First, verify the memory exists
            const isCodeMonkey = userId === process.env.CODE_MONKEY;
            let existingMemory;
            
            if (isCodeMonkey) {
                // CODE_MONKEY can update any user's memory - search across all users
                existingMemory = await getUserMemoryById(memoryId);
            } else {
                // Regular users can only update their own memories
                existingMemory = await getUserMemoryById(memoryId, userId);
            }
            
            if (!existingMemory) {
                const errorMessage = isCodeMonkey 
                    ? '❌ Memory not found with that ID.'
                    : '❌ Memory not found or you don\'t have permission to update it.';
                await interaction.reply({
                    content: errorMessage,
                    ephemeral: true
                });
                return;
            }

            // Build update object with only provided fields
            const updates = {};
            if (newContent) updates.memory_content = newContent;
            if (newContextType) updates.context_type = newContextType;

            if (Object.keys(updates).length === 0) {
                await interaction.reply({
                    content: '❌ Please provide at least one field to update (content or context_type).',
                    ephemeral: true
                });
                return;
            }

            // Perform the update
            const updatedMemory = await updateUserMemory(memoryId, updates);
            
            if (!updatedMemory) {
                await interaction.reply({
                    content: '❌ Failed to update memory. Please try again.',
                    ephemeral: true
                });
                return;
            }

            // Create response showing what changed
            let response = '✅ **Memory Updated Successfully!**\n\n';
            response += `**Memory ID:** \`${memoryId}\`\n`;
            
            // Show admin indicator if CODE_MONKEY is updating someone else's memory
            if (isCodeMonkey && existingMemory.user_id !== userId) {
                response += `**Admin Update:** Updated memory for <@${existingMemory.user_id}>\n`;
            }
            
            if (newContent) {
                response += `**Old Content:** ${existingMemory.memory_content}\n`;
                response += `**New Content:** ${updatedMemory.memory_content}\n`;
            }
            
            if (newContextType) {
                response += `**Old Type:** ${existingMemory.context_type}\n`;
                response += `**New Type:** ${updatedMemory.context_type}\n`;
            }
            
            response += `\n*Last Updated:* <t:${Math.floor(new Date(updatedMemory.updated_at).getTime() / 1000)}:R>`;

            // Add admin footer if CODE_MONKEY
            if (isCodeMonkey) {
                response += '\n\n*🔧 Admin privileges enabled*';
            }

            await interaction.reply({
                content: response,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error updating user memory:', error);
            await interaction.reply({
                content: '❌ An error occurred while updating the memory.',
                ephemeral: true
            });
        }
    }
};

export default updateMemoryCommand;

import { SlashCommandBuilder } from 'discord.js';
import { updateServerMemory, getServerMemoryById, getServerMemoryByPartialId } from '../../supabase/supabase.js';

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
                ephemeral: true
            });
            return;
        }

        try {
            const isCodeMonkey = userId === process.env.CODE_MONKEY;
            let existingMemory = null;
            let resolvedMemoryId = memoryId; // Use a mutable variable for the resolved ID
            
            // For short IDs (8 chars or less), try partial lookup first to avoid UUID validation errors
            // This works for all users since they see short IDs in the list
            if (memoryId.length <= 8) {
                console.log(`Trying partial ID lookup for: ${memoryId}`);
                existingMemory = await getServerMemoryByPartialId(memoryId, serverId);
                if (existingMemory) {
                    console.log(`Found memory with partial ID, full ID: ${existingMemory.id}`);
                    // Update resolvedMemoryId to use the full ID for the update operation
                    resolvedMemoryId = existingMemory.id;
                }
            } else {
                // For full UUIDs, try exact match first
                try {
                    existingMemory = await getServerMemoryById(memoryId, serverId);
                } catch (error) {
                    // If UUID validation fails, try partial lookup as fallback
                    console.log(`UUID validation failed, trying partial ID lookup`);
                    existingMemory = await getServerMemoryByPartialId(memoryId, serverId);
                    if (existingMemory) {
                        resolvedMemoryId = existingMemory.id;
                    }
                }
            }
            
            if (!existingMemory) {
                await interaction.reply({
                    content: '❌ Server memory not found. Make sure you\'re using the correct ID from `/servermemory list`.',
                    ephemeral: true
                });
                return;
            }

            // Check permissions - CODE_MONKEY can update any memory, others can only update their own
            if (!isCodeMonkey && existingMemory.user_id !== userId) {
                await interaction.reply({
                    content: '❌ You can only update server memories that you created. Admins can update any memory.',
                    ephemeral: true
                });
                return;
            }

            // Build update object with only provided fields
            const updates = {};
            if (newContent) updates.memory_content = newContent;
            if (newTitle) updates.memory_title = newTitle;
            if (newContextType) updates.context_type = newContextType;

            if (Object.keys(updates).length === 0) {
                await interaction.reply({
                    content: '❌ Please provide at least one field to update (content, title, or context_type).',
                    ephemeral: true
                });
                return;
            }

            // Perform the update - pass userId only if not CODE_MONKEY (for permission control)
            const updatedMemory = await updateServerMemory(resolvedMemoryId, updates, isCodeMonkey ? null : userId);
            
            if (!updatedMemory) {
                await interaction.reply({
                    content: '❌ Failed to update server memory. Please check permissions and try again.',
                    ephemeral: true
                });
                return;
            }

            // Create response showing what changed
            let response = '✅ **Server Memory Updated Successfully!**\n\n';
            response += `**Memory ID:** \`${resolvedMemoryId}\`\n`;
            
            if (newContent) {
                response += `**Old Content:** ${existingMemory.memory_content}\n`;
                response += `**New Content:** ${updatedMemory.memory_content}\n`;
            }
            
            if (newTitle) {
                response += `**Old Title:** ${existingMemory.memory_title || '(none)'}\n`;
                response += `**New Title:** ${updatedMemory.memory_title}\n`;
            }
            
            if (newContextType) {
                response += `**Old Type:** ${existingMemory.context_type}\n`;
                response += `**New Type:** ${updatedMemory.context_type}\n`;
            }
            
            response += `\n*Last Updated:* <t:${Math.floor(new Date(updatedMemory.updated_at).getTime() / 1000)}:R>`;

            // Send confirmation - make it visible if it's an important server memory update
            const isPublic = isCodeMonkey || newContextType === 'important' || newContextType === 'rules';
            
            await interaction.reply({
                content: response,
                ephemeral: !isPublic
            });

        } catch (error) {
            console.error('Error updating server memory:', error);
            await interaction.reply({
                content: '❌ An error occurred while updating the server memory.',
                ephemeral: true
            });
        }
    }
};

export default updateServerMemoryCommand;

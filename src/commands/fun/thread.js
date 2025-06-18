import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { convoStore, markThreadAsBotManaged } from "../../utils/utils.js";
import { createConversationThread, generateTopicHint } from "../../utils/threadUtils.js";

const threadCommand = {
    data: new SlashCommandBuilder()
        .setName("thread")
        .setDescription("Create a thread for your conversation with the bot")
        .addStringOption(option =>
            option
                .setName("name")
                .setDescription("Custom name for the thread")
                .setRequired(false)
        ),
    async execute(interaction) {
        const customName = interaction.options.getString('name');
        const key = `${interaction.channelId}:${interaction.user.id}`;
        const conversation = convoStore.get(key);

        // Check if user has an active conversation
        if (!conversation || conversation.history.length <= 1) {
            await interaction.reply({ 
                content: "Start a conversation with me first, then I can create a thread for us! Just mention me or use my prefix to chat.", 
                ephemeral: true 
            });
            return;
        }

        // Check if thread already exists for this conversation
        if (conversation.threadCreated) {
            await interaction.reply({ 
                content: "A thread already exists for our conversation! Look for it in the channel's thread list.", 
                ephemeral: true 
            });
            return;
        }

        try {
            await interaction.deferReply({ ephemeral: true });

            // Generate thread name
            let threadName;
            if (customName) {
                threadName = `${interaction.user.username}: ${customName}`;
            } else {
                const topicHint = await generateTopicHint(conversation.history);
                threadName = `${interaction.user.username}: ${topicHint}`;
            }
            
            // Create the thread
            const thread = await createConversationThread(interaction, threadName);
            
            if (thread) {
                // Mark conversation as having a thread
                conversation.threadCreated = true;
                conversation.threadId = thread.id;
                
                // Mark thread as bot-managed for auto-responses
                markThreadAsBotManaged(thread.id, interaction.user.id, interaction.channelId);

                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🧵 Thread Created Successfully!')
                    .setDescription(`I've created a thread called **${thread.name}** for our conversation.`)
                    .addFields({
                        name: '✨ What now?',
                        value: 'Head over to the thread - I\'ll respond to all your messages there automatically (no need to @ me)! The thread keeps our conversation organized and won\'t clutter the main channel.'
                    })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

                // Send welcome message to the thread
                try {
                    await thread.send({
                        content: `🧵 **Welcome to your conversation thread!**\n\n${interaction.user}, I've created this thread for our ongoing conversation. We can chat here without interrupting the main channel.\n\n${customName ? `**Topic: ${customName}**\n\n` : ''}I'll respond to all your messages in this thread automatically - no need to @ me!\n\n⏰ *This thread will auto-delete after 1 hour of inactivity to keep things tidy.* 🤖`
                    });
                } catch (error) {
                    console.error('Error sending thread welcome message:', error);
                }
            } else {
                await interaction.editReply({ 
                    content: "❌ Couldn't create a thread. This might not be supported in this channel type, or I might not have the right permissions." 
                });
            }
        } catch (error) {
            console.error('Error in thread command:', error);
            await interaction.editReply({ 
                content: "❌ Something went wrong while creating the thread. Please try again later." 
            });
        }
    },
};

export default threadCommand;

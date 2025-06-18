import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { convoStore, markThreadAsBotManaged } from "../../utils/utils.js";
import { createConversationThread, generateTopicHint } from "../../utils/threadUtils.js";

const continueCommand = {
    data: new SlashCommandBuilder()
        .setName("continue")
        .setDescription("Continue the conversation from where you left off")
        .addStringOption(option =>
            option
                .setName("topic")
                .setDescription("Optional: specify a topic to continue")
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option
                .setName("create_thread")
                .setDescription("Create a Discord thread for this conversation")
                .setRequired(false)
        ),
    async execute(interaction) {
        const topic = interaction.options.getString('topic');
        const createThread = interaction.options.getBoolean('create_thread') || false;
        const key = `${interaction.channelId}:${interaction.user.id}`;
        const conversation = convoStore.get(key);

        if (!conversation || conversation.history.length <= 1) {
            await interaction.reply({ 
                content: "No previous conversation found. Start chatting with the bot first!", 
                ephemeral: true 
            });
            return;
        }

        // Handle thread creation if requested
        let threadCreated = null;
        if (createThread) {
            try {
                // Generate topic name
                const topicName = topic || await generateTopicHint(conversation.history);
                const threadName = `${interaction.user.username}: ${topicName}`;
                
                // Create thread from this interaction
                threadCreated = await createConversationThread(interaction, threadName);
                
                if (threadCreated) {
                    // Mark conversation as having a thread
                    conversation.threadCreated = true;
                    conversation.threadId = threadCreated.id;
                    
                    // Mark thread as bot-managed for auto-responses
                    markThreadAsBotManaged(threadCreated.id, interaction.user.id, interaction.channelId);
                }
            } catch (error) {
                console.error('Error creating thread:', error);
                // Continue without thread if creation fails
            }
        }

        // Get the last few messages for context
        const recentMessages = conversation.history.slice(-6); // Last 6 messages
        let contextSummary = "**Recent conversation context:**\n";
        
        recentMessages.forEach((msg, index) => {
            if (msg.role === "system") return;
            const role = msg.role === "user" ? "You" : "Bepo";
            const preview = msg.content.length > 100 ? 
                msg.content.substring(0, 100) + "..." : 
                msg.content;
            contextSummary += `${role}: ${preview}\n`;
        });

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🧠 Conversation Context')
            .setDescription(contextSummary)
            .setTimestamp();

        // Add different field based on whether thread was created
        if (threadCreated) {
            embed.addFields({
                name: '🧵 Thread Created!',
                value: `I created a thread: **${threadCreated.name}**\n\nWe can continue our conversation there! The thread keeps our chat organized and won't clutter the main channel.`
            });
            
            // Send a welcome message to the thread
            try {
                await threadCreated.send({
                    content: `🧵 **Welcome to your conversation thread!**\n\n${interaction.user}, I've moved our chat here so we can continue without interrupting the main channel.\n\n${topic ? `**Topic: ${topic}**\n\n` : ''}I'll respond to all your messages in this thread automatically - no need to @ me!\n\n⏰ *This thread will auto-delete after 1 hour of inactivity to keep things tidy.* 🤖`
                });
            } catch (error) {
                console.error('Error sending thread welcome message:', error);
            }
        } else {
            embed.addFields({
                name: createThread ? '⚠️ Thread Creation Failed' : '💬 Ready to Continue',
                value: createThread ? 
                    'Could not create thread (might not be supported in this channel), but we can still chat here!' :
                    (topic ? 
                        `Focusing on: **${topic}**\nJust mention me or use my prefix to keep chatting!` :
                        'Just mention me or use my prefix to keep chatting!')
            });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};

export default continueCommand;

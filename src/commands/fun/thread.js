import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import { convoStore, markThreadAsBotManaged, isBotManagedThread, getBotManagedThreadInfo } from "../../utils/utils.js";
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
                flags: MessageFlags.Ephemeral 
            });
            return;
        }

        // Enhanced thread existence check with safeguards
        let existingThreadId = conversation.threadId;
        let threadExists = false;
        let existingThread = null;

        // First check: If we have a threadId recorded, verify it still exists
        if (existingThreadId) {
            try {
                existingThread = await interaction.client.channels.fetch(existingThreadId);
                if (existingThread && existingThread.isThread() && !existingThread.archived) {
                    threadExists = true;
                    
                    // Ensure the thread is still properly tracked as bot-managed
                    if (!isBotManagedThread(existingThreadId)) {
                        console.log(`Re-marking thread ${existingThreadId} as bot-managed after title change or restart`);
                        markThreadAsBotManaged(existingThreadId, interaction.user.id, interaction.channelId);
                    }
                }
            } catch (error) {
                console.log(`Thread ${existingThreadId} no longer exists or is inaccessible:`, error.message);
                // Clean up stale reference
                conversation.threadCreated = false;
                conversation.threadId = null;
                existingThreadId = null;
            }
        }

        // Second check: Look for any bot-managed threads by this user in this channel
        if (!threadExists) {
            try {
                const guild = interaction.guild;
                const channel = interaction.channel;
                
                // Fetch active threads in the channel
                const threadManager = channel.threads;
                const activeThreads = await threadManager.fetchActive();
                
                // Look for threads that might belong to this user
                for (const [threadId, thread] of activeThreads.threads) {
                    const threadInfo = getBotManagedThreadInfo(threadId);
                    if (threadInfo && threadInfo.userId === interaction.user.id && threadInfo.channelId === interaction.channelId) {
                        console.log(`Found existing bot-managed thread ${threadId} for user ${interaction.user.id}`);
                        existingThread = thread;
                        existingThreadId = threadId;
                        threadExists = true;
                        
                        // Update conversation record
                        conversation.threadCreated = true;
                        conversation.threadId = threadId;
                        break;
                    }
                }
            } catch (error) {
                console.error('Error searching for existing threads:', error);
                // Continue with thread creation if search fails
            }
        }

        if (threadExists && existingThread) {
            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('🧵 Thread Already Exists!')
                .setDescription(`You already have a thread called **${existingThread.name}** for our conversation.`)
                .addFields({
                    name: '🔍 Where is it?',
                    value: `Look for it in this channel's thread list, or click here: <#${existingThreadId}>`
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

                // Send welcome message to the thread with enhanced info
                try {
                    const welcomeMessage = customName 
                        ? `🧵 **Welcome to your conversation thread!**\n\n${interaction.user}, I've created this thread for our ongoing conversation about **${customName}**.\n\nWe can chat here without interrupting the main channel, and I'll respond to all your messages automatically - no need to @ me!\n\n💡 **Thread Features:**\n• Auto-responses (no @ needed)\n• Conversation history preserved\n• Easy to find in thread list\n• Won't clutter main channel\n\n⏰ *This thread will auto-delete after 1 hour of inactivity to keep things tidy.* 🤖\n\n*PS: Feel free to rename this thread anytime - I'll still recognize it as ours!* ✨`
                        : `🧵 **Welcome to your conversation thread!**\n\n${interaction.user}, I've created this thread for our ongoing conversation.\n\nWe can chat here without interrupting the main channel, and I'll respond to all your messages automatically - no need to @ me!\n\n💡 **Thread Features:**\n• Auto-responses (no @ needed)\n• Conversation history preserved\n• Easy to find in thread list\n• Won't clutter main channel\n\n⏰ *This thread will auto-delete after 1 hour of inactivity to keep things tidy.* 🤖\n\n*PS: Feel free to rename this thread anytime - I'll still recognize it as ours!* ✨`;

                    await thread.send({ content: welcomeMessage });
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

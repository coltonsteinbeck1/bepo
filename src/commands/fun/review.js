import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { convoStore } from "../../utils/utils.js";

const reviewCommand = {
    data: new SlashCommandBuilder()
        .setName("review")
        .setDescription("Review a conversation thread")
        .addIntegerOption(option =>
            option
                .setName("thread")
                .setDescription("Thread number to review (1 = most recent)")
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(10)
        ),
    async execute(interaction) {
        const threadNumber = interaction.options.getInteger('thread') || 1;
        const key = `${interaction.channelId}:${interaction.user.id}`;
        const conversation = convoStore.get(key);

        if (!conversation || conversation.history.length <= 1) {
            await interaction.reply({ 
                content: "No conversation history found.", 
                ephemeral: true 
            });
            return;
        }

        // For now, we'll show the current conversation as "thread 1"
        // In a future update, we can implement actual thread splitting
        if (threadNumber > 1) {
            await interaction.reply({ 
                content: `Thread ${threadNumber} not found. Only current conversation available (thread 1).`, 
                ephemeral: true 
            });
            return;
        }

        const messages = conversation.history.filter(msg => msg.role !== "system");
        const messageCount = messages.length;
        const startTime = conversation.startTime || "Unknown";

        // Create conversation summary
        let conversationText = "";
        messages.forEach((msg, index) => {
            const role = msg.role === "user" ? "**You**" : "**Bepo**";
            const content = msg.content.length > 200 ? 
                msg.content.substring(0, 200) + "..." : 
                msg.content;
            conversationText += `${role}: ${content}\n\n`;
        });

        // Split into multiple embeds if too long
        const maxLength = 2000;
        const embeds = [];
        
        if (conversationText.length <= maxLength) {
            const embed = new EmbedBuilder()
                .setColor('#9932cc')
                .setTitle(`🧵 Thread ${threadNumber} Review`)
                .setDescription(conversationText)
                .addFields({
                    name: 'Thread Stats',
                    value: `Messages: ${messageCount}\nStarted: ${typeof startTime === 'string' ? startTime : new Date(startTime).toLocaleString()}`
                })
                .setTimestamp();
            embeds.push(embed);
        } else {
            // Split into chunks
            const chunks = [];
            let currentChunk = "";
            const lines = conversationText.split('\n\n');
            
            for (const line of lines) {
                if ((currentChunk + line + '\n\n').length > maxLength && currentChunk) {
                    chunks.push(currentChunk);
                    currentChunk = line + '\n\n';
                } else {
                    currentChunk += line + '\n\n';
                }
            }
            if (currentChunk) chunks.push(currentChunk);

            chunks.forEach((chunk, index) => {
                const embed = new EmbedBuilder()
                    .setColor('#9932cc')
                    .setTitle(index === 0 ? `🧵 Thread ${threadNumber} Review` : `🧵 Thread ${threadNumber} Review (${index + 1})`)
                    .setDescription(chunk);
                
                if (index === chunks.length - 1) {
                    embed.addFields({
                        name: 'Thread Stats',
                        value: `Messages: ${messageCount}\nStarted: ${typeof startTime === 'string' ? startTime : new Date(startTime).toLocaleString()}`
                    });
                }
                
                embeds.push(embed);
            });
        }

        // Send embeds (Discord allows up to 10 embeds per message)
        const embedsToSend = embeds.slice(0, 10);
        await interaction.reply({ embeds: embedsToSend, ephemeral: true });
    },
};

export default reviewCommand;

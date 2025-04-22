import { SlashCommandBuilder } from "discord.js";
import { convoStore } from "../../utils/utils.js";

const resetConversation = {
    data: new SlashCommandBuilder()
        .setName("reset")
        .setDescription("Reset your conversation with the bot"),
    async execute(interaction) {
        const key = `${interaction.channelId}:${interaction.user.id}`;
        if (convoStore.delete(key)) {
            await interaction.reply({ content: "✅ Conversation reset.", ephemeral: true });
        } else {
            await interaction.reply({ content: "ℹ️ No active conversation to reset.", ephemeral: true });
        }
    },
};
export default resetConversation;
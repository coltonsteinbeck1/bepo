import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

const command = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Ping pong!"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply("Pong!");
  },
};
export default command;

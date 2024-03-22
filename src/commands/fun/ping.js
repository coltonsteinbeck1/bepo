
import { SlashCommandBuilder } from 'discord.js';

const pingCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Ping pong!'),
  async execute(interaction) {
    await interaction.reply('Pong!');
  },
};
export default pingCommand;

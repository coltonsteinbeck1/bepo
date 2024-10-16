import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

const KEY = process.env.APEX_KEY; 
const URL = `https://api.mozambiquehe.re/maprotation?auth=${KEY}&version=2`;

const apexMapCommand = {
    data: new SlashCommandBuilder()
      .setName('maprotation')
      .setDescription('Returns current and next map for Battle Royale and Arenas'),
    async execute(interaction) {
      await interaction.deferReply();
      
      try {
        const response = await fetch(URL);
        let data = await response.json();

        if (!data || data.error) {
          return interaction.editReply('Error fetching map rotation data. Please try again later.');
        }

        const { battle_royale, ltm, ranked } = data;

        // Add checks to ensure properties are defined
        if (!battle_royale || !battle_royale.current || !battle_royale.next ||
            !ltm || !ltm.current || !ltm.next ||
            !ranked || !ranked.current || !ranked.next) {
          return interaction.editReply('Error: Incomplete map rotation data.');
        }

        const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Apex Legends Map Rotation')
        .setDescription('Current and next maps for different modes in Apex Legends')
        .addFields(
          { name: 'Battle Royale', value: `**Current Map:** ${battle_royale.current.map} (until ${battle_royale.current.remainingMins} mins)
                  **Next Map:** ${battle_royale.next.map} (in ${battle_royale.next.DurationInMinutes} mins)` },
          { name: 'Ranked', value: `**Current Map:** ${ranked.current.map} (until ${ranked.current.remainingMins} mins)
                  **Next Map:** ${ranked.next.map} (in ${ranked.next.DurationInMinutes} mins)` },
          { name: 'Arenas', value: `**Current Map:** ${ltm.current.map} (until ${ltm.current.remainingMins} mins)
                  **Next Map:** ${ltm.next.map} (in ${ltm.next.DurationInMinutes} mins)` }
        ).setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error(error);
        if (!interaction.replied) {
          await interaction.editReply('An error occurred while fetching map rotation data.');
        }
      }
    },
};

export default apexMapCommand;
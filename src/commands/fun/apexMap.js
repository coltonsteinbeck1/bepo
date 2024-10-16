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

        console.log(data);
        if (!data || data.error) {
          return interaction.editReply('Error fetching map rotation data. Please try again later.');
        }
        const { battle_royale, ltm, ranked } = data;

        console.log(battle_royale);
        console.log(ltm);
        console.log(ranked);
        // Add checks to ensure properties are defined
        if (!battle_royale || !battle_royale.current || !battle_royale.next ||
            !ltm || !ltm.current || !ltm.next ||
            !ranked || !ranked.current || !ranked.next) {
          return interaction.editReply('Error: Incomplete map rotation data.');
        }

        const embed = new EmbedBuilder()
        .setColor('#B93038')
        .setTitle('Current Apex Legends map')
        .setDescription('Check out the current and upcoming maps for different modes in Apex Legends.')
        .addFields(
            {
                name: '🗺️ **Battle Royale**',
                value: `**Current pubs map:** ${battle_royale.current.map}, ends in **${Math.ceil(battle_royale.current.remainingSecs / 3600)} hour(s)**.
                **Next map:** ${battle_royale.next.map}, ends in **${Math.ceil(battle_royale.next.DurationInMinutes / 60)} hour(s)** (up for **${battle_royale.next.DurationInMinutes} mins**).
                    
                **Current ranked map:** ${ranked.current.map}.`,
                inline: false
            },
            {
                name: '🗺️ **Mixtape**',
                value: `**Current Mixtape map:** ${ltm.current.map} (${ltm.current.eventName}), ends in **${ltm.current.remainingMins} minutes**.
    **Next map:** ${ltm.next.map} (${ltm.next.eventName}), ends in **${ltm.next.DurationInMinutes} minutes** (up for **${ltm.next.DurationInMinutes} mins**).`,
                inline: false
            }
        )
        .setImage(battle_royale.current.asset) // Set an image of the current Battle Royale map to the embed
        .setTimestamp();    
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
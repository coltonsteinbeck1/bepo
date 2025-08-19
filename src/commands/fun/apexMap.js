import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { ApexAPI } from "../../utils/apiUtils.js";

/**
 * Create map rotation embed
 */
function createMapRotationEmbed(data) {
  const { battle_royale, ltm, ranked } = data;

  const embed = new EmbedBuilder()
    .setColor('#B93038')
    .setTitle('🗺️ Current Apex Legends Map')
    .setDescription('Check out the current and upcoming maps for different modes in Apex Legends.')
    .addFields(
      {
        name: '🗺️ **Battle Royale**',
        value: `**Current pubs map:** ${battle_royale.current.map}, ends in **${ApexAPI.formatTime(battle_royale.current.remainingMins)}**.
**Next map:** ${battle_royale.next.map}, and will end in **${Math.ceil(battle_royale.next.DurationInMinutes / 60)} hours** (up for **${battle_royale.next.DurationInMinutes} mins**).

**Current ranked map:** ${ranked.current.map}.`,
        inline: false
      },
      {
        name: '🗺️ **Mixtape**',
        value: `**Current Mixtape map:** ${ltm.current.map} (${ltm.current.eventName}), ends in **${ApexAPI.formatTime(ltm.current.remainingMins)}**.
**Next map:** ${ltm.next.map} (${ltm.next.eventName}), ends in **${ApexAPI.formatTime(ltm.next.DurationInMinutes)}** (up for **${ltm.next.DurationInMinutes} mins**).`,
        inline: false
      }
    )
    .setImage(battle_royale.current.asset)
    .setTimestamp();

  return embed;
}

const apexMapCommand = {
  data: new SlashCommandBuilder()
    .setName('maprotation')
    .setDescription('Returns current and next map for Battle Royale and Arenas'),
    
  async execute(interaction) {
    await interaction.deferReply();
    
    try {
      const data = await ApexAPI.fetchMapRotation();
      
      if (!data) {
        await interaction.editReply('Error fetching map rotation data. Please try again later.');
        return;
      }

      const embed = createMapRotationEmbed(data);
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error("Error executing maprotation command:", error);
      if (!interaction.replied) {
        await interaction.editReply('Interaction failed; Womp Womp.');
      }
    }
  },
};

export default apexMapCommand;
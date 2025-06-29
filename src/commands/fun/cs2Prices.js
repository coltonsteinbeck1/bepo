import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { SteamAPI } from "../../utils/apiUtils.js";

/**
 * Create price embed for CS2 skin
 */
function createPriceEmbed(itemData, skinName) {
  const itemName = itemData.markethashname || skinName;
  const itemImage = itemData.image;
  const steamUrl = itemData.steamurl;

  const priceAvgSteam = itemData.priceavg !== null ? SteamAPI.formatPrice(itemData.priceavg) : "N/A";
  const priceRealLowestThirdParty = itemData.pricereal !== null ? SteamAPI.formatPrice(itemData.pricereal) : "N/A";
  
  const rarity = itemData.rarity || "N/A";
  const quality = itemData.quality || "N/A";
  const wear = SteamAPI.formatWear(itemData.wear);
  const priceUpdatedAt = SteamAPI.formatPriceUpdatedAt(itemData.priceupdatedat);
  
  const embed = new EmbedBuilder()
    .setColor(itemData.bordercolor ? `#${itemData.bordercolor}` : '#0099ff')
    .setTitle(itemName)
    .setThumbnail(itemImage || null)
    .addFields(
      { name: "Wear", value: wear, inline: true },
      { name: "Rarity", value: rarity, inline: true },
      { name: "Quality", value: quality, inline: true },
      { name: "Steam Price (Average)", value: priceAvgSteam, inline: true },
      { name: "Lowest 3rd Party (Aggregated)", value: priceRealLowestThirdParty, inline: true }
    )
    .setTimestamp()
    .setFooter({ text: `Prices last updated: ${priceUpdatedAt}` });

  if (steamUrl) {
    embed.setURL(steamUrl);
  }
  
  // Add third-party market prices if available
  if (itemData.prices && itemData.prices.length > 0) {
    let thirdPartyDescription = "";
    for (const market of itemData.prices) {
      const priceValue = typeof market.price === 'number' ? market.price.toFixed(2) : 'N/A';
      const quantityValue = typeof market.quantity === 'number' ? market.quantity : 'N/A';
      const marketPriceInfo = `**${market.name}**: $${priceValue} (${quantityValue} listed)\n`;
      
      // Check Discord field limit (1024 chars)
      if (thirdPartyDescription.length + marketPriceInfo.length <= 1020) {
        thirdPartyDescription += marketPriceInfo;
      } else {
        if (!thirdPartyDescription.endsWith("...\n")) {
          thirdPartyDescription += "...\n";
        }
        break; 
      }
    }
    
    if (thirdPartyDescription) {
      embed.addFields({ name: "Third-Party Market Offers", value: thirdPartyDescription.trim() || '\u200B' });
    }
  }

  return embed;
}

const cs2Command = {
  data: new SlashCommandBuilder()
    .setName("cs2prices")
    .setDescription("Command to show CS2 prices for a specific skin")
    .addStringOption(option =>
      option.setName("skin_name")
        .setDescription("The name of the CS2 skin (e.g., ★ StatTrak™ Paracord Knife | Case Hardened (Minimal Wear))")
        .setRequired(true)),
        
  async execute(interaction) {
    await interaction.deferReply();
    const skinName = interaction.options.getString("skin_name");

    try {
      const itemData = await SteamAPI.fetchSkinPrice(skinName);
      
      if (!itemData || Object.keys(itemData).length === 0 || itemData.error || !itemData.markethashname) {
        await interaction.editReply(`⚠ Could not find price information for "${skinName}". ${itemData?.error || 'Ensure the skin name is correct and exists.'}`);
        return;
      }

      const embed = createPriceEmbed(itemData, skinName);
      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error("Error executing cs2prices command:", error);
      await interaction.editReply(`⚠ An error occurred while fetching prices for "${skinName}".\n\`${error.message}\``);
    }
  },
};

export default cs2Command;
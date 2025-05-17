import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import fetch from "node-fetch";

const STEAMWEBAPIKEY = process.env.STEAMWEBAPIKEY;

// Helper function to format wear values
function formatWear(wearShort) {
  const wearMap = {
    "fn": "Factory New",
    "mw": "Minimal Wear",
    "ft": "Field-Tested",
    "ww": "Well-Worn",
    "bs": "Battle-Scarred",
  };
  return wearMap[wearShort.toLowerCase()] || wearShort;
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

      if (!STEAMWEBAPIKEY) {
        await interaction.editReply("⚠ Steam Web API key is not configured. Please contact the bot owner.");
        return;
      }

      const encodedSkinName = encodeURIComponent(skinName);
      const apiUrl = `https://www.steamwebapi.com/steam/api/item?key=${STEAMWEBAPIKEY}&market_hash_name=${encodedSkinName}&with_groups=true`;

      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          let errorBody = "Could not retrieve details from Steam Web API.";
          try {
            const errorJson = await response.json();
            if (errorJson && (errorJson.message || errorJson.error)) {
              errorBody = errorJson.message || errorJson.error;
            }
          } catch (e) {
            // Ignore if error response is not JSON
          }
          throw new Error(`HTTP error! Status: ${response.status}. ${errorBody}`);
        }
        const itemData = await response.json();

        if (!itemData || Object.keys(itemData).length === 0 || itemData.error || !itemData.markethashname) {
            await interaction.editReply(`⚠ Could not find price information for "${skinName}". ${itemData.error || 'Ensure the skin name is correct and exists.'}`);
            return;
        }

        const itemName = itemData.markethashname;
        const itemImage = itemData.image;
        const steamUrl = itemData.steamurl;

        const priceAvgSteam = itemData.priceavg !== null ? `$${itemData.priceavg.toFixed(2)}` : "N/A";
        const priceRealLowestThirdParty = itemData.pricereal !== null ? `$${itemData.pricereal.toFixed(2)}` : "N/A";
        
        const rarity = itemData.rarity || "N/A";
        const quality = itemData.quality || "N/A";
        const wear = itemData.wear ? formatWear(itemData.wear) : "N/A";
        
        let priceUpdatedAt = "Not specified";
        if (itemData.priceupdatedat && itemData.priceupdatedat.date) {
            try {
                priceUpdatedAt = new Date(itemData.priceupdatedat.date).toLocaleString();
            } catch (e) {
                priceUpdatedAt = itemData.priceupdatedat.date; 
            }
        }
        
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
        
        // Displaying Third-Party Market Prices
        if (itemData.prices && itemData.prices.length > 0) {
            let thirdPartyDescription = "";
            for (const market of itemData.prices) {
                // Ensure price and quantity are available and are numbers before calling toFixed or using them
                const priceValue = typeof market.price === 'number' ? market.price.toFixed(2) : 'N/A';
                const quantityValue = typeof market.quantity === 'number' ? market.quantity : 'N/A';
                const marketPriceInfo = `**${market.name}**: $${priceValue} (${quantityValue} listed)\n`;
                
                // Check if adding the current market info would exceed Discord's field value limit (1024 chars)
                if (thirdPartyDescription.length + marketPriceInfo.length <= 1020) { // 1020 to leave some buffer
                    thirdPartyDescription += marketPriceInfo;
                } else {
                    // If it would exceed, add an ellipsis if not already there, and stop adding more
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

        await interaction.editReply({ embeds: [embed] });

      } catch (error) {
        console.error("Error fetching CS2 skin price:", error);
        await interaction.editReply(`⚠ An error occurred while fetching prices for "${skinName}".\n\`${error.message}\``);
      }
    },
  };
  
  export default cs2Command;
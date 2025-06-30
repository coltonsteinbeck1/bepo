import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getCachedPatchNotes, filterPatchNotes, formatContent } from "../../utils/cs2Utils.js";

const CS2_PATCH_NOTES_URL = process.env.CS2_PATCH_NOTES_URL;
let cachedPatchNotes = null;
let cacheTimestamp = 0;

const cs2Command = {
  data: new SlashCommandBuilder()
    .setName("cs2")
    .setDescription("Get CS2 patch notes with customizable filters")
    .addStringOption(option =>
      option
        .setName("source")
        .setDescription("Source for patch notes")
        .addChoices(
          { name: "Steam API (Latest & Most Reliable)", value: "steam" },
          { name: "Legacy API (Fallback)", value: "api" }
        )
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName("count")
        .setDescription("Number of patch notes to show (1-5)")
        .setMinValue(1)
        .setMaxValue(5)
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName("days_ago")
        .setDescription("Show patch notes from X days ago (e.g., 7 for last week)")
        .setMinValue(1)
        .setMaxValue(365)
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName("months_ago")
        .setDescription("Show patch notes from X months ago (e.g., 2 for last 2 months)")
        .setMinValue(1)
        .setMaxValue(12)
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("keyword")
        .setDescription("Search for specific keyword in patch notes")
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName("refresh")
        .setDescription("Force refresh cache")
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    
    // Get command options
    const source = interaction.options.getString("source") || "steam";
    const count = interaction.options.getInteger("count") || 1;
    const daysAgo = interaction.options.getInteger("days_ago");
    const monthsAgo = interaction.options.getInteger("months_ago");
    const keyword = interaction.options.getString("keyword");
    const refresh = interaction.options.getBoolean("refresh") || false;

    try {
      let patchNotes;
      
      if (source === "api" && CS2_PATCH_NOTES_URL) {
        // Use legacy API method
        patchNotes = await fetchFromAPI();
      } else {
        // Use Steam API method (default and recommended)
        patchNotes = await getCachedPatchNotes(refresh);
      }

      if (!patchNotes || patchNotes.length === 0) {
        await interaction.editReply("⚠ No patch notes available at the moment. Try using `/cs2 source:api` for legacy data.");
        return;
      }

      // Apply filters
      const filters = {
        count,
        daysAgo,
        monthsAgo,
        keyword
      };

      const filteredNotes = filterPatchNotes(patchNotes, filters);

      if (filteredNotes.length === 0) {
        await interaction.editReply("⚠ No patch notes found matching your criteria. Try adjusting your filters or using `/cs2 refresh:true`.");
        return;
      }

      // Create a single embed with all patch notes
      const embed = await createCombinedPatchNotesEmbed(filteredNotes, source);
      await interaction.followUp({ embeds: [embed] });

    } catch (error) {
      console.error("CS2 command error:", error);
      await interaction.editReply("⚠ An error occurred while fetching the patch notes. Please try again later.");
    }
  },
};

/**
 * Fetch patch notes from legacy API
 */
async function fetchFromAPI() {
  const now = Date.now();
  
  if (cachedPatchNotes && (now - cacheTimestamp) < 300000) { // 5 minutes cache
    return cachedPatchNotes;
  }

  const response = await fetch(CS2_PATCH_NOTES_URL);
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  
  const patchNotes = await response.json();
  cachedPatchNotes = patchNotes;
  cacheTimestamp = now;
  
  // Sort patch notes
  patchNotes.sort((a, b) => b.posttime - a.posttime || b.updatetime - a.updatetime);
  
  return patchNotes;
}

/**
 * Create a single Discord embed containing multiple patch notes
 */
async function createCombinedPatchNotesEmbed(notes, source) {
  const embed = new EmbedBuilder()
    .setColor('#FF6B00') // CS2 orange color
    .setTitle(`🎮 Counter-Strike 2 Updates (${notes.length} ${notes.length === 1 ? 'update' : 'updates'})`)
    .setTimestamp();

  // Add each patch note as a field
  for (let i = 0; i < Math.min(notes.length, 25); i++) { // Discord limit is 25 fields
    const note = notes[i];
    
    if (source === "api" && note.body) {
      // Legacy API format
      let cleanBody = formatContent(note.body);
      let shortContent = cleanBody.length > 200 ? cleanBody.substring(0, 200) + '...' : cleanBody;
      
      embed.addFields({
        name: `**${note.headline || 'CS2 Update'}**`,
        value: `${shortContent}\n*Updated: ${new Date(note.updatetime * 1000).toLocaleDateString()}*`,
        inline: false
      });
    } else {
      // Steam API format
      let content = note.content ? formatContent(note.content) : 'Update details available at the official updates page.';
      let shortContent = content.length > 200 ? content.substring(0, 200) + '...' : content;
      
      const fieldName = `**${note.title || 'CS2 Update'}**`;
      const fieldValue = `${shortContent}\n*${note.date ? note.date.toLocaleDateString() : 'Unknown date'}*`;
      
      embed.addFields({
        name: fieldName,
        value: fieldValue,
        inline: false
      });
    }
  }

  // Add official updates link
  embed.setURL('https://www.counter-strike.net/news/updates');

  // Add footer with source information
  const sourceText = source === "api" ? "Legacy API" : "Steam API";
  embed.setFooter({ 
    text: `Source: ${sourceText} | Click title for official updates page` 
  });

  // Add thumbnail
  embed.setThumbnail('https://cdn.akamai.steamstatic.com/apps/csgo/images/csgo_react/global/logo_cs2.svg');

  return embed;
}

/**
 * Create a Discord embed for a single patch note (legacy function, kept for compatibility)
 */
async function createPatchNoteEmbed(note, source) {
  const embed = new EmbedBuilder()
    .setColor('#FF6B00') // CS2 orange color
    .setTitle(note.title || note.headline || "CS2 Update")
    .setTimestamp();

  // Handle different data structures based on source
  if (source === "api" && note.body) {
    // Legacy API format
    let cleanBody = formatContent(note.body);
    
    // Split into sections and add as fields
    let sections = cleanBody.split(/\n(?=\[.+\])/g);
    let limitedSections = sections.slice(0, 25);

    limitedSections.forEach(section => {
      let match = section.match(/^\[(.+)\]\n?/);
      if (match) {
        let title = `**${match[1]}**`;
        let content = section.replace(/^\[.+\]\n?/, '').trim();
        embed.addFields({ name: title, value: content || '\u200B' });
      } else {
        embed.addFields({ name: '\u200B', value: section || '\u200B' });
      }
    });

    embed.setFooter({ 
      text: `Updated: ${new Date(note.updatetime * 1000).toLocaleString()} | Source: API` 
    });

  } else {
    // Steam API format
    if (note.content) {
      const formattedContent = formatContent(note.content);
      
      // Split content into manageable chunks if too long
      if (formattedContent.length > 1024) {
        const chunks = formattedContent.match(/[\s\S]{1,1024}/g) || [formattedContent];
        chunks.slice(0, 3).forEach((chunk, index) => {
          embed.addFields({ 
            name: index === 0 ? "**Patch Notes**" : "\u200B", 
            value: chunk 
          });
        });
      } else if (formattedContent.length > 0) {
        embed.addFields({ name: "**Patch Notes**", value: formattedContent });
      } else {
        embed.addFields({ name: "**Patch Notes**", value: "Update details available at the link above." });
      }
    }

    if (note.link) {
      embed.setURL(note.link);
    }

    if (note.author) {
      embed.setAuthor({ name: `By ${note.author}` });
    }

    embed.setFooter({ 
      text: `${note.date ? note.date.toLocaleDateString() : 'Unknown date'} | Source: Steam API` 
    });
  }

  return embed;
}

export default cs2Command;
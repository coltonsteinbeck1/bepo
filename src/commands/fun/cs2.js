import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import fetch from "node-fetch";

const CS2_PATCH_NOTES_URL = process.env.CS2_PATCH_NOTES_URL;
let cachedPatchNotes = null;
let cacheTimestamp = 0;

const cs2Command = {
  data: new SlashCommandBuilder()
    .setName("cs2")
    .setDescription("Command to grab CS2 patch notes"),
  async execute(interaction) {
    await interaction.deferReply();
    const now = Date.now();

    try {
        const response = await fetch(CS2_PATCH_NOTES_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const patchNotes = await response.json();
        cachedPatchNotes = patchNotes;
        cacheTimestamp = now;


      if (!cachedPatchNotes || cachedPatchNotes.length === 0) {
        await interaction.editReply("⚠ No patch notes available at the moment.");
        return;
      }

      // Sort patch notes
      cachedPatchNotes.sort((a, b) => b.posttime - a.posttime || b.updatetime - a.updatetime);

      // Limit embeds to prevent exceeding rate limits
      const maxEmbeds = 1; //Future state change in case more patch notes are needed
      const limitedPatchNotes = cachedPatchNotes.slice(0, maxEmbeds);
      // Create embeds for the patch notes
      for (let note of limitedPatchNotes) {
        // Clean up the body text
        let cleanBody = note.body
        .replace(/\[\/?list\]/g, '')        // Remove [list] and [/list] tags
        .replace(/\[\*\]/g, '• ')           // Replace [*] with bullet points
        .replace(/\[\/?\w+(=[^\]]+)?\]/g, '') // Remove other BBCode tags
        .replace(/\r?\n|\r/g, '\n')         // Normalize newlines
        .replace(/\n{2,}/g, '\n')           // Replace multiple newlines with a single newline
        .trim();

// Split the body into sections based on section headers like [MAPS], [MISC]
let sections = cleanBody.split(/\n(?=\[.+\])/g);

let limitedSections = sections.slice(0, 25);

const embed = new EmbedBuilder()
  .setColor('#ffA500')
  .setTitle(note.headline)
  .setFooter({ text: `Updated: ${new Date(note.updatetime * 1000).toLocaleString()}` });

// Add fields to the embed
    limitedSections.forEach(section => {
      // Extract the section title
      let match = section.match(/^\[(.+)\]\n?/);
      if (match) {
        let title = `**${match[1]}**`; // Bold the section title
        let content = section.replace(/^\[.+\]\n?/, '').trim();
        embed.addFields({ name: title, value: content || '\u200B' });
      } else {
        // If no section title, add the content directly
        embed.addFields({ name: '\u200B', value: section || '\u200B' });
      }
    });

    // Send the embed
    await interaction.followUp({ embeds: [embed] });
      }
    } catch (error) {
      console.error("error: ",error);
      await interaction.editReply("⚠ An error occurred while fetching the patch notes.");
    }
  },
};

export default cs2Command;
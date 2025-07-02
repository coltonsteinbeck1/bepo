import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getCachedPatchNotes, filterPatchNotes, formatContent } from "../../utils/apexUtils.js";

const apexCommand = {
    data: new SlashCommandBuilder()
        .setName("apex")
        .setDescription("Get Apex Legends patch notes (shows newest patch by default)")
        .addIntegerOption(option =>
            option
                .setName("count")
                .setDescription("Number of patch notes to show (1-10, default: 1)")
                .setMinValue(1)
                .setMaxValue(10)
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option
                .setName("days_ago")
                .setDescription("Show patch notes from X days ago (optional)")
                .setMinValue(1)
                .setMaxValue(365)
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option
                .setName("months_ago")
                .setDescription("Show patch notes from X months ago (optional)")
                .setMinValue(1)
                .setMaxValue(12)
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName("keyword")
                .setDescription("Search for specific keyword in patch notes (optional)")
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option
                .setName("refresh")
                .setDescription("Force refresh cache (optional)")
                .setRequired(false)
        ),
    async execute(interaction) {
        await interaction.deferReply();

        // Get command options - default to showing 1 newest patch if no count specified
        const count = interaction.options.getInteger("count") || 1;
        const daysAgo = interaction.options.getInteger("days_ago");
        const monthsAgo = interaction.options.getInteger("months_ago");
        const keyword = interaction.options.getString("keyword");
        const refresh = interaction.options.getBoolean("refresh") || false;

        try {
            // Fetch patch notes
            const patchNotes = await getCachedPatchNotes(refresh);

            if (!patchNotes || patchNotes.length === 0) {
                await interaction.editReply("⚠ No Apex Legends patch notes available at the moment. The service may be experiencing issues or EA hasn't published recent updates.");
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
                await interaction.editReply("⚠ No Apex Legends patch notes found matching your criteria. Try adjusting your filters or using `/apex refresh:true`.");
                return;
            }

            // Create embed(s) based on count
            if (filteredNotes.length === 1) {
                // Single patch note - use detailed format like PatchBot
                const embed = createSinglePatchNoteEmbed(filteredNotes[0]);
                await interaction.editReply({ embeds: [embed] });
            } else {
                // Multiple patch notes - use field-based format
                const embed = await createCombinedPatchNotesEmbed(filteredNotes);
                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error("Apex command error:", error);
            await interaction.editReply("⚠ An error occurred while fetching the Apex Legends patch notes. Please try again later.");
        }
    },
};

/**
 * Create a single Discord embed containing multiple patch notes
 */
async function createCombinedPatchNotesEmbed(notes) {
    const embed = new EmbedBuilder()
        .setColor('#FF0000') // Red color matching single patch note
        .setAuthor({ 
            name: 'Apex Legends'
        })
        .setTitle(`Recent Apex Legends Updates (${notes.length})`)
        .setTimestamp();

    // Add Apex logo as thumbnail for multiple updates
    embed.setThumbnail('https://logos-world.net/wp-content/uploads/2021/02/Apex-Legends-Logo.png');

    // Add each patch note as a separate field with individual links and dates
    for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        let content = note.content ? formatContent(note.content) : 'Update details available at the source link.';
        
        // Truncate individual notes for readability in multi-update view
        if (content.length > 150) {
            content = content.substring(0, 130) + '...';
        }

        const fieldName = `**${note.title || 'Apex Legends Update'}**`;
        const dateStr = note.date ? note.date.toLocaleDateString('en-US', { 
            month: 'numeric', 
            day: 'numeric', 
            year: '2-digit' 
        }) : 'Unknown date';
        
        const fieldValue = `${content}\n\n${dateStr}${note.link ? `, [Read more](${note.link})` : ''}`;

        embed.addFields({
            name: fieldName,
            value: fieldValue,
            inline: false
        });
    }

    // Add official news link as main URL
    embed.setURL('https://www.ea.com/games/apex-legends/apex-legends/news?type=game-updates');

    return embed;
}

/**
 * Create a detailed Discord embed for a single patch note (matching PatchBot format exactly)
 */
function createSinglePatchNoteEmbed(note) {
    const embed = new EmbedBuilder()
        .setColor('#FF0000') // Red color matching PatchBot
        .setAuthor({ 
            name: 'Apex Legends'
        })
        .setTitle(note.title || "Apex Legends Update")
        .setTimestamp(note.date);

    // Set the source URL if available
    if (note.link) {
        embed.setURL(note.link);
    }

    // Add main content as description - clean formatting like PatchBot
    if (note.content) {
        let content = formatContent(note.content)
            .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
            .trim();
        
        // Generous content length like PatchBot (they show a lot of content)
        if (content.length > 1500) {
            content = content.substring(0, 1480) + '...';
        }
        
        if (content.length > 0) {
            embed.setDescription(content);
        } else {
            embed.setDescription('New Apex Legends update available! View full details at the link above.');
        }
    } else {
        embed.setDescription('New Apex Legends update available! Click the title above to view full details.');
    }

    // Add the Apex Legends logo as thumbnail (appears on the right side)
    embed.setThumbnail('https://logos-world.net/wp-content/uploads/2021/02/Apex-Legends-Logo.png');

    // Add large promotional image at bottom like PatchBot
    embed.setImage('https://media.contentapi.ea.com/content/dam/apex-legends/common/future-icons-key-art.jpg');

    return embed;
}

/**
 * Create a Discord embed for a single patch note (legacy function, kept for compatibility)
 */
async function createPatchNoteEmbed(note) {
    const embed = new EmbedBuilder()
        .setColor('#FF0000') // Red color for consistency
        .setTitle(note.title || "Apex Legends Update")
        .setTimestamp();

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

    // Add tags if available
    if (note.tags && note.tags.length > 0) {
        embed.addFields({
            name: "**Tags**",
            value: note.tags.map(tag => `\`${tag}\``).join(' '),
            inline: true
        });
    }

    embed.setFooter({
        text: `${note.date ? note.date.toLocaleDateString() : 'Unknown date'} | Source: EA Official`
    });

    // Add thumbnail
    embed.setThumbnail('https://media.contentapi.ea.com/content/dam/apex-legends/common/apex-legends-bloodhound-edition.jpg.adapt.320w.jpg');

    return embed;
}

export default apexCommand;
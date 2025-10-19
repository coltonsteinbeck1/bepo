import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rhynoCommand = {
    data: new SlashCommandBuilder()
        .setName('rhyno')
        .setDescription('Send the rhyno gif!'),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Create path to the gif file
            const gifPath = path.join(__dirname, '../../images', 'rhyno.gif');

            // Create attachment
            const attachment = new AttachmentBuilder(gifPath, { name: 'rhyno.gif' });

            // Create embed
            const embed = new EmbedBuilder()
                .setTitle('Rhyno')
                .setImage('attachment://rhyno.gif')
                .setColor('#00ff00')
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                files: [attachment]
            });

        } catch (error) {
            console.error('Error sending rhyno gif:', error);

            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Sorry, I couldn\'t load the rhyno gif right now!')
                .setColor('#ff0000');

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};

export default rhynoCommand;

import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jigginCommand = {
    data: new SlashCommandBuilder()
        .setName('jigglin')
        .setDescription('Send the jigglin cat gif!'),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Create path to the gif file
            const gifPath = path.join(__dirname, '../../images', 'jigglingCat.gif');

            // Create attachment
            const attachment = new AttachmentBuilder(gifPath, { name: 'jigglingCat.gif' });

            // Create embed
            const embed = new EmbedBuilder()
                .setTitle('Jigglin')
                .setImage('attachment://jigglingCat.gif')
                .setColor('#ff69b4')
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                files: [attachment]
            });

        } catch (error) {
            console.error('Error sending jigglin gif:', error);

            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Sorry, I couldn\'t load the jigglin gif right now!')
                .setColor('#ff0000');

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};

export default jigginCommand;
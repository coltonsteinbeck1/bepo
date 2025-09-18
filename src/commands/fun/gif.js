import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import otakuGifService from '../../utils/otakuGifService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Since Discord slash commands need static choices, we'll use a subset of popular reactions
const POPULAR_REACTIONS = [
    { name: 'Random', value: 'random' },
    { name: 'Hug', value: 'hug' },
    { name: 'Kiss', value: 'kiss' },
    { name: 'Pat', value: 'pat' },
    { name: 'Smile', value: 'smile' },
    { name: 'Wave', value: 'wave' },
    { name: 'Dance', value: 'dance' },
    { name: 'Happy', value: 'happy' },
    { name: 'Laugh', value: 'laugh' },
    { name: 'Cry', value: 'cry' },
    { name: 'Blush', value: 'blush' },
    { name: 'Pout', value: 'pout' },
    { name: 'Confused', value: 'confused' },
    { name: 'Thumbs Up', value: 'thumbsup' },
    { name: 'Clap', value: 'clap' },
    { name: 'Celebrate', value: 'celebrate' },
    { name: 'Love', value: 'love' },
    { name: 'Nervous', value: 'nervous' },
    { name: 'Surprised', value: 'surprised' },
    { name: 'Yay', value: 'yay' },
    { name: 'Sleep', value: 'sleep' },
    { name: 'Mad', value: 'mad' },
    { name: 'Shy', value: 'shy' },
    { name: 'Wink', value: 'wink' }
];

const gifCommand = {
    data: new SlashCommandBuilder()
        .setName('gif')
        .setDescription('Send a fun reaction gif!')
        .addStringOption(option =>
            option.setName('reaction')
                .setDescription('Type of reaction gif to send (leave empty for random)')
                .setRequired(false)
                .addChoices(...POPULAR_REACTIONS)
        ),
    async execute(interaction) {
        await interaction.deferReply();

        const requestedReaction = interaction.options.getString('reaction') || 'random';

        try {
            let gifData;

            if (requestedReaction === 'random') {
                gifData = await otakuGifService.getRandomGif();
            } else {
                gifData = await otakuGifService.getReactionGif(requestedReaction);
            }

            // Create embed with the gif
            const embed = new EmbedBuilder()
                .setImage(gifData.url)
                .setColor('#ff69b4')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in gif command:', error);

            // Fallback to local gif if API fails
            try {
                await this.fallbackToLocalGif(interaction);
            } catch (fallbackError) {
                console.error('Fallback gif also failed:', fallbackError);

                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Oops!')
                    .setDescription('I couldn\'t load a gif right now. Please try again later!')
                    .setColor('#ff0000')
                    .setTimestamp();

                await interaction.editReply({ embeds: [errorEmbed] });
            }
        }
    },

    async fallbackToLocalGif(interaction) {
        // Fallback to local jigglingCat.gif
        const gifPath = path.join(__dirname, '../../images', 'jigglingCat.gif');
        const attachment = new AttachmentBuilder(gifPath, { name: 'jigglingCat.gif' });

        const embed = new EmbedBuilder()
            .setTitle('Jigglin (Fallback) 🐱')
            .setDescription('API temporarily unavailable, here\'s a local gif!')
            .setImage('attachment://jigglingCat.gif')
            .setColor('#ff69b4')
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed],
            files: [attachment]
        });
    }
};

export default gifCommand;
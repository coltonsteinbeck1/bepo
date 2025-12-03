import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const gametimeCommand = {
    data: new SlashCommandBuilder()
        .setName('gametime')
        .setDescription('Announce that it\'s game time with an optional role mention!')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Optional role to mention with the game time announcement')
                .setRequired(false)
        ),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Get the optional role
            const role = interaction.options.getRole('role');

            // Create path to the gif file (same as jigglin command)
            const gifPath = path.join(__dirname, '../../images', 'jigglingCat.gif');

            // Create attachment
            const attachment = new AttachmentBuilder(gifPath, { name: 'jigglingCat.gif' });

            // Build the message content
            let messageContent = "It's game time!!! 🚂🚂🚂";
            if (role) {
                messageContent = `${role} It's game time!!! 🚂🚂🚂`;
            }

            // Create embed
            const embed = new EmbedBuilder()
                .setTitle('🎮 Game Time!')
                .setImage('attachment://jigglingCat.gif')
                .setColor('#ff69b4')
                .setTimestamp();

            await interaction.editReply({
                content: messageContent,
                embeds: [embed],
                files: [attachment]
            });

        } catch (error) {
            console.error('Error sending gametime message:', error);

            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Sorry, I couldn\'t announce game time right now!')
                .setColor('#ff0000');

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};

export default gametimeCommand;

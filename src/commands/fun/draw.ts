import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { IMAGE_PATH, runGenerate } from "../../utils.js";

const drawCommand = {
  data: new SlashCommandBuilder()
    .setName("draw")
    .setDescription("Generate an image with DALL-E")
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("The prompt for DALL-E to draw")
        .setRequired(true),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const prompt = interaction.options.getString("prompt");
    const cb = () => {
      const attachment = new AttachmentBuilder(IMAGE_PATH);
      // get the filename from IMAGE_PATH
      const embed = new EmbedBuilder()
        .setTitle(prompt)
        .setImage(`attachment://image.png`);

      interaction
        .deferReply({ embeds: [embed], files: [attachment] })
        .catch(console.error.bind(console));
    };
    runGenerate(prompt, cb);
  },
};

export default drawCommand; // Export the command

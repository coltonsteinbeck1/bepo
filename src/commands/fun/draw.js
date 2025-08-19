import { EmbedBuilder, SlashCommandBuilder, AttachmentBuilder } from "discord.js";
import path from "path";
import { runGenerate, IMAGE_PATH } from "../../utils/utils.js";

const drawCommand = {
  data: new SlashCommandBuilder()
    .setName("draw")
    .setDescription("Generate an image with Grok")
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("The prompt for Grok to draw")
        .setRequired(true),
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const prompt = interaction.options.getString("prompt");
    const cb = () => {
      const attachment = new AttachmentBuilder(IMAGE_PATH);
      // get the filename from IMAGE_PATH
      const embed = new EmbedBuilder()
        .setTitle(prompt)
        .setImage(`attachment://image.png`);

      interaction.editReply({ embeds: [embed], files: [attachment] }).catch(console.error.bind(console));
    };
    runGenerate(prompt, cb);
  },
};

export default drawCommand; // Export the command

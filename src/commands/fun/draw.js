import { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } from "discord.js";
import { generateImage } from "../../utils/imageGenerator.js";

const drawCommand = {
  data: new SlashCommandBuilder()
    .setName("draw")
    .setDescription("Generate an image using AI")
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("The description of the image you want to generate")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("model")
        .setDescription("The AI model to use for generation")
        .setRequired(false)
        .addChoices(
          { name: "Grok (Default)", value: "grok" },
          { name: "Nano Banana Pro", value: "gemini" }
        )
    )
    .addAttachmentOption((option) =>
      option
        .setName("reference")
        .setDescription("A reference image to influence the generation (Nano Banana Pro only)")
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const prompt = interaction.options.getString("prompt");
    const model = interaction.options.getString("model") || "grok";
    const reference = interaction.options.getAttachment("reference");

    try {
      // Validate reference image usage
      if (reference && model !== "gemini") {
        await interaction.editReply({
          content: "⚠️ Reference images are currently only supported with the **Nano Banana Pro** model.",
        });
        return;
      }

      // Validate reference image type
      if (reference && !reference.contentType.startsWith("image/")) {
        await interaction.editReply({
          content: "⚠️ The reference file must be an image.",
        });
        return;
      }

      const imageBuffer = await generateImage({
        prompt,
        provider: model,
        referenceImageUrl: reference?.url,
      });

      const attachment = new AttachmentBuilder(imageBuffer, { name: "generated_image.png" });

      const embed = new EmbedBuilder()
        .setTitle("🎨 Image Generated")
        .setDescription(`**Prompt:** ${prompt}`)
        .setImage("attachment://generated_image.png")
        .setFooter({ text: `Generated with ${model === "gemini" ? "Nano Banana Pro" : "Grok"}` })
        .setColor(model === "gemini" ? 0x4285F4 : 0x000000)
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed],
        files: [attachment],
      });
    } catch (error) {
      console.error("Image generation error:", error);
      
      let errorMessage = "Failed to generate image. Please try again.";
      if (error.message.includes("safety")) {
        errorMessage = "The prompt triggered safety filters. Please try a different prompt.";
      } else if (error.response?.status === 429) {
        errorMessage = "Rate limit exceeded. Please try again later.";
      }

      await interaction.editReply({
        content: `❌ ${errorMessage}\n\`${error.message}\``,
      });
    }
  },
};

export default drawCommand;

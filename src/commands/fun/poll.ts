import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";

const pollCommand = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a poll")
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("The question for the poll")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("option_1")
        .setDescription("The first option for the poll")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("option_2")
        .setDescription("The second option for the poll")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("option_3")
        .setDescription("The third option for the poll")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("option_4")
        .setDescription("The fourth option for the poll")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("option_5")
        .setDescription("The fifth option for the poll")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("option_6")
        .setDescription("The sixth option for the poll")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("option_7")
        .setDescription("The seventh option for the poll")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("option_8")
        .setDescription("The eighth option for the poll")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("option_9")
        .setDescription("The ninth option for the poll")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("option_10")
        .setDescription("The tenth option for the poll")
        .setRequired(false),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const question = interaction.options.getString("question");
    const options = [
      interaction.options.getString("option_1"),
      interaction.options.getString("option_2"),
      interaction.options.getString("option_3") || "",
      interaction.options.getString("option_4") || "",
      interaction.options.getString("option_5") || "",
      interaction.options.getString("option_6") || "",
      interaction.options.getString("option_7") || "",
      interaction.options.getString("option_8") || "",
      interaction.options.getString("option_9") || "",
      interaction.options.getString("option_10") || "",
    ].filter((option) => option !== "");
    const emojis = ["✅", "❌", "😄", "😊", "😍", "🤔", "🙌", "👏", "👍", "�"];
    // Use the options array as needed

    const embed = new EmbedBuilder().setTitle(question);

    options.forEach((o, i) => {
      if (o && o.length > 0) {
        embed.addFields({
          name: `${o}`,
          value: `${emojis[i]} `,
          inline: true,
        });
      }
    });

    // Reply to the interaction with the embed
    await interaction.reply({ embeds: [embed], fetchReply: true });
  },
};
export default pollCommand; // Export the command

import { SlashCommandBuilder, MessageFlags } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("markov")
    .setDescription("Generate text using the Markov chain trained on channel messages")
    .addSubcommand(subcommand =>
      subcommand
        .setName("generate")
        .setDescription("Generate text using the Markov chain")
        .addStringOption(option =>
          option.setName("prompt")
            .setDescription("Starting phrase for generation (optional)")
            .setRequired(false))
        .addIntegerOption(option =>
          option.setName("length")
            .setDescription("Target length in words (20-150)")
            .setRequired(false)
            .setMinValue(20)
            .setMaxValue(150))
        .addBooleanOption(option =>
          option.setName("coherent")
            .setDescription("Use coherence mode for better sentence structure (default: true)")
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName("stats")
        .setDescription("Show Markov chain training statistics")),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "stats") {
      return this.handleStats(interaction);
    } else if (subcommand === "generate") {
      return this.handleGenerate(interaction);
    }
  },

  async handleStats(interaction) {
    const markov = interaction.client.markov;
    
    if (!markov) {
      return interaction.reply({
        content: "❌ Markov chain not available.",
        flags: MessageFlags.Ephemeral
      });
    }

    const chainSize = Object.keys(markov.chain).length;
    const startersCount = markov.sentenceStarters.size;
    const endersCount = markov.sentenceEnders.size;
    const uniqueWords = Object.keys(markov.wordFrequency).length;
    const totalWords = Object.values(markov.wordFrequency).reduce((sum, count) => sum + count, 0);
    const userMappings = markov.userMappings.size;
    
    // Find most common words (excluding very short words for better stats)
    const topWords = Object.entries(markov.wordFrequency)
      .filter(([word]) => word.length > 2) // Filter out very short words
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word, count]) => `${word} (${count})`);

    const statsEmbed = {
      title: "🤖 Markov Chain Statistics",
      color: 0x00ff00,
      fields: [
        {
          name: "Training Data",
          value: `**Chain Keys:** ${chainSize.toLocaleString()}\n**Unique Words:** ${uniqueWords.toLocaleString()}\n**Total Words Processed:** ${totalWords.toLocaleString()}`,
          inline: true
        },
        {
          name: "Sentence Structure",
          value: `**Sentence Starters:** ${startersCount}\n**Sentence Enders:** ${endersCount}\n**Order (Context Length):** ${markov.order} words`,
          inline: true
        },
        {
          name: "User Data",
          value: `**Known Users:** ${userMappings}\n**Text Preprocessing:** Enabled\n**User ID Filtering:** Active`,
          inline: true
        },
        {
          name: "Most Common Words",
          value: topWords.join('\n') || "No data",
          inline: false
        }
      ],
      footer: {
        text: "The bot learns from messages in designated channels • User IDs are filtered for better output"
      }
    };

    await interaction.reply({ embeds: [statsEmbed] });
  },

  async handleGenerate(interaction) {
    const prompt = interaction.options.getString("prompt");
    const length = interaction.options.getInteger("length") || 50;
    const coherent = interaction.options.getBoolean("coherent") ?? true;

    // Get the markov instance from the client
    const markov = interaction.client.markov;
    
    if (!markov || Object.keys(markov.chain).length === 0) {
      return interaction.reply({
        content: "❌ Markov chain hasn't been trained yet or has no data. Send some messages first!",
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply();

    try {
      // Update user mappings before generation
      markov.setUserMappings(interaction.client);
      
      // Generate text with the enhanced features
      let generatedText;
      
      if (prompt) {
        // Try to find a matching key that starts with the prompt
        const keys = Object.keys(markov.chain);
        const matchingKey = keys.find(key => 
          key.toLowerCase().includes(prompt.toLowerCase())
        );
        
        if (matchingKey) {
          generatedText = markov.generate(matchingKey, length, coherent);
        } else {
          // If no exact match, generate normally and mention the prompt wasn't found
          generatedText = markov.generate(null, length, coherent);
          generatedText = `*Prompt "${prompt}" not found in training data, generated randomly:*\n\n${generatedText}`;
        }
      } else {
        generatedText = markov.generate(null, length, coherent);
      }

      if (!generatedText || generatedText.trim().length < 15) {
        return interaction.editReply({
          content: "❌ Failed to generate meaningful text. The training data might be insufficient."
        });
      }

      // Add generation info
      const modeText = coherent ? "Coherent" : "Creative";
      const wordCount = generatedText.replace(/\*.*?\*/g, '').split(' ').filter(w => w.length > 0).length; // Exclude italicized text from word count
      const footer = `\n\n*Generated using ${modeText} mode • ${wordCount} words • User IDs filtered*`;
      
      const finalText = generatedText + footer;
      
      // Check length limit and split if necessary
      if (finalText.length > 2000) {
        const truncated = generatedText.substring(0, 1850) + "..." + footer;
        await interaction.editReply(truncated);
      } else {
        await interaction.editReply(finalText);
      }

    } catch (error) {
      console.error("Markov generation error:", error);
      await interaction.editReply({
        content: "❌ An error occurred while generating text. Please try again."
      });
    }
  },
};

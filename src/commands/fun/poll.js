import pkg from 'discord.js';
const { SlashCommandBuilder, Poll, MessageFlags } = pkg;

const pollCommand = {
    data: new SlashCommandBuilder()
        .setName("poll")
        .setDescription("Create a poll using Discord's built-in poll system")
        .addStringOption((option) =>
            option
                .setName("question")
                .setDescription("The question for the poll")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("option_1")
                .setDescription("First option (format: 'text emoji' or 'emoji text')")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("option_2")
                .setDescription("Second option (format: 'text emoji' or 'emoji text')")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("option_3")
                .setDescription("Third option (format: 'text emoji' or 'emoji text')")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("option_4")
                .setDescription("Fourth option (format: 'text emoji' or 'emoji text')")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("option_5")
                .setDescription("Fifth option (format: 'text emoji' or 'emoji text')")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("option_6")
                .setDescription("Sixth option (format: 'text emoji' or 'emoji text')")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("option_7")
                .setDescription("Seventh option (format: 'text emoji' or 'emoji text')")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("option_8")
                .setDescription("Eighth option (format: 'text emoji' or 'emoji text')")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("option_9")
                .setDescription("Ninth option (format: 'text emoji' or 'emoji text')")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("option_10")
                .setDescription("Tenth option (format: 'text emoji' or 'emoji text')")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("duration")
                .setDescription("How long the poll should run")
                .setRequired(false)
                .addChoices(
                    { name: "1 hour", value: "1" },
                    { name: "4 hours", value: "4" },
                    { name: "8 hours", value: "8" },
                    { name: "24 hours (1 day)", value: "24" },
                    { name: "3 days", value: "72" },
                    { name: "1 week", value: "168" }
                )
        )
        .addBooleanOption((option) =>
            option
                .setName("multiple_choice")
                .setDescription("Allow multiple selections (default: false)")
                .setRequired(false)
        ),

    async execute(interaction) {
        const question = interaction.options.getString("question");
        const duration = parseInt(interaction.options.getString("duration")) || 24;
        const allowMultiselect = interaction.options.getBoolean("multiple_choice") || false;
        
        // Collect all options
        const rawOptions = [
            interaction.options.getString("option_1"),
            interaction.options.getString("option_2"),
            interaction.options.getString("option_3"),
            interaction.options.getString("option_4"),
            interaction.options.getString("option_5"),
            interaction.options.getString("option_6"),
            interaction.options.getString("option_7"),
            interaction.options.getString("option_8"),
            interaction.options.getString("option_9"),
            interaction.options.getString("option_10"),
        ].filter(option => option !== null && option !== undefined && option.trim() !== '');

        if (rawOptions.length < 2) {
            return await interaction.reply({
                content: "You need at least 2 options for a poll!",
                flags: MessageFlags.Ephemeral
            });
        }

        if (rawOptions.length > 10) {
            return await interaction.reply({
                content: "You can have a maximum of 10 poll options!",
                flags: MessageFlags.Ephemeral
            });
        }

        // Enhanced function to parse emoji from beginning OR end of text
        function parseOption(optionString) {
            const trimmed = optionString.trim();
            const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|<a?:\w+:\d+>)/gu;
            
            // Find all emojis in the string
            const emojis = [...trimmed.matchAll(emojiRegex)];
            
            if (emojis.length > 0) {
                // Use the first emoji found
                const emoji = emojis[0][1];
                
                // Remove the emoji from the text and clean up whitespace
                let text = trimmed.replace(emoji, '').trim();
                
                // If text is empty after removing emoji, use the emoji as text
                if (!text) {
                    text = emoji;
                }
                
                return { text: text, emoji: emoji };
            } else {
                return { text: trimmed, emoji: undefined };
            }
        }

        try {
            // Parse all options
            const pollAnswers = rawOptions.map((option, index) => {
                const parsed = parseOption(option);
                const answer = { 
                    answerId: index + 1,
                    text: parsed.text 
                };
                
                // Only add emoji if it exists
                if (parsed.emoji) {
                    answer.emoji = parsed.emoji;
                }
                
                return answer;
            });

            // Try creating the poll with the correct structure for discord.js 14.21
            const pollData = {
                question: { text: question },
                answers: pollAnswers,
                duration: duration,
                allowMultiselect: allowMultiselect
            };

            // Send poll directly in the reply object
            await interaction.reply({
                poll: pollData
            });

        } catch (error) {
            console.error("Error creating poll:", error);
            console.log("Discord.js version:", pkg.version);
            console.log("Poll constructor available:", typeof Poll);
            console.log("Poll data structure:", JSON.stringify({
                question: { text: question },
                answers: rawOptions.slice(0, 2).map((opt, i) => ({ answerId: i + 1, text: opt })),
                duration: duration,
                allowMultiselect: allowMultiselect
            }, null, 2));
            
            try {
                await interaction.reply({
                    content: `There was an error creating the native poll. Error: ${error.message}\n\nMake sure your question and options aren't too long, and that custom emojis are from this server!`,
                    flags: MessageFlags.Ephemeral
                });
            } catch (replyError) {
                console.error("Failed to send error reply:", replyError);
            }
        }
    },
};

export default pollCommand;
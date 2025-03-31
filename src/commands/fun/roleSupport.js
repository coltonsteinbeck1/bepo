import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

const roleSupport = {
    data: new SlashCommandBuilder()
        .setName("rolesupport")
        .setDescription("Manage your self-assignable roles."),
    async execute(interaction) {
        try {
            const guild = interaction.guild;
            if (!guild) {
                return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
            }
            await guild.roles.fetch();

            // Get all roles and filter out managed roles and the @everyone role.
            const availableRoles = guild.roles.cache.filter(role => !role.managed && role.id !== guild.id);

            const member = interaction.member;
            const filteredRoles = availableRoles.filter(role => !member.roles.cache.has(role.id));

            const buttons = filteredRoles.map(role =>
                new ButtonBuilder()
                    .setCustomId(`roleToggle:${role.id}`)
                    .setLabel(role.name)
                    .setStyle(ButtonStyle.Primary)
            );
            
            const rows = [];
            for (let i = 0; i < buttons.length; i += 5) {
                rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
            }

            await interaction.reply({
                content: "Select the roles you want to toggle:",
                components: rows,
                ephemeral: true,
            });
        } catch (error) {
            console.error("Error executing roleSupport command:", error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: "An error occurred while executing the command.",
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    content: "An error occurred while executing the command.",
                    ephemeral: true,
                });
            }
        }
    },
};

export default roleSupport;
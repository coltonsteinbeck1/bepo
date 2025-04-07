import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { getBZBannedRoles } from "../../supabase/supabase.js";

const roleSupport = {
    data: new SlashCommandBuilder()
        .setName("roles")
        .setDescription("Manage your self-assignable roles")
        .addStringOption(option =>
            option
                .setName("action")
                .setDescription("Choose to add or remove roles")
                .setRequired(true)
                .addChoices(
                    { name: "Add Role", value: "add" },
                    { name: "Remove Role", value: "remove" }
                )
        ),
    async execute(interaction) {
        const action = interaction.options.getString('action');

        try {
            const guild = interaction.guild;
            if (!guild) {
                return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
            }
            if (guild.id !== process.env.GUILD_BZ) {
                return interaction.reply({ content: "This command is not enabled in this server.", ephemeral: true });
            }
            await guild.roles.fetch();

            if (action === 'add') {
                // Fetch and log banned role IDs for debugging
                const bzRolesData = await getBZBannedRoles();
                console.log('Banned Roles Data:', bzRolesData);

                // Convert role IDs to Number for proper comparison
                const bannedRolesSet = new Set(bzRolesData.map(role => Number(role.role_id)));
                console.log('Banned Roles Set:', [...bannedRolesSet].map(id => id.toString()));

                // Get all roles and filter out managed roles, @everyone, and roles with banned IDs
                const availableRoles = guild.roles.cache.filter(role => {
                    try {
                        const roleId = Number(role.id);
                        const isBanned = bannedRolesSet.has(roleId);

                        // Log each role being checked
                        console.log(`Checking role: ${role.name} (${roleId.toString()}) - Banned: ${isBanned}`);

                        return !role.managed &&
                            role.id !== guild.id &&
                            !isBanned;
                    } catch (error) {
                        console.error(`Error processing role ${role.name}:`, error);
                        return false; // Skip this role if there's an error
                    }
                });

                const member = interaction.member;
                const filteredRoles = availableRoles.filter(role => !member.roles.cache.has(role.id));

                // Log final available roles
                console.log('Final Available Roles:', [...filteredRoles.values()].map(r => ({
                    name: r.name,
                    id: r.id
                })));

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
            } else if (action === 'remove') {
                const member = interaction.member;
                const currentRoles = member.roles.cache.filter(role => role.id !== guild.id && !role.managed);

                const buttons = currentRoles.map(role =>
                    new ButtonBuilder()
                        .setCustomId(`removeRole:${role.id}`)
                        .setLabel(role.name)
                        .setStyle(ButtonStyle.Danger)
                );

                const rows = [];
                for (let i = 0; i < buttons.length; i += 5) {
                    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
                }

                await interaction.reply({
                    content: "Select the roles you want to remove:",
                    components: rows,
                    ephemeral: true,
                });
            } else {
                await interaction.reply({ content: "Invalid action. Please choose 'add' or 'remove'.", ephemeral: true });
            }
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
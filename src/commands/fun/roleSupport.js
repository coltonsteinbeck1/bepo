import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { RoleManager, RoleUtils } from "../../utils/roleUtils.js";

const roleSupport = {
  data: new SlashCommandBuilder()
    .setName("rolesupport")
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
      const member = interaction.member;

      if (!guild) {
        return interaction.reply({ 
          content: "This command can only be used in a server.", 
          flags: MessageFlags.Ephemeral 
        });
      }

      if (!RoleManager.isRoleCommandAllowed(guild.id)) {
        return interaction.reply({ 
          content: "This command is not enabled in this server.", 
          flags: MessageFlags.Ephemeral 
        });
      }

      if (action === 'add') {
        const availableRoles = await RoleManager.getAvailableRoles(guild, member);
        
        if (availableRoles.length === 0) {
          return interaction.reply({
            content: "No roles available to add. You either have all assignable roles or no roles are available.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const rows = RoleManager.createRoleButtons(availableRoles, 'add');

        await interaction.reply({
          content: "Select the roles you want to add:",
          components: rows,
          flags: MessageFlags.Ephemeral,
        });

      } else if (action === 'remove') {
        const removableRoles = await RoleManager.getRemovableRoles(guild, member);
        
        if (removableRoles.length === 0) {
          return interaction.reply({
            content: "You don't have any assignable roles to remove.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const rows = RoleManager.createRoleButtons(removableRoles, 'remove');

        await interaction.reply({
          content: "Select the roles you want to remove:",
          components: rows,
          flags: MessageFlags.Ephemeral,
        });

      } else {
        await interaction.reply({ 
          content: "Invalid action. Please choose 'add' or 'remove'.", 
          flags: MessageFlags.Ephemeral 
        });
      }

    } catch (error) {
      console.error("Error executing roleSupport command:", error);
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "An error occurred while executing the command.",
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: "An error occurred while executing the command.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};

export default roleSupport;
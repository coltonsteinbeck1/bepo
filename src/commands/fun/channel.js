import { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { hasChannelManagementPermission } from '../../supabase/supabase.js';

const PERMISSION_DENIED_MESSAGE = "Permission denied, please speak with admin on this";

const channelCommand = {
    data: new SlashCommandBuilder()
        .setName('channel')
        .setDescription('Create or remove channels (requires Degenerate or Code Monkey role)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new channel')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the channel')
                        .setRequired(true)
                        .setMaxLength(100)
                )
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Type of channel')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Text', value: 'text' },
                            { name: 'Voice', value: 'voice' }
                        )
                )
                .addStringOption(option =>
                    option.setName('visibility')
                        .setDescription('Channel visibility')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Public', value: 'public' },
                            { name: 'Private', value: 'private' }
                        )
                )
                .addStringOption(option =>
                    option.setName('category')
                        .setDescription('Category to place the channel in (optional)')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option.setName('topic')
                        .setDescription('Channel topic (text channels only)')
                        .setRequired(false)
                        .setMaxLength(1024)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove an existing channel')
                .addChannelOption(option =>
                    option.setName('target')
                        .setDescription('Channel to remove')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for removing the channel')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;
        const member = interaction.member;

        if (!guild) {
            return interaction.reply({
                content: "This command can only be used in a server.",
                flags: MessageFlags.Ephemeral
            });
        }

        // Get user's role names
        const userRoleNames = member.roles.cache.map(role => role.name);

        // Check permission via database
        const hasPermission = await hasChannelManagementPermission(
            guild.id,
            userRoleNames,
            ['Degenerate', 'Code Monkey']
        );

        // Also allow Discord administrators
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

        if (!hasPermission && !isAdmin) {
            return interaction.reply({
                content: PERMISSION_DENIED_MESSAGE,
                flags: MessageFlags.Ephemeral
            });
        }

        // Check bot permissions
        const botMember = guild.members.cache.get(interaction.client.user.id);
        if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({
                content: "I don't have permission to manage channels. Please grant me the 'Manage Channels' permission.",
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            if (subcommand === 'create') {
                await handleCreate(interaction, guild);
            } else if (subcommand === 'remove') {
                await handleRemove(interaction, guild);
            }
        } catch (error) {
            console.error('Error executing channel command:', error);

            const errorMessage = error.message || 'An unknown error occurred';

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: `❌ Failed to execute command: ${errorMessage}`,
                    flags: MessageFlags.Ephemeral
                });
            } else {
                await interaction.reply({
                    content: `❌ Failed to execute command: ${errorMessage}`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
};

/**
 * Handle channel creation
 */
async function handleCreate(interaction, guild) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const name = interaction.options.getString('name');
    const type = interaction.options.getString('type');
    const visibility = interaction.options.getString('visibility');
    const categoryName = interaction.options.getString('category');
    const topic = interaction.options.getString('topic');

    // Validate channel name (Discord requirements)
    const sanitizedName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
    if (sanitizedName.length === 0) {
        return interaction.editReply({
            content: "❌ Invalid channel name. Please use alphanumeric characters, hyphens, or underscores."
        });
    }

    // Check if channel already exists
    const existingChannel = guild.channels.cache.find(
        ch => ch.name.toLowerCase() === sanitizedName.toLowerCase()
    );
    if (existingChannel) {
        return interaction.editReply({
            content: `❌ A channel with the name \`${sanitizedName}\` already exists.`
        });
    }

    // Find category if specified
    let category = null;
    if (categoryName) {
        category = guild.channels.cache.find(
            ch => ch.type === ChannelType.GuildCategory &&
                ch.name.toLowerCase() === categoryName.toLowerCase()
        );
        if (!category) {
            return interaction.editReply({
                content: `❌ Category \`${categoryName}\` not found. Please check the category name.`
            });
        }
    }

    // Determine channel type
    const channelType = type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;

    // Build permission overwrites for private channels
    const permissionOverwrites = [];
    if (visibility === 'private') {
        // Deny @everyone view permission
        permissionOverwrites.push({
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
        });
        // Allow the creator to view
        permissionOverwrites.push({
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels]
        });
    }

    // Create the channel
    const channelOptions = {
        name: sanitizedName,
        type: channelType,
        permissionOverwrites: permissionOverwrites.length > 0 ? permissionOverwrites : undefined,
        parent: category?.id,
        reason: `Created by ${interaction.user.tag} via /channel command`
    };

    // Add topic for text channels
    if (channelType === ChannelType.GuildText && topic) {
        channelOptions.topic = topic;
    }

    const newChannel = await guild.channels.create(channelOptions);

    // Build success embed
    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Channel Created')
        .addFields(
            { name: 'Name', value: `<#${newChannel.id}>`, inline: true },
            { name: 'Type', value: type === 'voice' ? '🔊 Voice' : '💬 Text', inline: true },
            { name: 'Visibility', value: visibility === 'private' ? '🔒 Private' : '🌐 Public', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Created by ${interaction.user.tag}` });

    if (category) {
        embed.addFields({ name: 'Category', value: category.name, inline: true });
    }

    if (topic && channelType === ChannelType.GuildText) {
        embed.addFields({ name: 'Topic', value: topic, inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle channel removal
 */
async function handleRemove(interaction, guild) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const targetChannel = interaction.options.getChannel('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Validate the channel exists and is manageable
    const channel = guild.channels.cache.get(targetChannel.id);
    if (!channel) {
        return interaction.editReply({
            content: "❌ Channel not found or already deleted."
        });
    }

    // Prevent deletion of system channels
    if (channel.id === guild.systemChannelId) {
        return interaction.editReply({
            content: "❌ Cannot delete the server's system channel."
        });
    }

    if (channel.id === guild.rulesChannelId) {
        return interaction.editReply({
            content: "❌ Cannot delete the server's rules channel."
        });
    }

    if (channel.id === guild.publicUpdatesChannelId) {
        return interaction.editReply({
            content: "❌ Cannot delete the server's community updates channel."
        });
    }

    const channelName = channel.name;
    const channelType = channel.type === ChannelType.GuildVoice ? '🔊 Voice' : '💬 Text';

    // Delete the channel
    await channel.delete(`Removed by ${interaction.user.tag}: ${reason}`);

    // Build success embed
    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🗑️ Channel Removed')
        .addFields(
            { name: 'Name', value: `#${channelName}`, inline: true },
            { name: 'Type', value: channelType, inline: true },
            { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `Removed by ${interaction.user.tag}` });

    await interaction.editReply({ embeds: [embed] });
}

export default channelCommand;

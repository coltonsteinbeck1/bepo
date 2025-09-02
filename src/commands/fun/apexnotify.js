import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import {
    manualCheckForUpdates,
    getMonitoringStatus,
    startMonitoring,
    stopMonitoring,
    setNotificationChannel,
    removeNotificationChannel
} from '../../utils/apexNotificationService.js';
import { RoleManager } from '../../utils/roleUtils.js';

const apexNotifyCommand = {
    data: new SlashCommandBuilder()
        .setName('apexnotify')
        .setDescription('Manage Apex Legends patch note notifications')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check the status of Apex notification monitoring')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('check')
                .setDescription('Manually check for new Apex Legends patch notes')
                .addBooleanOption(option =>
                    option
                        .setName('show_all')
                        .setDescription('Show all new patches (default: false, only most recent)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('setchannel')
                .setDescription('Set the channel for Apex notifications (admin only)')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The channel to send Apex notifications to')
                        .setRequired(true)
                        .addChannelTypes(0) // Text channel only
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('removechannel')
                .setDescription('Remove the current channel from Apex notifications (admin only)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start Apex patch note monitoring (admin only)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('Stop Apex patch note monitoring (admin only)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('testping')
                .setDescription('Test role mention functionality (admin only)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('help')
                .setDescription('Show detailed help for Apex notification commands')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'status':
                    await handleStatus(interaction);
                    break;
                case 'check':
                    await handleManualCheck(interaction);
                    break;
                case 'setchannel':
                    await handleSetChannel(interaction);
                    break;
                case 'removechannel':
                    await handleRemoveChannel(interaction);
                    break;
                case 'start':
                    await handleStart(interaction);
                    break;
                case 'stop':
                    await handleStop(interaction);
                    break;
                case 'testping':
                    await handleTestPing(interaction);
                    break;
                case 'help':
                    await handleHelp(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown subcommand. Use `/apexnotify help` for available commands.',
                        flags: MessageFlags.Ephemeral
                    });
            }
        } catch (error) {
            console.error('Error in apexnotify command:', error);

            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({
                    content: '❌ An error occurred while processing your request. Please try again later.',
                    flags: MessageFlags.Ephemeral
                });
            } else {
                await interaction.reply({
                    content: '❌ An error occurred while processing your request. Please try again later.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    },
};

/**
 * Handle status subcommand
 */
async function handleStatus(interaction) {
    const status = await getMonitoringStatus();

    const embed = new EmbedBuilder()
        .setColor(status.isRunning ? '#00FF00' : '#FF0000')
        .setTitle('🎮 Apex Legends Notification Status')
        .setTimestamp();

    // Monitoring status
    embed.addFields({
        name: '📡 Monitoring Status',
        value: status.isRunning ? '✅ **Running**' : '❌ **Stopped**',
        inline: true
    });

    // Check interval
    embed.addFields({
        name: '⏰ Check Interval',
        value: `${status.checkInterval / 60000} minutes`,
        inline: true
    });

    // Configured channels
    const channelList = status.channels.length > 0
        ? status.channels.map(id => `<#${id}>`).join('\n')
        : 'No channels configured';

    embed.addFields({
        name: '📢 Notification Channels',
        value: channelList,
        inline: false
    });

    // Role configuration
    embed.addFields({
        name: '🏷️ Mention Role',
        value: status.configuredRole ? `<@&${status.configuredRole}>` : 'Not configured',
        inline: true
    });

    // Last patch info
    if (status.lastPatch) {
        embed.addFields({
            name: '📝 Last Known Patch',
            value: `**${status.lastPatch.title || 'Unknown'}**\n*${status.lastPatch.date ? new Date(status.lastPatch.date).toLocaleDateString() : 'Unknown date'}*`,
            inline: false
        });
    } else {
        embed.addFields({
            name: '📝 Last Known Patch',
            value: 'No patch information stored',
            inline: false
        });
    }

    // Instructions
    embed.addFields({
        name: '💡 Quick Commands',
        value: '• `/apexnotify check` - Manual check for updates\n' +
            '• `/apexnotify setchannel` - Configure notification channel\n' +
            '• `/apexnotify help` - Detailed help',
        inline: false
    });

    embed.setFooter({ text: 'Apex Legends Notification System' });

    await interaction.reply({ embeds: [embed] });
}

/**
 * Handle manual check subcommand
 */
async function handleManualCheck(interaction) {
    await interaction.deferReply();

    // Check if user wants to see all new patches or just the most recent
    const showAll = interaction.options.getBoolean('show_all') || false;
    
    const result = await manualCheckForUpdates(showAll);

    const embed = new EmbedBuilder()
        .setTimestamp()
        .setTitle('🔍 Manual Apex Patch Check')
        .setFooter({ text: 'Apex Legends Notification System' });

    if (result.success) {
        embed.setColor('#B93038');
        embed.setDescription(result.message);

        if (result.newPatchCount > 0) {
            embed.addFields({
                name: '📊 Results',
                value: result.totalNewFound > 1 && !showAll
                    ? `Found **${result.totalNewFound}** new patches, sent **${result.newPatchCount}** (most recent)`
                    : `Found and sent **${result.newPatchCount}** new patch note(s)`,
                inline: true
            });

            if (result.latestPatch) {
                embed.addFields({
                    name: '📝 Latest Patch',
                    value: `**${result.latestPatch.title}**\n*${new Date(result.latestPatch.date).toLocaleDateString()}*`,
                    inline: false
                });
            }

            // Add helpful tip if multiple patches were found but not all shown
            if (result.totalNewFound > 1 && !showAll) {
                embed.addFields({
                    name: '💡 Tip',
                    value: `Use \`/apexnotify check show_all:true\` to send all ${result.totalNewFound} patches, or \`/apex count:${result.totalNewFound}\` to view them`,
                    inline: false
                });
            }
        } else {
            embed.addFields({
                name: '📊 Results',
                value: 'All up to date! ✅',
                inline: true
            });
        }
    } else {
        embed.setColor('#FF0000');
        embed.setDescription(result.message);
    }

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle set channel subcommand
 */
async function handleSetChannel(interaction) {
    // Check if user has admin permissions
    if (!interaction.member.permissions.has('Administrator')) {
        await interaction.reply({
            content: '❌ You need Administrator permissions to configure notification channels.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const channel = interaction.options.getChannel('channel');

    if (!channel.isTextBased()) {
        await interaction.reply({
            content: '❌ Please select a text channel for notifications.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const success = await setNotificationChannel(channel.id, interaction.guildId);

    if (success) {
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Notification Channel Set')
            .setDescription(`Apex Legends notifications will now be sent to ${channel}`)
            .addFields({
                name: '📡 Monitoring',
                value: 'Automatic monitoring has been started',
                inline: true
            })
            .addFields({
                name: '💡 Tip',
                value: 'Use `/apexnotify check` to test the system',
                inline: true
            })
            .setTimestamp()
            .setFooter({ text: 'Apex Legends Notification System' });

        await interaction.editReply({ embeds: [embed] });
    } else {
        await interaction.editReply({
            content: '❌ Failed to set notification channel. Please try again later.'
        });
    }
}

/**
 * Handle remove channel subcommand
 */
async function handleRemoveChannel(interaction) {
    // Check if user has admin permissions
    if (!interaction.member.permissions.has('Administrator')) {
        await interaction.reply({
            content: '❌ You need Administrator permissions to configure notification channels.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const success = await removeNotificationChannel(interaction.channelId);

    if (success) {
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('🗑️ Channel Removed')
            .setDescription('This channel has been removed from Apex notifications')
            .addFields({
                name: '💡 Note',
                value: 'If this was the last configured channel, monitoring has been stopped',
                inline: false
            })
            .setTimestamp()
            .setFooter({ text: 'Apex Legends Notification System' });

        await interaction.editReply({ embeds: [embed] });
    } else {
        await interaction.editReply({
            content: '❌ This channel was not configured for notifications or an error occurred.'
        });
    }
}

/**
 * Handle start monitoring subcommand
 */
async function handleStart(interaction) {
    // Check if user has admin permissions
    if (!interaction.member.permissions.has('Administrator')) {
        await interaction.reply({
            content: '❌ You need Administrator permissions to control monitoring.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const status = await getMonitoringStatus();

    if (status.isRunning) {
        await interaction.reply({
            content: '⚠️ Apex patch note monitoring is already running!',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (status.channels.length === 0) {
        await interaction.reply({
            content: '⚠️ No notification channels configured. Use `/apexnotify setchannel` first.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    startMonitoring();

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Monitoring Started')
        .setDescription('Apex Legends patch note monitoring is now active')
        .addFields({
            name: '📢 Channels',
            value: status.channels.map(id => `<#${id}>`).join('\n'),
            inline: true
        })
        .addFields({
            name: '⏰ Check Interval',
            value: `${status.checkInterval / 60000} minutes`,
            inline: true
        })
        .setTimestamp()
        .setFooter({ text: 'Apex Legends Notification System' });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

/**
 * Handle stop monitoring subcommand
 */
async function handleStop(interaction) {
    // Check if user has admin permissions
    if (!interaction.member.permissions.has('Administrator')) {
        await interaction.reply({
            content: '❌ You need Administrator permissions to control monitoring.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const stopped = stopMonitoring();

    if (stopped) {
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⏹️ Monitoring Stopped')
            .setDescription('Apex Legends patch note monitoring has been stopped')
            .addFields({
                name: '💡 Note',
                value: 'Use `/apexnotify start` to resume monitoring',
                inline: false
            })
            .setTimestamp()
            .setFooter({ text: 'Apex Legends Notification System' });

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else {
        await interaction.reply({
            content: '⚠️ Monitoring was not running.',
            flags: MessageFlags.Ephemeral
        });
    }
}

/**
 * Handle test ping subcommand
 */
async function handleTestPing(interaction) {
    // Check if user has admin permissions
    if (!interaction.member.permissions.has('Administrator')) {
        await interaction.reply({
            content: '❌ You need Administrator permissions to test notifications.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const roleId = process.env.APEX_ROLE;
    const roleManager = new RoleManager();

    let content = '🧪 **Test Notification**\nThis is a test of the Apex Legends notification system.';

    if (roleId) {
        const role = await roleManager.getRole(interaction.guild, roleId);
        if (role) {
            content += ` <@&${roleId}>`;
        } else {
            content += '\n⚠️ Configured role not found in this server.';
        }
    } else {
        content += '\n💡 No role configured for mentions (set APEX_ROLE in environment).';
    }

    const embed = new EmbedBuilder()
        .setColor('#FF6600')
        .setTitle('🧪 Test Notification')
        .setDescription('This is a test notification for the Apex Legends system')
        .addFields({
            name: '🎮 Game',
            value: 'Apex Legends',
            inline: true
        })
        .addFields({
            name: '📡 Status',
            value: 'System Operational',
            inline: true
        })
        .setTimestamp()
        .setFooter({ text: 'Test Notification - Apex Legends System' })
        .setThumbnail('https://media.contentapi.ea.com/content/dam/apex-legends/common/apex-legends-bloodhound-edition.jpg.adapt.320w.jpg');

    await interaction.reply({
        content,
        embeds: [embed]
    });
}

/**
 * Handle help subcommand
 */
async function handleHelp(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#FF6600')
        .setTitle('🎮 Apex Legends Notification Help')
        .setDescription('Complete guide to using the Apex notification system')
        .addFields({
            name: '📋 Available Commands',
            value:
                '**`/apexnotify status`** - View current monitoring status\n' +
                '**`/apexnotify check`** - Check for new patch notes (most recent only)\n' +
                '**`/apexnotify check show_all:true`** - Check and send all new patches\n' +
                '**`/apexnotify setchannel`** - Set notification channel (admin)\n' +
                '**`/apexnotify removechannel`** - Remove current channel (admin)\n' +
                '**`/apexnotify start`** - Start monitoring (admin)\n' +
                '**`/apexnotify stop`** - Stop monitoring (admin)\n' +
                '**`/apexnotify testping`** - Test role mentions (admin)',
            inline: false
        })
        .addFields({
            name: '🎯 Quick Setup Guide',
            value:
                '1. **Set Channel**: Use `/apexnotify setchannel` to choose where notifications go\n' +
                '2. **Test System**: Run `/apexnotify check` to verify everything works\n' +
                '3. **Monitor Status**: Use `/apexnotify status` to check if monitoring is active\n' +
                '4. **Get Updates**: Use `/apex` command to view latest patch notes',
            inline: false
        })
        .addFields({
            name: '🔧 Admin Features',
            value:
                '• **Automatic Monitoring**: Checks for new patches every 10 minutes\n' +
                '• **Role Mentions**: Configure APEX_ROLE environment variable\n' +
                '• **Multiple Channels**: Support for notifications in multiple channels\n' +
                '• **Manual Override**: Force checks and start/stop monitoring',
            inline: false
        })
        .addFields({
            name: '📝 Related Commands',
            value:
                '**`/apex`** - View latest patch notes with filters\n' +
                '**`/apex count:3`** - Show last 3 updates\n' +
                '**`/apex keyword:season`** - Search for specific content\n' +
                '**`/apex refresh:true`** - Force refresh patch data',
            inline: false
        })
        .addFields({
            name: '⚙️ Notification Behavior',
            value:
                '• **Automatic Monitoring**: Only sends the most recent patch when new updates are detected\n' +
                '• **Manual Checks**: Send only the most recent by default (use `show_all:true` for all new patches)\n' +
                '• **Multiple Patches**: Use `/apex count:X` to view multiple patches without sending notifications\n' +
                '• **System monitors EA\'s official Apex Legends news feed**',
            inline: false
        })
        .addFields({
            name: '🔧 Configuration',
            value:
                '• Only administrators can configure notification settings\n' +
                '• All users can check for updates and view patch notes\n' +
                '• Supports role mentions and multiple notification channels\n' +
                '• Automatic monitoring checks every 10 minutes',
            inline: false
        })
        .addFields({
            name: '🐛 Troubleshooting',
            value:
                '• **No notifications?** Check channel permissions and monitoring status\n' +
                '• **Missing patches?** Try manual check or refresh cache\n' +
                '• **Role not working?** Verify APEX_ROLE environment variable\n' +
                '• **Need help?** Contact an administrator',
            inline: false
        })
        .setTimestamp()
        .setFooter({ text: 'Apex Legends Notification System • EA Official Feed' })
        .setThumbnail('https://media.contentapi.ea.com/content/dam/apex-legends/common/apex-legends-bloodhound-edition.jpg.adapt.320w.jpg');

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

export default apexNotifyCommand;

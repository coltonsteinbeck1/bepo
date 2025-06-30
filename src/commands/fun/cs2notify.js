import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { 
  manualCheckForUpdates, 
  getMonitoringStatus,
  startMonitoring,
  stopMonitoring,
  setNotificationChannel
} from '../../utils/cs2NotificationService.js';
import { RoleManager } from '../../utils/roleUtils.js';

const cs2NotifyCommand = {
  data: new SlashCommandBuilder()
    .setName('cs2notify')
    .setDescription('Manage CS2 patch note notifications')
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check the status of CS2 notification monitoring')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('check')
        .setDescription('Manually check for new CS2 patch notes')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('setchannel')
        .setDescription('Set the channel for CS2 notifications (admin only)')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('The channel to send CS2 notifications to')
            .setRequired(true)
            .addChannelTypes(0) // Text channel only
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Start CS2 patch note monitoring (admin only)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stop')
        .setDescription('Stop CS2 patch note monitoring (admin only)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('testping')
        .setDescription('Test role mention functionality (admin only)')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

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
        
      case 'start':
        await handleStart(interaction);
        break;
        
      case 'stop':
        await handleStop(interaction);
        break;
        
      case 'testping':
        await handleTestPing(interaction);
        break;
    }
  },
};

/**
 * Handle status subcommand
 */
async function handleStatus(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  const status = await getMonitoringStatus();
  
  const embed = new EmbedBuilder()
    .setColor('#FF6B00')
    .setTitle('🎮 CS2 Notification Service Status')
    .setTimestamp();

  embed.addFields(
    {
      name: '🔄 Monitoring Status',
      value: status.isRunning ? '✅ Running' : '❌ Stopped',
      inline: true
    },
    {
      name: '📺 Configured Channels',
      value: status.channelsConfigured.toString(),
      inline: true
    },
    {
      name: '⏰ Check Interval',
      value: `${status.checkInterval} minutes`,
      inline: true
    }
  );

  // Add guild information
  if (status.guildId) {
    let guildName = 'Unknown';
    try {
      const guild = await interaction.client.guilds.fetch(status.guildId);
      guildName = guild.name;
    } catch (error) {
      console.warn(`Could not fetch guild ${status.guildId}:`, error.message);
    }
    
    embed.addFields({
      name: '🏰 Target Guild',
      value: `${guildName} (${status.guildId})`,
      inline: true
    });
  }

  // Add role information
  if (status.cs2RoleId) {
    embed.addFields({
      name: '🎯 Notification Role',
      value: `<@&${status.cs2RoleId}>`,
      inline: true
    });
  }

  if (status.channels.length > 0) {
    // Resolve channel names for better display
    const channelDisplay = await Promise.all(
      status.channels.map(async (channelId) => {
        try {
          const channel = await interaction.client.channels.fetch(channelId);
          return `<#${channelId}> (${channel.name})`;
        } catch (error) {
          return `<#${channelId}> (unknown)`;
        }
      })
    );
    
    embed.addFields({
      name: '📋 Notification Channels',
      value: channelDisplay.join('\n') || 'None configured',
      inline: false
    });
    
    // Show source of channels with details
    if (status.envChannels.length > 0 || status.dynamicChannels.length > 0) {
      let sourceInfo = '';
      
      if (status.envChannels.length > 0) {
        const envChannelDetails = await Promise.all(
          status.envChannels.map(async (channelId) => {
            try {
              const channel = await interaction.client.channels.fetch(channelId);
              return `<#${channelId}> (${channel.name})`;
            } catch (error) {
              return `<#${channelId}> (unknown)`;
            }
          })
        );
        sourceInfo += `📄 Environment: ${status.envChannels.length} channel(s)\n`;
        sourceInfo += `   ${envChannelDetails.join('\n   ')}\n`;
      }
      
      if (status.dynamicChannels.length > 0) {
        const dynamicChannelDetails = await Promise.all(
          status.dynamicChannels.map(async (channelId) => {
            try {
              const channel = await interaction.client.channels.fetch(channelId);
              return `<#${channelId}> (${channel.name})`;
            } catch (error) {
              return `<#${channelId}> (unknown)`;
            }
          })
        );
        sourceInfo += `⚙️ User-configured: ${status.dynamicChannels.length} channel(s)\n`;
        sourceInfo += `   ${dynamicChannelDetails.join('\n   ')}`;
      }
      
      embed.addFields({
        name: '📊 Channel Sources',
        value: sourceInfo,
        inline: false
      });
    }
  } else {
    embed.addFields({
      name: '⚠️ Configuration',
      value: 'No notification channels configured.\nUse `/cs2notify setchannel` to set a channel for notifications.',
      inline: false
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle manual check subcommand
 */
async function handleManualCheck(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  try {
    const success = await manualCheckForUpdates();
    
    const embed = new EmbedBuilder()
      .setColor(success ? '#00FF00' : '#FF0000')
      .setTitle('🔍 Manual CS2 Update Check')
      .setDescription(
        success 
          ? '✅ Successfully checked for new CS2 patch notes.\nIf new updates were found, notifications have been sent to configured channels.'
          : '❌ Failed to check for new CS2 patch notes. Check console logs for details.'
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('❌ Check Failed')
      .setDescription(`Error: ${error.message}`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * Handle set channel subcommand
 */
async function handleSetChannel(interaction) {
  // Check for admin permissions (both Discord Administrator and CODE_MONKEY)
  if (!RoleManager.isAdmin(interaction.member)) {
    await interaction.reply({
      content: '❌ You need Administrator permissions or be a server admin to set CS2 notification channels.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  try {
    const channel = interaction.options.getChannel('channel');
    
    // Validate channel is in the same guild
    if (channel.guild.id !== interaction.guild.id) {
      await interaction.editReply({
        content: '❌ Channel must be in the same server as this command.',
      });
      return;
    }
    
    // Check if bot has permissions in the target channel
    const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
    const permissions = channel.permissionsFor(botMember);
    
    if (!permissions.has(['SendMessages', 'EmbedLinks'])) {
      await interaction.editReply({
        content: `❌ I don't have permission to send messages and embed links in ${channel}. Please check my permissions.`,
      });
      return;
    }
    
    // Set the notification channel
    const success = await setNotificationChannel(channel.id, interaction.guild.id);
    
    if (success) {
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ CS2 Notification Channel Set')
        .setDescription(`CS2 patch note notifications will now be sent to ${channel}.`)
        .addFields(
          {
            name: '📺 Channel',
            value: channel.toString(),
            inline: true
          },
          {
            name: '🏰 Guild',
            value: interaction.guild.name,
            inline: true
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      
      // Send a test message to the channel to confirm it works
      await channel.send({
        content: '🎮 **CS2 Notifications Configured!**',
        embeds: [new EmbedBuilder()
          .setColor('#FF6B00')
          .setTitle('CS2 Notification Channel Set')
          .setDescription('This channel will now receive CS2 patch note notifications when new updates are released.')
          .addFields({
            name: '🔔 What to expect',
            value: '• Automatic notifications when new CS2 updates are detected\n• Rich embeds with patch note details\n• Links to official Counter-Strike updates page\n• Role mentions (if configured)',
            inline: false
          })
          .setFooter({ text: 'Use /cs2notify status to check configuration' })
          .setTimestamp()
        ]
      });
      
    } else {
      await interaction.editReply({
        content: '❌ Failed to set notification channel. Check console logs for details.',
      });
    }
    
  } catch (error) {
    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('❌ Set Channel Failed')
      .setDescription(`Error: ${error.message}`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * Handle start subcommand
 */
async function handleStart(interaction) {
  // Check for admin permissions (both Discord Administrator and CODE_MONKEY)
  if (!RoleManager.isAdmin(interaction.member)) {
    await interaction.reply({
      content: '❌ You need Administrator permissions or be a server admin to manage CS2 notifications.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  try {
    startMonitoring();
    
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ CS2 Monitoring Started')
      .setDescription('CS2 patch note monitoring has been started.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('❌ Start Failed')
      .setDescription(`Error: ${error.message}`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * Handle stop subcommand
 */
async function handleStop(interaction) {
  // Check for admin permissions (both Discord Administrator and CODE_MONKEY)
  if (!RoleManager.isAdmin(interaction.member)) {
    await interaction.reply({
      content: '❌ You need Administrator permissions or be a server admin to manage CS2 notifications.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  try {
    stopMonitoring();
    
    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('🛑 CS2 Monitoring Stopped')
      .setDescription('CS2 patch note monitoring has been stopped.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('❌ Stop Failed')
      .setDescription(`Error: ${error.message}`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * Handle test ping subcommand
 */
async function handleTestPing(interaction) {
  // Check for admin permissions (both Discord Administrator and CODE_MONKEY)
  if (!RoleManager.isAdmin(interaction.member)) {
    await interaction.reply({
      content: '❌ You need Administrator permissions or be a server admin to test role mentions.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  try {
    const cs2RoleId = process.env.CS2_ROLE;
    const guildId = process.env.GUILD_BZ;
    
    if (!cs2RoleId) {
      await interaction.editReply({
        content: '❌ CS2_ROLE not configured in environment variables.',
      });
      return;
    }
    
    if (!guildId || interaction.guild.id !== guildId) {
      await interaction.editReply({
        content: '❌ Command must be run in the configured guild.',
      });
      return;
    }
    
    // Check if role exists
    let role;
    try {
      role = await interaction.guild.roles.fetch(cs2RoleId);
    } catch (error) {
      await interaction.editReply({
        content: `❌ Could not fetch CS2 role (${cs2RoleId}). Role may not exist.`,
      });
      return;
    }
    
    if (!role) {
      await interaction.editReply({
        content: `❌ CS2 role not found in this server. Check role ID: ${cs2RoleId}`,
      });
      return;
    }
    
    // Check bot permissions
    const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
    const botPermissions = interaction.channel.permissionsFor(botMember);
    
    const hasBasicPerms = botPermissions.has(['SendMessages', 'EmbedLinks']);
    const hasMentionPerms = botPermissions.has('MentionEveryone');
    
    // Check role settings
    const roleMentionable = role.mentionable;
    
    // Create test result embed
    const embed = new EmbedBuilder()
      .setColor(hasBasicPerms && hasMentionPerms && roleMentionable ? '#00FF00' : '#FFA500')
      .setTitle('🧪 Role Mention Test Results')
      .setTimestamp();

    embed.addFields(
      {
        name: '🎯 Role Information',
        value: `**Name:** ${role.name}\n**ID:** ${role.id}\n**Members:** ${role.members.size}`,
        inline: true
      },
      {
        name: '🤖 Bot Permissions',
        value: `**Send Messages:** ${hasBasicPerms ? '✅' : '❌'}\n**Mention Everyone:** ${hasMentionPerms ? '✅' : '❌'}`,
        inline: true
      },
      {
        name: '⚙️ Role Settings',
        value: `**Mentionable:** ${roleMentionable ? '✅' : '❌'}\n**Position:** ${role.position}`,
        inline: true
      }
    );
    
    // Add diagnosis
    let diagnosis = '';
    if (!hasBasicPerms) {
      diagnosis += '❌ Bot lacks basic messaging permissions\n';
    }
    if (!hasMentionPerms) {
      diagnosis += '❌ Bot lacks "Mention Everyone" permission (required for role mentions)\n';
    }
    if (!roleMentionable) {
      diagnosis += '❌ Role is not set as mentionable\n';
    }
    if (hasBasicPerms && hasMentionPerms && roleMentionable) {
      diagnosis = '✅ All requirements met for role mentions!';
    }
    
    embed.addFields({
      name: '🔍 Diagnosis',
      value: diagnosis || '⚠️ Partial setup - check requirements',
      inline: false
    });
    
    await interaction.editReply({ embeds: [embed] });
    
    // If everything looks good, send a test ping
    if (hasBasicPerms && hasMentionPerms && roleMentionable) {
      try {
        await interaction.followUp({
          content: `🧪 **Test Role Mention:** ${role} - This is a test of the CS2 notification system!`,
          embeds: [new EmbedBuilder()
            .setColor('#FF6B00')
            .setTitle('🎮 CS2 Role Mention Test')
            .setDescription('If you received a ping notification, role mentions are working correctly!')
            .addFields({
              name: '✅ What this means',
              value: 'CS2 patch note notifications will successfully ping role members when new updates are detected.',
              inline: false
            })
            .setFooter({ text: 'Test completed successfully' })
            .setTimestamp()
          ]
        });
      } catch (error) {
        await interaction.followUp({
          content: '❌ Failed to send test mention. Check console logs for details.',
          flags: MessageFlags.Ephemeral
        });
      }
    }
    
  } catch (error) {
    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('❌ Test Failed')
      .setDescription(`Error: ${error.message}`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

export default cs2NotifyCommand;

import { EmbedBuilder } from 'discord.js';
import { getCachedPatchNotes } from './cs2Utils.js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

const LAST_PATCH_FILE = path.join(process.cwd(), 'temp', 'last-cs2-patch.json');
const CHANNEL_CONFIG_FILE = path.join(process.cwd(), 'temp', 'cs2-channel-config.json');
const CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes
const NOTIFICATION_CHANNELS = process.env.CS2_NOTIFICATION_CHANNELS?.split(',') || [];
const CS2_ROLE_ID = process.env.CS2_ROLE;
const GUILD_ID = process.env.GUILD_BZ;

let monitoringInterval = null;
let botClient = null;
let dynamicChannelConfig = null;

/**
 * Initialize the CS2 notification monitoring service
 * @param {Client} client - Discord bot client
 */
async function initializeCS2Monitoring(client) {
  botClient = client;
  
  console.log('🎮 Initializing CS2 patch note monitoring...');
  
  // Get user-submitted channels only (no environment channels)
  const userChannels = await getNotificationChannels();
  
  // Start monitoring if any channels are configured
  if (userChannels.length > 0) {
    startMonitoring();
    console.log(`📡 CS2 monitoring started for ${userChannels.length} user-submitted channels:`);
    console.log(`  - User channels: ${userChannels.join(', ')}`);
    console.log(`  - Environment channels: DISABLED (user-submitted only)`);
  } else {
    console.log('⚠️  No CS2 notification channels configured.');
    console.log('   - Use /cs2notify setchannel to configure notification channels');
    console.log('   - Environment channels are disabled (user-submitted only)');
  }
}

/**
 * Start the periodic monitoring for new patch notes
 */
function startMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  
  // Check immediately, then every interval
  checkForNewPatchNotes();
  
  monitoringInterval = setInterval(() => {
    checkForNewPatchNotes();
  }, CHECK_INTERVAL);
}

/**
 * Stop the monitoring service
 */
function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('🛑 CS2 patch note monitoring stopped');
  }
}

/**
 * Load channel configuration from file
 * @returns {Object|null} Channel configuration or null
 */
async function loadChannelConfig() {
  try {
    const data = await fs.readFile(CHANNEL_CONFIG_FILE, 'utf8');
    dynamicChannelConfig = JSON.parse(data);
    return dynamicChannelConfig;
  } catch (error) {
    // File doesn't exist or is invalid - this is normal
    dynamicChannelConfig = null;
    return null;
  }
}

/**
 * Save channel configuration to file
 * @param {Object} config - Channel configuration
 */
async function saveChannelConfig(config) {
  try {
    // Ensure temp directory exists
    await fs.mkdir(path.dirname(CHANNEL_CONFIG_FILE), { recursive: true });
    
    await fs.writeFile(CHANNEL_CONFIG_FILE, JSON.stringify(config, null, 2));
    dynamicChannelConfig = config;
  } catch (error) {
    console.error('❌ Failed to save channel config:', error.message);
    throw error;
  }
}

/**
 * Set notification channel for a specific guild
 * @param {string} channelId - Channel ID
 * @param {string} guildId - Guild ID
 * @returns {boolean} Success status
 */
async function setNotificationChannel(channelId, guildId) {
  try {
    // Load existing config or create new one
    let config = await loadChannelConfig() || {};
    
    // Set the channel for this guild
    config[guildId] = {
      channelId: channelId,
      setAt: Date.now(),
      setBy: 'admin'
    };
    
    // Save the configuration
    await saveChannelConfig(config);
    
    console.log(`✅ CS2 notification channel set: ${channelId} for guild: ${guildId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to set notification channel:', error.message);
    return false;
  }
}

/**
 * Get notification channels (ONLY user-submitted channels via /cs2notify setchannel)
 * Environment channels are completely ignored
 * @returns {Array} Array of channel IDs to notify
 */
async function getNotificationChannels() {
  const channels = []; // NO environment channels - start empty
  
  // Load dynamic configuration (user-submitted channels only)
  const config = await loadChannelConfig();
  if (config) {
    // Add only dynamically configured channels (set by users)
    Object.values(config).forEach(guildConfig => {
      if (guildConfig.channelId) {
        channels.push(guildConfig.channelId);
      }
    });
  }
  
  // Remove duplicates and filter empty values
  return [...new Set(channels.filter(Boolean))];
}

/**
 * Check for new patch notes and send notifications
 */
async function checkForNewPatchNotes() {
  try {
    console.log('🔍 Checking for new CS2 patch notes...');
    
    // Get current patch notes
    const currentPatchNotes = await getCachedPatchNotes(true); // Force refresh
    
    if (!currentPatchNotes || currentPatchNotes.length === 0) {
      console.log('📝 No patch notes found');
      return;
    }
    
    // Get the latest patch note
    const latestPatchNote = currentPatchNotes[0];
    
    // Read last known patch note
    const lastKnownPatch = await getLastKnownPatch();
    
    // Check if this is a new patch note
    if (!lastKnownPatch || latestPatchNote.gid !== lastKnownPatch.gid) {
      console.log('🆕 New CS2 patch note detected!');
      
      // Save the new latest patch
      await saveLastKnownPatch(latestPatchNote);
      
      // Send notifications (skip if this is the first run and we have no previous data)
      if (lastKnownPatch) {
        await sendPatchNoteNotification(latestPatchNote);
      } else {
        console.log('📋 First run - saving current patch note as baseline');
      }
    } else {
      console.log('✅ No new patch notes');
    }
  } catch (error) {
    console.error('❌ Error checking for new patch notes:', error.message);
  }
}

/**
 * Send patch note notification to configured channels
 * @param {Object} patchNote - The new patch note object
 */
async function sendPatchNoteNotification(patchNote) {
  if (!botClient) {
    console.log('⚠️  No bot client available');
    return;
  }
  
  // Get user-submitted notification channels only (no environment channels)
  const userChannels = await getNotificationChannels();
  
  if (userChannels.length === 0) {
    console.log('⚠️  No user-submitted notification channels configured');
    console.log('   Use /cs2notify setchannel to set up CS2 notifications');
    return;
  }
  
  console.log(`📡 Sending CS2 notification to ${userChannels.length} user-submitted channels`);
  
  // Validate guild and role first
  const validationResult = await validateGuildAndRole();
  if (!validationResult.isValid) {
    console.error('❌ Guild/Role validation failed:', validationResult.error);
    return;
  }
  
  const embed = createPatchNoteNotificationEmbed(patchNote);
  
  // Prepare notification content with role mention
  let notificationContent = '🚨 **New CS2 Update Released!**';
  if (validationResult.role) {
    notificationContent = `🚨 **New CS2 Update Released!** ${validationResult.role}`;
  }
  
  for (const channelId of userChannels) {
    try {
      const channel = await botClient.channels.fetch(channelId.trim());
      
      if (!channel || !channel.isTextBased()) {
        console.error(`❌ Invalid user channel or not text-based: ${channelId}`);
        continue;
      }
      
      // Note: User-submitted channels can be in any guild the bot has access to
      
      await channel.send({ 
        content: notificationContent,
        embeds: [embed] 
      });
      console.log(`📢 Sent CS2 notification to user channel: ${channelId} in guild: ${channel.guild?.name || 'Unknown'}`);
    } catch (error) {
      console.error(`❌ Failed to send notification to user channel ${channelId}:`, error.message);
    }
  }
}

/**
 * Validate guild and role configuration
 * @returns {Object} Validation result with isValid flag and role mention
 */
async function validateGuildAndRole() {
  try {
    // Check if guild is accessible
    if (!GUILD_ID) {
      return { isValid: false, error: 'No GUILD_ID configured' };
    }
    
    const guild = await botClient.guilds.fetch(GUILD_ID);
    if (!guild) {
      return { isValid: false, error: `Guild ${GUILD_ID} not found or bot not in guild` };
    }
    
    console.log(`✅ Guild validation passed: ${guild.name} (${guild.id})`);
    
    // Check if CS2 role exists (optional but recommended)
    if (CS2_ROLE_ID) {
      try {
        const role = await guild.roles.fetch(CS2_ROLE_ID);
        if (role) {
          console.log(`✅ CS2 role found: ${role.name} (${role.id})`);
          return { 
            isValid: true, 
            guild, 
            role: `<@&${role.id}>` // Role mention format
          };
        } else {
          console.warn(`⚠️ CS2 role ${CS2_ROLE_ID} not found in guild ${guild.name}`);
          return { isValid: true, guild, role: null };
        }
      } catch (roleError) {
        console.warn(`⚠️ Could not fetch CS2 role: ${roleError.message}`);
        return { isValid: true, guild, role: null };
      }
    }
    
    return { isValid: true, guild, role: null };
  } catch (error) {
    return { isValid: false, error: error.message };
  }
}

/**
 * Create a Discord embed for patch note notifications
 * @param {Object} patchNote - The patch note object
 * @returns {EmbedBuilder} Discord embed
 */
function createPatchNoteNotificationEmbed(patchNote) {
  const embed = new EmbedBuilder()
    .setColor('#FF6B00') // CS2 orange
    .setTitle('🎮 New Counter-Strike 2 Update!')
    .setURL('https://www.counter-strike.net/news/updates')
    .setTimestamp()
    .setThumbnail('https://cdn.akamai.steamstatic.com/apps/csgo/images/csgo_react/global/logo_cs2.svg');
  
  // Add patch note title
  embed.addFields({
    name: '📝 Update Title',
    value: patchNote.title || 'CS2 Update',
    inline: false
  });
  
  // Add date
  embed.addFields({
    name: '📅 Release Date',
    value: patchNote.date.toLocaleDateString() || 'Unknown',
    inline: true
  });
  
  // Add author if available
  if (patchNote.author) {
    embed.addFields({
      name: '👤 Author',
      value: patchNote.author,
      inline: true
    });
  }
  
  // Add content preview
  if (patchNote.content) {
    const contentPreview = patchNote.content.length > 500 
      ? patchNote.content.substring(0, 500) + '...' 
      : patchNote.content;
    
    embed.addFields({
      name: '📋 Update Preview',
      value: contentPreview || 'Check the official updates page for details.',
      inline: false
    });
  }
  
  embed.setFooter({ 
    text: 'Click title to view full update details | Auto-notification system' 
  });
  
  return embed;
}

/**
 * Get the last known patch note from storage
 * @returns {Object|null} Last known patch note or null
 */
async function getLastKnownPatch() {
  try {
    const data = await fs.readFile(LAST_PATCH_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is invalid - this is normal for first run
    return null;
  }
}

/**
 * Save the last known patch note to storage
 * @param {Object} patchNote - Patch note to save
 */
async function saveLastKnownPatch(patchNote) {
  try {
    // Ensure temp directory exists
    await fs.mkdir(path.dirname(LAST_PATCH_FILE), { recursive: true });
    
    // Save just the essential data
    const saveData = {
      gid: patchNote.gid,
      title: patchNote.title,
      date: patchNote.date,
      timestamp: Date.now()
    };
    
    await fs.writeFile(LAST_PATCH_FILE, JSON.stringify(saveData, null, 2));
  } catch (error) {
    console.error('❌ Failed to save last known patch:', error.message);
  }
}

/**
 * Manually trigger a check for new patch notes (for testing/admin use)
 * @returns {boolean} True if check was successful
 */
async function manualCheckForUpdates() {
  try {
    await checkForNewPatchNotes();
    return true;
  } catch (error) {
    console.error('Manual check failed:', error);
    return false;
  }
}

/**
 * Get monitoring status
 * @returns {Promise<Object>} Status information
 */
async function getMonitoringStatus() {
  const userChannels = await getNotificationChannels();
  const config = await loadChannelConfig();
  
  return {
    isRunning: monitoringInterval !== null,
    channelsConfigured: userChannels.length,
    channels: userChannels,
    envChannels: [], // Environment channels disabled
    dynamicChannels: config ? Object.values(config).map(c => c.channelId) : [],
    checkInterval: CHECK_INTERVAL / 1000 / 60, // minutes
    lastCheckFile: LAST_PATCH_FILE,
    channelConfigFile: CHANNEL_CONFIG_FILE,
    guildId: GUILD_ID,
    cs2RoleId: CS2_ROLE_ID,
    environmentChannelsDisabled: true // Flag to indicate env channels are disabled
  };
}

export {
  initializeCS2Monitoring,
  startMonitoring,
  stopMonitoring,
  checkForNewPatchNotes,
  manualCheckForUpdates,
  getMonitoringStatus,
  setNotificationChannel,
  getNotificationChannels,
  sendPatchNoteNotification,
  createPatchNoteNotificationEmbed
};

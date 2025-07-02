import { EmbedBuilder } from 'discord.js';
import { getCachedPatchNotes } from './apexUtils.js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

// Use test directory when in test mode
const tempDir = process.env.TEST_MODE === 'true' 
  ? path.join(process.cwd(), 'temp', 'test')
  : path.join(process.cwd(), 'temp');

const LAST_PATCH_FILE = path.join(tempDir, 'last-apex-patch.json');
const CHANNEL_CONFIG_FILE = path.join(tempDir, 'apex-channel-config.json');
const CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes
const NOTIFICATION_CHANNELS = process.env.APEX_NOTIFICATION_CHANNELS?.split(',') || [];
const APEX_ROLE_ID = process.env.APEX_ROLE;
const GUILD_ID = process.env.GUILD_BZ;

let monitoringInterval = null;
let botClient = null;
let dynamicChannelConfig = null;

/**
 * Initialize the Apex notification monitoring service
 * @param {Client} client - Discord bot client
 */
async function initializeApexMonitoring(client) {
  botClient = client;
  
  console.log('🎮 Initializing Apex Legends patch note monitoring...');
  
  // Get user-submitted channels only (no environment channels)
  const userChannels = await getNotificationChannels();
  
  // Start monitoring if any channels are configured
  if (userChannels.length > 0) {
    startMonitoring();
    console.log(`📡 Apex monitoring started for ${userChannels.length} user-submitted channels:`);
    console.log(`  - User channels: ${userChannels.join(', ')}`);
    console.log(`  - Environment channels: DISABLED (user-submitted only)`);
  } else {
    console.log('⚠️  No Apex notification channels configured.');
    console.log('   - Use /apexnotify setchannel to configure notification channels');
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
  
  console.log(`🔄 Starting Apex patch note monitoring (checking every ${CHECK_INTERVAL / 60000} minutes)`);
  
  monitoringInterval = setInterval(async () => {
    try {
      await checkForNewPatchNotes();
    } catch (error) {
      console.error('Error in Apex monitoring interval:', error);
    }
  }, CHECK_INTERVAL);
  
  // Initial check
  setTimeout(() => checkForNewPatchNotes(), 5000);
}

/**
 * Stop the monitoring service
 */
function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('⏹️  Apex patch note monitoring stopped');
    return true;
  }
  return false;
}

/**
 * Check for new patch notes and send notifications
 */
async function checkForNewPatchNotes() {
  try {
    console.log('🔍 Checking for new Apex patch notes...');
    
    const patchNotes = await getCachedPatchNotes(true); // Force refresh
    
    if (!patchNotes || patchNotes.length === 0) {
      console.log('⚠️  No Apex patch notes found');
      return;
    }
    
    const lastPatch = await getLastPatchInfo();
    const newPatchNotes = [];
    
    for (const patch of patchNotes) {
      if (!lastPatch || patch.id !== lastPatch.id) {
        newPatchNotes.push(patch);
      } else {
        break; // Stop when we hit a known patch
      }
    }
    
    if (newPatchNotes.length > 0) {
      console.log(`🆕 Found ${newPatchNotes.length} new Apex patch note(s)`);
      
      // Send single combined notification for all new patches
      await sendCombinedPatchNotification(newPatchNotes);
      
      // Update last patch info
      await saveLastPatchInfo(patchNotes[0]);
    } else {
      console.log('✅ No new Apex patch notes found');
    }
    
  } catch (error) {
    console.error('Error checking for new Apex patch notes:', error);
  }
}

/**
 * Send patch note notification to configured channels
 * @param {Object} patchNote - Patch note object
 */
async function sendPatchNotification(patchNote) {
  const channels = await getNotificationChannels();
  
  if (channels.length === 0) {
    console.log('⚠️  No notification channels configured for Apex updates');
    return;
  }
  
  const embed = createPatchNotificationEmbed(patchNote);
  
  for (const channelId of channels) {
    try {
      const channel = await botClient.channels.fetch(channelId);
      
      if (channel) {
        let content = '🔥 **New Apex Legends Update!**';
        
        // Add role mention if configured
        if (APEX_ROLE_ID) {
          content += ` <@&${APEX_ROLE_ID}>`;
        }
        
        await channel.send({
          content,
          embeds: [embed]
        });
        
        console.log(`📨 Sent Apex patch notification to channel: ${channelId}`);
      }
    } catch (error) {
      console.error(`Error sending Apex notification to channel ${channelId}:`, error);
    }
  }
}

/**
 * Send combined patch note notification for multiple patches
 * @param {Array} patchNotes - Array of patch note objects
 */
async function sendCombinedPatchNotification(patchNotes) {
  const channels = await getNotificationChannels();
  
  if (channels.length === 0) {
    console.log('⚠️  No notification channels configured for Apex updates');
    return;
  }
  
  // Create appropriate embed based on count
  const embed = patchNotes.length === 1 
    ? createPatchNotificationEmbed(patchNotes[0])
    : createCombinedPatchNotificationEmbed(patchNotes);
  
  for (const channelId of channels) {
    try {
      const channel = await botClient.channels.fetch(channelId);
      
      if (channel) {
        let content = patchNotes.length === 1 
          ? '🔥 **New Apex Legends Update!**'
          : `🔥 **${patchNotes.length} New Apex Legends Updates!**`;
        
        // Add role mention if configured
        if (APEX_ROLE_ID) {
          content += ` <@&${APEX_ROLE_ID}>`;
        }
        
        await channel.send({
          content,
          embeds: [embed]
        });
        
        console.log(`📨 Sent Apex patch notification to channel: ${channelId} (${patchNotes.length} patches)`);
      }
    } catch (error) {
      console.error(`Error sending Apex notification to channel ${channelId}:`, error);
    }
  }
}

/**
 * Create Discord embed for patch notification
 * @param {Object} patchNote - Patch note object
 * @returns {EmbedBuilder} Discord embed
 */
function createPatchNotificationEmbed(patchNote) {
  const embed = new EmbedBuilder()
    .setColor('#FF0000') // Red color matching apex command embeds
    .setAuthor({ 
      name: 'Apex Legends',
      iconURL: 'https://logoeps.com/wp-content/uploads/2019/03/apex-legends-vector-logo.png'
    })
    .setTitle(patchNote.title || 'Apex Legends Update')
    .setTimestamp(patchNote.date);
  
  // Set the source URL so title becomes clickable
  if (patchNote.link) {
    embed.setURL(patchNote.link);
  }
  
  // Add main content as description - keep it clean and concise
  if (patchNote.content) {
    // Clean and format the content to match the screenshot style
    let content = patchNote.content
      .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
      .trim();
    
    // Limit content length to prevent text wrapping
    if (content.length > 400) {
      content = content.substring(0, 380) + '...';
    }
    
    embed.setDescription(content);
  } else {
    embed.setDescription('New Apex Legends update available! Click the title above to view full details.');
  }
  
  // Add a large image if available (like in the screenshot)
  // Note: You'll need to add image URLs to your patch note data or use a default
  embed.setImage('https://media.contentapi.ea.com/content/dam/apex-legends/common/future-icons-key-art.jpg');
  
  return embed;
}

/**
 * Create Discord embed for combined patch notifications
 * @param {Array} patchNotes - Array of patch note objects
 * @returns {EmbedBuilder} Discord embed
 */
function createCombinedPatchNotificationEmbed(patchNotes) {
  const embed = new EmbedBuilder()
    .setColor('#FF0000') // Red color matching apex command embeds
    .setAuthor({ 
      name: 'Apex Legends',
      iconURL: 'https://logoeps.com/wp-content/uploads/2019/03/apex-legends-vector-logo.png'
    })
    .setTitle(`${patchNotes.length} New Apex Updates Available!`)
    .setTimestamp();

  // Add fields for each patch note (limit to first 10 to avoid Discord limits)
  const displayNotes = patchNotes.slice(0, 10);
  
  displayNotes.forEach((note, index) => {
    const content = note.content && note.content.length > 100 
      ? note.content.substring(0, 97) + '...'
      : note.content || 'Click the title to view full patch notes.';
      
    embed.addFields({
      name: `${index + 1}. ${note.title}`,
      value: `📅 ${note.date.toLocaleDateString()}\n${content}\n[View Full Notes](${note.link})`,
      inline: false
    });
  });
  
  if (patchNotes.length > 10) {
    embed.addFields({
      name: 'Additional Updates',
      value: `... and ${patchNotes.length - 10} more updates. Use \`/apex\` to see all recent patches.`,
      inline: false
    });
  }
  
  embed.setFooter({ text: 'Use /apex for detailed patch notes' });
  
  return embed;
}

/**
 * Manual check for updates (triggered by command)
 * @returns {Object} Result of the check
 */
async function manualCheckForUpdates() {
  try {
    console.log('🔍 Manual Apex patch note check triggered');
    
    const patchNotes = await getCachedPatchNotes(true);
    
    if (!patchNotes || patchNotes.length === 0) {
      return {
        success: false,
        message: 'No Apex patch notes found. The service may be experiencing issues.',
        newPatchCount: 0
      };
    }
    
    const lastPatch = await getLastPatchInfo();
    let newPatchCount = 0;
    
    for (const patch of patchNotes) {
      if (!lastPatch || patch.id !== lastPatch.id) {
        newPatchCount++;
      } else {
        break;
      }
    }
    
    if (newPatchCount > 0) {
      // Process new patches
      const newPatches = patchNotes.slice(0, newPatchCount);
      
      // Send single combined notification for all new patches
      await sendCombinedPatchNotification(newPatches);
      
      await saveLastPatchInfo(patchNotes[0]);
      
      return {
        success: true,
        message: `Found and sent ${newPatchCount} new Apex patch note(s)!`,
        newPatchCount,
        latestPatch: patchNotes[0]
      };
    } else {
      return {
        success: true,
        message: 'No new Apex patch notes found. All up to date!',
        newPatchCount: 0,
        latestPatch: patchNotes[0]
      };
    }
    
  } catch (error) {
    console.error('Error in manual Apex patch check:', error);
    return {
      success: false,
      message: 'Error occurred while checking for Apex updates. Please try again later.',
      newPatchCount: 0
    };
  }
}

/**
 * Get notification channels from dynamic config
 * @returns {Array} Array of channel IDs
 */
async function getNotificationChannels() {
  try {
    const configData = await fs.readFile(CHANNEL_CONFIG_FILE, 'utf8');
    const config = JSON.parse(configData);
    return config.channels || [];
  } catch (error) {
    // File doesn't exist or invalid JSON
    return [];
  }
}

/**
 * Set notification channel
 * @param {string} channelId - Discord channel ID
 * @param {string} guildId - Discord guild ID
 * @returns {boolean} Success status
 */
async function setNotificationChannel(channelId, guildId) {
  try {
    // Ensure temp directory exists
    await fs.mkdir(path.dirname(CHANNEL_CONFIG_FILE), { recursive: true });
    
    let config = { channels: [], guilds: {} };
    
    try {
      const existingData = await fs.readFile(CHANNEL_CONFIG_FILE, 'utf8');
      config = JSON.parse(existingData);
      if (!config.channels) config.channels = [];
      if (!config.guilds) config.guilds = {};
    } catch (error) {
      // File doesn't exist, use default config
    }
    
    // Add channel if not already present
    if (!config.channels.includes(channelId)) {
      config.channels.push(channelId);
    }
    
    // Store guild information
    config.guilds[channelId] = guildId;
    config.lastUpdated = new Date().toISOString();
    
    await fs.writeFile(CHANNEL_CONFIG_FILE, JSON.stringify(config, null, 2));
    
    // Start monitoring if not already running
    if (!monitoringInterval) {
      startMonitoring();
    }
    
    console.log(`✅ Apex notification channel set: ${channelId}`);
    return true;
  } catch (error) {
    console.error('Error setting Apex notification channel:', error);
    return false;
  }
}

/**
 * Get the last processed patch information
 * @returns {Object|null} Last patch info or null
 */
async function getLastPatchInfo() {
  try {
    const data = await fs.readFile(LAST_PATCH_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

/**
 * Save the last processed patch information
 * @param {Object} patchInfo - Patch information to save
 */
async function saveLastPatchInfo(patchInfo) {
  try {
    await fs.mkdir(path.dirname(LAST_PATCH_FILE), { recursive: true });
    await fs.writeFile(LAST_PATCH_FILE, JSON.stringify(patchInfo, null, 2));
  } catch (error) {
    console.error('Error saving last Apex patch info:', error);
  }
}

/**
 * Get monitoring status
 * @returns {Object} Status information
 */
async function getMonitoringStatus() {
  const isRunning = monitoringInterval !== null;
  const channels = await getNotificationChannels();
  const lastPatch = await getLastPatchInfo();
  
  return {
    isRunning,
    channels,
    lastPatch,
    checkInterval: CHECK_INTERVAL,
    configuredRole: APEX_ROLE_ID || null
  };
}

/**
 * Remove a notification channel
 * @param {string} channelId - Channel ID to remove
 * @returns {boolean} Success status
 */
async function removeNotificationChannel(channelId) {
  try {
    let config = { channels: [], guilds: {} };
    
    try {
      const existingData = await fs.readFile(CHANNEL_CONFIG_FILE, 'utf8');
      config = JSON.parse(existingData);
    } catch (error) {
      return false; // File doesn't exist
    }
    
    const index = config.channels.indexOf(channelId);
    if (index > -1) {
      config.channels.splice(index, 1);
      delete config.guilds[channelId];
      config.lastUpdated = new Date().toISOString();
      
      await fs.writeFile(CHANNEL_CONFIG_FILE, JSON.stringify(config, null, 2));
      
      // Stop monitoring if no channels left
      if (config.channels.length === 0 && monitoringInterval) {
        stopMonitoring();
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error removing Apex notification channel:', error);
    return false;
  }
}

export {
  initializeApexMonitoring,
  startMonitoring,
  stopMonitoring,
  manualCheckForUpdates,
  getMonitoringStatus,
  setNotificationChannel,
  removeNotificationChannel,
  getNotificationChannels
};

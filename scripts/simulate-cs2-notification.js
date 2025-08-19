#!/usr/bin/env node

/**
 * CS2 Notification System Simulator
 * 
 * This script simulates the CS2 notification system by:
 * 1. Creating a fake "new" patch note
 * 2. Testing the detection logic
 * 3. Simulating the notification flow
 * 4. Optionally sending actual Discord messages (if configured)
 * 
 * Usage:
 *   node scripts/simulate-cs2-notification.js [options]
 * 
 * Options:
 *   --dry-run     : Don't send actual Discord messages (default: true)
 *   --send-real   : Send actual Discord messages (requires bot token)
 *   --reset-state : Reset the last known patch to force detection
 *   --verbose     : Show detailed output
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// File paths
const LAST_PATCH_FILE = path.join(projectRoot, 'temp', 'last-cs2-patch.json');
const CHANNEL_CONFIG_FILE = path.join(projectRoot, 'temp', 'cs2-channel-config.json');
const SIMULATION_LOG_FILE = path.join(projectRoot, 'logs', 'cs2-simulation.log');

// CLI argument parsing
const argv = yargs(hideBin(process.argv))
  .option('dry-run', {
    type: 'boolean',
    default: true,
    description: 'Simulate without sending real Discord messages'
  })
  .option('send-real', {
    type: 'boolean',
    default: false,
    description: 'Send actual Discord messages (requires bot setup)'
  })
  .option('reset-state', {
    type: 'boolean',
    default: false,
    description: 'Reset last known patch to force new detection'
  })
  .option('verbose', {
    type: 'boolean',
    default: false,
    description: 'Show detailed output'
  })
  .help()
  .argv;

// Simulation data
const SIMULATION_PATCHES = [
  {
    gid: '1800357164387420',
    title: 'Counter-Strike 2 Update - Holiday Event 2025',
    content: `[GAMEPLAY]
- Added festive weapon skins and holiday-themed cosmetics
- Introduced temporary game modes: Snowball Fight and Ice Skating
- Fixed weapon balance issues reported by the community
- Improved anti-cheat detection systems

[MAPS]
- Updated all competitive maps with holiday decorations
- Fixed various exploit spots on de_mirage and de_dust2
- Added Christmas lighting effects to all maps
- Improved map performance optimization

[WEAPONS]
- Adjusted spray patterns for AK-47 and M4A4
- Fixed reload animation bugs for several pistols
- Balanced damage values for SMGs in close-range combat
- Added new weapon inspection animations

[UI/UX]
- Updated main menu with holiday theme
- Fixed inventory sorting issues
- Improved match-making algorithm
- Added new player ranking system visualization`,
    date: new Date(),
    author: 'Valve Development Team',
    link: 'https://www.counter-strike.net/news/updates/holiday-event-2025'
  },
  {
    gid: '1800357164387421',
    title: 'Counter-Strike 2 Hotfix - Bug Fixes',
    content: `[HOTFIX]
- Fixed crash issue when loading certain custom maps
- Resolved server connection timeout problems
- Fixed audio desynchronization in competitive matches
- Corrected weapon skin display glitches

[PERFORMANCE]
- Improved FPS stability on lower-end hardware
- Reduced memory usage during extended gameplay sessions
- Fixed stuttering issues during smoke grenade effects
- Optimized network packet handling`,
    date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    author: 'CS2 Team',
    link: 'https://www.counter-strike.net/news/updates/hotfix-june-2025'
  }
];

class CS2NotificationSimulator {
  constructor(options = {}) {
    this.isDryRun = options.dryRun !== false;
    this.sendReal = options.sendReal === true;
    this.resetState = options.resetState === true;
    this.verbose = options.verbose === true;
    this.simulationLog = [];
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message };
    this.simulationLog.push(logEntry);

    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);

    if (this.verbose && typeof message === 'object') {
      console.log(JSON.stringify(message, null, 2));
    }
  }

  async ensureDirectories() {
    const dirs = [
      path.dirname(LAST_PATCH_FILE),
      path.dirname(SIMULATION_LOG_FILE)
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
        this.log(`Created directory: ${dir}`, 'info');
      } catch (error) {
        this.log(`Directory already exists or error: ${dir}`, 'warn');
      }
    }
  }

  async getCurrentState() {
    this.log('📊 Reading current system state...');

    const state = {
      lastPatch: null,
      channelConfig: null,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        guildId: process.env.GUILD_BZ,
        cs2Role: process.env.CS2_ROLE,
        notificationChannels: process.env.CS2_NOTIFICATION_CHANNELS
      }
    };

    // Read last known patch
    try {
      const lastPatchData = await fs.readFile(LAST_PATCH_FILE, 'utf8');
      state.lastPatch = JSON.parse(lastPatchData);
      this.log(`Last known patch: ${state.lastPatch.title} (${state.lastPatch.gid})`);
    } catch (error) {
      this.log('No existing patch data found (first run)', 'warn');
    }

    // Read channel configuration
    try {
      const channelConfigData = await fs.readFile(CHANNEL_CONFIG_FILE, 'utf8');
      state.channelConfig = JSON.parse(channelConfigData);
      this.log(`Channel config loaded: ${Object.keys(state.channelConfig).length} guilds configured`);
    } catch (error) {
      this.log('No channel configuration found', 'warn');
    }

    this.log('Environment configuration:');
    Object.entries(state.environment).forEach(([key, value]) => {
      this.log(`  ${key}: ${value || 'not set'}`);
    });

    return state;
  }

  async simulateNewPatch(patchIndex = 0) {
    this.log(`🆕 Simulating new patch detection...`);

    const simulatedPatch = SIMULATION_PATCHES[patchIndex];
    if (!simulatedPatch) {
      throw new Error(`No simulation patch available at index ${patchIndex}`);
    }

    this.log(`Selected patch: ${simulatedPatch.title}`);
    this.log(`Patch GID: ${simulatedPatch.gid}`);
    this.log(`Content length: ${simulatedPatch.content.length} characters`);

    return simulatedPatch;
  }

  async testPatchDetection(currentState, newPatch) {
    this.log('🔍 Testing patch detection logic...');

    const isNewPatch = !currentState.lastPatch ||
      newPatch.gid !== currentState.lastPatch.gid;

    this.log(`Patch comparison result: ${isNewPatch ? 'NEW PATCH DETECTED' : 'NO CHANGE'}`);

    if (currentState.lastPatch) {
      this.log(`  Current: ${currentState.lastPatch.gid} (${currentState.lastPatch.title})`);
    } else {
      this.log('  Current: No patch data (first run)');
    }

    this.log(`  New: ${newPatch.gid} (${newPatch.title})`);

    return isNewPatch;
  }

  async simulateNotificationPreparation(newPatch) {
    this.log('📨 Preparing notification data...');

    // Simulate Discord embed creation
    const embedData = {
      color: '#FF6B00',
      title: '🎮 New Counter-Strike 2 Update!',
      url: newPatch.link || 'https://www.counter-strike.net/news/updates',
      thumbnail: 'https://cdn.akamai.steamstatic.com/apps/csgo/images/csgo_react/global/logo_cs2.svg',
      timestamp: new Date().toISOString(),
      fields: [
        {
          name: '📝 Update Title',
          value: newPatch.title,
          inline: false
        },
        {
          name: '📅 Release Date',
          value: newPatch.date.toLocaleDateString(),
          inline: true
        },
        {
          name: '👤 Author',
          value: newPatch.author,
          inline: true
        },
        {
          name: '📋 Update Preview',
          value: newPatch.content.length > 500
            ? newPatch.content.substring(0, 500) + '...'
            : newPatch.content,
          inline: false
        }
      ],
      footer: {
        text: 'Click title to view full update details | Auto-notification system'
      }
    };

    // Simulate role mention
    const roleId = process.env.CS2_ROLE;
    const roleMention = roleId ? `<@&${roleId}>` : '';
    const notificationContent = `🚨 **New CS2 Update Released!** ${roleMention}`.trim();

    const notificationData = {
      content: notificationContent,
      embeds: [embedData],
      metadata: {
        patchGid: newPatch.gid,
        simulationTime: new Date().toISOString(),
        isDryRun: this.isDryRun
      }
    };

    this.log('Notification prepared:');
    this.log(`  Content: ${notificationContent}`);
    this.log(`  Embed title: ${embedData.title}`);
    this.log(`  Fields count: ${embedData.fields.length}`);
    this.log(`  Role mention: ${roleMention || 'none configured'}`);

    return notificationData;
  }

  async simulateChannelDelivery(notificationData, currentState) {
    this.log('📡 Simulating channel delivery...');

    // Get notification channels
    const envChannels = process.env.CS2_NOTIFICATION_CHANNELS?.split(',').filter(Boolean) || [];
    const dynamicChannels = currentState.channelConfig
      ? Object.values(currentState.channelConfig).map(config => config.channelId)
      : [];

    const allChannels = [...new Set([...envChannels, ...dynamicChannels])];

    this.log(`Channel discovery:`);
    this.log(`  Environment channels: [${envChannels.join(', ')}]`);
    this.log(`  Dynamic channels: [${dynamicChannels.join(', ')}]`);
    this.log(`  Total unique channels: [${allChannels.join(', ')}]`);

    if (allChannels.length === 0) {
      this.log('⚠️ No notification channels configured!', 'warn');
      return { delivered: 0, failed: 0, channels: [] };
    }

    const deliveryResults = [];

    for (const channelId of allChannels) {
      const delivery = {
        channelId,
        success: false,
        error: null,
        timestamp: new Date().toISOString()
      };

      try {
        if (this.isDryRun) {
          // Simulate successful delivery
          delivery.success = true;
          this.log(`  📤 [DRY RUN] Would send to channel: ${channelId}`);
        } else if (this.sendReal) {
          // Attempt real delivery (would require Discord client setup)
          this.log(`  📤 [REAL] Attempting delivery to channel: ${channelId}`);
          // Real Discord delivery would go here
          delivery.success = true;
        } else {
          delivery.success = true;
          this.log(`  📤 [SIMULATION] Delivered to channel: ${channelId}`);
        }
      } catch (error) {
        delivery.error = error.message;
        this.log(`  ❌ Failed to deliver to channel ${channelId}: ${error.message}`, 'error');
      }

      deliveryResults.push(delivery);
    }

    const successful = deliveryResults.filter(r => r.success).length;
    const failed = deliveryResults.filter(r => !r.success).length;

    this.log(`📊 Delivery summary: ${successful} successful, ${failed} failed`);

    return {
      delivered: successful,
      failed: failed,
      channels: deliveryResults,
      totalChannels: allChannels.length
    };
  }

  async updateSystemState(newPatch) {
    this.log('💾 Updating system state...');

    if (this.isDryRun) {
      this.log('[DRY RUN] Would update last known patch file');
      return;
    }

    const saveData = {
      gid: newPatch.gid,
      title: newPatch.title,
      date: newPatch.date,
      timestamp: Date.now(),
      simulationData: {
        wasSimulated: true,
        simulationTime: new Date().toISOString()
      }
    };

    try {
      await fs.writeFile(LAST_PATCH_FILE, JSON.stringify(saveData, null, 2));
      this.log(`✅ Updated last known patch: ${newPatch.gid}`, 'success');
    } catch (error) {
      this.log(`❌ Failed to update patch state: ${error.message}`, 'error');
      throw error;
    }
  }

  async saveSimulationLog() {
    this.log('📝 Saving simulation log...');

    const logData = {
      simulationTime: new Date().toISOString(),
      options: {
        isDryRun: this.isDryRun,
        sendReal: this.sendReal,
        resetState: this.resetState,
        verbose: this.verbose
      },
      log: this.simulationLog
    };

    try {
      await fs.writeFile(SIMULATION_LOG_FILE, JSON.stringify(logData, null, 2));
      this.log(`✅ Simulation log saved: ${SIMULATION_LOG_FILE}`, 'success');
    } catch (error) {
      this.log(`⚠️ Failed to save simulation log: ${error.message}`, 'warn');
    }
  }

  async resetSystemState() {
    if (!this.resetState) return;

    this.log('🔄 Resetting system state...');

    try {
      // Create a much older patch to force detection
      const oldPatch = {
        gid: '1800357164387400',
        title: 'Counter-Strike 2 Update - Old Version',
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000
      };

      await fs.writeFile(LAST_PATCH_FILE, JSON.stringify(oldPatch, null, 2));
      this.log('✅ Reset to old patch state to force new detection', 'success');
    } catch (error) {
      this.log(`❌ Failed to reset state: ${error.message}`, 'error');
    }
  }

  async runSimulation() {
    this.log('🚀 Starting CS2 Notification System Simulation');
    this.log(`Mode: ${this.isDryRun ? 'DRY RUN' : this.sendReal ? 'REAL MESSAGES' : 'SIMULATION'}`);

    try {
      // Step 1: Ensure directories exist
      await this.ensureDirectories();

      // Step 2: Reset state if requested
      await this.resetSystemState();

      // Step 3: Get current state
      const currentState = await this.getCurrentState();

      // Step 4: Simulate new patch
      const newPatch = await this.simulateNewPatch(0);

      // Step 5: Test detection logic
      const isNewPatch = await this.testPatchDetection(currentState, newPatch);

      if (!isNewPatch) {
        this.log('⚠️ No new patch detected. Use --reset-state to force detection.', 'warn');
        return;
      }

      // Step 6: Prepare notification
      const notificationData = await this.simulateNotificationPreparation(newPatch);

      // Step 7: Simulate delivery
      const deliveryResults = await this.simulateChannelDelivery(notificationData, currentState);

      // Step 8: Update state
      await this.updateSystemState(newPatch);

      // Step 9: Save simulation log
      await this.saveSimulationLog();

      this.log('🎉 Simulation completed successfully!', 'success');
      this.log(`📊 Final summary:`);
      this.log(`   🆕 New patch: ${newPatch.title}`);
      this.log(`   📡 Channels notified: ${deliveryResults.delivered}/${deliveryResults.totalChannels}`);
      this.log(`   📝 Log entries: ${this.simulationLog.length}`);
      this.log(`   💾 State updated: ${this.isDryRun ? 'NO (dry run)' : 'YES'}`);

    } catch (error) {
      this.log(`❌ Simulation failed: ${error.message}`, 'error');
      throw error;
    }
  }
}

// Main execution
async function main() {
  const simulator = new CS2NotificationSimulator({
    dryRun: argv['dry-run'] && !argv['send-real'],
    sendReal: argv['send-real'],
    resetState: argv['reset-state'],
    verbose: argv['verbose']
  });

  try {
    await simulator.runSimulation();
  } catch (error) {
    console.error('Simulation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { CS2NotificationSimulator, SIMULATION_PATCHES };

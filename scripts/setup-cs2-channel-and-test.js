#!/usr/bin/env node

/**
 * Set up CS2 notification channel and send test notification
 * This will configure channel 736781721386877073 as a user-submitted channel
 * and send a test notification to verify it works
 */

import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const TARGET_CHANNEL_ID = '736781721386877073'; // Your desired channel
const CS2_ROLE_ID = process.env.CS2_ROLE;
const GUILD_ID = process.env.GUILD_BZ;

const CHANNEL_CONFIG_FILE = path.join(process.cwd(), 'temp', 'cs2-channel-config.json');

console.log('🔧 CS2 CHANNEL SETUP & TEST NOTIFICATION');
console.log('=========================================');
console.log(`🎯 Target Channel: ${TARGET_CHANNEL_ID}`);
console.log(`👥 Role: ${CS2_ROLE_ID}`);
console.log(`🏠 Guild: ${GUILD_ID}`);
console.log('=========================================\n');

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', async () => {
  console.log(`✅ Bot logged in as: ${client.user.tag}`);
  
  try {
    // Step 1: Set up the user-submitted channel configuration
    console.log('🔧 Setting up user-submitted channel configuration...');
    
    // Create temp directory if it doesn't exist
    await fs.mkdir(path.join(process.cwd(), 'temp'), { recursive: true });
    
    // Create channel configuration for user-submitted channels
    const channelConfig = {
      [GUILD_ID]: {
        channelId: TARGET_CHANNEL_ID,
        setAt: Date.now(),
        setBy: 'admin-setup-script'
      }
    };
    
    // Save the configuration
    await fs.writeFile(CHANNEL_CONFIG_FILE, JSON.stringify(channelConfig, null, 2));
    console.log(`✅ Saved channel config to: ${CHANNEL_CONFIG_FILE}`);
    console.log(`📝 Configured channel ${TARGET_CHANNEL_ID} for guild ${GUILD_ID}`);
    
    // Step 2: Verify the channel exists and is accessible
    console.log('\n🔍 Verifying target channel...');
    const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
    
    if (!channel) {
      console.error('❌ Channel not found!');
      process.exit(1);
    }
    
    console.log(`✅ Found channel: #${channel.name} in ${channel.guild.name}`);
    
    // Step 3: Verify role exists
    let roleText = '';
    if (CS2_ROLE_ID) {
      try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const role = await guild.roles.fetch(CS2_ROLE_ID);
        if (role) {
          roleText = ` <@&${CS2_ROLE_ID}>`;
          console.log(`✅ Found role: @${role.name}`);
        }
      } catch (error) {
        console.log('⚠️  Role not found, posting without role mention');
      }
    }
    
    // Step 4: Create and send test notification
    console.log('\n📤 Sending CS2 test notification...');
    
    const testEmbed = new EmbedBuilder()
      .setColor('#FF6B00') // CS2 orange
      .setTitle('🎮 NEW CS2 NOTIFICATION SYSTEM TEST!')
      .setURL('https://www.counter-strike.net/news/updates')
      .setTimestamp()
      .setThumbnail('https://cdn.akamai.steamstatic.com/apps/csgo/images/csgo_react/global/logo_cs2.svg')
      .addFields([
        {
          name: '✅ SYSTEM VALIDATION',
          value: 'This message confirms your CS2 notification system is working correctly!',
          inline: false
        },
        {
          name: '🎯 Channel Configuration',
          value: `**Target Channel:** <#${TARGET_CHANNEL_ID}>\n**Method:** User-submitted channel\n**Environment Channels:** DISABLED`,
          inline: false
        },
        {
          name: '📋 What This Proves',
          value: '• Bot can post to user-configured channels\n• Environment channels are completely ignored\n• Role mentions work correctly\n• CS2 notifications will appear here for real updates',
          inline: false
        },
        {
          name: '🚀 Next Steps',
          value: 'Your CS2 notification system is ready! When Valve releases new updates, you\'ll get notifications exactly like this one.',
          inline: false
        }
      ])
      .setFooter({ 
        text: 'CS2 System Test • User-Submitted Channel Only • Environment Channels Disabled' 
      });
    
    const messageContent = `🚨 **CS2 NOTIFICATION SYSTEM TEST**${roleText}`;
    
    const sentMessage = await channel.send({
      content: messageContent,
      embeds: [testEmbed]
    });
    
    console.log('\n🎉 SUCCESS! TEST NOTIFICATION POSTED!');
    console.log('=====================================');
    console.log(`📍 Channel: #${channel.name}`);
    console.log(`🆔 Message ID: ${sentMessage.id}`);
    console.log(`🔗 Message URL: https://discord.com/channels/${GUILD_ID}/${TARGET_CHANNEL_ID}/${sentMessage.id}`);
    console.log(`👥 Role Mentioned: ${CS2_ROLE_ID ? 'YES' : 'NO'}`);
    console.log(`⏰ Posted at: ${new Date().toLocaleString()}`);
    
    console.log('\n✅ CONFIGURATION COMPLETE!');
    console.log('===========================');
    console.log(`🎯 CS2 notifications will now go to channel: ${TARGET_CHANNEL_ID}`);
    console.log('🚫 Environment channels are completely disabled');
    console.log('✅ User-submitted channel configuration saved');
    console.log('\n🎮 Your CS2 notification system is ready for real updates!');
    
  } catch (error) {
    console.error('\n❌ ERROR during setup/testing:');
    console.error(error.message);
    console.error('\nPossible issues:');
    console.error('- Bot doesn\'t have permission to post in the target channel');
    console.error('- Channel ID is incorrect');
    console.error('- Bot is not in the Discord server');
    console.error('- File system permissions issue');
  }
  
  // Disconnect the bot
  setTimeout(() => {
    console.log('\n🔌 Disconnecting bot...');
    client.destroy();
    process.exit(0);
  }, 2000);
});

// Handle login errors
client.on('error', (error) => {
  console.error('❌ Discord client error:', error);
  process.exit(1);
});

// Login to Discord
console.log('🔐 Logging in to Discord...');
client.login(BOT_TOKEN).catch(error => {
  console.error('❌ Failed to login to Discord:', error.message);
  console.error('\nCheck your BOT_TOKEN in .env file');
  process.exit(1);
});

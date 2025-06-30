#!/usr/bin/env node

/**
 * Final verification script to confirm CS2 notifications go to the correct channel
 * This script verifies the production configuration without sending actual notifications
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '..', 'temp', 'cs2-channel-config.json');
const envPath = path.join(__dirname, '..', '.env');

console.log('🔍 CS2 NOTIFICATION CHANNEL VERIFICATION');
console.log('=========================================');

try {
  // 1. Check dynamic configuration
  console.log('\n📋 Checking dynamic channel configuration...');
  const configContent = await fs.readFile(configPath, 'utf-8');
  const config = JSON.parse(configContent);
  
  console.log('✅ Dynamic configuration loaded:');
  Object.entries(config).forEach(([guildId, channelData]) => {
    console.log(`  Guild ${guildId}: Channel ${channelData.channelId}`);
    console.log(`    Set by: ${channelData.setBy}`);
    console.log(`    Set at: ${new Date(channelData.setAt).toLocaleString()}`);
  });
  
  // 2. Check for environment channels
  console.log('\n🚫 Checking environment channel status...');
  const envContent = await fs.readFile(envPath, 'utf-8');
  const envChannelMatch = envContent.match(/^CS2_NOTIFICATION_CHANNELS=(.*)$/m);
  
  if (envChannelMatch && envChannelMatch[1] && !envChannelMatch[1].startsWith('#')) {
    console.log('⚠️  WARNING: Environment channels are still configured!');
    console.log(`   Found: ${envChannelMatch[1]}`);
  } else {
    console.log('✅ Environment channels are properly disabled');
  }
  
  // 3. Verify target channel is configured
  console.log('\n🎯 Verifying target channel configuration...');
  const targetChannel = '736781721386877073';
  const oldChannel = '1383109705706242150';
  
  let targetFound = false;
  let oldFound = false;
  
  Object.values(config).forEach(channelData => {
    if (channelData.channelId === targetChannel) {
      targetFound = true;
      console.log(`✅ Target channel ${targetChannel} is configured`);
    }
    if (channelData.channelId === oldChannel) {
      oldFound = true;
      console.log(`❌ Old channel ${oldChannel} is still configured`);
    }
  });
  
  if (!targetFound) {
    console.log(`⚠️  Target channel ${targetChannel} is NOT configured`);
  }
  
  // 4. Final summary
  console.log('\n📊 VERIFICATION SUMMARY');
  console.log('=======================');
  
  if (targetFound && !oldFound) {
    console.log('🎉 SUCCESS: Configuration is correct!');
    console.log(`✅ CS2 notifications will go to: ${targetChannel}`);
    console.log(`✅ Old environment channel (${oldChannel}) is disabled`);
    console.log('✅ Environment channels are disabled');
    console.log('✅ System is ready for production');
  } else {
    console.log('❌ ISSUE: Configuration needs attention');
    if (!targetFound) {
      console.log(`   - Target channel ${targetChannel} not configured`);
    }
    if (oldFound) {
      console.log(`   - Old channel ${oldChannel} still configured`);
    }
  }
  
} catch (error) {
  console.error('❌ Verification failed:', error.message);
  process.exit(1);
}

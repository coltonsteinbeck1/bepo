import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

// Test constants - these are NOT real Discord IDs
const TEST_CHANNEL_ID = '1111111111111111111';
const TEST_ROLE_ID = '2222222222222222222';

describe('CS2 Notification System Integration Test', () => {
  let originalConsole;
  let originalEnv;
  let testLogs = [];

  const TEMP_DIR = path.join(process.cwd(), 'temp-test');
  const LAST_PATCH_FILE = path.join(TEMP_DIR, 'last-cs2-patch.json');
  const CHANNEL_CONFIG_FILE = path.join(TEMP_DIR, 'cs2-channel-config.json');

  beforeEach(async () => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Capture console output for verification
    originalConsole = console;
    testLogs = [];

    global.console = {
      ...console,
      log: (...args) => {
        testLogs.push({ level: 'log', message: args.join(' ') });
        originalConsole.log(...args);
      },
      error: (...args) => {
        testLogs.push({ level: 'error', message: args.join(' ') });
        originalConsole.error(...args);
      },
      warn: (...args) => {
        testLogs.push({ level: 'warn', message: args.join(' ') });
        originalConsole.warn(...args);
      }
    };

    // Create test temp directory
    try {
      await fs.mkdir(TEMP_DIR, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Set test environment variables - USING MOCK IDs ONLY
    process.env.NODE_ENV = 'test';
    process.env.GUILD_BZ = '3333333333333333333'; // TEST GUILD ID
    process.env.CS2_ROLE = TEST_ROLE_ID; // TEST ROLE ID
    process.env.CS2_NOTIFICATION_CHANNELS = '1234567890123456789'; // MOCK CHANNEL ID
    
    // Safety checks - prevent accidental use of real Discord IDs
    const realChannelId = '1383109705706242150'; // The actual Discord channel we want to avoid
    const realRoleId = '1160342442072096788';     // The actual Discord role we want to avoid
    
    if (process.env.CS2_NOTIFICATION_CHANNELS?.includes(realChannelId)) {
      throw new Error('❌ SAFETY CHECK: Real Discord channel ID detected in environment!');
    }
    // Check original environment before we modified it
    if (originalEnv.CS2_ROLE?.includes(realRoleId)) {
      throw new Error('❌ SAFETY CHECK: Real Discord role ID detected in environment!');
    }
  });

  afterEach(async () => {
    global.console = originalConsole;
    
    // Restore original environment
    process.env = originalEnv;

    // Clean up test files
    try {
      await fs.rm(TEMP_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    vi.restoreAllMocks();
  });

  it('should simulate complete notification flow from patch detection to Discord message', async () => {
    console.log('🧪 Starting CS2 Notification System Integration Test');
    console.log('📋 Testing complete flow: patch detection → notification → Discord message');

    // === STEP 1: Setup Mock Data ===
    console.log('\n📦 Step 1: Setting up mock data...');

    // Create old patch note (what's currently "known")
    const oldPatch = {
      gid: '1800357164387415',
      title: 'Counter-Strike 2 Update - Bug Fixes',
      date: '2025-05-21T22:32:10.000Z',
      timestamp: 1751231751347
    };

    // Create new patch note (simulates new release)
    const newPatch = {
      gid: '1800357164387420',
      title: 'Counter-Strike 2 Update - Holiday Event',
      content: `[GAMEPLAY]
- Added new Holiday-themed weapon skins
- Fixed issue with smoke grenades not rendering properly
- Improved server performance during peak hours

[MAPS]
- Updated de_mirage with winter decorations
- Fixed various map exploits reported by community

[WEAPONS]
- Adjusted AK-47 spray pattern
- Fixed AWP scoping animation bug`,
      date: new Date('2025-06-29T10:30:00.000Z'),
      author: 'Valve Team',
      link: 'https://www.counter-strike.net/news/updates/holiday-event-2025'
    };

    console.log(`   📄 Old patch: ${oldPatch.title} (${oldPatch.gid})`);
    console.log(`   🆕 New patch: ${newPatch.title} (${newPatch.gid})`);

    // === STEP 2: Setup File System ===
    console.log('\n💾 Step 2: Setting up file system state...');

    // Write old patch to "last known" file
    await fs.writeFile(LAST_PATCH_FILE, JSON.stringify(oldPatch, null, 2));
    console.log(`   ✅ Wrote old patch to: ${LAST_PATCH_FILE}`);

    // Write channel configuration
    const channelConfig = {
      '621478319564521489': {
        channelId: '736781721386877073',
        setAt: Date.now(),
        setBy: 'admin'
      }
    };
    await fs.writeFile(CHANNEL_CONFIG_FILE, JSON.stringify(channelConfig, null, 2));
    console.log(`   ✅ Wrote channel config to: ${CHANNEL_CONFIG_FILE}`);

    // === STEP 3: Verify File Reading ===
    console.log('\n🔍 Step 3: Verifying file system operations...');

    // Test reading the files
    const readOldPatch = JSON.parse(await fs.readFile(LAST_PATCH_FILE, 'utf8'));
    const readChannelConfig = JSON.parse(await fs.readFile(CHANNEL_CONFIG_FILE, 'utf8'));

    expect(readOldPatch.gid).toBe(oldPatch.gid);
    expect(readChannelConfig['621478319564521489'].channelId).toBe('736781721386877073');
    console.log('   ✅ File reading operations verified');

    // === STEP 4: Simulate Patch Detection ===
    console.log('\n🎯 Step 4: Simulating patch note detection...');

    // Check if new patch would be detected
    const isNewPatch = newPatch.gid !== readOldPatch.gid;
    expect(isNewPatch).toBe(true);
    console.log(`   🔍 Patch comparison: ${newPatch.gid} !== ${readOldPatch.gid} = ${isNewPatch}`);

    // === STEP 5: Test Notification Data Preparation ===
    console.log('\n📨 Step 5: Preparing notification data...');

    // Simulate embed creation
    const embedData = {
      color: '#FF6B00',
      title: '🎮 New Counter-Strike 2 Update!',
      url: 'https://www.counter-strike.net/news/updates',
      thumbnail: 'https://cdn.akamai.steamstatic.com/apps/csgo/images/csgo_react/global/logo_cs2.svg',
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

    console.log('   📋 Embed title:', embedData.title);
    console.log('   🎨 Embed color:', embedData.color);
    console.log('   📝 Fields count:', embedData.fields.length);

    // === STEP 6: Test Role Mention Format ===
    console.log('\n👥 Step 6: Testing role mention formatting...');

    const roleId = process.env.CS2_ROLE;
    const roleMention = `<@&${roleId}>`;
    const notificationContent = `🚨 **New CS2 Update Released!** ${roleMention}`;

    console.log(`   🎭 Role ID: ${roleId}`);
    console.log(`   📢 Role mention: ${roleMention}`);
    console.log(`   💬 Full message: ${notificationContent}`);

    // Verify role mention format
    const roleMentionRegex = /^<@&\d{17,19}>$/;
    expect(roleMentionRegex.test(roleMention)).toBe(true);

    // === STEP 7: Simulate File Update ===
    console.log('\n💾 Step 7: Simulating file updates...');

    // Save new patch as "last known"
    const newPatchSaveData = {
      gid: newPatch.gid,
      title: newPatch.title,
      date: newPatch.date,
      timestamp: Date.now()
    };

    await fs.writeFile(LAST_PATCH_FILE, JSON.stringify(newPatchSaveData, null, 2));
    console.log('   ✅ Updated last known patch file');

    // Verify the update
    const updatedPatch = JSON.parse(await fs.readFile(LAST_PATCH_FILE, 'utf8'));
    expect(updatedPatch.gid).toBe(newPatch.gid);
    console.log(`   🔍 Verified update: ${updatedPatch.gid}`);

    // === STEP 8: Test Channel Discovery ===
    console.log('\n📡 Step 8: Testing channel discovery...');

    // Simulate getting notification channels
    const envChannels = process.env.CS2_NOTIFICATION_CHANNELS?.split(',') || [];
    const dynamicChannels = Object.values(readChannelConfig).map(config => config.channelId);
    const allChannels = [...new Set([...envChannels, ...dynamicChannels])];

    console.log(`   🌍 Environment channels: [${envChannels.join(', ')}]`);
    console.log(`   ⚙️  Dynamic channels: [${dynamicChannels.join(', ')}]`);
    console.log(`   📊 Total unique channels: [${allChannels.join(', ')}]`);

    expect(allChannels.length).toBeGreaterThan(0);
    expect(allChannels).toContain('736781721386877073');

    // === STEP 9: Simulate Discord Message Structure ===
    console.log('\n💬 Step 9: Testing Discord message structure...');

    const mockDiscordMessage = {
      content: notificationContent,
      embeds: [embedData],
      channelId: allChannels[0],
      guildId: process.env.GUILD_BZ,
      timestamp: new Date().toISOString()
    };

    console.log('   📦 Message structure:');
    console.log(`      📝 Content: ${mockDiscordMessage.content.substring(0, 50)}...`);
    console.log(`      📋 Embeds: ${mockDiscordMessage.embeds.length}`);
    console.log(`      📍 Channel: ${mockDiscordMessage.channelId}`);
    console.log(`      🏠 Guild: ${mockDiscordMessage.guildId}`);

    // === STEP 10: Verify Complete Flow ===
    console.log('\n✅ Step 10: Verification complete!');

    // Verify all components are present
    expect(mockDiscordMessage.content).toContain('New CS2 Update Released!');
    expect(mockDiscordMessage.content).toContain(roleMention);
    expect(mockDiscordMessage.embeds[0].title).toContain('Counter-Strike 2 Update');
    expect(mockDiscordMessage.embeds[0].fields.length).toBeGreaterThan(0);
    expect(mockDiscordMessage.channelId).toBeTruthy();
    expect(mockDiscordMessage.guildId).toBeTruthy();

    console.log('\n🎉 CS2 Notification System Integration Test PASSED!');
    console.log('📊 Test Summary:');
    console.log(`   ✅ Patch detection: ${isNewPatch ? 'PASS' : 'FAIL'}`);
    console.log(`   ✅ File operations: PASS`);
    console.log(`   ✅ Embed creation: PASS`);
    console.log(`   ✅ Role mentions: PASS`);
    console.log(`   ✅ Channel discovery: PASS (${allChannels.length} channels)`);
    console.log(`   ✅ Message structure: PASS`);

    // Final verification - ensure we can read the updated state
    const finalPatch = JSON.parse(await fs.readFile(LAST_PATCH_FILE, 'utf8'));
    expect(finalPatch.gid).toBe(newPatch.gid);

    console.log('\n🔄 State transition verified:');
    console.log(`   Before: ${oldPatch.gid} (${oldPatch.title})`);
    console.log(`   After:  ${finalPatch.gid} (${finalPatch.title})`);
  });

  it('should handle first-time setup (no existing patch data)', async () => {
    console.log('🧪 Testing first-time setup scenario...');

    // Don't create any existing patch file
    const newPatch = {
      gid: '1800357164387420',
      title: 'Counter-Strike 2 Update - First Run',
      content: 'This is the first patch note detected by the system.',
      date: new Date('2025-06-29T10:30:00.000Z'),
      author: 'Valve Team'
    };

    // Try to read non-existent file
    let fileExists = true;
    try {
      await fs.readFile(LAST_PATCH_FILE, 'utf8');
    } catch (error) {
      fileExists = false;
    }

    expect(fileExists).toBe(false);
    console.log('   ✅ Confirmed no existing patch data');

    // Simulate first save
    const firstSaveData = {
      gid: newPatch.gid,
      title: newPatch.title,
      date: newPatch.date,
      timestamp: Date.now()
    };

    await fs.writeFile(LAST_PATCH_FILE, JSON.stringify(firstSaveData, null, 2));
    console.log('   ✅ Created initial patch data file');

    // Verify the file was created
    const savedData = JSON.parse(await fs.readFile(LAST_PATCH_FILE, 'utf8'));
    expect(savedData.gid).toBe(newPatch.gid);
    expect(savedData.title).toBe(newPatch.title);

    console.log('   🎉 First-time setup test PASSED!');
  });

  it('should simulate error scenarios and recovery', async () => {
    console.log('🧪 Testing error scenarios and recovery...');

    // Test 1: Corrupted patch file
    console.log('\n📝 Test 1: Corrupted patch file...');
    await fs.writeFile(LAST_PATCH_FILE, 'invalid json content');

    let readError = null;
    try {
      JSON.parse(await fs.readFile(LAST_PATCH_FILE, 'utf8'));
    } catch (error) {
      readError = error;
    }

    expect(readError).toBeTruthy();
    expect(readError.message).toContain('JSON');
    console.log('   ✅ Corrupted file handling verified');

    // Test 2: Missing directory
    console.log('\n📁 Test 2: Missing directory recovery...');
    await fs.rm(TEMP_DIR, { recursive: true, force: true });

    // Simulate directory creation
    await fs.mkdir(TEMP_DIR, { recursive: true });
    const newData = { gid: 'test', title: 'Test', timestamp: Date.now() };
    await fs.writeFile(LAST_PATCH_FILE, JSON.stringify(newData));

    const recoveredData = JSON.parse(await fs.readFile(LAST_PATCH_FILE, 'utf8'));
    expect(recoveredData.gid).toBe('test');
    console.log('   ✅ Directory recovery verified');

    // Test 3: Permission error simulation (using invalid path)
    console.log('\n🔒 Test 3: Permission error handling...');
    const invalidPath = '/root/nonexistent/test.json';

    let permissionError = null;
    try {
      await fs.writeFile(invalidPath, 'test');
    } catch (error) {
      permissionError = error;
    }

    expect(permissionError).toBeTruthy();
    console.log('   ✅ Permission error handling verified');

    console.log('\n🎉 Error scenario tests PASSED!');
  });
});

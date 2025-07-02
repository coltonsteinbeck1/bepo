import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_BZ = process.env.GUILD_BZ;
const APEX_ROLE_ID = process.env.APEX_ROLE;

const CHANNEL_CONFIG_FILE = path.join(process.cwd(), 'temp', 'apex-channel-config.json');
const LAST_PATCH_FILE = path.join(process.cwd(), 'temp', 'last-apex-patch.json');

console.log('🎮 Apex Legends Notification Simulation');
console.log('========================================');

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN environment variable is required');
  process.exit(1);
}

if (!GUILD_BZ) {
  console.error('❌ GUILD_BZ environment variable is required');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Mock patch note data for simulation
const mockPatchNote = {
  id: `apex-${new Date().toISOString().split('T')[0]}-sim`,
  title: "Apex Legends: Future Icons Event",
  content: "New mid-season update with Future Icons Event (June 24-July 15). Features 1v1 Arenas, new Legendary skins, and Paquette updates.",
  date: new Date(),
  link: "https://www.ea.com/games/apex-legends/apex-legends/news",
  author: "Respawn Entertainment",
  tags: ["event", "arenas", "skins"],
  timestamp: Date.now()
};

async function getNotificationChannels() {
  try {
    const configData = await fs.readFile(CHANNEL_CONFIG_FILE, 'utf8');
    const config = JSON.parse(configData);
    return config.channels || [];
  } catch (error) {
    return [];
  }
}

async function saveLastPatchInfo(patchInfo) {
  try {
    await fs.mkdir(path.dirname(LAST_PATCH_FILE), { recursive: true });
    await fs.writeFile(LAST_PATCH_FILE, JSON.stringify(patchInfo, null, 2));
  } catch (error) {
    console.error('Error saving last patch info:', error);
  }
}

function createPatchNotificationEmbed(patchNote) {
  const embed = new EmbedBuilder()
    .setColor('#FF0000')
    .setAuthor({ 
      name: 'Apex Legends',
      iconURL: 'https://logoeps.com/wp-content/uploads/2019/03/apex-legends-vector-logo.png'
    })
    .setTitle(patchNote.title || 'Apex Legends Update')
    .setTimestamp(patchNote.date);
  
  if (patchNote.content) {
    const content = patchNote.content.length > 400 
      ? patchNote.content.substring(0, 380) + '...'
      : patchNote.content;
    
    if (content.trim()) {
      embed.setDescription(content);
    }
  }
  
  if (patchNote.link) {
    embed.setURL(patchNote.link);
  }
  
  embed.addFields({
    name: '🧪 Test Mode',
    value: 'Simulation notification',
    inline: true
  });
  
  // Add promotional image like in the screenshot
  embed.setImage('https://media.contentapi.ea.com/content/dam/apex-legends/common/future-icons-key-art.jpg');
  
  return embed;
}

client.once('ready', async () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  
  try {
    const guild = await client.guilds.fetch(GUILD_BZ);
    console.log(`🏠 Connected to guild: ${guild.name}`);
    
    // Get notification channels
    const channels = await getNotificationChannels();
    
    if (channels.length === 0) {
      console.log('⚠️  No notification channels configured');
      console.log('   Use `/apexnotify setchannel` to configure channels first');
      
      // Show environment config for reference
      console.log('\n📊 Environment Configuration:');
      console.log('============================');
      console.log(`Guild ID: ${GUILD_BZ}`);
      console.log(`Apex Role: ${APEX_ROLE_ID || 'Not configured'}`);
      
      client.destroy();
      process.exit(0);
    }
    
    console.log(`📢 Found ${channels.length} configured notification channels:`);
    channels.forEach(channelId => {
      console.log(`   - ${channelId}`);
    });
    
    // Send simulation notification to each channel
    console.log('\n🚀 Sending simulation notifications...');
    
    for (const channelId of channels) {
      try {
        const channel = await client.channels.fetch(channelId);
        
        if (channel) {
          console.log(`📨 Sending to #${channel.name}`);
          
          let content = '🧪 **Apex Update Simulation**';
          
          // Add role mention if configured
          if (APEX_ROLE_ID) {
            try {
              const role = await guild.roles.fetch(APEX_ROLE_ID);
              if (role) {
                content += ` <@&${APEX_ROLE_ID}>`;
                console.log(`   👥 Role: ${role.name}`);
              }
            } catch (roleError) {
              console.log(`   ⚠️  Role error: ${roleError.message}`);
            }
          }
          
          const embed = createPatchNotificationEmbed(mockPatchNote);
          
          const message = await channel.send({
            content,
            embeds: [embed]
          });
          
          console.log(`   ✅ Sent successfully`);
          
        } else {
          console.log(`   ❌ Channel ${channelId} not found`);
        }
      } catch (error) {
        console.log(`   ❌ Error sending to channel ${channelId}: ${error.message}`);
      }
      
      // Small delay between sends
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Save the mock patch as the last known patch for testing
    await saveLastPatchInfo(mockPatchNote);
    console.log('\n💾 Saved simulation patch as last known patch');
    
    // Summary
    console.log('\n📊 Simulation Complete');
    console.log('======================');
    console.log(`📢 Channels: ${channels.length}`);
    console.log(`👥 Role: ${APEX_ROLE_ID ? 'YES' : 'NO'}`);
    console.log(`🧪 Type: Patch Notification`);
    
    console.log('\n Commands to Test:');
    console.log('- `/apexnotify status`');
    console.log('- `/apexnotify check`'); 
    console.log('- `/apex`');
    console.log('- `/apex refresh:true`');
    
  } catch (error) {
    console.error('❌ Simulation failed:', error);
  }
  
  console.log('\n👋 Simulation complete. Disconnecting...');
  client.destroy();
  process.exit(0);
});

client.on('error', (error) => {
  console.error('❌ Discord client error:', error);
  process.exit(1);
});

console.log('🔌 Connecting to Discord for simulation...');
client.login(BOT_TOKEN);

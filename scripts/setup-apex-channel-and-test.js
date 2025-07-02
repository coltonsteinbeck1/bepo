import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const APEX_ROLE_ID = process.env.APEX_ROLE;
const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_BZ = process.env.GUILD_BZ;

console.log('🎮 Apex Legends Notification Setup & Test');
console.log('=========================================');
console.log(`🏠 Guild: ${GUILD_BZ}`);
console.log(`👥 Role: ${APEX_ROLE_ID}`);
console.log(`🤖 Bot Token: ${BOT_TOKEN ? 'Configured' : 'NOT SET'}`);

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

client.once('ready', async () => {
    console.log(`\n✅ Bot logged in as ${client.user.tag}`);

    try {
        const guild = await client.guilds.fetch(GUILD_BZ);
        console.log(`🏠 Connected to guild: ${guild.name}`);

        // Check for Apex role
        if (APEX_ROLE_ID) {
            try {
                const role = await guild.roles.fetch(APEX_ROLE_ID);
                if (role) {
                    console.log(`👥 Apex role found: ${role.name} (${role.members.size} members)`);
                } else {
                    console.log(`⚠️  Apex role ID ${APEX_ROLE_ID} not found in guild`);
                }
            } catch (error) {
                console.log(`❌ Error fetching Apex role: ${error.message}`);
            }
        } else {
            console.log('💡 No Apex role configured (APEX_ROLE environment variable)');
        }

        // Test Apex notification system
        console.log('\n🧪 Testing Apex notification system...');

        const channels = guild.channels.cache.filter(channel =>
            channel.isTextBased() &&
            (channel.name.includes('apex') ||
                channel.name.includes('gaming') ||
                channel.name.includes('games') ||
                channel.name.includes('notifications'))
        );

        if (channels.size > 0) {
            console.log('\n📢 Suggested channels for Apex notifications:');
            channels.forEach(channel => {
                console.log(`   #${channel.name} (${channel.id})`);
            });

            // Send test notification to first suggested channel
            const testChannel = channels.first();
            console.log(`\n🧪 Sending test notification to #${testChannel.name}...`);

            let content = '🧪 **Apex Legends Notification Test**\nThis is a test of the Apex notification system.';
            let roleText = '';

            if (APEX_ROLE_ID) {
                try {
                    const role = await guild.roles.fetch(APEX_ROLE_ID);
                    if (role) {
                        roleText = ` <@&${APEX_ROLE_ID}>`;
                    }
                } catch (error) {
                    console.log(`⚠️  Could not mention role: ${error.message}`);
                }
            }

            const testEmbed = {
                color: 0xFF6600,
                title: '🧪 Apex Legends Notification Test',
                description: 'If you can see this message, the Apex notification system is working correctly!',
                fields: [
                    {
                        name: '🎮 Game',
                        value: 'Apex Legends',
                        inline: true
                    },
                    {
                        name: '📡 Status',
                        value: 'System Operational',
                        inline: true
                    },
                    {
                        name: '🔧 Setup',
                        value: 'Use `/apexnotify setchannel` to configure notifications',
                        inline: false
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'Test Notification - Apex Legends System'
                },
                thumbnail: {
                    url: 'https://media.contentapi.ea.com/content/dam/apex-legends/common/apex-legends-bloodhound-edition.jpg.adapt.320w.jpg'
                }
            };

            try {
                await testChannel.send({
                    content: content + roleText,
                    embeds: [testEmbed]
                });
                console.log('✅ Test notification sent successfully!');
            } catch (error) {
                console.log(`❌ Failed to send test notification: ${error.message}`);
            }
        } else {
            console.log('\n⚠️  No suitable channels found for testing');
            console.log('   Consider creating a channel with "apex", "gaming", or "notifications" in the name');
        }

        // Summary
        console.log('\n📊 Setup Summary:');
        console.log('================');
        console.log(`🤖 Bot: Connected`);
        console.log(`🏠 Guild: Connected (${guild.name})`);
        console.log(`👥 Role Configured: ${APEX_ROLE_ID ? 'YES' : 'NO'}`);
        console.log(`👥 Role Valid: ${APEX_ROLE_ID ? 'CHECK ABOVE' : 'N/A'}`);
        console.log(`📢 Test Sent: ${channels.size > 0 ? 'YES' : 'NO'}`);
        console.log(`👥 Role Mentioned: ${APEX_ROLE_ID ? 'YES' : 'NO'}`);

        console.log('\n💡 Next Steps:');
        console.log('==============');
        console.log('1. Use `/apexnotify setchannel` to configure notification channels');
        console.log('2. Use `/apexnotify status` to check monitoring status');
        console.log('3. Use `/apexnotify check` to manually test for updates');
        console.log('4. Use `/apex` to view latest patch notes');

        if (!APEX_ROLE_ID) {
            console.log('\n🔧 Optional: Set APEX_ROLE environment variable for role mentions');
        }

    } catch (error) {
        console.error('❌ Setup test failed:', error);
    }

    console.log('\n👋 Setup test complete. Disconnecting...');
    client.destroy();
    process.exit(0);
});

client.on('error', (error) => {
    console.error('❌ Discord client error:', error);
    process.exit(1);
});

console.log('\n🔌 Connecting to Discord...');
client.login(BOT_TOKEN);

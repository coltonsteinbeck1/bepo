import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import {
  EC2Client,
  DescribeInstancesCommand,
  RunInstancesCommand,
  TerminateInstancesCommand,
  DescribeAddressesCommand,
  waitUntilInstanceRunning,
  waitUntilInstanceTerminated
} from '@aws-sdk/client-ec2';

const ec2Client = new EC2Client({
  region: 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY
  },
});

// Launch template IDs for Spot instances
const LAUNCH_TEMPLATE_XL = process.env.MC_XL_TEMPLATE_ID;
const LAUNCH_TEMPLATE_REGULAR = process.env.MC_TEMPLATE_ID;
const MC_ELASTIC_IP = process.env.MC_ELASTIC_IP;

/**
 * Find the running Minecraft instance by checking for the Elastic IP attachment
 * @returns {Promise<Object|null>} Instance object or null if not found
 */
async function findMinecraftInstance() {
  try {
    // Check if the Elastic IP is associated with any instance
    const addressCommand = new DescribeAddressesCommand({
      PublicIps: [MC_ELASTIC_IP]
    });

    const addressData = await ec2Client.send(addressCommand);

    if (addressData.Addresses && addressData.Addresses.length > 0) {
      const address = addressData.Addresses[0];

      if (address.InstanceId) {
        // Get instance details
        const instanceCommand = new DescribeInstancesCommand({
          InstanceIds: [address.InstanceId]
        });

        const instanceData = await ec2Client.send(instanceCommand);

        if (instanceData.Reservations && instanceData.Reservations.length > 0) {
          const instance = instanceData.Reservations[0].Instances[0];
          return instance;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding Minecraft instance:', error);
    return null;
  }
}

/**
 * Check if there are any instances in pending or running state
 * @returns {Promise<Array>} Array of ALL instance objects
 */
async function findAllMinecraftInstances() {
  try {
    // Search for ANY instances that are still active
    const describeCommand = new DescribeInstancesCommand({
      Filters: [
        {
          Name: 'instance-state-name',
          Values: ['pending', 'running']
        }
      ]
    });

    const data = await ec2Client.send(describeCommand);
    const allInstances = [];

    console.log(`Total reservations found: ${data.Reservations ? data.Reservations.length : 0}`);

    if (data.Reservations && data.Reservations.length > 0) {
      for (const reservation of data.Reservations) {
        for (const instance of reservation.Instances) {
          console.log(`Found instance: ${instance.InstanceId}, State: ${instance.State.Name}, Type: ${instance.InstanceType}`);
          allInstances.push(instance);
        }
      }
    }

    console.log(`Total instances found: ${allInstances.length}`);
    return allInstances;
  } catch (error) {
    console.error('Error finding instances:', error);
    return [];
  }
}

/**
 * Check if there are any instances in pending or running state
 * @returns {Promise<Object|null>} First instance object or null if not found
 */
async function findAnyMinecraftInstance() {
  const instances = await findAllMinecraftInstances();
  return instances.length > 0 ? instances[0] : null;
}

/**
 * Launch a Spot instance from a launch template
 * @param {string} launchTemplateId - The launch template ID
 * @returns {Promise<Object>} Instance data
 */
async function launchSpotInstance(launchTemplateId) {
  const command = new RunInstancesCommand({
    LaunchTemplate: {
      LaunchTemplateId: launchTemplateId
    },
    MinCount: 1,
    MaxCount: 1
  });

  return await ec2Client.send(command);
}

/**
 * Wait for Elastic IP to be attached to the instance
 * @param {string} instanceId - The instance ID to check
 * @param {number} maxWaitTime - Maximum wait time in seconds
 * @returns {Promise<boolean>} True if IP is attached, false otherwise
 */
async function waitForElasticIpAttachment(instanceId, maxWaitTime = 300) {
  const startTime = Date.now();
  const maxWaitMs = maxWaitTime * 1000;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const addressCommand = new DescribeAddressesCommand({
        PublicIps: [MC_ELASTIC_IP]
      });

      const addressData = await ec2Client.send(addressCommand);

      if (addressData.Addresses && addressData.Addresses.length > 0) {
        const address = addressData.Addresses[0];

        if (address.InstanceId === instanceId && address.AssociationId) {
          return true;
        }
      }

      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.error('Error checking Elastic IP attachment:', error);
    }
  }

  return false;
}

/**
 * Create an embed for server status updates
 * @param {string} status - Status type: 'starting', 'running', 'stopping', 'stopped', 'error'
 * @param {Object} options - Additional options for the embed
 * @returns {EmbedBuilder} Discord embed
 */
function createServerStatusEmbed(status, options = {}) {
  const embed = new EmbedBuilder()
    .setTimestamp();

  switch (status) {
    case 'starting':
      embed
        .setColor('#FFA500') // Yellow/Orange for in-progress
        .setTitle('🔄 Minecraft Server Starting')
        .setDescription('Launching Spot instance and configuring server...')
        .addFields({ name: 'Status', value: 'In Progress', inline: true });

      if (options.templateType) {
        embed.addFields({ name: 'Instance Type', value: options.templateType, inline: true });
      }
      break;

    case 'running':
      embed
        .setColor('#00FF00') // Green for success
        .setTitle('✅ Minecraft Server Online')
        .setDescription('Server is up and running!')
        .addFields(
          { name: 'Status', value: 'Online', inline: true },
        );

      if (options.instanceId) {
        embed.addFields({ name: 'Instance ID', value: `\`${options.instanceId}\``, inline: true });
      }

      if (options.instanceType) {
        embed.addFields({ name: 'Instance Type', value: options.instanceType, inline: true });
      }
      break;

    case 'stopping':
      embed
        .setColor('#FFA500') // Yellow/Orange for in-progress
        .setTitle('🔄 Minecraft Server Stopping')
        .setDescription('Terminating Spot instance...')
        .addFields({ name: 'Status', value: 'Shutting Down', inline: true });
      break;

    case 'stopped':
      embed
        .setColor('#808080') // Gray for stopped
        .setTitle('⛔ Minecraft Server Offline')
        .setDescription('Server has been shut down.')
        .addFields({ name: 'Status', value: 'Offline', inline: true });
      break;

    case 'offline':
      embed
        .setColor('#808080') // Gray for offline
        .setTitle('⛔ Minecraft Server Offline')
        .setDescription('No active server instance found.')
        .addFields({ name: 'Status', value: 'Offline', inline: true });
      break;

    case 'error':
      embed
        .setColor('#FF0000') // Red for error
        .setTitle('❌ Server Error')
        .setDescription(options.error || 'An error occurred while managing the server.')
        .addFields({ name: 'Status', value: 'Error', inline: true });
      break;
  }

  return embed;
}


const minecraftServer = {
  data: new SlashCommandBuilder()
    .setName('minecraftserver')
    .setDescription('Manage the Minecraft Spot instance server')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Action to perform on the server')
        .setRequired(true)
        .addChoices(
          { name: 'status', value: 'status' },
          { name: 'start', value: 'start' },
          { name: 'stop', value: 'stop' }
        )),

  async execute(interaction) {
    const action = interaction.options.getString('action');

    // Validate required environment variables
    if (!MC_ELASTIC_IP || !LAUNCH_TEMPLATE_XL || !LAUNCH_TEMPLATE_REGULAR) {
      const configErrorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Configuration Error')
        .setDescription('Minecraft server is not properly configured. Missing environment variables.')
        .addFields({ name: 'Status', value: 'Configuration Error', inline: true })
        .setTimestamp();

      return await interaction.reply({ embeds: [configErrorEmbed], ephemeral: true });
    }

    try {
      if (action === 'status') {
        await interaction.deferReply();

        // Check for any instances (pending or running)
        const anyInstance = await findAnyMinecraftInstance();

        if (anyInstance) {
          const state = anyInstance.State.Name;

          if (state === 'running') {
            // Check if Elastic IP is attached (service is ready)
            const instanceWithIP = await findMinecraftInstance();

            if (instanceWithIP && instanceWithIP.InstanceId === anyInstance.InstanceId) {
              // Instance is running AND has Elastic IP attached
              const statusEmbed = createServerStatusEmbed('running', {
                instanceId: anyInstance.InstanceId,
                instanceType: anyInstance.InstanceType
              });

              await interaction.editReply({ embeds: [statusEmbed] });
            } else {
              // Instance is running but Elastic IP not attached yet
              const bootingEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🔄 Minecraft Server Booting')
                .setDescription('Instance is running but service is still starting up...')
                .addFields(
                  { name: 'Status', value: 'Configuring', inline: true },
                  { name: 'Instance ID', value: `\`${anyInstance.InstanceId}\``, inline: true },
                  { name: 'Instance Type', value: anyInstance.InstanceType, inline: true }
                )
                .setTimestamp();

              await interaction.editReply({ embeds: [bootingEmbed] });
            }
          } else if (state === 'pending') {
            // Instance is still launching
            const bootingEmbed = new EmbedBuilder()
              .setColor('#FFA500')
              .setTitle('🔄 Minecraft Server Starting')
              .setDescription('Instance is launching...')
              .addFields(
                { name: 'Status', value: 'Launching', inline: true },
                { name: 'Instance ID', value: `\`${anyInstance.InstanceId}\``, inline: true }
              )
              .setTimestamp();

            await interaction.editReply({ embeds: [bootingEmbed] });
          } else {
            // Unexpected state
            const statusEmbed = createServerStatusEmbed('offline');
            await interaction.editReply({ embeds: [statusEmbed] });
          }
        } else {
          // No instances found
          const statusEmbed = createServerStatusEmbed('offline');
          await interaction.editReply({ embeds: [statusEmbed] });
        }

      } else if (action === 'start') {
        await interaction.deferReply();

        // STRICT CHECK: Look for ANY active instances (regardless of type)
        const allInstances = await findAllMinecraftInstances();

        if (allInstances.length > 0) {
          const existingInstance = allInstances[0];
          const state = existingInstance.State.Name;

          console.log(`LAUNCH BLOCKED: Found ${allInstances.length} existing instance(s). First: ${existingInstance.InstanceId} in state ${state}`);

          const blockEmbed = new EmbedBuilder()
            .setColor('#FF8C00')
            .setTitle('⚠️ Instance Already Exists')
            .setDescription(`Cannot start - found ${allInstances.length} active instance(s) already running or starting.`)
            .addFields(
              { name: 'Instance ID', value: `\`${existingInstance.InstanceId}\``, inline: true },
              { name: 'State', value: state, inline: true },
              { name: 'Type', value: existingInstance.InstanceType || 'Unknown', inline: true }
            )
            .setTimestamp();

          return await interaction.editReply({ embeds: [blockEmbed] });
        }

        console.log(`All checks passed. No instances found. Proceeding with launch at ${new Date().toISOString()}`);

        // Attempt to launch XL instance first
        let instanceData;
        let templateType = 'XL';

        try {
          const startingEmbed = createServerStatusEmbed('starting', { templateType: 'XL' });
          await interaction.editReply({ embeds: [startingEmbed] });

          instanceData = await launchSpotInstance(LAUNCH_TEMPLATE_XL);
        } catch (xlError) {
          console.log('XL instance launch failed, trying regular instance:', xlError.message);

          // Fall back to regular instance
          try {
            templateType = 'Regular';
            const fallbackEmbed = createServerStatusEmbed('starting', { templateType: 'Regular' });
            await interaction.editReply({ embeds: [fallbackEmbed] });

            instanceData = await launchSpotInstance(LAUNCH_TEMPLATE_REGULAR);
          } catch (regularError) {
            console.error('Both instance launches failed:', regularError);
            const errorEmbed = createServerStatusEmbed('error', {
              error: 'Failed to launch Spot instance. Both XL and Regular templates failed.'
            });

            return await interaction.editReply({ embeds: [errorEmbed] });
          }
        }

        const newInstance = instanceData.Instances[0];
        const instanceId = newInstance.InstanceId;

        // Wait for instance to be running
        try {
          await waitUntilInstanceRunning(
            { client: ec2Client, maxWaitTime: 300 },
            { InstanceIds: [instanceId] }
          );
        } catch (error) {
          console.error('Instance failed to reach running state:', error);
          const errorEmbed = createServerStatusEmbed('error', {
            error: 'Instance launched but failed to reach running state.'
          });

          return await interaction.editReply({ embeds: [errorEmbed] });
        }

        // Wait for Elastic IP to be attached (this confirms Minecraft service is ready)
        const progressEmbed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('🔄 Configuring Minecraft Server')
          .setDescription('Waiting for network configuration and service startup...')
          .addFields(
            { name: 'Instance ID', value: `\`${instanceId}\``, inline: true },
            { name: 'Status', value: 'Configuring Network', inline: true }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [progressEmbed] });

        const ipAttached = await waitForElasticIpAttachment(instanceId, 300);

        if (!ipAttached) {
          const errorEmbed = createServerStatusEmbed('error', {
            error: 'Instance launched but Elastic IP failed to attach. Service may not be ready.'
          });

          return await interaction.editReply({ embeds: [errorEmbed] });
        }

        // Get final instance details
        const describeCommand = new DescribeInstancesCommand({
          InstanceIds: [instanceId]
        });

        const finalData = await ec2Client.send(describeCommand);
        const finalInstance = finalData.Reservations[0].Instances[0];

        const successEmbed = createServerStatusEmbed('running', {
          instanceId: finalInstance.InstanceId,
          instanceType: finalInstance.InstanceType
        });

        await interaction.editReply({ embeds: [successEmbed] });

      } else if (action === 'stop') {
        await interaction.deferReply();

        // Check for multiple instances first (shouldn't happen, but good to catch)
        const allMinecraftInstances = await findAllMinecraftInstances();

        // Warn if multiple instances exist
        if (allMinecraftInstances.length > 1) {
          const warningEmbed = new EmbedBuilder()
            .setColor('#FF8C00') // Dark orange for warning
            .setTitle('⚠️ Multiple Instances Detected')
            .setDescription(`Found **${allMinecraftInstances.length}** active Minecraft instances. This should not happen!`)
            .addFields(
              { name: 'Status', value: 'Warning', inline: true },
              { name: 'Action Required', value: 'Manual AWS cleanup recommended', inline: true }
            )
            .setTimestamp();

          return await interaction.editReply({ embeds: [warningEmbed] });
        }

        // Find the instance with the Elastic IP attached
        const instance = await findMinecraftInstance();

        if (!instance) {
          const offlineEmbed = createServerStatusEmbed('offline');
          return await interaction.editReply({ embeds: [offlineEmbed] });
        }

        if (instance.State.Name !== 'running' && instance.State.Name !== 'pending') {
          const offlineEmbed = createServerStatusEmbed('offline');
          return await interaction.editReply({ embeds: [offlineEmbed] });
        }

        const instanceId = instance.InstanceId;

        // Send stopping notification
        const stoppingEmbed = createServerStatusEmbed('stopping');
        await interaction.editReply({ embeds: [stoppingEmbed] });

        // Terminate the Spot instance
        const terminateCommand = new TerminateInstancesCommand({
          InstanceIds: [instanceId]
        });

        await ec2Client.send(terminateCommand);

        // Wait for termination
        try {
          await waitUntilInstanceTerminated(
            { client: ec2Client, maxWaitTime: 300 },
            { InstanceIds: [instanceId] }
          );
        } catch (error) {
          console.error('Error waiting for instance termination:', error);
          // Continue anyway, as the termination was initiated
        }

        const stoppedEmbed = createServerStatusEmbed('stopped');
        await interaction.editReply({ embeds: [stoppedEmbed] });

      } else {
        const errorEmbed = createServerStatusEmbed('error', {
          error: 'Invalid action. Use `start`, `stop`, or `status`.'
        });

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }

    } catch (error) {
      console.error('Error executing Minecraft server command:', error);

      const errorEmbed = createServerStatusEmbed('error', {
        error: `An unexpected error occurred: ${error.message}`
      });

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  },
};

export default minecraftServer;

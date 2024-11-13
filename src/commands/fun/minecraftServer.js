import { SlashCommandBuilder } from "discord.js";
import { EC2Client, DescribeInstancesCommand, StartInstancesCommand, StopInstancesCommand, waitUntilInstanceRunning, waitUntilInstanceStopped } from '@aws-sdk/client-ec2';


const ec2Client = new EC2Client({
  region: 'us-east-1',
  credentials: {  
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY
  },
});

const INSTANCE_ID = process.env.INSTANCE_ID;

const minecraftServer = {
  data: new SlashCommandBuilder()
    .setName('minecraftserver')
    .setDescription('Command for Minecraft Server hosted in AWS')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Action to start/stop/status server')
        .setRequired(true)
        .addChoices(
          { name: 'status', value: 'status' },
          { name: 'start', value: 'start' },
          { name: 'stop', value: 'stop' }
        )),
  async execute(interaction) {
    const action = interaction.options.getString('action');

    try {
      const params = {
        InstanceIds: [INSTANCE_ID],
      };

      if (action === 'status') {
        const command = new DescribeInstancesCommand(params);
        const data = await ec2Client.send(command);
        const instance = data.Reservations[0].Instances[0];
        const state = instance.State.Name;

        await interaction.reply(`Minecraft server is currently \`${state}\`.`);
      } else if (action === 'start') {
        await interaction.deferReply();
        const command = new StartInstancesCommand(params);
        await ec2Client.send(command);
        await interaction.editReply('Minecraft server is starting...');

        // Wait for the instance to be running
        await waitUntilInstanceRunning({ client: ec2Client, maxWaitTime: 300 }, params);

        // Retrieve the updated instance information
        const describeCommand = new DescribeInstancesCommand(params);
        const data = await ec2Client.send(describeCommand);
        const instance = data.Reservations[0].Instances[0];
        const publicIpAddress = instance.PublicIpAddress;

        await interaction.followUp(
          `Minecraft server is now up and running!\nIP Address: \`${publicIpAddress}\``
        );
      } else if (action === 'stop') {
        await interaction.deferReply();
        const command = new StopInstancesCommand(params);
        await ec2Client.send(command);
        await interaction.editReply('Minecraft server is stopping...');

        // Wait for the instance to be stopped
        await waitUntilInstanceStopped({ client: ec2Client, maxWaitTime: 300 }, params);

        await interaction.followUp('Minecraft server has been stopped.');
      } else {
        await interaction.reply('Invalid action. Use `start`, `stop`, or `status`.');
      }
    } catch (error) {
      console.error('Error executing command:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply('An error occurred while executing the command.');
      } else {
        await interaction.reply('An error occurred while executing the command.');
      }
    }
  },
};

export default minecraftServer;
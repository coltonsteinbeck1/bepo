import { SlashCommandBuilder } from "discord.js";
import AWS from 'aws-sdk'
AWS.config.update({ region: 'us-west-2' }); // Replace with your region

const ec2 = new AWS.EC2({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const INSTANCE_ID = 'i-0d05d8ad48e06453f';

const minecraftServer = {
  data: new SlashCommandBuilder()
    .setName('minecraftserver')
    .setDescription('Command for Minecraft Server hosted in AWS')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Action to start/stop server')
        .setRequired(true)
        .addChoices(
          { name: 'start', value: 'start' },
          { name: 'stop', value: 'stop' }
        )),
  async execute(interaction) {
    const action = interaction.options.getString('action');

    if (action === 'start') {
      try {
        const params = {
          InstanceIds: [INSTANCE_ID],
        };
        await ec2.startInstances(params).promise();
        await interaction.reply('Minecraft server is starting...');
      } catch (error) {
        console.error(error);
        await interaction.reply('Failed to start the Minecraft server.');
      }
    } else if (action === 'stop') {
      try {
        const params = {
          InstanceIds: [INSTANCE_ID],
        };
        await ec2.stopInstances(params).promise();
        await interaction.reply('Minecraft server is stopping...');
      } catch (error) {
        console.error(error);
        await interaction.reply('Failed to stop the Minecraft server.');
      }
    } else {
      await interaction.reply('Invalid action. Use `start` or `stop`.');
    }
  }
};

export default minecraftServer;
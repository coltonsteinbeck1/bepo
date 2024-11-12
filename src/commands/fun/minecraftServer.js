import { SlashCommandBuilder } from "discord.js";
import AWS from 'aws-sdk'
AWS.config.update({ region: 'us-east-1' });


const ec2 = new AWS.EC2({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY
});

const INSTANCE_ID = process.env.INSTANCE_ID;

const minecraftServer = {
  data: new SlashCommandBuilder()
    .setName('minecraftserver')
    .setDescription('Command for Minecraft Server hosted in AWS')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Action to start/stop server')
        .setRequired(true)
        .addChoices(
          {name: 'status', value:"status"},
          { name: 'start', value: 'start' },
          { name: 'stop', value: 'stop' }
        )),
  async execute(interaction) {
    const action = interaction.options.getString('action');
    await interaction.deferReply();
    if (action === 'status') {
      try {
        const params = {
          InstanceIds: [INSTANCE_ID],
        };
        const data = await ec2.describeInstances(params).promise();
        const instance = data.Reservations[0].Instances[0];
        const state = instance.State.Name;
    
        await interaction.editReply(`Minecraft server is currently \`${state}\`.`);
      } catch (error) {
        console.error('Error fetching instance status:', error);
        await interaction.reply('Failed to retrieve server status.');
      }
    }
    else if (action === 'start') {
      try {
        const params = {
          InstanceIds: [INSTANCE_ID],
        };
        await ec2.startInstances(params).promise();
        await interaction.editReply('Minecraft server is starting...');
        await ec2.waitFor('instanceRunning', params).promise();
        await interaction.followUp('Minecraft server is now up and running!');

      } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          if (interaction.replied) {
            await interaction.followUp('Failed to start the Minecraft server.');
          } else {
            await interaction.editReply('Failed to start the Minecraft server.');
          }
        } else {
          await interaction.reply('Failed to start the Minecraft server.');
        }
      }
    } 
    else if (action === 'stop') {
      try {
        const params = {
          InstanceIds: [INSTANCE_ID],
        };
        await ec2.stopInstances(params).promise();
        await interaction.editReply('Minecraft server is stopping...');
        await ec2.waitFor('instanceStopped', params).promise();
        await interaction.followUp('Minecraft server has been stopped.');
      } 
      catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          if (interaction.replied) {
            await interaction.followUp('Failed to stop the Minecraft server.');
          } else {
            await interaction.editReply('Failed to stop the Minecraft server.');
          }
        } else {
          await interaction.reply('Failed to stop the Minecraft server.');
        }
      }
    } 
    else {
      console.error('Error executing command:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply('An error occurred while executing the command.');
      } else {
        await interaction.reply('An error occurred while executing the command.');
      }
    }
  }
};

export default minecraftServer;
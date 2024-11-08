import { SlashCommandBuilder } from "discord.js";
import AWS from 'aws-sdk'
AWS.config.update({ region: 'us-east-1' });


const ec2 = new AWS.EC2({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY
});

const INSTANCE_ID = 'i-0040cf0ae0c1ebf28';

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
    
    if (action === 'status') {
      try {
        const params = {
          InstanceIds: [INSTANCE_ID],
        };
        const data = await ec2.describeInstances(params).promise();
        const instance = data.Reservations[0].Instances[0];
        const state = instance.State.Name;
    
        await interaction.reply(`Minecraft server is currently \`${state}\`.`);
      } catch (error) {
        console.error('Error fetching instance status:', error);
        await interaction.reply('Failed to retrieve server status.');
      }
    }else if (action === 'start') {
      try {
        const params = {
          InstanceIds: [INSTANCE_ID],
        };
        await ec2.startInstances(params).promise();
        await interaction.reply('Minecraft server is starting...');
        //Call script to run mods (?)
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
        //We need to save data for MC server, (ctrl + c) on actual vm
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
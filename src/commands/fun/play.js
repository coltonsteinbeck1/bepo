// play.js
import { joinVoiceChannel, createAudioResource, createAudioPlayer } from '@discordjs/voice';
import { SlashCommandBuilder } from 'discord.js';
import ytdl from 'ytdl-core';

const playCommand = {
    data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Plays a audio link in a voice channel')
    .addStringOption(option => 
        option.setName('link')
        .setDescription('The link to play')
        .setRequired(true)
    )
    .addChannelOption(option => 
        option.setName('channel')
        .setDescription('The channel to play in')
        .setRequired(true)
    ),
    async execute(interaction) {
        const link = interaction.options.getString('link');
        const channel = interaction.options.getChannel('channel');

        if (channel.type === 2) {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: false,
            });

            const stream = ytdl(link, { filter: 'audioonly' });
            const resource = createAudioResource(stream);
            const player = createAudioPlayer();

            player.play(resource);
            connection.subscribe(player);

            await interaction.reply('Playing YouTube link in voice channel...');
        } else {
            await interaction.reply('Please provide a voice channel.');
        }
    }

}; export default playCommand;
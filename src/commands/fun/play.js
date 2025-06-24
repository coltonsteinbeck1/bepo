// play.js
import { joinVoiceChannel, createAudioResource, createAudioPlayer, StreamType, AudioPlayerStatus } from '@discordjs/voice';
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import playdl from 'play-dl';
import youtubedl from 'youtube-dl-exec';
import { Readable } from 'stream';

// Global music queue and player state
const musicQueues = new Map(); // guildId -> queue data
const connections = new Map(); // guildId -> voice connection

// Export the musicQueues for use in other commands
export { musicQueues };

// Queue management functions
export const addToQueue = (guildId, songData) => {
    const queueData = musicQueues.get(guildId);
    if (queueData) {
        queueData.songs.push(songData);
        return true;
    }
    return false;
};

export const removeFromQueue = (guildId, index) => {
    const queueData = musicQueues.get(guildId);
    if (queueData && index >= 0 && index < queueData.songs.length && index !== queueData.currentIndex) {
        const removed = queueData.songs.splice(index, 1)[0];
        // Adjust current index if necessary
        if (index < queueData.currentIndex) {
            queueData.currentIndex--;
        }
        return removed;
    }
    return null;
};

export const moveInQueue = (guildId, fromIndex, toIndex) => {
    const queueData = musicQueues.get(guildId);
    if (queueData && fromIndex >= 0 && fromIndex < queueData.songs.length && 
        toIndex >= 0 && toIndex < queueData.songs.length && 
        fromIndex !== queueData.currentIndex && toIndex !== queueData.currentIndex) {
        
        const song = queueData.songs.splice(fromIndex, 1)[0];
        queueData.songs.splice(toIndex, 0, song);
        
        // Adjust current index if necessary
        if (fromIndex < queueData.currentIndex && toIndex >= queueData.currentIndex) {
            queueData.currentIndex--;
        } else if (fromIndex > queueData.currentIndex && toIndex <= queueData.currentIndex) {
            queueData.currentIndex++;
        }
        
        return song;
    }
    return null;
};

export const clearQueue = (guildId) => {
    const queueData = musicQueues.get(guildId);
    if (queueData) {
        const clearedCount = queueData.songs.length - queueData.currentIndex - 1;
        queueData.songs = queueData.songs.slice(0, queueData.currentIndex + 1);
        return clearedCount;
    }
    return 0;
};

// Set up play-dl with some configuration
const setupPlayDL = async () => {
    try {
        await playdl.setToken({
            youtube: {
                cookie: process.env.YOUTUBE_COOKIE || ''
            }
        });
    } catch (error) {
        console.log('play-dl setup note:', error.message);
    }
};

// Create music control embed
const createMusicEmbed = (song, queue, isPlaying = true) => {
    const embed = new EmbedBuilder()
        .setColor(isPlaying ? '#00ff00' : '#ff9900')
        .setTitle(isPlaying ? '🎵 Now Playing' : '⏸️ Paused')
        .setDescription(`**${song.title}**`)
        .addFields(
            { name: '👤 Channel', value: song.channel || 'Unknown', inline: true },
            { name: '⏱️ Duration', value: song.duration || 'Unknown', inline: true },
            { name: '📋 Queue', value: `${queue.currentIndex + 1}/${queue.songs.length}`, inline: true }
        )
        .setThumbnail(song.thumbnail)
        .setTimestamp();

    if (queue.songs.length > 1) {
        const upcoming = queue.songs.slice(queue.currentIndex + 1, queue.currentIndex + 4)
            .map((s, i) => `${i + 1}. ${s.title}`)
            .join('\n') || 'No upcoming songs';
        embed.addFields({ name: '🔜 Up Next', value: upcoming });
    }

    return embed;
};

// Create control buttons
const createControlButtons = (hasQueue = false) => {
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('music_pause')
                .setLabel('⏸️ Pause')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('music_skip')
                .setLabel('⏭️ Skip')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('music_stop')
                .setLabel('⏹️ Stop')
                .setStyle(ButtonStyle.Danger)
        );

    if (hasQueue) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('music_previous')
                .setLabel('⏮️ Previous')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_queue')
                .setLabel('📋 Queue')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    return row;
};

// Play next song in queue
const playNextSong = async (guildId, interaction = null) => {
    const queueData = musicQueues.get(guildId);
    const connection = connections.get(guildId);
    
    if (!queueData || !connection) return;

    if (queueData.currentIndex >= queueData.songs.length - 1) {
        // End of queue
        queueData.player = null;
        if (interaction) {
            await interaction.editReply({
                embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('🔚 Queue Finished').setDescription('All songs have been played!')],
                components: []
            });
        }
        return;
    }

    queueData.currentIndex++;
    const song = queueData.songs[queueData.currentIndex];
    
    try {
        // Get audio URL
        const audioUrl = await youtubedl(song.url, {
            format: 'bestaudio',
            getUrl: true,
            quiet: true
        });

        // Create audio resource
        const response = await fetch(audioUrl);
        const stream = Readable.fromWeb(response.body);
        const resource = createAudioResource(stream, { inputType: StreamType.WebmOpus });

        // Play the song
        queueData.player.play(resource);

        // Update embed
        const embed = createMusicEmbed(song, queueData);
        const buttons = createControlButtons(queueData.songs.length > 1);

        if (queueData.lastMessage) {
            await queueData.lastMessage.edit({
                embeds: [embed],
                components: [buttons]
            });
        }
    } catch (error) {
        console.error('Error playing next song:', error);
    }
};

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
        const guildId = interaction.guild.id;

        // Validate inputs
        if (!link) {
            await interaction.reply('Please provide a valid URL.');
            return;
        }

        if (channel.type !== 2) {
            await interaction.reply('Please provide a voice channel.');
            return;
        }

        try {
            await setupPlayDL();
            
            // Validate URL
            const isValid = playdl.yt_validate(link);
            if (!isValid) {
                await interaction.reply('Please provide a valid YouTube URL.');
                return;
            }

            await interaction.deferReply();

            // Get video info
            const info = await playdl.video_info(link);
            const songData = {
                url: link,
                title: info.video_details.title,
                channel: info.video_details.channel?.name || 'Unknown',
                duration: info.video_details.durationRaw || 'Unknown',
                thumbnail: info.video_details.thumbnails?.[0]?.url || null
            };

            // Initialize or get existing queue
            let queueData = musicQueues.get(guildId);
            let connection = connections.get(guildId);

            if (!queueData) {
                // Create new queue
                queueData = {
                    songs: [songData],
                    currentIndex: 0,
                    player: createAudioPlayer(),
                    isPaused: false,
                    lastMessage: null
                };
                musicQueues.set(guildId, queueData);

                // Create voice connection
                connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                    selfDeaf: false,
                });
                connections.set(guildId, connection);

                // Set up player event listeners
                queueData.player.on(AudioPlayerStatus.Idle, () => {
                    playNextSong(guildId);
                });

                connection.subscribe(queueData.player);
            } else {
                // Add to existing queue
                queueData.songs.push(songData);
                await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('➕ Added to Queue')
                        .setDescription(`**${songData.title}**`)
                        .addFields(
                            { name: 'Position', value: `${queueData.songs.length}`, inline: true },
                            { name: 'Queue Length', value: `${queueData.songs.length} songs`, inline: true }
                        )
                        .setThumbnail(songData.thumbnail)
                    ]
                });
                return;
            }

            // Get audio URL and play
            const audioUrl = await youtubedl(link, {
                format: 'bestaudio',
                getUrl: true,
                quiet: true
            });

            const response = await fetch(audioUrl);
            const stream = Readable.fromWeb(response.body);
            const resource = createAudioResource(stream, { inputType: StreamType.WebmOpus });

            queueData.player.play(resource);

            // Create and send embed with controls
            const embed = createMusicEmbed(songData, queueData);
            const buttons = createControlButtons(queueData.songs.length > 1);

            const message = await interaction.editReply({
                embeds: [embed],
                components: [buttons]
            });

            queueData.lastMessage = message;

        } catch (error) {
            console.error('Error playing audio:', error);
            await interaction.editReply('Failed to play audio. Please check the URL and try again.');
        }
    }

}; 

// Button interaction handlers
export const handleMusicInteraction = async (interaction) => {
    const guildId = interaction.guild.id;
    const queueData = musicQueues.get(guildId);

    if (!queueData) {
        await interaction.reply({ content: 'No music is currently playing!', ephemeral: true });
        return;
    }

    const currentSong = queueData.songs[queueData.currentIndex];

    switch (interaction.customId) {
        case 'music_pause':
            if (queueData.isPaused) {
                queueData.player.unpause();
                queueData.isPaused = false;
                const embed = createMusicEmbed(currentSong, queueData, true);
                await interaction.update({
                    embeds: [embed],
                    components: [createControlButtons(queueData.songs.length > 1)]
                });
            } else {
                queueData.player.pause();
                queueData.isPaused = true;
                const embed = createMusicEmbed(currentSong, queueData, false);
                embed.setTitle('⏸️ Paused');
                await interaction.update({
                    embeds: [embed],
                    components: [createControlButtons(queueData.songs.length > 1)]
                });
            }
            break;

        case 'music_skip':
            if (queueData.currentIndex < queueData.songs.length - 1) {
                queueData.player.stop(); // This will trigger the next song
                await interaction.deferUpdate();
            } else {
                await interaction.reply({ content: 'No more songs in the queue!', ephemeral: true });
            }
            break;

        case 'music_previous':
            if (queueData.currentIndex > 0) {
                queueData.currentIndex -= 2; // Will be incremented by playNextSong
                queueData.player.stop();
                await interaction.deferUpdate();
            } else {
                await interaction.reply({ content: 'No previous songs!', ephemeral: true });
            }
            break;

        case 'music_stop':
            queueData.player.stop();
            musicQueues.delete(guildId);
            const connection = connections.get(guildId);
            if (connection) {
                connection.destroy();
                connections.delete(guildId);
            }
            
            const stopEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('⏹️ Music Stopped')
                .setDescription('Music has been stopped and queue cleared.');
                
            await interaction.update({
                embeds: [stopEmbed],
                components: []
            });
            break;

        case 'music_queue':
            const queueEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📋 Current Queue')
                .setDescription(
                    queueData.songs.map((song, index) => 
                        `${index === queueData.currentIndex ? '**➤' : `${index + 1}.`} ${song.title}${index === queueData.currentIndex ? '**' : ''}`
                    ).join('\n') || 'Queue is empty'
                )
                .addFields({ name: 'Total Songs', value: `${queueData.songs.length}`, inline: true });
                
            await interaction.reply({ embeds: [queueEmbed], ephemeral: true });
            break;
    }
};

export default playCommand;
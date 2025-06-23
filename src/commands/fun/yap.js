import {
    joinVoiceChannel,
    createAudioResource,
    createAudioPlayer,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    EndBehaviorType
} from '@discordjs/voice';
import { SlashCommandBuilder, ChannelType } from 'discord.js';
import WebSocket from 'ws';
import { Readable } from 'stream';
import prism from 'prism-media';
import dotenv from "dotenv";
import voiceSessionManager from '../../utils/voiceSessionManager.js';
dotenv.config();

const yapCommand = {
    data: new SlashCommandBuilder()
        .setName('yap')
        .setDescription('Connect to voice channel and chat with users using OpenAI Realtime API')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The voice channel to join')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildVoice)
        ),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');

        if (!channel || channel.type !== ChannelType.GuildVoice) {
            return await interaction.reply({
                content: 'Please provide a valid voice channel.',
                ephemeral: true
            });
        }

        // Check if user has permissions to join the channel
        if (!channel.joinable) {
            return await interaction.reply({
                content: 'I don\'t have permission to join that voice channel.',
                ephemeral: true
            });
        }

        // Check if OpenAI API key is available
        if (!process.env.OPENAI_KEY) {
            return await interaction.reply({
                content: 'OpenAI API key not configured.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            // Create voice connection
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false,
            });

            // Create Realtime API session
            const realtimeSession = new RealtimeSession(connection, interaction);
            await realtimeSession.start();

            await interaction.editReply(`🎤 Connected to ${channel.name} and ready to chat! Say something to start the conversation.`);

            // Store session for cleanup using the session manager
            voiceSessionManager.addSession(channel.id, realtimeSession);

        } catch (error) {
            console.error('Error in yap command:', error);
            await interaction.editReply('❌ Failed to connect to voice channel or start Realtime API session.');
        }
    },
};

class RealtimeSession {
    constructor(connection, interaction) {
        this.connection = connection;
        this.interaction = interaction;
        this.ws = null;
        this.audioPlayer = createAudioPlayer();
        this.isConnected = false;
        this.audioQueue = [];
        this.isPlaying = false;
        this.responseAudioBuffer = Buffer.alloc(0); // Accumulate full response

        // VAD (Voice Activity Detection) state
        this.isRecording = false;
        this.audioBuffer = [];
        this.silenceThreshold = 800; // ms of silence to end recording
        this.silenceTimer = null;
        this.minRecordingDuration = 1000; // minimum 1 second recording
        this.recordingStartTime = null;
        this.currentAudioStream = null;

        // Auto-shutdown after inactivity
        this.lastAudioTime = Date.now();
        this.inactivityTimeout = 30000; // 30 seconds
        this.inactivityTimer = null;
        this.startInactivityTimer();

        this.setupConnectionHandlers();
        this.setupAudioPlayer();
    }

    setupConnectionHandlers() {
        this.connection.on(VoiceConnectionStatus.Ready, () => {
            console.log('Voice connection is ready');
            this.connection.subscribe(this.audioPlayer);
            this.startListening();
        });

        this.connection.on(VoiceConnectionStatus.Disconnected, () => {
            console.log('Voice connection disconnected');
            this.cleanup();
        });

        this.connection.on('error', (error) => {
            console.error('Voice connection error:', error);
            this.cleanup();
        });
    }

    setupAudioPlayer() {
        this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
            this.isPlaying = false;
            this.playNextAudio();
        });

        this.audioPlayer.on('error', (error) => {
            console.error('Audio player error:', error);
            this.isPlaying = false;
        });
    }

    async start() {
        const wsUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview';

        this.ws = new WebSocket(wsUrl, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_KEY}`,
                'OpenAI-Beta': 'realtime=v1'
            }
        });

        return new Promise((resolve, reject) => {
            this.ws.on('open', async () => {
                console.log('Connected to OpenAI Realtime API with gpt-4o-mini');
                this.isConnected = true;

                // Send session configuration
                await this.sendSessionUpdate();
                resolve();
            });

            this.ws.on('message', (data) => {
                this.handleRealtimeMessage(JSON.parse(data.toString()));
            });

            this.ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            });

            this.ws.on('close', () => {
                console.log('WebSocket connection closed');
                this.isConnected = false;
            });
        });
    }

    async sendSessionUpdate() {
        const sessionConfig = {
            type: 'session.update',
            session: {
                modalities: ['text', 'audio'],
                instructions: process.env.MODEL_VOICE_SYSTEM_MESSAGE,
                voice: 'alloy',
                input_audio_format: 'pcm16',
                output_audio_format: 'pcm16',
                input_audio_transcription: {
                    model: 'whisper-1'
                },
                turn_detection: null, // Disable server VAD to use our client-side logic
                tools: [],
                tool_choice: 'auto',
                temperature: 0.8,
                max_response_output_tokens: 4096
            }
        };

        console.log('Sending session configuration:', JSON.stringify(sessionConfig, null, 2));
        this.sendMessage(sessionConfig);
    }

    startListening() {
        // Set up audio receiving from Discord
        this.connection.receiver.speaking.on('start', (userId) => {
            console.log(`User ${userId} started speaking`);
            this.updateLastAudioTime();
            this.startRecording(userId);
        });

        this.connection.receiver.speaking.on('end', (userId) => {
            console.log(`User ${userId} stopped speaking`);
            this.stopRecording(userId);
        });
    }

    startInactivityTimer() {
        this.clearInactivityTimer();
        this.inactivityTimer = setTimeout(() => {
            console.log('No audio input for 30 seconds, shutting down...');
            this.interaction.followUp('🔇 No voice activity detected for 30 seconds. Disconnecting from voice channel.').catch(console.error);
            this.cleanup();
        }, this.inactivityTimeout);
        console.log('Inactivity timer started (30 seconds)');
    }

    clearInactivityTimer() {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
    }

    updateLastAudioTime() {
        this.lastAudioTime = Date.now();
        this.startInactivityTimer(); // Reset the timer
        console.log('Audio activity detected, resetting inactivity timer');
    }

    startRecording(userId) {
        if (this.isRecording) return;

        console.log(`Starting recording for user ${userId}`);
        this.isRecording = true;
        this.audioBuffer = [];
        this.recordingStartTime = Date.now();

        // Clear any existing silence timer
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }

        this.currentAudioStream = this.connection.receiver.subscribe(userId, {
            end: {
                behavior: EndBehaviorType.AfterSilence,
                duration: this.silenceThreshold,
            },
        });

        // Create Opus decoder
        const opusDecoder = new prism.opus.Decoder({
            rate: 48000,
            channels: 2,
            frameSize: 960
        });

        this.currentAudioStream.pipe(opusDecoder);

        opusDecoder.on('data', (pcmData) => {
            try {
                if (pcmData && pcmData.length > 0) {
                    // Convert from 48kHz stereo PCM to 24kHz mono for OpenAI using cleaner method
                    const convertedData = voiceSessionManager.constructor.convertToMono24kHz(pcmData);
                    if (convertedData && convertedData.length > 0) {
                        this.audioBuffer.push(convertedData);
                        console.log(`Audio chunk: ${pcmData.length} bytes PCM -> ${convertedData.length} bytes mono`);
                    }
                }
            } catch (error) {
                console.error('Error processing decoded audio:', error);
            }
        });

        opusDecoder.on('error', (error) => {
            console.error('Opus decoder error:', error);
        });

        this.currentAudioStream.on('end', () => {
            console.log('Audio stream ended');
            this.finalizeRecording();
        });
    }

    stopRecording(userId) {
        if (!this.isRecording) return;

        console.log(`User ${userId} stopped speaking, setting silence timer`);
        // Add a small delay to ensure we capture the end of speech
        if (this.silenceTimer) clearTimeout(this.silenceTimer);

        this.silenceTimer = setTimeout(() => {
            console.log('Silence timer triggered, finalizing recording');
            // Check again if still recording before finalizing
            if (this.isRecording) {
                this.finalizeRecording();
            }
        }, this.silenceThreshold);
    }

    finalizeRecording() {
        if (!this.isRecording) {
            console.log('Cannot finalize recording: not currently recording');
            return;
        }

        if (this.audioBuffer.length === 0) {
            console.log('Cannot finalize recording: empty audio buffer');
            this.isRecording = false;
            return;
        }

        const recordingDuration = Date.now() - this.recordingStartTime;
        console.log(`Recording duration: ${recordingDuration}ms, buffer chunks: ${this.audioBuffer.length}`);

        // Log individual chunk sizes for debugging
        console.log('Individual chunk sizes:', this.audioBuffer.map(chunk => chunk.length));

        if (recordingDuration < this.minRecordingDuration) {
            console.log('Recording too short, discarding');
            this.isRecording = false;
            this.audioBuffer = [];
            return;
        }

        // Combine audio buffer and check size
        const combinedAudio = Buffer.concat(this.audioBuffer);
        console.log(`Combined audio size: ${combinedAudio.length} bytes`);

        // OpenAI expects at least 100ms of audio at 24kHz mono (16-bit)
        // 24000 samples/sec * 0.2 sec * 2 bytes/sample = 9600 bytes minimum
        // Let's be more conservative and require 200ms minimum
        const minimumBytes = 9600; // 200ms at 24kHz mono

        if (combinedAudio.length >= minimumBytes) {
            // Fix duration calculation: bytes / (sample_rate * bytes_per_sample) * 1000 for ms
            const durationMs = (combinedAudio.length / 2) / 24000 * 1000;
            console.log(`✓ Sending ${combinedAudio.length} bytes of audio to OpenAI (${durationMs.toFixed(1)}ms)`);
            this.sendAudioToOpenAI(combinedAudio);
        } else {
            const durationMs = (combinedAudio.length / 2) / 24000 * 1000;
            console.log(`✗ Audio buffer too small: ${combinedAudio.length} bytes (${durationMs.toFixed(1)}ms), minimum required: ${minimumBytes} bytes (200ms)`);
            console.log('Discarding short audio clip');
        }

        this.isRecording = false;
        this.audioBuffer = [];

        // Clean up audio stream
        if (this.currentAudioStream) {
            this.currentAudioStream.destroy();
            this.currentAudioStream = null;
        }
    }

    sendAudioToOpenAI(audioData) {
        if (!this.isConnected || !this.ws) {
            console.log('Cannot send audio: not connected to OpenAI');
            return;
        }

        if (!audioData || audioData.length === 0) {
            console.log('Cannot send audio: empty audio data');
            return;
        }

        try {
            // Send audio data to OpenAI Realtime API
            const audioMessage = {
                type: 'input_audio_buffer.append',
                audio: audioData.toString('base64')
            };

            console.log(`Sending audio append message: ${audioData.length} bytes`);
            this.sendMessage(audioMessage);

            // Commit the audio buffer to trigger processing
            const commitMessage = {
                type: 'input_audio_buffer.commit'
            };

            console.log('Sending audio commit message');
            this.sendMessage(commitMessage);

            // Trigger response generation
            const responseMessage = {
                type: 'response.create',
                response: {
                    modalities: ['audio', 'text'],
                    instructions: 'Please respond to the user\'s audio input naturally and conversationally.'
                }
            };

            console.log('Triggering response generation');
            this.sendMessage(responseMessage);
        } catch (error) {
            console.error('Error sending audio to OpenAI:', error);
        }
    }

    handleRealtimeMessage(message) {
        console.log(`Received message: ${message.type}`);

        try {
            switch (message.type) {
                case 'session.created':
                    console.log('Realtime session created');
                    break;

                case 'session.updated':
                    console.log('Realtime session updated');
                    break;

                case 'input_audio_buffer.committed':
                    console.log('Audio buffer committed');
                    break;

                case 'input_audio_buffer.speech_started':
                    console.log('Speech detected by OpenAI VAD');
                    break;

                case 'input_audio_buffer.speech_stopped':
                    console.log('Speech ended, generating response');
                    break;

                case 'conversation.item.created':
                    if (message.item.type === 'message' && message.item.role === 'assistant') {
                        console.log('Assistant response created');
                    } else if (message.item.type === 'message' && message.item.role === 'user') {
                        console.log('User audio message created');
                    }
                    break;

                case 'conversation.item.input_audio_transcription.delta':
                    console.log('Transcription delta received');
                    break;

                case 'conversation.item.input_audio_transcription.completed':
                    console.log('Audio transcription completed:', message.transcript);
                    break;

                case 'response.created':
                    console.log('Response generation started');
                    // Clear any previous response buffer
                    this.responseAudioBuffer = Buffer.alloc(0);
                    break;

                case 'response.audio.delta':
                    // Received audio response from OpenAI
                    console.log(`Received audio delta: ${message.delta ? 'data present' : 'no data'}`);
                    this.handleAudioResponse(message.delta);
                    break;

                case 'response.audio.done':
                    console.log('Audio response completed');
                    // Now process the complete accumulated audio
                    if (this.responseAudioBuffer.length > 0) {
                        console.log(`Processing complete response: ${this.responseAudioBuffer.length} bytes`);
                        
                        // Convert the entire response at once for smoother playback
                        const discordAudio = voiceSessionManager.constructor.convertTo48kHzStereo(this.responseAudioBuffer);
                        
                        if (discordAudio.length > 0) {
                            this.audioQueue.push(discordAudio);
                            
                            if (!this.isPlaying) {
                                this.playNextAudio();
                            }
                        }
                        
                        // Clear the buffer for next response
                        this.responseAudioBuffer = Buffer.alloc(0);
                    }
                    break;

                case 'response.done':
                    console.log('Full response completed');
                    break;

                case 'error':
                    console.error('OpenAI Realtime API error:', message.error);
                    this.interaction.followUp(`❌ OpenAI error: ${message.error.message || 'Unknown error'}`).catch(console.error);
                    break;

                default:
                    console.log('Unhandled message type:', message.type);
            }
        } catch (error) {
            console.error('Error handling realtime message:', error);
        }
    }

    handleAudioResponse(audioData) {
        if (!audioData) return;

        try {
            // Convert base64 audio to buffer and accumulate
            const audioBuffer = Buffer.from(audioData, 'base64');
            this.responseAudioBuffer = Buffer.concat([this.responseAudioBuffer, audioBuffer]);
            
            console.log(`Accumulated audio: ${this.responseAudioBuffer.length} bytes total`);
            
            // Don't play individual chunks - wait for complete response
        } catch (error) {
            console.error('Error handling audio response:', error);
        }
    }

    playNextAudio() {
        if (this.audioQueue.length === 0 || this.isPlaying) return;

        const audioData = this.audioQueue.shift();
        this.isPlaying = true;

        try {
            // Create a readable stream from the audio data
            const audioStream = new Readable({
                read() {
                    this.push(audioData);
                    this.push(null); // End stream
                }
            });

            // Create audio resource with simpler settings
            const resource = createAudioResource(audioStream, {
                inputType: 'raw'
            });
            
            console.log(`Playing audio chunk: ${audioData.length} bytes`);
            this.audioPlayer.play(resource);
        } catch (error) {
            console.error('Error playing audio:', error);
            this.isPlaying = false;
            // Try to play next audio if available
            if (this.audioQueue.length > 0) {
                this.playNextAudio();
            }
        }
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    cleanup() {
        console.log('Cleaning up Realtime session');

        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }

        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }

        if (this.currentAudioStream) {
            this.currentAudioStream.destroy();
            this.currentAudioStream = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        if (this.audioPlayer) {
            this.audioPlayer.stop();
        }

        if (this.connection) {
            this.connection.destroy();
        }

        // Remove from session manager
        voiceSessionManager.removeSession(this.connection.joinConfig.channelId);

        this.isConnected = false;
        this.isRecording = false;
        this.audioBuffer = [];
        this.responseAudioBuffer = Buffer.alloc(0);
    }
}

export default yapCommand;
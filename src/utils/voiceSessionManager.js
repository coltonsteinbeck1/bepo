// Voice Session Manager for handling realtime voice sessions
class VoiceSessionManager {
    constructor() {
        this.sessions = new Map();
    }

    addSession(channelId, session) {
        this.sessions.set(channelId, session);
        console.log(`Added voice session for channel ${channelId}`);
    }

    removeSession(channelId) {
        if (this.sessions.has(channelId)) {
            this.sessions.delete(channelId);
            console.log(`Removed voice session for channel ${channelId}`);
            return true;
        }
        return false;
    }

    getSession(channelId) {
        return this.sessions.get(channelId);
    }

    getAllSessions() {
        return this.sessions;
    }

    stopAllSessions() {
        for (const [channelId, session] of this.sessions.entries()) {
            try {
                session.cleanup();
            } catch (error) {
                console.error(`Error cleaning up session ${channelId}:`, error);
            }
        }
        this.sessions.clear();
        console.log('All voice sessions stopped');
    }

    stopSessionsInGuild(guildId, client) {
        const sessionsToRemove = [];
        
        for (const [channelId, session] of this.sessions.entries()) {
            try {
                const channel = client.channels.cache.get(channelId);
                if (channel && channel.guild.id === guildId) {
                    session.cleanup();
                    sessionsToRemove.push(channelId);
                }
            } catch (error) {
                console.error(`Error stopping session ${channelId}:`, error);
            }
        }

        sessionsToRemove.forEach(channelId => this.sessions.delete(channelId));
        console.log(`Stopped ${sessionsToRemove.length} sessions in guild ${guildId}`);
    }

    // Audio processing utilities
    static convertToMono24kHz(stereoBuffer) {
        try {
            if (!stereoBuffer || stereoBuffer.length === 0) {
                return Buffer.alloc(0);
            }

            const inputSampleRate = 48000;
            const outputSampleRate = 24000;
            const inputChannels = 2;
            const outputChannels = 1;
            const bytesPerSample = 2;

            const frameSize = inputChannels * bytesPerSample;
            const completeFrames = Math.floor(stereoBuffer.length / frameSize);

            if (completeFrames === 0) {
                return Buffer.alloc(0);
            }

            const inputFrames = completeFrames;
            const outputFrames = Math.floor(inputFrames * outputSampleRate / inputSampleRate);

            if (outputFrames === 0) {
                return Buffer.alloc(0);
            }

            const outputBuffer = Buffer.alloc(outputFrames * outputChannels * bytesPerSample);
            let outputIndex = 0;
            const downSampleRatio = inputSampleRate / outputSampleRate;

            // Less aggressive processing for better quality
            for (let i = 0; i < inputFrames && outputIndex < outputBuffer.length - 1; i += downSampleRatio) {
                const frameIndex = Math.floor(i);
                const inputByteIndex = frameIndex * frameSize;

                if (inputByteIndex + frameSize - 1 < stereoBuffer.length) {
                    const left = stereoBuffer.readInt16LE(inputByteIndex);
                    const right = stereoBuffer.readInt16LE(inputByteIndex + 2);

                    // Simple average for mono conversion
                    const mono = Math.round((left + right) / 2);

                    // Minimal processing - just ensure it's within range
                    const clampedMono = Math.max(-32767, Math.min(32767, mono));

                    outputBuffer.writeInt16LE(clampedMono, outputIndex);
                    outputIndex += 2;
                }
            }

            return outputBuffer.slice(0, outputIndex);
        } catch (error) {
            console.error('Audio conversion error:', error);
            return Buffer.alloc(0);
        }
    }

    static convertTo48kHzStereo(monoBuffer) {
        try {
            if (!monoBuffer || monoBuffer.length === 0) {
                return Buffer.alloc(0);
            }

            const bytesPerSample = 2;
            const inputSamples = monoBuffer.length / bytesPerSample;
            
            // Simple 2x upsampling: 24kHz -> 48kHz
            // Each input sample becomes 2 output samples, and mono becomes stereo
            const outputBuffer = Buffer.alloc(inputSamples * 2 * 2 * bytesPerSample); // 2x samples, 2x channels
            
            let outputIndex = 0;

            for (let i = 0; i < inputSamples; i++) {
                const inputByteIndex = i * bytesPerSample;
                
                if (inputByteIndex + 1 < monoBuffer.length) {
                    const sample = monoBuffer.readInt16LE(inputByteIndex);

                    // Write each sample twice (for 2x upsampling) to both channels
                    // First duplicate
                    outputBuffer.writeInt16LE(sample, outputIndex);     // Left
                    outputBuffer.writeInt16LE(sample, outputIndex + 2); // Right
                    outputIndex += 4;
                    
                    // Second duplicate  
                    outputBuffer.writeInt16LE(sample, outputIndex);     // Left
                    outputBuffer.writeInt16LE(sample, outputIndex + 2); // Right
                    outputIndex += 4;
                }
            }

            return outputBuffer;
        } catch (error) {
            console.error('Audio upsampling error:', error);
            return Buffer.alloc(0);
        }
    }
}

// Create global instance
const voiceSessionManager = new VoiceSessionManager();

export default voiceSessionManager;

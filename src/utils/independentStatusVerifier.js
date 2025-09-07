/**
 * Independent Status Verifier
 * Multi-layer bot status verification that doesn't depend on bot's self-reporting
 * This solves the circular dependency issue where offline detection failed
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class IndependentStatusVerifier {
    constructor(options = {}) {
        this.options = {
            // Verification method weights (should sum to 1.0)
            processWeight: options.processWeight || 0.4,
            fileWeight: options.fileWeight || 0.3,
            apiWeight: options.apiWeight || 0.3,
            
            // Timeouts for each verification method
            processTimeout: options.processTimeout || 2000,
            fileTimeout: options.fileTimeout || 1000,
            apiTimeout: options.apiTimeout || 5000,
            
            // File paths
            statusFile: options.statusFile || path.join(__dirname, '../../logs/health/status/bot-status.json'),
            
            // Process detection patterns
            botProcessPattern: options.botProcessPattern || 'node.*src/bot.js',
            
            ...options
        };
        
        this.verificationMethods = [
            {
                name: 'process_check',
                method: this.checkBotProcess.bind(this),
                weight: this.options.processWeight,
                timeout: this.options.processTimeout,
                description: 'Direct process detection'
            },
            {
                name: 'file_check', 
                method: this.checkStatusFile.bind(this),
                weight: this.options.fileWeight,
                timeout: this.options.fileTimeout,
                description: 'Status file verification'
            },
            {
                name: 'api_check',
                method: this.checkDiscordAPI.bind(this),
                weight: this.options.apiWeight,
                timeout: this.options.apiTimeout,
                description: 'Discord API verification'
            }
        ];
    }
    
    /**
     * Primary verification method - checks if bot process is running
     * This is independent of the bot's self-reporting and most reliable
     */
    async checkBotProcess() {
        try {
            const result = execSync(`pgrep -f "${this.options.botProcessPattern}"`, {
                encoding: 'utf8',
                timeout: this.options.processTimeout
            }).trim();
            
            const pids = result.split('\n').filter(pid => pid.trim());
            
            return {
                online: pids.length > 0,
                confidence: 0.9, // High confidence - direct process detection
                details: pids.length > 0 ? `Running PIDs: ${pids.join(', ')}` : 'No bot process detected',
                method: 'process_check',
                timestamp: new Date().toISOString(),
                raw: result
            };
        } catch (error) {
            // pgrep returns non-zero exit code when no process found
            const isNotFound = error.status === 1;
            
            return {
                online: false,
                confidence: isNotFound ? 0.9 : 0.5, // High confidence if it's just "not found"
                details: isNotFound ? 'Process not found' : `Process check error: ${error.message}`,
                method: 'process_check',
                timestamp: new Date().toISOString(),
                error: !isNotFound ? error.message : null
            };
        }
    }
    
    /**
     * Secondary verification - checks bot status file
     * Can be stale, so lower confidence when used alone
     */
    async checkStatusFile() {
        try {
            if (!fs.existsSync(this.options.statusFile)) {
                return {
                    online: false,
                    confidence: 0.8, // High confidence that bot is offline if no status file
                    details: 'Status file not found',
                    method: 'file_check',
                    timestamp: new Date().toISOString()
                };
            }
            
            const data = JSON.parse(fs.readFileSync(this.options.statusFile, 'utf8'));
            const lastUpdate = new Date(data.lastUpdated);
            const now = new Date();
            const timeDiff = now - lastUpdate;
            const minutesAgo = Math.round(timeDiff / (1000 * 60));
            
            // Consider file stale if older than 2 minutes
            const isStale = timeDiff > 2 * 60 * 1000;
            const reportedOnline = data.botStatus?.isOnline === true;
            
            // If file is stale, we have low confidence in its reported status
            const confidence = isStale ? 0.2 : 0.7;
            const online = reportedOnline && !isStale;
            
            return {
                online,
                confidence,
                details: isStale 
                    ? `Status file is stale (${minutesAgo} minutes old)` 
                    : `Status current, reports: ${reportedOnline ? 'online' : 'offline'}`,
                method: 'file_check',
                timestamp: new Date().toISOString(),
                fileAge: timeDiff,
                lastFileUpdate: data.lastUpdated
            };
        } catch (error) {
            return {
                online: false,
                confidence: 0.3,
                details: `Status file read error: ${error.message}`,
                method: 'file_check', 
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }
    
    /**
     * Tertiary verification - Discord API check
     * TODO: Implement Discord API presence verification
     */
    async checkDiscordAPI() {
        // For now, return neutral result
        // Future implementation would check Discord API for bot presence
        return {
            online: null,
            confidence: 0.0,
            details: 'Discord API verification not implemented yet',
            method: 'api_check',
            timestamp: new Date().toISOString(),
            implemented: false
        };
    }
    
    /**
     * Run a verification method with timeout
     */
    async runVerificationWithTimeout(verificationMethod) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Verification timeout')), verificationMethod.timeout);
        });
        
        try {
            const result = await Promise.race([
                verificationMethod.method(),
                timeoutPromise
            ]);
            
            return {
                ...result,
                success: true,
                weight: verificationMethod.weight
            };
        } catch (error) {
            return {
                online: false,
                confidence: 0.1,
                details: `Verification failed: ${error.message}`,
                method: verificationMethod.name,
                timestamp: new Date().toISOString(),
                success: false,
                weight: verificationMethod.weight,
                error: error.message
            };
        }
    }
    
    /**
     * Calculate consensus from multiple verification results
     */
    calculateConsensus(results) {
        const successful = results
            .filter(r => r.status === 'fulfilled' && r.value.success)
            .map(r => r.value);
        
        const failed = results
            .filter(r => r.status === 'rejected' || !r.value.success)
            .map(r => r.reason || r.value);
        
        if (successful.length === 0) {
            return {
                online: false,
                confidence: 0.1,
                consensus: 'no_successful_verifications',
                details: 'All verification methods failed',
                results: { successful: [], failed },
                timestamp: new Date().toISOString()
            };
        }
        
        // Calculate weighted average for online status
        let totalWeight = 0;
        let weightedOnlineScore = 0;
        let totalConfidence = 0;
        
        for (const result of successful) {
            if (result.online !== null) { // Skip null results (not implemented methods)
                const weight = result.weight * result.confidence;
                totalWeight += weight;
                weightedOnlineScore += (result.online ? 1 : 0) * weight;
                totalConfidence += result.confidence * result.weight;
            }
        }
        
        if (totalWeight === 0) {
            return {
                online: false,
                confidence: 0.1,
                consensus: 'no_decisive_results',
                details: 'No verification methods provided decisive results',
                results: { successful, failed },
                timestamp: new Date().toISOString()
            };
        }
        
        const onlineScore = weightedOnlineScore / totalWeight;
        const avgConfidence = totalConfidence / totalWeight;
        const isOnline = onlineScore > 0.5; // Majority weighted vote
        
        // Determine consensus type
        let consensus;
        if (onlineScore > 0.8) consensus = 'strongly_online';
        else if (onlineScore > 0.6) consensus = 'likely_online';
        else if (onlineScore > 0.4) consensus = 'uncertain';
        else if (onlineScore > 0.2) consensus = 'likely_offline';
        else consensus = 'strongly_offline';
        
        return {
            online: isOnline,
            confidence: avgConfidence,
            consensus,
            onlineScore,
            details: `Consensus: ${consensus} (score: ${onlineScore.toFixed(3)})`,
            results: { successful, failed },
            timestamp: new Date().toISOString(),
            verification: {
                totalMethods: this.verificationMethods.length,
                successfulMethods: successful.length,
                failedMethods: failed.length
            }
        };
    }
    
    /**
     * Main verification method - runs all verifications and returns consensus
     */
    async verifyBotStatus() {
        try {
            const verificationPromises = this.verificationMethods.map(method => 
                this.runVerificationWithTimeout(method)
            );
            
            const results = await Promise.allSettled(verificationPromises);
            const consensus = this.calculateConsensus(results);
            
            return consensus;
        } catch (error) {
            return {
                online: false,
                confidence: 0.1,
                consensus: 'verification_error',
                details: `Verification system error: ${error.message}`,
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }
    
    /**
     * Quick verification using only fast methods
     */
    async quickVerify() {
        const fastMethods = this.verificationMethods.filter(m => m.timeout <= 2000);
        
        const promises = fastMethods.map(method => 
            this.runVerificationWithTimeout(method)
        );
        
        const results = await Promise.allSettled(promises);
        return this.calculateConsensus(results);
    }
    
    /**
     * Get verification status for debugging
     */
    getVerificationInfo() {
        return {
            methods: this.verificationMethods.map(m => ({
                name: m.name,
                description: m.description,
                weight: m.weight,
                timeout: m.timeout
            })),
            options: this.options,
            version: '1.0.0'
        };
    }
}
// statusChecker.js - Standalone utility to check bot status from files
import fs from 'fs';
import path from 'path';

// Import the new independent verification system
let IndependentStatusVerifier;
try {
    const module = await import('./independentStatusVerifier.js');
    IndependentStatusVerifier = module.IndependentStatusVerifier;
} catch (error) {
    console.warn('IndependentStatusVerifier not available, using legacy status checking only');
    IndependentStatusVerifier = null;
}

// Feature flags - can be controlled via environment variables
const ENABLE_INDEPENDENT_VERIFICATION = process.env.ENABLE_INDEPENDENT_VERIFICATION !== 'false';
const ENABLE_ENHANCED_REPORTING = process.env.ENABLE_ENHANCED_REPORTING !== 'false';

/**
 * Get detailed shutdown reason from logs
 * @returns {string} Human-readable reason for shutdown
 */
function getShutdownReason() {
    try {
        // Check for recent error logs
        const today = new Date().toISOString().split('T')[0];
        const errorFile = path.join(process.cwd(), 'logs', `critical-errors-${today}.json`);
        const monitorLog = path.join(process.cwd(), 'logs', 'monitorOutput.log');
        const offlineLog = path.join(process.cwd(), 'logs', 'offlineOutput.log');
        
        let reason = 'Unknown';
        let category = 'unknown'; // planned, error, manual, system
        
        // Check critical errors first
        if (fs.existsSync(errorFile)) {
            try {
                const errorData = fs.readFileSync(errorFile, 'utf8').trim();
                if (errorData) {
                    const lines = errorData.split('\n').filter(line => line.trim());
                    if (lines.length > 0) {
                        const lastError = JSON.parse(lines[lines.length - 1]);
                        const errorTime = new Date(lastError.timestamp);
                        const timeDiff = Date.now() - errorTime.getTime();
                        
                        // If error is within last 15 minutes, it's likely the cause
                        if (timeDiff < 15 * 60 * 1000) {
                            category = 'error';
                            const errorMsg = lastError.message || lastError.error || '';
                            const stackTrace = lastError.stack || '';
                            const fullError = errorMsg + ' ' + stackTrace;
                            
                            if (fullError.includes('ENOTFOUND') || fullError.includes('ECONNREFUSED') || fullError.includes('DNS')) {
                                reason = 'Network connectivity issues';
                            } else if (fullError.includes('TOKEN') || fullError.includes('Unauthorized') || fullError.includes('401')) {
                                reason = 'Discord authentication failure';
                            } else if (fullError.includes('Memory') || fullError.includes('heap') || fullError.includes('OOM')) {
                                reason = 'Out of memory';
                            } else if (fullError.includes('SIGTERM') || fullError.includes('SIGKILL')) {
                                reason = 'Process terminated by system';
                            } else if (fullError.includes('TEST:') || fullError.includes('test-errors')) {
                                reason = 'Testing/debugging command';
                                category = 'manual';
                            } else if (fullError.includes('RATE_LIMIT') || fullError.includes('429')) {
                                reason = 'Discord rate limiting';
                            } else if (fullError.includes('WebSocket') || fullError.includes('Gateway')) {
                                reason = 'Discord gateway connection issue';
                            } else {
                                // Extract a more readable error message
                                const errorText = errorMsg.substring(0, 80);
                                reason = `Application error: ${errorText}${errorText.length >= 80 ? '...' : ''}`;
                            }
                        }
                    }
                }
            } catch (parseError) {
                // Continue to other checks
            }
        }
        
        // Check monitor and offline logs for shutdown patterns
        const logFiles = [monitorLog, offlineLog].filter(fs.existsSync);
        
        if (reason === 'Unknown' && logFiles.length > 0) {
            for (const logFile of logFiles) {
                try {
                    const logContent = fs.readFileSync(logFile, 'utf8');
                    const lines = logContent.split('\n').slice(-200); // Last 200 lines for better coverage
                    
                    // Look for recent patterns, prioritizing the most recent entries
                    for (const line of lines.reverse()) {
                        const lowerLine = line.toLowerCase();
                        
                        // Manual shutdown patterns (highest priority)
                        if (lowerLine.includes('manual shutdown') || lowerLine.includes('manual stop')) {
                            reason = 'Manually stopped for testing/maintenance';
                            category = 'manual';
                            break;
                        } else if (lowerLine.includes('npm run stop') || lowerLine.includes('./stop-bot-only.sh') || 
                            lowerLine.includes('stop-bepo.sh')) {
                            reason = 'Manually stopped via script';
                            category = 'manual';
                            break;
                        } else if (lowerLine.includes('ctrl+c') || lowerLine.includes('^c') || lowerLine.includes('sigint')) {
                            reason = 'Manually interrupted (Ctrl+C)';
                            category = 'manual';
                            break;
                        }
                        
                        // Skip very old entries (older than 1 hour) for automatic patterns
                        const hasTimestamp = line.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/);
                        if (hasTimestamp) {
                            const logTime = new Date(hasTimestamp[1]);
                            const timeDiff = Date.now() - logTime.getTime();
                            if (timeDiff > 60 * 60 * 1000) continue; // Skip entries older than 1 hour
                        }
                        
                        // Recent automated patterns
                        if (lowerLine.includes('npm run start') || lowerLine.includes('starting')) {
                            reason = 'Restarting after previous shutdown';
                            category = 'planned';
                            break;
                        }
                        
                        // System-level shutdowns
                        else if (lowerLine.includes('sigterm') || lowerLine.includes('killed')) {
                            reason = 'System terminated process';
                            category = 'system';
                            break;
                        } else if (lowerLine.includes('deploy') || lowerLine.includes('deployment')) {
                            reason = 'Deployment update';
                            category = 'planned';
                            break;
                        }
                        
                        // Error patterns
                        else if (lowerLine.includes('discord') && lowerLine.includes('error')) {
                            reason = 'Discord connection error';
                            category = 'error';
                            break;
                        } else if (lowerLine.includes('memory') && lowerLine.includes('error')) {
                            reason = 'Memory-related error';
                            category = 'error';
                            break;
                        } else if (lowerLine.includes('uncaught exception')) {
                            reason = 'Uncaught application error';
                            category = 'error';
                            break;
                        }
                    }
                    
                    if (reason !== 'Unknown') break;
                } catch (logError) {
                    // Continue checking other files
                }
            }
        }
        
        // If still unknown, provide a better default based on bot status patterns
        if (reason === 'Unknown') {
            const statusFile = path.join(process.cwd(), 'logs', 'bot-status.json');
            if (fs.existsSync(statusFile)) {
                try {
                    const statusData = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
                    const lastUpdate = new Date(statusData.lastUpdated);
                    const timeDiff = Date.now() - lastUpdate.getTime();
                    
                    if (timeDiff > 5 * 60 * 1000) { // 5 minutes
                        reason = 'Process appears to have stopped unexpectedly';
                        category = 'error';
                    } else {
                        reason = 'Recent shutdown (reason not logged)';
                        category = 'unknown';
                    }
                } catch (statusError) {
                    reason = 'Unable to determine shutdown reason';
                }
            } else {
                reason = 'No status information available';
            }
        }
        
        return { reason, category };
    } catch (error) {
        return { reason: 'Unable to determine', category: 'unknown' };
    }
}

/**
 * Check if the bot is currently online based on status file
 * @returns {Object} Status information
 */
export function checkBotStatus() {
    try {
        const statusFile = path.join(process.cwd(), 'logs', 'bot-status.json');
        
        if (!fs.existsSync(statusFile)) {
            return {
                online: false,
                reason: 'Status file not found',
                shutdownReason: 'Bot never started',
                lastSeen: null,
                data: null
            };
        }

        const data = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
        const lastUpdate = new Date(data.lastUpdated);
        const now = new Date();
        const timeDiff = now - lastUpdate;
        
        // Consider offline if no update in last 2 minutes
        const isOnline = timeDiff < 2 * 60 * 1000 && data.botStatus.isOnline;
        
        let reason = 'Online';
        let shutdownReason = null;
        
        if (!isOnline) {
            if (timeDiff >= 2 * 60 * 1000) {
                reason = 'Status updates stopped';
                const shutdownInfo = getShutdownReason();
                shutdownReason = shutdownInfo.reason;
            } else {
                reason = 'Bot marked offline';
                const shutdownInfo = getShutdownReason();
                shutdownReason = shutdownInfo.reason;
            }
        }
        
        return {
            online: isOnline,
            reason,
            shutdownReason,
            lastSeen: data.botStatus.lastSeen,
            data,
            timeSinceUpdate: Math.floor(timeDiff / 1000) // seconds
        };
    } catch (error) {
        return {
            online: false,
            reason: `Error reading status: ${error.message}`,
            shutdownReason: 'Status check failed',
            lastSeen: null,
            data: null
        };
    }
}

/**
 * Get health status from log files
 * @returns {Object} Health status information
 */
export function getHealthFromLogs() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const healthFile = path.join(process.cwd(), 'logs', `health-${today}.json`);
        
        if (!fs.existsSync(healthFile)) {
            return {
                healthy: null,
                reason: 'No health log for today',
                lastCheck: null
            };
        }

        const lines = fs.readFileSync(healthFile, 'utf8').trim().split('\n');
        const lastEntry = JSON.parse(lines[lines.length - 1]);
        
        return {
            healthy: lastEntry.healthy,
            errorCount: lastEntry.errorCount,
            criticalErrorCount: lastEntry.criticalErrorCount,
            lastCheck: lastEntry.timestamp,
            memoryUsage: lastEntry.memoryUsage
        };
    } catch (error) {
        return {
            healthy: null,
            reason: `Error reading health logs: ${error.message}`,
            lastCheck: null
        };
    }
}

/**
 * Get a comprehensive status report with enhanced verification
 * @returns {Object} Complete status report
 */
export async function getStatusReport() {
    const botStatus = checkBotStatus();
    const healthStatus = getHealthFromLogs();
    
    // Base report using legacy methods
    const baseReport = {
        timestamp: new Date().toISOString(),
        bot: botStatus,
        health: healthStatus,
        summary: {
            operational: botStatus.online && (healthStatus.healthy !== false),
            status: botStatus.online ? 
                (healthStatus.healthy === false ? 'DEGRADED' : 'OPERATIONAL') : 
                'OFFLINE',
            uptime: botStatus.data?.botStatus?.uptime || 0
        }
    };
    
    // Enhanced verification if available and enabled
    if (ENABLE_INDEPENDENT_VERIFICATION && IndependentStatusVerifier) {
        try {
            const verifier = new IndependentStatusVerifier({
                // Use updated log paths from log organization
                statusFile: path.join(process.cwd(), 'logs', 'health', 'status', 'bot-status.json')
            });
            
            const verification = await verifier.verifyBotStatus();
            
            // Add verification results to the report
            baseReport.verification = {
                enabled: true,
                consensus: verification.consensus,
                confidence: verification.confidence,
                onlineScore: verification.onlineScore,
                details: verification.results?.successful || [],
                methods: verification.results?.successful?.reduce((acc, method) => {
                    acc[method.method] = {
                        online: method.online,
                        confidence: method.confidence,
                        weight: method.weight,
                        details: method.details
                    };
                    return acc;
                }, {}) || {},
                summary: verification.details,
                verification: verification.verification,
                timestamp: verification.timestamp
            };
            
            // Override summary status if verification disagrees with high confidence
            if (verification.confidence > 0.7 && verification.online !== baseReport.summary.operational) {
                console.warn(`Status verification disagreement detected: Legacy=${baseReport.summary.operational}, Verification=${verification.online} (confidence: ${verification.confidence})`);
                
                baseReport.summary.operational = verification.online;
                baseReport.summary.status = verification.online ? 'OPERATIONAL' : 'OFFLINE';
                baseReport.summary.verificationOverride = true;
                baseReport.summary.overrideReason = `High-confidence verification (${verification.confidence}) disagreed with legacy status`;
            }
            
        } catch (error) {
            console.warn('Enhanced verification failed:', error.message);
            baseReport.verification = {
                enabled: true,
                error: error.message,
                fallback: true
            };
        }
    } else {
        baseReport.verification = {
            enabled: false,
            reason: !ENABLE_INDEPENDENT_VERIFICATION ? 'Disabled by configuration' : 'IndependentStatusVerifier not available'
        };
    }
    
    return baseReport;
}

/**
 * Get a quick status check using enhanced verification
 * @returns {Object} Quick status result
 */
export async function getQuickStatus() {
    if (ENABLE_INDEPENDENT_VERIFICATION && IndependentStatusVerifier) {
        try {
            const verifier = new IndependentStatusVerifier({
                statusFile: path.join(process.cwd(), 'logs', 'health', 'status', 'bot-status.json')
            });
            
            const result = await verifier.quickVerify();
            return {
                online: result.online,
                confidence: result.confidence,
                consensus: result.consensus,
                enhanced: true,
                timestamp: result.timestamp
            };
        } catch (error) {
            console.warn('Quick verification failed, falling back to legacy:', error.message);
        }
    }
    
    // Fallback to legacy method
    const legacyStatus = checkBotStatus();
    return {
        online: legacyStatus.online,
        confidence: 0.6, // Medium confidence for legacy method
        consensus: legacyStatus.online ? 'legacy_online' : 'legacy_offline',
        enhanced: false,
        timestamp: new Date().toISOString(),
        fallback: true
    };
}

/**
 * Update bot status in the status file
 * @param {Object} statusUpdate - Status update object
 */
export function updateBotStatus(statusUpdate) {
    try {
        const statusFile = path.join(process.cwd(), 'logs', 'bot-status.json');
        
        // Create logs directory if it doesn't exist
        const logDir = path.dirname(statusFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        // Read existing status or create new one
        let currentStatus = {};
        if (fs.existsSync(statusFile)) {
            try {
                currentStatus = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
            } catch (error) {
                console.warn('Could not read existing status file, creating new one');
                currentStatus = {};
            }
        }
        
        // Update the bot status section
        if (!currentStatus.botStatus) {
            currentStatus.botStatus = {};
        }
        
        // Merge the status update
        Object.assign(currentStatus.botStatus, statusUpdate);
        
        // Update timestamp
        currentStatus.lastUpdated = new Date().toISOString();
        
        // Write the updated status
        fs.writeFileSync(statusFile, JSON.stringify(currentStatus, null, 2));
        
        return true;
    } catch (error) {
        console.error('Failed to update bot status:', error);
        return false;
    }
}

// Export default as the main status checker
export default {
    checkBotStatus,
    getHealthFromLogs,
    getStatusReport,
    updateBotStatus
};

// Export a factory function for consistency with other modules
export function getStatusChecker() {
    // Enhanced status checker with independent verification capabilities
    const enhancedChecker = {
        // Legacy compatibility methods (maintain exact existing API)
        getBotStatus: getStatusReport,
        checkOnline: checkBotStatus,
        getHealth: getHealthFromLogs,
        updateBotStatus: updateBotStatus,
        
        // Direct function access (backward compatibility)
        checkBotStatus,
        getHealthFromLogs,
        getStatusReport,
        updateBotStatus,
        
        // Enhanced methods
        getQuickStatus,
        
        // Configuration information
        config: {
            independentVerification: ENABLE_INDEPENDENT_VERIFICATION,
            enhancedReporting: ENABLE_ENHANCED_REPORTING,
            hasIndependentVerifier: !!IndependentStatusVerifier
        },
        
        // New method: Get independent verification instance
        createIndependentVerifier(options = {}) {
            if (!IndependentStatusVerifier) {
                throw new Error('IndependentStatusVerifier not available');
            }
            
            const defaultOptions = {
                statusFile: path.join(process.cwd(), 'logs', 'health', 'status', 'bot-status.json'),
                maxFileAge: 5 * 60 * 1000, // 5 minutes
                timeout: 10000 // 10 seconds
            };
            
            return new IndependentStatusVerifier({ ...defaultOptions, ...options });
        },
        
        // Enhanced monitoring integration point
        async performEnhancedCheck() {
            if (ENABLE_INDEPENDENT_VERIFICATION && IndependentStatusVerifier) {
                try {
                    const verifier = this.createIndependentVerifier();
                    return await verifier.verifyBotStatus();
                } catch (error) {
                    console.warn('Enhanced check failed:', error.message);
                    return {
                        online: false,
                        confidence: 0.1,
                        consensus: 'error',
                        error: error.message,
                        fallback: true,
                        timestamp: new Date().toISOString()
                    };
                }
            }
            
            // Fallback to legacy check
            const legacyStatus = checkBotStatus();
            return {
                online: legacyStatus.online,
                confidence: 0.6,
                consensus: legacyStatus.online ? 'legacy_online' : 'legacy_offline',
                enhanced: false,
                fallback: true,
                timestamp: new Date().toISOString()
            };
        }
    };
    
    return enhancedChecker;
}

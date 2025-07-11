// errorHandler.js - Comprehensive error handling and resilience utilities
import fs from 'fs';
import path from 'path';

class ErrorHandler {
    constructor() {
        this.errorCounts = new Map();
        this.maxErrorsPerHour = 50;
        this.criticalErrors = [];
        this.errors = []; // General error log for tracking
        this.setupGlobalHandlers();
    }

    setupGlobalHandlers() {
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.logCriticalError('UNCAUGHT_EXCEPTION', error);
            console.error(' CRITICAL: Uncaught Exception detected!', error);
            
            // Try to gracefully shutdown instead of crashing
            this.attemptGracefulShutdown(error);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            this.logCriticalError('UNHANDLED_REJECTION', reason);
            console.error(' CRITICAL: Unhandled Promise Rejection detected!', reason);
            console.error('Promise:', promise);
            
            // Log but don't crash - many promise rejections are recoverable
            this.trackError('unhandled_rejection');
        });

        // Handle process warnings
        process.on('warning', (warning) => {
            console.warn(' Process Warning:', warning.name, warning.message);
            if (warning.stack) {
                console.warn('Stack:', warning.stack);
            }
        });

        // Handle SIGTERM for graceful shutdown
        process.on('SIGTERM', () => {
            console.log(' SIGTERM received, attempting graceful shutdown...');
            this.attemptGracefulShutdown(new Error('SIGTERM received'));
        });

        // Handle SIGINT (Ctrl+C)
        process.on('SIGINT', () => {
            console.log(' SIGINT received, attempting graceful shutdown...');
            this.attemptGracefulShutdown(new Error('SIGINT received'));
        });
    }

    attemptGracefulShutdown(error) {
        console.log(' Attempting graceful shutdown...');
        
        // Give the process 10 seconds to cleanup gracefully
        const shutdownTimer = setTimeout(() => {
            console.error('Graceful shutdown timed out, forcing exit');
            process.exit(1);
        }, 10000);

        try {
            // Emit shutdown event for cleanup
            process.emit('SHUTDOWN', error);
            
            // Clear the timer if we get here
            clearTimeout(shutdownTimer);
            
            // Exit with error code
            process.exit(1);
        } catch (shutdownError) {
            console.error('Error during graceful shutdown:', shutdownError);
            process.exit(1);
        }
    }

    logCriticalError(type, error) {
        const errorInfo = {
            type,
            message: error.message || String(error),
            stack: error.stack || 'No stack available',
            timestamp: new Date().toISOString(),
            process: {
                pid: process.pid,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                platform: process.platform,
                nodeVersion: process.version
            }
        };

        this.criticalErrors.push(errorInfo);
        
        // Keep only last 100 critical errors
        if (this.criticalErrors.length > 100) {
            this.criticalErrors.shift();
        }

        // Write to error log file
        this.writeErrorLog(errorInfo);
    }

    writeErrorLog(errorInfo) {
        try {
            const logDir = path.join(process.cwd(), 'logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            const logFile = path.join(logDir, `critical-errors-${new Date().toISOString().split('T')[0]}.json`);
            const logEntry = JSON.stringify(errorInfo, null, 2) + '\n';
            
            fs.appendFileSync(logFile, logEntry);
        } catch (logError) {
            console.error('Failed to write error log:', logError);
        }
    }

    trackError(errorType) {
        const now = Date.now();
        const hourKey = Math.floor(now / (1000 * 60 * 60));
        const key = `${errorType}_${hourKey}`;
        
        const count = this.errorCounts.get(key) || 0;
        this.errorCounts.set(key, count + 1);
        
        // Clean up old error counts (older than 2 hours)
        for (const [countKey] of this.errorCounts) {
            const [, hour] = countKey.split('_');
            if (parseInt(hour) < hourKey - 2) {
                this.errorCounts.delete(countKey);
            }
        }
        
        // Check if we're hitting error limits
        if (count >= this.maxErrorsPerHour) {
            console.warn(`High error rate detected for ${errorType}: ${count} errors this hour`);
            return true; // Indicates high error rate
        }
        
        return false;
    }

    // General error logging for tests and tracking
    logError(error, context = 'unknown') {
        const errorInfo = {
            error: error.message || String(error),
            context,
            timestamp: new Date().toISOString(),
            stack: error.stack || 'No stack available'
        };

        this.errors.push(errorInfo);
        this.trackError(context);

        // Keep only last 1000 errors
        if (this.errors.length > 1000) {
            this.errors.shift();
        }

        // Auto cleanup old errors
        this.cleanupOldErrors();
    }

    // Clean up old errors (older than 1 hour)
    cleanupOldErrors() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        this.errors = this.errors.filter(error => error.timestamp > oneHourAgo);
    }

    // Safe wrapper for async operations
    async safeAsync(operation, fallback = null, context = 'unknown', maxRetries = 1) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                console.error(` Safe async operation failed in ${context}:`, error);
                this.logError(error, context);
                
                if (attempt === maxRetries) {
                    // Last attempt failed
                    if (typeof fallback === 'function') {
                        try {
                            return await fallback(error);
                        } catch (fallbackError) {
                            console.error(` Fallback operation also failed in ${context}:`, fallbackError);
                            return null;
                        }
                    }
                    return fallback;
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    // Safe wrapper for sync operations
    safeSync(operation, fallback = null, context = 'unknown') {
        try {
            return operation();
        } catch (error) {
            console.error(`Safe sync operation failed in ${context}:`, error);
            this.logError(error, context);
            
            if (typeof fallback === 'function') {
                try {
                    return fallback(error);
                } catch (fallbackError) {
                    console.error(`Fallback operation also failed in ${context}:`, fallbackError);
                    return null;
                }
            }
            
            return fallback;
        }
    }

    // Health check utilities
    getHealthStatus() {
        const now = Date.now();
        const hourKey = Math.floor(now / (1000 * 60 * 60));
        
        let totalErrors = 0;
        for (const [key, count] of this.errorCounts) {
            const [, hour] = key.split('_');
            if (parseInt(hour) >= hourKey - 1) { // Last hour
                totalErrors += count;
            }
        }

        const memoryUsage = process.memoryUsage();
        
        return {
            healthy: totalErrors < this.maxErrorsPerHour && this.criticalErrors.length === 0,
            errorCount: totalErrors,
            criticalErrorCount: this.criticalErrors.length,
            lastCriticalError: this.criticalErrors[this.criticalErrors.length - 1] || null,
            lastHealthCheck: Date.now(),
            uptime: process.uptime() * 1000, // Convert to milliseconds for consistency
            memoryUsage: {
                used: memoryUsage.heapUsed,
                total: memoryUsage.heapTotal
            }
        };
    }

    // Discord-specific error handling
    handleDiscordError(error, interaction = null, context = 'discord') {
        const errorMessage = error.message || String(error);
        const errorCode = error.code || 'UNKNOWN';
        
        console.error(` Discord error in ${context}:`, {
            code: errorCode,
            message: errorMessage,
            stack: error.stack
        });

        this.logError(error, `discord_${context}`);

        // Handle specific Discord error types
        if (errorCode === 10062) { // Unknown interaction
            console.warn('Interaction expired or already acknowledged');
            return false; // Don't retry
        }
        
        if (errorCode === 50013) { // Missing permissions
            console.warn('Bot missing required permissions');
            if (interaction && !interaction.replied && !interaction.deferred) {
                this.safeAsync(async () => {
                    await interaction.reply({
                        content: '❌ I don\'t have the required permissions to perform this action.',
                        flags: 64 // MessageFlags.Ephemeral
                    });
                }, null, 'discord_permission_error');
            }
            return false; // Don't retry permission errors
        }

        if (errorCode === 50035) { // Invalid form body
            console.warn(' Invalid form body sent to Discord');
            return false; // Don't retry form validation errors
        }

        if (errorCode === 429) { // Rate limited
            console.warn(' Discord rate limit hit');
            return true; // Can retry after rate limit
        }

        return true; // Default to retryable
    }

    // Database error handling
    handleDatabaseError(error, operation = 'unknown') {
        console.error(` Database error during ${operation}:`, error);
        this.trackError(`database_${operation}`);

        // Common Supabase error patterns
        if (error.message?.includes('JWT')) {
            console.error(' Database authentication error - check Supabase credentials');
            return false; // Auth errors usually aren't retryable
        }

        if (error.message?.includes('timeout')) {
            console.warn('Database operation timed out');
            return true; // Timeouts can be retried
        }

        if (error.message?.includes('connection')) {
            console.warn('🔌 Database connection error');
            return true; // Connection errors can be retried
        }

        return false; // Default to non-retryable for safety
    }

    // Voice connection error handling
    handleVoiceError(error, guildId, context = 'voice') {
        console.error(`🎵 Voice error in guild ${guildId} during ${context}:`, error);
        this.trackError(`voice_${context}`);

        // Handle specific voice errors
        if (error.message?.includes('VOICE_CONNECTION_TIMEOUT')) {
            console.warn('Voice connection timed out');
            return 'reconnect';
        }

        if (error.message?.includes('VOICE_TOKEN_INVALID')) {
            console.warn(' Voice token invalid');
            return 'reconnect';
        }

        if (error.message?.includes('VOICE_CHANNEL_DELETED')) {
            console.warn(' Voice channel was deleted');
            return 'cleanup';
        }

        return 'retry';
    }

    // AI service error handling
    handleAIError(error, service = 'unknown') {
        console.error(` AI service error with ${service}:`, error);
        this.trackError(`ai_${service}`);

        // OpenAI specific errors
        if (error.code === 'rate_limit_exceeded') {
            console.warn(' AI rate limit exceeded');
            return { retry: true, delay: 60000 }; // Retry after 1 minute
        }

        if (error.code === 'invalid_api_key') {
            console.error(' Invalid AI API key');
            return { retry: false, fallback: true };
        }

        if (error.code === 'model_overloaded') {
            console.warn(' AI model overloaded');
            return { retry: true, delay: 30000 }; // Retry after 30 seconds
        }

        if (error.message?.includes('timeout')) {
            console.warn(' AI request timed out');
            return { retry: true, delay: 5000 }; // Retry after 5 seconds
        }

        return { retry: false, fallback: false };
    }

    // Create retry wrapper with exponential backoff
    createRetryWrapper(maxRetries = 3, baseDelay = 1000) {
        return async (operation, context = 'operation') => {
            let lastError;
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    return await operation();
                } catch (error) {
                    lastError = error;
                    console.warn(` Attempt ${attempt}/${maxRetries} failed for ${context}:`, error.message);
                    
                    if (attempt === maxRetries) {
                        break; // Don't delay on final attempt
                    }
                    
                    // Exponential backoff with jitter
                    const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
            
            console.error(` All retry attempts failed for ${context}:`, lastError);
            throw lastError;
        };
    }
}

// Export singleton instance
const errorHandler = new ErrorHandler();
export default errorHandler;

// Export utility functions for easy import
export const safeAsync = errorHandler.safeAsync.bind(errorHandler);
export const safeSync = errorHandler.safeSync.bind(errorHandler);
export const handleDiscordError = errorHandler.handleDiscordError.bind(errorHandler);
export const handleDatabaseError = errorHandler.handleDatabaseError.bind(errorHandler);
export const handleVoiceError = errorHandler.handleVoiceError.bind(errorHandler);
export const handleAIError = errorHandler.handleAIError.bind(errorHandler);
export const createRetryWrapper = errorHandler.createRetryWrapper.bind(errorHandler);

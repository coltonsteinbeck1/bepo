/**
 * Centralized Logging Utility
 * Provides structured logging with levels, timestamps, and log rotation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log levels with priority
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4
};

// Color codes for console output
const Colors = {
  DEBUG: '\x1b[36m',    // Cyan
  INFO: '\x1b[32m',     // Green
  WARN: '\x1b[33m',     // Yellow
  ERROR: '\x1b[31m',    // Red
  CRITICAL: '\x1b[35m', // Magenta
  RESET: '\x1b[0m'
};

class Logger {
  constructor(options = {}) {
    this.minLevel = LogLevel[process.env.LOG_LEVEL?.toUpperCase()] ?? LogLevel.INFO;
    this.logsDir = options.logsDir || path.join(process.cwd(), 'logs');
    this.serviceName = options.serviceName || 'bepo';
    this.enableConsole = options.enableConsole ?? true;
    this.enableFile = options.enableFile ?? true;
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 7; // Keep 7 days of logs
    
    // Ensure logs directory exists
    if (this.enableFile && !fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
    
    // Initialize log streams
    this.logStreams = new Map();
    this.lastRotationCheck = Date.now();
  }

  /**
   * Get log file path for a specific level
   */
  getLogPath(level) {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logsDir, `${this.serviceName}-${level.toLowerCase()}-${date}.log`);
  }

  /**
   * Format log entry
   */
  formatLog(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const levelStr = Object.keys(LogLevel).find(key => LogLevel[key] === level);
    
    const logEntry = {
      timestamp,
      level: levelStr,
      service: this.serviceName,
      message,
      ...(data && { data })
    };

    return JSON.stringify(logEntry);
  }

  /**
   * Format console output with colors
   */
  formatConsole(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const levelStr = Object.keys(LogLevel).find(key => LogLevel[key] === level);
    const color = Colors[levelStr] || Colors.RESET;
    
    let output = `${color}[${timestamp}] [${levelStr}] ${message}${Colors.RESET}`;
    
    if (data) {
      output += `\n${color}${JSON.stringify(data, null, 2)}${Colors.RESET}`;
    }
    
    return output;
  }

  /**
   * Write to log file with rotation
   */
  async writeToFile(level, formattedLog) {
    if (!this.enableFile) return;

    try {
      const logPath = this.getLogPath(Object.keys(LogLevel).find(key => LogLevel[key] === level));
      
      // Check file size and rotate if needed
      if (fs.existsSync(logPath)) {
        const stats = fs.statSync(logPath);
        if (stats.size > this.maxFileSize) {
          await this.rotateLog(logPath);
        }
      }

      // Append to log file
      fs.appendFileSync(logPath, formattedLog + '\n', 'utf8');
      
      // Check for old logs cleanup (once per hour)
      if (Date.now() - this.lastRotationCheck > 3600000) {
        this.cleanupOldLogs();
        this.lastRotationCheck = Date.now();
      }
    } catch (error) {
      // Fallback to console if file write fails
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Rotate log file when it exceeds size limit
   */
  async rotateLog(logPath) {
    try {
      const timestamp = Date.now();
      const rotatedPath = `${logPath}.${timestamp}`;
      fs.renameSync(logPath, rotatedPath);
    } catch (error) {
      console.error('Failed to rotate log:', error.message);
    }
  }

  /**
   * Cleanup old log files
   */
  cleanupOldLogs() {
    try {
      const files = fs.readdirSync(this.logsDir);
      const now = Date.now();
      const maxAge = this.maxFiles * 24 * 60 * 60 * 1000; // Convert days to ms

      files.forEach(file => {
        const filePath = path.join(this.logsDir, file);
        const stats = fs.statSync(filePath);
        
        // Delete files older than maxFiles days
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          this.debug(`Cleaned up old log file: ${file}`);
        }
      });
    } catch (error) {
      console.error('Failed to cleanup old logs:', error.message);
    }
  }

  /**
   * Core logging method
   */
  log(level, message, data = null) {
    if (level < this.minLevel) return;

    const formattedLog = this.formatLog(level, message, data);
    
    // Console output
    if (this.enableConsole) {
      const consoleOutput = this.formatConsole(level, message, data);
      
      if (level >= LogLevel.ERROR) {
        console.error(consoleOutput);
      } else if (level >= LogLevel.WARN) {
        console.warn(consoleOutput);
      } else {
        console.log(consoleOutput);
      }
    }

    // File output
    this.writeToFile(level, formattedLog);
  }

  // Convenience methods
  debug(message, data) {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message, data) {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message, data) {
    this.log(LogLevel.WARN, message, data);
  }

  error(message, data) {
    this.log(LogLevel.ERROR, message, data);
  }

  critical(message, data) {
    this.log(LogLevel.CRITICAL, message, data);
  }

  /**
   * Performance timing helper
   */
  startTimer(label) {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.debug(`[PERF] ${label}: ${duration}ms`);
      return duration;
    };
  }

  /**
   * Wrap async function with error logging
   */
  wrapAsync(fn, context = '') {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.error(`Error in ${context}`, {
          error: error.message,
          stack: error.stack,
          args: args.length
        });
        throw error;
      }
    };
  }
}

// Create default logger instance
const logger = new Logger({
  serviceName: 'bepo-bot'
});

// Create specialized loggers for different services
export const botLogger = logger;

export const monitorLogger = new Logger({
  serviceName: 'bepo-monitor',
  enableConsole: process.env.NODE_ENV !== 'production'
});

export const offlineLogger = new Logger({
  serviceName: 'bepo-offline',
  enableConsole: process.env.NODE_ENV !== 'production'
});

export default logger;

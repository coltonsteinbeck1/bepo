#!/usr/bin/env node
/**
 * Health Dashboard - Real-time bot health monitoring
 * Provides a comprehensive view of all services and their status
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(process.cwd(), 'logs');
const STATUS_FILE = path.join(LOGS_DIR, 'bot-status.json');
const MONITOR_STATUS = path.join(LOGS_DIR, 'bot-status-monitor.json');

// Color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

function print(message, color = 'reset') {
  process.stdout.write(`${colors[color]}${message}${colors.reset}`);
}

function println(message, color = 'reset') {
  print(message + '\n', color);
}

/**
 * Clear screen and move cursor to top
 */
function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

/**
 * Get process status
 */
async function getProcessStatus(processName) {
  try {
    const { stdout } = await execAsync(`pgrep -f '${processName}'`);
    const pids = stdout.trim().split('\n').filter(Boolean);
    return {
      running: pids.length > 0,
      pids: pids,
      count: pids.length
    };
  } catch {
    return { running: false, pids: [], count: 0 };
  }
}

/**
 * Get log file info
 */
function getLogInfo(filename) {
  const logPath = path.join(LOGS_DIR, filename);
  
  if (!fs.existsSync(logPath)) {
    return { exists: false, size: 0, modified: null, lastLine: null };
  }

  const stats = fs.statSync(logPath);
  let lastLine = null;
  
  try {
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.trim().split('\n');
    lastLine = lines[lines.length - 1];
  } catch {}

  return {
    exists: true,
    size: stats.size,
    modified: stats.mtime,
    lastLine
  };
}

/**
 * Get recent errors from log
 */
function getRecentErrors(filename, minutes = 5) {
  const logPath = path.join(LOGS_DIR, filename);
  
  if (!fs.existsSync(logPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.trim().split('\n');
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const errors = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        const timestamp = new Date(parsed.timestamp).getTime();
        
        if (timestamp > cutoff && (parsed.level === 'ERROR' || parsed.level === 'CRITICAL')) {
          errors.push({
            timestamp: parsed.timestamp,
            message: parsed.message,
            level: parsed.level
          });
        }
      } catch {
        // Check for plain text errors
        if (line.toLowerCase().includes('error') || line.toLowerCase().includes('critical')) {
          errors.push({
            timestamp: new Date().toISOString(),
            message: line.substring(0, 100),
            level: 'ERROR'
          });
        }
      }
    }

    return errors.slice(-5); // Last 5 errors
  } catch {
    return [];
  }
}

/**
 * Format file size
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Format time ago
 */
function timeAgo(date) {
  if (!date) return 'Unknown';
  
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Get status indicator
 */
function getStatusIndicator(running, hasErrors = false) {
  if (!running) return { icon: '●', color: 'red', text: 'STOPPED' };
  if (hasErrors) return { icon: '●', color: 'yellow', text: 'RUNNING (errors)' };
  return { icon: '●', color: 'green', text: 'RUNNING' };
}

/**
 * Draw dashboard
 */
async function drawDashboard() {
  clearScreen();
  
  const now = new Date().toISOString().replace('T', ' ').split('.')[0];
  
  // Header
  println('═'.repeat(100), 'cyan');
  println('  🤖 BEPO BOT HEALTH DASHBOARD', 'bright');
  println(`  ${now}`, 'dim');
  println('═'.repeat(100), 'cyan');
  println('');

  // Get service statuses
  const botStatus = await getProcessStatus('src/bot.js');
  const monitorStatus = await getProcessStatus('monitor-service.js');
  const offlineStatus = await getProcessStatus('offline-response-system.js');

  // Service Status Section
  println('┌─ SERVICES ' + '─'.repeat(87) + '┐', 'cyan');
  
  // Main Bot
  const botIndicator = getStatusIndicator(botStatus.running);
  print('│ ', 'cyan');
  print(`${botIndicator.icon} `, botIndicator.color);
  print(`Main Bot Service`.padEnd(30), 'white');
  print(`${botIndicator.text}`.padEnd(25), botIndicator.color);
  print(`PIDs: ${botStatus.pids.join(', ') || 'none'}`.padEnd(40), 'dim');
  println('│', 'cyan');

  // Monitor
  const monitorIndicator = getStatusIndicator(monitorStatus.running);
  print('│ ', 'cyan');
  print(`${monitorIndicator.icon} `, monitorIndicator.color);
  print(`Monitor Service`.padEnd(30), 'white');
  print(`${monitorIndicator.text}`.padEnd(25), monitorIndicator.color);
  print(`PIDs: ${monitorStatus.pids.join(', ') || 'none'}`.padEnd(40), 'dim');
  println('│', 'cyan');

  // Offline Response
  const offlineIndicator = getStatusIndicator(offlineStatus.running);
  print('│ ', 'cyan');
  print(`${offlineIndicator.icon} `, offlineIndicator.color);
  print(`Offline Response`.padEnd(30), 'white');
  print(`${offlineIndicator.text}`.padEnd(25), offlineIndicator.color);
  print(`PIDs: ${offlineStatus.pids.join(', ') || 'none'}`.padEnd(40), 'dim');
  println('│', 'cyan');

  println('└' + '─'.repeat(99) + '┘', 'cyan');
  println('');

  // Bot Status Details
  if (fs.existsSync(STATUS_FILE)) {
    try {
      const status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
      
      println('┌─ BOT STATUS ' + '─'.repeat(85) + '┐', 'cyan');
      print('│ Discord Connected: ', 'cyan');
      println((status.discord?.connected ? '✓ Yes' : '✗ No').padEnd(83) + '│', 
        status.discord?.connected ? 'green' : 'red');
      
      print('│ Bot Online: ', 'cyan');
      println((status.botStatus?.isOnline ? '✓ Yes' : '✗ No').padEnd(90) + '│',
        status.botStatus?.isOnline ? 'green' : 'red');
      
      if (status.botStatus?.shutdownReason) {
        print('│ Shutdown Reason: ', 'cyan');
        println(status.botStatus.shutdownReason.padEnd(85) + '│', 'yellow');
      }
      
      if (status.lastSeen) {
        print('│ Last Seen: ', 'cyan');
        println(timeAgo(status.lastSeen).padEnd(91) + '│', 'white');
      }
      
      println('└' + '─'.repeat(99) + '┘', 'cyan');
      println('');
    } catch {}
  }

  // Log Files Section
  println('┌─ LOG FILES ' + '─'.repeat(86) + '┐', 'cyan');
  
  const logFiles = [
    { name: 'Bot', file: 'serverOutput.log' },
    { name: 'Monitor', file: 'monitorOutput.log' },
    { name: 'Offline', file: 'offlineOutput.log' }
  ];

  for (const { name, file } of logFiles) {
    const logInfo = getLogInfo(file);
    
    print('│ ', 'cyan');
    print(`${name}:`.padEnd(12), 'white');
    
    if (logInfo.exists) {
      print(`${formatSize(logInfo.size)}`.padEnd(10), 'dim');
      print(`${timeAgo(logInfo.modified)}`.padEnd(15), 'dim');
      print(`${file}`.padEnd(65), 'cyan');
    } else {
      print('Not found'.padEnd(90), 'red');
    }
    
    println('│', 'cyan');
  }

  println('└' + '─'.repeat(99) + '┘', 'cyan');
  println('');

  // Recent Errors Section
  const allErrors = [
    ...getRecentErrors('serverOutput.log', 30),
    ...getRecentErrors('monitorOutput.log', 30),
    ...getRecentErrors('offlineOutput.log', 30)
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);

  if (allErrors.length > 0) {
    println('┌─ RECENT ERRORS (Last 30 minutes) ' + '─'.repeat(63) + '┐', 'yellow');
    
    allErrors.forEach(error => {
      print('│ ', 'cyan');
      print(`[${timeAgo(error.timestamp)}] `.padEnd(12), 'dim');
      const msg = error.message.substring(0, 83);
      println(msg.padEnd(87) + '│', 'red');
    });
    
    println('└' + '─'.repeat(99) + '┘', 'yellow');
    println('');
  } else {
    println('┌─ RECENT ERRORS ' + '─'.repeat(82) + '┐', 'green');
    println('│ ' + '✓ No errors in the last 30 minutes'.padEnd(98) + '│', 'green');
    println('└' + '─'.repeat(99) + '┘', 'green');
    println('');
  }

  // Quick Actions
  println('┌─ QUICK ACTIONS ' + '─'.repeat(81) + '┐', 'magenta');
  println('│ npm run logs:bot      - View bot logs                                                      │', 'white');
  println('│ npm run logs:monitor  - View monitor logs                                                  │', 'white');
  println('│ npm run logs:offline  - View offline response logs                                         │', 'white');
  println('│ npm run status        - Detailed status check                                              │', 'white');
  println('│ ./scripts/log-manager.js follow serverOutput.log - Live tail                               │', 'white');
  println('└' + '─'.repeat(99) + '┘', 'magenta');
  println('');

  println('Press Ctrl+C to exit', 'dim');
}

/**
 * Main loop
 */
async function main() {
  const refreshInterval = parseInt(process.argv[2]) || 5000; // Default 5s refresh
  
  // Initial draw
  await drawDashboard();

  // Refresh loop
  const interval = setInterval(async () => {
    await drawDashboard();
  }, refreshInterval);

  // Cleanup on exit
  process.on('SIGINT', () => {
    clearInterval(interval);
    println('\n👋 Dashboard closed', 'yellow');
    process.exit(0);
  });
}

main();

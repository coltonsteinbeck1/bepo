#!/usr/bin/env node
/**
 * Log Manager - Advanced log viewing and analysis tool
 * Usage: node scripts/log-manager.js [command] [options]
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(process.cwd(), 'logs');
const ARCHIVE_DIR = path.join(LOGS_DIR, 'archive');

// Color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Print colored message
 */
function print(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Get all log files
 */
function getLogFiles(includeArchive = false) {
  const files = [];
  
  if (fs.existsSync(LOGS_DIR)) {
    const mainLogs = fs.readdirSync(LOGS_DIR)
      .filter(f => f.endsWith('.log') || f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(LOGS_DIR, f),
        size: fs.statSync(path.join(LOGS_DIR, f)).size,
        modified: fs.statSync(path.join(LOGS_DIR, f)).mtime
      }));
    files.push(...mainLogs);
  }

  if (includeArchive && fs.existsSync(ARCHIVE_DIR)) {
    const archiveLogs = fs.readdirSync(ARCHIVE_DIR)
      .filter(f => f.endsWith('.log') || f.endsWith('.json'))
      .map(f => ({
        name: `archive/${f}`,
        path: path.join(ARCHIVE_DIR, f),
        size: fs.statSync(path.join(ARCHIVE_DIR, f)).size,
        modified: fs.statSync(path.join(ARCHIVE_DIR, f)).mtime
      }));
    files.push(...archiveLogs);
  }

  return files.sort((a, b) => b.modified - a.modified);
}

/**
 * Format file size
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Format date
 */
function formatDate(date) {
  return date.toISOString().replace('T', ' ').split('.')[0];
}

/**
 * List all log files
 */
function listLogs() {
  print('\n📋 Available Log Files:', 'cyan');
  print('━'.repeat(80), 'cyan');

  const files = getLogFiles(true);
  
  if (files.length === 0) {
    print('No log files found', 'yellow');
    return;
  }

  files.forEach((file, idx) => {
    const num = `${idx + 1}.`.padEnd(4);
    const name = file.name.padEnd(40);
    const size = formatSize(file.size).padStart(10);
    const modified = formatDate(file.modified);
    
    print(`${num} ${name} ${size}  ${modified}`, 'white');
  });

  print('━'.repeat(80), 'cyan');
  print(`Total: ${files.length} files\n`, 'cyan');
}

/**
 * Tail log file (follow mode)
 */
async function tailLog(filename, lines = 50, follow = false) {
  const logPath = path.join(LOGS_DIR, filename);
  
  if (!fs.existsSync(logPath)) {
    print(`❌ Log file not found: ${filename}`, 'red');
    return;
  }

  print(`\n📖 Tailing: ${filename}${follow ? ' (live)' : ''}`, 'cyan');
  print('━'.repeat(80), 'cyan');

  // Read last N lines
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const buffer = [];
  for await (const line of rl) {
    buffer.push(line);
    if (buffer.length > lines) buffer.shift();
  }

  buffer.forEach(line => printLogLine(line));

  if (follow) {
    print('\n👀 Watching for changes... (Ctrl+C to exit)', 'yellow');
    
    let position = fs.statSync(logPath).size;
    
    const watcher = setInterval(() => {
      const currentSize = fs.statSync(logPath).size;
      
      if (currentSize > position) {
        const stream = fs.createReadStream(logPath, {
          start: position,
          end: currentSize
        });
        
        const rl = readline.createInterface({
          input: stream,
          crlfDelay: Infinity
        });

        rl.on('line', (line) => {
          printLogLine(line);
        });

        position = currentSize;
      }
    }, 1000);

    // Cleanup on exit
    process.on('SIGINT', () => {
      clearInterval(watcher);
      print('\n\n👋 Stopped watching', 'yellow');
      process.exit(0);
    });
  }
}

/**
 * Print formatted log line
 */
function printLogLine(line) {
  try {
    // Try parsing as JSON
    const parsed = JSON.parse(line);
    const timestamp = parsed.timestamp || '';
    const level = parsed.level || 'INFO';
    const message = parsed.message || line;
    
    let color = 'white';
    if (level === 'ERROR' || level === 'CRITICAL') color = 'red';
    else if (level === 'WARN') color = 'yellow';
    else if (level === 'DEBUG') color = 'cyan';
    else if (level === 'INFO') color = 'green';
    
    print(`[${timestamp}] [${level}] ${message}`, color);
    
    if (parsed.data) {
      print(JSON.stringify(parsed.data, null, 2), 'cyan');
    }
  } catch {
    // Not JSON, print as-is
    print(line, 'white');
  }
}

/**
 * Search logs for pattern
 */
async function searchLogs(pattern, options = {}) {
  const { caseSensitive = false, context = 0 } = options;
  const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
  const files = getLogFiles(false);
  
  print(`\n🔍 Searching for: "${pattern}"`, 'cyan');
  print('━'.repeat(80), 'cyan');

  let totalMatches = 0;

  for (const file of files) {
    const fileStream = fs.createReadStream(file.path);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const lines = [];
    for await (const line of rl) {
      lines.push(line);
    }

    const matches = [];
    lines.forEach((line, idx) => {
      if (regex.test(line)) {
        matches.push({ line, idx });
      }
    });

    if (matches.length > 0) {
      print(`\n📄 ${file.name} (${matches.length} matches)`, 'yellow');
      
      matches.forEach(match => {
        const start = Math.max(0, match.idx - context);
        const end = Math.min(lines.length, match.idx + context + 1);
        
        if (context > 0) {
          print(`  Line ${match.idx + 1}:`, 'cyan');
        }
        
        for (let i = start; i < end; i++) {
          const prefix = i === match.idx ? '→ ' : '  ';
          const color = i === match.idx ? 'green' : 'white';
          print(`${prefix}${lines[i]}`, color);
        }
        
        if (context > 0) print('', 'white');
      });
      
      totalMatches += matches.length;
    }
  }

  print('━'.repeat(80), 'cyan');
  print(`Total matches: ${totalMatches}\n`, 'cyan');
}

/**
 * Archive old logs
 */
function archiveLogs(daysOld = 7) {
  print(`\n📦 Archiving logs older than ${daysOld} days...`, 'cyan');
  
  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  }

  const files = getLogFiles(false);
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  let archived = 0;

  files.forEach(file => {
    if (file.modified < cutoffDate) {
      const archivePath = path.join(ARCHIVE_DIR, file.name);
      fs.renameSync(file.path, archivePath);
      print(`  ✓ Archived: ${file.name}`, 'green');
      archived++;
    }
  });

  print(`\n📦 Archived ${archived} files\n`, 'cyan');
}

/**
 * Clean up old logs
 */
function cleanupLogs(daysOld = 30) {
  print(`\n🗑️  Cleaning up logs older than ${daysOld} days...`, 'cyan');
  
  const files = getLogFiles(true);
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  let deleted = 0;

  files.forEach(file => {
    if (file.modified < cutoffDate) {
      fs.unlinkSync(file.path);
      print(`  ✓ Deleted: ${file.name}`, 'green');
      deleted++;
    }
  });

  print(`\n🗑️  Deleted ${deleted} files\n`, 'cyan');
}

/**
 * Show log statistics
 */
async function showStats() {
  print('\n📊 Log Statistics', 'cyan');
  print('━'.repeat(80), 'cyan');

  const files = getLogFiles(true);
  
  const stats = {
    totalFiles: files.length,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
    errors: 0,
    warnings: 0,
    info: 0
  };

  // Count log levels
  for (const file of files) {
    if (!file.name.endsWith('.log')) continue;
    
    const fileStream = fs.createReadStream(file.path);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (line.includes('"level":"ERROR"') || line.includes('[ERROR]')) stats.errors++;
      if (line.includes('"level":"WARN"') || line.includes('[WARN]')) stats.warnings++;
      if (line.includes('"level":"INFO"') || line.includes('[INFO]')) stats.info++;
    }
  }

  print(`Total Files:    ${stats.totalFiles}`, 'white');
  print(`Total Size:     ${formatSize(stats.totalSize)}`, 'white');
  print(``, 'white');
  print(`Error Logs:     ${stats.errors}`, 'red');
  print(`Warning Logs:   ${stats.warnings}`, 'yellow');
  print(`Info Logs:      ${stats.info}`, 'green');
  print('━'.repeat(80), 'cyan');
  print('', 'white');
}

/**
 * Show help
 */
function showHelp() {
  print('\n📖 Log Manager - Help', 'cyan');
  print('━'.repeat(80), 'cyan');
  print('', 'white');
  print('Usage: node scripts/log-manager.js [command] [options]', 'white');
  print('', 'white');
  print('Commands:', 'yellow');
  print('  list                    List all log files', 'white');
  print('  tail <file> [lines]     Show last N lines of log file', 'white');
  print('  follow <file>           Tail log file in real-time', 'white');
  print('  search <pattern>        Search logs for pattern', 'white');
  print('  stats                   Show log statistics', 'white');
  print('  archive [days]          Archive logs older than N days (default: 7)', 'white');
  print('  cleanup [days]          Delete logs older than N days (default: 30)', 'white');
  print('  help                    Show this help message', 'white');
  print('', 'white');
  print('Examples:', 'yellow');
  print('  node scripts/log-manager.js list', 'cyan');
  print('  node scripts/log-manager.js tail serverOutput.log 100', 'cyan');
  print('  node scripts/log-manager.js follow serverOutput.log', 'cyan');
  print('  node scripts/log-manager.js search "error" ', 'cyan');
  print('  node scripts/log-manager.js archive 14', 'cyan');
  print('━'.repeat(80), 'cyan');
  print('', 'white');
}

// Main CLI handler
const command = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

switch (command) {
  case 'list':
    listLogs();
    break;
  case 'tail':
    if (!arg1) {
      print('❌ Please specify a log file', 'red');
      process.exit(1);
    }
    tailLog(arg1, parseInt(arg2) || 50, false);
    break;
  case 'follow':
    if (!arg1) {
      print('❌ Please specify a log file', 'red');
      process.exit(1);
    }
    tailLog(arg1, 50, true);
    break;
  case 'search':
    if (!arg1) {
      print('❌ Please specify a search pattern', 'red');
      process.exit(1);
    }
    searchLogs(arg1);
    break;
  case 'stats':
    showStats();
    break;
  case 'archive':
    archiveLogs(parseInt(arg1) || 7);
    break;
  case 'cleanup':
    cleanupLogs(parseInt(arg1) || 30);
    break;
  case 'help':
  default:
    showHelp();
    break;
}

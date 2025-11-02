#!/usr/bin/env node
/**
 * Repository Cleanup Utility
 * Safely archives old logs, cleans temp files, and maintains repository health
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

// Directories to clean
const CLEANUP_TARGETS = {
  logs: {
    path: path.join(ROOT_DIR, 'logs'),
    patterns: ['*.log', '*.json'],
    excludePatterns: ['bot-status.json', 'bot-status-monitor.json'],
    maxAgeDays: 30,
    description: 'Old log files'
  },
  temp: {
    path: path.join(ROOT_DIR, 'temp'),
    patterns: ['*'],
    excludePatterns: ['.gitkeep', 'README.md'],
    maxAgeDays: 7,
    description: 'Temporary files'
  },
  scriptLogs: {
    path: path.join(ROOT_DIR, 'scripts/logs'),
    patterns: ['*.log'],
    excludePatterns: [],
    maxAgeDays: 14,
    description: 'Script execution logs'
  },
  scriptTemp: {
    path: path.join(ROOT_DIR, 'scripts/temp'),
    patterns: ['*'],
    excludePatterns: ['.gitkeep'],
    maxAgeDays: 7,
    description: 'Script temporary files'
  }
};

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function print(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function matchesPattern(filename, patterns) {
  return patterns.some(pattern => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(filename);
  });
}

async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

function findFilesToClean(targetConfig) {
  const { path: dirPath, patterns, excludePatterns, maxAgeDays } = targetConfig;
  
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const cutoffDate = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
  const files = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      // Skip directories
      if (entry.isDirectory()) continue;
      
      // Skip excluded patterns
      if (matchesPattern(entry.name, excludePatterns)) continue;
      
      // Check if matches cleanup patterns
      if (!matchesPattern(entry.name, patterns)) continue;
      
      // Check age
      const stats = fs.statSync(fullPath);
      if (stats.mtimeMs < cutoffDate) {
        files.push({
          name: entry.name,
          path: fullPath,
          size: stats.size,
          modified: stats.mtime
        });
      }
    }
  } catch (error) {
    print(`  ⚠️  Error scanning ${dirPath}: ${error.message}`, 'yellow');
  }

  return files;
}

function analyzeCleanup() {
  print('\n🔍 Analyzing repository for cleanup opportunities...', 'cyan');
  print('═'.repeat(80), 'cyan');

  const results = {};
  let totalFiles = 0;
  let totalSize = 0;

  for (const [name, config] of Object.entries(CLEANUP_TARGETS)) {
    const files = findFilesToClean(config);
    
    if (files.length > 0) {
      const categorySize = files.reduce((sum, f) => sum + f.size, 0);
      results[name] = { config, files };
      totalFiles += files.length;
      totalSize += categorySize;

      print(`\n📂 ${config.description}:`, 'yellow');
      print(`   Location: ${config.path}`, 'dim');
      print(`   Files to clean: ${files.length}`, 'white');
      print(`   Space to free: ${formatSize(categorySize)}`, 'green');
      print(`   Age threshold: ${config.maxAgeDays} days`, 'dim');
    }
  }

  print('\n' + '═'.repeat(80), 'cyan');
  print(`📊 Total: ${totalFiles} files, ${formatSize(totalSize)} to free`, 'bright');
  print('═'.repeat(80), 'cyan');

  return results;
}

function performCleanup(results, dryRun = false) {
  if (dryRun) {
    print('\n🔎 DRY RUN - No files will be deleted', 'yellow');
  } else {
    print('\n🗑️  Performing cleanup...', 'red');
  }

  let deletedCount = 0;
  let freedSpace = 0;

  for (const [name, { config, files }] of Object.entries(results)) {
    print(`\n📂 Cleaning ${config.description}...`, 'cyan');

    for (const file of files) {
      try {
        if (!dryRun) {
          fs.unlinkSync(file.path);
        }
        print(`  ✓ ${file.name} (${formatSize(file.size)}, ${formatDate(file.modified)})`, 'green');
        deletedCount++;
        freedSpace += file.size;
      } catch (error) {
        print(`  ✗ Failed to delete ${file.name}: ${error.message}`, 'red');
      }
    }
  }

  print('\n' + '═'.repeat(80), 'cyan');
  print(`✅ Cleanup complete!`, 'green');
  print(`   Files ${dryRun ? 'would be' : ''} deleted: ${deletedCount}`, 'white');
  print(`   Space ${dryRun ? 'would be' : ''} freed: ${formatSize(freedSpace)}`, 'green');
  print('═'.repeat(80), 'cyan');
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const force = args.includes('--force') || args.includes('-f');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    print('\n📖 Repository Cleanup Utility', 'cyan');
    print('═'.repeat(80), 'cyan');
    print('\nUsage: node scripts/cleanup-repo.js [options]', 'white');
    print('\nOptions:', 'yellow');
    print('  -d, --dry-run    Show what would be deleted without deleting', 'white');
    print('  -f, --force      Skip confirmation prompt', 'white');
    print('  -h, --help       Show this help message', 'white');
    print('\nExamples:', 'yellow');
    print('  node scripts/cleanup-repo.js --dry-run  # Preview cleanup', 'cyan');
    print('  node scripts/cleanup-repo.js --force    # Clean without prompt', 'cyan');
    print('  npm run cleanup                         # Interactive cleanup', 'cyan');
    print('═'.repeat(80), 'cyan');
    return;
  }

  print('\n🧹 Bepo Repository Cleanup Utility', 'cyan');
  
  const results = analyzeCleanup();

  if (Object.keys(results).length === 0) {
    print('\n✨ Repository is clean! No files to remove.', 'green');
    return;
  }

  if (!dryRun && !force) {
    print('\n⚠️  Warning: This will permanently delete files!', 'yellow');
    const proceed = await promptUser('Continue with cleanup? (y/N): ');
    
    if (!proceed) {
      print('\n❌ Cleanup cancelled', 'yellow');
      return;
    }
  }

  performCleanup(results, dryRun);
}

main();

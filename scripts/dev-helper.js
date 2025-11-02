#!/usr/bin/env node
/**
 * Bepo Development Helper
 * One-stop tool for common development tasks
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';

const execAsync = promisify(exec);

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

function print(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

async function showMenu() {
  clearScreen();
  print('╔════════════════════════════════════════════════════════════╗', 'cyan');
  print('║           🤖 BEPO DEVELOPMENT HELPER                       ║', 'bright');
  print('╚════════════════════════════════════════════════════════════╝', 'cyan');
  print('', 'reset');
  
  print('  SERVICE MANAGEMENT', 'yellow');
  print('  1. Start Bot (all services)', 'white');
  print('  2. Stop Bot', 'white');
  print('  3. Restart Bot', 'white');
  print('  4. Service Status', 'white');
  print('', 'reset');
  
  print('  MONITORING & LOGS', 'yellow');
  print('  5. Health Dashboard', 'white');
  print('  6. View Bot Logs (live)', 'white');
  print('  7. Search Logs', 'white');
  print('  8. Log Statistics', 'white');
  print('', 'reset');
  
  print('  DEVELOPMENT', 'yellow');
  print('  9. Run Tests', 'white');
  print('  10. Deploy Commands', 'white');
  print('  11. Validate Setup', 'white');
  print('', 'reset');
  
  print('  MAINTENANCE', 'yellow');
  print('  12. Clean Repository', 'white');
  print('  13. Archive Logs', 'white');
  print('  14. Rotate Logs', 'white');
  print('', 'reset');
  
  print('  0. Exit', 'red');
  print('', 'reset');
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function runCommand(command, description) {
  print(`\n▶️  ${description}...`, 'cyan');
  print('═'.repeat(60), 'cyan');
  
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');
    const process = spawn(cmd, args, {
      stdio: 'inherit',
      shell: true
    });

    process.on('exit', (code) => {
      if (code === 0) {
        print('═'.repeat(60), 'cyan');
        print('✓ Complete\n', 'green');
        resolve();
      } else {
        print('═'.repeat(60), 'cyan');
        print(`✗ Exited with code ${code}\n`, 'red');
        resolve(); // Don't reject, allow menu to continue
      }
    });

    process.on('error', (error) => {
      print(`✗ Error: ${error.message}\n`, 'red');
      resolve();
    });
  });
}

async function waitForKey() {
  print('\nPress Enter to continue...', 'dim');
  await prompt('');
}

async function handleChoice(choice) {
  switch (choice) {
    case '1':
      await runCommand('npm run start:quick', 'Starting all services');
      await waitForKey();
      break;
      
    case '2':
      await runCommand('npm run stop', 'Stopping services');
      await waitForKey();
      break;
      
    case '3':
      await runCommand('npm run restart', 'Restarting services');
      await waitForKey();
      break;
      
    case '4':
      await runCommand('npm run status', 'Checking service status');
      await waitForKey();
      break;
      
    case '5':
      print('\n▶️  Opening Health Dashboard...', 'cyan');
      print('Press Ctrl+C to exit the dashboard and return to menu\n', 'yellow');
      await runCommand('npm run health', 'Health Dashboard');
      break;
      
    case '6':
      print('\n▶️  Viewing bot logs (live)...', 'cyan');
      print('Press Ctrl+C to stop following logs\n', 'yellow');
      await runCommand('npm run logs:bot', 'Bot Logs');
      break;
      
    case '7':
      const searchTerm = await prompt('Enter search term: ');
      if (searchTerm) {
        await runCommand(`npm run logs:search "${searchTerm}"`, `Searching for "${searchTerm}"`);
      }
      await waitForKey();
      break;
      
    case '8':
      await runCommand('npm run logs:stats', 'Log statistics');
      await waitForKey();
      break;
      
    case '9':
      await runCommand('npm run test', 'Running tests');
      await waitForKey();
      break;
      
    case '10':
      await runCommand('npm run deploy', 'Deploying commands');
      await waitForKey();
      break;
      
    case '11':
      await runCommand('npm run validate-offline', 'Validating setup');
      await waitForKey();
      break;
      
    case '12':
      print('\n▶️  Repository Cleanup', 'cyan');
      const confirmClean = await prompt('Run cleanup? (y/N): ');
      if (confirmClean.toLowerCase() === 'y') {
        await runCommand('npm run cleanup', 'Cleaning repository');
      } else {
        await runCommand('npm run cleanup:dry', 'Preview cleanup (dry run)');
      }
      await waitForKey();
      break;
      
    case '13':
      await runCommand('npm run logs:archive', 'Archiving old logs');
      await waitForKey();
      break;
      
    case '14':
      await runCommand('npm run logs:rotate', 'Rotating logs');
      await waitForKey();
      break;
      
    case '0':
      print('\n👋 Goodbye!\n', 'cyan');
      process.exit(0);
      break;
      
    default:
      print('\n❌ Invalid choice', 'red');
      await waitForKey();
      break;
  }
}

async function main() {
  print('\n🚀 Welcome to Bepo Development Helper!\n', 'cyan');
  print('Initializing...', 'dim');
  
  // Quick health check
  try {
    await execAsync('npm run status 2>&1 | head -5');
  } catch (error) {
    print('⚠️  Could not check initial status', 'yellow');
  }
  
  while (true) {
    await showMenu();
    const choice = await prompt('Select an option: ');
    await handleChoice(choice);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  print('\n\n👋 Goodbye!\n', 'cyan');
  process.exit(0);
});

main();

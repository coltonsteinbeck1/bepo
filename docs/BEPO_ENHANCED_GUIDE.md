# Bepo Enhanced Management System

## Overview

The enhanced Bepo system now includes integrated offline mode and comprehensive monitoring. The system consists of three main components:

1. **Main Bot** (`src/bot.js`) - The Discord bot with Apex/CS2 monitoring
2. **Bot Monitor** (`scripts/bot-monitor.js`) - External health monitoring
3. **Offline Response System** (`scripts/offline-response-system.js`) - Responds to mentions when main bot is down

## Quick Start

### Validate Setup (First Time)
```bash
npm run validate-offline
# or
node validate-offline-setup.js
```

### Start Bepo (All Services)
```bash
./start-bepo.sh
# or
npm start
```

### Stop Bepo (All Services)
```bash
./stop-bepo.sh
# or 
npm stop
```

### Check Status
```bash
./bepo-status.sh
# or
npm run status
```

## Configuration

### Environment Variables
You can disable services by setting environment variables:

```bash
# Disable bot monitoring
ENABLE_BOT_MONITOR=false ./start-bepo.sh

# Disable offline mode
ENABLE_OFFLINE_MODE=false ./start-bepo.sh

# Disable both
ENABLE_BOT_MONITOR=false ENABLE_OFFLINE_MODE=false ./start-bepo.sh
```

### Configuration File
Edit `bepo-config.sh` to change default settings:
- Service timeouts
- Log file locations
- Process patterns
- Startup delays

## Service Management

### Individual Service Control
```bash
# Start/stop individual services
npm run start:bot-only    # Just the bot
npm run start:monitor     # Just the monitor
npm run start:offline     # Just offline system

npm run stop:bot          # Stop just the bot
npm run stop:monitor      # Stop just the monitor
npm run stop:offline      # Stop just offline system
npm run stop:all          # Force stop all processes
```

### Log Monitoring
```bash
# View individual logs
npm run logs:bot          # Bot logs
npm run logs:monitor      # Monitor logs
npm run logs:offline      # Offline system logs
npm run logs:all          # All logs together

# Traditional log viewing
tail -f serverOutput.log
tail -f monitorOutput.log
tail -f offlineOutput.log
```

## Tmux Session Management

The system uses tmux for process management with separate windows:

```bash
# Attach to the session
tmux attach-session -t bepo-session

# Switch between windows
tmux select-window -t bepo-session:bot      # Main bot
tmux select-window -t bepo-session:monitor  # Monitor (if enabled)
tmux select-window -t bepo-session:offline  # Offline system (if enabled)

# List windows
tmux list-windows -t bepo-session
```

## Features

### Integrated Offline Mode
- Automatically starts with the main bot
- Responds to mentions when main bot is offline
- User cooldown to prevent spam
- Webhook fallback support
- Comprehensive logging

### Enhanced Monitoring
- External process monitoring
- Health status tracking
- Discord connection monitoring
- Automatic restart on crashes
- Status file generation

### Apex Commands Integration
- `/apex` - Get patch notes with filtering
- `/apexnotify` - Manage notifications
- Automatic background monitoring
- Role mentions for new patches
- Combined patch notifications

### Improved Process Management
- Staggered startup (monitor → offline → bot)
- Graceful shutdown in reverse order
- Process validation and cleanup
- Centralized configuration
- Color-coded status output

## Troubleshooting

### Check System Status
```bash
./bepo-status.sh --logs    # Detailed status with recent logs
npm run status             # Quick status check
```

### Common Issues

1. **Services won't start**: Check if ports are in use or previous processes are running
   ```bash
   npm run stop:all    # Force kill all processes
   ./start-bepo.sh     # Restart
   ```

2. **Offline mode not working**: Verify bot token and channel permissions
   ```bash
   npm run setup-offline-responses  # Reconfigure
   ```

3. **Monitor not detecting bot**: Check status file permissions
   ```bash
   ls -la logs/bot-status.json
   ```

### Manual Process Control
```bash
# Find running processes
pgrep -f "node.*src/bot.js"
pgrep -f "node.*bot-monitor.js"
pgrep -f "node.*offline-response-system.js"

# Kill specific processes
pkill -f "node.*src/bot.js"
```

## Log Files

- `serverOutput.log` - Main bot logs
- `monitorOutput.log` - Monitor system logs
- `offlineOutput.log` - Offline response system logs
- `logs/bot-status.json` - Real-time status file
- `logs/offline-responses.json` - Offline response history
- `logs/health-YYYY-MM-DD.json` - Daily health logs

## Advanced Configuration

### Custom Service Patterns
Edit `bepo-config.sh` to modify:
- Process detection patterns
- Restart delays
- Log file locations
- Color schemes

### Webhook Configuration
Set up webhook notifications for offline alerts:
```bash
npm run setup-webhooks
```

### Testing
```bash
npm run test-notifications     # Test offline notification system
npm run test-scenarios        # Test various scenarios
npm run validate-offline       # Validate offline mode setup
```

### Discord Testing
For comprehensive Discord testing scenarios:
- **Quick Guide**: `DISCORD_TESTING_QUICK.md`
- **Detailed Scenarios**: `OFFLINE_MODE_TESTING.md`

This enhanced system provides robust monitoring, automatic recovery, and comprehensive offline support while maintaining the existing Apex command functionality.

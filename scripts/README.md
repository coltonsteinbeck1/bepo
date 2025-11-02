# Scripts Directory

This directory contains all operational scripts for managing, monitoring, and maintaining the Bepo bot.

## 🚀 Quick Start Scripts

### Service Management
- **`start-bepo.sh`** - Start all Bepo services (bot, monitor, offline response)
- **`stop-bepo.sh`** - Stop all Bepo services
- **`start-bot-only.sh`** - Start only the main bot
- **`stop-bot-only.sh`** - Stop only the main bot

### Health & Status
- **`health-dashboard.js`** - Real-time health monitoring dashboard
  ```bash
  npm run health          # Live dashboard (refreshes every 5s)
  npm run health:once     # Single snapshot
  ```

- **`bepo-status.sh`** - Detailed service status check
  ```bash
  npm run status
  ```

## 📊 Logging & Monitoring

### Log Manager
Advanced log viewing and management tool:

```bash
# List all logs
npm run logs

# Tail specific log
npm run logs:tail serverOutput.log 100

# Follow log in real-time
npm run logs:follow serverOutput.log

# Search across all logs
npm run logs:search "error"

# Show log statistics
npm run logs:stats

# Archive old logs
npm run logs:archive 7

# Cleanup old logs
npm run logs:cleanup 30
```

### Direct Log Access
```bash
npm run logs:bot        # Bot logs
npm run logs:monitor    # Monitor logs
npm run logs:offline    # Offline response logs
npm run logs:all        # All logs simultaneously
```

### Log Rotation
```bash
npm run logs:rotate     # Rotate and compress large logs
```

## 🔧 Configuration & Setup

### Initial Setup
- **`setup-offline-responses.js`** - Configure offline response system
- **`setup-webhook-notifications.js`** - Setup webhook notifications
- **`setup-monitoring-env.js`** - Configure monitoring environment

### Validation
- **`validate-offline-setup.js`** - Validate offline mode configuration

## 🎮 Game Integration

### Apex Legends
- **`setup-apex-channel-and-test.js`** - Setup and test Apex notifications
- **`simulate-apex-notification.js`** - Test Apex notification system

### Counter-Strike 2
- **`setup-cs2-channel-and-test.js`** - Setup and test CS2 notifications
- **`simulate-cs2-notification.js`** - Test CS2 notification system
- **`verify-cs2-configuration.js`** - Verify CS2 configuration

## 🔍 Monitoring Services

### Core Services
- **`monitor-service.js`** - Main bot health monitoring service
- **`bot-monitor.js`** - Bot process monitor
- **`offline-response-system.js`** - Handles responses when bot is offline
- **`webhook-offline-response-system.js`** - Webhook-based offline responses

### Status Checking
- **`check-bot-status.js`** - Quick bot status check
- **`check-bot-status-detailed.js`** - Detailed bot status report

### Testing
- **`test-monitor-service.js`** - Test monitoring service
- **`test-unified-monitoring.js`** - Test unified monitoring system

## 📝 Commands & Deployment

- **`deploy-commands.js`** - Deploy slash commands to Discord
- **`delete-commands.js`** - Delete slash commands from Discord

## 🛠️ Utilities

- **`create-context.js`** - Context generation utilities
- **`bepo-config.sh`** - Shared configuration for shell scripts
- **`rotate-logs.sh`** - Log rotation and archiving

## 📂 Directory Structure

```
scripts/
├── Service Management
│   ├── start-bepo.sh
│   ├── stop-bepo.sh
│   ├── start-bot-only.sh
│   └── stop-bot-only.sh
│
├── Monitoring & Health
│   ├── health-dashboard.js
│   ├── bepo-status.sh
│   ├── monitor-service.js
│   ├── bot-monitor.js
│   └── check-bot-status*.js
│
├── Logging
│   ├── log-manager.js
│   └── rotate-logs.sh
│
├── Setup & Configuration
│   ├── setup-*.js
│   └── validate-*.js
│
├── Game Integration
│   ├── setup-apex-channel-and-test.js
│   ├── setup-cs2-channel-and-test.js
│   └── simulate-*-notification.js
│
└── Utilities
    ├── deploy-commands.js
    ├── delete-commands.js
    └── create-context.js
```

## 🎯 Common Workflows

### Starting Fresh
```bash
npm run deploy              # Deploy commands
npm run start:quick         # Start all services
npm run health              # Monitor health
```

### Troubleshooting
```bash
npm run status              # Check service status
npm run logs:search "error" # Find recent errors
npm run logs:follow serverOutput.log  # Watch logs live
```

### Maintenance
```bash
npm run logs:archive        # Archive old logs
npm run logs:rotate         # Rotate large logs
npm run logs:cleanup 30     # Delete logs >30 days old
```

### Testing Changes
```bash
npm run test                # Run tests
npm run stop                # Stop services
npm run start               # Restart with changes
npm run health              # Verify health
```

## 🔑 Environment Variables

Scripts use environment variables from `.env`:
- `BOT_TOKEN` - Discord bot token
- `OPENAI_KEY` - OpenAI API key
- `XAI_KEY` - xAI API key
- `SUPABASE_URL` - Supabase URL
- `SUPABASE_KEY` - Supabase key
- `LOG_LEVEL` - Logging level (DEBUG, INFO, WARN, ERROR, CRITICAL)

## 🆘 Getting Help

All scripts support `--help` or `-h` flag:
```bash
node scripts/log-manager.js help
node scripts/health-dashboard.js --help
```

For issues, check:
1. Service status: `npm run status`
2. Recent errors: `npm run logs:search "error"`
3. Health dashboard: `npm run health`
4. Full logs: `npm run logs:bot`

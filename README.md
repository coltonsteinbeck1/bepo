# Bepo - Discord Bot

A feature-rich Discord bot with robust offline mode, health monitoring, and game integration.

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your tokens and configuration

# Start the bot system
./start-bepo.sh

# Check status
./scripts/bepo-status.sh
```

## 📚 Documentation

All documentation has been moved to the [`docs/`](./docs/) folder:

### Essential Guides

- **[Quick Discord Testing](./docs/DISCORD_TESTING_QUICK.md)** - Fast testing procedures
- **[User Guide](./docs/USER_GUIDE.md)** - Complete user documentation
- **[Technical Documentation](./docs/TECHNICAL_DOCS.md)** - Developer reference

### Setup & Configuration

- **[Complete Offline Solution](./docs/COMPLETE_OFFLINE_SOLUTION.md)** - Offline mode setup
- **[Offline Mode Testing](./docs/OFFLINE_MODE_TESTING.md)** - Comprehensive testing
- **[Implementation Summary](./docs/IMPLEMENTATION_SUMMARY.md)** - Architecture overview

### Testing & Troubleshooting

- **[Complete Test Scenarios](./docs/COMPLETE_TEST_SCENARIOS.md)** - All test cases
- **[Testing Guide](./docs/TESTING_GUIDE.md)** - Testing procedures
- **[Quick Reference](./docs/QUICK_REFERENCE.md)** - Command reference

### Game Integration

- **[Apex Integration](./docs/APEX_INTEGRATION_SUMMARY.md)** - Apex Legends features
- **[Enhanced Guide](./docs/BEPO_ENHANCED_GUIDE.md)** - Advanced features

### Recent Improvements

- **[Shutdown Reason Improvements](./docs/SHUTDOWN_REASON_IMPROVEMENTS.md)** - Enhanced status detection

## ⚡ Key Features

- **🤖 Discord Bot**: Slash commands, interactive embeds, and rich responses
- **📡 Offline Mode**: Automatic mention responses when main bot is down
- **🔍 Health Monitoring**: Real-time status checking and alerting
- **🎮 Game Integration**: Apex Legends and CS2 updates
- **🛠️ Process Management**: tmux-based service control
- **📊 Enhanced Status**: Detailed shutdown reason detection

## 🚀 Recent Updates

### Offline Health Command

- **New**: Health/status requests work even when bot is offline
- **Usage**: `@Bepo health`, `@Bepo status`, or `@Bepo /health`
- **Features**: Detailed shutdown reasons, recovery status, and maintenance info

### Improved Documentation

- **Organized**: All `.md` files moved to `docs/` folder
- **Enhanced**: Better testing guides and quick references
- **Updated**: Reflects latest offline mode improvements

## 📋 Quick Commands

```bash
# Service Management
npm run start:quick      # Start full system
npm run stop             # Stop everything
npm run restart          # Restart all services
npm run status           # Check system status

# Health & Monitoring
npm run health           # Real-time health dashboard
npm run health:once      # Single status snapshot

# Logs & Debugging
npm run logs             # List all log files
npm run logs:bot         # View bot logs
npm run logs:follow serverOutput.log  # Live tail
npm run logs:search "error"  # Search across logs
npm run logs:stats       # Log statistics

# Maintenance
npm run logs:rotate      # Rotate large logs
npm run logs:archive     # Archive old logs
npm run logs:cleanup     # Delete old logs
npm run cleanup          # Clean up repository
```

## 🔧 Architecture

- **Main Bot** (`src/bot.js`): Primary Discord bot process
- **Monitor** (`scripts/bot-monitor.js`): Health checking and alerting
- **Offline System** (`scripts/offline-response-system.js`): Backup response handling
- **Health Command**: Works both online (slash command) and offline (mention response)

## 📞 Support

For issues or questions, check the documentation in the `docs/` folder or contact the development team.

---

_Bepo - Your reliable Discord companion, online or offline._

# Bot Offline Notification System

This system provides comprehensive monitoring and notification capabilities when the Discord bot goes offline or encounters issues.

## Features

### 🔍 **Status Monitoring**
- Real-time bot health monitoring via subprocess
- Tracks online/offline status, process health, and response times
- Logs status changes and generates detailed reports

### 📬 **Offline Notifications**
- Discord webhook notifications when bot goes offline
- Automatic recovery notifications when bot comes back online
- User-friendly status messages when bot is mentioned while offline

### 🤖 **User Interaction**
- Bot responds with status info when mentioned while having issues
- Interactive health commands with real-time status updates
- Detailed diagnostic information available via CLI tools

## Setup

### 1. Configure Webhook Notifications (Optional)
```bash
npm run setup-webhooks
```
This will guide you through setting up Discord webhooks for automatic offline notifications.

### 2. Start the Monitor
```bash
npm run monitor
```
The monitor runs independently and tracks bot status even when the main bot is down.

### 3. Test the System
```bash
# Test notification scenarios
npm run test-scenarios

# Test the complete notification system
npm run test-notifications

# Check current bot status
npm run status
```

## How It Works

### Monitoring Process
1. **Independent Monitor**: A separate process (`bot-monitor.js`) runs continuously
2. **Health Checks**: Monitors bot process, status file updates, and response times
3. **Status Detection**: Identifies when bot transitions between online/offline states
4. **Notification Triggers**: Sends alerts when status changes occur

### User Interaction Flow
1. **User mentions bot** while it's offline or having issues
2. **Bot checks its own status** using the monitoring system
3. **Status message generated** with helpful information
4. **User receives clear feedback** about bot availability

### Webhook Notifications
1. **Bot goes offline** → Automatic Discord notification sent
2. **Bot recovers** → Recovery notification sent
3. **Cooldown system** prevents notification spam

## Status Messages

### When Bot is Online
```
🟢 Bot Status: ONLINE
✅ All systems operational
```

### When Bot is Offline
```
🔴 Bot Status: OFFLINE
🕒 Last seen: 5 minutes ago
❓ Reason: Bot process not running

*The bot may be temporarily unavailable. Please try again later.*
```

## Configuration

### Environment Variables
```bash
# Discord webhook for offline notifications
DISCORD_ALERT_WEBHOOK=https://discord.com/api/webhooks/...

# Multiple webhooks (comma-separated)
OFFLINE_WEBHOOKS=webhook1,webhook2,webhook3
```

### Monitoring Settings
- **Check Interval**: 30 seconds
- **Offline Threshold**: 90 seconds (no updates = offline)
- **Notification Cooldown**: 10 minutes (prevents spam)

## Commands & Scripts

### NPM Scripts
- `npm run monitor` - Start the bot monitor
- `npm run setup-webhooks` - Configure Discord webhooks
- `npm run test-notifications` - Test the notification system
- `npm run test-scenarios` - Test different offline scenarios
- `npm run status` - Check current bot status

### Discord Commands
- `/health` - Interactive bot health status
- `/ping` - Quick status check with online/offline info
- `@mention bot` - Get status message if bot is having issues

## Files & Logs

### Status Files
- `logs/bot-status.json` - Current bot status
- `logs/bot-status-monitor.json` - Monitor status
- `logs/monitor.log` - Monitor activity log

### Health Logs
- `logs/health-YYYY-MM-DD.json` - Daily health metrics
- `logs/critical-errors-YYYY-MM-DD.json` - Critical error tracking
- `logs/offline-alerts.json` - Notification history

## Troubleshooting

### Bot Not Responding to Mentions
1. Check if bot process is running: `ps aux | grep node`
2. Check monitor status: `npm run status`
3. Review monitor logs: `tail -f logs/monitor.log`

### Webhook Notifications Not Working
1. Verify webhook URL is correct
2. Test webhook: `npm run test-notifications`
3. Check Discord channel permissions

### Monitor Not Detecting Offline Status
1. Ensure monitor is running: `npm run monitor`
2. Check status file exists: `ls -la logs/bot-status.json`
3. Verify file update times: `stat logs/bot-status.json`

## Integration Points

### Bot Integration
- Status checking on user mentions
- Health monitoring in main bot process
- Error tracking and reporting

### Monitor Integration
- Process detection and monitoring
- Status file analysis
- Webhook notification triggers

### User Experience
- Clear status messages
- Interactive health commands
- Helpful troubleshooting information

# Complete Bepo Offline Response Solution

## The Problem: Bepo Can't Respond When Truly Offline

When a Discord bot is **completely offline** (not running), it cannot respond to mentions because there's no process running to handle the messages. The original approach of checking status from within the bot only works when the bot is running but experiencing issues.

## The Solution: Multi-Layer Offline Response System

### 🎯 **Approach 1: Enhanced In-Bepo Status Checking (When Bepo is Running)**

This works when Bepo is running but experiencing issues:

```javascript
// In bot.js - responds when Bepo is running but unhealthy
if (isBotMentioned(message, client) && !isBotMessageOrPrefix(message, BOT_PREFIX)) {
    const statusChecker = getStatusChecker();
    const currentStatus = await statusChecker.getBotStatus();
    
    if (!currentStatus.summary.operational) {
        const statusMessage = offlineNotificationService.generateStatusMessage(currentStatus);
        await message.reply(statusMessage);
        return;
    }
}
```

### 🛡️ **Approach 2: External Offline Response System (When Bepo is Completely Down)**

A separate lightweight Discord client that monitors for mentions when Bepo is offline:

#### Setup and Usage:

1. **Configure the system:**
```bash
npm run setup-offline-responses
```

2. **Start the offline monitor:**
```bash
npm run offline-monitor
```

3. **Test the system:**
```bash
# Stop your main Bepo bot, then mention it in Discord
# The offline monitor will respond with status info
```

#### How It Works:
- **Separate Process**: Runs independently from the main Bepo bot
- **Lightweight Client**: Uses minimal Discord.js client just for monitoring
- **Status Detection**: Checks if main Bepo bot is offline using status files
- **Smart Response**: Only responds when main Bepo bot is truly offline
- **Cooldown System**: Prevents spam (1 minute per user)
- **Webhook Fallback**: Uses webhooks if direct replies fail

### 🔔 **Approach 3: Webhook Notifications (For Administrators)**

Automatic Discord notifications when Bepo goes offline:

#### Setup:
```bash
npm run setup-webhooks
```

#### Features:
- Sends alerts when Bepo transitions offline/online
- Includes detailed status information
- Cooldown prevents notification spam
- Multiple webhook support

## 📋 Complete Setup Guide

### Step 1: Configure Webhook Notifications (Optional)
```bash
npm run setup-webhooks
```
- Provides admin alerts when Bepo goes down
- Set up Discord webhook URL in your admin channel

### Step 2: Set Up Offline Response System
```bash
npm run setup-offline-responses
```
- Configure which channels to monitor for mentions
- Leave empty to monitor all channels

### Step 3: Start Monitoring Systems
```bash
# Start the main Bepo monitor (tracks status)
npm run monitor

# Start the offline response system (responds to mentions)
npm run offline-monitor
```

### Step 4: Test the System
```bash
# Test notification scenarios
npm run test-scenarios

# Check current status
npm run status

# Test while Bepo is running but having issues
# Mention Bepo - it should respond with status

# Test while Bepo is completely offline
# Stop the main Bepo bot, mention it - offline monitor should respond
```

## 🔧 Configuration Options

### Environment Variables
```bash
# Webhook for admin notifications
DISCORD_ALERT_WEBHOOK=https://discord.com/api/webhooks/...

# Channels to monitor for offline responses (comma-separated)
OFFLINE_RESPONSE_CHANNELS=123456789,987654321

# Multiple webhooks (comma-separated)
OFFLINE_WEBHOOKS=webhook1,webhook2
```

### Response Behavior
- **Main Bepo Running + Healthy**: Normal responses
- **Main Bepo Running + Unhealthy**: Status message with health info
- **Main Bepo Completely Offline**: Offline monitor responds with status
- **Both Systems Down**: Webhook notifications only

## 📊 Monitoring and Logs

### Status Files
- `logs/bot-status.json` - Current Bepo status
- `logs/bot-status-monitor.json` - Monitor status
- `logs/offline-responses.json` - Offline response log

### Log Files
- `logs/monitor.log` - Main Bepo monitor activity
- `logs/offline-alerts.json` - Webhook notification history

### Commands for Monitoring
```bash
npm run status          # Check current Bepo status
npm run test-notifications  # Test the notification system
tail -f logs/monitor.log     # Watch monitor activity
```

## 🎭 Test Scenarios

### Scenario 1: Bepo Running but Unhealthy
1. Start Bepo normally
2. Generate errors to make it unhealthy
3. Mention Bepo → Should get health status

### Scenario 2: Bepo Completely Offline
1. Stop the main Bepo bot completely
2. Keep offline-monitor running
3. Mention Bepo → Should get offline status from monitor

### Scenario 3: Both Systems Down
1. Stop both main Bepo bot and offline-monitor
2. Mention Bepo → No response (but webhook alert sent if configured)

## 🚀 NPM Scripts Summary

```bash
# Setup
npm run setup-webhooks           # Configure admin webhooks
npm run setup-offline-responses  # Configure offline response system

# Monitoring
npm run monitor                  # Start main bot monitor
npm run offline-monitor          # Start offline response system

# Testing
npm run test-notifications       # Test notification system
npm run test-scenarios          # Test different offline scenarios
npm run status                  # Check current Bepo status
```

## 🎯 Recommended Production Setup

1. **Main Bepo**: Your regular Discord bot
2. **Bepo Monitor**: `npm run monitor` (tracks status, sends webhooks)
3. **Offline Response**: `npm run offline-monitor` (responds to mentions when main Bepo is down)
4. **Process Manager**: Use PM2 or similar to keep monitors running

```bash
# Example PM2 setup
pm2 start "npm run monitor" --name "bepo-monitor"
pm2 start "npm run offline-monitor" --name "bepo-offline-responder"
pm2 start "npm run dev" --name "main-bepo"
```

This gives you comprehensive coverage for all offline scenarios!

# Bepo Bot Guide

## 🎯 Main Features

### APEX Mode - Gaming Notifications
Bepo can monitor Apex Legends patch notes and provide real-time notifications to your Discord server.

### OFFLINE Mode - Continuous Operation
Bepo includes an offline monitoring system that responds to mentions even when the main bot is down.

---

## 🚀 Quick Start

### Starting Bepo
```bash
npm start
```
This starts all services:
- Main Bepo bot
- Health monitor 
- Offline response system

### Stopping Bepo
```bash
npm stop
```
Stops all Bepo services and processes.

### Checking Status
```bash
npm run status
```
View current bot health and operational status.

---

## 🎮 APEX Mode Setup

### 1. Configure APEX Notifications
Use the `/apexnotify` command in Discord:

```
/apexnotify setchannel #your-channel    # Set notification channel
/apexnotify start                       # Start monitoring
/apexnotify status                      # Check monitoring status
```

### 2. Test APEX Features
```
/maprotation                           # Current map rotation
/apexnotify check                      # Manual patch check
```

---

## 🛡️ OFFLINE Mode Features

### Automatic Offline Detection
When the main bot goes down, the offline monitor automatically:
- Detects mentions of Bepo
- Responds with status information
- Sends admin alerts (if configured)

### Setup Webhook Alerts (Optional)
```bash
npm run setup-webhooks
```
Configure Discord webhooks for admin notifications when Bepo goes offline.

---

## 🔧 Testing & Scenarios

### Quick Test
```bash
npm run test-scenarios
```

This tests:
1. **Bot Healthy**: Normal responses
2. **Bot Offline**: Offline monitor responds
3. **Bot Unhealthy**: Status message with health info

### Comprehensive Testing
See **[Testing Guide](./TESTING_GUIDE.md)** for complete test scenarios including:
- Shell script integration tests
- APEX mode functionality tests
- Offline mode detection tests
- Process management verification

### Test Individual Components
```bash
npm run start:bot-only     # Just the main bot
npm run start:monitor      # Just the health monitor  
npm run start:offline      # Just offline responder
```

---

## 📊 Monitoring & Logs

### Real-time Logs
```bash
npm run logs              # Monitor activity
tail -f serverOutput.log  # Main bot logs
tail -f logs/monitor.log  # Health monitor logs
```

### Status Files
- `logs/bot-status.json` - Current bot status
- `logs/offline-alerts.json` - Offline alert history

---

## 🎯 Common Commands

### Bot Management
```bash
npm start                 # Start all services
npm stop                  # Stop all services  
npm restart              # Restart everything
npm run status           # Check health
```

### Development
```bash
npm run dev              # Development mode
npm test                 # Run tests
npm run deploy           # Deploy slash commands
```

---

## 🏥 How It Works

### Multi-Layer System
1. **Main Bot**: Handles all commands and features
2. **Health Monitor**: Tracks bot status and sends alerts
3. **Offline Responder**: Responds to mentions when main bot is down

### Smart Detection
- **Online + Healthy**: Normal bot responses
- **Online + Issues**: Health status messages
- **Completely Offline**: Offline monitor responds
- **All Systems Down**: Webhook alerts only

---

## 🚨 Troubleshooting

### Bot Not Responding
1. Check status: `npm run status`
2. View logs: `tail -f serverOutput.log`
3. Restart: `npm restart`

### APEX Notifications Not Working
1. Verify channel setup: `/apexnotify status`
2. Check permissions in target channel
3. Test manually: `/apexnotify check`

### Offline Monitor Issues
1. Check if running: `ps aux | grep offline`
2. View logs: `tail -f logs/offline-responses.log`
3. Restart offline system: `npm run start:offline`

---

*That's it! Bepo is designed to be simple and reliable. The bot automatically handles most scenarios, and the offline system ensures continuity even during downtime.*

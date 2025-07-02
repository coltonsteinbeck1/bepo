# Quick Discord Testing Guide for Offline Mode

## ⚡ Quick Start Testing

### 1. Validate Setup
```bash
npm run validate-offline
```

### 2. Start System  
```bash
./start-bepo.sh
```

### 3. Test Normal Operation
In Discord: `@Bepo hello` 
- ✅ **Expected**: Normal bot response
- ✅ **Expected**: No offline system response

### 4. Test Offline Response
```bash
# Stop just the bot
npm run stop:bot

# Wait 2 minutes for offline detection
# Then in Discord:
@Bepo are you there?
```
- ✅ **Expected**: Response from "offline monitoring system"
- ✅ **Expected**: Message includes current status

### 5. Test Health Command When Offline
```bash
# With bot still offline, in Discord:
@Bepo health
# or
@Bepo status
# or  
@Bepo /health
```
- ✅ **Expected**: Detailed health dashboard response from offline system
- ✅ **Expected**: Shows shutdown reason, downtime, and recovery status
- ✅ **Expected**: Different color for planned vs unexpected shutdown

### 6. Test Cooldown
```bash
# Immediately after step 5, mention again:
@Bepo second message
```
- ✅ **Expected**: No response (user cooldown active)

### 7. Check Logs
```bash
# Monitor offline activity
tail -f offlineOutput.log

# Check response history  
cat logs/offline-responses.json
```

## 🎯 Test Channels

The offline system monitors these channels:
- `#code-monkey-cage` (736781721386877073)
- `#chillin` (621478676017709057) 
- General (1004547770037833798)
- Another channel (896251538744418324)

## 🔧 Useful Commands

```bash
# Check system status
./bepo-status.sh

# View all logs
npm run logs:all

# Start individual services
npm run start:offline
npm run start:monitor  
npm run start:bot-only

# Stop everything
./stop-bepo.sh

# Reset for fresh test
./stop-bepo.sh && sleep 2 && ./start-bepo.sh
```

## 📋 Quick Verification Checklist

- [ ] Normal bot responses work when online
- [ ] Offline responses appear when bot is down
- [ ] Offline responses mention "offline monitoring system"
- [ ] User cooldown prevents spam (60 seconds)
- [ ] Works in all configured channels
- [ ] No response in non-configured channels
- [ ] Status commands show accurate information
- [ ] Services can be controlled independently

## 🚨 Troubleshooting

**Offline system not responding?**
1. Check bot permissions in Discord channels
2. Verify: `grep BOT_USER_ID .env` 
3. Wait full 2 minutes after stopping bot

**Want detailed testing?**
- See `OFFLINE_MODE_TESTING.md` for comprehensive scenarios

**System not working?**
```bash
npm run validate-offline  # Check configuration
./bepo-status.sh          # Check service status
npm run logs:all          # View all activity
```

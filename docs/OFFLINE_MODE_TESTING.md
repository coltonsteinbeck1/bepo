# Bepo Offline Mode Testing Scenarios

## Prerequisites

Before testing, ensure the following configuration is correct:

### 1. Environment Variables Check
```bash
# Verify these are set in .env:
BOT_TOKEN=<your_bot_token>
BOT_USER_ID=1143334637851136051
OFFLINE_RESPONSE_CHANNELS=736781721386877073,621478676017709057,1004547770037833798,896251538744418324
DISCORD_ALERT_WEBHOOK=https://discord.com/api/webhooks/1389424068649943182/zn7rrl8u_u0Ef47BJ5f0T7bIQKpzC7VicqMIj7WDSVZ7CnYNgrWDoeWueCdU9Fb7JMZO
```

### 2. Channel Access
Ensure Bepo has the following permissions in test channels:
- `View Channel`
- `Send Messages` 
- `Read Message History`
- `Add Reactions`

### 3. Service Status Check
```bash
./bepo-status.sh
```

## Testing Scenarios

### 🟢 Scenario 1: Normal Bot Online Response
**Purpose**: Verify offline system doesn't interfere when bot is running

**Steps**:
1. Start all services: `./start-bepo.sh`
2. Wait 30 seconds for services to initialize
3. In Discord, mention Bepo: `@Bepo hello`
4. **Expected**: Main bot responds normally
5. **Expected**: No offline response (check `offlineOutput.log`)

**Verification**:
```bash
# Check that offline system detected bot is online
tail -20 offlineOutput.log | grep "Bepo is operational"
```

---

### 🔴 Scenario 2: Bot Offline - Basic Mention Response
**Purpose**: Test offline response when bot is completely down

**Steps**:
1. Stop only the main bot: `npm run stop:bot` 
2. Verify offline system is still running: `./bepo-status.sh`
3. Wait 2 minutes for offline system to detect bot is down
4. In Discord, mention Bepo: `@Bepo are you there?`
5. **Expected**: Offline system responds with status message
6. **Expected**: Response includes "offline monitoring system" text

**Verification**:
```bash
# Check offline response was logged
tail -10 logs/offline-responses.json
```

---

### 🔄 Scenario 3: Bot Restart During Offline Period
**Purpose**: Test offline system behavior during bot restart

**Steps**:
1. Start with all services running: `./start-bepo.sh`
2. Kill the bot process: `pkill -f "node.*src/bot.js"`
3. Wait 1 minute
4. Mention Bepo: `@Bepo status check`
5. **Expected**: Offline response
6. Wait for bot to auto-restart (check logs)
7. Mention Bepo again: `@Bepo second test`
8. **Expected**: Normal bot response (no offline response)

**Verification**:
```bash
# Watch restart process
tail -f serverOutput.log | grep "Starting bot"
```

---

### ⏱️ Scenario 4: User Cooldown Testing
**Purpose**: Verify spam prevention works

**Steps**:
1. Ensure bot is offline (Scenario 2 setup)
2. Mention Bepo: `@Bepo test 1`
3. **Expected**: Offline response
4. Immediately mention again: `@Bepo test 2`
5. **Expected**: No response (cooldown active)
6. Wait 61 seconds
7. Mention again: `@Bepo test 3`
8. **Expected**: Offline response (cooldown expired)

**Verification**:
```bash
# Check cooldown logs
tail -20 offlineOutput.log | grep "cooldown"
```

---

### 📺 Scenario 5: Multiple Channel Testing
**Purpose**: Test offline responses work across different channels

**Steps**:
1. Set up bot offline state
2. Test mentions in each configured channel:
   - `#chillin` (621478676017709057)
   - `#code-monkey-cage` (736781721386877073) 
   - `#clips` (1383109705706242150)
   - Any other configured channels
3. **Expected**: Offline responses in all configured channels
4. Test mention in non-configured channel
5. **Expected**: No response in non-configured channel

---

### 🚨 Scenario 6: Webhook Fallback Testing
**Purpose**: Test webhook fallback when direct response fails

**Steps**:
1. Temporarily remove Bepo's `Send Messages` permission in test channel
2. Ensure bot is offline
3. Mention Bepo: `@Bepo permission test`
4. **Expected**: No direct response (permissions blocked)
5. **Expected**: Webhook notification sent to alert channel
6. Restore permissions

**Verification**:
```bash
# Check for webhook fallback logs
tail -20 offlineOutput.log | grep "webhook fallback"
```

---

### 🔧 Scenario 7: Service Management Testing
**Purpose**: Test individual service control

**Steps**:
1. Start all services: `./start-bepo.sh`
2. Stop offline system: `npm run stop:offline`
3. Stop main bot: `npm run stop:bot`
4. Mention Bepo: `@Bepo no offline system`
5. **Expected**: No response at all
6. Start offline system: `npm run start:offline`
7. Wait 30 seconds
8. Mention Bepo: `@Bepo offline system back`
9. **Expected**: Offline response returns

---

### 📊 Scenario 8: Status Commands During Offline
**Purpose**: Test if status information is accurate during offline periods

**Steps**:
1. Set up bot offline state
2. Check status: `./bepo-status.sh`
3. **Expected**: Shows bot as "Not running"
4. **Expected**: Shows offline system as "Running"
5. Mention Bepo in Discord
6. Check logs: `npm run logs:offline`
7. **Expected**: Can see the mention and response activity

---

### 🔄 Scenario 9: Full System Restart Testing
**Purpose**: Test complete system shutdown and restart

**Steps**:
1. Stop everything: `./stop-bepo.sh`
2. Verify no processes: `./bepo-status.sh`
3. Start with offline disabled: `ENABLE_OFFLINE_MODE=false ./start-bepo.sh`
4. Stop main bot: `npm run stop:bot`
5. Mention Bepo: `@Bepo should not respond`
6. **Expected**: No response (offline mode disabled)
7. Stop and restart with offline enabled: `./stop-bepo.sh && ./start-bepo.sh`

---

### 🎯 Scenario 10: Edge Case Testing
**Purpose**: Test various mention formats and edge cases

**Setup**: Bot offline state

**Test various mention formats**:
1. Direct mention: `@Bepo hello`
2. Mention in sentence: `Hey @Bepo what's up?`
3. Multiple mentions: `@Bepo @Bepo double mention`
4. Mention with other users: `@Bepo @SomeUser test`
5. Reply to old Bepo message with mention: `@Bepo replying to old msg`

**Expected**: Offline response for all valid mention formats

---

## Verification Commands

### Real-time Monitoring
```bash
# Watch all logs simultaneously  
npm run logs:all

# Watch just offline system
tail -f offlineOutput.log

# Monitor system status
watch -n 5 './bepo-status.sh'
```

### Post-Test Analysis
```bash
# Check offline response history
cat logs/offline-responses.json | jq '.'

# Count offline responses today
cat logs/offline-responses.json | jq --arg date "$(date +%Y-%m-%d)" 'select(.timestamp | startswith($date))' | wc -l

# Check webhook delivery logs
tail -50 offlineOutput.log | grep webhook
```

### Cleanup Between Tests
```bash
# Clear logs for fresh testing
> serverOutput.log
> monitorOutput.log  
> offlineOutput.log
> logs/offline-responses.json

# Reset system
./stop-bepo.sh && sleep 2 && ./start-bepo.sh
```

## Troubleshooting Common Issues

### Offline System Not Responding
1. Check bot user ID: `grep BOT_USER_ID .env`
2. Verify Discord permissions in test channels
3. Check offline system logs: `tail -20 offlineOutput.log`

### Bot Not Detected as Offline
1. Check status file age: `ls -la logs/bot-status.json`
2. Verify monitor is running: `./bepo-status.sh`
3. Wait full 2 minutes after stopping bot

### Permission Errors
1. Ensure bot has necessary Discord permissions
2. Check webhook URL is valid: `curl -X POST <webhook_url>`
3. Verify channel IDs in .env are correct

## Success Criteria

✅ **All tests pass if**:
- Offline system responds only when main bot is down
- Responses include "offline monitoring system" identifier  
- User cooldown prevents spam (60-second intervals)
- System works across all configured channels
- Webhook fallback activates when needed
- Services can be controlled independently
- Status checking accurately reflects system state
- All mention formats trigger responses appropriately
- System recovers properly after restarts

This comprehensive testing ensures the offline mode system is robust and production-ready.

# Bepo Offline Mode & Health Command Test Cases

## 🎯 **Test Scenario 1: Normal Operation (Bot Online)**

### Setup:
```bash
./start-bepo.sh
# Wait 30 seconds for bot to fully start
./bepo-status.sh  # Verify all services running
```

### Tests:
1. **Health Command (Online)**
   - Run: `/health` in Discord
   - Expected: Beautiful embed showing:
     - 🟢 Status: ONLINE
     - ✅ All systems operational  
     - 📊 Uptime, memory usage
     - 🌐 Discord connection status
     - 📈 Recent activity metrics

2. **Normal Bot Mention (Online)**
   - Type: `@Bepo hello there`
   - Expected: Normal bot response (not offline system)

---

## 🔴 **Test Scenario 2: Bot Offline (Planned Maintenance)**

### Setup:
```bash
./stop-bot-only.sh  # Stop ONLY main bot (keeps monitor & offline running)
# Wait 2+ minutes for offline detection
./bepo-status.sh    # Verify: Bot=OFF, Monitor=ON, Offline=ON
```

### Tests:
1. **Health Command (Offline)**
   - Run: `/health` in Discord
   - Expected: Rich embed showing:
     - 🔴 Status: OFFLINE
     - ⏰ Last seen: [timestamp]
     - 🔧 Reason: Planned maintenance
     - 📞 Contact info for urgent issues
     - 🔄 Expected return time

2. **Bot Mention (Offline Response)**
   - Type: `@Bepo status update please`
   - Expected: Webhook embed with:
     - 🔴 Title: "Bepo is Currently Offline"
     - 📊 Status details
     - 🕐 Last seen timestamp
     - 💡 What to do while waiting
     - 👻 "Automated Response System" footer

3. **Multiple Mentions (Cooldown Test)**
   - Type: `@Bepo test 1`
   - Wait 30 seconds
   - Type: `@Bepo test 2`
   - Expected: First gets response, second is rate-limited

---

## 🔄 **Test Scenario 3: Bot Recovery**

### Setup:
```bash
./start-bot-only.sh  # Restart just the main bot
# Wait 30 seconds for startup
./bepo-status.sh     # Verify all services running
```

### Tests:
1. **Health Command (After Recovery)**
   - Run: `/health` in Discord
   - Expected: Green embed showing recovery:
     - 🟢 Status: ONLINE (Recovered)
     - 📈 Uptime: [short time since restart]
     - ✅ All systems operational
     - 🔄 "Recently recovered" indicator

2. **Bot Mention (After Recovery)**
   - Type: `@Bepo are you back?`
   - Expected: Normal bot response (offline system goes silent)

---

## 🚨 **Test Scenario 4: Complete System Failure**

### Setup:
```bash
./stop-bepo.sh  # Stop EVERYTHING (simulates server crash)
./bepo-status.sh # Verify all services stopped
```

### Tests:
1. **Health Command (Complete Failure)**
   - Run: `/health` in Discord
   - Expected: No response (command not available)

2. **Bot Mention (Complete Failure)**
   - Type: `@Bepo emergency test`
   - Expected: No response (complete outage)

3. **Recovery from Complete Failure**
   - Run: `./start-bepo.sh`
   - Wait 60 seconds
   - Test both health command and mentions

---

## 📱 **Test Scenario 5: Cross-Channel Testing**

### Setup: Bot offline state

### Tests:
1. **Configured Channels (Should Respond)**
   - Test `@Bepo` in each configured channel:
     - Channel ID: `736781721386877073`
     - Channel ID: `621478676017709057`
     - Channel ID: `1004547770037833798`
     - Channel ID: `896251538744418324`
   - Expected: Offline embed response in each

2. **Non-Configured Channels (Should NOT Respond)**
   - Test `@Bepo` in random channel not in config
   - Expected: No response (offline system ignores)

---

## 🕐 **Test Scenario 6: Timing & Thresholds**

### Setup:
```bash
./start-bepo.sh
./stop-bot-only.sh
```

### Tests:
1. **Immediate Mention (0-30 seconds)**
   - Mention `@Bepo` immediately after stopping
   - Expected: No offline response (still within grace period)

2. **Grace Period Mention (30-120 seconds)**
   - Mention `@Bepo` at 1 minute after stopping
   - Expected: No offline response (within 2-minute threshold)

3. **Offline Detection (120+ seconds)**
   - Mention `@Bepo` at 3+ minutes after stopping
   - Expected: Offline embed response

---

## 📊 **Test Scenario 7: Status Accuracy**

### Tests:
1. **Discord Presence Check**
   - When main bot online: Bot shows as 🟢 Online
   - When main bot offline: Bot shows as 🔴 Offline/Invisible
   - Verify no false "online" status from offline system

2. **Health Command vs Reality**
   - Compare `/health` output with actual system status
   - Verify timestamps match log files
   - Check memory/uptime accuracy

---

## 🔧 **Quick Test Commands**

```bash
# Full system test
./validate-offline-setup.js

# Status check
./bepo-status.sh

# Log monitoring
tail -f serverOutput.log monitorOutput.log offlineOutput.log

# Manual status check
node -e "
const { getStatusChecker } = await import('./src/utils/statusChecker.js');
const status = await getStatusChecker().getBotStatus();
console.log(JSON.stringify(status, null, 2));
"
```

---

## ✅ **Expected Results Summary**

| Scenario | Health Command | Bot Mention | Discord Status |
|----------|---------------|-------------|----------------|
| Online | 🟢 Rich embed | Normal response | 🟢 Online |
| Offline | 🔴 Rich embed | Webhook embed | 🔴 Offline |
| Complete Down | No response | No response | 🔴 Offline |
| Recovery | 🟢 Recovery embed | Normal response | 🟢 Online |

---

## 🎯 **Success Criteria**

✅ Health command works in all states  
✅ Offline responses use rich embeds  
✅ Discord status accurately reflects main bot  
✅ Rate limiting prevents spam  
✅ Recovery is seamless  
✅ Configured channels only  
✅ 2-minute threshold respected  

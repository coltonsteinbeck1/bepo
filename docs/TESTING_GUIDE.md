# Bepo Testing Guide

## Complete Test Checklist

### Prerequisites
- Ensure Discord bot token is configured
- Make sure all dependencies are installed: `npm install`
- Verify tmux is available: `which tmux`

## Core System Tests

### 1. Shell Script Integration Test
```bash
# Test the main startup script
./scripts/start-bepo.sh

# Expected: Creates tmux session with 3 windows:
# - Window 0: Bepo-Main (main bot)
# - Window 1: Monitor (health monitoring)  
# - Window 2: Offline-Responder (mention responses)

# Check session is running
tmux list-sessions

# Attach to view logs
tmux attach-session -t bepo-session

# Navigate between windows: Ctrl+B then 0/1/2
```

### 2. NPM Script Integration Test
```bash
# Test status check
npm run status

# Expected: Shows current bot status (likely OFFLINE if not running)

# Test start command (should call shell script)
npm start

# Test stop command (should call shell script)
npm stop
```

### 3. Individual Component Tests
```bash
# Test individual components work
npm run start:bot-only     # Just main bot
npm run start:monitor      # Just health monitor
npm run start:offline      # Just offline responder

# Clean up
npm run stop:all
```

## Gaming Integration Tests

### 1. APEX Command Test
In Discord, test these commands:
```
/apexnotify status                        # Check monitoring status
/apexnotify setchannel #your-test-channel # Set notification channel
/apexnotify start                         # Start monitoring
/maprotation                              # Test map rotation command
```

### 2. CS2 Command Test
```
/cs2                                      # Test CS2 updates
/cs2prices <skin_name>                    # Test skin price lookup
```

## Offline Mode Tests

### 1. Offline Response Test
```bash
# Scenario 1: Bot healthy and running
npm run start:bot-only
# In Discord: Mention @YourBot
# Expected: Normal response from main bot

# Scenario 2: Bot completely offline
npm run stop:bot
npm run start:offline
# In Discord: Mention @YourBot
# Expected: Offline monitor responds with status
```

### 2. Health Status Test
```bash
# Check different health scenarios
npm run test-scenarios

# Expected output:
# - Bepo Process Stopped (OFFLINE)
# - Bepo Not Responding (OFFLINE)  
# - Bepo Online (ONLINE)
```

### 3. Full System Test
```bash
# Start everything
npm start

# Check all components are running
npm run status

# Test offline detection
# Stop main bot while keeping monitor running
npm run stop:bot
# In Discord: Mention @YourBot
# Expected: Offline monitor detects and responds

# Restart everything
npm restart
```

## Monitoring Tests

### 1. Log File Tests
```bash
# Start system
npm start

# Check log files are being created
ls -la logs/
tail -f serverOutput.log
tail -f logs/monitor.log
tail -f logs/offline-responses.log

# Expected: Logs showing bot activity, health checks, offline monitoring
```

### 2. Status File Tests
```bash
# Check status files are being updated
cat logs/bot-status.json
cat logs/bot-status-monitor.json

# Expected: JSON files with current bot status and timestamps
```

### 3. Health Monitoring Tests
```bash
# Check health endpoint
npm run status

# Monitor health logs in real-time
npm run logs

## Unit Testing

### Run Test Suite
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit                         # Unit tests only
npm run test:integration                  # Integration tests only

# Run tests with coverage
npm run test:coverage
```

### Test Coverage Areas
- Memory utilities (memoryUtils.js)
- Apex utilities (apexUtils.js)
- CS2 utilities (cs2Utils.js)
- Command loading and validation
- Error handling functions
- Bot initialization

## Troubleshooting Tests

### 1. Process Management Test
```bash
# Check all processes are properly managed
ps aux | grep -E "(bot\.js|bot-monitor|offline-response)"

# Start system
npm start

# Check processes are running
ps aux | grep -E "(bot\.js|bot-monitor|offline-response)"

# Stop system
npm stop

# Verify all processes stopped
ps aux | grep -E "(bot\.js|bot-monitor|offline-response)"
```

### 2. Recovery Test
```bash
# Start system
npm start

# Kill one component manually
pkill -f "bot-monitor"

# Check if system detects the failure
npm run status

# Test restart
npm restart

# Verify all components are back
npm run status
```

### 3. Error Handling Test
```bash
# Test with invalid configuration
# (Temporarily rename .env file)
mv .env .env.backup

# Try to start
npm start

# Expected: Graceful error messages, no hanging processes

# Restore configuration
mv .env.backup .env
```

## Success Criteria

### Shell Scripts Working
- npm start launches tmux session with 3 windows
- All components start in proper order (bot → monitor → offline)
- npm stop cleanly shuts down all processes
- No orphaned processes after stop

### Gaming Integration Working
- /apexnotify commands work properly
- Can set notification channel
- Can start/stop monitoring
- /maprotation shows current maps
- /cs2 and /cs2prices work correctly

### Offline Mode Working
- Offline monitor detects when main bot is down
- Responds to mentions with appropriate status
- Health checks work continuously
- Status files are updated regularly

### Integration Working
- All npm scripts work correctly
- Shell scripts integrate with npm scripts
- Logs are properly separated and readable
- Status checking works in all scenarios

## Common Issues & Solutions

### Issue: Tmux session already exists
```bash
# Solution: Stop existing session first
./scripts/stop-bepo.sh
./scripts/start-bepo.sh
```

### Issue: Processes not stopping cleanly
```bash
# Solution: Force kill all
npm run stop:all
pkill -f "node.*bepo"
```

### Issue: Discord token errors
```bash
# Solution: Check .env file
cat .env | grep BOT_TOKEN
# Ensure token is valid and has proper permissions
```

### Issue: Offline monitor not responding
```bash
# Solution: Check it's monitoring the right channels
npm run setup-offline-responses
# Verify bot has permissions in target channels
```

### Issue: Tests failing
```bash
# Solution: Check test environment
npm install                               # Reinstall dependencies
npm run test:unit                         # Run unit tests only
```

For additional troubleshooting, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

### 1. Process Management Test
```bash
# Check all processes are properly managed
ps aux | grep -E "(bot\.js|bot-monitor|offline-response)"

# Start system
npm start

# Check processes are running
ps aux | grep -E "(bot\.js|bot-monitor|offline-response)"

# Stop system
npm stop

# Verify all processes stopped
ps aux | grep -E "(bot\.js|bot-monitor|offline-response)"
```

### 2. Recovery Test
```bash
# Start system
npm start

# Kill one component manually
pkill -f "bot-monitor"

# Check if system detects the failure
npm run status

# Test restart
npm restart

# Verify all components are back
npm run status
```

### 3. Error Handling Test
```bash
# Test with invalid configuration
# (Temporarily rename .env file)
mv .env .env.backup

# Try to start
npm start

# Expected: Graceful error messages, no hanging processes

# Restore configuration
mv .env.backup .env
```

---

## ✅ Success Criteria

### Shell Scripts Working
- [✅] `npm start` launches tmux session with 3 windows
- [✅] All components start in proper order (bot → monitor → offline)
- [✅] `npm stop` cleanly shuts down all processes
- [✅] No orphaned processes after stop

### APEX Mode Working
- [✅] `/apexnotify` commands work properly
- [✅] Can set notification channel
- [✅] Can start/stop monitoring
- [✅] `/maprotation` shows current maps

### OFFLINE Mode Working
- [✅] Offline monitor detects when main bot is down
- [✅] Responds to mentions with appropriate status
- [✅] Health checks work continuously
- [✅] Status files are updated regularly

### Integration Working
- [✅] All npm scripts work correctly
- [✅] Shell scripts integrate with npm scripts
- [✅] Logs are properly separated and readable
- [✅] Status checking works in all scenarios

---

## 🚨 Known Issues & Solutions

### Issue: Tmux session already exists
```bash
# Solution: Stop existing session first
./stop-bepo.sh
./start-bepo.sh
```

### Issue: Processes not stopping cleanly
```bash
# Solution: Force kill all
npm run stop:all
pkill -f "node.*bepo"
```

### Issue: Discord token errors
```bash
# Solution: Check .env file
cat .env | grep BOT_TOKEN
# Ensure token is valid and has proper permissions
```

### Issue: Offline monitor not responding
```bash
# Solution: Check it's monitoring the right channels
npm run setup-offline-responses
# Verify bot has permissions in target channels
```

---

*All tests passed? Your Bepo setup is ready for production! 🎉*

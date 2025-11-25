# Operations Guide

Quick reference for common operational tasks and troubleshooting.

## 🚀 Daily Operations

### Starting the Bot

```bash
# Production start (all services)
npm run start:quick

# Development mode (bot only, no tests)
npm run dev

# Individual services
npm run start:bot-only
npm run start:monitor
npm run start:offline
```

### Stopping the Bot

```bash
# Stop everything
npm run stop

# Stop specific service
npm run stop:bot
npm run stop:monitor
npm run stop:offline
```

### Checking Status

```bash
# Live health dashboard (refreshes every 5s)
npm run health

# Quick status check
npm run status

# Detailed status
npm run status:detailed
```

## 📊 Monitoring & Logs

### Viewing Logs

```bash
# List all available logs
npm run logs

# Live tail (follow mode)
npm run logs:bot          # Main bot
npm run logs:monitor      # Monitor service
npm run logs:offline      # Offline responses
npm run logs:all          # All logs simultaneously

# Advanced log viewing
npm run logs:follow serverOutput.log     # Live updates
npm run logs:tail serverOutput.log 100   # Last 100 lines
npm run logs:search "error"              # Search all logs
npm run logs:stats                       # Statistics
```

### Log Management

```bash
# Archive old logs (default: 7 days)
npm run logs:archive

# Cleanup very old logs (default: 30 days)
npm run logs:cleanup

# Rotate large logs (compress and archive)
npm run logs:rotate
```

## 🔧 Troubleshooting

### Bot is Not Responding

1. Check if bot is running:
   ```bash
   npm run status
   ```

2. Check recent errors:
   ```bash
   npm run logs:search "error"
   ```

3. View live logs:
   ```bash
   npm run logs:bot
   ```

4. Restart the bot:
   ```bash
   npm run restart
   ```

### High Error Rate

1. View health dashboard:
   ```bash
   npm run health
   ```

2. Search for specific errors:
   ```bash
   npm run logs:search "Discord API"
   npm run logs:search "rate limit"
   npm run logs:search "timeout"
   ```

3. Check log statistics:
   ```bash
   npm run logs:stats
   ```

### Memory Issues

1. Check process status:
   ```bash
   npm run status:detailed
   ```

2. View recent errors:
   ```bash
   npm run logs:search "memory\|heap"
   ```

3. Restart services:
   ```bash
   npm run restart
   ```

4. Clean up old data:
   ```bash
   npm run cleanup:dry    # Preview
   npm run cleanup        # Execute
   ```

### Service Won't Start

1. Check if port is in use:
   ```bash
   lsof -i :3000  # Or your port
   ```

2. Kill stale processes:
   ```bash
   npm run stop:all
   ```

3. Check environment:
   ```bash
   cat .env | grep -v "^#" | grep -v "^$"
   ```

4. Validate configuration:
   ```bash
   npm run validate-offline
   ```

## 🧹 Maintenance

### Regular Maintenance (Weekly)

```bash
# 1. Archive old logs
npm run logs:archive

# 2. Clean up repository
npm run cleanup:dry    # Preview first
npm run cleanup

# 3. Check health
npm run health:once

# 4. Review error logs
npm run logs:search "CRITICAL"
```

### Deep Clean (Monthly)

```bash
# 1. Stop all services
npm run stop

# 2. Clean up old logs (30+ days)
npm run logs:cleanup 30

# 3. Clean repository
npm run cleanup:force

# 4. Rotate all logs
npm run logs:rotate

# 5. Restart services
npm run start:quick

# 6. Verify health
npm run health:once
```

### Before Deploying Changes

```bash
# 1. Run tests
npm run test

# 2. Check status
npm run status

# 3. Stop services
npm run stop

# 4. Deploy changes (git pull, etc.)

# 5. Install dependencies if package.json changed
npm install

# 6. Deploy commands if needed
npm run deploy

# 7. Start services
npm run start:quick

# 8. Monitor for issues
npm run health
```

## 📈 Performance Monitoring

### Real-time Monitoring

```bash
# Health dashboard (auto-refresh)
npm run health

# Live log monitoring
npm run logs:follow serverOutput.log
```

### Historical Analysis

```bash
# Log statistics
npm run logs:stats

# Search for patterns
npm run logs:search "slow response"
npm run logs:search "timeout"
npm run logs:search "rate limit"
```

## 🔐 Security

### Checking for Exposed Secrets

```bash
# Verify .env is not committed
git status

# Check for accidental secret commits
git log -p | grep -i "api_key\|token\|secret"
```

### Rotating Credentials

1. Update `.env` with new credentials
2. Restart bot: `npm run restart`
3. Verify: `npm run health:once`
4. Test commands in Discord

## 📊 Metrics & Analytics

### Current Status

```bash
# Single snapshot
npm run health:once

# Detailed report
npm run status:detailed
```

### Log Analysis

```bash
# Overall statistics
npm run logs:stats

# Error frequency
npm run logs:search "ERROR"

# Warning frequency
npm run logs:search "WARN"
```

## 🆘 Emergency Procedures

### Bot is Completely Down

```bash
# 1. Force stop everything
npm run stop:all

# 2. Check for zombie processes
ps aux | grep node

# 3. Kill if necessary
pkill -9 -f "node.*src/bot.js"

# 4. Clear any locks
rm -f /tmp/bepo-*.lock

# 5. Start fresh
npm run start:quick

# 6. Monitor closely
npm run health
```

### Database Connection Issues

```bash
# 1. Check environment
echo $SUPABASE_URL
echo $SUPABASE_KEY

# 2. Test connection
npm run test:integration

# 3. Check logs
npm run logs:search "supabase\|database"
```

### Discord API Issues

```bash
# 1. Check Discord status
# Visit: https://discordstatus.com

# 2. Check rate limits
npm run logs:search "rate limit"

# 3. Verify token
# Visit: https://discord.com/developers/applications
```

## 📞 Getting Help

### Information to Gather

Before asking for help, collect:

```bash
# 1. System status
npm run status:detailed > status.txt

# 2. Recent errors
npm run logs:search "ERROR" > errors.txt

# 3. Log statistics
npm run logs:stats > stats.txt

# 4. Configuration (without secrets)
cat .env | sed 's/=.*/=***/' > config.txt
```

### Common Issues & Solutions

| Issue | Command | Solution |
|-------|---------|----------|
| Bot offline | `npm run health` | Check Discord status, verify token |
| High memory | `npm run cleanup` | Clean old logs, restart services |
| Slow responses | `npm run logs:stats` | Check for errors, restart |
| Commands not working | `npm run deploy` | Redeploy slash commands |
| Logs filling disk | `npm run logs:rotate` | Rotate and compress logs |

## 🎯 Quick Command Reference

```bash
# Start/Stop
npm run start:quick     # Start all
npm run stop           # Stop all
npm run restart        # Restart all

# Status
npm run health         # Live dashboard
npm run status         # Quick check

# Logs
npm run logs           # List logs
npm run logs:bot       # View bot logs
npm run logs:search    # Search logs

# Maintenance
npm run cleanup        # Clean repository
npm run logs:rotate    # Rotate logs
npm run logs:archive   # Archive old logs
```

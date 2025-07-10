# Troubleshooting Guide

## Quick Diagnostics

### Check Bot Status
```bash
npm run status           # Overall health check
./bepo-status.sh         # Detailed system status
```

### Common Issues

#### Bot Won't Start
1. **Check Environment Variables**
   ```bash
   # Verify required variables are set
   echo $DISCORD_TOKEN
   echo $SUPABASE_URL
   echo $SUPABASE_KEY
   ```

2. **Check Dependencies**
   ```bash
   npm install              # Reinstall dependencies
   node --version          # Ensure Node.js 18+
   ```

3. **Check Ports**
   ```bash
   lsof -i :3000           # Check if port is in use
   ```

#### Bot Goes Offline Unexpectedly

**Memory Issues:**
- Check memory usage: `ps aux | grep node`
- Restart if memory > 1GB: `npm restart`

**Database Connection:**
- Test connection: `node scripts/check-bot-status.js`
- Check Supabase status at status.supabase.com

**Rate Limiting:**
- Check Discord rate limit headers in logs
- Wait 10-15 minutes before restarting

#### Commands Not Working

**Slash Commands:**
1. Re-deploy commands: `node scripts/deploy-commands.js`
2. Check bot permissions in Discord server settings
3. Verify bot has "applications.commands" scope

**Memory Commands:**
- Check database connection
- Verify user permissions
- Clear expired memories: `/memory clear type:temporary`

#### Gaming Notifications Not Working

**CS2 Notifications:**
1. Verify webhook URL: `node scripts/verify-cs2-configuration.js`
2. Check channel permissions
3. Test manually: `node scripts/simulate-cs2-notification.js`

**Apex Notifications:**
1. Test setup: `node scripts/setup-apex-channel-and-test.js`
2. Check API limits
3. Verify webhook configuration

## Error Messages

### Database Errors
```
Error: connect ECONNREFUSED
```
**Solution:** Check Supabase connection and credentials

```
Error: password authentication failed
```
**Solution:** Verify SUPABASE_KEY environment variable

### Discord Errors
```
DiscordAPIError[50013]: Missing Permissions
```
**Solution:** Check bot role permissions in server settings

```
DiscordAPIError[50001]: Missing Access
```
**Solution:** Ensure bot is in the target channel/server

### Memory System Errors
```
Memory limit exceeded
```
**Solution:** Clear old memories or increase limits

```
Invalid context type
```
**Solution:** Use valid types: conversation, preference, summary, temporary

## Offline Mode Issues

### Webhook Responses Not Working
1. **Check Webhook Configuration**
   ```bash
   node scripts/setup-offline-responses.js
   ```

2. **Test Webhook Manually**
   ```bash
   node scripts/test-offline-notifications.js
   ```

3. **Verify Monitor is Running**
   ```bash
   ps aux | grep monitor
   ```

### Monitor Not Detecting Offline Status
1. **Check Monitor Logs**
   ```bash
   tail -f logs/monitor.log
   ```

2. **Restart Monitor**
   ```bash
   npm run start:monitor
   ```

## Performance Issues

### High Memory Usage
1. **Clear Memory Cache**
   ```bash
   /memory clear type:temporary
   ```

2. **Restart Services**
   ```bash
   npm restart
   ```

### Slow Response Times
1. **Check Database Performance**
   - Review Supabase dashboard
   - Check for slow queries

2. **Monitor API Limits**
   - Discord: 50 requests per second
   - OpenAI: Check usage dashboard

3. **Clear Old Data**
   ```bash
   node scripts/cleanup-old-data.js
   ```

## Development Issues

### Test Failures
1. **Unit Tests**
   ```bash
   npm test                 # Run all tests
   npm run test:unit        # Unit tests only
   ```

2. **Integration Tests**
   ```bash
   npm run test:integration
   ```

3. **Manual Testing**
   ```bash
   node test-error-handling.js
   ```

### Import/Export Errors
```bash
node debug-imports.js    # Check module resolution
```

## Monitoring Commands

### Health Check Commands
```bash
/health                  # Bot health status
/debug-memory [user]     # Memory debugging (admin)
/test-errors [type]      # Test error handling
```

### Log Files
- `logs/monitor.log` - Health monitor logs
- `logs/bot-status.json` - Current bot status
- `logs/critical-errors-YYYY-MM-DD.json` - Error tracking

## Getting Help

### Log Collection
Before reporting issues, collect:
1. Error messages from console
2. Relevant log files from `logs/` directory
3. Bot status: `npm run status`
4. Environment: Node version, OS, Discord server details

### Debug Mode
Enable verbose logging:
```bash
DEBUG=bepo:* npm start
```

### Reset Everything
Complete reset (development only):
```bash
npm run stop
rm -rf logs/*
npm run start
node scripts/deploy-commands.js
```

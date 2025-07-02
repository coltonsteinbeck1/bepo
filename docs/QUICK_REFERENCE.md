# Bepo Quick Reference

## 🚀 Essential Commands

```bash
# Main Operations
npm start                    # Start all services (uses ./start-bepo.sh)
npm stop                     # Stop all services (uses ./stop-bepo.sh)  
npm restart                  # Restart everything
npm run status               # Check bot health

# Testing
npm run test-scenarios       # Test offline/online modes
npm run test-notifications  # Test notification system

# Individual Components  
npm run start:bot-only       # Just main bot
npm run start:monitor        # Just health monitor
npm run start:offline        # Just offline responder

# Monitoring
npm run logs                 # Monitor activity
tail -f serverOutput.log     # Main bot logs
tail -f logs/monitor.log     # Health monitor logs
```

## 🎮 APEX Mode Setup

```
/apexnotify setchannel #channel    # Set notification channel
/apexnotify start                  # Start monitoring  
/apexnotify status                 # Check status
/maprotation                       # Current map rotation
```

## 🛡️ OFFLINE Mode

- **Automatic**: Offline monitor runs when you start Bepo
- **Detection**: Responds to mentions when main bot is down
- **Status**: Uses health files to determine bot state
- **Alerts**: Optional webhook notifications for admins

## 📊 System Layout

```
tmux session "bepo-session"
├── Window 0: Bepo-Main (main bot)
├── Window 1: Monitor (health tracking)  
└── Window 2: Offline-Responder (mention handling)
```

## 🔧 Troubleshooting

```bash
# Check processes
ps aux | grep -E "(bot\.js|monitor|offline)"

# View logs
tail -f serverOutput.log
tail -f logs/monitor.log  

# Force stop
npm run stop:all

# Clean restart
./stop-bepo.sh && ./start-bepo.sh
```

## 📚 Documentation

- **[BEPO_GUIDE.md](./BEPO_GUIDE.md)**: Main user guide
- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)**: Test scenarios  
- **[README.md](./README.md)**: Full documentation

---

*Keep this handy for daily operations! 📌*

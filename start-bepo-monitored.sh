#!/bin/bash
# Enhanced Bot Startup Script with monitoring

echo "🚀 Starting Bot with Enhanced Monitoring..."

# Ensure logs directory exists
mkdir -p logs

# Check if bot is already running
if pgrep -f "src/index.js" > /dev/null; then
    echo "⚠️  Bot process already running!"
    echo "   Use './stop-bepo.sh' to stop it first"
    exit 1
fi

# Start the bot monitor in background (if not already running)
if ! pgrep -f "bot-monitor.js" > /dev/null; then
    echo "🔍 Starting bot monitor..."
    nohup node scripts/bot-monitor.js > logs/monitor.log 2>&1 &
    MONITOR_PID=$!
    echo "   Monitor started with PID: $MONITOR_PID"
    sleep 2
else
    echo "🔍 Bot monitor already running"
fi

# Start the main bot
echo "🤖 Starting main bot process..."
node src/index.js

echo "🛑 Bot stopped"

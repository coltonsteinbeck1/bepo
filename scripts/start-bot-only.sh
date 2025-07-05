#!/bin/bash

# Load centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/bepo-config.sh"

# Backward compatibility - use config variables
SESSION_NAME="$BEPO_SESSION_NAME"
LOG_FILE="$BEPO_BOT_LOG"

print_status $COLOR_CYAN "🤖 Starting ONLY the main bot (assuming monitor & offline are running)..."

# Check if session exists
if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    print_status $COLOR_RED "❌ No tmux session found. Use ./start-bepo.sh to start the full system."
    exit 1
fi

# Get list of windows in the session
WINDOWS=$(tmux list-windows -t $SESSION_NAME -F "#{window_name}" 2>/dev/null || echo "")

print_status $COLOR_CYAN "📋 Session windows: $WINDOWS"

# Check if bot window exists and if bot is already running
if echo "$WINDOWS" | grep -q "$BEPO_BOT_WINDOW"; then
    BOT_PIDS=$(get_bepo_pids "bot")
    if [ -n "$BOT_PIDS" ]; then
        print_status $COLOR_YELLOW "⚠️  Bot appears to already be running (PID: $BOT_PIDS)"
        echo "   Use './stop-bot-only.sh' first if you want to restart it."
        exit 1
    fi
    
    print_status $COLOR_CYAN "🤖 Starting bot in existing window..."
    
    # Clear the window and start bot
    tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW C-c 2>/dev/null || true
    sleep 1
    tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "clear" Enter
    tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "echo 'Starting Bepo bot...' && npm run start" Enter
    
else
    print_status $COLOR_YELLOW "⚠️  Bot window not found. Creating new bot window..."
    
    # Create bot window and start bot
    tmux new-window -t $SESSION_NAME -n $BEPO_BOT_WINDOW
    tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "cd $(pwd)" Enter
    tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "echo 'Starting Bepo bot...' && npm run start" Enter
fi

print_status $COLOR_GREEN "✅ Bot startup initiated!" | tee -a $LOG_FILE

echo ""
print_status $COLOR_CYAN "⏱️  Bot is starting up... This may take a few moments."
print_status $COLOR_CYAN "📋 Use these commands to monitor:"
echo "  Status:           ./bepo-status.sh"
echo "  Bot logs:         tail -f $LOG_FILE"
echo "  Attach to bot:    tmux attach-session -t $SESSION_NAME -c $BEPO_BOT_WINDOW"
echo "  List windows:     tmux list-windows -t $SESSION_NAME"

echo ""
print_status $COLOR_CYAN "💡 The bot should be online in Discord within 30 seconds."

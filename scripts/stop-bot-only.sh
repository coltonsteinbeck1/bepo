#!/bin/bash

# Load centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/bepo-config.sh"

# Ensure we're in the project root
cd "$BEPO_ROOT" || {
    echo "ERROR: Could not change to project root: $BEPO_ROOT"
    exit 1
}

# Backward compatibility - use config variables
SESSION_NAME="$BEPO_SESSION_NAME"
LOG_FILE="$BEPO_BOT_LOG"

print_status $COLOR_YELLOW "🛑 Stopping ONLY the main bot (keeping monitor & offline systems running)..."

# Check if session exists
if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    print_status $COLOR_RED "No session named $SESSION_NAME found."
    echo ""
    print_status $COLOR_CYAN "Checking for bot processes..."
    
    # Check for bot processes only
    BOT_PIDS=$(get_bepo_pids "bot")
    
    if [ -n "$BOT_PIDS" ]; then
        print_status $COLOR_YELLOW "Found running bot processes. Stopping them..."
        kill $BOT_PIDS 2>/dev/null || true
        sleep 2
        print_status $COLOR_GREEN "Bot processes stopped."
    else
        print_status $COLOR_GREEN "No bot processes found."
    fi
    exit 0
fi

# Get list of windows in the session
WINDOWS=$(tmux list-windows -t $SESSION_NAME -F "#{window_name}" 2>/dev/null || echo "")

print_status $COLOR_CYAN "Session windows: $WINDOWS"

# Stop ONLY the main bot
if echo "$WINDOWS" | grep -q "$BEPO_BOT_WINDOW"; then
    print_status $COLOR_YELLOW "🛑 Stopping main bot (keeping monitor & offline systems)..."
    tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW C-c 2>/dev/null || true
    sleep 3
    
    # Also kill any remaining bot processes specifically
    BOT_PIDS=$(get_bepo_pids "bot")
    if [ -n "$BOT_PIDS" ]; then
        print_status $COLOR_YELLOW "🧹 Cleaning up remaining bot processes..."
        kill $BOT_PIDS 2>/dev/null || true
        sleep 1
    fi
    
    print_status $COLOR_GREEN "Main bot stopped."
else
    print_status $COLOR_YELLOW "Bot window not found in session."
fi

echo ""
print_status $COLOR_GREEN "Bot stopped successfully!" | tee -a $LOG_FILE
print_status $COLOR_CYAN "Monitor and offline response systems are STILL RUNNING"
print_status $COLOR_CYAN "Mention @Bepo in Discord to test offline responses"
echo ""
print_status $COLOR_CYAN "Current system status:"

# Show current status
./scripts/bepo-status.sh --quiet 2>/dev/null || echo "  (Run ./scripts/bepo-status.sh for detailed status)"

echo ""
print_status $COLOR_CYAN "Management commands:"
echo "  Start bot only:     ./start-bot-only.sh"
echo "  Start full system:  ./start-bepo.sh"
echo "  Stop everything:    ./stop-bepo.sh"
echo "  Check status:       ./scripts/bepo-status.sh"

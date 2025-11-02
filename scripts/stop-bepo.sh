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
MONITOR_LOG_FILE="$BEPO_MONITOR_LOG"
OFFLINE_LOG_FILE="$BEPO_OFFLINE_LOG"

# Check if session exists
if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    print_status $COLOR_YELLOW "No session named $SESSION_NAME found."
    echo ""
    print_status $COLOR_CYAN "Checking for any remaining processes..."
    
    # Check for any remaining processes
    BOT_PIDS=$(get_bepo_pids "bot")
    MONITOR_PIDS=$(get_bepo_pids "monitor")
    OFFLINE_PIDS=$(get_bepo_pids "offline")
    
    if [ -n "$BOT_PIDS" ] || [ -n "$MONITOR_PIDS" ] || [ -n "$OFFLINE_PIDS" ]; then
        print_status $COLOR_YELLOW "Found running Bepo processes. Cleaning up..."
        [ -n "$BOT_PIDS" ] && print_status $COLOR_YELLOW "  Stopping bot processes: $BOT_PIDS" && kill $BOT_PIDS 2>/dev/null || true
        [ -n "$MONITOR_PIDS" ] && print_status $COLOR_YELLOW "  Stopping monitor processes: $MONITOR_PIDS" && kill $MONITOR_PIDS 2>/dev/null || true
        [ -n "$OFFLINE_PIDS" ] && print_status $COLOR_YELLOW "  Stopping offline processes: $OFFLINE_PIDS" && kill $OFFLINE_PIDS 2>/dev/null || true
        sleep 2
        print_status $COLOR_GREEN "Process cleanup completed."
    else
        print_status $COLOR_GREEN "No Bepo processes found."
    fi
    
    # Continue to cleanup status files even when no session exists
    # Don't exit here - let the script continue to clean status files
fi

print_status $COLOR_RED "Stopping Bepo services..." | tee -a $LOG_FILE

# Get list of windows in the session
WINDOWS=$(tmux list-windows -t $SESSION_NAME -F "#{window_name}" 2>/dev/null || echo "")

print_status $COLOR_CYAN "Found windows: $WINDOWS"

# Stop services gracefully in reverse order (bot last)
if echo "$WINDOWS" | grep -q "$BEPO_OFFLINE_WINDOW"; then
    print_status $COLOR_YELLOW "Stopping offline response system..."
    tmux send-keys -t $SESSION_NAME:$BEPO_OFFLINE_WINDOW C-c 2>/dev/null || true
    sleep 2
fi

if echo "$WINDOWS" | grep -q "$BEPO_MONITOR_WINDOW"; then
    print_status $COLOR_YELLOW "Stopping bot monitor..."
    tmux send-keys -t $SESSION_NAME:$BEPO_MONITOR_WINDOW C-c 2>/dev/null || true
    sleep 2
fi

if echo "$WINDOWS" | grep -q "$BEPO_BOT_WINDOW"; then
    print_status $COLOR_YELLOW "Stopping main bot..."
    
    # First, try to find the bot process and send SIGTERM directly
    BOT_PIDS=$(get_bepo_pids "bot")
    if [ -n "$BOT_PIDS" ]; then
        print_status $COLOR_YELLOW "  Sending SIGTERM to bot process(es): $BOT_PIDS"
        for pid in $BOT_PIDS; do
            kill -TERM $pid 2>/dev/null || true
        done
        sleep 3
        
        # Check if processes are still running
        BOT_PIDS=$(get_bepo_pids "bot")
        if [ -n "$BOT_PIDS" ]; then
            print_status $COLOR_YELLOW "  Bot still running, sending SIGINT via tmux..."
            tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW C-c 2>/dev/null || true
            sleep 3
            
            # Final check and force kill if still running
            BOT_PIDS=$(get_bepo_pids "bot")
            if [ -n "$BOT_PIDS" ]; then
                print_status $COLOR_YELLOW "  Force killing bot processes..."
                for pid in $BOT_PIDS; do
                    kill -KILL $pid 2>/dev/null || true
                done
            fi
        fi
    else
        # No process found, just send C-c to tmux window
        tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW C-c 2>/dev/null || true
        sleep 2
    fi
fi

# Force kill any remaining processes
print_status $COLOR_CYAN "Cleaning up any remaining processes..."

# Force kill any remaining processes
print_status $COLOR_CYAN "Cleaning up any remaining processes..."

# Kill any remaining node processes related to Bepo using our config patterns
pkill -f "$BOT_PROCESS_PATTERN" 2>/dev/null || true
pkill -f "$MONITOR_PROCESS_PATTERN" 2>/dev/null || true  
pkill -f "$OFFLINE_PROCESS_PATTERN" 2>/dev/null || true

sleep 1

# Kill the tmux session
print_status $COLOR_YELLOW "Terminating tmux session..."
tmux kill-session -t $SESSION_NAME 2>/dev/null || true

echo ""
print_status $COLOR_GREEN "Session $SESSION_NAME has been terminated." | tee -a $LOG_FILE
echo ""
print_status $COLOR_CYAN "Final status check..."

# Verify no processes remain
BOT_PIDS=$(get_bepo_pids "bot")
MONITOR_PIDS=$(get_bepo_pids "monitor")
OFFLINE_PIDS=$(get_bepo_pids "offline")

if [ -n "$BOT_PIDS" ] || [ -n "$MONITOR_PIDS" ] || [ -n "$OFFLINE_PIDS" ]; then
    print_status $COLOR_YELLOW "Warning: Some processes may still be running:"
    [ -n "$BOT_PIDS" ] && echo "  Bot processes: $BOT_PIDS"
    [ -n "$MONITOR_PIDS" ] && echo "  Monitor processes: $MONITOR_PIDS" 
    [ -n "$OFFLINE_PIDS" ] && echo "  Offline processes: $OFFLINE_PIDS"
    echo "  Use 'npm run stop:all' to force kill all processes"
else
    print_status $COLOR_GREEN "All Bepo processes stopped successfully."
fi

echo ""
print_status $COLOR_CYAN "Log files preserved:"
echo "  Bot logs: $LOG_FILE"
echo "  Monitor logs: $MONITOR_LOG_FILE"  
echo "  Offline logs: $OFFLINE_LOG_FILE"

# Update status files to show offline (preserve last seen time)
echo ""
print_status $COLOR_CYAN "Updating status files..."

# Wait a moment to ensure any final status writes are complete
sleep 1

if [ -f "logs/bot-status.json" ]; then
    # Preserve the existing status but mark as offline
    if command -v jq >/dev/null 2>&1; then
        # Use jq to update status while preserving other data
        TEMP_STATUS=$(mktemp)
        jq '.botStatus.isOnline = false | .botStatus.status = "OFFLINE" | .lastUpdated = now | .botStatus.startTime = null | .discord.connected = false | .system.pid = null' logs/bot-status.json > "$TEMP_STATUS" 2>/dev/null && mv "$TEMP_STATUS" logs/bot-status.json || rm -f "$TEMP_STATUS"
        print_status $COLOR_GREEN "Bot status updated to offline (preserved last seen)"
    else
        # Fallback: create a basic offline status with current time as last seen
        cat > logs/bot-status.json << EOF
{
  "botStatus": {
    "isOnline": false,
    "status": "OFFLINE", 
    "lastSeen": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
    "uptime": 0,
    "startTime": null
  },
  "health": {
    "healthy": false,
    "errorCount": 0,
    "criticalErrorCount": 0,
    "memoryUsage": {
      "used": 0,
      "total": 0
    },
    "lastHealthCheck": null,
    "lastCriticalError": null
  },
  "discord": {
    "connected": false,
    "ping": null,
    "guilds": 0,
    "users": 0
  },
  "system": {
    "platform": "$(uname -s | tr '[:upper:]' '[:lower:]')",
    "nodeVersion": "$(node -v 2>/dev/null || echo 'unknown')",
    "pid": null
  },
  "lastUpdated": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")"
}
EOF
        print_status $COLOR_GREEN "Bot status file updated to offline"
    fi
else
    print_status $COLOR_YELLOW "Bot status file not found"
fi

# Also clear any other status files that might exist
if [ -f "logs/bot-status-monitor.json" ]; then
    echo '{"status": "offline", "lastCheck": null}' > logs/bot-status-monitor.json
    print_status $COLOR_GREEN "Monitor status file cleared"
fi

echo ""
print_status $COLOR_GREEN "To restart: ./start-bepo.sh"
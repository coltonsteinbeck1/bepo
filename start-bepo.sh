#!/bin/bash

# Load centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/bepo-config.sh"

# Backward compatibility - use config variables
SESSION_NAME="$BEPO_SESSION_NAME"
LOG_FILE="$BEPO_BOT_LOG"
MONITOR_LOG_FILE="$BEPO_MONITOR_LOG"
OFFLINE_LOG_FILE="$BEPO_OFFLINE_LOG"

# Function to handle cleanup on script exit
cleanup() {
    print_status $COLOR_YELLOW "🧹 Cleaning up..."
    exit 0
}
trap cleanup SIGINT SIGTERM

# Setup log directories
setup_log_directories

# Show configuration
print_status $COLOR_PURPLE "🚀 Starting Bepo System"
print_status $COLOR_PURPLE "======================"
show_configuration

# Check if session already exists
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    print_status $COLOR_YELLOW "⚠️  Session $SESSION_NAME already exists."
    echo ""
    echo "🔗 To attach: tmux attach-session -t $SESSION_NAME"
    echo "🔄 To restart: tmux kill-session -t $SESSION_NAME && $0"
    echo ""
    echo "📋 Current windows in session:"
    tmux list-windows -t $SESSION_NAME 2>/dev/null || echo "  (Unable to list windows)"
    echo ""
    show_service_status
    exit 0
fi

# Create new tmux session with multiple windows
print_status $COLOR_CYAN "📺 Creating new tmux session: $SESSION_NAME"
tmux new-session -d -s $SESSION_NAME -n "$BEPO_BOT_WINDOW"

# Create additional windows for monitoring services
if should_enable_service "monitor"; then
    tmux new-window -t $SESSION_NAME -n "$BEPO_MONITOR_WINDOW"
    print_status $COLOR_GREEN "  ✅ Created monitor window"
fi

if should_enable_service "offline"; then
    tmux new-window -t $SESSION_NAME -n "$BEPO_OFFLINE_WINDOW"
    print_status $COLOR_GREEN "  ✅ Created offline response window"
fi

# Create a startup script that handles bot restarts
print_status $COLOR_CYAN "📝 Setting up bot startup script..."
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "cat > /tmp/bepo-startup.sh << 'EOF'" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "#!/bin/bash" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "cd $(pwd)" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "LOG_FILE=\"$LOG_FILE\"" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "# Function to start the bot with auto-restart" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "start_bot() {" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "    while true; do" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "        echo \"[$(date)] Starting bot...\" | tee -a \$LOG_FILE" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "        # Use dev command to skip tests for faster startup" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "        if npm run dev 2>&1 | tee -a \$LOG_FILE; then" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "            echo \"[$(date)] Bot exited normally\" | tee -a \$LOG_FILE" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "            break" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "        else" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "            echo \"[$(date)] Bot crashed, restarting in $BOT_RESTART_DELAY seconds...\" | tee -a \$LOG_FILE" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "            sleep $BOT_RESTART_DELAY" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "        fi" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "    done" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "}" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "# Deploy commands first" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "echo \"[$(date)] Running deploy script...\" | tee -a \$LOG_FILE" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "if npm run deploy 2>&1 | tee -a \$LOG_FILE; then" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "    echo \"[$(date)] Deploy completed successfully. Starting bot...\" | tee -a \$LOG_FILE" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "    start_bot" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "else" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "    echo \"[$(date)] Deploy failed. Server not started.\" | tee -a \$LOG_FILE" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "    exit 1" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "fi" C-m
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "EOF" C-m

# Make the startup script executable
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "chmod +x /tmp/bepo-startup.sh" C-m

# Start bot monitor if enabled
if should_enable_service "monitor"; then
    print_status $COLOR_CYAN "🔍 Setting up bot monitor..."
    tmux send-keys -t $SESSION_NAME:$BEPO_MONITOR_WINDOW "cd $(pwd)" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_MONITOR_WINDOW "echo \"[$(date)] Starting bot monitor...\" | tee -a $MONITOR_LOG_FILE" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_MONITOR_WINDOW "while true; do" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_MONITOR_WINDOW "    if npm run monitor 2>&1 | tee -a $MONITOR_LOG_FILE; then" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_MONITOR_WINDOW "        echo \"[$(date)] Monitor exited normally\" | tee -a $MONITOR_LOG_FILE" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_MONITOR_WINDOW "        break" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_MONITOR_WINDOW "    else" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_MONITOR_WINDOW "        echo \"[$(date)] Monitor crashed, restarting in $MONITOR_RESTART_DELAY seconds...\" | tee -a $MONITOR_LOG_FILE" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_MONITOR_WINDOW "        sleep $MONITOR_RESTART_DELAY" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_MONITOR_WINDOW "    fi" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_MONITOR_WINDOW "done" C-m
fi

# Start offline response system if enabled
if should_enable_service "offline"; then
    print_status $COLOR_CYAN "📡 Setting up offline response system..."
    tmux send-keys -t $SESSION_NAME:$BEPO_OFFLINE_WINDOW "cd $(pwd)" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_OFFLINE_WINDOW "echo \"[$(date)] Starting offline response system...\" | tee -a $OFFLINE_LOG_FILE" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_OFFLINE_WINDOW "while true; do" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_OFFLINE_WINDOW "    if npm run start:offline 2>&1 | tee -a $OFFLINE_LOG_FILE; then" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_OFFLINE_WINDOW "        echo \"[$(date)] Offline system exited normally\" | tee -a $OFFLINE_LOG_FILE" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_OFFLINE_WINDOW "        break" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_OFFLINE_WINDOW "    else" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_OFFLINE_WINDOW "        echo \"[$(date)] Offline system crashed, restarting in $OFFLINE_RESTART_DELAY seconds...\" | tee -a $OFFLINE_LOG_FILE" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_OFFLINE_WINDOW "        sleep $OFFLINE_RESTART_DELAY" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_OFFLINE_WINDOW "    fi" C-m
    tmux send-keys -t $SESSION_NAME:$BEPO_OFFLINE_WINDOW "done" C-m
fi

# Wait for services to start, then start the bot (with staggered startup)
print_status $COLOR_CYAN "⏳ Starting services in sequence..."
sleep 2

# Start monitor first (if enabled)
if should_enable_service "monitor"; then
    print_status $COLOR_GREEN "🔍 Starting bot monitor..."
    tmux send-keys -t $SESSION_NAME:$BEPO_MONITOR_WINDOW C-m
    sleep $MONITOR_START_DELAY
fi

# Start offline system second (if enabled)
if should_enable_service "offline"; then
    print_status $COLOR_GREEN "📡 Starting offline response system..."
    tmux send-keys -t $SESSION_NAME:$BEPO_OFFLINE_WINDOW C-m
    sleep $OFFLINE_START_DELAY
fi

# Finally start the main bot
print_status $COLOR_GREEN "🤖 Starting main bot..."
tmux send-keys -t $SESSION_NAME:$BEPO_BOT_WINDOW "/tmp/bepo-startup.sh" C-m

# Wait a moment for startup
sleep $BOT_START_DELAY

print_status $COLOR_GREEN "✅ Session $SESSION_NAME created and all services started."
echo ""
print_status $COLOR_CYAN "📊 Service Status:"
echo "  🤖 Main Bot: Starting (logs: $LOG_FILE)"
if should_enable_service "monitor"; then
    echo "  🔍 Bot Monitor: Running (logs: $MONITOR_LOG_FILE)"
fi
if should_enable_service "offline"; then
    echo "  📡 Offline Response: Running (logs: $OFFLINE_LOG_FILE)"
fi
echo ""
print_status $COLOR_CYAN "🛠️  Management Commands:"
echo "  Attach to session: tmux attach-session -t $SESSION_NAME"
echo "  Switch to bot window: tmux select-window -t $SESSION_NAME:$BEPO_BOT_WINDOW"
if should_enable_service "monitor"; then
    echo "  Switch to monitor window: tmux select-window -t $SESSION_NAME:$BEPO_MONITOR_WINDOW"
fi
if should_enable_service "offline"; then
    echo "  Switch to offline window: tmux select-window -t $SESSION_NAME:$BEPO_OFFLINE_WINDOW"
fi
echo "  List windows: tmux list-windows -t $SESSION_NAME"
echo "  Check status: ./bepo-status.sh"
echo ""
print_status $COLOR_CYAN "📋 Log Monitoring:"
echo "  Bot logs: tail -f $LOG_FILE"
if should_enable_service "monitor"; then
    echo "  Monitor logs: tail -f $MONITOR_LOG_FILE"
fi
if should_enable_service "offline"; then
    echo "  Offline logs: tail -f $OFFLINE_LOG_FILE"
fi
echo "  All logs: tail -f $LOG_FILE $MONITOR_LOG_FILE $OFFLINE_LOG_FILE"
echo ""
print_status $COLOR_CYAN "🛑 Stop Services:"
echo "  Stop all: ./stop-bepo.sh"
echo "  Or: tmux kill-session -t $SESSION_NAME"
echo ""
print_status $COLOR_PURPLE "💡 Configuration:"
echo "  Bot Monitor: $ENABLE_BOT_MONITOR"
echo "  Offline Mode: $ENABLE_OFFLINE_MODE"
echo "  Auto Restart: $ENABLE_AUTO_RESTART"
echo "  (Edit bepo-config.sh to change defaults)"
echo ""
print_status $COLOR_GREEN "🌐 Session will persist after SSH disconnection."
echo ""
print_status $COLOR_YELLOW "⏱️  Services are starting up... Use './bepo-status.sh' to check progress."
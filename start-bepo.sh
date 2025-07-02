#!/bin/bash

# Load configuration
source ./bepo-config.sh

# Check if session already exists
if tmux has-session -t $BEPO_SESSION_NAME 2>/dev/null; then
    echo "Session $BEPO_SESSION_NAME already exists."
    echo "To attach: tmux attach-session -t $BEPO_SESSION_NAME"
    echo "To kill and restart: tmux kill-session -t $BEPO_SESSION_NAME && $0"
    exit 0
fi

echo "🚀 Starting Bepo System..."
echo "Creating tmux session: $BEPO_SESSION_NAME"

# Create new tmux session with first window for bot
tmux new-session -d -s $BEPO_SESSION_NAME -n $BEPO_BOT_WINDOW

# Deploy commands first and wait for completion
echo "📦 Deploying Discord commands..."
tmux send-keys -t $BEPO_SESSION_NAME:$BEPO_BOT_WINDOW "npm run deploy" C-m

# Wait for deploy to complete by monitoring the tmux window
echo "⏳ Waiting for command deployment to complete..."
deploy_timeout=0
while true; do
    sleep 1
    deploy_timeout=$((deploy_timeout + 1))
    
    # Check if the deploy finished (look for the shell prompt indicating completion)
    window_content=$(tmux capture-pane -t $BEPO_SESSION_NAME:$BEPO_BOT_WINDOW -p)
    if echo "$window_content" | tail -3 | grep -q "Successfully reloaded.*commands"; then
        echo "✅ Command deployment completed"
        sleep 2  # Give it a moment to fully complete
        break
    fi
    
    # Safety timeout after 30 seconds
    if [[ $deploy_timeout -gt 30 ]]; then
        echo "⚠️  Deploy timeout reached, continuing anyway..."
        break
    fi
done

# Start the main bot with proper logging
echo "🤖 Starting main bot..."
# Clear any pending input and ensure we're at a clean prompt
tmux send-keys -t $BEPO_SESSION_NAME:$BEPO_BOT_WINDOW C-c
sleep 1
tmux send-keys -t $BEPO_SESSION_NAME:$BEPO_BOT_WINDOW "clear" C-m
sleep 1
tmux send-keys -t $BEPO_SESSION_NAME:$BEPO_BOT_WINDOW "npm run dev 2>&1 | tee -a $BEPO_BOT_LOG" C-m

# Give the bot a moment to start before starting other services
sleep $BOT_START_DELAY

# Create and start monitor window if enabled
if [[ "$ENABLE_BOT_MONITOR" == "true" ]]; then
    echo "🔍 Starting bot monitor..."
    tmux new-window -t $BEPO_SESSION_NAME -n $BEPO_MONITOR_WINDOW
    tmux send-keys -t $BEPO_SESSION_NAME:$BEPO_MONITOR_WINDOW "sleep $MONITOR_START_DELAY" C-m
    tmux send-keys -t $BEPO_SESSION_NAME:$BEPO_MONITOR_WINDOW "npm run start:monitor 2>&1 | tee -a $BEPO_MONITOR_LOG" C-m
fi

# Create and start offline response window if enabled
if [[ "$ENABLE_OFFLINE_MODE" == "true" ]]; then
    echo "📡 Starting offline response system..."
    tmux new-window -t $BEPO_SESSION_NAME -n $BEPO_OFFLINE_WINDOW
    tmux send-keys -t $BEPO_SESSION_NAME:$BEPO_OFFLINE_WINDOW "sleep $OFFLINE_START_DELAY" C-m
    tmux send-keys -t $BEPO_SESSION_NAME:$BEPO_OFFLINE_WINDOW "npm run start:offline 2>&1 | tee -a $BEPO_OFFLINE_LOG" C-m
fi

# Switch back to bot window
tmux select-window -t $BEPO_SESSION_NAME:$BEPO_BOT_WINDOW

# Wait a moment for all services to initialize
echo "⏳ Waiting for all services to initialize..."
sleep 5

# Verify all services are running
echo "🔍 Verifying service startup..."
services_ok=true

# Check bot process
if ! pgrep -f "$BOT_PROCESS_PATTERN" > /dev/null; then
    echo "⚠️  Main bot process not detected"
    services_ok=false
else
    echo "✅ Main bot process running"
fi

# Check monitor process (if enabled)
if [[ "$ENABLE_BOT_MONITOR" == "true" ]]; then
    if ! pgrep -f "$MONITOR_PROCESS_PATTERN" > /dev/null; then
        echo "⚠️  Monitor process not detected"
        services_ok=false
    else
        echo "✅ Monitor process running"
    fi
fi

# Check offline response process (if enabled)
if [[ "$ENABLE_OFFLINE_MODE" == "true" ]]; then
    if ! pgrep -f "$OFFLINE_PROCESS_PATTERN" > /dev/null; then
        echo "⚠️  Offline response process not detected"
        services_ok=false
    else
        echo "✅ Offline response process running"
    fi
fi

echo ""
if [[ "$services_ok" == "true" ]]; then
    echo "✅ Bepo System started successfully!"
    echo "🎉 All services are running properly!"
else
    echo "⚠️  Bepo System started with some issues!"
    echo "💡 Run './bepo-status.sh' for detailed status"
fi
echo "📋 Session: $BEPO_SESSION_NAME"
echo "📄 Log files:"
echo "   Bot: $BEPO_BOT_LOG"
if [[ "$ENABLE_BOT_MONITOR" == "true" ]]; then
    echo "   Monitor: $BEPO_MONITOR_LOG"
fi
if [[ "$ENABLE_OFFLINE_MODE" == "true" ]]; then
    echo "   Offline: $BEPO_OFFLINE_LOG"
fi
echo ""
echo "🔧 Management commands:"
echo "   Check status: ./bepo-status.sh"
echo "   View logs: tail -f $BEPO_BOT_LOG"
echo "   Attach to session: tmux attach-session -t $BEPO_SESSION_NAME"
echo "   Stop all services: ./stop-bepo.sh"
echo ""
echo "📺 Tmux windows:"
echo "   bot    - Main Discord bot"
if [[ "$ENABLE_BOT_MONITOR" == "true" ]]; then
    echo "   monitor - Health monitoring"
fi
if [[ "$ENABLE_OFFLINE_MODE" == "true" ]]; then
    echo "   offline - Offline response system"
fi
echo ""
echo "Session will persist after SSH disconnection."
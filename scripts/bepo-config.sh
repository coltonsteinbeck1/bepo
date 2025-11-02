#!/bin/bash
# Bepo System Configuration
# This file contains centralized configuration for all Bepo services

# Session and Process Names
export BEPO_SESSION_NAME="bepo-session"
export BEPO_BOT_WINDOW="bot"
export BEPO_MONITOR_WINDOW="monitor" 
export BEPO_OFFLINE_WINDOW="offline"

# Project Root (relative to scripts directory)
export BEPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Log Files (relative to project root)
export BEPO_BOT_LOG="$BEPO_ROOT/logs/serverOutput.log"
export BEPO_MONITOR_LOG="$BEPO_ROOT/logs/monitorOutput.log"
export BEPO_OFFLINE_LOG="$BEPO_ROOT/logs/offlineOutput.log"
export BEPO_HEALTH_LOG="$BEPO_ROOT/logs/health-$(date +%Y-%m-%d).json"
export BEPO_STATUS_FILE="$BEPO_ROOT/logs/bot-status.json"
export BEPO_MONITOR_STATUS="$BEPO_ROOT/logs/bot-status-monitor.json"

# Service Configuration
export ENABLE_BOT_MONITOR=${ENABLE_BOT_MONITOR:-true}
export ENABLE_OFFLINE_MODE=${ENABLE_OFFLINE_MODE:-true}
export ENABLE_AUTO_RESTART=${ENABLE_AUTO_RESTART:-true}

# Startup Delays (in seconds)
export MONITOR_START_DELAY=3
export OFFLINE_START_DELAY=2
export BOT_START_DELAY=1

# Restart Delays (in seconds)
export BOT_RESTART_DELAY=5
export MONITOR_RESTART_DELAY=10
export OFFLINE_RESTART_DELAY=15

# Health Check Configuration
export HEALTH_CHECK_INTERVAL=30
export OFFLINE_THRESHOLD=90

# Process Detection Patterns
export BOT_PROCESS_PATTERN="node.*src/bot.js"
export MONITOR_PROCESS_PATTERN="node.*monitor-service.js"
export OFFLINE_PROCESS_PATTERN="node.*offline-response-system.js"

# Color Output (for better visibility)
export COLOR_RED='\033[0;31m'
export COLOR_GREEN='\033[0;32m'
export COLOR_YELLOW='\033[1;33m'
export COLOR_BLUE='\033[0;34m'
export COLOR_PURPLE='\033[0;35m'
export COLOR_CYAN='\033[0;36m'
export COLOR_NC='\033[0m' # No Color

# Helper function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${COLOR_NC}"
}

# Function to check if a service should be enabled
should_enable_service() {
    local service=$1
    case $service in
        "monitor")
            [ "$ENABLE_BOT_MONITOR" = "true" ]
            ;;
        "offline")
            [ "$ENABLE_OFFLINE_MODE" = "true" ]
            ;;
        *)
            return 1
            ;;
    esac
}

# Function to get process IDs for Bepo services
get_bepo_pids() {
    local service=$1
    case $service in
        "bot")
            pgrep -f "$BOT_PROCESS_PATTERN" 2>/dev/null || true
            ;;
        "monitor")
            pgrep -f "$MONITOR_PROCESS_PATTERN" 2>/dev/null || true
            ;;
        "offline")
            pgrep -f "$OFFLINE_PROCESS_PATTERN" 2>/dev/null || true
            ;;
        "all")
            {
                pgrep -f "$BOT_PROCESS_PATTERN" 2>/dev/null || true
                pgrep -f "$MONITOR_PROCESS_PATTERN" 2>/dev/null || true
                pgrep -f "$OFFLINE_PROCESS_PATTERN" 2>/dev/null || true
            } | sort -u
            ;;
    esac
}

# Function to display service status
show_service_status() {
    echo ""
    print_status $COLOR_CYAN "Bepo Service Status:"
    
    # Check tmux session
    if tmux has-session -t $BEPO_SESSION_NAME 2>/dev/null; then
        print_status $COLOR_GREEN "  Tmux Session: Running"
        local windows=$(tmux list-windows -t $BEPO_SESSION_NAME -F "#{window_name}" 2>/dev/null | tr '\n' ' ')
        echo "    Windows: $windows"
    else
        print_status $COLOR_RED "  Tmux Session: Not running"
    fi
    
    # Check individual services
    local bot_pids=$(get_bepo_pids "bot")
    local monitor_pids=$(get_bepo_pids "monitor")
    local offline_pids=$(get_bepo_pids "offline")
    
    if [ -n "$bot_pids" ]; then
        print_status $COLOR_GREEN "  Bot Process: Running (PID: $bot_pids)"
    else
        print_status $COLOR_RED "  Bot Process: Not running"
    fi
    
    if should_enable_service "monitor"; then
        if [ -n "$monitor_pids" ]; then
            print_status $COLOR_GREEN "  Monitor Process: Running (PID: $monitor_pids)"
        else
            print_status $COLOR_RED "  Monitor Process: Not running"
        fi
    else
        print_status $COLOR_YELLOW "  Monitor Process: Disabled"
    fi
    
    if should_enable_service "offline"; then
        if [ -n "$offline_pids" ]; then
            print_status $COLOR_GREEN "  Offline Process: Running (PID: $offline_pids)"
        else
            print_status $COLOR_RED "  Offline Process: Not running"
        fi
    else
        print_status $COLOR_YELLOW "  Offline Process: Disabled"
    fi
    
    echo ""
}

# Function to ensure log directories exist
setup_log_directories() {
    cd "$BEPO_ROOT"
    mkdir -p logs logs/archive temp
    touch "$BEPO_BOT_LOG" "$BEPO_MONITOR_LOG" "$BEPO_OFFLINE_LOG"
}

# Function to display configuration
show_configuration() {
    echo ""
    print_status $COLOR_PURPLE "Bepo Configuration:"
    echo "  Bot Monitor: $ENABLE_BOT_MONITOR"
    echo "  Offline Mode: $ENABLE_OFFLINE_MODE"
    echo "  Auto Restart: $ENABLE_AUTO_RESTART"
    echo "  Session Name: $BEPO_SESSION_NAME"
    echo ""
    echo "  Log Files:"
    echo "    Bot: $BEPO_BOT_LOG"
    echo "    Monitor: $BEPO_MONITOR_LOG"
    echo "    Offline: $BEPO_OFFLINE_LOG"
    echo ""
}

# Export functions for use in other scripts
export -f print_status
export -f should_enable_service
export -f get_bepo_pids
export -f show_service_status
export -f setup_log_directories
export -f show_configuration

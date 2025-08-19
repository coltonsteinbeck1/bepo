#!/bin/bash
# Bepo System Status Checker
# Provides detailed status information about all Bepo services

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/bepo-config.sh"

# Function to check service health
check_service_health() {
    local service=$1
    local log_file=""
    
    case $service in
        "bot")
            log_file="$BEPO_BOT_LOG"
            ;;
        "monitor")
            log_file="$BEPO_MONITOR_LOG"
            ;;
        "offline")
            log_file="$BEPO_OFFLINE_LOG"
            ;;
    esac
    
    if [ -f "$log_file" ]; then
        local last_log=$(tail -1 "$log_file" 2>/dev/null)
        local log_time=$(echo "$last_log" | grep -o '\[[^]]*\]' | head -1 | tr -d '[]')
        
        if [ -n "$log_time" ]; then
            echo "    Last activity: $log_time"
        else
            echo "    Last activity: Unknown"
        fi
        
        # Check for recent errors
        local error_count=$(tail -20 "$log_file" 2>/dev/null | grep -i "error\|crash\|fail" | wc -l)
        if [ "$error_count" -gt 0 ]; then
            print_status $COLOR_YELLOW "    Recent errors: $error_count (check logs)"
        else
            print_status $COLOR_GREEN "    Health: Good"
        fi
    else
        print_status $COLOR_YELLOW "    Log file not found: $log_file"
    fi
}

# Function to show detailed service information
show_detailed_status() {
    print_status $COLOR_CYAN "Detailed Service Status:"
    echo ""
    
    # Bot service
    print_status $COLOR_BLUE "Main Bot Service:"
    local bot_pids=$(get_bepo_pids "bot")
    if [ -n "$bot_pids" ]; then
        print_status $COLOR_GREEN "  Status: Running"
        echo "  Process ID(s): $bot_pids"
        check_service_health "bot"
        
        # Check Discord connection status if status file exists
        if [ -f "logs/bot-status.json" ]; then
            local discord_status=$(jq -r '.discord.connected // "unknown"' logs/bot-status.json 2>/dev/null)
            local bot_online=$(jq -r '.botStatus.isOnline // "unknown"' logs/bot-status.json 2>/dev/null)
            echo "  Discord connected: $discord_status"
            echo "  Bot online: $bot_online"
        fi
    else
        print_status $COLOR_RED "  Status: Not running"
    fi
    echo ""
    
    # Monitor service
    if should_enable_service "monitor"; then
        print_status $COLOR_BLUE "Bot Monitor Service:"
        local monitor_pids=$(get_bepo_pids "monitor")
        if [ -n "$monitor_pids" ]; then
            print_status $COLOR_GREEN "  Status: Running"
            echo "  Process ID(s): $monitor_pids"
            check_service_health "monitor"
        else
            print_status $COLOR_RED "  Status: Not running"
        fi
        echo ""
    fi
    
    # Offline service
    if should_enable_service "offline"; then
        print_status $COLOR_BLUE "Offline Response Service:"
        local offline_pids=$(get_bepo_pids "offline")
        if [ -n "$offline_pids" ]; then
            print_status $COLOR_GREEN "  Status: Running"
            echo "  Process ID(s): $offline_pids"
            check_service_health "offline"
        else
            print_status $COLOR_RED "  Status: Not running"
        fi
        echo ""
    fi
}

# Function to show log summary
show_log_summary() {
    print_status $COLOR_CYAN "Recent Log Summary:"
    echo ""
    
    for log_file in "$BEPO_BOT_LOG" "$BEPO_MONITOR_LOG" "$BEPO_OFFLINE_LOG"; do
        if [ -f "$log_file" ]; then
            local basename=$(basename "$log_file")
            echo "$basename (last 3 lines):"
            tail -3 "$log_file" 2>/dev/null | sed 's/^/    /'
            echo ""
        fi
    done
}

# Function to show tmux session info
show_tmux_info() {
    if tmux has-session -t $BEPO_SESSION_NAME 2>/dev/null; then
        print_status $COLOR_CYAN "Tmux Session Details:"
        echo ""
        tmux list-windows -t $BEPO_SESSION_NAME -F "  Window #{window_index}: #{window_name} (#{window_panes} panes)" 2>/dev/null
        echo ""
        print_status $COLOR_GREEN "To attach: tmux attach-session -t $BEPO_SESSION_NAME"
        print_status $COLOR_GREEN "To list windows: tmux list-windows -t $BEPO_SESSION_NAME"
        echo ""
    else
        print_status $COLOR_RED "No tmux session found"
        echo ""
    fi
}

# Main function
main() {
    clear
    print_status $COLOR_PURPLE "Bepo System Status Check"
    print_status $COLOR_PURPLE "=========================="
    
    # Setup log directories
    setup_log_directories
    
    # Show configuration
    show_configuration
    
    # Show basic status
    show_service_status
    
    # Show detailed status
    show_detailed_status
    
    # Show tmux info
    show_tmux_info
    
    # Show log summary if requested
    if [ "$1" = "--logs" ] || [ "$1" = "-l" ]; then
        show_log_summary
    fi
    
    # Show help
    echo ""
    print_status $COLOR_CYAN "Management Commands:"
    echo "  Start services: ./start-bepo.sh"
    echo "  Stop services: ./stop-bepo.sh"
    echo "  View this status: ./scripts/bepo-status.sh"
    echo "  View logs: ./scripts/bepo-status.sh --logs"
    echo "  Monitor logs: tail -f $BEPO_BOT_LOG $BEPO_MONITOR_LOG $BEPO_OFFLINE_LOG"
    echo ""
    
    print_status $COLOR_CYAN "Configuration:"
    echo "  Disable monitor: ENABLE_BOT_MONITOR=false ./start-bepo.sh"
    echo "  Disable offline: ENABLE_OFFLINE_MODE=false ./start-bepo.sh"
    echo "  Edit config: vim scripts/bepo-config.sh"
    echo ""
}

# Run main function
main "$@"

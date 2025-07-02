# Shutdown Reason Detection & Formatting Improvements

## Changes Made

### Enhanced Shutdown Reason Detection (`src/utils/statusChecker.js`)

1. **Better Log Analysis**: 
   - Expanded to check last 200 lines instead of 100 for better coverage
   - Added timestamp filtering to ignore very old entries (older than 1 hour)
   - Prioritized manual shutdown patterns over automatic ones

2. **Improved Pattern Recognition**:
   - Added detection for "manual shutdown" and "manual stop" text patterns
   - Enhanced script detection patterns
   - Better categorization of shutdown types (manual, planned, error, system)

3. **More Specific Reasons**:
   - Instead of generic "Last update too old", now provides:
     - "Manually stopped for testing/maintenance"
     - "Manually stopped via script"
     - "Manually interrupted (Ctrl+C)"
     - "Restarting after previous shutdown"
     - "System terminated process"
     - "Discord connection error"
     - And more specific error messages

### Fixed Formatting Issues

1. **Health Command (`src/commands/fun/health.js`)**:
   - Fixed corrupted emoji characters
   - Changed "Shutdown Reason" field to be non-inline for better readability
   - Added better categorization logic for shutdown types
   - Enhanced context messages based on shutdown type

2. **Offline Response System (`scripts/offline-response-system.js`)**:
   - Fixed corrupted emoji in "What Happened" field
   - Improved planned vs unplanned detection logic
   - Better categorization for testing/debugging scenarios

### New Features

1. **Shutdown Categorization**:
   - `manual`: User-initiated shutdowns (scripts, Ctrl+C, etc.)
   - `planned`: Restarts, deployments, maintenance
   - `error`: Application errors, network issues, etc.
   - `system`: OS-level termination
   - `unknown`: Could not determine

2. **Better Visual Feedback**:
   - Orange color for planned shutdowns
   - Red color for unexpected shutdowns
   - More descriptive field names and content

## Testing

The improvements can be tested with:

```bash
# Test current shutdown reason detection
node test-shutdown-reason.js

# Test manual shutdown detection
echo "$(date) - Manual shutdown for testing" >> monitorOutput.log
./stop-bot-only.sh
sleep 120  # Wait for detection threshold
node test-shutdown-reason.js
```

## Example Output

**Before**: 
- Reason: "Last update too old"
- Color: Always red
- Context: Generic

**After**:
- Reason: "Manually stopped for testing/maintenance" 
- Color: Orange (planned) or Red (unexpected)
- Context: Specific to shutdown type with helpful explanations

## Discord Integration

- Health command now shows improved shutdown reasons and formatting
- Offline response system provides better context about why the bot is down
- Automatic categorization helps users understand if intervention is needed

This system now provides much clearer, more actionable feedback about bot status and shutdown reasons.

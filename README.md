# Bepo 🤖

The Discord bot who should probably go outside and touch grass, but chooses to be chronically online instead! A feature-rich Discord bot powered by AI with memory, server management, gaming utilities, and more.

## ✨ Recent Updates (June 2025)

### 🔧 **Major Refactoring & Improvements**

- **Code Organization**: Refactored all commands for better maintainability and performance
- **Business Logic Separation**: Moved logic from commands into dedicated utility modules
- **Enhanced Error Handling**: Comprehensive error tracking with retry mechanisms and graceful failures
- **Discord.js Modernization**: Updated to use `MessageFlags.Ephemeral` instead of deprecated `ephemeral: true`
- **Test Coverage Expansion**: Added comprehensive unit tests for all major utilities

### 🧵 **Thread Management Safeguards**

- **Robust Thread Tracking**: Enhanced thread management that survives title changes and bot restarts
- **Automatic Recovery**: Bot automatically re-establishes tracking for threads after disruptions
- **Multi-step Validation**: Comprehensive thread existence checking with graceful error handling
- **User-Friendly Responses**: Clear guidance with clickable thread links and better error messages
- **Periodic Cleanup**: Automated thread validation and cleanup every 2 hours
- **Rename Tolerance**: Explicitly supports thread renaming while maintaining tracking
- **Cross-restart Persistence**: Thread functionality survives bot restarts and updates
- **Permission-aware**: Handles archived threads and permission errors gracefully

### 🧠 **Memory System Enhancements**

- **Utility Refactoring**: Moved all memory logic to dedicated `memoryUtils.js` for better organization
- **Admin Support**: Enhanced memory update commands with admin capabilities and override permissions
- **Partial ID Matching**: Support for partial memory ID resolution for easier updates
- **Comprehensive Testing**: Full test coverage for memory operations and edge cases
- **Smart Context Integration**: AI automatically references relevant memories during conversations

### 📊 **Digest System Improvements**

- **AI Model Update**: Updated to use `grok-2-1212` for better digest generation
- **Fallback Handling**: Robust fallback summaries when AI generation fails
- **Logic Separation**: Moved digest generation to `digestUtils.js` with comprehensive error handling
- **Flexible Time Periods**: Support for 1h, 12h, daily, and weekly digests

### 🏥 **Health Monitoring & Reliability**

- **Real-time Metrics**: Live bot performance monitoring with detailed statistics
- **Error Classification**: Different handling for Discord, database, and AI errors
- **Recovery Tracking**: Comprehensive error logging with categorization and recovery tracking
- **System Status**: Memory usage, uptime, and critical error monitoring with automated cleanup
- **Graceful Degradation**: Non-critical failures don't affect core functionality
- **Automatic Recovery**: Exponential backoff retry mechanisms for transient failures

## Features

### 🧠 **Advanced Memory System**

- **Personal Memory**: Bepo remembers your conversations, preferences, and personal details across all interactions
- **Server Memory**: Shared knowledge base that all server members can contribute to and reference
- **Memory Management**: View, search, update, and clear memories with sophisticated filtering and admin controls
- **Smart Context**: AI automatically references relevant memories during conversations

### 🎮 **Gaming & Entertainment**

- **Memes Chronically**: Degen behavior, powered by LLM's!
- **Drawing**: AI-powered image generation with DALL-E
- **Game Integration**: Real-time stats for Apex Legends map rotation and CS2 skin prices
- **Minecraft Support**: AWS-powered server management with start/stop/status controls

### 🗣️ **Conversation & AI**

- **Smart Conversations**: Advanced AI chat with memory context and personality
- **Thread Management**: Create organized Discord threads for longer conversations with auto-cleanup
- **Voice Integration**: YAP system for voice channel interactions
- **Digest System**: AI-powered server activity summaries with customizable time periods

### 🔧 **Server Management**

- **Role Management**: Self-assignable roles with permission controls and banned role filtering
- **Health Monitoring**: Comprehensive bot health checks and error tracking with automated recovery
- **Thread Safeguards**: Robust thread management that survives title changes and bot restarts
- **Robust Error Handling**: Advanced error tracking, retry mechanisms, and graceful failure handling
- **Performance Monitoring**: Real-time system metrics and automated cleanup processes

## Commands

### Memory Commands

```
/memory view [type]                    # View your stored memories (all, conversations, preferences, summaries)
/memory search <query> [type]          # Search through your memories
/memory clear <type>                   # Clear specific types of memories (conversations, preferences, etc.)
/memory set <key> <value>              # Set personal preferences (name, timezone, interests, etc.)
/memory stats                          # View memory usage statistics
/updatememory <id> [content] [type]    # Update existing memories by ID
```

### Server Memory Commands

```
/servermemory add <content> [title]                    # Add shared server knowledge
/servermemory list [filter] [limit]                    # View server memories with optional filtering
/servermemory search <query>                           # Search server memories
/servermemory delete <memory_id>                       # Delete server memories (own or admin)
/servermemory stats                                    # View server memory statistics
/servermemory my [limit]                               # View your contributions to server memory
/updateservermemory <id> [content] [title] [type]     # Update server memories by ID
```

### Conversation & Thread Commands

```
/continue [topic] [create_thread:true]     # Continue conversation with optional thread creation
/thread [name]                             # Create dedicated conversation thread
/review [thread]                           # Review conversation history in threads
/yap                                       # Start voice conversation mode
/stopyap                                   # Stop voice conversation mode
```

### Gaming Commands

```
/maprotation                               # Current Apex Legends map rotation
/cs2                                       # Latest CS2 updates and news
/cs2prices <skin_name>                     # Get current CS2 skin prices from multiple markets
/minecraftserver <action>                  # Manage Minecraft server (status/start/stop)
```

### Server & Utility Commands

```
/digest [period] [include_stats]           # Generate AI server activity digest (1h, 12h, daily, weekly)
/rolesupport <action>                      # Manage self-assignable roles (add/remove)
/health                                    # Check bot system health and performance metrics
/ping                                      # Simple connectivity test
/poll <question> [options...]              # Create interactive polls
/reset                                     # Reset your conversation context with the bot
```

### Advanced Commands

```
/debug-memory [user]                       # Debug memory context for troubleshooting (admin)
```

### Creative Commands

```
/draw <prompt> [style]                     # Generate AI artwork with DALL-E
```

## 🛡️ Error Handling & Reliability

### 🔄 **Automatic Recovery Systems**

- **Global Error Handlers**: Comprehensive uncaught exception and promise rejection handling
- **Exponential Backoff**: Smart retry logic for transient failures with automatic recovery
- **Service-Specific Handling**: Different error strategies for Discord API, database, and AI services
- **Graceful Degradation**: Non-critical failures don't break core functionality

### 📊 **Error Classification & Monitoring**

- **Discord API Errors**: Rate limits, permissions, connection issues with automatic retry
- **Database Errors**: Connection timeouts, authentication failures with fallback storage
- **AI Service Errors**: Rate limits, API key issues, model overloads with alternative models
- **Voice Connection Errors**: Token issues, channel deletions, timeouts with reconnection
- **Real-time Health Checks**: Every 5 minutes with performance monitoring and alerts

### 🔧 **Recovery Strategies**

- **Memory Storage Failures**: Bot continues responding without storing conversation history
- **Thread Management Issues**: Automatic re-establishment of tracking after disruptions
- **Command Errors**: User gets helpful error message while bot stays online
- **AI Generation Failures**: Fallback to alternative models or pre-generated responses
- **Voice Errors**: Attempt reconnection or cleanup as appropriate

### 🏥 **Health Monitoring Features**

- **System Metrics**: Memory usage, uptime tracking, response time monitoring
- **Error Categorization**: Detailed logging and classification of all issues
- **Recovery Tracking**: Monitoring of automatic recovery attempts and success rates
- **Critical Alerts**: Immediate notification system for severe errors
- **Daily Health Logs**: Comprehensive health status reporting and trend analysis

## Technical Architecture

### 🏗️ **Code Organization**

- **Modular Design**: Business logic separated into dedicated utility modules
- **Command Structure**: Clean command files that delegate to utility functions
- **Error Boundaries**: Comprehensive error handling at all levels
- **Test Coverage**: Unit and integration tests for all major components

### 🔧 **Utility Modules**

- **`memoryUtils.js`**: All memory operations with admin support and validation
- **`digestUtils.js`**: AI-powered server analysis and digest generation
- **`threadUtils.js`**: Thread creation, management, and AI topic generation
- **`errorHandler.js`**: Centralized error handling with retry logic
- **`healthMonitor.js`**: System health tracking and performance metrics

### 🛡️ **Reliability Features**

- **Thread Safeguards**: Automatic recovery from thread title changes and bot restarts
- **Memory Persistence**: Robust database operations with transaction safety
- **Error Recovery**: Automatic retry mechanisms with exponential backoff
- **Graceful Degradation**: Non-critical failures don't affect core functionality

## Development & Testing

### 🧪 **Test Suite**

```bash
npm test                                   # Run all tests (unit + integration)
npm run test:unit                          # Run unit tests only
npm run test:integration                   # Run integration tests only
```

### 📈 **Test Coverage**

- **64 total tests** covering all major functionality
- **Unit tests** for all utility modules and error handling
- **Integration tests** for bot initialization and command loading
- **Mock implementations** for external APIs to prevent costs during testing

### 🚀 **Deployment**

```bash
npm run deploy                             # Deploy slash commands to Discord
npm start                                  # Start the bot in production
npm run dev                               # Start in development mode
```

## Memory System Deep Dive

### Personal Memory Features

- **Automatic Storage**: Conversations are automatically saved and categorized
- **Smart Preferences**: Set and update personal details that Bepo remembers
- **Search & Filter**: Find specific memories by content, type, or timeframe
- **Memory Updates**: Modify existing memories with full version tracking and admin support
- **Privacy Controls**: All personal memories are private to you
- **Partial ID Support**: Update memories using partial IDs for easier management

### Server Memory Features

- **Shared Knowledge**: Create a collective server knowledge base
- **Contribution Tracking**: See who added what information
- **Admin Controls**: Enhanced management for server administrators with override capabilities
- **Smart Integration**: Bot references server memories in conversations
- **Categorization**: Organize by type (server info, rules, FAQ, important)
- **Bulk Operations**: Efficient memory management with search and filtering

## Thread Management System

### 🧵 **Advanced Thread Features**

- **AI Topic Generation**: Automatically generates descriptive thread names from conversation context
- **Auto-cleanup**: Threads automatically delete after 1 hour of inactivity
- **Rename Tolerance**: Bot maintains tracking even when users rename threads
- **Recovery System**: Automatically re-establishes thread tracking after bot restarts
- **Smart Detection**: Finds existing threads even if tracking was lost
- **Permission Handling**: Gracefully handles archived threads and permission errors

### 🛡️ **Thread Safeguards Implementation**

- **Multi-step Validation**: Three-tier validation process for thread existence and accessibility
- **Automatic Recovery**: Re-establishes tracking for existing but untracked threads
- **Search & Recovery**: Searches for user's bot-managed threads if tracking is lost
- **Stale Reference Cleanup**: Regular validation and cleanup of thread references
- **Cross-restart Persistence**: Thread functionality survives bot restarts and updates
- **User-Friendly Feedback**: Clear error messages with clickable thread links and guidance

### 🔧 **Technical Implementation**

- **Thread Store**: In-memory tracking of all bot-managed threads with metadata
- **Validation Functions**: `validateBotManagedThread()` and `findUserBotThreadsInChannel()`
- **Periodic Maintenance**: Automated cleanup every 2 hours for optimal performance
- **Recovery on Message**: Automatic validation when messages are sent in untracked threads
- **Archive Awareness**: Proper handling of archived threads and unarchiving when needed

## Configuration & Environment

### 🔑 **Required Environment Variables**

```bash
# Discord Configuration
BOT_TOKEN=your_discord_bot_token
GUILD_ID=your_guild_id
CLIENT_ID=your_client_id

# AI Services
xAI_KEY=your_xai_api_key
OPENAI_KEY=your_openai_api_key

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key

# System Configuration
PREFIX=your_bot_prefix
MODEL_SYSTEM_MESSAGE=your_system_prompt
```

### 🏗️ **Database Schema**

- **Memory Tables**: User and server memory storage with metadata and expiration handling
- **Thread Tracking**: Bot-managed thread information, activity tracking, and recovery data
- **Health Metrics**: Error logs, performance data, and automated recovery tracking
- **Configuration**: Server-specific settings, preferences, and admin overrides

### 📊 **Memory Types**

- **`conversation`**: User messages and bot responses with automatic cleanup
- **`preference`**: User settings (name, timezone, language, interests)
- **`conversation_summary`**: Condensed conversation overviews for context
- **`temporary`**: Short-term contextual memory (24h default expiration)
- **`mood`**: User emotional state and temporary behavioral preferences

## 🚀 Quick Start & Examples

### 📝 **Setting Up Personal Preferences**

```
/memory set key:name value:Alex                    # Set your name
/memory set key:timezone value:EST                 # Set your timezone
/memory set key:interests value:coding,gaming      # Set your interests
/memory view type:preferences                      # View all preferences
```

### 🧵 **Thread Management Examples**

```
/thread AI Discussion                              # Create named thread
/thread                                           # Create auto-named thread
/continue Let's talk about AI create_thread:true  # Continue in new thread
/review                                           # Review current thread history
```

### 🧠 **Memory Management Examples**

```
/memory search query:"project ideas"               # Search your memories
/updatememory id:abc123 content:"Updated content"  # Update by full ID
/updatememory id:abc content:"Quick update"        # Update by partial ID
/memory clear type:conversations                   # Clear conversation history
```

### 📊 **Server Memory Examples**

```
/servermemory add "Server rules: Be respectful" title:"Rules"
/servermemory search query:"rules"
/updateservermemory id:def456 title:"Updated Rules"
/servermemory my limit:10                          # View your contributions
```

### 🏥 **Health & Diagnostics**

```
/health                                           # Full system health check
/debug-memory user:@someone                       # Debug user memory (admin)
/digest period:daily include_stats:true           # Server activity digest
```

## Troubleshooting

### 🔍 **Common Issues**

- **Thread "Unknown Body" Errors**: Fixed with comprehensive thread safeguards
- **Memory Update Failures**: Enhanced with partial ID support and admin controls
- **Command Deprecation Warnings**: Updated to use modern Discord.js patterns
- **Bot Restart Issues**: Automatic recovery systems handle most scenarios

### 🛠️ **Debug Commands**

- `/health` - Check overall bot health and system metrics
- `/debug-memory [user]` - Inspect memory context for troubleshooting
- **Console Logs**: Comprehensive logging for all major operations

## Contributing

### 📝 **Development Guidelines**

- **Code Organization**: Keep business logic in utility modules
- **Error Handling**: Use `safeAsync` wrapper for all async operations
- **Testing**: Add tests for new features and bug fixes
- **Documentation**: Update README and technical docs for changes

### 🧪 **Testing Standards**

- **Mock External APIs**: Prevent costs during testing
- **Comprehensive Coverage**: Test both success and failure scenarios
- **Integration Tests**: Verify commands load and function properly
- **Unit Tests**: Test individual utility functions in isolation

---

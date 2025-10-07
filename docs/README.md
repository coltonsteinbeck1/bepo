# Bepo Discord Bot

A feature-rich Discord bot powered by AI with memory, server management, gaming utilities, and more.

## Recent Updates (July 2025)

### Major Refactoring & Improvements

- Code organization refactored for better maintainability and performance
- Business logic separated from commands into dedicated utility modules
- Enhanced error handling with comprehensive tracking and retry mechanisms
- Discord.js modernization with updated API usage
- Comprehensive unit test coverage for all major utilities

### Thread Management Safeguards

- Robust thread tracking that survives title changes and bot restarts
- Automatic recovery and re-establishment of thread tracking after disruptions
- Multi-step validation with comprehensive thread existence checking
- User-friendly responses with clickable thread links and clear error messages
- Automated thread validation and cleanup every 2 hours
- Support for thread renaming while maintaining tracking
- Cross-restart persistence for thread functionality
- Permission-aware handling of archived threads and permission errors

### Memory System Enhancements

- All memory logic moved to dedicated `memoryUtils.js` for better organization
- Enhanced memory update commands with admin capabilities and override permissions
- Support for partial memory ID resolution for easier updates
- Full test coverage for memory operations and edge cases
- Smart context integration where AI automatically references relevant memories

### Digest System Improvements

- Updated to use `grok-2-1212` for better digest generation
- Robust fallback summaries when AI generation fails
- Digest generation moved to `digestUtils.js` with comprehensive error handling
- Support for flexible time periods: 1h, 12h, daily, and weekly digests

### Health Monitoring & Reliability

- Real-time bot performance monitoring with detailed statistics
- Different error handling for Discord, database, and AI errors
- Comprehensive error logging with categorization and recovery tracking
- Memory usage, uptime, and critical error monitoring with automated cleanup
- Non-critical failures don't affect core functionality
- Automatic recovery with exponential backoff retry mechanisms

## Features

### Advanced Memory System

- Personal memory: Remembers conversations, preferences, and personal details across interactions
- Server memory: Shared knowledge base that all server members can contribute to and reference
- Memory management: View, search, update, and clear memories with sophisticated filtering
- Smart context: AI automatically references relevant memories during conversations

### Gaming & Entertainment

- AI-powered meme generation and responses
- AI image generation with DALL-E integration
- Game integration: Real-time Apex Legends map rotation and CS2 skin prices
- Minecraft server management with AWS-powered start/stop/status controls

### Conversation & AI

- Smart conversations with advanced AI chat using memory context
- Thread management: Create organized Discord threads for longer conversations
- Voice integration: YAP system for voice channel interactions
- Digest system: AI-powered server activity summaries with customizable time periods

### Server Management

- Role management: Self-assignable roles with permission controls
- Health monitoring: Comprehensive bot health checks and error tracking
- Thread safeguards: Robust thread management surviving restarts and changes
- Advanced error handling with tracking, retry mechanisms, and graceful failures
- Performance monitoring: Real-time system metrics and automated cleanup

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
/record <prompt> [resolution] [images]     # Generate AI videos with Sora 2 (see VIDEO_GENERATION.md)
```

## 🚀 Quick Start Guide

**New to Bepo?** Check out the **[Simplified Bepo Guide](./BEPO_GUIDE.md)** for:

- APEX Mode setup (gaming notifications)
- OFFLINE Mode features (continuous operation)
- Essential commands and testing scenarios

### Core Operations

```bash
npm start                 # Start Bepo with all services
npm stop                  # Stop all Bepo services
npm run status           # Check bot health
npm restart              # Restart everything
```

---

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

- `memoryUtils.js`: All memory operations with admin support and validation
- `digestUtils.js`: AI-powered server analysis and digest generation
- `threadUtils.js`: Thread creation, management, and AI topic generation
- `errorHandler.js`: Centralized error handling with retry logic
- `healthMonitor.js`: System health tracking and performance metrics

### Reliability Features

- Thread safeguards: Automatic recovery from thread title changes and bot restarts
- Memory persistence: Robust database operations with transaction safety
- Error recovery: Automatic retry mechanisms with exponential backoff
- Graceful degradation: Non-critical failures don't affect core functionality

## Development & Testing

### Test Suite

```bash
npm test                                   # Run all tests (unit + integration)
npm run test:unit                          # Run unit tests only
npm run test:integration                   # Run integration tests only
```

### Test Coverage

- 64 total tests covering all major functionality
- Unit tests for all utility modules and error handling
- Integration tests for bot initialization and command loading
- Mock implementations for external APIs to prevent costs during testing

### Deployment

```bash
npm run deploy                             # Deploy slash commands to Discord
npm start                                  # Start the bot in production
npm run dev                               # Start in development mode
```

## Configuration & Environment

### Required Environment Variables

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

### Database Schema

- Memory tables: User and server memory storage with metadata and expiration handling
- Thread tracking: Bot-managed thread information, activity tracking, and recovery data
- Health metrics: Error logs, performance data, and automated recovery tracking
- Configuration: Server-specific settings, preferences, and admin overrides

### Memory Types

- `conversation`: User messages and bot responses with automatic cleanup
- `preference`: User settings (name, timezone, language, interests)
- `conversation_summary`: Condensed conversation overviews for context
- `temporary`: Short-term contextual memory (24h default expiration)
- `mood`: User emotional state and temporary behavioral preferences

## Usage Examples

### Setting Up Personal Preferences

```
/memory set key:name value:Alex                    # Set your name
/memory set key:timezone value:EST                 # Set your timezone
/memory set key:interests value:coding,gaming      # Set your interests
/memory view type:preferences                      # View all preferences
```

### Thread Management

```
/thread AI Discussion                              # Create named thread
/thread                                           # Create auto-named thread
/continue Let's talk about AI create_thread:true  # Continue in new thread
/review                                           # Review current thread history
```

### Memory Management

```
/memory search query:"project ideas"               # Search your memories
/updatememory id:abc123 content:"Updated content"  # Update by full ID
/updatememory id:abc content:"Quick update"        # Update by partial ID
/memory clear type:conversations                   # Clear conversation history
```

### Server Memory

```
/servermemory add "Server rules: Be respectful" title:"Rules"
/servermemory search query:"rules"
/updateservermemory id:def456 title:"Updated Rules"
/servermemory my limit:10                          # View your contributions
```

### Health & Diagnostics

```
/health                                           # Full system health check
/debug-memory user:@someone                       # Debug user memory (admin)
/digest period:daily include_stats:true           # Server activity digest
```

## Additional Documentation

- [User Guide](USER_GUIDE.md) - Complete command reference and usage
- [Video Generation Guide](VIDEO_GENERATION.md) - AI video creation with Sora 2 ⭐ NEW
- [Technical Documentation](TECHNICAL_DOCS.md) - Development and architecture details
- [Testing Guide](TESTING_GUIDE.md) - Test procedures and scenarios
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions

## Contributing

### Development Guidelines

- Code organization: Keep business logic in utility modules
- Error handling: Use `safeAsync` wrapper for all async operations
- Testing: Add tests for new features and bug fixes
- Documentation: Update README and technical docs for changes

### Testing Standards

- Mock external APIs: Prevent costs during testing
- Comprehensive coverage: Test both success and failure scenarios
- Integration tests: Verify commands load and function properly
- Unit tests: Test individual utility functions in isolation

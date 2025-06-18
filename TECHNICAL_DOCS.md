# Bepo Bot - Technical Documentation

## System Architecture Changes

### Memory System Implementation

#### Database Schema
```sql
CREATE TABLE user_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    memory_content TEXT NOT NULL,
    context_type TEXT DEFAULT 'conversation',
    metadata JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_memory_user_id ON user_memory(user_id);
CREATE INDEX idx_user_memory_context_type ON user_memory(context_type);
CREATE INDEX idx_user_memory_expires_at ON user_memory(expires_at);
```

#### Core Functions (`src/supabase/supabase.js`)
- `storeUserMemory()` - Store memories with expiration and metadata
- `getUserMemories()` - Retrieve user memories with filtering
- `searchUserMemories()` - Search memories by content and type
- `getUserPreferences()` - Get user preferences 
- `setUserPreference()` - Set individual preferences
- `deleteUserMemories()` - Clear memories by type
- `cleanupExpiredMemories()` - Automatic cleanup of expired data
- `buildMemoryContext()` - Build AI context from relevant memories

#### Memory Types
- `conversation` - User messages and bot responses
- `preference` - User settings (name, timezone, language, etc.)
- `conversation_summary` - Condensed conversation overviews
- `temporary` - Short-term contextual memory (24h default)
- `mood` - User emotional state and temporary preferences

### Thread Management System

#### Thread Tracking (`src/utils/utils.js`)
```javascript
export const botThreadStore = new Map(); // Tracks bot-created threads

// Thread data structure:
{
  threadId: string,
  userId: string, 
  parentChannelId: string,
  createdAt: Date,
  lastActivity: Date,
  isManaged: boolean
}
```

#### Key Functions
- `isBotManagedThread()` - Check if thread is bot-managed
- `markThreadAsBotManaged()` - Add thread to tracking system
- `updateThreadActivity()` - Update last activity timestamp
- `cleanupOldBotThreads()` - Remove old thread references
- `checkAndDeleteInactiveThreads()` - Auto-delete inactive threads

#### Thread Lifecycle
1. **Creation**: Thread created via `/thread` or `/continue create_thread:true`
2. **Tracking**: Added to `botThreadStore` with metadata
3. **Activity Monitoring**: Updates on every message in thread
4. **Auto-Delete**: Threads deleted after 1 hour of inactivity
5. **Cleanup**: References removed from tracking system

### Digest System Implementation

#### Data Collection (`src/commands/fun/digest.js`)
- **Channel Filtering**: Text channels only, excludes voice/categories
- **Message Fetching**: Batched requests with rate limiting (150ms delays)
- **Time Windows**: Flexible periods (1h, 12h, daily, weekly)
- **Content Processing**: Message truncation and formatting for AI

#### AI Analysis Integration
- **xAI/Grok Integration**: Uses Grok-3-mini for digest generation
- **Context Building**: Recent messages with user context
- **Intelligent Summarization**: Identifies key topics, quotes, and activities
- **Statistics**: Optional detailed server statistics

### Emoji Reaction System

#### Meme Filter (`src/utils/utils.js`)
```javascript
const sillyProbability = 0.004; // 1/250 chance
const probability = 0.18; // 18% for other reactions

// Reaction types:
- Silly reaction: Custom 'lickinglips' emoji (1/250 chance)
- Love reactions: For "pex" mentions (18% chance) 
- Prayer reactions: For religious terms (18% chance)
- Dislike reactions: For specific games (18% chance)
```

#### Custom Emoji Implementation
- **Primary**: Custom `lickinglips` emoji from server
- **Fallback**: Unicode emoji if custom unavailable
- **Silent Operation**: No console logging in production
- **Error Handling**: Graceful failure with multiple fallback layers

## Performance Optimizations

### Database Efficiency
- **Indexed Queries**: All common lookups use database indexes
- **Batch Operations**: Multiple operations combined where possible
- **Automatic Cleanup**: Expired data removed via scheduled jobs
- **Connection Pooling**: Supabase handles connection management

### Memory Management
- **Conversation Store**: In-memory Map for active conversations
- **Thread Store**: Separate Map for thread tracking
- **Expiration**: 30-minute expiration for conversation cache
- **Cleanup Intervals**: Regular cleanup of old data structures

### Rate Limiting
- **Discord API**: Proper delays between API calls
- **Message Fetching**: 150ms delays between batch requests
- **Emoji Reactions**: Randomized delays (1-4 seconds)
- **AI Requests**: Built-in OpenAI client rate limiting

## Integration Points

### Bot Message Handler (`src/bot.js`)
```javascript
// Main message processing flow:
1. Check if bot should respond (mentions, prefix, managed thread)
2. Apply meme filters for reactions
3. Build conversation context with memory
4. Process images/GIFs if present  
5. Generate AI response with context
6. Store conversation in memory system
7. Update thread activity if applicable
```

### Memory Context Integration
- **AI Prompts**: Relevant memories injected into AI context
- **User Preferences**: Applied to response generation
- **Conversation History**: Recent messages included automatically
- **Smart Filtering**: Only relevant memories used (not everything)

### Thread Auto-Management
- **Background Processing**: Cleanup runs every 30 minutes
- **Activity Tracking**: Updates on every thread message
- **Graceful Deletion**: Warning message before thread removal
- **State Synchronization**: Thread store kept in sync with Discord

## Error Handling & Resilience

### Database Operations
```javascript
try {
  // Database operation
} catch (error) {
  console.error('Database error:', error);
  // Graceful fallback (continue without memory)
  return fallbackResponse;
}
```

### Discord API Operations
- **Rate Limit Handling**: Built into Discord.js client
- **Permission Checks**: Verify bot permissions before operations
- **Graceful Degradation**: Continue functioning if non-critical features fail
- **Retry Logic**: Automatic retries for transient failures

### AI Service Integration
- **API Key Validation**: Check for API key presence
- **Model Fallbacks**: Multiple AI providers configured
- **Timeout Handling**: Reasonable timeouts for AI requests
- **Context Limits**: Respect token limits for AI models

## Troubleshooting Guide

### Memory System Issues

**Problem**: Memories not being stored
- Check Supabase connection and credentials
- Verify database schema and RLS policies
- Check console for database errors
- Ensure user has permission to insert data

**Problem**: Memory retrieval slow
- Check database indexes exist
- Monitor query performance in Supabase dashboard
- Consider reducing memory retention period
- Optimize query patterns

### Thread Management Issues

**Problem**: Threads not auto-deleting
- Check `botThreadStore` for thread tracking
- Verify cleanup interval is running (every 30 minutes)
- Check Discord permissions for thread deletion
- Monitor console for thread cleanup errors

**Problem**: Bot not responding in threads
- Verify thread is marked as bot-managed
- Check thread permissions and archived status
- Ensure thread is in `botThreadStore`
- Check if thread creation succeeded

### Digest Generation Issues

**Problem**: Empty or failed digests
- Check channel permissions for message fetching
- Verify time window calculations
- Monitor API rate limits
- Check xAI/OpenAI API key validity

**Problem**: Digest takes too long
- Reduce `maxAttempts` in fetch loops
- Increase delay between API calls
- Limit number of channels scanned
- Optimize message processing

### Emoji Reactions Issues

**Problem**: Custom emoji not working
- Verify bot is in server with custom emoji
- Check emoji name matches exactly ('lickinglips')
- Ensure bot has reaction permissions
- Verify emoji isn't deleted or renamed

**Problem**: Reactions happening too frequently
- Check `sillyProbability` value (should be 0.004)
- Verify randomization logic
- Monitor reaction logs if debugging enabled

### General Debug Steps

1. **Check Console Logs**: Look for error messages and warnings
2. **Verify Environment Variables**: Ensure all required env vars are set
3. **Test Database Connection**: Run simple query to verify Supabase connection
4. **Check Bot Permissions**: Verify bot has necessary Discord permissions
5. **Monitor API Usage**: Check API quotas and rate limits
6. **Review Error Handlers**: Ensure error handling isn't masking issues

### Performance Monitoring

**Memory Usage:**
```javascript
// Check conversation store size
console.log('Active conversations:', convoStore.size);
console.log('Tracked threads:', botThreadStore.size);
```

**Database Health:**
- Monitor Supabase dashboard for query performance
- Check for slow queries and missing indexes
- Monitor storage usage and retention policies

**API Rate Limits:**
- Monitor Discord API rate limit headers
- Check OpenAI/xAI usage in respective dashboards
- Adjust delays if approaching limits

## Security Considerations

### Data Privacy
- User memories stored with user consent (implicit through bot usage)
- RLS policies prevent cross-user data access
- Automatic expiration of sensitive temporary data
- User control over data deletion via `/memory clear`

### API Security
- Environment variables for all API keys
- No hardcoded credentials in codebase
- Supabase RLS policies for data isolation
- Input validation on all user inputs

### Discord Security
- Minimal required permissions requested
- Ephemeral responses for sensitive commands
- Thread permissions properly managed
- Rate limiting to prevent abuse

# Bepo Bot - User Guide

## New Features & Commands

### Memory System

Bepo now remembers your conversations and preferences across all interactions.

#### Memory Commands

```
/memory view [type]         # View your stored memories
/memory clear <type>        # Clear specific types of memories
/memory set <key> <value>   # Set personal preferences
/memory stats               # View memory usage statistics
/updatememory <id> [content] [context_type]  # Update existing memories
```

**Examples:**

```
/memory view                           # See all memories
/memory view type:conversations        # See conversation history
/memory set key:name value:Alex        # Set your name
/memory set key:timezone value:EST     # Set timezone
/memory set key:interests value:coding,gaming  # Set interests
/memory clear type:conversations       # Clear conversation history
/memory stats                          # View memory statistics
/updatememory id:abc123 content:"Updated memory content"  # Update memory
/updatememory id:def456 context_type:temporary            # Change memory type
```

**Memory Update Features:**
- ✅ **Update Content**: Change the text of any of your memories
- ✅ **Change Type**: Convert between conversation, summary, temporary, or personal note
- ✅ **ID-Based**: Use memory IDs shown in `/memory view` to target specific memories
- ✅ **Safe Updates**: Only you can update your own memories

### Thread Management

Create organized Discord threads for longer conversations.

#### Thread Commands

```
/continue [topic] [create_thread:true]  # Continue conversation + optional thread
/thread [name]                          # Create dedicated conversation thread
/review [thread]                        # Review conversation history
```

**Examples:**

```
/continue topic:gaming create_thread:true    # Resume gaming chat in new thread
/thread name:Python Help                    # Create thread named "Python Help"
/thread                                      # Create auto-named thread
/review thread:1                             # Review most recent conversation
```

#### Thread Features

- **Auto-Response**: Bot responds to ALL messages in bot-created threads (no @ needed)
- **AI-Powered Naming**: Auto-generates relevant thread names based on conversation
- **Auto-Delete**: Threads auto-delete after 1 hour of inactivity
- **Context Preservation**: Full conversation history maintained when switching to a thread

### Server Digest System

Get AI-powered summaries of server activity.

#### Digest Commands

```
/digest [period] [include_stats]        # Generate server activity digest
```

**Examples:**

```
/digest period:daily                    # Daily server summary
/digest period:weekly include_stats:true  # Weekly digest with detailed stats
/digest period:12h                      # Last 12 hours activity
/digest period:1h include_stats:true    # Last hour with stats
```

**Periods Available:**

- `daily` - Last 24 hours
- `weekly` - Last 7 days
- `12h` - Last 12 hours
- `1h` - Last hour

### Server Memory System

Store and access memories that are shared across the entire Discord server. All server members can view and search these memories.

#### Server Memory Commands

```
/servermemory add <content> [title]     # Add a server memory
/servermemory list [filter] [limit]     # View server memories
/servermemory search <query>            # Search server memories
/servermemory delete <memory_id>        # Delete your own memories
/servermemory stats                     # View server memory statistics
/servermemory my [limit]                # View your memories for this server
/updateservermemory <id> [content] [title] [context_type]  # Update server memories
```

**Examples:**

```
/servermemory add content:"Server restart scheduled for Friday 8PM" title:"Maintenance"
/servermemory list                      # View all server memories
/servermemory search query:"restart"    # Find memories about restarts
/servermemory stats                     # View server memory statistics
/servermemory my                        # View your contributions
/servermemory delete memory_id:abc123   # Delete your own memory (or any if admin)
/updateservermemory id:abc123 content:"Updated maintenance info"  # Update content
/updateservermemory id:def456 title:"New Title" context_type:important  # Update title & type
```

**Server Memory Update Features:**
- ✅ **Update Content**: Modify the information in server memories
- ✅ **Update Titles**: Change memory titles for better organization
- ✅ **Change Context Types**: Set as server, rules, FAQ, or important
- ✅ **Permission Control**: Update your own memories, admins can update any
- ✅ **ID-Based**: Use memory IDs from `/servermemory list` to target specific memories

#### Admin Features (CODE_MONKEY only)

When CODE_MONKEY uses server memory commands, they get enhanced capabilities:
- **Full Memory IDs**: `list` and `search` commands show complete UUIDs instead of short IDs
- **Delete Any Memory**: Can delete any memory using its full ID, not just their own
- **Admin Indicators**: Footer messages indicate admin privileges are available

**Features:**
- ✅ **Shared Knowledge**: All users can view and search server memories
- ✅ **Smart Integration**: Bot references server memories in conversations
- ✅ **User Attribution**: Shows who added each memory
- ✅ **Conditional Admin**: Admin features only visible to CODE_MONKEY

### Funny Update

Bepo now has some silly surprise reactions that might randomly appear in chat.

## How It All Works Together

### Getting Started

1. **Start chatting** with Bepo using `@Bepo` or the bot prefix
2. **Your conversation is remembered** automatically in the memory system
3. **Create a thread** using `/thread` or `/continue create_thread:true`
4. **Add server knowledge** using `/servermemory add` for information everyone should know
5. **Update memories** as information changes using the update commands

### Finding Memory IDs for Updates

To update a memory, you need its ID. Here's how to find them:

**Personal Memories:**
- Use `/memory view` to see your memories with their IDs
- IDs are shown as `ID: abc123def456...` in the memory listings

**Server Memories:**
- Use `/servermemory list` to see server memories with their IDs
- Regular users see short IDs (first 8 characters): `ID: abc123de`
- Admins see full IDs for complete management capabilities

**Example Workflow:**
1. `/memory view` → Find memory with ID `abc123def456`
2. `/updatememory id:abc123def456 content:"My updated memory"`
3. Memory is updated with new content and timestamp

### Thread Features
- **No @ mentions needed** in bot-created threads
- **Auto-cleanup** prevents server clutter
- **Smart naming** using AI topic detection

### Digest Benefits

- **Server insights** - see what's been happening
- **Community highlights** - funny quotes and memorable moments
- **Activity tracking** - busiest channels and active users
- **Flexible timeframes** - from 1 hour to weekly summaries

## Tips & Best Practices

### For Memory System

- Set preferences early: `/memory set key:name value:YourName`
- Review memories periodically: `/memory view`
- Clear old data when needed: `/memory clear type:conversations`

### For Threads

- Use descriptive names: `/thread name:React Bug Fix`
- Let AI name threads for variety: `/thread` (no name specified)
- Create threads for complex topics to keep main chat clean

### For Digests

- Use `include_stats:true` for detailed server analysis
- Try different time periods to find what interests you
- Great for catching up after being away from the server

All features work together - your memory persists across threads, digests can reference your conversations, and everything stays organized and accessible.

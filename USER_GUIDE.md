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
```

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

### Funny Update

Bepo now has some silly surprise reactions that might randomly appear in chat.

## How It All Works Together

### Getting Started

1. **Start chatting** with Bepo using `@Bepo` or the bot prefix
2. **Your conversation is remembered** automatically in the memory system
3. **Create a thread** using `/thread` or `/continue create_thread:true` for organized chats
4. **Review history** anytime with `/review` or `/memory view`
5. **Get server insights** with `/digest` commands

### Example Workflow

```
1. @Bepo help me with Python code     # Start conversation
2. /thread name:Python Help           # Create organized thread
3. [Continue chatting in thread]      # Bot auto-responds, no @ needed
4. /memory set key:language value:Python  # Save your preference
5. /review                            # Review full conversation later
6. /digest period:daily               # See what happened on server today
```

### Memory Benefits

- **Personalized responses** based on your preferences and history
- **Context continuity** across different chat sessions
- **Learning from interactions** to provide better help over time
- **User control** - view, manage, and clear your data anytime

### Thread Benefits

- **Organized conversations** by topic
- **Clean main channels** - long chats move to dedicated threads
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

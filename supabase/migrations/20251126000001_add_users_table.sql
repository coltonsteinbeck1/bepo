-- Migration 001: Create Users Table for Caching and Attribution
-- Purpose: Cache Discord user info to eliminate N+1 queries and provide clear message attribution
-- This prevents memory corruption by clearly tracking who said what

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable trigram extension for fuzzy username matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create users table with proper constraints
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discord_id TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT,
    custom_name TEXT,              -- For personalized responses (future /setname command)
    avatar_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure discord_id is valid
    CONSTRAINT valid_discord_id CHECK (discord_id ~ '^\d+$'),
    -- Ensure username is not empty
    CONSTRAINT valid_username CHECK (length(trim(username)) > 0)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_custom_name ON users(custom_name) WHERE custom_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen DESC);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER users_updated_at_trigger
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

-- Create migration tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS migration_history (
    migration_id TEXT PRIMARY KEY,
    description TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create migration tracking record
INSERT INTO migration_history (migration_id, description, applied_at)
VALUES ('001', 'Create users table for caching and attribution', NOW())
ON CONFLICT (migration_id) DO NOTHING;

-- Grant permissions (adjust role as needed)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE users IS 'Caches Discord user information to prevent N+1 queries and provide clear message attribution';
COMMENT ON COLUMN users.discord_id IS 'Discord user ID (snowflake)';
COMMENT ON COLUMN users.custom_name IS 'User-set custom name for personalized bot responses';
COMMENT ON COLUMN users.metadata IS 'Additional user metadata (preferences, settings, etc.)';

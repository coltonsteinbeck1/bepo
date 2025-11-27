-- Migration 002: Add Performance Indexes and Fix Memory Relevance
-- Purpose: Speed up queries and improve memory retrieval accuracy
-- This prevents irrelevant memories from being retrieved (reducing false pings)

-- Add full-text search index for user_memory (replaces slow ILIKE queries)
CREATE INDEX IF NOT EXISTS idx_user_memory_content_fts 
ON user_memory USING GIN (to_tsvector('english', memory_content));

-- Add composite index for common user memory queries
CREATE INDEX IF NOT EXISTS idx_user_memory_user_context_date 
ON user_memory(user_id, context_type, created_at DESC);

-- Add index for preference lookups (fastest path)
CREATE INDEX IF NOT EXISTS idx_user_memory_preferences 
ON user_memory(user_id, context_type) 
WHERE context_type = 'preference';

-- Add index for conversation summaries (batched memories)
CREATE INDEX IF NOT EXISTS idx_user_memory_summaries 
ON user_memory(user_id, context_type, created_at DESC) 
WHERE context_type = 'conversation_summary';

-- Add metadata index for channel/guild filtering
CREATE INDEX IF NOT EXISTS idx_user_memory_metadata 
ON user_memory USING GIN (metadata jsonb_path_ops);

-- Add full-text search index for server_memory
CREATE INDEX IF NOT EXISTS idx_server_memory_content_fts 
ON server_memory USING GIN (to_tsvector('english', memory_content));

-- Add full-text search index for server_memory title
CREATE INDEX IF NOT EXISTS idx_server_memory_title_fts 
ON server_memory USING GIN (to_tsvector('english', memory_title));

-- Add composite index for server memory queries
CREATE INDEX IF NOT EXISTS idx_server_memory_server_context_date 
ON server_memory(server_id, context_type, created_at DESC);

-- Add index for server knowledge lookups
CREATE INDEX IF NOT EXISTS idx_server_memory_knowledge 
ON server_memory(server_id, context_type) 
WHERE context_type = 'knowledge';

-- Add metadata index for server memory
CREATE INDEX IF NOT EXISTS idx_server_memory_metadata 
ON server_memory USING GIN (metadata jsonb_path_ops);

-- Add index for expires_at cleanup queries
CREATE INDEX IF NOT EXISTS idx_user_memory_expires 
ON user_memory(expires_at) 
WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_server_memory_expires 
ON server_memory(expires_at) 
WHERE expires_at IS NOT NULL;

-- Create helper function for better relevance scoring
CREATE OR REPLACE FUNCTION calculate_memory_relevance(
    memory_text TEXT,
    search_text TEXT,
    memory_age_days NUMERIC,
    is_summary BOOLEAN DEFAULT FALSE
)
RETURNS NUMERIC AS $$
DECLARE
    relevance_score NUMERIC := 0;
    keyword_matches INT := 0;
    exact_phrase_bonus NUMERIC := 0;
BEGIN
    -- Calculate keyword match score (30% weight)
    keyword_matches := (
        SELECT COUNT(*)
        FROM unnest(string_to_array(lower(search_text), ' ')) AS keyword
        WHERE lower(memory_text) LIKE '%' || keyword || '%'
    );
    relevance_score := relevance_score + (keyword_matches * 0.3);
    
    -- Exact phrase match bonus (40% weight)
    IF lower(memory_text) LIKE '%' || lower(search_text) || '%' THEN
        exact_phrase_bonus := 0.4;
    END IF;
    relevance_score := relevance_score + exact_phrase_bonus;
    
    -- Recency score (20% weight) - decay over 30 days
    relevance_score := relevance_score + (0.2 * (1 - LEAST(memory_age_days / 30.0, 1.0)));
    
    -- Summary bonus (10% weight) - summaries are more relevant
    IF is_summary THEN
        relevance_score := relevance_score + 0.1;
    END IF;
    
    RETURN relevance_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create migration tracking record
INSERT INTO migration_history (migration_id, description, applied_at)
VALUES ('002', 'Add performance indexes and relevance scoring', NOW())
ON CONFLICT (migration_id) DO NOTHING;

COMMENT ON FUNCTION calculate_memory_relevance IS 'Calculates memory relevance score based on keyword matches, phrase matches, recency, and summary status';

-- Migration 003: Add Vector Embeddings for Semantic Search
-- Purpose: Enable semantic similarity search for better memory retrieval
-- Uses OpenAI text-embedding-3-small (1536 dimensions)

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns to user_memory
ALTER TABLE user_memory ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add embedding columns to server_memory
ALTER TABLE server_memory ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create vector similarity indexes (using ivfflat for faster approximate search)
-- Note: These indexes improve performance but require some initial data to be optimal
CREATE INDEX IF NOT EXISTS idx_user_memory_embedding 
ON user_memory USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_server_memory_embedding 
ON server_memory USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create function for semantic search of user memories
CREATE OR REPLACE FUNCTION match_user_memories(
    query_embedding vector(1536),
    match_user_id text,
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    user_id text,
    memory_content text,
    context_type text,
    metadata jsonb,
    created_at timestamp,
    updated_at timestamp,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        um.id,
        um.user_id,
        um.memory_content,
        um.context_type,
        um.metadata,
        um.created_at,
        um.updated_at,
        1 - (um.embedding <=> query_embedding) as similarity
    FROM user_memory um
    WHERE um.user_id = match_user_id
        AND um.embedding IS NOT NULL
        AND (um.expires_at IS NULL OR um.expires_at > NOW())
        AND 1 - (um.embedding <=> query_embedding) > match_threshold
    ORDER BY um.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Create function for semantic search of server memories
CREATE OR REPLACE FUNCTION match_server_memories(
    query_embedding vector(1536),
    match_server_id text,
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    server_id text,
    user_id text,
    memory_content text,
    memory_title text,
    context_type text,
    metadata jsonb,
    created_at timestamp,
    updated_at timestamp,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sm.id,
        sm.server_id,
        sm.user_id,
        sm.memory_content,
        sm.memory_title,
        sm.context_type,
        sm.metadata,
        sm.created_at,
        sm.updated_at,
        1 - (sm.embedding <=> query_embedding) as similarity
    FROM server_memory sm
    WHERE sm.server_id = match_server_id
        AND sm.embedding IS NOT NULL
        AND (sm.expires_at IS NULL OR sm.expires_at > NOW())
        AND 1 - (sm.embedding <=> query_embedding) > match_threshold
    ORDER BY sm.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Create function to check if embeddings are being generated
CREATE OR REPLACE FUNCTION get_embedding_stats()
RETURNS TABLE (
    table_name text,
    total_rows bigint,
    rows_with_embeddings bigint,
    percentage numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'user_memory'::text,
        COUNT(*)::bigint,
        COUNT(embedding)::bigint,
        ROUND(100.0 * COUNT(embedding) / NULLIF(COUNT(*), 0), 2)
    FROM user_memory
    UNION ALL
    SELECT 
        'server_memory'::text,
        COUNT(*)::bigint,
        COUNT(embedding)::bigint,
        ROUND(100.0 * COUNT(embedding) / NULLIF(COUNT(*), 0), 2)
    FROM server_memory;
END;
$$;

-- Create migration tracking record
INSERT INTO migration_history (migration_id, description, applied_at)
VALUES ('003', 'Add vector embeddings for semantic search', NOW())
ON CONFLICT (migration_id) DO NOTHING;

-- Add helpful comments
COMMENT ON COLUMN user_memory.embedding IS 'OpenAI text-embedding-3-small (1536 dimensions) for semantic search';
COMMENT ON COLUMN server_memory.embedding IS 'OpenAI text-embedding-3-small (1536 dimensions) for semantic search';
COMMENT ON FUNCTION match_user_memories IS 'Semantic search for user memories using cosine similarity';
COMMENT ON FUNCTION match_server_memories IS 'Semantic search for server memories using cosine similarity';
COMMENT ON FUNCTION get_embedding_stats IS 'Check embedding generation progress';

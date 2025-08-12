import OpenAI from 'openai'

// Get OpenAI embedding for a query string
async function getQueryEmbedding(text) {
  if (!process.env.OPENAI_KEY) {
    throw new Error('OPENAI_KEY not set')
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY })
  const { data } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  })
  return data[0].embedding
}

// Fetch top matches from Supabase pgvector RPC using the query embedding
export async function fetchRagMatches(supabase, text, {
  matchCount = 5,
  threshold = 0.2,
  filter = {}
} = {}) {
  const embedding = await getQueryEmbedding(text)
  const { data, error } = await supabase.rpc('match_rag_documents', {
    query_embedding: embedding,
    match_count: matchCount,
    match_threshold: threshold,
    filter
  })
  if (error) throw error
  return data || []
}

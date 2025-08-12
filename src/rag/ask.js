import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

dotenv.config()

async function embedQuery(openai, text) {
  const { data } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  })
  return data[0].embedding
}

async function searchContext(supabase, queryEmbedding, matchCount = 5, threshold = 0.2, filter = {}) {
  const { data, error } = await supabase
    .rpc('match_rag_documents', {
      query_embedding: queryEmbedding,
      match_count: matchCount,
      match_threshold: threshold,
      filter
    })
  if (error) throw error
  return data
}

function buildPrompt(question, contexts) {
  const header = 'You are a concise assistant. Answer using only the context. If unknown, say you do not know.'
  const contextBlock = contexts.map((c, i) => `Source ${i+1} (sim=${c.similarity.toFixed(2)}):\n${c.content}`).join('\n\n')
  return `${header}\n\nContext:\n${contextBlock}\n\nQuestion: ${question}\nAnswer:`
}

async function main() {
  const question = process.argv.slice(2).join(' ').trim()
  if (!question) {
    console.error('Usage: node src/rag/ask.js <your question>')
    process.exit(1)
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY in environment')
    process.exit(1)
  }
  if (!process.env.OPENAI_KEY) {
    console.error('Missing OPENAI_KEY in environment')
    process.exit(1)
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY })

  const qEmbedding = await embedQuery(openai, question)
  const matches = await searchContext(supabase, qEmbedding, 6, 0.2)

  const prompt = buildPrompt(question, matches || [])
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Answer briefly and factually.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2
  })

  const answer = completion.choices?.[0]?.message?.content || '(no answer)'
  console.log('\nAnswer:\n' + answer + '\n')

  if ((matches || []).length) {
    console.log('Sources:')
    matches.forEach((m, i) => {
      const meta = m.metadata || {}
      console.log(` ${i+1}. sim=${m.similarity?.toFixed(2)} id=${m.id} ${meta.dataset ? `(dataset=${meta.dataset})` : ''}`)
    })
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

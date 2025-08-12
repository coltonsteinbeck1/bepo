import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import OpenAI from 'openai'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Simple CSV parser for small files (no quotes/escapes). For robust parsing, switch to 'csv-parse'.
function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map(h => h.trim())
  const rows = lines.slice(1).map(line => {
    const cols = line.split(',')
    const obj = {}
    headers.forEach((h, i) => obj[h] = (cols[i] || '').trim())
    return obj
  })
  return { headers, rows }
}

function toChunk(obj, joiner = '\n') {
  // Join columns into a single passage; keep metadata as the raw object
  const lines = Object.entries(obj).map(([k, v]) => `${k}: ${v}`)
  return { content: lines.join(joiner), metadata: obj }
}

async function embedTexts(openai, texts) {
  if (texts.length === 0) return []
  const input = texts.map(t => t.replace(/\s+/g, ' ').trim()).slice(0, 8192)
  const { data } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input
  })
  return data.map(d => d.embedding)
}

async function main() {
  const inputPath = process.argv[2]
  const datasetName = process.argv[3] || 'default'
  if (!inputPath) {
    console.error('Usage: node src/rag/ingestCsv.js <path/to/file.csv> [datasetName]')
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

  const absPath = path.isAbsolute(inputPath) ? inputPath : path.join(process.cwd(), inputPath)
  const csvRaw = fs.readFileSync(absPath, 'utf8')
  const { rows } = parseCsv(csvRaw)

  if (rows.length === 0) {
    console.log('No rows parsed from CSV')
    return
  }

  const chunks = rows.map(r => toChunk(r))
  const texts = chunks.map(c => c.content)
  console.log(`Embedding ${texts.length} rows with text-embedding-3-small...`)
  const embeddings = await embedTexts(openai, texts)

  console.log('Upserting into Supabase rag_documents...')
  const payload = chunks.map((c, i) => ({
    content: c.content,
    metadata: { ...c.metadata, dataset: datasetName },
    embedding: embeddings[i]
  }))

  // Insert in batches to avoid payload limits
  const batchSize = 200
  for (let i = 0; i < payload.length; i += batchSize) {
    const batch = payload.slice(i, i + batchSize)
    const { error } = await supabase.from('rag_documents').insert(batch)
    if (error) {
      console.error('Insert error:', error)
      process.exit(1)
    }
    console.log(`Inserted ${Math.min(i + batchSize, payload.length)}/${payload.length}`)
  }

  console.log('Done.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

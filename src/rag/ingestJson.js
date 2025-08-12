import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import OpenAI from 'openai'

dotenv.config()

function isObject(val) {
  return val && typeof val === 'object' && !Array.isArray(val)
}

function flattenObject(obj, prefix = '') {
  const out = {}
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k
    if (isObject(v)) {
      Object.assign(out, flattenObject(v, key))
    } else if (Array.isArray(v)) {
      // Represent arrays as comma-joined values; flatten objects inside arrays
      const arr = v.map(item => (isObject(item) ? JSON.stringify(item) : String(item))).join(', ')
      out[key] = arr
    } else {
      out[key] = String(v)
    }
  }
  return out
}

function toChunkFromObj(obj, joiner = '\n') {
  const flat = flattenObject(obj)
  const lines = Object.entries(flat).map(([k, v]) => `${k}: ${v}`)
  return { content: lines.join(joiner), metadata: obj }
}

function parseJsonInput(raw) {
  // Try JSON array first
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    if (isObject(parsed)) return [parsed]
  } catch (_) {
    // not a standard JSON file; try NDJSON
  }
  const lines = raw.split(/\r?\n/)
  const records = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      records.push(JSON.parse(trimmed))
    } catch (_) {
      // ignore malformed line
    }
  }
  return records
}

async function embedTexts(openai, texts) {
  if (!texts.length) return []
  const { data } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts.map(t => t.replace(/\s+/g, ' ').trim()).slice(0, 8192)
  })
  return data.map(d => d.embedding)
}

async function main() {
  const inputPath = process.argv[2]
  const datasetName = process.argv[3] || 'default'
  if (!inputPath) {
    console.error('Usage: node src/rag/ingestJson.js <path/to/file.json|ndjson> [datasetName]')
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
  const raw = fs.readFileSync(absPath, 'utf8')
  const records = parseJsonInput(raw)

  if (!records.length) {
    console.log('No JSON records parsed')
    return
  }

  const chunks = records.map(r => toChunkFromObj(r))
  const texts = chunks.map(c => c.content)
  console.log(`Embedding ${texts.length} JSON records with text-embedding-3-small...`)
  const embeddings = await embedTexts(openai, texts)

  console.log('Inserting into Supabase rag_documents...')
  const payload = chunks.map((c, i) => ({
    content: c.content,
    metadata: { ...c.metadata, dataset: datasetName },
    embedding: embeddings[i]
  }))

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

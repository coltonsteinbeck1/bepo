/**
 * Embedding Service for Semantic Memory Search
 * 
 * Uses OpenAI's text-embedding-3-small model for cost efficiency:
 * - Cost: $0.020 per 1M tokens (vs $0.130 for text-embedding-3-large)
 * - Dimensions: 1536 (can reduce to 512 for even lower cost)
 * - Performance: 62.3% on MTEB benchmark (vs 64.6% for large)
 * 
 * Cost Optimization Strategies:
 * 1. Only embed summaries (not individual messages)
 * 2. Batch embeddings requests (up to 2048 items per call)
 * 3. Cache embeddings in database
 * 4. Skip re-embedding unchanged content
 * 5. Use shorter dimension (512) if accuracy allows
 * 
 * Estimated Cost (Conservative):
 * - 100 memories/day × 200 tokens avg = 20k tokens/day
 * - 20k tokens × 30 days = 600k tokens/month
 * - 600k / 1M × $0.020 = $0.012/month (~1 cent)
 */

import OpenAI from 'openai';

class EmbeddingService {
  constructor() {
    // Initialize OpenAI lazily when first needed
    this._openai = null;
    
    // Use text-embedding-3-small for best cost/performance ratio
    this.model = 'text-embedding-3-small';
    this.dimensions = 1536; // Can reduce to 512 for 3x cost savings
    
    // Batch size for bulk operations (max 2048 per OpenAI API)
    this.batchSize = 100;
    
    // Cache for recently generated embeddings (prevent duplicate API calls)
    this.embeddingCache = new Map();
    this.cacheTTL = 60 * 60 * 1000; // 1 hour
    
    // Cost tracking (optional)
    this.totalTokensUsed = 0;
    
    console.log(`[EmbeddingService] Initialized with model: ${this.model} (${this.dimensions}d)`);
  }

  /**
   * Lazy initialization of OpenAI client
   * @returns {OpenAI|null}
   */
  getOpenAI() {
    if (!this._openai && process.env.OPENAI_KEY) {
      this._openai = new OpenAI({
        apiKey: process.env.OPENAI_KEY,
      });
    }
    return this._openai;
  }

  /**
   * Generate embedding for a single text
   * Uses cache to avoid redundant API calls
   * 
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} Embedding vector
   */
  async generateEmbedding(text) {
    const openai = this.getOpenAI();
    if (!openai) {
      console.warn('[EmbeddingService] OpenAI API key not configured, embeddings disabled');
      return null;
    }

    if (!text || text.trim().length === 0) {
      console.warn('[EmbeddingService] Empty text provided, returning null');
      return null;
    }

    // Truncate very long text (OpenAI max: 8191 tokens, ~30k chars)
    const maxLength = 8000; // Conservative limit
    const cleanText = text.slice(0, maxLength).trim();

    // Check cache first
    const cacheKey = this.getCacheKey(cleanText);
    const cached = this.embeddingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log('[EmbeddingService] Cache HIT');
      return cached.embedding;
    }

    try {
      const response = await openai.embeddings.create({
        model: this.model,
        input: cleanText,
        dimensions: this.dimensions, // Can set to 512 for cost savings
      });

      const embedding = response.data[0].embedding;
      
      // Track usage for cost monitoring
      this.totalTokensUsed += response.usage.total_tokens;
      
      // Cache the result
      this.embeddingCache.set(cacheKey, {
        embedding,
        timestamp: Date.now()
      });

      console.log(`[EmbeddingService] Generated embedding (${response.usage.total_tokens} tokens, $${this.estimateCost(response.usage.total_tokens)})`);

      return embedding;
    } catch (error) {
      console.error('[EmbeddingService] Error generating embedding:', error);
      return null;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * More efficient than individual calls
   * 
   * @param {string[]} texts - Array of texts to embed
   * @returns {Promise<Array<number[]|null>>} Array of embedding vectors
   */
  async generateEmbeddingsBatch(texts) {
    const openai = this.getOpenAI();
    if (!openai) {
      console.warn('[EmbeddingService] OpenAI API key not configured, returning nulls');
      return texts.map(() => null);
    }

    if (!texts || texts.length === 0) {
      return [];
    }

    // Filter out empty texts
    const validTexts = texts.map((t, idx) => ({ 
      text: t?.slice(0, 8000).trim() || '', 
      originalIndex: idx 
    })).filter(item => item.text.length > 0);

    if (validTexts.length === 0) {
      return texts.map(() => null);
    }

    // Split into batches (OpenAI limit: 2048, we use 100 for safety)
    const batches = [];
    for (let i = 0; i < validTexts.length; i += this.batchSize) {
      batches.push(validTexts.slice(i, i + this.batchSize));
    }

    const allEmbeddings = new Array(texts.length).fill(null);

    try {
      for (const batch of batches) {
        const response = await openai.embeddings.create({
          model: this.model,
          input: batch.map(item => item.text),
          dimensions: this.dimensions,
        });

        // Map embeddings back to original indices
        response.data.forEach((embeddingData, batchIdx) => {
          const originalIdx = batch[batchIdx].originalIndex;
          allEmbeddings[originalIdx] = embeddingData.embedding;
        });

        // Track usage
        this.totalTokensUsed += response.usage.total_tokens;
        
        console.log(`[EmbeddingService] Batch generated ${batch.length} embeddings (${response.usage.total_tokens} tokens, $${this.estimateCost(response.usage.total_tokens)})`);
      }

      return allEmbeddings;
    } catch (error) {
      console.error('[EmbeddingService] Error in batch generation:', error);
      return allEmbeddings;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   * Used for finding similar memories without database query
   * 
   * @param {number[]} embedding1 
   * @param {number[]} embedding2 
   * @returns {number} Similarity score (0-1, higher is more similar)
   */
  cosineSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
      return 0;
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Estimate cost of embedding generation
   * text-embedding-3-small: $0.020 per 1M tokens
   */
  estimateCost(tokens) {
    const costPerMillion = 0.020;
    return ((tokens / 1_000_000) * costPerMillion).toFixed(6);
  }

  /**
   * Get current cost statistics
   */
  getCostStats() {
    return {
      totalTokensUsed: this.totalTokensUsed,
      estimatedCost: this.estimateCost(this.totalTokensUsed),
      cacheSize: this.embeddingCache.size,
      model: this.model,
      dimensions: this.dimensions
    };
  }

  /**
   * Generate cache key for a text
   */
  getCacheKey(text) {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `embed_${hash}_${text.length}`;
  }

  /**
   * Cleanup expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    let removed = 0;

    for (const [key, cached] of this.embeddingCache.entries()) {
      if (now - cached.timestamp > this.cacheTTL) {
        this.embeddingCache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[EmbeddingService] Cleaned up ${removed} expired cache entries`);
    }
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.embeddingCache.clear();
    console.log('[EmbeddingService] Cache cleared');
  }

  /**
   * Set dimensions (512 for cost savings, 1536 for accuracy)
   */
  setDimensions(dimensions) {
    if (![512, 1536].includes(dimensions)) {
      throw new Error('Dimensions must be 512 or 1536');
    }
    this.dimensions = dimensions;
    this.embeddingCache.clear(); // Clear cache when changing dimensions
    console.log(`[EmbeddingService] Dimensions set to ${dimensions}`);
  }
}

// Singleton instance
const embeddingService = new EmbeddingService();

// Cleanup cache every 30 minutes
setInterval(() => {
  embeddingService.cleanupCache();
}, 30 * 60 * 1000);

export default embeddingService;

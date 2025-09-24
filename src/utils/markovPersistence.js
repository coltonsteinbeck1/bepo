import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MarkovPersistence {
  constructor(filePath = null) {
    this.filePath = filePath || path.join(__dirname, '../../data/markov-chain.json');
    this.lastSaveSize = 0; // Track size to avoid unnecessary saves
    this.lastSaveTime = 0; // Track time to avoid frequent saves
    this.isDirty = false; // Track if changes need saving
    this.pendingSave = false; // Track if save is in progress
  }

  // Mark chain as dirty (needs saving)
  markDirty() {
    this.isDirty = true;
  }

  async saveChain(markovChain, force = false) {
    try {
      const currentSize = Object.keys(markovChain.chain).length;
      const now = Date.now();
      const timeSinceLastSave = now - this.lastSaveTime;
      
      // Only save if:
      // - Forced
      // - Chain has grown significantly (50+ new entries)  
      // - At least 5 minutes have passed since last save AND chain has some growth
      // - Chain is dirty and significant time has passed
      if (!force && 
          (currentSize - this.lastSaveSize < 50) && 
          (timeSinceLastSave < 5 * 60 * 1000) && // 5 minutes
          !this.isDirty) {
        return true;
      }
      
      // Avoid multiple concurrent saves
      if (this.pendingSave) {
        console.log('Save already in progress, skipping...');
        return true;
      }
      
      this.pendingSave = true;
      
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      const data = {
        order: markovChain.order,
        chain: markovChain.chain,
        sentenceStarters: Array.from(markovChain.sentenceStarters),
        sentenceEnders: Array.from(markovChain.sentenceEnders),
        wordFrequency: markovChain.wordFrequency,
        contextWeights: markovChain.contextWeights,
        lastSaved: new Date().toISOString(),
        version: '2.1' // Increment version for performance improvements
      };

      // Use atomic write with temporary file for safety
      const tempFilePath = this.filePath + '.tmp';
      await fs.writeFile(tempFilePath, JSON.stringify(data, null, 2));
      await fs.rename(tempFilePath, this.filePath);
      
      this.lastSaveSize = currentSize;
      this.lastSaveTime = now;
      this.isDirty = false;
      this.pendingSave = false;
      
      console.log(`Markov chain saved with ${currentSize} keys (growth: ${currentSize - this.lastSaveSize})`);
      return true;
    } catch (error) {
      this.pendingSave = false;
      console.error('Failed to save markov chain:', error);
      return false;
    }
  }

  async loadChain(markovChain) {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(data);

      // Validate data structure
      if (!parsed.chain || !parsed.order) {
        console.warn('Invalid markov chain data structure');
        return false;
      }

      // Load data into markov chain
      markovChain.order = parsed.order;
      markovChain.chain = parsed.chain;
      markovChain.sentenceStarters = new Set(parsed.sentenceStarters || []);
      markovChain.sentenceEnders = new Set(parsed.sentenceEnders || []);
      markovChain.wordFrequency = parsed.wordFrequency || {};
      markovChain.contextWeights = parsed.contextWeights || {};

      console.log(`📖 Markov chain loaded with ${Object.keys(markovChain.chain).length} keys from ${parsed.lastSaved}`);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('No existing markov chain file found, starting fresh');
      } else {
        console.error('Failed to load markov chain:', error);
      }
      return false;
    }
  }

  async getStats() {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(data);
      
      return {
        chainSize: Object.keys(parsed.chain || {}).length,
        sentenceStarters: (parsed.sentenceStarters || []).length,
        sentenceEnders: (parsed.sentenceEnders || []).length,
        uniqueWords: Object.keys(parsed.wordFrequency || {}).length,
        lastSaved: parsed.lastSaved,
        version: parsed.version
      };
    } catch (error) {
      return null;
    }
  }
}

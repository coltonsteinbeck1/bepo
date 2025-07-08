import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MarkovPersistence {
  constructor(filePath = null) {
    this.filePath = filePath || path.join(__dirname, '../../data/markov-chain.json');
  }

  async saveChain(markovChain) {
    try {
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
        version: '2.0' // Track version for future compatibility
      };

      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2));
      console.log(`📁 Markov chain saved with ${Object.keys(markovChain.chain).length} keys`);
      return true;
    } catch (error) {
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
        console.log('📝 No existing markov chain file found, starting fresh');
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

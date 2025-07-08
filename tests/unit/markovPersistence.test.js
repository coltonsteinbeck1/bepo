import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Use dynamic imports to avoid potential circular dependency issues
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('MarkovPersistence', () => {
  let testFilePath;
  let persistence;
  let markovChain;
  let MarkovPersistence;
  let MarkovChain;

  beforeEach(async () => {
    // Dynamic imports
    const persistenceModule = await import('../../src/utils/markovPersistence.js');
    const chainModule = await import('../../src/utils/markovChaining.js');
    
    MarkovPersistence = persistenceModule.MarkovPersistence;
    MarkovChain = chainModule.default;
    
    // Create a unique test file path for each test
    testFilePath = path.join(__dirname, '../../temp', `test-markov-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`);
    persistence = new MarkovPersistence(testFilePath);
    markovChain = new MarkovChain(3);
  });

  afterEach(async () => {
    // Clean up test files with timeout protection
    try {
      await Promise.race([
        fs.unlink(testFilePath),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Cleanup timeout')), 1000))
      ]);
    } catch (error) {
      // File might not exist or cleanup failed, which is fine for tests
    }
  });

  describe('saveChain', () => {
    it('should save a simple markov chain to file', async () => {
      // Train the markov chain with some data
      markovChain.train("Hello world. This is a test sentence. Another sentence here.");
      
      const result = await persistence.saveChain(markovChain);
      
      expect(result).toBe(true);
      
      // Verify file exists
      const fileExists = await fs.access(testFilePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should save complete markov chain data structure', async () => {
      // Train with more complex data
      const trainingText = `
        The quick brown fox jumps over the lazy dog.
        Programming is fun and challenging.
        Machine learning models can generate text.
        Discord bots are awesome tools.
      `;
      
      markovChain.train(trainingText);
      
      await persistence.saveChain(markovChain);
      
      // Read and verify the saved data
      const savedData = JSON.parse(await fs.readFile(testFilePath, 'utf8'));
      
      expect(savedData).toHaveProperty('order', 3);
      expect(savedData).toHaveProperty('chain');
      expect(savedData).toHaveProperty('sentenceStarters');
      expect(savedData).toHaveProperty('sentenceEnders');
      expect(savedData).toHaveProperty('wordFrequency');
      expect(savedData).toHaveProperty('contextWeights');
      expect(savedData).toHaveProperty('lastSaved');
      expect(savedData).toHaveProperty('version', '2.0');
      
      // Verify data types
      expect(typeof savedData.order).toBe('number');
      expect(typeof savedData.chain).toBe('object');
      expect(Array.isArray(savedData.sentenceStarters)).toBe(true);
      expect(Array.isArray(savedData.sentenceEnders)).toBe(true);
      expect(typeof savedData.wordFrequency).toBe('object');
      expect(typeof savedData.contextWeights).toBe('object');
    });

    it('should create directory if it does not exist', async () => {
      const deepPath = path.join(__dirname, '../../temp/nested/deep/path/test-markov.json');
      const deepPersistence = new MarkovPersistence(deepPath);
      
      markovChain.train("Test data for deep path creation.");
      
      const result = await deepPersistence.saveChain(markovChain);
      
      expect(result).toBe(true);
      
      // Verify file exists at deep path
      const fileExists = await fs.access(deepPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      
      // Clean up
      await fs.unlink(deepPath).catch(() => {});
      // Clean up directories one by one to avoid recursive issues
      try {
        await fs.rmdir(path.dirname(deepPath));
        await fs.rmdir(path.dirname(path.dirname(deepPath)));
        await fs.rmdir(path.dirname(path.dirname(path.dirname(deepPath))));
        await fs.rmdir(path.dirname(path.dirname(path.dirname(path.dirname(deepPath)))));
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should handle save errors gracefully', async () => {
      // Create a persistence with an invalid path (directory as file)
      const invalidPath = '/dev/null/invalid/path/test.json';
      const invalidPersistence = new MarkovPersistence(invalidPath);
      
      markovChain.train("Test data for error handling.");
      
      // Mock console.error to avoid noise in test output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await invalidPersistence.saveChain(markovChain);
      
      expect(result).toBe(false);
      
      consoleSpy.mockRestore();
    });
  });

  describe('loadChain', () => {
    it('should load a previously saved markov chain', async () => {
      // First, train and save a markov chain
      const originalText = "The cat sat on the mat. Dogs like to play fetch. Birds can fly high.";
      markovChain.train(originalText);
      
      await persistence.saveChain(markovChain);
      
      // Create a new markov chain and load the data
      const newMarkovChain = new MarkovChain(3);
      const result = await persistence.loadChain(newMarkovChain);
      
      expect(result).toBe(true);
      expect(newMarkovChain.order).toBe(3);
      expect(Object.keys(newMarkovChain.chain).length).toBeGreaterThan(0);
      expect(newMarkovChain.sentenceStarters.size).toBeGreaterThan(0);
      expect(newMarkovChain.sentenceEnders.size).toBeGreaterThan(0);
      expect(Object.keys(newMarkovChain.wordFrequency).length).toBeGreaterThan(0);
    });

    it('should preserve exact data after save and load cycle', async () => {
      const trainingText = "Hello world this is a test. Another sentence follows here.";
      markovChain.train(trainingText);
      
      // Store original data
      const originalOrder = markovChain.order;
      const originalChain = JSON.stringify(markovChain.chain);
      const originalStarters = Array.from(markovChain.sentenceStarters).sort();
      const originalEnders = Array.from(markovChain.sentenceEnders).sort();
      const originalFrequency = JSON.stringify(markovChain.wordFrequency);
      
      // Save and load
      await persistence.saveChain(markovChain);
      const newMarkovChain = new MarkovChain(2); // Different order initially
      await persistence.loadChain(newMarkovChain);
      
      // Verify data preservation
      expect(newMarkovChain.order).toBe(originalOrder);
      expect(JSON.stringify(newMarkovChain.chain)).toBe(originalChain);
      expect(Array.from(newMarkovChain.sentenceStarters).sort()).toEqual(originalStarters);
      expect(Array.from(newMarkovChain.sentenceEnders).sort()).toEqual(originalEnders);
      expect(JSON.stringify(newMarkovChain.wordFrequency)).toBe(originalFrequency);
    });

    it('should handle missing file gracefully', async () => {
      const nonExistentPath = path.join(__dirname, '../../temp/non-existent-file.json');
      const nonExistentPersistence = new MarkovPersistence(nonExistentPath);
      
      // Mock console.log to avoid noise in test output
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const result = await nonExistentPersistence.loadChain(markovChain);
      
      expect(result).toBe(false);
      
      consoleSpy.mockRestore();
    });

    it('should handle corrupted file gracefully', async () => {
      // Create a corrupted JSON file
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, 'invalid json content');
      
      // Mock console.error to avoid noise in test output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await persistence.loadChain(markovChain);
      
      expect(result).toBe(false);
      
      consoleSpy.mockRestore();
    });

    it('should handle invalid data structure gracefully', async () => {
      // Create a file with invalid structure
      const invalidData = { invalid: 'structure', missing: 'required fields' };
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, JSON.stringify(invalidData));
      
      // Mock console.warn to avoid noise in test output
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const result = await persistence.loadChain(markovChain);
      
      expect(result).toBe(false);
      
      consoleSpy.mockRestore();
    });

    it('should handle backward compatibility with missing fields', async () => {
      // Create data with only basic fields (simulating older version)
      const basicData = {
        order: 3,
        chain: { "hello world test": ["sentence"] },
        version: "1.0"
      };
      
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, JSON.stringify(basicData));
      
      const result = await persistence.loadChain(markovChain);
      
      expect(result).toBe(true);
      expect(markovChain.order).toBe(3);
      expect(markovChain.chain).toEqual(basicData.chain);
      expect(markovChain.sentenceStarters.size).toBe(0); // Should default to empty
      expect(markovChain.sentenceEnders.size).toBe(0);
      expect(Object.keys(markovChain.wordFrequency).length).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics for saved chain', async () => {
      const trainingText = "Hello world. This is testing. More text here.";
      markovChain.train(trainingText);
      
      await persistence.saveChain(markovChain);
      
      const stats = await persistence.getStats();
      
      expect(stats).toBeTruthy();
      expect(stats).toHaveProperty('chainSize');
      expect(stats).toHaveProperty('sentenceStarters');
      expect(stats).toHaveProperty('sentenceEnders');
      expect(stats).toHaveProperty('uniqueWords');
      expect(stats).toHaveProperty('lastSaved');
      expect(stats).toHaveProperty('version');
      
      expect(typeof stats.chainSize).toBe('number');
      expect(stats.chainSize).toBeGreaterThan(0);
      expect(typeof stats.uniqueWords).toBe('number');
      // Only check uniqueWords if wordFrequency exists and has data
      if (stats.uniqueWords !== undefined) {
        expect(stats.uniqueWords).toBeGreaterThanOrEqual(0);
      }
      expect(stats.version).toBe('2.0');
    });

    it('should return null for non-existent file', async () => {
      const nonExistentPath = path.join(__dirname, '../../temp/non-existent-stats.json');
      const nonExistentPersistence = new MarkovPersistence(nonExistentPath);
      
      const stats = await nonExistentPersistence.getStats();
      
      expect(stats).toBeNull();
    });

    it('should return null for corrupted file', async () => {
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, 'corrupted json');
      
      const stats = await persistence.getStats();
      
      expect(stats).toBeNull();
    });
  });

  describe('constructor', () => {
    it('should use default path when none provided', () => {
      const defaultPersistence = new MarkovPersistence();
      
      expect(defaultPersistence.filePath).toContain('markov-chain.json');
      expect(defaultPersistence.filePath).toContain('data');
    });

    it('should use provided path', () => {
      const customPath = '/custom/path/markov.json';
      const customPersistence = new MarkovPersistence(customPath);
      
      expect(customPersistence.filePath).toBe(customPath);
    });
  });

  describe('integration tests', () => {
    it('should handle multiple save and load cycles', async () => {
      // First training session
      markovChain.train("First training session with some text.");
      await persistence.saveChain(markovChain);
      
      // Second training session (add more data)
      markovChain.train("Second training session with different content.");
      await persistence.saveChain(markovChain);
      
      // Load into new chain
      const newChain = new MarkovChain(3);
      const result = await persistence.loadChain(newChain);
      
      expect(result).toBe(true);
      expect(Object.keys(newChain.chain).length).toBeGreaterThan(0);
    }, 10000);

    it('should preserve generation capability after save/load', async () => {
      const complexText = `
        The quick brown fox jumps over the lazy dog.
        In a hole in the ground there lived a hobbit.
        It was the best of times, it was the worst of times.
      `;
      
      markovChain.train(complexText);
      
      await persistence.saveChain(markovChain);
      
      const newChain = new MarkovChain(3);
      await persistence.loadChain(newChain);
      
      const newGeneration = newChain.generate(null, 20, true); // Reduced length
      
      // Should be able to generate text
      expect(newGeneration.length).toBeGreaterThan(0);
      expect(newGeneration.split(' ').length).toBeGreaterThan(5);
    }, 10000);
  });
});

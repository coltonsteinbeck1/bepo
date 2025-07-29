export default class MarkovChain {
  constructor(order = 2) {
    this.order = order;
    this.chain = {};
    this.sentenceStarters = new Set(); // Track sentence beginnings
    this.sentenceEnders = new Set(); // Track sentence endings
    this.wordFrequency = {}; // Track word frequency for better selection
    this.contextWeights = {}; // Weight certain transitions higher
    // Add regex for user ID detection
    this.userIdRegex = /<@!?(\d+)>/g;
    // Store user ID to username mappings
    this.userMappings = new Map();
  }

  // Method to set user mappings from Discord client
  setUserMappings(client) {
    if (client && client.users) {
      client.users.cache.forEach(user => {
        this.userMappings.set(user.id, user.displayName || user.username);
      });
    }
  }

  // Clean and preprocess text before training
  preprocessText(text) {
    // Replace user IDs with usernames or remove them
    let cleanedText = text.replace(this.userIdRegex, (match, userId) => {
      const username = this.userMappings.get(userId);
      return username ? `@${username}` : ''; // Replace with @username or remove
    });

    // Remove URLs
    cleanedText = cleanedText.replace(/https?:\/\/[^\s]+/g, '');
    
    // Remove excessive whitespace
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
    
    if (!cleanedText || cleanedText.length < 10) return [];

    // Split into sentences more flexibly
    const sentences = cleanedText
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 5 && s.split(' ').length >= 3) // Minimum 3 words
      .map(s => s.replace(/[^\w\s'-@]/g, ' ').replace(/\s+/g, ' ').trim());
    
    return sentences;
  }

  train(text) {
    if (!text || text.length < 10) return;

    // Preprocess the text
    const sentences = this.preprocessText(text);
    if (!sentences || sentences.length === 0) return;
    
    for (const sentence of sentences) {
      const words = sentence.split(/\s+/).filter(word => word.length > 0);
      if (words.length < this.order + 1) continue;

      // Track word frequency
      words.forEach(word => {
        this.wordFrequency[word] = (this.wordFrequency[word] || 0) + 1;
      });

      // Track sentence starters (first few words)
      if (words.length >= this.order) {
        const starter = words.slice(0, this.order).join(" ");
        this.sentenceStarters.add(starter);
      }

      // Track sentence enders (last few words) 
      if (words.length >= this.order) {
        const ender = words.slice(-this.order).join(" ");
        this.sentenceEnders.add(ender);
      }

      // Build the chain with more flexible transitions
      for (let i = 0; i <= words.length - this.order; i++) {
        const key = words.slice(i, i + this.order).join(" ");
        const nextWord = words[i + this.order];
        
        if (!this.chain[key]) {
          this.chain[key] = [];
        }
        
        if (nextWord) {
          this.chain[key].push(nextWord);
          
          // Weight transitions based on context
          const transitionKey = `${key}|${nextWord}`;
          this.contextWeights[transitionKey] = (this.contextWeights[transitionKey] || 0) + 1;
        }
      }
    }
  }

  preprocessText(text) {
    // Replace user IDs with usernames or remove them
    let cleanedText = text.replace(this.userIdRegex, (match, userId) => {
      const username = this.userMappings.get(userId);
      return username ? `@${username}` : ''; // Replace with @username or remove
    });

    // Remove URLs
    cleanedText = cleanedText.replace(/https?:\/\/[^\s]+/g, '');
    
    // Remove excessive whitespace
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
    
    if (!cleanedText || cleanedText.length < 10) return [];

    // Split into sentences more flexibly
    const sentences = cleanedText
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 5 && s.split(' ').length >= 3) // Minimum 3 words
      .map(s => s.replace(/[^\w\s'-@]/g, ' ').replace(/\s+/g, ' ').trim());
    
    return sentences;
  }

  // Weighted selection based on frequency and context
  selectNextWord(candidates, currentKey) {
    if (candidates.length === 1) return candidates[0];
    
    // Calculate weights for each candidate
    const weightedCandidates = candidates.map(word => {
      const frequency = this.wordFrequency[word] || 1;
      const contextWeight = this.contextWeights[`${currentKey}|${word}`] || 1;
      
      // Favor more frequent words but not too heavily
      const frequencyScore = Math.log(frequency + 1);
      const contextScore = Math.log(contextWeight + 1);
      
      return {
        word,
        weight: frequencyScore * 0.3 + contextScore * 0.7
      };
    });
    
    // Sort by weight and add some randomness
    weightedCandidates.sort((a, b) => b.weight - a.weight);
    
    // Select from top candidates with weighted randomness
    const topCandidates = weightedCandidates.slice(0, Math.min(3, weightedCandidates.length));
    const totalWeight = topCandidates.reduce((sum, c) => sum + c.weight, 0);
    
    let random = Math.random() * totalWeight;
    for (const candidate of topCandidates) {
      random -= candidate.weight;
      if (random <= 0) return candidate.word;
    }
    
    return topCandidates[0].word;
  }

  // Check if we should end the sentence
  shouldEndSentence(currentKey, generatedLength, targetLength) {
    // End if we've generated enough content
    if (generatedLength >= targetLength * 0.8) {
      return this.sentenceEnders.has(currentKey) || Math.random() < 0.3;
    }
    
    // Natural sentence endings
    if (this.sentenceEnders.has(currentKey)) {
      return Math.random() < 0.6;
    }
    
    // Avoid overly long sentences
    if (generatedLength > targetLength * 0.4) {
      return Math.random() < 0.1;
    }
    
    return false;
  }

  generate(startingPhrase = null, targetLength = 50, coherent = true) {
    if (Object.keys(this.chain).length === 0) {
      return "Not enough training data available.";
    }

    let words = [];
    let currentKey = null;

    // Find starting point
    if (startingPhrase) {
      const keys = Object.keys(this.chain);
      const matchingKey = keys.find(key => 
        key.toLowerCase().includes(startingPhrase.toLowerCase())
      );
      
      if (matchingKey) {
        currentKey = matchingKey;
        words = currentKey.split(' ');
      }
    }

    // If no starting phrase or no match found, use a random sentence starter
    if (!currentKey) {
      if (this.sentenceStarters.size > 0) {
        const starters = Array.from(this.sentenceStarters);
        currentKey = starters[Math.floor(Math.random() * starters.length)];
        words = currentKey.split(' ');
      } else {
        // Fallback to random key
        const keys = Object.keys(this.chain);
        currentKey = keys[Math.floor(Math.random() * keys.length)];
        words = currentKey.split(' ');
      }
    }

    // Generate text with more flexible constraints
    let attempts = 0;
    const maxAttempts = targetLength * 3; // Prevent infinite loops
    
    while (words.length < targetLength && attempts < maxAttempts) {
      attempts++;
      
      const possibleNext = this.chain[currentKey];
      if (!possibleNext || possibleNext.length === 0) {
        // Try to find continuation with partial key match
        const partialKey = words.slice(-Math.max(1, this.order - 1)).join(' ');
        const matchingKeys = Object.keys(this.chain).filter(key => 
          key.startsWith(partialKey)
        );
        
        if (matchingKeys.length > 0) {
          currentKey = matchingKeys[Math.floor(Math.random() * matchingKeys.length)];
          continue;
        } else {
          // Start a new sentence if we can't continue
          if (coherent && words.length >= 10) {
            break; // End naturally for coherent mode
          } else {
            // Pick a random new starting point
            const keys = Object.keys(this.chain);
            currentKey = keys[Math.floor(Math.random() * keys.length)];
            continue;
          }
        }
      }

      // Choose next word with some randomness
      let nextWord;
      if (coherent && possibleNext.length > 1) {
        // In coherent mode, prefer more common continuations
        const wordCounts = {};
        possibleNext.forEach(word => {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        });
        
        // Sort by frequency and add some randomness
        const sortedWords = Object.entries(wordCounts)
          .sort(([,a], [,b]) => b - a)
          .map(([word]) => word);
        
        // Pick from top 3 most common, or random if less options
        const topChoices = sortedWords.slice(0, Math.min(3, sortedWords.length));
        nextWord = topChoices[Math.floor(Math.random() * topChoices.length)];
      } else {
        // Random selection
        nextWord = possibleNext[Math.floor(Math.random() * possibleNext.length)];
      }

      words.push(nextWord);

      // Update current key for next iteration
      if (words.length >= this.order) {
        currentKey = words.slice(-this.order).join(' ');
      }

      // Check for natural sentence ending in coherent mode
      if (coherent && words.length >= 15) {
        const lastWord = words[words.length - 1];
        // More flexible ending detection
        if (lastWord.match(/[.!?]$/) || 
            (words.length >= targetLength * 0.8 && Math.random() < 0.1)) {
          break;
        }
      }
    }

    // Clean up the result
    let result = words.join(' ');
    
    // Ensure it ends properly if in coherent mode
    if (coherent && !result.match(/[.!?]$/)) {
      // Try to find a natural ending
      const lastFewWords = words.slice(-3).join(' ');
      if (this.sentenceEnders.has(lastFewWords)) {
        result += '.';
      } else if (words.length >= targetLength * 0.7) {
        result += '.';
      }
    }

    // Final cleanup - remove any remaining user ID patterns that might have slipped through
    result = result.replace(this.userIdRegex, '');
    result = result.replace(/\s+/g, ' ').trim();

    return result || "Unable to generate meaningful text.";
  }
}
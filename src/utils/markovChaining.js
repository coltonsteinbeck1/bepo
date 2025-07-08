export default class MarkovChain {
  constructor(order = 4) {
    this.order = order;
    this.chain = {};
    this.sentenceStarters = new Set(); // Track sentence beginnings
    this.sentenceEnders = new Set(); // Track sentence endings
    this.wordFrequency = {}; // Track word frequency for better selection
    this.contextWeights = {}; // Weight certain transitions higher
  }

  train(text) {
    // Normalize and split into sentences first
    const sentences = this.preprocessText(text);
    
    for (const sentence of sentences) {
      const words = sentence.split(/\s+/).filter(word => word.length > 0);
      if (words.length < this.order) continue;

      // Track sentence starters
      if (words.length >= this.order) {
        const starter = words.slice(0, this.order).join(" ");
        this.sentenceStarters.add(starter);
      }

      // Track sentence enders
      if (words.length >= this.order) {
        const ender = words.slice(-this.order).join(" ");
        this.sentenceEnders.add(ender);
      }

      // Build chain using a sliding window of "order" words as the key
      for (let i = 0; i <= words.length - this.order; i++) {
        const key = words.slice(i, i + this.order).join(" ");
        const nextWord = words[i + this.order];
        
        if (!this.chain[key]) {
          this.chain[key] = [];
        }
        
        if (nextWord) {
          this.chain[key].push(nextWord);
          
          // Track word frequency
          this.wordFrequency[nextWord] = (this.wordFrequency[nextWord] || 0) + 1;
          
          // Weight transitions based on context
          const transitionKey = `${key}|${nextWord}`;
          this.contextWeights[transitionKey] = (this.contextWeights[transitionKey] || 0) + 1;
        }
      }
    }
  }

  preprocessText(text) {
    // Better text preprocessing
    text = text.replace(/\s+/g, ' ').trim();
    
    // Split into sentences while preserving sentence structure
    const sentences = text.split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => s.replace(/[^\w\s'-]/g, ' ').replace(/\s+/g, ' ').trim());
    
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

  generate(startPhrase = null, length = 100, coherenceMode = true) {
    const keys = Object.keys(this.chain);
    if (!keys.length) return "";

    let result = [];
    let sentences = [];
    let currentSentence = [];
    
    // Choose starting key: prefer sentence starters if available
    let currentKey;
    if (startPhrase && this.chain[startPhrase]) {
      currentKey = startPhrase;
    } else if (coherenceMode && this.sentenceStarters.size > 0) {
      const starters = Array.from(this.sentenceStarters);
      currentKey = starters[Math.floor(Math.random() * starters.length)];
    } else {
      currentKey = keys[Math.floor(Math.random() * keys.length)];
    }

    currentSentence = currentKey.split(" ");
    const usedPhrases = new Set([currentKey]);
    const recentNgrams = new Set();
    
    let generatedWords = this.order;
    const targetWords = length;
    let loopCounter = 0;
    const maxLoops = targetWords * 10; // Safety limit to prevent infinite loops

    while (generatedWords < targetWords && loopCounter < maxLoops) {
      loopCounter++;
      const nextWords = this.chain[currentKey];
      
      if (!nextWords || nextWords.length === 0) {
        // End current sentence and start a new one
        if (currentSentence.length > 0) {
          sentences.push(currentSentence.join(" "));
          currentSentence = [];
        }
        
        // Pick a new sentence starter
        if (coherenceMode && this.sentenceStarters.size > 0) {
          const starters = Array.from(this.sentenceStarters).filter(key => !usedPhrases.has(key));
          currentKey = starters.length > 0 
            ? starters[Math.floor(Math.random() * starters.length)]
            : Array.from(this.sentenceStarters)[Math.floor(Math.random() * this.sentenceStarters.size)];
        } else {
          const unusedKeys = keys.filter(key => !usedPhrases.has(key));
          currentKey = unusedKeys.length > 0
            ? unusedKeys[Math.floor(Math.random() * unusedKeys.length)]
            : keys[Math.floor(Math.random() * keys.length)];
        }
        
        currentSentence = currentKey.split(" ");
        usedPhrases.add(currentKey);
        generatedWords += this.order;
        continue;
      }

      // Filter candidates to avoid repetition
      const candidates = nextWords.filter(word => {
        const keyWords = currentKey.split(" ");
        keyWords.shift();
        keyWords.push(word);
        const nextNgram = keyWords.join(" ");

        if (recentNgrams.has(nextNgram)) return false;

        // Avoid immediate repetition in current sentence
        const lastFewWords = currentSentence.slice(-3).join(" ");
        if (lastFewWords.includes(word) && Math.random() < 0.7) {
          return false;
        }

        return true;
      });

      if (candidates.length === 0) {
        // End sentence if no good candidates
        if (currentSentence.length > 0) {
          sentences.push(currentSentence.join(" "));
          currentSentence = [];
        }
        continue;
      }

      // Select next word using weighted selection
      const nextWord = this.selectNextWord(candidates, currentKey);
      currentSentence.push(nextWord);
      generatedWords++;

      // Update current key
      const keyWords = currentKey.split(" ");
      keyWords.shift();
      keyWords.push(nextWord);
      currentKey = keyWords.join(" ");

      // Track recent ngrams
      recentNgrams.add(currentKey);
      if (recentNgrams.size > 15) {
        recentNgrams.delete([...recentNgrams][0]);
      }

      usedPhrases.add(currentKey);

      // Check if we should end the current sentence
      if (this.shouldEndSentence(currentKey, currentSentence.length, targetWords / 3)) {
        sentences.push(currentSentence.join(" "));
        currentSentence = [];
        
        // Start new sentence if we haven't reached target length
        if (generatedWords < targetWords && coherenceMode) {
          const starters = Array.from(this.sentenceStarters).filter(key => !usedPhrases.has(key));
          if (starters.length > 0) {
            currentKey = starters[Math.floor(Math.random() * starters.length)];
            currentSentence = currentKey.split(" ");
            usedPhrases.add(currentKey);
            generatedWords += this.order;
          }
        }
      }
    }

    // Add any remaining sentence
    if (currentSentence.length > 0) {
      sentences.push(currentSentence.join(" "));
    }

    return sentences.join(". ") + (sentences.length > 0 ? "." : "");
  }
}
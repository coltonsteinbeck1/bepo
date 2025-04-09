export default class MarkovChain {
  constructor(order = 4) {
    this.order = order; // you can lower this for more relaxed context
    this.chain = {};
  }

  train(text) {
    const words = text.split(/\s+/);
    if (words.length < this.order) return;
    // Build chain using a sliding window of "order" words as the key
    for (let i = 0; i <= words.length - this.order; i++) {
      const key = words.slice(i, i + this.order).join(" ");
      const nextWord = words[i + this.order];
      if (!this.chain[key]) {
        this.chain[key] = [];
      }
      if (nextWord) {
        this.chain[key].push(nextWord);
      }
    }
  }

  generate(startPhrase = null, length = 100) {
    const keys = Object.keys(this.chain);
    if (!keys.length) return "";

    // Choose starting key: use provided phrase if valid, otherwise pick randomly.
    let currentKey = (startPhrase && this.chain[startPhrase])
      ? startPhrase
      : keys[Math.floor(Math.random() * keys.length)];

    const result = currentKey.split(" ");
    const usedPhrases = new Set([currentKey]); // Track used phrases

    // Fallback settings in case of dead ends.
    const fallbackLimit = 5;
    let fallbackCount = 0;
    const recentNgrams = new Set(); // Track recent n-grams to avoid repetition

    for (let i = 0; i < length - this.order; i++) {
      const nextWords = this.chain[currentKey];
      if (!nextWords || nextWords.length === 0) {
        fallbackCount++;
        if (fallbackCount >= fallbackLimit) break;
        // Reset by picking a new random key that we haven't used before
        const unusedKeys = keys.filter(key => !usedPhrases.has(key));
        currentKey = unusedKeys.length > 0
          ? unusedKeys[Math.floor(Math.random() * unusedKeys.length)]
          : keys[Math.floor(Math.random() * keys.length)];

        usedPhrases.add(currentKey);
        result.push(...currentKey.split(" "));
        continue;
      }

      fallbackCount = 0;

      // Filter out next words that would create repeating phrases
      const candidates = nextWords.filter(word => {
        const keyWords = currentKey.split(" ");
        keyWords.shift();
        keyWords.push(word);
        const nextNgram = keyWords.join(" ");

        // Check if this would create a phrase we've used recently
        if (recentNgrams.has(nextNgram)) return false;

        // Check for repetition within the last generated content
        const lastSegment = result.slice(-this.order * 3).join(" ");
        if (lastSegment.includes(nextNgram) &&
          Math.random() < 0.8) { // Allow some repetition (20% chance)
          return false;
        }

        return true;
      });

      // If no suitable candidates, pick a new random key
      if (candidates.length === 0) {
        const unusedKeys = keys.filter(key => !usedPhrases.has(key));
        currentKey = unusedKeys.length > 0
          ? unusedKeys[Math.floor(Math.random() * unusedKeys.length)]
          : keys[Math.floor(Math.random() * keys.length)];

        usedPhrases.add(currentKey);
        result.push(...currentKey.split(" "));
        continue;
      }

      // Choose one of the filtered candidates
      const nextWord = candidates[Math.floor(Math.random() * candidates.length)];

      result.push(nextWord);

      // Update the current key by shifting and appending the next word
      const keyWords = currentKey.split(" ");
      keyWords.shift();
      keyWords.push(nextWord);
      currentKey = keyWords.join(" ");

      // Add to recent ngrams to avoid short-term repetition
      recentNgrams.add(currentKey);
      if (recentNgrams.size > 10) { // Only keep track of recent phrases
        recentNgrams.delete([...recentNgrams][0]);
      }

      usedPhrases.add(currentKey);
    }

    return result.join(" ");
  }
}
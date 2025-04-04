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
      // Fallback settings in case of dead ends.
      const fallbackLimit = 5;
      let fallbackCount = 0;
  
      for (let i = 0; i < length - this.order; i++) {
        const nextWords = this.chain[currentKey];
        if (!nextWords || nextWords.length === 0) {
          fallbackCount++;
          if (fallbackCount >= fallbackLimit) break;
          // Reset by picking a new random key.
          currentKey = keys[Math.floor(Math.random() * keys.length)];
          result.push(...currentKey.split(" "));
          continue;
        }
        fallbackCount = 0;
        let nextWord = nextWords[Math.floor(Math.random() * nextWords.length)];
  
        // Check for repetition: if the last segment is just repeating the candidate word, reset.
        const lastWords = result.slice(-this.order);
        if (lastWords.every(word => word === nextWord)) {
          currentKey = keys[Math.floor(Math.random() * keys.length)];
          result.push(...currentKey.split(" "));
          continue;
        }
  
        result.push(nextWord);
        // Update the current key by shifting and appending the next word.
        const keyWords = currentKey.split(" ");
        keyWords.shift();
        keyWords.push(nextWord);
        currentKey = keyWords.join(" ");
      }
      return result.join(" ");
    }
  }
import axios from 'axios';

class OtakuGifService {
  constructor() {
    this.baseUrl = 'https://api.otakugifs.xyz';
    this.reactions = null;
    this.reactionsCache = new Map();
    this.lastReactionsFetch = null;
    this.CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
    this.REQUEST_TIMEOUT = 5000; // 5 seconds
    
    // Configure axios instance
    this.axiosInstance = axios.create({
      timeout: this.REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'Discord Bot - Bepo',
      }
    });
  }

  /**
   * Fetch and cache available reactions
   */
  async getAvailableReactions() {
    const now = Date.now();
    
    // Return cached reactions if still valid
    if (this.reactions && this.lastReactionsFetch && 
        (now - this.lastReactionsFetch) < this.CACHE_DURATION) {
      return this.reactions;
    }

    try {
      const response = await this.axiosInstance.get(`${this.baseUrl}/gif/allreactions`);

      if (!response.data.reactions || !Array.isArray(response.data.reactions)) {
        throw new Error('Invalid API response format');
      }

      this.reactions = response.data.reactions;
      this.lastReactionsFetch = now;
      
      console.log(`Fetched ${this.reactions.length} available reactions`);
      return this.reactions;

    } catch (error) {
      console.error('Failed to fetch available reactions:', error);
      
      // Return cached reactions if available, otherwise fallback
      if (this.reactions) {
        console.log('Using cached reactions due to fetch failure');
        return this.reactions;
      }
      
      // Fallback to a basic set of reactions
      return ['hug', 'kiss', 'pat', 'smile', 'wave', 'dance', 'happy', 'laugh'];
    }
  }

  /**
   * Get a random gif for a specific reaction
   */
  async getReactionGif(reaction) {
    if (!reaction) {
      throw new Error('Reaction is required');
    }

    // Validate reaction against available reactions
    const availableReactions = await this.getAvailableReactions();
    if (!availableReactions.includes(reaction.toLowerCase())) {
      throw new Error(`Invalid reaction: ${reaction}. Must be one of: ${availableReactions.join(', ')}`);
    }

    try {
      const response = await this.axiosInstance.get(`${this.baseUrl}/gif`, {
        params: { reaction: reaction }
      });

      if (!response.data.url) {
        throw new Error('Invalid API response: missing URL');
      }

      // Validate URL format
      if (!this.isValidGifUrl(response.data.url)) {
        throw new Error('Invalid gif URL received from API');
      }

      return {
        url: response.data.url,
        reaction: reaction,
        source: 'otakugifs.xyz'
      };

    } catch (error) {
      console.error(`Failed to fetch gif for reaction "${reaction}":`, error);
      throw error;
    }
  }

  /**
   * Get a random gif from a random reaction
   */
  async getRandomGif() {
    try {
      const reactions = await this.getAvailableReactions();
      const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
      return await this.getReactionGif(randomReaction);
    } catch (error) {
      console.error('Failed to get random gif:', error);
      throw error;
    }
  }

  /**
   * Validate if URL is a valid gif URL
   */
  isValidGifUrl(url) {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'https:' && 
             parsedUrl.hostname.includes('otakugifs.xyz') &&
             url.toLowerCase().endsWith('.gif');
    } catch {
      return false;
    }
  }

  /**
   * Get formatted choices for Discord slash command (max 25 choices)
   */
  async getReactionChoices() {
    try {
      const reactions = await this.getAvailableReactions();
      
      // Sort reactions alphabetically and take first 24 (leaving room for "random")
      const sortedReactions = reactions.sort().slice(0, 24);
      
      const choices = sortedReactions.map(reaction => ({
        name: reaction.charAt(0).toUpperCase() + reaction.slice(1),
        value: reaction
      }));

      // Add random option at the beginning
      choices.unshift({ name: 'Random', value: 'random' });

      return choices;
    } catch (error) {
      console.error('Failed to get reaction choices:', error);
      // Fallback choices
      return [
        { name: 'Random', value: 'random' },
        { name: 'Hug', value: 'hug' },
        { name: 'Kiss', value: 'kiss' },
        { name: 'Pat', value: 'pat' },
        { name: 'Smile', value: 'smile' },
        { name: 'Wave', value: 'wave' }
      ];
    }
  }
}

// Export singleton instance
export default new OtakuGifService();
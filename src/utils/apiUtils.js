/**
 * API Utilities for external service integrations
 * Handles Steam API, Apex API, and other external data sources
 */
// Using built-in fetch (Node.js 18+)
import { safeAsync } from "./errorHandler.js";

/**
 * Steam API utilities for CS2 price checking
 */
export class SteamAPI {
  static async fetchSkinPrice(skinName) {
    const STEAMWEBAPIKEY = process.env.STEAMWEBAPIKEY;
    
    if (!STEAMWEBAPIKEY) {
      throw new Error("Steam Web API key is not configured");
    }

    const encodedSkinName = encodeURIComponent(skinName);
    const apiUrl = `https://www.steamwebapi.com/steam/api/item?key=${STEAMWEBAPIKEY}&market_hash_name=${encodedSkinName}&with_groups=true`;

    return await safeAsync(async () => {
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        let errorBody = "Could not retrieve details from Steam Web API.";
        try {
          const errorJson = await response.json();
          if (errorJson && (errorJson.message || errorJson.error)) {
            errorBody = errorJson.message || errorJson.error;
          }
        } catch (e) {
          // Ignore if error response is not JSON
        }
        throw new Error(`HTTP error! Status: ${response.status}. ${errorBody}`);
      }

      const data = await response.json();
      return data;
    }, null, 'steam_api_fetch');
  }

  static formatWear(wearShort) {
    const wearMap = {
      "fn": "Factory New",
      "mw": "Minimal Wear", 
      "ft": "Field-Tested",
      "ww": "Well-Worn",
      "bs": "Battle-Scarred",
    };
    return wearMap[wearShort?.toLowerCase()] || wearShort || "N/A";
  }

  static formatPrice(price) {
    if (!price || price === "0.00" || price === 0) return "N/A";
    if (typeof price === 'number') {
      return `$${price.toFixed(2)}`;
    }
    return `$${parseFloat(price).toFixed(2)}`;
  }

  static formatPriceUpdatedAt(priceupdatedat) {
    if (!priceupdatedat?.date) return "Not specified";
    
    try {
      return new Date(priceupdatedat.date).toLocaleString();
    } catch (e) {
      return priceupdatedat.date;
    }
  }
}

/**
 * Apex Legends API utilities
 */
export class ApexAPI {
  static async fetchMapRotation() {
    const KEY = process.env.APEX_KEY;
    
    if (!KEY) {
      throw new Error("Apex API key is not configured");
    }

    const URL = `https://api.mozambiquehe.re/maprotation?auth=${KEY}&version=2`;

    return await safeAsync(async () => {
      const response = await fetch(URL);
      const data = await response.json();

      if (!data || data.error) {
        throw new Error(data.error || 'Error fetching map rotation data');
      }

      const { battle_royale, ltm, ranked } = data;

      // Validate required data structure
      if (!battle_royale?.current || !battle_royale?.next ||
          !ltm?.current || !ltm?.next ||
          !ranked?.current || !ranked?.next) {
        throw new Error('Incomplete map rotation data received from API');
      }

      return { battle_royale, ltm, ranked };
    }, null, 'apex_api_fetch');
  }

  static formatTime(remainingMinutes) {
    if (!remainingMinutes || remainingMinutes < 0) return "Unknown";
    
    if (remainingMinutes >= 60) {
      const hours = Math.floor(remainingMinutes / 60);
      const minutes = remainingMinutes % 60;
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    }
  }
}

/**
 * Minecraft server status utilities
 */
export class MinecraftAPI {
  static async fetchServerStatus(serverAddress) {
    if (!serverAddress) {
      throw new Error("Server address is required");
    }

    const apiUrl = `https://api.mcsrvstat.us/3/${encodeURIComponent(serverAddress)}`;

    return await safeAsync(async () => {
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data) {
        throw new Error("No data received from Minecraft server API");
      }

      return data;
    }, null, 'minecraft_api_fetch');
  }

  static formatServerStatus(data) {
    if (!data.online) {
      return {
        online: false,
        message: "Server is offline or unreachable"
      };
    }

    return {
      online: true,
      players: {
        online: data.players?.online || 0,
        max: data.players?.max || 0
      },
      version: data.version || "Unknown",
      motd: data.motd?.clean?.join(" ") || data.motd?.raw?.join(" ") || "No MOTD",
      hostname: data.hostname || "Unknown"
    };
  }
}

/**
 * Generic API utilities
 */
export const APIUtils = {
  /**
   * Create a retry wrapper for API calls
   */
  createRetryWrapper(maxRetries = 3, baseDelay = 1000) {
    return async (apiCall, context = 'api_call') => {
      return await safeAsync(apiCall, null, context, maxRetries);
    };
  },

  /**
   * Validate API key presence
   */
  validateApiKey(key, serviceName) {
    if (!key) {
      throw new Error(`${serviceName} API key is not configured. Please contact the bot owner.`);
    }
  },

  /**
   * Sanitize API response data
   */
  sanitizeResponse(data) {
    if (typeof data === 'string') {
      return data.trim();
    }
    return data;
  }
};

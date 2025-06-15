import { OpenAI } from "openai";
import fetch from "node-fetch";
import sharp from "sharp";
import { GifUtil, GifFrame, BitmapImage } from "gifwrap";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create temp directory for GIF processing
const tempDir = path.join(__dirname, "../../temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Initialize OpenAI for vision capabilities
const visionOpenAI = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

/**
 * Check if a file is an image or GIF
 * @param {string} url - The URL of the file
 * @returns {boolean} - True if the file is an image or GIF
 */
export function isImageOrGif(url) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const lowerUrl = url.toLowerCase();
  return imageExtensions.some(ext => lowerUrl.includes(ext));
}

/**
 * Check if a Discord attachment is an image or GIF
 * @param {Object} attachment - Discord attachment object
 * @returns {boolean} - True if the attachment is an image or GIF
 */
export function isDiscordImageAttachment(attachment) {
  if (!attachment || !attachment.contentType) return false;
  
  const imageTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp'
  ];
  
  return imageTypes.includes(attachment.contentType.toLowerCase());
}

/**
 * Check if a Discord attachment is specifically a GIF
 * @param {Object} attachment - Discord attachment object
 * @returns {boolean} - True if the attachment is a GIF
 */
export function isDiscordGif(attachment) {
  if (!attachment || !attachment.contentType) return false;
  return attachment.contentType.toLowerCase() === 'image/gif';
}

/**
 * Check if a URL points to a GIF
 * @param {string} url - The URL to check
 * @returns {boolean} - True if the URL appears to be a GIF
 */
export function isGifUrl(url) {
  return url.toLowerCase().includes('.gif');
}

/**
 * Extract frames from a GIF and convert them to base64
 * @param {string} gifUrl - The URL of the GIF
 * @param {number} maxFrames - Maximum number of frames to extract (default: 5)
 * @returns {Promise<string[]>} - Array of base64 data URLs
 */
export async function extractGifFrames(gifUrl, maxFrames = 5) {
  try {
    let buffer;
    
    // Check if it's a local file path or URL
    if (gifUrl.startsWith('http://') || gifUrl.startsWith('https://')) {
      // Download the GIF from URL
      const response = await fetch(gifUrl);
      if (!response.ok) {
        throw new Error(`Failed to download GIF: ${response.status}`);
      }
      buffer = await response.buffer();
    } else {
      // Read local file
      const localPath = gifUrl.replace('file://', '');
      buffer = fs.readFileSync(localPath);
    }
    
    // Read the GIF
    const gif = await GifUtil.read(buffer);
    
    if (!gif.frames || gif.frames.length === 0) {
      throw new Error("No frames found in GIF");
    }
    
    const base64Frames = [];
    const framesToProcess = Math.min(gif.frames.length, maxFrames);
    
    // Process frames
    for (let i = 0; i < framesToProcess; i++) {
      const frameIndex = Math.floor((i * gif.frames.length) / framesToProcess);
      const frame = gif.frames[frameIndex];
      
      if (frame && frame.bitmap) {
        // Convert frame to PNG buffer
        const pngBuffer = await sharp(frame.bitmap.data, {
          raw: {
            width: frame.bitmap.width,
            height: frame.bitmap.height,
            channels: 4
          }
        }).png().toBuffer();
        
        const base64 = pngBuffer.toString('base64');
        base64Frames.push(`data:image/png;base64,${base64}`);
      }
    }
    
    if (base64Frames.length === 0) {
      throw new Error("Failed to process any frames");
    }
    
    return base64Frames;
  } catch (error) {
    console.error("Error extracting GIF frames:", error);
    throw new Error("Failed to extract GIF frames");
  }
}

/**
 * Analyze a GIF by processing multiple frames
 * @param {string} gifUrl - The URL of the GIF
 * @param {string} userMessage - User's message for context
 * @param {string} systemPrompt - System prompt for the vision model
 * @returns {Promise<string>} - Analysis of the GIF
 */
export async function analyzeGifWithFrames(gifUrl, userMessage = "", systemPrompt = null) {
  try {
    const frames = await extractGifFrames(gifUrl, 3); // Extract 3 key frames
    
    if (frames.length === 0) {
      throw new Error("No frames extracted from GIF");
    }
    
    const visionSystemPrompt = systemPrompt || process.env.IMAGE_SYSTEM_PROMPT;
    
    // Build message content with multiple frames
    const frameContent = frames.map((frame, index) => ({
      type: "image_url",
      image_url: {
        url: frame,
        detail: "auto"
      }
    }));
    
    const messages = [
      {
        role: "system",
        content: visionSystemPrompt
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: userMessage || "this is a gif - i'm showing you multiple frames from the animation. react to the movement/sequence you can see. keep it real."
          },
          ...frameContent
        ]
      }
    ];

    const visionOpenAI = new OpenAI({
      apiKey: process.env.OPENAI_KEY,
    });

    const response = await visionOpenAI.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      max_tokens: 500,
      temperature: 1.0,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error analyzing GIF:", error);
    // Instead of throwing, return null so we can fallback to single frame
    return null;
  }
}

/**
 * Convert image URL to base64 data URL for OpenAI vision models
 * @param {string} imageUrl - The URL or local path of the image
 * @returns {Promise<string>} - Base64 data URL
 */
export async function convertImageToBase64(imageUrl) {
  try {
    let buffer;
    let contentType = 'image/png';
    
    // Check if it's a local file path or URL
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // Download from URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      buffer = await response.buffer();
      contentType = response.headers.get('content-type') || 'image/png';
    } else {
      // Read local file
      const localPath = imageUrl.replace('file://', '');
      buffer = fs.readFileSync(localPath);
      
      // Determine content type from file extension
      const ext = path.extname(localPath).toLowerCase();
      switch (ext) {
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg';
          break;
        case '.png':
          contentType = 'image/png';
          break;
        case '.gif':
          contentType = 'image/gif';
          break;
        case '.webp':
          contentType = 'image/webp';
          break;
        default:
          contentType = 'image/png';
      }
    }
    
    // Convert buffer to base64
    const base64 = buffer.toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error("Error converting image to base64:", error);
    throw new Error("Failed to process image for vision model");
  }
}

/**
 * Process image attachment and get description from OpenAI Vision
 * @param {string} imageUrl - The URL of the image
 * @param {string} userMessage - Optional user message to provide context
 * @param {string} systemPrompt - System prompt for the vision model
 * @returns {Promise<string>} - Description of the image
 */
export async function analyzeImageWithVision(imageUrl, userMessage = "", systemPrompt = null) {
  try {
    // Use your Bepo system message if no custom prompt provided
    const visionSystemPrompt = systemPrompt || process.env.MODEL_SYSTEM_MESSAGE;
    
    const messages = [
      {
        role: "system",
        content: visionSystemPrompt
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: userMessage || "what's in this image? react like bepo would"
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
              detail: "auto" // Can be "low", "high", or "auto"
            }
          }
        ]
      }
    ];

    const response = await visionOpenAI.chat.completions.create({
      model: "gpt-4o-mini", // Using the cheaper vision model
      messages: messages,
      max_tokens: 500,
      temperature: 1.0,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error analyzing image:", error);
    throw new Error("couldn't analyze the image... rip");
  }
}

/**
 * Download and validate image from URL
 * @param {string} url - The URL of the image  
 * @returns {Promise<Buffer|null>} - Image buffer or null if invalid
 */
export async function downloadImage(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const buffer = await response.buffer();
    
    // Basic validation - check if it's actually an image
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error('Not a valid image');
    }
    
    return buffer;
  } catch (error) {
    console.error("Error downloading image:", error);
    return null;
  }
}

/**
 * Extract image URLs from Discord message content (for links)
 * @param {string} content - Message content
 * @returns {string[]} - Array of image URLs found in the message
 */
export function extractImageUrls(content) {
  const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp)(\?[^\s]*)?)/gi;
  const matches = content.match(urlRegex);
  return matches || [];
}

/**
 * Get all images from a Discord message (attachments + URLs in content) with GIF detection
 * @param {Object} message - Discord message object
 * @returns {Promise<{imageUrls: string[], hasGifs: boolean}>} - Object with image URLs and GIF detection
 */
export async function getAllImagesFromMessage(message) {
  const imageUrls = [];
  let hasGifs = false;
  
  // Check attachments
  if (message.attachments && message.attachments.size > 0) {
    message.attachments.forEach(attachment => {
      if (isDiscordImageAttachment(attachment)) {
        imageUrls.push(attachment.url);
        if (isDiscordGif(attachment)) {
          hasGifs = true;
        }
      }
    });
  }
  
  // Check for image URLs in message content
  const urlsInContent = extractImageUrls(message.content);
  urlsInContent.forEach(url => {
    imageUrls.push(url);
    if (isGifUrl(url)) {
      hasGifs = true;
    }
  });
  
  return { imageUrls, hasGifs };
}

/**
 * Sora Video Service
 * Handles video generation using OpenAI's Sora 2 API
 * @module soraVideoService
 */

import { OpenAI } from "openai";
import dotenv from "dotenv";
import axios from "axios";
dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

/**
 * Generate a video using Sora 2 API
 * @param {string} prompt - Text description for video generation
 * @param {Array<string>} imageUrls - Optional array of reference image URLs
 * @param {Object} options - Additional generation options (resolution)
 * @returns {Promise<Object>} Video generation result
 */
export async function generateVideo(prompt, imageUrls = [], options = {}) {
  try {
    const {
      resolution = "1280x720", // Default HD landscape
    } = options;

    console.log(`🎬 Starting Sora 2 video generation`);
    console.log(`   Prompt: ${prompt.substring(0, 100)}...`);
    console.log(`   Reference images: ${imageUrls.length}`);

    // Prepare the request payload for OpenAI Videos API
    // Based on OpenAI's video generation API structure
    // NOTE: Sora API only accepts: model, prompt, and size (as of Oct 2025)
    // Supported sizes: '720x1280', '1280x720', '1024x1792', '1792x1024'
    const payload = {
      model: "sora-2", // Sora model name
      prompt: prompt,
      size: resolution || "1280x720", // Use provided resolution or default to HD landscape
    };

    // NOTE: Duration and other parameters are NOT supported by the API yet
    // The duration is determined by the model itself based on the prompt

    // Add reference image if provided
    // OpenAI Sora 2 supports ONE reference image via 'input_reference' parameter
    // The image must be uploaded as a file (not base64) and match the video resolution EXACTLY
    if (imageUrls.length > 0) {
      console.log(`   🖼️ Processing reference image: ${imageUrls[0]}`);

      try {
        // Download the image
        const imageResponse = await axios.get(imageUrls[0], {
          responseType: "arraybuffer",
          timeout: 10000,
        });

        // Convert to Buffer for file upload
        const imageBuffer = Buffer.from(imageResponse.data);
        const contentType = imageResponse.headers["content-type"] || "image/jpeg";

        console.log(`   ✓ Downloaded reference image: ${imageBuffer.length} bytes, type: ${contentType}`);

        // Get image dimensions to validate against video resolution
        const sharp = (await import('sharp')).default;
        const imageMetadata = await sharp(imageBuffer).metadata();
        const imageWidth = imageMetadata.width;
        const imageHeight = imageMetadata.height;

        console.log(`   ℹ️ Reference image dimensions: ${imageWidth}x${imageHeight}`);

        // Parse requested video resolution
        const [videoWidth, videoHeight] = (resolution || "1280x720").split('x').map(Number);
        console.log(`   ℹ️ Requested video resolution: ${videoWidth}x${videoHeight}`);

        // Validate that image matches video resolution EXACTLY
        if (imageWidth !== videoWidth || imageHeight !== videoHeight) {
          const errorMsg = `Reference image (${imageWidth}x${imageHeight}) must EXACTLY match video resolution (${videoWidth}x${videoHeight})`;
          console.error(`   ❌ ${errorMsg}`);
          throw new Error(errorMsg);
        }

        console.log(`   ✓ Image dimensions match video resolution`);

        // Determine file extension from content type
        let extension = 'jpg';
        if (contentType.includes('png')) extension = 'png';
        else if (contentType.includes('webp')) extension = 'webp';
        else if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg';

        // Use OpenAI's toFile helper to create a proper File object with MIME type
        const { toFile } = await import('openai/uploads');
        const fileObject = await toFile(imageBuffer, `reference.${extension}`, { type: contentType });

        payload.input_reference = fileObject;

        console.log(`   ✓ Added reference image to payload (${extension}, ${contentType})`);

        if (imageUrls.length > 1) {
          console.log(`   ⚠️ Note: Only the first image will be used (API supports 1 image)`);
        }
      } catch (imageError) {
        console.error(`   ❌ Failed to process reference image:`, imageError.message);
        // Re-throw if it's a dimension mismatch error so user sees it
        if (imageError.message.includes('must EXACTLY match')) {
          throw imageError;
        }
        console.log(`   ℹ️ Continuing without reference image...`);
        // Continue without reference image rather than failing completely for other errors
      }
    }

    console.log(`   Payload:`, JSON.stringify({ ...payload, input_reference: payload.input_reference ? '[stream_object]' : undefined }, null, 2));

    // Call OpenAI video generation API using the correct 'create' method
    const response = await openai.videos.create(payload);

    console.log(`✅ Video generation initiated: ${response.id}`);

    return {
      success: true,
      videoId: response.id,
      status: response.status || "processing",
      data: response,
    };
  } catch (error) {
    console.error("❌ Error generating video with Sora:", error);

    // Log detailed error info for debugging
    if (error.response) {
      console.error("   Response status:", error.response.status);
      console.error("   Response data:", JSON.stringify(error.response.data, null, 2));
    }

    // Log error details for better debugging
    if (error.error) {
      console.error("   Error object:", JSON.stringify(error.error, null, 2));
    }

    if (error.code) {
      console.error("   Error code:", error.code);
    }

    // Handle specific OpenAI errors
    if (error.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    } else if (error.status === 400) {
      const details = error.error?.message || error.message;
      throw new Error(`Invalid request: ${details}`);
    } else if (error.status === 401) {
      throw new Error("OpenAI API authentication failed. Check your API key.");
    } else if (error.status === 403) {
      throw new Error("Access to Sora API denied. Your OpenAI account may not have access to video generation yet.");
    } else if (error.status === 404) {
      throw new Error("Video generation endpoint not found. The Sora API may not be available yet or the model name is incorrect.");
    }

    // Better error message with details
    const errorDetails = error.error?.message || error.message || "Unknown error";
    throw new Error(`Video generation failed: ${errorDetails}`);
  }
}

/**
 * Process and prepare reference images for Sora API
 * Downloads images and converts to base64 if needed
 * @param {Array<string>} imageUrls - Array of image URLs
 * @returns {Promise<Array<Object>>} Processed image data
 */
async function processReferenceImages(imageUrls) {
  const processedImages = [];

  for (const url of imageUrls) {
    try {
      // Download image
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 10000,
      });

      // Convert to base64
      const base64 = Buffer.from(response.data, "binary").toString("base64");
      const mimeType = response.headers["content-type"] || "image/png";

      processedImages.push({
        data: `data:${mimeType};base64,${base64}`,
        url: url,
      });

      console.log(`   ✓ Processed reference image: ${url.substring(0, 50)}...`);
    } catch (error) {
      console.error(`   ✗ Failed to process image ${url}:`, error.message);
      // Continue with other images even if one fails
    }
  }

  return processedImages;
}

/**
 * Check the status of a video generation task
 * @param {string} videoId - OpenAI video generation ID
 * @returns {Promise<Object>} Status information
 */
export async function checkVideoStatus(videoId) {
  try {
    const response = await openai.videos.retrieve(videoId);

    return {
      success: true,
      status: response.status,
      videoId: response.id,
      data: response,
    };
  } catch (error) {
    console.error(`❌ Error checking video status for ${videoId}:`, error);
    throw new Error(`Failed to check video status: ${error.message}`);
  }
}

/**
 * Retrieve the actual video content/data from OpenAI
 * This must be called AFTER the video status is "completed"
 * @param {string} videoId - OpenAI video generation ID
 * @returns {Promise<Buffer>} Video file as Buffer
 */
export async function retrieveVideoContent(videoId) {
  try {
    console.log(`📥 Retrieving video content for ${videoId}...`);

    // Use the correct OpenAI SDK method: downloadContent
    // This returns a Response object with the video binary data
    const response = await openai.videos.downloadContent(videoId);

    // Response is a fetch Response object, convert to Buffer
    let videoBuffer;

    if (response instanceof Buffer) {
      videoBuffer = response;
    } else if (response.arrayBuffer) {
      // If it's a Response object with arrayBuffer method (most common)
      const arrayBuffer = await response.arrayBuffer();
      videoBuffer = Buffer.from(arrayBuffer);
    } else if (response.body) {
      // If it's a ReadableStream
      const chunks = [];
      for await (const chunk of response.body) {
        chunks.push(chunk);
      }
      videoBuffer = Buffer.concat(chunks);
    } else {
      // Try to convert directly
      videoBuffer = Buffer.from(response);
    }

    console.log(`✅ Retrieved video content: ${videoBuffer.length} bytes`);
    return videoBuffer;

  } catch (error) {
    console.error(`❌ Error retrieving video content for ${videoId}:`, error);
    throw new Error(`Failed to retrieve video content: ${error.message}`);
  }
}

/**
 * Poll video generation status until completion or timeout
 * @param {string} videoId - OpenAI video generation ID
 * @param {number} maxAttempts - Maximum polling attempts (default: 180 for ~30 mins)
 * @param {number} intervalMs - Interval between polls in ms (default: 10000 - 10 seconds)
 * @returns {Promise<Object>} Final status
 */
export async function pollVideoStatus(videoId, maxAttempts = 180, intervalMs = 10000) {
  let attempts = 0;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;

  while (attempts < maxAttempts) {
    try {
      const status = await checkVideoStatus(videoId);

      // Reset consecutive errors on successful status check
      consecutiveErrors = 0;

      console.log(`📊 Video ${videoId} status: ${status.status} (attempt ${attempts + 1}/${maxAttempts})`);

      // Terminal states - return immediately
      if (status.status === "completed") {
        console.log(`✅ Video generation completed! Retrieving video content...`);

        // Retrieve the actual video content
        try {
          const videoBuffer = await retrieveVideoContent(videoId);
          return {
            success: true,
            completed: true,
            videoBuffer: videoBuffer,
            data: status.data,
          };
        } catch (contentError) {
          console.error(`❌ Failed to retrieve video content:`, contentError);
          return {
            success: false,
            completed: true,
            error: `Video completed but failed to retrieve content: ${contentError.message}`,
          };
        }
      } else if (status.status === "failed" || status.status === "cancelled") {
        return {
          success: false,
          completed: true,
          error: status.data?.error || `Video generation ${status.status}`,
        };
      }

      // Non-terminal states - keep polling
      // "queued" - waiting in OpenAI's queue to start processing
      // "processing" - actively generating the video
      // "in_progress" - alternative status name that might be used
      const isProcessing = ["queued", "processing", "in_progress"].includes(status.status);

      if (isProcessing) {
        console.log(`   ⏳ Video still ${status.status}... (${Math.round((attempts + 1) * intervalMs / 60000)} minutes elapsed)`);
      } else {
        console.log(`   ⚠️ Unknown status: ${status.status}`);
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      attempts++;
    } catch (error) {
      consecutiveErrors++;

      // Check if it's a network error
      const isNetworkError = error.message?.includes("Connection error") ||
        error.message?.includes("ENOTFOUND") ||
        error.message?.includes("fetch failed") ||
        error.code === "ENOTFOUND" ||
        error.cause?.code === "ENOTFOUND";

      if (isNetworkError) {
        console.warn(`🌐 Network error during polling (attempt ${attempts + 1}, consecutive errors: ${consecutiveErrors}):`, error.message);
      } else {
        console.error(`❌ Error during polling attempt ${attempts + 1}:`, error.message);
      }

      // If too many consecutive errors, fail
      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.error(`❌ Too many consecutive errors (${consecutiveErrors}). Giving up.`);
        return {
          success: false,
          completed: false,
          error: isNetworkError
            ? `Network connectivity issues. Video may still be processing. Check OpenAI dashboard with video ID: ${videoId}`
            : `Polling failed after ${consecutiveErrors} consecutive errors: ${error.message}`,
        };
      }

      // Last attempt - throw error
      if (attempts >= maxAttempts - 1) {
        throw error;
      }

      // Exponential backoff for network errors, normal interval otherwise
      const backoffMultiplier = isNetworkError ? Math.min(consecutiveErrors, 3) : 1;
      const waitTime = intervalMs * backoffMultiplier;

      console.log(`   ⏳ Retrying in ${waitTime / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      attempts++;
    }
  }

  // Timeout reached - video is still processing
  return {
    success: false,
    completed: false,
    error: `Video generation exceeded ${Math.round(maxAttempts * intervalMs / 60000)} minute timeout. The video may still be processing. Check the OpenAI dashboard or try retrieving it later with the video ID: ${videoId}`,
  };
}

/**
 * Retrieve a completed video
 * @param {string} videoId - OpenAI video generation ID
 * @returns {Promise<Object>} Video data with buffer content
 */
export async function retrieveVideo(videoId) {
  try {
    const status = await checkVideoStatus(videoId);

    if (status.status !== "completed") {
      throw new Error(`Video is not ready yet. Status: ${status.status}`);
    }

    // Retrieve the video content
    const videoBuffer = await retrieveVideoContent(videoId);

    return {
      success: true,
      videoBuffer: videoBuffer,
      data: status.data,
    };
  } catch (error) {
    console.error(`❌ Error retrieving video ${videoId}:`, error);
    throw error;
  }
}

/**
 * Cancel a video generation task
 * @param {string} videoId - OpenAI video generation ID
 * @returns {Promise<Object>} Cancellation result
 */
export async function cancelVideo(videoId) {
  try {
    const response = await openai.videos.cancel(videoId);

    return {
      success: true,
      message: "Video generation cancelled",
      data: response,
    };
  } catch (error) {
    console.error(`❌ Error cancelling video ${videoId}:`, error);
    throw new Error(`Failed to cancel video: ${error.message}`);
  }
}

/**
 * Validate video generation parameters
 * @param {string} prompt - Text prompt
 * @param {Array<string>} imageUrls - Reference images
 * @returns {Object} Validation result
 */
export function validateVideoParams(prompt, imageUrls = []) {
  const errors = [];

  // Validate prompt
  if (!prompt || typeof prompt !== "string") {
    errors.push("Prompt is required and must be a string");
  } else if (prompt.length < 10) {
    errors.push("Prompt must be at least 10 characters long");
  } else if (prompt.length > 1000) {
    errors.push("Prompt must be less than 1000 characters");
  }

  // Validate image URLs
  if (imageUrls && imageUrls.length > 1) {
    console.warn("⚠️ Multiple images provided, but Sora API only supports 1 reference image. Only the first will be used.");
  }

  if (imageUrls && imageUrls.length > 0) {
    const invalidUrls = imageUrls.filter((url) => {
      try {
        new URL(url);
        return false;
      } catch {
        return true;
      }
    });

    if (invalidUrls.length > 0) {
      errors.push(`Invalid image URLs: ${invalidUrls.join(", ")}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Extract supported image formats from Discord attachments
 * @param {Array} attachments - Discord message attachments
 * @returns {Array<string>} Array of valid image URLs
 */
export function extractImageAttachments(attachments) {
  const supportedFormats = ["png", "jpg", "jpeg", "gif", "webp"];
  const imageUrls = [];

  for (const attachment of attachments) {
    const extension = attachment.name?.split(".").pop()?.toLowerCase();

    if (supportedFormats.includes(extension)) {
      imageUrls.push(attachment.url);
    } else {
      console.warn(`⚠️ Unsupported image format: ${attachment.name}`);
    }
  }

  return imageUrls;
}

export default {
  generateVideo,
  checkVideoStatus,
  pollVideoStatus,
  retrieveVideo,
  cancelVideo,
  validateVideoParams,
  extractImageAttachments,
};

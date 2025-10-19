/**
 * User-specific automated triggers
 * Handles automated responses for specific users and phrases
 */

import { AttachmentBuilder } from 'discord.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// User-specific trigger configurations
const USER_TRIGGERS = [
  {
    userId: '524089994462101534',
    phrases: ['what the deuce'],
    videoPath: path.join(__dirname, '../images', 'whatthedeuce.mp4'),
    videoName: 'whatthedeuce.mp4'
  }
];

/**
 * Check and respond to user-specific triggers
 * @param {Message} message - Discord message object
 * @returns {Promise<boolean>} - Returns true if a trigger was activated
 */
export async function checkUserTriggers(message) {
  // Skip bots
  if (message.author.bot) return false;

  const userId = message.author.id;
  const messageContent = message.content.toLowerCase().trim();

  // Find matching trigger for this user
  const trigger = USER_TRIGGERS.find(t => t.userId === userId);
  
  if (!trigger) return false;

  // Check if any of the trigger phrases match (case-insensitive, punctuation-agnostic)
  const normalizedMessage = messageContent.replace(/[^\w\s]/g, '');
  const matchedPhrase = trigger.phrases.find(phrase => {
    const normalizedPhrase = phrase.toLowerCase().replace(/[^\w\s]/g, '');
    return normalizedMessage === normalizedPhrase;
  });

  if (!matchedPhrase) return false;

  // Trigger matched - send the video
  try {
    const attachment = new AttachmentBuilder(trigger.videoPath, { 
      name: trigger.videoName 
    });

    await message.reply({
      files: [attachment]
    });

    console.log(`[USER TRIGGER] Activated for user ${userId}: "${matchedPhrase}"`);
    return true;
  } catch (error) {
    console.error(`[USER TRIGGER] Error sending video for user ${userId}:`, error);
    return false;
  }
}

export default { checkUserTriggers };

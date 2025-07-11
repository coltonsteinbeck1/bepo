import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { UserMemoryManager, MemoryUtils } from '../../utils/memoryUtils.js';

export const data = new SlashCommandBuilder()
  .setName('memory')
  .setDescription('Manage your personal memory with Bepo')
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('View your stored memories')
      .addStringOption(option =>
        option.setName('type')
          .setDescription('Type of memories to view')
          .addChoices(
            { name: 'All', value: 'all' },
            { name: 'Conversations', value: 'conversation' },
            { name: 'Preferences', value: 'preference' },
            { name: 'Summaries', value: 'conversation_summary' }
          )))
  .addSubcommand(subcommand =>
    subcommand
      .setName('clear')
      .setDescription('Clear your stored memories')
      .addStringOption(option =>
        option.setName('type')
          .setDescription('Type of memories to clear')
          .setRequired(true)
          .addChoices(
            { name: 'All', value: 'all' },
            { name: 'Conversations', value: 'conversation' },
            { name: 'Preferences', value: 'preference' },
            { name: 'Summaries', value: 'conversation_summary' }
          )))
  .addSubcommand(subcommand =>
    subcommand
      .setName('search')
      .setDescription('Search your memories')
      .addStringOption(option =>
        option.setName('query')
          .setDescription('Search term to look for in your memories')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('type')
          .setDescription('Type of memories to search')
          .addChoices(
            { name: 'All', value: 'all' },
            { name: 'Conversations', value: 'conversation' },
            { name: 'Preferences', value: 'preference' },
            { name: 'Summaries', value: 'conversation_summary' }
          )))
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Set a preference - Examples: name="Alex", timezone="PST", interests="coding,gaming"')
      .addStringOption(option =>
        option.setName('key')
          .setDescription('Preference name (name, timezone, language, coding_style, interests, goals, etc.)')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('value')
          .setDescription('Preference value - Examples: "Alex", "EST", "Python", "clean code", "gaming,music"')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('stats')
      .setDescription('View your memory statistics'));

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const userId = interaction.user.id;

  try {
    if (subcommand === 'view') {
      const type = interaction.options.getString('type') || 'all';
      const result = await UserMemoryManager.getFormattedMemories(userId, type);
      
      if (!result.success) {
        return interaction.reply({ 
          content: result.error || 'Failed to fetch memories.',
          flags: MessageFlags.Ephemeral 
        });
      }

      if (result.memories.length === 0) {
        return interaction.reply({ 
          content: result.message,
          flags: MessageFlags.Ephemeral 
        });
      }

      const memoryText = MemoryUtils.formatMemoryList(result.memories, result.hasMore);

      return interaction.reply({
        content: `**Your ${type === 'all' ? '' : type + ' '}memories:**\n\n${memoryText}`,
        flags: MessageFlags.Ephemeral
      });

    } else if (subcommand === 'search') {
      const query = interaction.options.getString('query');
      const type = interaction.options.getString('type') || null;
      
      const result = await UserMemoryManager.searchMemories(userId, query, type);
      
      if (!result.success) {
        return interaction.reply({ 
          content: result.error || 'Failed to search memories.',
          flags: MessageFlags.Ephemeral 
        });
      }

      if (result.memories.length === 0) {
        return interaction.reply({ 
          content: result.message,
          flags: MessageFlags.Ephemeral 
        });
      }

      const memoryText = MemoryUtils.formatMemoryList(result.memories);

      return interaction.reply({
        content: `**Search results for "${query}":**\n\n${memoryText}`,
        flags: MessageFlags.Ephemeral
      });

    } else if (subcommand === 'clear') {
      const type = interaction.options.getString('type');
      const typeFilter = type === 'all' ? null : type;
      
      const result = await UserMemoryManager.clearMemories(userId, typeFilter);
      
      if (!result.success) {
        return interaction.reply({ 
          content: result.error || 'Failed to clear memories.',
          flags: MessageFlags.Ephemeral 
        });
      }

      return interaction.reply({
        content: result.message,
        flags: MessageFlags.Ephemeral
      });

    } else if (subcommand === 'set') {
      const key = interaction.options.getString('key');
      const value = interaction.options.getString('value');
      
      const result = await UserMemoryManager.setPreference(userId, key, value);
      
      if (!result.success) {
        return interaction.reply({ 
          content: result.error || 'Failed to set preference.',
          flags: MessageFlags.Ephemeral 
        });
      }
      
      // Provide helpful examples for common preferences
      const helpText = getPreferenceHelpText(key);
      
      return interaction.reply({
        content: `${result.message}${helpText}`,
        flags: MessageFlags.Ephemeral
      });

    } else if (subcommand === 'stats') {
      const result = await UserMemoryManager.getStats(userId);
      
      if (!result.success) {
        return interaction.reply({ 
          content: result.error || 'Failed to get memory stats.',
          flags: MessageFlags.Ephemeral 
        });
      }

      const stats = result.stats;
      const oldestDate = stats.oldest ? new Date(stats.oldest) : null;

      return interaction.reply({
        content: `**Your Memory Stats:**\n\n` +
          `Total memories: **${stats.total}**\n` +
          `Conversations: **${stats.byType.conversation || 0}**\n` +
          `Preferences: **${stats.byType.preference || 0}**\n` +
          `Summaries: **${stats.byType.conversation_summary || 0}**\n` +
          `Other: **${Object.entries(stats.byType).filter(([key]) => !['conversation', 'preference', 'conversation_summary'].includes(key)).reduce((sum, [, count]) => sum + count, 0)}**\n\n` +
          `${oldestDate ? `Oldest memory: ${getTimeAgo(oldestDate)}` : 'No memories yet'}`,
        flags: MessageFlags.Ephemeral
      });
    }

  } catch (error) {
    console.error('Memory command error:', error);
    return interaction.reply({
      content: 'An error occurred while managing your memory.',
      flags: MessageFlags.Ephemeral
    });
  }
}

/**
 * Get helpful text for preference setting
 */
function getPreferenceHelpText(key) {
  const helpMap = {
    'name': '\n*Now I\'ll remember what to call you!*',
    'nickname': '\n*Now I\'ll remember what to call you!*',
    'timezone': '\n*This helps me understand your time context!*',
    'tz': '\n*This helps me understand your time context!*',
    'language': '\n*I can adjust my responses to your preferred language!*',
    'lang': '\n*I can adjust my responses to your preferred language!*',
    'coding_style': '\n*I\'ll remember your coding preferences!*',
    'code_style': '\n*I\'ll remember your coding preferences!*',
    'programming_style': '\n*I\'ll remember your coding preferences!*',
    'interests': '\n*Great! I\'ll keep your interests in mind during conversations!*',
    'hobbies': '\n*Great! I\'ll keep your interests in mind during conversations!*'
  };
  
  return helpMap[key.toLowerCase()] || '';
}

// Import getTimeAgo for backwards compatibility
import { getTimeAgo } from '../../supabase/supabase.js';

export default { data, execute };

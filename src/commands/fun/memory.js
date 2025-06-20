import { SlashCommandBuilder } from 'discord.js';
import { 
  getUserMemories, 
  searchUserMemories, 
  deleteUserMemories, 
  setUserPreference, 
  getUserMemoryStats,
  getTimeAgo 
} from '../../supabase/supabase.js';

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
      
      let memories;
      if (type === 'all') {
        memories = await getUserMemories(userId);
      } else {
        memories = await searchUserMemories(userId, '', type);
      }

      if (memories.length === 0) {
        return interaction.reply({ 
          content: `No ${type === 'all' ? '' : type + ' '}memories found.`,
          ephemeral: true 
        });
      }

      const memoryText = memories.slice(0, 10).map((memory, index) => {
        const timeAgo = getTimeAgo(new Date(memory.updated_at));
        return `${index + 1}. **${memory.context_type}** (${timeAgo}) \`ID: ${memory.id}\`\n   ${memory.memory_content.substring(0, 100)}${memory.memory_content.length > 100 ? '...' : ''}`;
      }).join('\n\n');

      return interaction.reply({
        content: `**Your ${type === 'all' ? '' : type + ' '}memories:**\n\n${memoryText}${memories.length > 10 ? `\n\n... and ${memories.length - 10} more` : ''}`,
        ephemeral: true
      });

    } else if (subcommand === 'clear') {
      const type = interaction.options.getString('type');
      
      let deletedCount = 0;
      if (type === 'all') {
        deletedCount = await deleteUserMemories(userId);
      } else {
        deletedCount = await deleteUserMemories(userId, type);
      }

      return interaction.reply({
        content: `Cleared ${deletedCount} ${type === 'all' ? '' : type + ' '}memories.`,
        ephemeral: true
      });

    } else if (subcommand === 'set') {
      const key = interaction.options.getString('key');
      const value = interaction.options.getString('value');
      
      await setUserPreference(userId, key, value);
      
      // Provide helpful examples if they're setting common preferences
      let helpText = '';
      if (['name', 'nickname'].includes(key.toLowerCase())) {
        helpText = '\n💡 *Now I\'ll remember what to call you!*';
      } else if (['timezone', 'tz'].includes(key.toLowerCase())) {
        helpText = '\n💡 *This helps me understand your time context!*';
      } else if (['language', 'lang'].includes(key.toLowerCase())) {
        helpText = '\n💡 *I can adjust my responses to your preferred language!*';
      } else if (['coding_style', 'code_style', 'programming_style'].includes(key.toLowerCase())) {
        helpText = '\n💡 *I\'ll remember your coding preferences!*';
      } else if (['interests', 'hobbies'].includes(key.toLowerCase())) {
        helpText = '\n💡 *Great! I\'ll keep your interests in mind during conversations!*';
      }
      
      return interaction.reply({
        content: `Preference set: **${key}** = ${value}${helpText}`,
        ephemeral: true
      });

    } else if (subcommand === 'stats') {
      const stats = await getUserMemoryStats(userId);
      
      const oldestDate = stats.oldest ? new Date(stats.oldest) : null;

      return interaction.reply({
        content: `**Your Memory Stats:**\n\n` +
          `📝 Total memories: **${stats.total}**\n` +
          `💬 Conversations: **${stats.byType.conversation || 0}**\n` +
          `⚙️ Preferences: **${stats.byType.preference || 0}**\n` +
          `📄 Summaries: **${stats.byType.conversation_summary || 0}**\n` +
          `📂 Other: **${Object.entries(stats.byType).filter(([key]) => !['conversation', 'preference', 'conversation_summary'].includes(key)).reduce((sum, [, count]) => sum + count, 0)}**\n\n` +
          `${oldestDate ? `📅 Oldest memory: ${getTimeAgo(oldestDate)}` : 'No memories yet'}`,
        ephemeral: true
      });
    }

  } catch (error) {
    console.error('Memory command error:', error);
    return interaction.reply({
      content: 'An error occurred while managing your memory.',
      ephemeral: true
    });
  }
}

export default { data, execute };

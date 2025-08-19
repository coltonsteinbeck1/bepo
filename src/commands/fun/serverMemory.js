import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { ServerMemoryManager, MemoryUtils } from '../../utils/memoryUtils.js';
import { getTimeAgo } from '../../supabase/supabase.js';
import { getUsernamesFromIds } from '../../utils/utils.js';

export const data = new SlashCommandBuilder()
  .setName('servermemory')
  .setDescription('Manage server-wide memories that all users can reference')
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Add a memory for this server')
      .addStringOption(option =>
        option.setName('content')
          .setDescription('The memory content to store')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('title')
          .setDescription('Optional title for the memory')
          .setRequired(false)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('View server memories')
      .addStringOption(option =>
        option.setName('filter')
          .setDescription('Filter memories by content or title')
          .setRequired(false))
      .addIntegerOption(option =>
        option.setName('limit')
          .setDescription('Number of memories to show (default: 10, max: 20)')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(20)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('search')
      .setDescription('Search server memories')
      .addStringOption(option =>
        option.setName('query')
          .setDescription('Search term to find in memories')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Delete a server memory (your own, or any if you\'re admin)')
      .addStringOption(option =>
        option.setName('memory_id')
          .setDescription('ID of the memory to delete')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('stats')
      .setDescription('View server memory statistics'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('my')
      .setDescription('View your memories for this server')
      .addIntegerOption(option =>
        option.setName('limit')
          .setDescription('Number of memories to show (default: 10)')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(20)));

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand(); 
  const serverId = interaction.guild?.id;
  const userId = interaction.user.id;

  if (!serverId) {
    return interaction.reply({
      content: 'This command can only be used in a server.',
      flags: MessageFlags.Ephemeral
    });
  }

  try {
    if (subcommand === 'add') {
      const content = interaction.options.getString('content');
      const title = interaction.options.getString('title');
      
      const result = await ServerMemoryManager.storeMemory(serverId, userId, content, title);
      
      if (!result.success) {
        return interaction.reply({
          content: result.error || 'Failed to store server memory.',
          flags: MessageFlags.Ephemeral
        });
      }

      // Get username for the person who added the memory
      const usernames = await getUsernamesFromIds(interaction.client, [userId]);
      const username = usernames[userId] || 'Unknown User';

      const embed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setTitle('📝 Server Memory Added')
        .setDescription(`**${title || 'Memory'}** has been saved for ${interaction.guild.name}`)
        .addFields(
          { name: 'Content', value: content.substring(0, 500) + (content.length > 500 ? '...' : '') },
          { name: 'Memory ID', value: result.memoryId || 'Unknown', inline: true },
          { name: 'Added by', value: username, inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'list') {
      const filter = interaction.options.getString('filter');
      const limit = interaction.options.getInteger('limit') || 10;
      
      let result;
      if (filter) {
        result = await ServerMemoryManager.searchMemories(serverId, filter, null, limit);
      } else {
        result = await ServerMemoryManager.getFormattedMemories(serverId, null, limit);
      }

      if (!result.success) {
        return interaction.reply({
          content: result.error || 'Failed to fetch server memories.',
          flags: MessageFlags.Ephemeral
        });
      }

      if (result.memories.length === 0) {
        return interaction.reply({
          content: result.message || 'No server memories found.',
          flags: MessageFlags.Ephemeral
        });
      }

      const embed = await createMemoryListEmbed(
        result.memories, 
        interaction, 
        userId, 
        `📚 Server Memories - ${interaction.guild.name}`,
        `Showing ${result.memories.length} memories${filter ? ` matching "${filter}"` : ''}`
      );

      return interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'search') {
      const query = interaction.options.getString('query');
      const result = await ServerMemoryManager.searchMemories(serverId, query, null, 15);

      if (!result.success) {
        return interaction.reply({
          content: result.error || 'Failed to search server memories.',
          flags: MessageFlags.Ephemeral
        });
      }

      if (result.memories.length === 0) {
        return interaction.reply({
          content: result.message || `No memories found matching "${query}".`,
          flags: MessageFlags.Ephemeral
        });
      }

      const embed = await createMemoryListEmbed(
        result.memories.slice(0, 8), 
        interaction, 
        userId, 
        `🔍 Search Results - "${query}"`,
        `Found ${result.memories.length} matching memories in ${interaction.guild.name}`
      );

      if (result.memories.length > 8) {
        embed.setFooter({ text: `... and ${result.memories.length - 8} more results` });
      }

      return interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'delete') {
      const memoryId = interaction.options.getString('memory_id');
      const isCodeMonkey = userId === process.env.CODE_MONKEY;
      
      const result = await ServerMemoryManager.deleteMemory(memoryId, isCodeMonkey ? null : userId);
      
      if (!result.success) {
        return interaction.reply({
          content: result.error || 'Failed to delete memory.',
          flags: MessageFlags.Ephemeral
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🗑️ Memory Deleted')
        .setDescription(`Memory has been deleted from ${interaction.guild.name}`)
        .addFields(
          { name: 'Memory ID', value: memoryId, inline: true },
          { name: 'Deleted By', value: isCodeMonkey ? `<@${userId}> (Admin)` : `<@${userId}>`, inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } else if (subcommand === 'stats') {
      const result = await ServerMemoryManager.getStats(serverId);
      
      if (!result.success) {
        return interaction.reply({
          content: result.error || 'Failed to get server memory stats.',
          flags: MessageFlags.Ephemeral
        });
      }

      const stats = result.stats;
      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle(`📊 Server Memory Statistics - ${interaction.guild.name}`)
        .addFields(
          { name: '📝 Total Memories', value: stats.total.toString(), inline: true },
          { name: '👥 Contributors', value: Object.keys(stats.byUser).length.toString(), inline: true },
          { name: '📅 Oldest Memory', value: stats.oldest ? getTimeAgo(new Date(stats.oldest)) : 'None', inline: true }
        )
        .setTimestamp();

      if (Object.keys(stats.byType).length > 0) {
        const typeStats = Object.entries(stats.byType)
          .map(([type, count]) => `${type}: ${count}`)
          .join('\n');
        embed.addFields({ name: '📂 By Type', value: typeStats, inline: true });
      }

      if (Object.keys(stats.byUser).length > 0) {
        // Get top 5 contributor user IDs and resolve to usernames
        const topContributorIds = Object.entries(stats.byUser)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([userId]) => userId);
        
        const usernames = await getUsernamesFromIds(interaction.client, topContributorIds);
        
        const topContributors = Object.entries(stats.byUser)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([userId, count]) => `${usernames[userId] || 'Unknown User'}: ${count}`)
          .join('\n');
        embed.addFields({ name: '🏆 Top Contributors', value: topContributors, inline: true });
      }

      return interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'my') {
      const limit = interaction.options.getInteger('limit') || 10;
      // Note: Need to implement getUserServerMemories in ServerMemoryManager
      // For now, using existing functionality
      const { getUserServerMemories } = await import('../../supabase/supabase.js');
      const memories = await getUserServerMemories(serverId, userId, limit);

      if (memories.length === 0) {
        return interaction.reply({
          content: `You haven't added any memories to ${interaction.guild.name} yet.`,
          flags: MessageFlags.Ephemeral
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle(`📝 Your Memories - ${interaction.guild.name}`)
        .setDescription(`You have ${memories.length} memories in this server`)
        .setTimestamp();

      memories.forEach((memory, index) => {
        const timeAgo = getTimeAgo(new Date(memory.updated_at));
        const title = memory.memory_title || `Memory ${index + 1}`;
        const content = memory.memory_content.substring(0, 150) + (memory.memory_content.length > 150 ? '...' : '');
        
        embed.addFields({
          name: `${title}`,
          value: `${content}\n*Added ${timeAgo} • ID: \`${memory.id.substring(0, 8)}\`*`,
          inline: false
        });
      });

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

  } catch (error) {
    console.error('Server memory command error:', error);
    return interaction.reply({
      content: 'An error occurred while managing server memories.',
      flags: MessageFlags.Ephemeral
    });
  }
}

/**
 * Create a formatted embed for memory lists
 */
async function createMemoryListEmbed(memories, interaction, userId, title, description) {
  // Get unique user IDs and resolve them to usernames
  const uniqueUserIds = [...new Set(memories.map(m => m.userId))];
  const usernames = await getUsernamesFromIds(interaction.client, uniqueUserIds);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  memories.slice(0, 10).forEach((memory, index) => {
    const title = memory.title || `Memory ${index + 1}`;
    const isCodeMonkey = userId === process.env.CODE_MONKEY;
    const username = usernames[memory.userId] || 'Unknown User';
    
    // Show full ID for CODE_MONKEY, short ID for others
    const displayId = isCodeMonkey ? memory.id : memory.id.substring(0, 8);
    
    embed.addFields({
      name: `${index + 1}. ${title}`,
      value: `${memory.preview}\n*Added by ${username} • ${memory.timeAgo} • ID: \`${displayId}\`*`,
      inline: false
    });
  });

  if (memories.length > 10) {
    embed.setFooter({ text: `... and ${memories.length - 10} more memories` });
  } else if (userId === process.env.CODE_MONKEY) {
    embed.setFooter({ text: `Admin: You can delete any memory using its full ID` });
  }

  return embed;
}

export default { data, execute };

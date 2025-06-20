import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { 
  storeServerMemory,
  getServerMemories, 
  searchServerMemories,
  deleteServerMemory,
  getServerMemoryStats,
  getUserServerMemories,
  getTimeAgo 
} from '../../supabase/supabase.js';

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
      ephemeral: true
    });
  }

  try {
    if (subcommand === 'add') {
      const content = interaction.options.getString('content');
      const title = interaction.options.getString('title');
      
      if (content.length > 1000) {
        return interaction.reply({
          content: 'Memory content is too long. Please keep it under 1000 characters.',
          ephemeral: true
        });
      }

      const memory = await storeServerMemory(serverId, userId, content, title);
      
      if (!memory) {
        return interaction.reply({
          content: 'Failed to store server memory.',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setTitle('📝 Server Memory Added')
        .setDescription(`**${title || 'Memory'}** has been saved for ${interaction.guild.name}`)
        .addFields(
          { name: 'Content', value: content.substring(0, 500) + (content.length > 500 ? '...' : '') },
          { name: 'Memory ID', value: memory.id, inline: true },
          { name: 'Added by', value: `<@${userId}>`, inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'list') {
      const filter = interaction.options.getString('filter');
      const limit = interaction.options.getInteger('limit') || 10;
      
      let memories;
      if (filter) {
        memories = await searchServerMemories(serverId, filter, null, limit);
      } else {
        memories = await getServerMemories(serverId, null, limit);
      }

      if (memories.length === 0) {
        return interaction.reply({
          content: filter ? `No memories found matching "${filter}".` : 'No server memories found.',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📚 Server Memories - ${interaction.guild.name}`)
        .setDescription(`Showing ${memories.length} memories${filter ? ` matching "${filter}"` : ''}`)
        .setTimestamp();

      memories.slice(0, 10).forEach((memory, index) => {
        const timeAgo = getTimeAgo(new Date(memory.updated_at));
        const title = memory.memory_title || `Memory ${index + 1}`;
        const content = memory.memory_content.substring(0, 100) + (memory.memory_content.length > 100 ? '...' : '');
        const isCodeMonkey = userId === process.env.CODE_MONKEY;
        
        // Show full ID for CODE_MONKEY, short ID for others
        const displayId = isCodeMonkey ? memory.id : memory.id.substring(0, 8);
        
        embed.addFields({
          name: `${index + 1}. ${title}`,
          value: `${content}\n*Added by <@${memory.user_id}> • ${timeAgo} • ID: \`${displayId}\`*`,
          inline: false
        });
      });

      if (memories.length > 10) {
        embed.setFooter({ text: `... and ${memories.length - 10} more memories` });
      } else if (userId === process.env.CODE_MONKEY) {
        embed.setFooter({ text: `Admin: You can delete any memory using its full ID` });
      }

      return interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'search') {
      const query = interaction.options.getString('query');
      const memories = await searchServerMemories(serverId, query, null, 15);

      if (memories.length === 0) {
        return interaction.reply({
          content: `No memories found matching "${query}".`,
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(`🔍 Search Results - "${query}"`)
        .setDescription(`Found ${memories.length} matching memories in ${interaction.guild.name}`)
        .setTimestamp();

      memories.slice(0, 8).forEach((memory, index) => {
        const timeAgo = getTimeAgo(new Date(memory.updated_at));
        const title = memory.memory_title || `Memory ${index + 1}`;
        const content = memory.memory_content.substring(0, 150) + (memory.memory_content.length > 150 ? '...' : '');
        const isCodeMonkey = userId === process.env.CODE_MONKEY;
        
        // Show full ID for CODE_MONKEY, short ID for others
        const displayId = isCodeMonkey ? memory.id : memory.id.substring(0, 8);
        
        embed.addFields({
          name: `${title}`,
          value: `${content}\n*Added by <@${memory.user_id}> • ${timeAgo} • ID: \`${displayId}\`*`,
          inline: false
        });
      });

      if (memories.length > 8) {
        embed.setFooter({ text: `... and ${memories.length - 8} more results` });
      } else if (userId === process.env.CODE_MONKEY) {
        embed.setFooter({ text: `Admin: You can delete any memory using its full ID` });
      }

      return interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'delete') {
      const memoryId = interaction.options.getString('memory_id');
      const isCodeMonkey = userId === process.env.CODE_MONKEY;
      
      // CODE_MONKEY can delete any memory, others can only delete their own
      let targetMemory;
      if (isCodeMonkey) {
        // Search all server memories for CODE_MONKEY
        const allMemories = await getServerMemories(serverId, null, 100);
        targetMemory = allMemories.find(m => 
          m.id === memoryId || m.id.startsWith(memoryId)
        );
      } else {
        // Search only user's own memories for regular users
        const userMemories = await getUserServerMemories(serverId, userId, 50);
        targetMemory = userMemories.find(m => 
          m.id === memoryId || m.id.startsWith(memoryId)
        );
      }

      if (!targetMemory) {
        const errorMsg = isCodeMonkey 
          ? 'Memory not found with that ID.'
          : 'Memory not found or you don\'t have permission to delete it.';
        return interaction.reply({
          content: errorMsg,
          ephemeral: true
        });
      }

      const deletedMemory = await deleteServerMemory(targetMemory.id, userId);
      
      if (!deletedMemory) {
        return interaction.reply({
          content: 'Failed to delete memory or memory not found.',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🗑️ Memory Deleted')
        .setDescription(`**${deletedMemory.memory_title || 'Memory'}** has been deleted from ${interaction.guild.name}`)
        .addFields(
          { name: 'Content', value: deletedMemory.memory_content.substring(0, 200) + (deletedMemory.memory_content.length > 200 ? '...' : '') },
          { name: 'Originally Added By', value: `<@${deletedMemory.user_id}>`, inline: true },
          { name: 'Deleted By', value: isCodeMonkey ? `<@${userId}> (Admin)` : `<@${userId}>`, inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (subcommand === 'stats') {
      const stats = await getServerMemoryStats(serverId);
      
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
        const topContributors = Object.entries(stats.byUser)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([userId, count]) => `<@${userId}>: ${count}`)
          .join('\n');
        embed.addFields({ name: '🏆 Top Contributors', value: topContributors, inline: true });
      }

      return interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'my') {
      const limit = interaction.options.getInteger('limit') || 10;
      const memories = await getUserServerMemories(serverId, userId, limit);

      if (memories.length === 0) {
        return interaction.reply({
          content: `You haven't added any memories to ${interaction.guild.name} yet.`,
          ephemeral: true
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

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

  } catch (error) {
    console.error('Server memory command error:', error);
    return interaction.reply({
      content: 'An error occurred while managing server memories.',
      ephemeral: true
    });
  }
}

export default { data, execute };

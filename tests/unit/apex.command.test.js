import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

// Mock the utils
vi.mock('../../src/utils/apexUtils.js', () => ({
    getCachedPatchNotes: vi.fn(),
    filterPatchNotes: vi.fn(),
    formatContent: vi.fn(content => content) // Simple pass-through mock
}));

// Mock Discord.js EmbedBuilder
vi.mock('discord.js', async () => {
    const actual = await vi.importActual('discord.js');
    return {
        ...actual,
        EmbedBuilder: vi.fn().mockImplementation(() => ({
            setColor: vi.fn().mockReturnThis(),
            setTitle: vi.fn().mockReturnThis(),
            setTimestamp: vi.fn().mockReturnThis(),
            setURL: vi.fn().mockReturnThis(),
            setFooter: vi.fn().mockReturnThis(),
            setThumbnail: vi.fn().mockReturnThis(),
            addFields: vi.fn().mockReturnThis()
        }))
    };
});

describe('Apex Command', () => {
    let apexCommand;

    beforeEach(async () => {
        vi.clearAllMocks();
        apexCommand = (await import('../../src/commands/fun/apex.js')).default;
    });

    describe('Command Definition', () => {
        it('should have correct structure and configuration', () => {
            expect(apexCommand).toHaveProperty('data');
            expect(apexCommand).toHaveProperty('execute');
            expect(apexCommand.data).toBeInstanceOf(SlashCommandBuilder);
            
            const commandData = apexCommand.data.toJSON();
            expect(commandData.name).toBe('apex');
            expect(commandData.description).toBe('Get Apex Legends patch notes (shows newest patch by default)');
            
            const optionNames = commandData.options.map(opt => opt.name);
            expect(optionNames).toContain('count');
            expect(optionNames).toContain('days_ago');
            expect(optionNames).toContain('months_ago');
            expect(optionNames).toContain('keyword');
            expect(optionNames).toContain('refresh');
        });
    });

    describe('Command Execution', () => {
        let mockInteraction;

        beforeEach(() => {
            mockInteraction = {
                deferReply: vi.fn(),
                editReply: vi.fn(),
                followUp: vi.fn(),
                options: {
                    getInteger: vi.fn(),
                    getString: vi.fn(),
                    getBoolean: vi.fn()
                }
            };
        });

        it('should handle successful execution with various scenarios', async () => {
            const { getCachedPatchNotes, filterPatchNotes, formatContent } = await import('../../src/utils/apexUtils.js');

            const mockPatchNotes = [
                {
                    title: 'Apex Legends: Season 25 Update',
                    content: 'New legend and balance changes',
                    date: new Date('2025-06-25'),
                    link: 'https://example.com'
                }
            ];

            getCachedPatchNotes.mockResolvedValue(mockPatchNotes);
            filterPatchNotes.mockReturnValue(mockPatchNotes);
            formatContent.mockImplementation(content => content || '');

            mockInteraction.options.getInteger.mockReturnValue(1);
            mockInteraction.options.getString.mockReturnValue(null);
            mockInteraction.options.getBoolean.mockReturnValue(false);

            await apexCommand.execute(mockInteraction);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(getCachedPatchNotes).toHaveBeenCalledWith(false);
            expect(filterPatchNotes).toHaveBeenCalled();
        });

        it('should handle edge cases and errors', async () => {
            const { getCachedPatchNotes, filterPatchNotes } = await import('../../src/utils/apexUtils.js');

            // Test no patch notes available
            getCachedPatchNotes.mockResolvedValueOnce([]);
            mockInteraction.options.getInteger.mockReturnValue(1);
            mockInteraction.options.getString.mockReturnValue(null);
            mockInteraction.options.getBoolean.mockReturnValue(false);

            await apexCommand.execute(mockInteraction);
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.stringContaining('No Apex Legends patch notes available')
            );

            // Reset mocks for next test
            vi.clearAllMocks();
            mockInteraction.editReply.mockReset();

            // Test filtered results return empty
            getCachedPatchNotes.mockResolvedValueOnce([{ title: 'Test', content: 'Test', date: new Date() }]);
            filterPatchNotes.mockReturnValueOnce([]);
            mockInteraction.options.getString.mockReturnValue('nonexistent');

            await apexCommand.execute(mockInteraction);
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.stringContaining('No Apex Legends patch notes found matching your criteria')
            );

            // Reset mocks for error test
            vi.clearAllMocks();
            mockInteraction.editReply.mockReset();

            // Test error handling
            getCachedPatchNotes.mockRejectedValueOnce(new Error('Network error'));
            mockInteraction.options.getInteger.mockReturnValue(1);
            mockInteraction.options.getString.mockReturnValue(null);
            mockInteraction.options.getBoolean.mockReturnValue(false);

            await apexCommand.execute(mockInteraction);
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.stringContaining('An error occurred while fetching')
            );
        });

        it('should handle parameters correctly', async () => {
            const { getCachedPatchNotes, filterPatchNotes } = await import('../../src/utils/apexUtils.js');

            const mockPatchNotes = [
                {
                    title: 'Test Patch',
                    content: 'Test content',
                    date: new Date('2025-06-25')
                }
            ];

            getCachedPatchNotes.mockResolvedValue(mockPatchNotes);
            filterPatchNotes.mockReturnValue(mockPatchNotes);

            // Test with all parameters provided
            mockInteraction.options.getInteger.mockImplementation((name) => {
                if (name === 'count') return 3;
                if (name === 'days_ago') return 7;
                if (name === 'months_ago') return 2;
                return null;
            });
            mockInteraction.options.getString.mockReturnValue('season');
            mockInteraction.options.getBoolean.mockReturnValue(true);

            await apexCommand.execute(mockInteraction);

            expect(filterPatchNotes).toHaveBeenCalledWith(mockPatchNotes, {
                count: 3,
                daysAgo: 7,
                monthsAgo: 2,
                keyword: 'season'
            });
            expect(getCachedPatchNotes).toHaveBeenCalledWith(true); // refresh: true

            // Reset and test defaults
            vi.clearAllMocks();
            getCachedPatchNotes.mockResolvedValue(mockPatchNotes);
            filterPatchNotes.mockReturnValue(mockPatchNotes);

            mockInteraction.options.getInteger.mockReturnValue(null);
            mockInteraction.options.getString.mockReturnValue(null);
            mockInteraction.options.getBoolean.mockReturnValue(false);

            await apexCommand.execute(mockInteraction);

            expect(filterPatchNotes).toHaveBeenCalledWith(mockPatchNotes, {
                count: 1, // Should default to 1
                daysAgo: null,
                monthsAgo: null,
                keyword: null
            });
            expect(getCachedPatchNotes).toHaveBeenCalledWith(false); // refresh: false
        });
    });
});

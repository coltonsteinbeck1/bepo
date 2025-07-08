import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';

// Mock Discord.js
vi.mock('discord.js', () => ({
    EmbedBuilder: vi.fn().mockImplementation(() => ({
        setColor: vi.fn().mockReturnThis(),
        setTitle: vi.fn().mockReturnThis(),
        setTimestamp: vi.fn().mockReturnThis(),
        setThumbnail: vi.fn().mockReturnThis(),
        setDescription: vi.fn().mockReturnThis(),
        setURL: vi.fn().mockReturnThis(),
        setAuthor: vi.fn().mockReturnThis(),
        addFields: vi.fn().mockReturnThis(),
        setFooter: vi.fn().mockReturnThis()
    }))
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('Apex Notification System Integration', () => {
    let apexNotificationService;
    let apexUtils;

    const TEST_TEMP_DIR = path.join(process.cwd(), 'temp', 'test');
    const TEST_CHANNEL_CONFIG = path.join(TEST_TEMP_DIR, 'apex-channel-config.json');
    const TEST_LAST_PATCH = path.join(TEST_TEMP_DIR, 'last-apex-patch.json');

    beforeEach(async () => {
        vi.clearAllMocks();

        // Setup test directory
        try {
            await fs.mkdir(TEST_TEMP_DIR, { recursive: true });
        } catch (error) {
            // Directory might already exist
        }

        // Clean up test files
        try {
            await fs.unlink(TEST_CHANNEL_CONFIG);
        } catch (error) {
            // File might not exist
        }
        try {
            await fs.unlink(TEST_LAST_PATCH);
        } catch (error) {
            // File might not exist
        }

        // Mock the file paths in environment or temporarily override constants
        process.env.TEST_MODE = 'true';

        // Import modules after environment setup
        apexUtils = await import('../../src/utils/apexUtils.js?t=' + Date.now());
        apexNotificationService = await import('../../src/utils/apexNotificationService.js?t=' + Date.now());
    });

    afterEach(async () => {
        vi.restoreAllMocks();

        // Clean up test environment
        delete process.env.TEST_MODE;

        // Clean up test files
        try {
            await fs.rm(TEST_TEMP_DIR, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('End-to-End Patch Detection Flow', () => {
        it('should detect and process new patch notes', async () => {
            // Mock news page HTML response
            const mockNewsPageHTML = `
        <html>
          <body>
            Links to news/season-26-patch-notes and news/season-25-update
          </body>
        </html>
      `;

            // Mock individual article HTML
            const mockArticleHTML1 = `
        <html>
          <body>
            <h1>Apex Legends: Season 26 Patch Notes</h1>
            <p>June 30, 2025</p>
            <h2>Patch Notes</h2>
            <p>New season with Legend Viper and map updates</p>
          </body>
        </html>
      `;

            const mockArticleHTML2 = `
        <html>
          <body>
            <h1>Apex Legends: Season 25 Update</h1>
            <p>June 25, 2025</p>
            <h2>Update Notes</h2>
            <p>Previous season content</p>
          </body>
        </html>
      `;

            // Mock the main news page fetch
            fetch.mockResolvedValueOnce({
                ok: true,
                text: async () => mockNewsPageHTML
            });

            // Mock individual article fetches
            fetch
                .mockResolvedValueOnce({
                    ok: true,
                    text: async () => mockArticleHTML1
                })
                .mockResolvedValueOnce({
                    ok: true,
                    text: async () => mockArticleHTML2
                });

            // Test patch note fetching
            const patchNotes = await apexUtils.getCachedPatchNotes(true);

            expect(patchNotes).toHaveLength(2);
            expect(patchNotes[0].title).toBe('Apex Legends: Season 26 Patch Notes');
            expect(patchNotes[0].author).toBe('Respawn Entertainment');
            expect(patchNotes[0].link).toContain('season-26-patch-notes');
        });

        it('should handle notification channel configuration', async () => {
            const testChannelId = '123456789012345678';
            const testGuildId = 'guild123456789';

            // Set notification channel
            const setResult = await apexNotificationService.setNotificationChannel(testChannelId, testGuildId);
            expect(setResult).toBe(true);

            // Verify channel was saved
            const channels = await apexNotificationService.getNotificationChannels();
            expect(channels).toContain(testChannelId);

            // Verify monitoring status includes the channel
            const status = await apexNotificationService.getMonitoringStatus();
            expect(status.channels).toContain(testChannelId);
        });

        it('should filter patch notes correctly', async () => {
            const mockPatchNotes = [
                {
                    id: 'apex-2025-07-05-season26',
                    title: 'Apex Legends: Season 26 Patch Notes',
                    content: 'New legend Viper introduced with tactical abilities',
                    date: new Date('2025-07-05'),
                    tags: ['season', 'legend', 'patch-notes']
                },
                {
                    id: 'apex-2025-06-28-hotfix',
                    title: 'Hotfix Update',
                    content: 'Bug fixes for weapon balance',
                    date: new Date('2025-06-28'),
                    tags: ['hotfix', 'bug-fix']
                },
                {
                    id: 'apex-2025-06-25-balance',
                    title: 'Balance Changes',
                    content: 'Weapon damage adjustments',
                    date: new Date('2025-06-25'),
                    tags: ['balance', 'weapon']
                }
            ];

            // Test keyword filtering
            const seasonResults = apexUtils.filterPatchNotes(mockPatchNotes, { keyword: 'season' });
            expect(seasonResults).toHaveLength(1);
            expect(seasonResults[0].title).toContain('Season 26');

            // Test count limiting
            const limitedResults = apexUtils.filterPatchNotes(mockPatchNotes, { count: 2 });
            expect(limitedResults).toHaveLength(2);

            // Test date filtering (last 7 days from July 7)
            const recentResults = apexUtils.filterPatchNotes(mockPatchNotes, { daysAgo: 7 });
            expect(recentResults.length).toBeGreaterThan(0);
            expect(recentResults.every(note =>
                new Date(note.date) >= new Date('2025-06-30')
            )).toBe(true);
        });

        it('should handle content formatting and cleaning', async () => {
            const testContent = `
        <div>Season 26 brings <strong>major updates</strong>:</div>
        <ul>
          <li>New Legend: &quot;Viper&quot;</li>
          <li>Map changes on Storm Point</li>
        </ul>
        Check out more at https://example.com/more-info
      `;

            const cleanedContent = apexUtils.cleanEAContent(testContent);

            expect(cleanedContent).not.toContain('<div>');
            expect(cleanedContent).not.toContain('<ul>');
            expect(cleanedContent).not.toContain('https://example.com/more-info');
            expect(cleanedContent).toContain('Season 26 brings major updates');
            expect(cleanedContent).toContain('New Legend: Viper');
        });
    });

    describe('Error Handling Integration', () => {
        it('should gracefully handle network failures', async () => {
            // Clear cache to ensure fresh state
            apexUtils.clearCache();

            fetch.mockRejectedValue(new Error('Network unavailable'));

            // Should return empty array when no cache is available
            const result = await apexUtils.getCachedPatchNotes(true);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(0);
        });

        it('should handle malformed RSS responses', async () => {
            fetch.mockResolvedValue({
                ok: true,
                text: async () => 'This is not valid XML'
            });

            const result = await apexUtils.getCachedPatchNotes(true);
            expect(Array.isArray(result)).toBe(true);
            // Should fallback to mock data when RSS parsing fails
        });

        it('should handle file system errors gracefully', async () => {
            // Remove the test config file to simulate file system error
            try {
                await fs.unlink(TEST_CHANNEL_CONFIG);
            } catch (error) {
                // File might not exist
            }

            const channels = await apexNotificationService.getNotificationChannels();
            expect(channels).toEqual([]); // Should return empty array when no config file exists
        });
    });

    describe('Cache Management', () => {
        it('should respect cache duration', async () => {
            // Clear any existing cache state
            fetch.mockClear();

            const mockRSSResponse = `
        <rss><channel>
          <item>
            <title><![CDATA[Test Patch]]></title>
            <link>https://example.com</link>
            <pubDate>Mon, 30 Jun 2025 10:00:00 GMT</pubDate>
            <description><![CDATA[Test content]]></description>
          </item>
        </channel></rss>
      `;

            fetch.mockResolvedValue({
                ok: true,
                text: async () => mockRSSResponse
            });

            // Force refresh to ensure fresh data
            await apexUtils.getCachedPatchNotes(true);
            const initialCallCount = fetch.mock.calls.length;
            expect(initialCallCount).toBeGreaterThan(0);

            // Reset fetch mock call count
            fetch.mockClear();

            // Subsequent call within cache duration should not fetch again
            await apexUtils.getCachedPatchNotes(false);
            expect(fetch).toHaveBeenCalledTimes(0);

            // Force refresh should always fetch
            await apexUtils.getCachedPatchNotes(true);
            expect(fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('Configuration Persistence', () => {
        it('should persist notification channel settings across operations', async () => {
            const channelId1 = '111111111111111111';
            const channelId2 = '222222222222222222';
            const guildId = 'testguild123';

            // Add first channel
            await apexNotificationService.setNotificationChannel(channelId1, guildId);
            let channels = await apexNotificationService.getNotificationChannels();
            expect(channels).toContain(channelId1);

            // Add second channel
            await apexNotificationService.setNotificationChannel(channelId2, guildId);
            channels = await apexNotificationService.getNotificationChannels();
            expect(channels).toContain(channelId1);
            expect(channels).toContain(channelId2);

            // Remove first channel
            await apexNotificationService.removeNotificationChannel(channelId1);
            channels = await apexNotificationService.getNotificationChannels();
            expect(channels).not.toContain(channelId1);
            expect(channels).toContain(channelId2);
        });
    });
});

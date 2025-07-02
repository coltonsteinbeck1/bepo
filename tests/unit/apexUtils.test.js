import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally before any imports
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { 
  getCachedPatchNotes, 
  filterPatchNotes, 
  formatContent, 
  isPatchNote,
  cleanEAContent,
  extractArticleLinks,
  fetchArticleContent,
  fetchPatchNotesFromEA
} from '../../src/utils/apexUtils.js';

describe('Apex Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isPatchNote', () => {
    it('should identify patch notes correctly', () => {
      expect(isPatchNote('Apex Legends Patch Notes', 'Update content')).toBe(true);
      expect(isPatchNote('Season 25 Update', 'New legend added')).toBe(true);
      expect(isPatchNote('Bug fixes and balance changes', 'Various improvements')).toBe(true);
      expect(isPatchNote('Random news', 'Just some random content')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isPatchNote('PATCH NOTES', 'content')).toBe(true);
      expect(isPatchNote('title', 'HOTFIX applied')).toBe(true);
    });
  });

  describe('cleanEAContent', () => {
    it('should remove HTML tags', () => {
      const input = '<div>Content with <strong>HTML</strong> tags</div>';
      const result = cleanEAContent(input);
      expect(result).toBe('Content with HTML tags');
    });

    it('should remove HTML entities', () => {
      const input = 'Content with &amp; &lt; &gt; entities';
      const result = cleanEAContent(input);
      expect(result).toBe('Content with entities');
    });

    it('should remove scripts and styles', () => {
      const input = '<script>alert("bad")</script><style>.test{}</style>Good content';
      const result = cleanEAContent(input);
      expect(result).toBe('Good content');
    });

    it('should normalize whitespace', () => {
      const input = 'Text   with    multiple     spaces';
      const result = cleanEAContent(input);
      expect(result).toBe('Text with multiple spaces');
    });

    it('should handle empty content', () => {
      expect(cleanEAContent('')).toBe('');
      expect(cleanEAContent('<div></div>')).toBe('');
    });
  });

  describe('formatContent', () => {
    it('should preserve markdown formatting', () => {
      const input = '**Bold text** and *italic text* with `code`';
      const result = formatContent(input);
      expect(result).toBe('**Bold text** and *italic text* with `code`');
    });

    it('should preserve code blocks', () => {
      const input = '```javascript\nconst x = 1;\n```';
      const result = formatContent(input);
      expect(result).toBe('```javascript\nconst x = 1;\n```');
    });

    it('should limit consecutive newlines', () => {
      const input = 'Line 1\n\n\n\n\nLine 2';
      const result = formatContent(input);
      expect(result).toBe('Line 1\n\nLine 2');
    });

    it('should handle empty content', () => {
      expect(formatContent('')).toBe('');
      expect(formatContent(null)).toBe('');
      expect(formatContent(undefined)).toBe('');
    });
  });

  describe('filterPatchNotes', () => {
    const mockPatchNotes = [
      {
        id: '1',
        title: 'Season 25 Update',
        content: 'New legend Sparrow',
        date: new Date('2025-06-30'), // 1 day ago from July 1
        tags: ['season', 'legend']
      },
      {
        id: '2',
        title: 'Hotfix Update',
        content: 'Bug fixes',
        date: new Date('2025-06-20'), // 11 days ago 
        tags: ['hotfix', 'bug-fix']
      },
      {
        id: '3',
        title: 'Balance Changes',
        content: 'Weapon adjustments',
        date: new Date('2025-06-15'), // 16 days ago
        tags: ['balance', 'weapon']
      }
    ];

    it('should filter by keyword in title', () => {
      const result = filterPatchNotes(mockPatchNotes, { keyword: 'season' });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Season 25 Update');
    });

    it('should filter by keyword in content', () => {
      const result = filterPatchNotes(mockPatchNotes, { keyword: 'sparrow' });
      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('Sparrow');
    });

    it('should filter by keyword in tags', () => {
      const result = filterPatchNotes(mockPatchNotes, { keyword: 'hotfix' });
      expect(result).toHaveLength(1);
      expect(result[0].tags).toContain('hotfix');
    });

    it('should filter by days ago', () => {
      const result = filterPatchNotes(mockPatchNotes, { daysAgo: 7 });
      expect(result).toHaveLength(1); // Only the June 30 entry should be within 7 days
    });

    it('should limit count', () => {
      const result = filterPatchNotes(mockPatchNotes, { count: 2 });
      expect(result).toHaveLength(2);
    });

    it('should handle empty filters', () => {
      const result = filterPatchNotes(mockPatchNotes, {});
      expect(result).toHaveLength(3);
    });
  });

  describe('extractArticleLinks', () => {
    it('should extract article links from HTML', () => {
      const mockHTML = `
        <html>
          <body>
            Some content with news/season-26-patch-notes and news/update-notes-19-1
            and news/beast-mode-event mentioned in the page.
          </body>
        </html>
      `;
      
      const result = extractArticleLinks(mockHTML);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(link => link.url.includes('season-26-patch-notes'))).toBe(true);
      expect(result.some(link => link.url.includes('update-notes-19-1'))).toBe(true);
    });

    it('should create proper titles from paths', () => {
      const mockHTML = 'Some content with news/season-26-patch-notes in it';
      
      const result = extractArticleLinks(mockHTML);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].title).toBe('Season 26 Patch Notes');
      expect(result[0].url).toBe('https://www.ea.com/games/apex-legends/apex-legends/news/season-26-patch-notes');
    });

    it('should handle empty HTML', () => {
      const result = extractArticleLinks('');
      expect(result).toEqual([]);
    });
  });

  describe('fetchArticleContent', () => {
    it('should fetch and parse article content', async () => {
      const mockArticleHTML = `
        <html>
          <head><title>Test Article</title></head>
          <body>
            <h1>Future Icons Event</h1>
            <p>June 20, 2025</p>
            <h2>Patch Notes</h2>
            <p>Balance updates and legend changes</p>
            <p>New weapon rotation</p>
          </body>
        </html>
      `;

      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockArticleHTML
      });

      const linkInfo = {
        url: 'https://www.ea.com/games/apex-legends/apex-legends/news/future-icons-event',
        title: 'Future Icons Event'
      };

      const result = await fetchArticleContent(linkInfo);

      expect(result).toBeTruthy();
      expect(result.title).toBe('Future Icons Event');
      expect(result.author).toBe('Respawn Entertainment');
      expect(result.content).toContain('Balance updates');
    });

    it('should handle fetch errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const linkInfo = {
        url: 'https://example.com/test',
        title: 'Test Article'
      };

      const result = await fetchArticleContent(linkInfo);
      expect(result).toBeNull();
    });
  });

  describe('fetchPatchNotesFromEA', () => {
    it('should fetch and parse news page successfully', async () => {
      const mockNewsPageHTML = `
        <html>
          <body>
            Links to news/season-26-patch-notes and news/update-notes-19-1
          </body>
        </html>
      `;

      const mockArticleHTML = `
        <html>
          <body>
            <h1>Season 26 Patch Notes</h1>
            <p>June 20, 2025</p>
            <h2>Balance Updates</h2>
            <p>Legend changes and weapon balance</p>
          </body>
        </html>
      `;

      // Mock the main news page fetch
      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockNewsPageHTML
      });

      // Mock individual article fetches - need 2 successful fetches for 2 articles
      fetch.mockResolvedValue({
        ok: true,
        text: async () => mockArticleHTML
      });

      const result = await fetchPatchNotesFromEA(2);
      
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Season 26 Patch Notes');
      expect(result[0].author).toBe('Respawn Entertainment');
    });

    it('should handle news page fetch failure', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchPatchNotesFromEA(5)).rejects.toThrow('Network error');
    });

    it('should handle empty news page', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '<html><body>No news content</body></html>'
      });

      const result = await fetchPatchNotesFromEA(5);
      expect(result).toEqual([]);
    });
  });

  describe('getCachedPatchNotes', () => {
    it('should return cached data when available and fresh', async () => {
      const mockData = [{ id: '1', title: 'Test Patch' }];
      
      // Mock successful fetch for first call
      const mockNewsPageHTML = 'Some content with news/test-patch-notes';
      const mockArticleHTML = '<h1>Test Patch Notes</h1><p>Test content</p>';
      
      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockNewsPageHTML
      }).mockResolvedValueOnce({
        ok: true,
        text: async () => mockArticleHTML
      });

      // First call should fetch fresh data
      const result1 = await getCachedPatchNotes(false);
      expect(result1.length).toBeGreaterThan(0);

      // Clear fetch mock to ensure cache is used
      fetch.mockClear();

      // Second call should return cached data
      const result2 = await getCachedPatchNotes(false);
      expect(fetch).not.toHaveBeenCalled();
      expect(result2).toEqual(result1);
    });

    it('should force refresh when requested', async () => {
      // Mock successful fetch
      const mockNewsPageHTML = 'news/test-patch-notes';
      const mockArticleHTML = '<h1>Test Patch</h1><p>Test content</p>';
      
      fetch.mockResolvedValue({
        ok: true,
        text: async () => mockNewsPageHTML
      }).mockResolvedValue({
        ok: true,
        text: async () => mockArticleHTML
      });

      await getCachedPatchNotes(false);
      fetch.mockClear();

      // Force refresh should fetch again
      await getCachedPatchNotes(true);
      expect(fetch).toHaveBeenCalled();
    });

    it('should return empty array on persistent errors', async () => {
      fetch.mockRejectedValue(new Error('Network error'));

      const result = await getCachedPatchNotes(true);
      
      // Should return empty array when no cached data and fetch fails
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
});

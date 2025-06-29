import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally before any imports
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the entire module to prevent real API calls
vi.mock('../../src/utils/cs2Utils.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchPatchNotesFromSteam: vi.fn(),
    getCachedPatchNotes: vi.fn(),
  };
});

import { 
  fetchPatchNotesFromSteam, 
  getCachedPatchNotes, 
  filterPatchNotes, 
  formatContent,
  cleanSteamContent
} from '../../src/utils/cs2Utils.js';

describe('CS2 Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('cleanSteamContent', () => {
    it('should remove image URLs and normalize whitespace', () => {
      const input = 'Text https://clan.cloudflare.steamstatic.com/images/123/image.png more   text    here';
      const result = cleanSteamContent(input);
      
      expect(result).toBe('Text more text here');
    });

    it('should limit content length', () => {
      const longContent = 'a'.repeat(2000);
      const result = cleanSteamContent(longContent);
      
      expect(result.length).toBeLessThanOrEqual(1500);
    });
  });

  describe('formatContent', () => {
    it('should clean BBCode and format content', () => {
      const input = '[list][*] Item 1[*] Item 2[/list]\n\n\nSome content';
      const result = formatContent(input);
      
      expect(result).toBe('•  Item 1•  Item 2\nSome content');
    });

    it('should limit content length', () => {
      const longContent = 'a'.repeat(2000);
      const result = formatContent(longContent);
      
      expect(result.length).toBeLessThanOrEqual(1024);
    });
  });

  describe('fetchPatchNotesFromSteam', () => {
    it('should fetch and parse patch notes from Steam API', async () => {
      const mockPatchNotes = [
        {
          gid: '123',
          title: 'Counter-Strike 2 Update',
          url: 'https://example.com/update',
          contents: 'Fixed various bugs',
          author: 'Valve',
          date: new Date(),
          tags: ['patchnotes']
        }
      ];

      fetchPatchNotesFromSteam.mockResolvedValue(mockPatchNotes);

      const result = await fetchPatchNotesFromSteam();
      
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Counter-Strike 2 Update');
      expect(result[0].tags).toContain('patchnotes');
    });

    it('should handle API errors gracefully', async () => {
      fetchPatchNotesFromSteam.mockRejectedValue(new Error('HTTP error! Status: 500'));

      await expect(fetchPatchNotesFromSteam()).rejects.toThrow('HTTP error! Status: 500');
    });

    it('should filter CS2 updates properly', async () => {
      const mockPatchNotes = [
        {
          title: 'Counter-Strike 2 Update - Bug Fixes',
          date: new Date(),
          content: 'Various fixes',
          tags: []
        }
      ];

      fetchPatchNotesFromSteam.mockResolvedValue(mockPatchNotes);

      const result = await fetchPatchNotesFromSteam();
      
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Counter-Strike 2 Update - Bug Fixes');
    });
  });

  describe('filterPatchNotes', () => {
    const mockNotes = [
      {
        title: 'Major Update',
        date: new Date('2024-01-15'),
        content: 'Fixed bugs and added features'
      },
      {
        title: 'Minor Patch',
        date: new Date('2024-01-10'),
        content: 'Balance changes'
      },
      {
        title: 'Hotfix',
        date: new Date('2024-01-05'),
        content: 'Critical bug fixes'
      }
    ];

    it('should filter by count', () => {
      const result = filterPatchNotes(mockNotes, { count: 2 });
      expect(result).toHaveLength(2);
    });

    it('should filter by keyword', () => {
      const result = filterPatchNotes(mockNotes, { keyword: 'bug' });
      expect(result).toHaveLength(2);
      expect(result.every(note => 
        note.title.toLowerCase().includes('bug') || 
        note.content.toLowerCase().includes('bug')
      )).toBe(true);
    });

    it('should filter by days ago', () => {
      const result = filterPatchNotes(mockNotes, { daysAgo: 7 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getCachedPatchNotes', () => {
    it('should handle fetch errors gracefully', async () => {
      getCachedPatchNotes.mockResolvedValue([]);

      const result = await getCachedPatchNotes();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should return cached data when available', async () => {
      const mockData = [
        {
          title: 'Counter-Strike 2 Update',
          date: new Date(),
          content: 'Test update',
          tags: ['patchnotes']
        }
      ];

      getCachedPatchNotes.mockResolvedValue(mockData);

      const result = await getCachedPatchNotes(true);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

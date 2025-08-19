import { describe, it, expect, vi, beforeEach } from 'vitest';
import cs2Command from '../../src/commands/fun/cs2.js';

// Mock the utils
vi.mock('../../src/utils/cs2Utils.js', () => ({
  getCachedPatchNotes: vi.fn(),
  filterPatchNotes: vi.fn(),
  formatContent: vi.fn()
}));

describe('CS2 Command', () => {
  let mockInteraction;
  
  beforeEach(() => {
    mockInteraction = {
      deferReply: vi.fn(),
      editReply: vi.fn(),
      followUp: vi.fn(),
      options: {
        getString: vi.fn(),
        getInteger: vi.fn(),
        getBoolean: vi.fn()
      }
    };
  });

  it('should have correct command structure', () => {
    expect(cs2Command.data.name).toBe('cs2');
    expect(cs2Command.data.description).toContain('CS2 patch notes');
  });

  it('should handle command options correctly', async () => {
    mockInteraction.options.getString.mockReturnValue('website');
    mockInteraction.options.getInteger.mockReturnValue(2);
    mockInteraction.options.getBoolean.mockReturnValue(false);

    // Mock the utils to return empty data to test error handling
    const { getCachedPatchNotes } = await import('../../src/utils/cs2Utils.js');
    getCachedPatchNotes.mockResolvedValue([]);

    await cs2Command.execute(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      "⚠ No patch notes available at the moment. Try using `/cs2 source:api` for legacy data."
    );
  });
});

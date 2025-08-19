// Test setup file - runs before all tests
import { vi, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.DISCORD_TOKEN = 'test_token';
process.env.APPLICATION_ID = 'test_app_id';
process.env.CODE_MONKEY = 'test_user_id';
process.env.OPENAI_API_KEY = 'test_openai_key';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_KEY = 'test_supabase_key';

// Store original console for restoration
const originalConsole = { ...console };

// Completely silence console during tests
global.console = {
  ...console,
  log: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {}
};

// Clean up between tests - CRITICAL for isolated test state
beforeEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  
  // Clear any module state - prevent error accumulation between tests
  const modules = [
    'errorHandler',
    'healthMonitor'
  ];
  
  modules.forEach(moduleName => {
    if (global[moduleName]) {
      // Reset error handler state
      if (global[moduleName].errors) global[moduleName].errors = [];
      if (global[moduleName].errorCounts) global[moduleName].errorCounts.clear();
      if (global[moduleName].criticalErrors) global[moduleName].criticalErrors = [];
      if (global[moduleName].lastCleanup) global[moduleName].lastCleanup = Date.now();
    }
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  
  // Ensure clean state for next test
  const modules = [
    'errorHandler',
    'healthMonitor'
  ];
  
  modules.forEach(moduleName => {
    if (global[moduleName]) {
      // Reset error handler state
      if (global[moduleName].errors) global[moduleName].errors = [];
      if (global[moduleName].errorCounts) global[moduleName].errorCounts.clear();
      if (global[moduleName].criticalErrors) global[moduleName].criticalErrors = [];
    }
  });
});

// Mock Discord.js client and interactions
vi.mock('discord.js', async () => {
  const actual = await vi.importActual('discord.js');
  return {
    ...actual,
    Client: vi.fn().mockImplementation(() => ({
      login: vi.fn().mockResolvedValue(true),
      destroy: vi.fn().mockResolvedValue(true),
      user: { id: 'test_bot_id', username: 'TestBot' },
      guilds: {
        cache: new Map(),
        fetch: vi.fn().mockResolvedValue([])
      },
      on: vi.fn(),
      once: vi.fn(),
      commands: {
        set: vi.fn().mockResolvedValue(true)
      }
    })),
    SlashCommandBuilder: actual.SlashCommandBuilder,
    EmbedBuilder: actual.EmbedBuilder,
    MessageFlags: actual.MessageFlags
  };
});

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null })
      }),
      insert: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockResolvedValue({ data: [], error: null }),
      delete: vi.fn().mockResolvedValue({ data: [], error: null })
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        download: vi.fn().mockResolvedValue({ data: null, error: null })
      })
    }
  })
}));

// Mock OpenAI client
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test AI response' } }]
        })
      }
    },
    images: {
      generate: vi.fn().mockResolvedValue({
        data: [{ url: 'https://test.image.url' }]
      })
    }
  }))
}));

// Mock file system operations for logs
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    writeFileSync: vi.fn(),
    appendFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn()
  };
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  
  // Ensure clean state for next test
  if (global.errorHandler) {
    global.errorHandler.errors = [];
  }
});

// Global test utilities
global.createMockInteraction = (options = {}) => ({
  user: { id: 'test_user_id', username: 'TestUser' },
  guild: { id: 'test_guild_id', name: 'Test Guild' },
  channel: { id: 'test_channel_id', name: 'test-channel' },
  options: {
    getString: vi.fn().mockReturnValue('test'),
    getInteger: vi.fn().mockReturnValue(1),
    getBoolean: vi.fn().mockReturnValue(true),
    ...options.options
  },
  reply: vi.fn().mockResolvedValue(true),
  editReply: vi.fn().mockResolvedValue(true),
  followUp: vi.fn().mockResolvedValue(true),
  deferReply: vi.fn().mockResolvedValue(true),
  ...options
});

// Utility to restore console for specific tests if needed
global.restoreConsole = () => {
  global.console = originalConsole;
};

global.mockConsole = () => {
  global.console = {
    ...console,
    log: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {}
  };
};

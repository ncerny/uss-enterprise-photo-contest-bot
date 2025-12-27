import { ChatInputCommandInteraction } from 'discord.js';
import { CommandRateLimiter, buildThrottleKey, CommandThrottleOptions } from './throttle';

// Mock Discord.js interaction
function createMockInteraction(options: {
  userId?: string;
  guildId?: string | null;
  commandName?: string;
}): ChatInputCommandInteraction {
  return {
    user: { id: options.userId ?? 'user123' },
    guildId: 'guildId' in options ? options.guildId : 'guild456',
    commandName: options.commandName ?? 'testcommand',
  } as unknown as ChatInputCommandInteraction;
}

describe('CommandRateLimiter', () => {
  let limiter: CommandRateLimiter;

  beforeEach(() => {
    limiter = new CommandRateLimiter();
  });

  describe('consume', () => {
    const options: CommandThrottleOptions = {
      limit: 3,
      windowMs: 60000,
    };

    it('should allow first request', () => {
      const result = limiter.consume('test-key', options);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
      expect(result.retryAfterMs).toBe(0);
    });

    it('should allow requests up to limit', () => {
      limiter.consume('test-key', options);
      limiter.consume('test-key', options);
      const result = limiter.consume('test-key', options);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('should deny requests over limit', () => {
      limiter.consume('test-key', options);
      limiter.consume('test-key', options);
      limiter.consume('test-key', options);
      const result = limiter.consume('test-key', options);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('should use separate buckets for different keys', () => {
      limiter.consume('key-a', options);
      limiter.consume('key-a', options);
      limiter.consume('key-a', options);

      const resultA = limiter.consume('key-a', options);
      const resultB = limiter.consume('key-b', options);

      expect(resultA.allowed).toBe(false);
      expect(resultB.allowed).toBe(true);
    });

    it('should reset after window expires', () => {
      const shortWindow: CommandThrottleOptions = {
        limit: 1,
        windowMs: 10, // 10ms window
      };

      limiter.consume('test-key', shortWindow);
      const denied = limiter.consume('test-key', shortWindow);
      expect(denied.allowed).toBe(false);

      // Wait for window to expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const result = limiter.consume('test-key', shortWindow);
          expect(result.allowed).toBe(true);
          resolve();
        }, 20);
      });
    });
  });
});

describe('buildThrottleKey', () => {
  it('should return undefined when no options provided', () => {
    const interaction = createMockInteraction({});
    const key = buildThrottleKey(interaction, undefined);

    expect(key).toBeUndefined();
  });

  it('should use user scope by default', () => {
    const interaction = createMockInteraction({
      userId: 'user123',
      commandName: 'mycommand',
    });
    const key = buildThrottleKey(interaction, { limit: 1, windowMs: 1000 });

    expect(key).toBe('user123:mycommand');
  });

  it('should use guild scope when specified', () => {
    const interaction = createMockInteraction({
      guildId: 'guild456',
      commandName: 'mycommand',
    });
    const key = buildThrottleKey(interaction, {
      limit: 1,
      windowMs: 1000,
      scope: 'guild',
    });

    expect(key).toBe('guild456:mycommand');
  });

  it('should use dm as guild key when outside guild', () => {
    const interaction = createMockInteraction({
      guildId: null,
      commandName: 'mycommand',
    });
    const key = buildThrottleKey(interaction, {
      limit: 1,
      windowMs: 1000,
      scope: 'guild',
    });

    expect(key).toBe('dm:mycommand');
  });

  it('should use global scope when specified', () => {
    const interaction = createMockInteraction({
      commandName: 'mycommand',
    });
    const key = buildThrottleKey(interaction, {
      limit: 1,
      windowMs: 1000,
      scope: 'global',
    });

    expect(key).toBe('mycommand');
  });

  it('should use custom keyFactory when provided', () => {
    const interaction = createMockInteraction({});
    const key = buildThrottleKey(interaction, {
      limit: 1,
      windowMs: 1000,
      keyFactory: () => 'custom-key',
    });

    expect(key).toBe('custom-key');
  });
});

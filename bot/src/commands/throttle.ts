import { ChatInputCommandInteraction } from 'discord.js';

export type CommandThrottleScope = 'user' | 'guild' | 'global';

export interface CommandThrottleOptions {
  /** Maximum number of invocations within the window */
  limit: number;
  /** Sliding time window in milliseconds */
  windowMs: number;
  /** Scope used to build the limiter key (defaults to per-user) */
  scope?: CommandThrottleScope;
  /** Optional static message when the throttle is exceeded */
  message?: string;
  /** Optional factory for constructing a custom limiter key */
  keyFactory?: (interaction: ChatInputCommandInteraction) => string;
}

export interface CommandThrottleDecision {
  allowed: boolean;
  remaining: number;
  resetTimestamp: number;
  retryAfterMs: number;
}

interface BucketState {
  count: number;
  resetTimestamp: number;
}

export class CommandRateLimiter {
  private readonly buckets = new Map<string, BucketState>();

  consume(key: string, options: CommandThrottleOptions): CommandThrottleDecision {
    const now = Date.now();
    const resetTimestamp = now + options.windowMs;
    const existing = this.buckets.get(key);

    if (!existing || existing.resetTimestamp <= now) {
      this.buckets.set(key, { count: 1, resetTimestamp });
      return {
        allowed: true,
        remaining: Math.max(options.limit - 1, 0),
        resetTimestamp,
        retryAfterMs: 0,
      };
    }

    if (existing.count < options.limit) {
      existing.count += 1;
      return {
        allowed: true,
        remaining: Math.max(options.limit - existing.count, 0),
        resetTimestamp: existing.resetTimestamp,
        retryAfterMs: 0,
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetTimestamp: existing.resetTimestamp,
      retryAfterMs: Math.max(existing.resetTimestamp - now, 0),
    };
  }
}

export function buildThrottleKey(
  interaction: ChatInputCommandInteraction,
  options: CommandThrottleOptions | undefined
): string | undefined {
  if (!options) {
    return undefined;
  }

  if (options.keyFactory) {
    return options.keyFactory(interaction);
  }

  const scope = options.scope ?? 'user';

  switch (scope) {
    case 'global':
      return interaction.commandName;
    case 'guild':
      return `${interaction.guildId ?? 'dm'}:${interaction.commandName}`;
    case 'user':
    default:
      return `${interaction.user.id}:${interaction.commandName}`;
  }
}

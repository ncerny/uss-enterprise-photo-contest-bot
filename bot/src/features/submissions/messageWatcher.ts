import { ChannelType, Client, Message, PartialMessage, TextChannel } from 'discord.js';
import { Contest, ContestStatus } from '@uss-enterprise/shared';
import { ContestRepository } from '../../repositories';
import { getFirestoreClient } from '../../config/firebaseAdmin';
import { logger } from '../../logger';

const DEFAULT_CACHE_HIT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CACHE_MISS_TTL_MS = 60 * 1000;
const DEFAULT_CACHE_ERROR_TTL_MS = 30 * 1000;

export interface SubmissionMessageContext {
  contest: Contest;
  channel: TextChannel;
  message: Message<boolean>;
}

export interface SubmissionMessageHandler {
  handleSubmissionMessage(context: SubmissionMessageContext): Promise<void>;
}

export interface ContestSubmissionWatcherOptions {
  cacheHitTtlMs?: number;
  cacheMissTtlMs?: number;
  cacheErrorTtlMs?: number;
}

type CacheEntry = {
  contest: Contest | null;
  expiresAt: number;
};

export class ContestSubmissionWatcher {
  private readonly contestRepository = new ContestRepository(getFirestoreClient());
  private readonly cache = new Map<string, CacheEntry>();
  private listener?: (message: Message<boolean> | PartialMessage) => void;
  private handler?: SubmissionMessageHandler;

  constructor(
    private readonly client: Client,
    private readonly options: ContestSubmissionWatcherOptions = {}
  ) {}

  start(): void {
    if (this.listener) {
      return;
    }

    this.listener = (message) => void this.onMessage(message);
    this.client.on('messageCreate', this.listener);
    logger.info('ContestSubmissionWatcher listening for contest submissions.');
  }

  stop(): void {
    if (!this.listener) {
      return;
    }

    this.client.off('messageCreate', this.listener);
    this.listener = undefined;
    this.cache.clear();
    logger.info('ContestSubmissionWatcher stopped.');
  }

  setHandler(handler: SubmissionMessageHandler): void {
    this.handler = handler;
  }

  clearHandler(): void {
    this.handler = undefined;
  }

  private async onMessage(message: Message<boolean> | PartialMessage): Promise<void> {
    const hydrated = await this.hydrateMessage(message);

    if (!hydrated || hydrated.author?.bot || hydrated.webhookId) {
      return;
    }

    if (!hydrated.guildId) {
      return;
    }

    const channel = this.asContestChannel(hydrated.channel);

    if (!channel) {
      return;
    }

    const contest = await this.resolveContest(channel.id);

    if (!contest || contest.status !== ContestStatus.SUBMISSION) {
      return;
    }

    if (!this.handler) {
      logger.debug('ContestSubmissionWatcher dropped submission; no handler registered', {
        contestId: contest.id,
        channelId: channel.id,
        messageId: hydrated.id,
      });
      return;
    }

    try {
      await this.handler.handleSubmissionMessage({ contest, channel, message: hydrated });
    } catch (error) {
      logger.error('ContestSubmissionWatcher handler failed', error as Error);
    }
  }

  private async hydrateMessage(
    message: Message<boolean> | PartialMessage
  ): Promise<Message<boolean> | null> {
    if (!message.partial) {
      return message as Message<boolean>;
    }

    try {
      const fullMessage = (await message.fetch()) as Message<boolean>;
      return fullMessage;
    } catch (error) {
      logger.warn('ContestSubmissionWatcher failed to fetch partial message', error as Error, {
        messageId: message.id,
        channelId: message.channelId,
      });
      return null;
    }
  }

  private asContestChannel(channel: Message['channel']): TextChannel | null {
    if (!channel || channel.type !== ChannelType.GuildText) {
      return null;
    }

    return channel as TextChannel;
  }

  private async resolveContest(channelId: string): Promise<Contest | null> {
    const cached = this.cache.get(channelId);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return cached.contest;
    }

    try {
      const contest = await this.contestRepository.getByChannelId(channelId);
      const ttl = contest
        ? (this.options.cacheHitTtlMs ?? DEFAULT_CACHE_HIT_TTL_MS)
        : (this.options.cacheMissTtlMs ?? DEFAULT_CACHE_MISS_TTL_MS);
      this.cacheContest(channelId, contest, ttl);
      return contest;
    } catch (error) {
      logger.error('ContestSubmissionWatcher failed to resolve contest channel', error as Error, {
        channelId,
      });
      this.cacheContest(
        channelId,
        null,
        this.options.cacheErrorTtlMs ?? DEFAULT_CACHE_ERROR_TTL_MS
      );
      return null;
    }
  }

  private cacheContest(channelId: string, contest: Contest | null, ttlMs: number): void {
    this.cache.set(channelId, {
      contest,
      expiresAt: Date.now() + Math.max(1000, ttlMs),
    });
  }
}

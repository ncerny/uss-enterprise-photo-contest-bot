import { Client, GatewayIntentBits, Partials, RateLimitData, RESTEvents } from 'discord.js';
import { env } from './config/env';
import { logger } from './logger';
import { commandDispatcher } from './commands/dispatcher';
import { commandRegistry } from './commands/registry';
import { errorReporter } from './monitoring/errorReporter';
import { handleContestCreationModal } from './features/contestCreation/modal';
import { ContestScheduler } from './features/contestCreation/scheduler';
import { ContestSubmissionWatcher } from './features/submissions/messageWatcher';
import { SubmissionCaptureHandler } from './features/submissions/captureService';
import { SubmissionUploadService } from './features/submissions/uploadService';
import { SubmissionPersistenceService } from './features/submissions/submissionPersistenceService';
import { SubmissionMessageCleanupService } from './features/submissions/messageCleanupService';
import { SubmissionFeedbackService } from './features/submissions/submissionFeedbackService';
import { SubmissionLimitService } from './features/submissions/submissionLimitService';
import { SubmissionWelcomeMessageService } from './features/submissions/submissionWelcomeMessageService';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

errorReporter.setClient(client);

const contestScheduler = new ContestScheduler(client);
const submissionWatcher = new ContestSubmissionWatcher(client);
const submissionLimitService = new SubmissionLimitService();
const submissionCaptureHandler = new SubmissionCaptureHandler({
  limitValidator: (contest, userId) => submissionLimitService.validateLimit(contest, userId),
});
submissionWatcher.setHandler(submissionCaptureHandler);
const submissionUploadService = new SubmissionUploadService(submissionCaptureHandler);
const submissionPersistenceService = new SubmissionPersistenceService(submissionUploadService);
const submissionCleanupService = new SubmissionMessageCleanupService(submissionPersistenceService);
const submissionFeedbackService = new SubmissionFeedbackService(
  client,
  submissionCaptureHandler,
  submissionUploadService,
  submissionPersistenceService
);
const submissionWelcomeMessageService = new SubmissionWelcomeMessageService(
  submissionPersistenceService
);

client.once('ready', () => {
  logger.info(`Bot connected as ${client.user?.tag ?? 'unknown user'}`);
  submissionWatcher.start();
  contestScheduler.start();
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    await commandDispatcher.dispatch(interaction);
    return;
  }

  if (interaction.isModalSubmit()) {
    await handleContestCreationModal(interaction);
  }
});

client.on('error', (error) => {
  logger.error('Discord client encountered an error', error);
  void errorReporter.reportCritical('discord.js client', error);
});

client.on('shardError', (error) => {
  logger.error('Discord shard encountered an error', error);
  void errorReporter.reportCritical('discord.js shard', error);
});

client.rest.on(RESTEvents.RateLimited, (info: RateLimitData) => {
  const meta = {
    route: info.route,
    global: info.global,
    method: info.method,
    limit: info.limit,
    retryAfter: info.retryAfter,
    timeToReset: info.timeToReset,
  };

  logger.warn(`Discord REST rate limit hit on ${info.route} (global=${info.global})`, meta);

  if (info.global || info.retryAfter >= 3000) {
    const error = new Error(
      `REST rate limit triggered on ${info.route} (global=${info.global}) for ${info.retryAfter}ms`
    );
    void errorReporter.reportCritical('discord.js REST rate limit', error);
  }
});

const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
let shuttingDown = false;

shutdownSignals.forEach((signal) => {
  process.on(signal, async () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info(`Received ${signal}. Shutting down Discord client...`);

    try {
      submissionWelcomeMessageService.stop();
      submissionFeedbackService.stop();
      submissionCleanupService.stop();
      submissionPersistenceService.stop();
      submissionUploadService.stop();
      submissionWatcher.stop();
      contestScheduler.stop();
      await client.destroy();
      logger.info('Discord client shut down gracefully.');
    } catch (error) {
      logger.error('Error during Discord client shutdown', error as Error);
    } finally {
      process.exit(0);
    }
  });
});

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('Unhandled promise rejection', error);
  void errorReporter.reportCritical('unhandledRejection', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  void errorReporter.reportCritical('uncaughtException', error);
});

async function bootstrap(): Promise<void> {
  await commandRegistry.loadCommands();
  commandRegistry.registerHandlers();
  logger.info(`Registered ${commandRegistry.size} slash command(s) with dispatcher.`);

  try {
    await client.login(env.DISCORD_BOT_TOKEN);
    logger.info('Discord client login initiated.');
  } catch (error) {
    logger.error('Discord client login failed', error as Error);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  logger.error('Bot bootstrap failed', error as Error);
  process.exit(1);
});

import { ChatInputCommandInteraction } from 'discord.js';
import { logger } from '../logger';
import { errorReporter } from '../monitoring/errorReporter';
import { CommandContext, CommandContextBuilder, CommandContextBuilderOptions } from './context';
import { PermissionGuardOptions, PermissionGuard } from './guard';
import { CommandPermissionError, CommandValidationError } from './errors';
import { CommandRateLimiter, CommandThrottleOptions, buildThrottleKey } from './throttle';

export interface CommandHandlerContextOptions extends CommandContextBuilderOptions {}

export interface CommandHandlerDefinition {
  run: (context: CommandContext) => Promise<void>;
  guard?: PermissionGuardOptions;
  context?: CommandHandlerContextOptions;
  throttle?: CommandThrottleOptions;
}

export class CommandDispatcher {
  private handlers = new Map<string, CommandHandlerDefinition>();
  private readonly rateLimiter = new CommandRateLimiter();

  register(commandName: string, definition: CommandHandlerDefinition): void {
    this.handlers.set(commandName, definition);
  }

  async dispatch(interaction: ChatInputCommandInteraction): Promise<void> {
    const definition = this.handlers.get(interaction.commandName);

    if (!definition) {
      logger.warn(`No handler registered for /${interaction.commandName}`);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'That command is not available yet. Please try again later.',
          ephemeral: true,
        });
      }

      return;
    }

    const guard = definition.guard ? new PermissionGuard(definition.guard) : undefined;
    const contextBuilder = new CommandContextBuilder(definition.context);

    if (definition.throttle) {
      const key = buildThrottleKey(interaction, definition.throttle);
      if (key) {
        const decision = this.rateLimiter.consume(key, definition.throttle);
        if (!decision.allowed) {
          logger.warn(
            `Command ${interaction.commandName} throttled (${key}); retry after ${decision.retryAfterMs}ms.`
          );

          const waitSeconds = Math.max(Math.ceil(decision.retryAfterMs / 1000), 1);
          const message =
            definition.throttle.message ??
            `Please wait ${waitSeconds} second(s) before using /${interaction.commandName} again.`;

          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: message, ephemeral: true });
          }
          return;
        }
      }
    }

    try {
      guard?.ensure(interaction);
      const context = await contextBuilder.build(interaction);
      await definition.run(context);
    } catch (error) {
      await this.handleError(interaction, error as Error);
    }
  }

  private async handleError(interaction: ChatInputCommandInteraction, error: Error): Promise<void> {
    if (error instanceof CommandPermissionError || error instanceof CommandValidationError) {
      logger.warn(`Command ${interaction.commandName} failed: ${error.message}`);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: error.message, ephemeral: true });
      }
      return;
    }

    logger.error(`Command ${interaction.commandName} failed unexpectedly`, error);
    await errorReporter.reportCommandError(interaction, error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An unexpected error occurred while processing that command.',
        ephemeral: true,
      });
    }
  }
}

export const commandDispatcher = new CommandDispatcher();

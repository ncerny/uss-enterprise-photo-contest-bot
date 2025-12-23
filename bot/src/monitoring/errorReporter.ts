import { ChatInputCommandInteraction, Client } from 'discord.js';
import { env } from '../config/env';
import { logger } from '../logger';

class ErrorReporter {
  private client?: Client;

  setClient(client: Client): void {
    this.client = client;
  }

  async reportCommandError(interaction: ChatInputCommandInteraction, error: Error): Promise<void> {
    const userTag = interaction.user.tag;
    const baseMessage = `Command /${interaction.commandName} failed for ${userTag} (${interaction.user.id}).`;

    logger.error(baseMessage, error);
    await this.sendAlert(`${baseMessage}\n\n${this.formatError(error)}`);
  }

  async reportCritical(source: string, error: Error): Promise<void> {
    const message = `Critical error in ${source}: ${error.message}`;
    logger.error(message, error);
    await this.sendAlert(`${message}\n\n${this.formatError(error)}`);
  }

  private formatError(error: Error): string {
    const stack = error.stack ?? 'No stack trace provided.';
    const payload = `${error.message}\n${stack}`;
    return payload.length > 1800 ? `${payload.slice(0, 1800)}…` : payload;
  }

  private async sendAlert(content: string): Promise<void> {
    const channelId = env.DISCORD_ERROR_CHANNEL_ID;

    if (!channelId || !this.client) {
      return;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        logger.warn(
          `Configured error channel ${channelId} is not text-based or cannot be accessed.`
        );
        return;
      }

      if (!('send' in channel) || typeof channel.send !== 'function') {
        logger.warn(`Configured error channel ${channelId} does not support sending messages.`);
        return;
      }

      await channel.send({ content: this.enforceDiscordLimit(content) });
    } catch (err) {
      logger.error('Failed to send error alert to Discord.', err as Error);
    }
  }

  private enforceDiscordLimit(content: string): string {
    return content.length > 1950 ? `${content.slice(0, 1947)}…` : content;
  }
}

export const errorReporter = new ErrorReporter();

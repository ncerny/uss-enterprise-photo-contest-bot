import { ChatInputCommandInteraction, PermissionResolvable } from 'discord.js';
import { CommandPermissionError } from './errors';

export interface PermissionGuardOptions {
  /** Discord permission flags required to run the command */
  discordPermissions?: PermissionResolvable;
  /** Whether the command must run inside a guild */
  guildOnly?: boolean;
  /** Require the interaction user to be in a list of admin IDs */
  adminUserIds?: string[];
}

export class PermissionGuard {
  constructor(private readonly options: PermissionGuardOptions = {}) {}

  ensure(interaction: ChatInputCommandInteraction): void {
    if (this.options.guildOnly && !interaction.inGuild()) {
      throw new CommandPermissionError('This command can only be used inside a server.');
    }

    if (this.options.adminUserIds?.includes(interaction.user.id)) {
      return;
    }

    if (this.options.discordPermissions) {
      const member = interaction.member;

      if (!member || typeof member.permissions === 'string') {
        throw new CommandPermissionError('Unable to resolve your permissions for this command.');
      }

      if (!member.permissions.has(this.options.discordPermissions)) {
        throw new CommandPermissionError('You do not have the required Discord permissions.');
      }
    }
  }
}

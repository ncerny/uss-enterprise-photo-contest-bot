import { ChatInputCommandInteraction, GuildMember } from 'discord.js';

export type PermissionLevel = 'admin' | 'user';

export interface CommandContext {
  interaction: ChatInputCommandInteraction;
  member?: GuildMember | null;
  userId: string;
  guildId?: string;
  permissionLevel: PermissionLevel;
}

export interface CommandContextBuilderOptions {
  adminUserIds?: string[];
}

export class CommandContextBuilder {
  constructor(private readonly options: CommandContextBuilderOptions = {}) {}

  async build(interaction: ChatInputCommandInteraction): Promise<CommandContext> {
    let member: GuildMember | null = null;

    if (interaction.inGuild() && interaction.guild) {
      try {
        member = await interaction.guild.members.fetch(interaction.user.id);
      } catch {
        member = (interaction.member as GuildMember) ?? null;
      }
    }
    const isAdmin = this.isAdmin(interaction.user.id, member);

    return {
      interaction,
      member,
      guildId: interaction.guildId ?? undefined,
      userId: interaction.user.id,
      permissionLevel: isAdmin ? 'admin' : 'user',
    };
  }

  private isAdmin(userId: string, member?: GuildMember | null): boolean {
    if (this.options.adminUserIds?.includes(userId)) {
      return true;
    }

    if (member) {
      return member.permissions.has('Administrator');
    }

    return false;
  }
}

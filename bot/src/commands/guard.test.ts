import { ChatInputCommandInteraction, PermissionsBitField } from 'discord.js';
import { PermissionGuard } from './guard';
import { CommandPermissionError } from './errors';

// Mock Discord.js interaction
function createMockInteraction(options: {
  inGuild?: boolean;
  userId?: string;
  permissions?: bigint[];
}): ChatInputCommandInteraction {
  const { inGuild = true, userId = '123456789', permissions = [] } = options;

  return {
    inGuild: () => inGuild,
    user: { id: userId },
    member: inGuild
      ? {
          permissions: new PermissionsBitField(permissions),
        }
      : null,
  } as unknown as ChatInputCommandInteraction;
}

describe('PermissionGuard', () => {
  describe('guildOnly', () => {
    it('should throw when command used outside guild', () => {
      const guard = new PermissionGuard({ guildOnly: true });
      const interaction = createMockInteraction({ inGuild: false });

      expect(() => guard.ensure(interaction)).toThrow(CommandPermissionError);
      expect(() => guard.ensure(interaction)).toThrow(
        'This command can only be used inside a server.'
      );
    });

    it('should pass when command used inside guild', () => {
      const guard = new PermissionGuard({ guildOnly: true });
      const interaction = createMockInteraction({ inGuild: true });

      expect(() => guard.ensure(interaction)).not.toThrow();
    });

    it('should pass when guildOnly is not set', () => {
      const guard = new PermissionGuard({});
      const interaction = createMockInteraction({ inGuild: false });

      expect(() => guard.ensure(interaction)).not.toThrow();
    });
  });

  describe('adminUserIds', () => {
    it('should bypass permission check for admin users', () => {
      const guard = new PermissionGuard({
        adminUserIds: ['admin123'],
        discordPermissions: 'Administrator',
      });
      const interaction = createMockInteraction({
        userId: 'admin123',
        permissions: [], // No permissions, but admin ID
      });

      expect(() => guard.ensure(interaction)).not.toThrow();
    });

    it('should not bypass for non-admin users', () => {
      const guard = new PermissionGuard({
        adminUserIds: ['admin123'],
        discordPermissions: 'Administrator',
      });
      const interaction = createMockInteraction({
        userId: 'regular456',
        permissions: [], // No permissions
      });

      expect(() => guard.ensure(interaction)).toThrow(CommandPermissionError);
    });
  });

  describe('discordPermissions', () => {
    it('should pass when user has required permissions', () => {
      const guard = new PermissionGuard({
        discordPermissions: 'ManageChannels',
      });
      const interaction = createMockInteraction({
        permissions: [PermissionsBitField.Flags.ManageChannels],
      });

      expect(() => guard.ensure(interaction)).not.toThrow();
    });

    it('should throw when user lacks required permissions', () => {
      const guard = new PermissionGuard({
        discordPermissions: 'ManageChannels',
      });
      const interaction = createMockInteraction({
        permissions: [PermissionsBitField.Flags.SendMessages], // Wrong permission
      });

      expect(() => guard.ensure(interaction)).toThrow(CommandPermissionError);
      expect(() => guard.ensure(interaction)).toThrow(
        'You do not have the required Discord permissions.'
      );
    });

    it('should throw when member is not available', () => {
      const guard = new PermissionGuard({
        discordPermissions: 'ManageChannels',
      });
      const interaction = createMockInteraction({ inGuild: false });

      expect(() => guard.ensure(interaction)).toThrow(CommandPermissionError);
    });
  });

  describe('combined guards', () => {
    it('should check guildOnly before permissions', () => {
      const guard = new PermissionGuard({
        guildOnly: true,
        discordPermissions: 'ManageChannels',
      });
      const interaction = createMockInteraction({ inGuild: false });

      expect(() => guard.ensure(interaction)).toThrow(
        'This command can only be used inside a server.'
      );
    });

    it('should pass all checks when requirements met', () => {
      const guard = new PermissionGuard({
        guildOnly: true,
        discordPermissions: 'ManageChannels',
      });
      const interaction = createMockInteraction({
        inGuild: true,
        permissions: [PermissionsBitField.Flags.ManageChannels],
      });

      expect(() => guard.ensure(interaction)).not.toThrow();
    });
  });
});

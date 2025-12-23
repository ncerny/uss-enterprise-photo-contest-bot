import { SlashCommandBuilder } from 'discord.js';
import { CommandContext, CommandContextBuilderOptions } from './context';
import { PermissionGuardOptions } from './guard';
import { CommandThrottleOptions } from './throttle';

export interface CommandHelpMetadata {
  /** Example usage string shown in documentation */
  usage?: string;
  /** Optional list of descriptive examples */
  examples?: string[];
  /** Additional notes surfaced in generated docs */
  notes?: string;
}

export interface SlashCommandDefinition {
  /** Slash command builder exported to Discord */
  data: SlashCommandBuilder;
  /** Command execution logic */
  execute: (context: CommandContext) => Promise<void>;
  /** Optional guild-specific registration (otherwise global) */
  guildIds?: string[];
  /** Extra metadata surfaced in generated documentation */
  help?: CommandHelpMetadata;
  /** Permission guard configuration */
  guard?: PermissionGuardOptions;
  /** Context builder customization */
  context?: CommandContextBuilderOptions;
  /** Optional throttle configuration */
  throttle?: CommandThrottleOptions;
}

export type CommandModule = {
  command: SlashCommandDefinition;
};

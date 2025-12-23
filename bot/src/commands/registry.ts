import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import { commandDispatcher } from './dispatcher';
import { SlashCommandDefinition, CommandModule } from './types';
import { logger } from '../logger';

const VALID_EXTENSIONS = ['.js', '.ts'];

export interface DeploymentPlan {
  global: RESTPostAPIChatInputApplicationCommandsJSONBody[];
  guilds: Map<string, RESTPostAPIChatInputApplicationCommandsJSONBody[]>;
}

export interface CommandDocEntry {
  name: string;
  description: string;
  scope: string;
  usage: string;
  examples: string[];
  notes?: string;
}

class CommandRegistry {
  private commands = new Map<string, SlashCommandDefinition>();

  async loadCommands(): Promise<void> {
    this.commands.clear();
    const definitionsDir = path.join(__dirname, 'definitions');
    let files: string[] = [];

    try {
      files = await fs.readdir(definitionsDir);
    } catch (error) {
      logger.error(
        `Unable to read command definitions directory at ${definitionsDir}`,
        error as Error
      );
      throw error;
    }

    for (const file of files) {
      const ext = path.extname(file);
      if (!VALID_EXTENSIONS.includes(ext) || file.endsWith('.d.ts')) {
        continue;
      }

      const modulePath = path.join(definitionsDir, file);
      const command = await this.importCommandModule(modulePath);

      if (!command) {
        logger.warn(`Skipping command definition at ${modulePath}; no export named "command".`);
        continue;
      }

      this.commands.set(command.data.name, command);
    }

    logger.info(`Loaded ${this.commands.size} slash command(s).`);
  }

  registerHandlers(): void {
    for (const [name, command] of this.commands) {
      commandDispatcher.register(name, {
        run: (context) => command.execute(context),
        guard: command.guard,
        context: command.context,
        throttle: command.throttle,
      });
    }
  }

  buildDeploymentPlan(): DeploymentPlan {
    const global: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
    const guilds = new Map<string, RESTPostAPIChatInputApplicationCommandsJSONBody[]>();

    for (const command of this.commands.values()) {
      const payload = command.data.toJSON();

      if (!command.guildIds || command.guildIds.length === 0) {
        global.push(payload);
        continue;
      }

      for (const guildId of command.guildIds) {
        const guildCommands = guilds.get(guildId) ?? [];
        guildCommands.push(payload);
        guilds.set(guildId, guildCommands);
      }
    }

    return { global, guilds };
  }

  getDocumentationEntries(): CommandDocEntry[] {
    return Array.from(this.commands.values()).map((command) => {
      const description = command.data.description ?? 'No description provided';
      const usage = command.help?.usage ?? `/${command.data.name}`;
      const scope =
        command.guildIds && command.guildIds.length > 0
          ? `Guild only (${command.guildIds.join(', ')})`
          : 'Global';

      return {
        name: `/${command.data.name}`,
        description,
        scope,
        usage,
        examples: command.help?.examples ?? [],
        notes: command.help?.notes,
      };
    });
  }

  get size(): number {
    return this.commands.size;
  }

  private async importCommandModule(
    modulePath: string
  ): Promise<SlashCommandDefinition | undefined> {
    const imported = (await import(pathToFileURL(modulePath).href)) as Partial<CommandModule> & {
      default?: SlashCommandDefinition;
    };

    return imported.command ?? imported.default;
  }
}

export const commandRegistry = new CommandRegistry();

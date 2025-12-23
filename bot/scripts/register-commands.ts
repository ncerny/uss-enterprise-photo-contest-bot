#!/usr/bin/env tsx
/* eslint-disable no-console */
import path from 'node:path';
import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import { REST, Routes } from 'discord.js';
import { commandRegistry } from '../src/commands/registry';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const args = new Set(process.argv.slice(2));
const docsOnly = args.has('--docs-only');
const skipDocs = args.has('--skip-docs');

function requireEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

async function writeDocs(): Promise<void> {
  const docsPath = path.resolve(__dirname, '../../docs/commands.md');
  const entries = commandRegistry.getDocumentationEntries();
  const lines: string[] = [];

  lines.push('# Slash Command Reference');
  lines.push('');
  lines.push('| Command | Scope | Description | Usage | Examples |');
  lines.push('|---------|-------|-------------|-------|----------|');

  for (const entry of entries) {
    const examples = entry.examples.length > 0 ? entry.examples.join('<br>') : '—';
    lines.push(
      `| ${entry.name} | ${entry.scope} | ${entry.description} | ${entry.usage} | ${examples} |`
    );
  }

  await fs.mkdir(path.dirname(docsPath), { recursive: true });
  await fs.writeFile(
    docsPath,
    `${lines.join('\n')}
`
  );
  console.log(`Updated ${docsPath} with ${entries.length} command(s).`);
}

async function deployCommands(): Promise<void> {
  const clientId = requireEnv('DISCORD_CLIENT_ID');
  const token = requireEnv('DISCORD_BOT_TOKEN');
  const testGuildId = process.env.DISCORD_TEST_GUILD_ID;

  const rest = new REST({ version: '10' }).setToken(token);
  const plan = commandRegistry.buildDeploymentPlan();

  if (testGuildId) {
    const testGuildCommands = [...plan.global, ...(plan.guilds.get(testGuildId) ?? [])];

    await rest.put(Routes.applicationGuildCommands(clientId, testGuildId), {
      body: testGuildCommands,
    });
    console.log(
      `Registered ${testGuildCommands.length} command(s) for development guild ${testGuildId} (DISCORD_TEST_GUILD_ID set).`
    );
    return;
  }

  if (plan.global.length > 0) {
    await rest.put(Routes.applicationCommands(clientId), { body: plan.global });
    console.log(`Registered ${plan.global.length} global command(s).`);
  }

  for (const [guildId, commands] of plan.guilds.entries()) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`Registered ${commands.length} command(s) for guild ${guildId}.`);
  }
}

async function main(): Promise<void> {
  await commandRegistry.loadCommands();

  if (!skipDocs) {
    await writeDocs();
  }

  if (docsOnly) {
    console.log('Docs-only flag detected; skipping Discord registration.');
    return;
  }

  await deployCommands();
}

main().catch((error) => {
  console.error('Failed to register commands.', error);
  process.exit(1);
});

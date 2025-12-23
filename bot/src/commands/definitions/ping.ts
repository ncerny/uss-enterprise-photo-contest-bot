import { SlashCommandBuilder } from 'discord.js';
import { SlashCommandDefinition } from '../types';

const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check whether the bot is online and measure websocket latency.');

export const command: SlashCommandDefinition = {
  data,
  help: {
    usage: '/ping',
    examples: ['Use /ping before a contest starts to ensure the bot is ready.'],
  },
  throttle: {
    limit: 5,
    windowMs: 10_000,
    scope: 'user',
  },
  async execute({ interaction }) {
    const latency = interaction.client.ws.ping;
    await interaction.reply({
      content: `Pong! Current gateway latency: ${latency}ms`,
      ephemeral: true,
    });
  },
};

export default command;

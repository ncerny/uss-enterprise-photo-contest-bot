import { commandDispatcher } from './dispatcher';

export function registerDefaultCommands(): void {
  // Placeholder ping command to validate bot wiring before real commands are added.
  commandDispatcher.register('ping', {
    async run({ interaction }) {
      await interaction.reply({
        content: `Pong! Latency ${interaction.client.ws.ping}ms`,
        ephemeral: true,
      });
    },
  });
}

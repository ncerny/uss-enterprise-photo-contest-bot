# Epic 3 – Discord Bot Core Research

## photo-0fc.1 · Discord.js v14 Slash Command Patterns
- **Registration Strategy**: Use `@discordjs/rest` with `Routes.applicationGuildCommands` for rapid iteration (guild-scoped) during development, then promote stable commands to `Routes.applicationCommands` once validated. Implement a `CommandDeployer` utility that diffs desired vs registered commands to avoid redundant writes.
- **Module Layout**: Store commands as discrete modules exporting metadata (`data: SlashCommandBuilder`) and an `execute()` handler. Load them dynamically via `glob` on startup to enable lazy addition/removal without touching the dispatcher.
- **Execution Pipeline**: Central `interactionCreate` listener routes `ChatInputCommandInteraction` objects through middleware (auth checks, feature flags, metrics) before invoking the command handler. Use narrow TypeScript types to ensure option parsing is strongly typed.
- **Autocomplete & Subcommands**: Co-locate autocomplete resolvers with each command, registering them in the dispatcher map keyed by `commandName/subcommandName`. Prefer subcommands over separate commands for workflows (e.g., `/contest create`, `/contest open`) to keep permissions consolidated.
- **Error Isolation**: Wrap each handler in a shared `runCommand()` helper that enforces a max execution time, captures metrics, and emits standardized error payloads for logging + user feedback.

## photo-0fc.2 · Modal Forms & Validation
- **Construction**: Build modals with `ModalBuilder` + `ActionRowBuilder<TextInputBuilder>` and respond via `interaction.showModal(modal)`. Since Discord only allows showing a modal during the initial interaction, keep modal factories synchronous and deterministic.
- **Field Validation**: Enforce client-side constraints via `setMinLength`, `setMaxLength`, and `setRequired`. Follow up with server-side validation in the modal submit handler to guard against tampering.
- **State Management**: Encode lightweight context (contest ID, submission type) in the `customId` using a compact serializer (e.g., `contest:submission`). For larger payloads, persist state in Firestore keyed by user ID + nonce, and expire it via Cloud Tasks/cron cleanup.
- **Submission Handling**: Listen for `ModalSubmitInteraction` in the same dispatcher used for slash commands. Immediately defer the reply (`interaction.deferReply({ ephemeral: true })`) if processing could exceed 2 seconds.
- **UX Safeguards**: Provide inline validation errors via ephemeral follow-ups instead of throwing, and log modal schema versions to support migrations.

## photo-0fc.3 · Rate Limiting & Best Practices
- **Discord Limits**: REST requests are bucketed per-route (e.g., `/applications/:id/commands`) with shared global buckets. Use the `REST` client from `discord.js` which already handles `429` retries, but surface `RESTEvents.RateLimited` to metrics so we can detect bursts.
- **Command Throttling**: Add an application-level limiter (token bucket or sliding window) scoped to user+command to prevent spam (e.g., max 5 submissions/min). Store counters in-memory with TTL plus optional Redis/Firebase fallback if the bot runs on multiple nodes.
- **Backoff Strategy**: When a rate limit event fires, delay retries according to the `retry_after` header and jitter additional 250–500 ms to avoid thundering herds.
- **Queueing**: Wrap Firestore writes in a job queue (BullMQ or simple FIFO) when processing high-volume interactions so the bot can ack interactions (via `deferReply`) while work completes asynchronously.
- **Monitoring**: Emit structured logs when hitting >70% of the allotted REST rate limit window and wire alerts so we can adjust command batching or sharding before user impact.

## photo-0fc.9 · Command Throttling Middleware
- Implemented `CommandRateLimiter` + dispatcher integration so every handler can opt into a configurable limit/window pair.
- Default keying is per-user/per-command with optional guild/global overrides plus custom key factories for exotic cases.
- Added conservative throttle profiles to `/ping` (5/10s) and `/contest` (3/60s) to discourage accidental spam while keeping admin operations responsive.

## photo-0fc.10 · REST Rate Limit Monitoring
- Subscribed to `client.rest` `RESTEvents.RateLimited` and emit structured logs containing route, scope, retry window, and reset horizon.
- Escalate to `errorReporter` whenever we see global limits or waits >=3s so operators get alerted before failures surface to end users.

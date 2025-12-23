# photo-7ht.1 – Discord Attachment Handling Research

## Goals

- Capture how Discord delivers message attachments so the submission watcher can reliably extract user photos.
- Document payload fields, limits, and validation hooks we can rely on inside the bot.
- Outline a safe download + preprocessing flow that feeds the upload/compression tasks later in Epic 5.

## Gateway & Event Requirements

- Required intents: `GatewayIntentBits.Guilds`, `GatewayIntentBits.GuildMessages`, and `GatewayIntentBits.MessageContent`. Attachments are technically available without `MessageContent`, but Discord recommends enabling it for bots that act on user-generated media, and we already need it for content moderation messaging.
- Listen on `client.on('messageCreate', handler)` with `Partials.Message | Partials.Channel | Partials.GuildMember` enabled so deleted cache entries can be fetched on demand.
- For partial messages, call `await message.fetch()` before inspecting `message.attachments`; otherwise the collection may be empty even though the payload exists serverside.

## Attachment Payload Reference (discord.js v14)

- `message.attachments` is a `Collection<string, Attachment>`. Iterate with `for (const attachment of message.attachments.values()) { ... }`.
- Key `Attachment` fields we need:
  - `url` – CDN URL (requires HTTPS GET, no auth header) and is stable once the message is saved.
  - `proxyURL` – Discord reverse proxy URL; use when CDN blocked, but treat as fallback.
  - `contentType` – Standard MIME type (can be `null` for unknown uploads). Prefer checking `contentType?.startsWith('image/')` but fall back to sniffing the first bytes if missing.
  - `size` – File size in bytes; enforce limits before download to control Firebase Storage usage.
  - `width` / `height` – Present for images and videos. Helpful for simple heuristic validation (reject < 128px thumbnails, for example).
  - `description` / `name` – Provided filename; mark spoilers when `attachment.spoiler` is true.
  - `ephemeral` – `true` only for slash-command ephemeral responses. Contest submissions will come from regular channel messages, but we should still reject `ephemeral` attachments because they disappear within ~15 minutes and cannot be re-downloaded later.

## Discord Limits & Constraints

- Server default upload cap is 8 MiB; boosts or Nitro can push this to 100 MiB+ but we should cap far lower to stay within Firebase Storage and Cloud Functions memory limits. Recommend a hard 10 MiB limit per attachment.
- Max 10 attachments per message. We should accept the first attachment (or first valid image) and ignore the rest to keep UX simple, while responding with guidance if multiple images arrive.
- Attachments remain accessible even after the message is edited; deleting the message invalidates the CDN URL immediately, so we must download before calling `message.delete()` (Epic 5.8).
- Spoiler attachments prepend `SPOILER_` to filenames; Discord expects downstream consumers to honor that. Since we anonymize submissions, we can strip the prefix after download but should log that a spoiler flag was present.
- CDN URLs are rate-limited per IP (~50 requests/sec). Our watcher should serialize downloads or use a small concurrency pool.

## Recommended Capture Flow

1. **Filter Message Context**
   - Verify the channel is a registered contest submission channel using repository data.
   - Ignore bot authors and system webhooks.

2. **Resolve Attachments**
   - `await message.fetch()` if `message.partial`.
   - Convert `message.attachments` to an array and pick the first item that passes MIME/size validation.
   - Reject messages lacking a qualifying attachment with a short Discord reply/DM (Epic 5.9).

3. **Validate**
   - Enforce `attachment.contentType` starts with `image/` or falls within allowed extensions (`.jpg`, `.jpeg`, `.png`, `.webp`); consider HEIC once we add conversion.
   - Check `size <= 10 * 1024 * 1024` and `width >= 256 && height >= 256` when metadata is available.
   - Run a lightweight magic-byte sniff (first 512 bytes) after download to prevent spoofed MIME types.

4. **Download & Stage**
   - Use `node-fetch` or `undici` to stream the attachment into a temp file (or an in-memory buffer if < 2 MiB) for compression.
   - Include `User-Agent` header identifying the bot; Discord recommends this for CDN tracing.
   - Guard with a 15s timeout; abort and report failure if the CDN stalls.

5. **Handoff**
   - Emit an internal event (e.g., `submission:capture`) carrying the downloaded temp file path, original metadata (`size`, `contentType`, `width`, `height`, `spoiler`, `messageId`, `channelId`, `userId`), and timestamp.
   - Downstream tasks (image validation, compression, Firestore writes) consume this payload.
   - Queue deletion of the original Discord message only after submission persistence succeeds.

## Edge Cases & Testing Notes

- **Message edits**: Edits cannot add attachments; ignore edit events for now but log if the author removes text before we finish capture (should not affect attachments).
- **Sticker-only messages**: Discord treats stickers separately; ensure watcher rejects them with a friendly error.
- **Threaded submissions**: If contests ever use threads, `message.channel` may be a `ThreadChannel`; ensure repository lookup handles both.
- **Bulk deletes**: If moderators bulk-delete messages, our watcher might receive no event; we rely on `messageCreate` only, so submissions should be processed immediately to avoid losing data.
- **Permissions**: Bot needs `ViewChannel`, `ReadMessageHistory`, `ManageMessages` (for deletion later), and `AttachFiles` (to send confirmations with thumbnails if desired).
- **Load testing**: Simulate bursts (5–10 simultaneous uploads) to ensure we stay under Discord CDN rate limits and avoid temp-file leaks.

## Next Steps

- Finalize validation thresholds (dimensions, byte-size) with product requirements.
- Decide whether to keep spoiler status when re-hosting (likely no, but document rationale).
- Implement the watcher (photo-7ht.4) using the flow above and connect it to the image validation task (photo-7ht.5).

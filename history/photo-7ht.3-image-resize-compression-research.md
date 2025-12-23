# photo-7ht.3 – Image Resizing & Compression Research

## Objectives

- Define the resizing/compression pipeline for contest submissions while staying under Firebase free tier limits.
- Select tooling (Sharp vs. Squoosh CLI vs. custom) that works inside the bot runtime (Node 20.x).
- Document presets for original/archive, display, and thumbnail assets to feed storage/upload work.

## Tooling Evaluation

| Tool | Pros | Cons | Verdict |
| ---- | ---- | ---- | ------- |
| Sharp (libvips) | Fast, low memory, supports streams, mature Node bindings | Adds native dependency (already acceptable in repo), limited HEIC decoding without extra deps | ✅ Primary choice |
| Squoosh CLI | High-quality codecs (MozJPEG, WebP, AVIF), WASM-based | Slower per image, heavier install, tricky in server runtime without bundler | ❌ Skip |
| Jimp / pure JS | No native deps, easy to hack | Slow, memory-hungry for large images, limited format support | ❌ Skip |

Conclusion: use `sharp` for all resizing/compression (already used elsewhere via shared libs). Ensure build pipeline installs libvips (Node 20 Alpine packages available).

## Proposed Variants

1. **Archive (original-ish)**
   - Input: Raw attachment.
   - Action: If file <= 8 MiB and already JPEG/PNG/WEBP, keep as-is but strip EXIF + rotate to orientation=1 using `sharp().withMetadata({ orientation: 1 })`.
   - If larger, recompress JPEG at `quality=85` (or convert PNG to JPEG when transparent pixels absent) to drop below 8 MiB.
   - Output: `.jpg` or `.webp` depending on source quality (prefer JPEG for photos, WebP for PNG-like submissions).

2. **Display (gallery)**
   - Resize to max width/height 1920px (maintain aspect).
   - Convert to WebP with `quality=80`, `nearLossless=false`, `effort=4` for balance of speed and size.
   - Target size 1–1.5 MiB.

3. **Thumbnail**
   - Square crop via `resize(512, 512, { fit: 'cover', position: 'attention' })`.
   - WebP `quality=70`, `effort=3`, limit output <= 200 KiB.
   - Used in Discord DMs/admin dashboards.

## Memory & Concurrency Notes

- Sharp processes images in native code; each pipeline needs buffer + intermediate memory roughly 2–3× pixel count. Cap concurrent resizes to 2 per worker to avoid exceeding 512 MiB container limit.
- Use streaming: `sharp().rotate().resize().webp().toBuffer()` for small files; for larger ones, use temp files but still rely on streaming upload to Storage.
- Always call `sharp.cache(false)` at startup to avoid caching between submissions (keeps memory predictable).

## Quality & Validation

- Strip metadata using `.withMetadata({ exif: undefined, icc: undefined })` to avoid PII (GPS) and reduce bytes.
- Perform final format sniff: ensure resulting buffer actually matches expected MIME (Sharp guarantees this, but double-check via magic bytes before upload).
- Keep `width`/`height` metadata from Sharp output; store in Firestore submission doc for quick display (no need to refetch from Storage).

## HEIC / Live Photos

- Discord mobile clients may upload HEIC. Sharp can read HEIC when libvips compiled with libheif (default in Sharp prebuilt binaries). Plan: allow HEIC input, convert to JPEG for archive and WebP for derivatives.
- Live Photos arrive as image + video pair; watcher (photo-7ht.4) should ignore the video attachment for now.

## Error Handling

- If Sharp throws `Input buffer contains unsupported image format`, reply to user instructing them to submit JPEG/PNG/WebP.
- Watch for `Allocation failed - process out of memory`; catch and respond with friendly error, ask user to resize manually.
- Log timing metrics for each stage (download, archive encode, display encode, thumb encode) to spot regressions.

## Future Enhancements

- Consider AVIF for display variant once browser support in judging UI confirmed; would cut sizes ~30% but slower encode.
- Add background job to retroactively regenerate gallery variants if settings change.

## Next Steps

- Implement the resizing helper (e.g., `ImageProcessor.generateVariants(buffer, mime)`) returning `{ archive, display, thumb }` with metadata.
- Integrate with upload workflow defined in photo-7ht.2.
- Update docs/ENVIRONMENT_VARIABLES if Sharp requires extra build flags in deployment environment.

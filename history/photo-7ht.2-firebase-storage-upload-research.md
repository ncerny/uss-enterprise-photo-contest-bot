# photo-7ht.2 – Firebase Storage Upload Research

## Goals

- Identify a resilient upload pipeline for contest submissions that stays within Firebase free-tier bandwidth/storage limits.
- Document metadata, naming, and security patterns to keep photos organized and access-controlled.
- Recommend streaming/compression techniques compatible with Cloud Storage + Firestore transactions.

## Storage Bucket & Auth Context

- Use the project-default bucket (`<project-id>.appspot.com`) to avoid extra configuration; enable uniform bucket-level access so security is managed through Firebase Security Rules.
- Service accounts (bot backend) authenticate via the Admin SDK using the VM keyfile; uploads run server-side, so no client tokens are required.
- For web review tooling later, issue signed URLs with limited TTL (e.g., 15 minutes) rather than making objects publicly readable.

## Folder Structure & Naming

Proposed layout: `submissions/<contestId>/<submissionId>/<variant>.jpg`

- `variant` values: `original`, `compressed`, `thumb` (future use). Keep consistent so downstream consumers can guess paths without querying metadata.
- Store the canonical file extension that matches encoding (`.webp` after compression, `.jpg` otherwise). Never rely only on MIME types.
- Use Firestore `submissionId` (ULID/UUID) to avoid collisions. No user-supplied strings in paths to prevent traversal or profanity issues.

## Upload Flow (Bot Backend)

1. **Download attachment** (per photo-7ht.1) into a temporary file/buffer.
2. **Validate + normalize** image (dimensions, EXIF stripping). Produce two buffers:
   - `original`: either untouched file (if <= 5 MiB) or lightly recompressed JPEG/WEBP.
   - `display`: aggressively optimized WEBP (~1920px max width) for gallery usage.
3. **Stream upload** using `bucket.file(path).createWriteStream({ resumable: false, contentType, metadata })`.
   - Disable resumable uploads because payloads are < 10 MiB; this avoids session overhead.
   - Set `metadata.cacheControl = 'public,max-age=60,immutable'` for gallery variants; keep originals private with `'private, max-age=0, no-cache'`.
4. **Await `finish` event** before writing Firestore so we do not create dangling submission docs.
5. **Record storage info** (bucket, path, size, checksum) in the submission document.
6. **Issue signed URL** (short-lived) when DMing confirmation so the entrant can preview their upload.

## Performance & Cost Controls

- Target a post-compression size of 1–2 MiB per display asset. With 500 submissions/month, that is ~1 GB storage + ~1 GB egress when judges view them, fitting free tier.
- Enable gzip compression on HTTPS layer automatically by Firebase; no action needed, but keep file types compressible (JPEG/WEBP already compressed, so savings minimal).
- Batch deletion job: when contests close and retention expires (e.g., 90 days), delete `submissions/<contestId>/` folder with `bucket.deleteFiles({ prefix })` to reclaim quota.

## Security Rules Outline

Pseudo-rule additions to `storage.rules`:

```
match /b/{bucket}/o {
  match /submissions/{contestId}/{submissionId}/{fileName} {
    allow write: if request.auth != null && resource == null && hasContestRole(contestId, request.auth.uid);
    allow read: if hasContestStaffRole(contestId, request.auth.uid);
  }
}
```

- `hasContestRole` will be implemented via custom Firebase Auth claims or Firestore lookups proxied through Cloud Functions (since the Discord bot runs server-side, the Admin SDK bypasses rules, but future web clients need them).
- Signed URLs (Admin SDK `getSignedUrl`) bypass rules, so scope TTLs tightly and include object integrity metadata in Firestore for auditing.

## Upload Library Options

- **Admin SDK (recommended):** Ships with `@google-cloud/storage` under the hood; already available via Firebase Admin dependency. Minimal code and good retry logic.
- **gcs-resumable-upload:** Overkill for small payloads; skip unless we introduce user-facing resumable uploads in the web app.
- **Direct HTTPS (XML API):** Not necessary; Admin SDK abstracts auth and errors better.

## Error Handling & Retries

- Wrap uploads in a retry helper with exponential backoff (e.g., 3 attempts, starting at 500ms). Most failures are transient networking hiccups.
- If upload ultimately fails, delete any partially created objects via `file.delete()` to avoid ghost files.
- Record failure metrics (contestId, userId, error code) so we can alert operators.

## Monitoring & Logging

- Log structured entries: `contestId`, `submissionId`, `variant`, `sizeBytes`, `contentType`, `durationMs`, `retryCount`.
- Consider enabling Object Change Notifications (Pub/Sub) later to detect manual deletions, though not required initially.

## Next Steps

- Align compression targets with research from photo-7ht.3 (image resizing).
- Prototype the upload helper in `ContestSubmissionService` once watcher + validation land.
- Update Firestore schema docs to include storage metadata fields (paths, checksums, formats).

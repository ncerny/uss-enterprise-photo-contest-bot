# Firestore Migration & Seeding Utilities

These scripts live under `bot/scripts/` so they can reuse the bot workspace dependencies (`firebase-admin`, `dotenv`, `tsx` for local dev). They operate against the configured Firebase project and store migration state in the `__migrations` collection.

> ⚠️ **Never run these scripts without valid service-account credentials.**
> The easiest approach is to place the same admin creds used by the bot in `bot/.env` or export `GOOGLE_APPLICATION_CREDENTIALS` before executing the commands below.

## 1. Commands

| Command                  | Description                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `npm run migrate:status` | Lists applied vs pending migrations based on the `__migrations` collection.                                        |
| `npm run migrate:up`     | Applies every pending migration in order (or pass an ID: `npm run migrate:up -- 0001_backfill_submission_counts`). |
| `npm run migrate:down`   | Rolls back the latest applied migration (or a specific ID with `-- <id>`).                                         |
| `npm run seed:dev`       | Inserts a self-contained dev contest with sample submissions/votes for emulator or staging testing.                |

All scripts share the same bootstrap logic (`bot/scripts/migrations/run.js` and `bot/scripts/seeds/dev-seed.js`) which read the following environment variables:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

If `GOOGLE_APPLICATION_CREDENTIALS` is set, the scripts will default to Application Default Credentials instead.

## 2. Migration Layout

```
bot/scripts/migrations/
├── migration-list.js          # exports the ordered migration array
├── migrations/
│   └── 0001-backfill-submission-counts.js
└── run.js                     # CLI runner (up/down/status)
```

Each migration exports `{ id, name, up, down }`. The runner injects a context object containing:

- `firestore`: admin SDK instance
- `admin`: initialized Firebase admin namespace
- `FieldValue`: shorthand for `admin.firestore.FieldValue`
- `logger`: currently `console`

### Migration 0001

Backfills the `submissionCount` field for every contest by counting associated submissions. The `down` action removes the field (helpful if schema changes again).

## 3. Seed Script

`bot/scripts/seeds/dev-seed.js` drops a "Holodeck Photography Jam" contest with three placeholder submissions and a vote for each. Use it regularly when developing against the Firebase emulator:

```bash
firebase emulators:start &
export FIREBASE_EMULATOR_HOST=localhost:8080
npm run seed:dev
```

The script logs the generated contest ID so you can open it via the web app or Firestore console.

## 4. Rollback Workflow

1. Run `npm run migrate:status` to confirm the migration order.
2. Execute `npm run migrate:down` to undo the latest change or specify an ID to roll back a particular migration.
3. Re-run `npm run migrate:up` after updating the migration file or adding a new one.

Because the runner records state in Firestore, all environments (local emulator, staging, prod) keep independent migration histories. Remember to include new migration files and updates to `migration-list.js` in every PR so other contributors can apply them seamlessly.

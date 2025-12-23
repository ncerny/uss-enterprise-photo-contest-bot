# Firestore Security Rules Best Practices

This note captures the guardrails we need before implementing the production ruleset for the USS Enterprise Photo Contest Bot. It focuses on translating Discord identities to Firebase Authentication, defining collection-level permissions, validating the data model, and testing strategies.

## 1. Authentication Model

- **Discord user IDs become `request.auth.uid`**: the bot and web app should mint custom Firebase Auth tokens whose `uid` is the Discord snowflake so security rules can reference the same identifier stored in documents.
- **Admin attribution**: maintain either
  - a per-contest `contestAdmins` array (creator + delegated moderators), or
  - a top-level `admins/{discordUserId}` document.
    Rules can then gate admin actions by checking membership in the appropriate list.
- **Service accounts**: backend maintenance scripts should use a dedicated service account that bypasses end-user restrictions by authenticating with `request.auth.token.admin == true`.

## 2. Collection Access Patterns

| Collection         | Allowed Reads                                                   | Allowed Writes                                  | Notes                                                                 |
| ------------------ | --------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| `contests`         | Public (needed for landing/voting)                              | Admins only                                     | Gate create/update/delete on `contestAdmins` plus status transitions. |
| `submissions`      | Public read during voting, restricted in other states if needed | Owners create/update/delete until contest locks | Enforce submission window and per-user limits.                        |
| `votes`            | Hidden during voting (optional) or readable by admins only      | Voter can create/delete their own votes         | Prevent duplicate votes with composite keys and validation.           |
| `results` (future) | Public read                                                     | Admin write after tally                         | Stores final stats and winner list.                                   |

## 3. Validation Rules

### Contest Documents

- `title`, `description`: non-empty strings within max length.
- `submissionDeadline < votingDeadline` and both greater than `request.time` on create.
- `maxSubmissionsPerUser`, `maxVotesPerUser`, `numberOfWinners`: integers within configured ranges (e.g., 1–10).
- `status` must be one of the enumerated lifecycle values (`created`, `submission`, `voting`, `results`, `cancelled`).
- Only allow transitions that follow the state machine (e.g., `submission -> voting`).

### Submission Documents

- `contestId` must point to an existing contest (`exists(/databases/$(database)/documents/contests/$(contestId))`).
- `userId` must equal `request.auth.uid`.
- Reject writes when contest is not in `submission` state or when `request.auth.uid` already has `maxSubmissionsPerUser` entries (use counted aggregate or transaction).
- Image metadata fields (`imageUrls`, `caption`) must match validation rules (non-empty array, HTTPS URLs, caption length).

### Vote Documents

- `voterId == request.auth.uid`.
- Contest must be in `voting` state and still before `contest.votingDeadline`.
- Enforce per-user vote cap by counting votes for the same contest before allowing `create`.
- Use a deterministic document ID such as `${contestId}_${submissionId}_${voterId}` so duplicate writes automatically override and rules can simply check ownership.

## 4. Helper Functions to Reuse in Rules

- `isAdmin(contestId)`: checks whether `request.auth.uid` is listed in the contest’s admin array.
- `contestIsWritable(contestId)`: true when contest exists and state allows the attempted operation.
- `documentBelongsToUser(field)` to DRY up ownership enforcement.
- `isBeforeDeadline(deadlineField)` to guard submissions and votes.

## 5. Testing Strategy

- **Emulator-first**: run `firebase emulators:exec --project enterprise-photo-contest-bot "npm run test:rules"` so no reads/writes hit production.
- **Rule unit tests**: use the Firebase Emulator Suite testing SDK (Node.js) to script positive/negative cases per collection.
- **Regression harness**: whenever schemas change, update the test fixtures (sample contests, submissions, votes) to ensure rules evolve with the data model.
- **Load representative auth contexts**: tests should cover regular users, admins, unauthenticated users, and the service account role.
- **CI gating**: wire the tests into GitHub Actions so PRs touching `firestore.rules` or schema files must pass the rules suite before merging.

## 6. Next Steps

1. Incorporate the helper functions and validation checks into `firestore.rules`.
2. Update repository tests to include Firebase rule coverage.
3. Document the admin-identification approach (array vs. collection) in the data model so both bot and web app write consistent structures.

These guidelines satisfy `photo-ovf.1` by outlining the authentication, authorization, validation, and testing practices we need before hardening the Firestore ruleset.

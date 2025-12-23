# Firestore Indexing Plan

This note catalogs every compound Firestore query we run (or have on the roadmap) and ties each one to the composite index declared in `firestore.indexes.json`. Use it as the source of truth for `photo-ovf.2` and whenever new queries show up in PRs.

## 1. Query Inventory (Bot + Web)

| #   | Location                                                         | Query Pattern                                                                                | Purpose                                            | Index Needed                                                                              |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | `ContestRepository#getByGuildId`                                 | `where('guildId' == guildId).orderBy('createdAt','desc')`                                    | List contests per guild newest first               | `contests guildId asc + createdAt desc`                                                   |
| 2   | `ContestRepository#getActive` (guild scoped)                     | `where('status','in',[...]).where('guildId','==', guildId)`                                  | show active contests for a guild                   | `contests status asc + guildId asc`                                                       |
| 3   | `SubmissionRepository#getByContestId`                            | `where('contestId','==', contestId).orderBy('createdAt','asc')`                              | display submissions chronologically                | `submissions contestId asc + createdAt asc`                                               |
| 4   | `SubmissionRepository#getByUserAndContest`                       | `where('contestId','==', contestId).where('userId','==', userId).orderBy('createdAt','asc')` | enforce per-user submission limits & management UI | `submissions contestId asc + userId asc + createdAt asc`                                  |
| 5   | `SubmissionRepository#getByContestIdOrderedByVotes`              | `where('contestId','==', contestId).orderBy('voteCount','desc').orderBy('createdAt','asc')`  | results page/winner tally                          | `submissions contestId asc + voteCount desc + createdAt asc`                              |
| 6   | `VoteRepository#getByVoterAndContest` & `countByVoterAndContest` | `where('contestId','==', contestId).where('voterId','==', voterId)`                          | enforce vote limits, show user votes               | `votes contestId asc + voterId asc`                                                       |
| 7   | `VoteRepository#hasVoted` & `deleteByVoterAndSubmission`         | `where('voterId','==', voterId).where('submissionId','==', submissionId)`                    | prevent duplicate votes, allow unvote              | `votes voterId asc + submissionId asc`                                                    |
| 8   | Web app (planned) – results/history page                         | `where('status','==','results').orderBy('votingDeadline','desc')`                            | show past contests                                 | Covered by automatic single-field indexes (no composite).                                 |
| 9   | Scheduler (planned) – upcoming deadlines                         | `where('status','==','submission').orderBy('submissionDeadline','asc').limit(n)`             | find contests needing transitions                  | New index TBD once scheduler implementation lands (likely `status + submissionDeadline`). |

## 2. Current Composite Index Set

`firestore.indexes.json` already contains entries #1–7 above. Confirm via:

```bash
firebase firestore:indexes --project enterprise-photo-contest-bot
```

If you add a new query, update the JSON file first, then run `firebase deploy --only firestore:indexes` (or include indexes in your regular deploy).

## 3. Adding Future Indexes

1. **Document the query** in this file (new row under inventory).
2. **Update** `firestore.indexes.json` with the composite fields (order matters: equality filters first, then order-by).
3. **Deploy**: `firebase deploy --only firestore:indexes`.
4. **Verify** locally using the Firestore emulator so development does not depend on production index state.

## 4. Maintenance Tips

- Delete unused indexes to avoid accidental billing; Firestore charges only for storage but fewer indexes mean faster deploys.
- For `in` or `array-contains-any` filters plus equality filters, Firestore requires explicit composite indexes even without an explicit `orderBy`. Keep those combinations documented (e.g., `status IN` + `guildId ==`).
- If Firestore throws `FAILED_PRECONDITION: The query requires an index`, copy the suggested JSON snippet, paste it into `firestore.indexes.json`, then append a note in §1 describing the query so future contributors understand the rationale.

With this plan recorded, `photo-ovf.2` is complete.

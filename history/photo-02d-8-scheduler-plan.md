# photo-02d.8 – Contest Scheduler Plan

## Goals

- Poll Firestore every minute to find contests whose submission or voting deadlines have passed.
- Automatically transition contests from Submission → Voting and Voting → Results using the existing `transitionContest` helper.
- Announce transitions inside the contest channel and refresh the pinned welcome message.
- Handle bot restarts gracefully (catch up on overdue transitions) and avoid hammering Firestore.

## Proposed Design

1. **Scheduler Service**
   - New module `bot/src/features/contestCreation/scheduler.ts` exporting a `ContestScheduler` class.
   - Constructor takes the Discord `Client`, `ContestRepository`, and poll interval (default 60s).
   - `start()` kicks off an immediate scan plus a `setInterval` loop; `stop()` clears the timer.

2. **Polling Flow**
   - On each tick, capture `now = new Date()` and run two repository queries:
     1. Contests with `status == submission` and `submissionDeadline <= now`.
     2. Contests with `status == voting` and `votingDeadline <= now`.
   - A helper `findDueContests(status)` will live on the scheduler (using collection queries) to avoid changing other call sites. Each query runs sequentially to keep Firestore index requirements simple.
   - Deduplicate contests by ID in case of overlapping queries (defensive, though statuses are mutually exclusive).

3. **Transition Execution**
   - For each due contest, fetch its Discord text channel via `client.channels.fetch(contest.channelId)`.
   - Skip contests whose channels no longer exist (log a warning).
   - Call `transitionContest` with:
     - `targetStatus = ContestStatus.VOTING` (for submission) or `ContestStatus.RESULTS` (for voting).
     - `actorId = 'scheduler'` or `undefined` but include `reason` like `Auto transition via scheduler`.
     - `channel` to refresh welcome message and `announcement` summarizing the automatic change.
   - Catch/ log errors per contest to avoid failing the whole tick.

4. **Bootstrap Integration**
   - Instantiate the scheduler in `src/index.ts` after the Discord client logs in (or once commands load) so the client object is ready.
   - Gracefully stop the scheduler inside the shutdown signal handler before destroying the client.

5. **Resilience Considerations**
   - Because every tick queries for `deadline <= now`, any missed transitions while the bot was offline will fire immediately when it restarts.
   - Use `Promise.allSettled` or sequential awaits to limit concurrent Firestore writes and Discord calls (start simple with sequential loops; deadlines are infrequent).
   - Log metrics (count of contests transitioned) using the existing `logger` so operators can trace automation.

## Implementation Checklist

- [ ] Add scheduler module with `ContestScheduler` class and polling logic.
- [ ] Extend `ContestRepository` with helper methods (if needed) for due contests, or run Firestore queries within the scheduler using the existing collection reference.
- [ ] Wire scheduler into `src/index.ts` (start/stop lifecycle).
- [ ] Ensure announcements/messages reuse existing formatting helpers (`phaseFollowUp` etc.) or create scheduler-specific copies.
- [ ] Update docs/PRD if necessary to mention automated transitions.

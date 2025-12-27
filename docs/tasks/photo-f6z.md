# Epic 7: Results & Winner Announcement

## Overview

Implement vote tallying, winner ranking with tie handling, and results announcement when voting ends.

## Existing Infrastructure

- `VoteRepository.getVoteCountsByContest()` - returns `Map<submissionId, count>`
- `SubmissionRepository.updateVoteCount()` - stores final vote count
- `SubmissionRepository.getByContestIdOrderedByVotes()` - gets ranked submissions
- `Submission.voteCount` field already exists
- `Contest.numberOfWinners` defines how many winners to announce

## Implementation Plan

### Task 1: ResultsService Core (photo-f6z.1, f6z.2)

Create `bot/src/features/results/resultsService.ts`:

1. **tallyVotes(contestId)**:
   - Get all votes via `VoteRepository.getVoteCountsByContest()`
   - Update each submission's `voteCount` field
   - Return vote counts map

2. **rankWinners(contestId, numberOfWinners)**:
   - Get submissions ordered by votes
   - Handle ties: if positions 2-3 tie, both get 2nd place, next gets 4th
   - Return ranked array with placement info

### Task 2: Announcement Formatting (photo-f6z.3)

Create winner card embeds:
- Position emoji (gold/silver/bronze or numbers)
- User mention (reveal identity)
- Photo embed with signed URL
- Vote count display

### Task 3: Results Posting (photo-f6z.4)

Integrate with scheduler:
- When transitioning VOTING -> RESULTS, call ResultsService
- Post winner cards to channel
- Handle no-votes case (no winners)

### Task 4: Statistics (photo-f6z.5)

Generate and post summary embed:
- Total submissions
- Total votes cast
- Unique voters
- Contest duration

### Task 5: Store Results (photo-f6z.6)

Already handled by updating `submission.voteCount` during tallying.

## Data Types

```typescript
interface RankedSubmission {
  submission: Submission;
  voteCount: number;
  placement: number;      // 1, 2, 3, etc (ties share same number)
  isTied: boolean;        // true if tied with another
}

interface ContestResults {
  contest: Contest;
  rankings: RankedSubmission[];
  statistics: {
    totalSubmissions: number;
    totalVotes: number;
    uniqueVoters: number;
    duration: { days: number; hours: number };
  };
}
```

## Integration Point

In `scheduler.ts`, when `handleTransition()` transitions to RESULTS:
```typescript
if (targetStatus === ContestStatus.RESULTS) {
  await this.resultsService.announceResults(contest, channel);
}
```

---

## Implementation Log

### Session 1 (2025-12-27)
- Created plan document
- Starting implementation...

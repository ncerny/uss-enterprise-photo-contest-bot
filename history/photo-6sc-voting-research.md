# Voting System Research (photo-6sc.1 & photo-6sc.2)

## Discord Reaction-Based Voting Patterns

### Event Types
- `messageReactionAdd` - Fired when a reaction is added
- `messageReactionRemove` - Fired when a reaction is removed
- Both events provide `MessageReaction` and `User` objects

### Required Intents & Partials
```typescript
GatewayIntentBits.GuildMessageReactions  // Required for reaction events
Partials.Reaction                         // For uncached message reactions
Partials.Message                          // Already enabled
Partials.User                             // For uncached users
```

### Reaction Tracking Strategy
1. **Bot adds initial reaction** - Thumbs-up (👍) to each submission photo
2. **User reactions captured** - `messageReactionAdd` event fires
3. **Vote recorded** - Only 👍 emoji counts; others ignored
4. **Removal tracked** - `messageReactionRemove` deletes vote record

### Rate Limits
- Reactions: 1 per 250ms per channel (bot)
- Reaction add/remove events: Discord handles batching
- For large galleries: use delay between posting submissions

## Vote Tracking & Deduplication (VoteRepository exists)

### Composite Key Pattern
Votes are uniquely identified by: `(contestId, submissionId, voterId)`

### Existing VoteRepository Methods
- `create(data)` - Creates vote document
- `hasVoted(voterId, submissionId)` - Prevents duplicates
- `deleteByVoterAndSubmission()` - Handles unvoting
- `countByVoterAndContest()` - For limit enforcement
- `getVoteCountsByContest()` - For results tallying

### Firestore Indexes Required
```
votes: contestId ASC, voterId ASC
votes: submissionId ASC
votes: voterId ASC, submissionId ASC
```

## Implementation Approach

1. **Voting Transition** (photo-6sc.3)
   - ContestScheduler already triggers SUBMISSION → VOTING
   - Add hook to post anonymous submissions gallery

2. **Anonymous Gallery** (photo-6sc.4)
   - Fetch all submissions for contest
   - Shuffle with seeded random (contest ID as seed)
   - Post each as embed without username
   - Store displayOrder and messageId on submission

3. **Reaction Handler** (photo-6sc.5-6)
   - Listen for `messageReactionAdd/Remove` events
   - Validate: is voting message? is 👍? is voting period active?
   - Check vote limits before recording
   - Create/delete vote in Firestore

4. **Limit Enforcement** (photo-6sc.7-8)
   - Before recording: count user's votes for contest
   - If at limit: remove reaction, send DM
   - DM includes vote management web link

5. **Visibility Controls** (photo-6sc.9)
   - Vote counts hidden in Discord (no way to see reaction counts on messages)
   - Web app checks contest status before showing counts

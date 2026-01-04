# Submission Management Design

**Date:** 2025-01-04
**Beads Task:** photo-7kn

## Overview

Users can manage their contest submissions via a DM-based slash command. Admins can remove inappropriate submissions with a required reason. All actions are only available during the submission phase.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| When can users edit/withdraw? | Submission phase only | Keeps voting fair; votes tied to specific submissions |
| User interaction method | DM slash command (`/submissions`) | Discord-native, discoverable, keeps users on platform |
| Available actions | Withdraw + Edit caption | Withdraw frees slots, caption editing common need; image replacement via resubmit |
| Storage cleanup | Immediate deletion | No recovery needed; reduces costs |
| Notifications | External changes only via DM | Self-actions get inline confirmation; admin actions notify user |
| Admin moderation | Remove with required reason | Essential for UGC; reason provides accountability |

## User Flow: `/submissions` Command

### Command Definition

```typescript
new SlashCommandBuilder()
  .setName('submissions')
  .setDescription('Manage your contest submissions')
  .setDMPermission(true)
```

### Flow

1. User types `/submissions` in DM with bot
2. Bot queries Firestore for submissions in active contests (status = SUBMISSION)
3. If none found: "You don't have any submissions in active contests."
4. If found: Display embed per submission with:
   - Thumbnail image
   - Contest name
   - Caption (or "No caption")
   - Submitted timestamp
   - Buttons: **Edit Caption** | **Withdraw**

### Edit Caption Flow

1. User clicks "Edit Caption"
2. Bot shows modal with text input (pre-filled with current caption)
3. User submits
4. Caption updated in Firestore
5. Ephemeral confirmation: "Caption updated!"

### Withdraw Flow

1. User clicks "Withdraw"
2. Confirmation prompt: "Are you sure? This cannot be undone." with **Confirm** | **Cancel**
3. User confirms
4. Delete from Firestore
5. Delete all 3 image variants from Storage
6. Delete original Discord message (if exists)
7. Ephemeral confirmation: "Submission withdrawn. You can submit again in #{channel}."

## Admin Flow: `/submission remove`

### Command Definition

```typescript
new SlashCommandBuilder()
  .setName('submission')
  .setDescription('Submission management')
  .addSubcommand(sub => sub
    .setName('remove')
    .setDescription('Remove a submission (admin)')
    .addStringOption(opt => opt
      .setName('submission_id')
      .setDescription('Submission ID to remove')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('reason')
      .setDescription('Reason for removal (sent to user)')
      .setRequired(true))
  )
  .setDMPermission(false)
```

### Flow

1. Verify caller has admin permissions (ManageChannels or ManageGuild)
2. Look up submission, verify contest is in SUBMISSION phase
3. Delete from Firestore
4. Delete images from Storage
5. Delete original Discord message (if exists)
6. DM the submitter:
   > "Your submission to **{contest title}** was removed by a moderator.
   > **Reason:** {reason}
   > You may submit a new entry if the submission period is still open."
7. Ephemeral confirmation to admin: "Submission removed. User has been notified."

### Error Cases

- User has DMs disabled: Log warning, continue with removal
- Contest not in SUBMISSION phase: "Submissions can only be removed during the submission phase."
- Submission not found: "Submission not found."

## Technical Implementation

### Repository Additions

Add to `SubmissionRepository.ts`:

```typescript
async delete(id: string): Promise<void>
async updateCaption(id: string, caption: string): Promise<void>
async getActiveSubmissionsByUser(userId: string): Promise<Submission[]>
```

### New Service: SubmissionDeletionService

File: `bot/src/features/submissions/submissionDeletionService.ts`

```typescript
class SubmissionDeletionService {
  async deleteSubmission(submission: Submission, options?: {
    reason?: string;
    deletedBy?: string;
  }): Promise<void>

  private async deleteStorageAssets(assets: SubmissionAssetSet): Promise<void>

  private async deleteDiscordMessage(
    guildId: string,
    channelId: string,
    messageId: string
  ): Promise<void>
}
```

### Storage Deletion

```typescript
const bucket = getStorageBucket();
await Promise.all([
  bucket.file(assets.archive.path).delete(),
  bucket.file(assets.display.path).delete(),
  bucket.file(assets.thumbnail.path).delete(),
]);
```

### Data Requirements

Ensure `Submission` type includes:
- `guildId` - For message deletion lookup
- `channelId` - Submission channel ID
- `sourceMessageId` - Already exists

### Button Custom IDs

Pattern: `submission:{action}:{submissionId}`

- `submission:edit:{submissionId}`
- `submission:withdraw:{submissionId}`
- `submission:confirm-withdraw:{submissionId}`
- `submission:cancel-withdraw:{submissionId}`

### New Handler

`bot/src/features/submissions/submissionManagementHandler.ts`

Handles:
- Button interactions for edit/withdraw/confirm/cancel
- Modal submission for caption editing

### Interaction Handler Updates

Extend `bot/src/index.ts` to route:
- `ButtonInteraction` with `submission:*` prefix
- `ModalSubmitInteraction` for caption edit modal

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User clicks action but contest moved to VOTING | Error: "This contest is now in voting phase. Submissions are locked." |
| Button clicked after submission already withdrawn | Error: "This submission no longer exists." |
| Admin tries to remove during VOTING | Reject: "Submissions can only be removed during the submission phase." |
| Original Discord message already deleted | Log and continue, not a failure |
| Bot lacks delete permission for message | Log warning and continue |

## Concurrency

- Use Firestore transactions for delete operations
- Check contest status inside transaction before deleting

## Logging

All modifications logged with:
- `submissionId`, `userId`, `contestId`
- Action type: `withdraw`, `caption_edit`, `admin_remove`
- For admin actions: `adminId`, `reason`

## Files to Create/Modify

### New Files
- `bot/src/features/submissions/submissionDeletionService.ts`
- `bot/src/features/submissions/submissionManagementHandler.ts`
- `bot/src/commands/definitions/submissions.ts`
- `bot/src/commands/definitions/submission.ts`

### Modified Files
- `bot/src/repositories/SubmissionRepository.ts` - Add delete, updateCaption, getActiveByUser
- `bot/src/index.ts` - Add button/modal interaction routing
- `shared/src/types.ts` - Ensure guildId, channelId on Submission type
- `bot/src/features/submissions/submissionPersistenceService.ts` - Store guildId, channelId

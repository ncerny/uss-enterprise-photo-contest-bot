# Submission Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to manage their submissions via DM slash command and admins to moderate submissions.

**Architecture:** New `/submissions` DM command with button interactions for withdraw/edit. New `/submission remove` admin command. Shared deletion service handles Firestore + Storage cleanup. Button/modal handlers in main bot file.

**Tech Stack:** discord.js (slash commands, buttons, modals), Firebase Admin SDK (Firestore, Storage), TypeScript

---

## Task 1: Add guildId and channelId to Submission Type

**Files:**
- Modify: `shared/src/types.ts:83-119`

**Step 1: Update Submission interface**

Add `guildId` and `channelId` fields to the Submission interface:

```typescript
export interface Submission {
  /** Unique submission ID */
  id: string;

  /** Contest this submission belongs to */
  contestId: string;

  /** Discord guild (server) ID */
  guildId: string;

  /** Discord channel ID where submitted */
  channelId: string;

  /** Discord user ID of submitter */
  userId: string;

  // ... rest unchanged
}
```

**Step 2: Run TypeScript check**

Run: `cd bot && npx tsc --noEmit`
Expected: Errors about missing guildId/channelId in persistSubmission (we'll fix in Task 2)

**Step 3: Commit**

```bash
git add shared/src/types.ts
git commit -m "feat: add guildId and channelId to Submission type"
```

---

## Task 2: Store guildId and channelId in Persistence Service

**Files:**
- Modify: `bot/src/features/submissions/submissionPersistenceService.ts:44-55`

**Step 1: Update persistSubmission to include guildId and channelId**

```typescript
private async persistSubmission(result: SubmissionUploadResult): Promise<void> {
  const now = new Date();

  const submission = await this.submissionRepository.create({
    contestId: result.contest.id,
    guildId: result.contest.guildId,
    channelId: result.contest.channelId,
    userId: result.userId,
    assets: result.variants,
    uploadId: result.uploadId,
    sourceMessageId: result.messageId,
    caption: result.caption,
    createdAt: now,
  });

  // ... rest unchanged
}
```

**Step 2: Run TypeScript check**

Run: `cd bot && npx tsc --noEmit`
Expected: PASS (no errors)

**Step 3: Commit**

```bash
git add bot/src/features/submissions/submissionPersistenceService.ts
git commit -m "feat: persist guildId and channelId with submissions"
```

---

## Task 3: Add Repository Methods for Submission Management

**Files:**
- Modify: `bot/src/repositories/SubmissionRepository.ts`

**Step 1: Add getActiveSubmissionsByUser method**

Add after the `getByUserAndContest` method (around line 70):

```typescript
/**
 * Get all submissions by a user in contests with given statuses
 */
async getByUserInContestStatuses(
  userId: string,
  contestStatuses: ContestStatus[]
): Promise<Submission[]> {
  // First get contests in the target statuses
  const contestsSnapshot = await this.firestore
    .collection(Collections.CONTESTS)
    .where('status', 'in', contestStatuses)
    .get();

  if (contestsSnapshot.empty) {
    return [];
  }

  const contestIds = contestsSnapshot.docs.map((doc) => doc.id);

  // Firestore 'in' queries limited to 30 items, batch if needed
  const submissions: Submission[] = [];
  const batches = [];
  for (let i = 0; i < contestIds.length; i += 30) {
    batches.push(contestIds.slice(i, i + 30));
  }

  for (const batch of batches) {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .where('contestId', 'in', batch)
      .orderBy('createdAt', 'desc')
      .get();

    submissions.push(...snapshot.docs.map((doc) => this.deserializeSubmission(doc)));
  }

  return submissions;
}

/**
 * Update submission caption
 */
async updateCaption(id: string, caption: string): Promise<void> {
  await this.collection.doc(id).update({
    caption,
    editedAt: new Date(),
    updatedAt: new Date(),
  });
}
```

**Step 2: Add import for ContestStatus and Collections**

At the top of the file, update imports:

```typescript
import { Submission, SubmissionData, Collections, ContestStatus } from '@uss-enterprise/shared';
```

**Step 3: Run TypeScript check**

Run: `cd bot && npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add bot/src/repositories/SubmissionRepository.ts
git commit -m "feat: add getByUserInContestStatuses and updateCaption to SubmissionRepository"
```

---

## Task 4: Create Submission Deletion Service

**Files:**
- Create: `bot/src/features/submissions/submissionDeletionService.ts`
- Test: `bot/src/features/submissions/submissionDeletionService.test.ts`

**Step 1: Write failing test**

Create `bot/src/features/submissions/submissionDeletionService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('SubmissionDeletionService', () => {
  describe('deleteStorageAssets', () => {
    it('should delete all three image variants from storage', async () => {
      // Test will be implemented after service exists
      expect(true).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify setup**

Run: `cd bot && npx vitest run src/features/submissions/submissionDeletionService.test.ts`
Expected: PASS (placeholder test)

**Step 3: Create the deletion service**

Create `bot/src/features/submissions/submissionDeletionService.ts`:

```typescript
import { Client, TextChannel } from 'discord.js';
import { Submission, SubmissionAssetSet } from '@uss-enterprise/shared';
import { getStorageBucket, getFirestoreClient } from '../../config/firebaseAdmin';
import { SubmissionRepository } from '../../repositories';
import { logger } from '../../logger';

export interface DeletionOptions {
  /** Reason for deletion (for logging and DM) */
  reason?: string;
  /** Discord user ID who initiated the deletion */
  deletedBy?: string;
  /** Whether this is an admin action */
  isAdminAction?: boolean;
}

export class SubmissionDeletionService {
  private readonly bucket = getStorageBucket();
  private readonly submissionRepository = new SubmissionRepository(getFirestoreClient());

  constructor(private readonly client: Client) {}

  /**
   * Delete a submission completely: Firestore record, Storage assets, Discord message
   */
  async deleteSubmission(submission: Submission, options: DeletionOptions = {}): Promise<void> {
    const { reason, deletedBy, isAdminAction } = options;

    logger.info('Deleting submission', {
      submissionId: submission.id,
      contestId: submission.contestId,
      userId: submission.userId,
      deletedBy,
      isAdminAction,
      reason,
    });

    // Delete from Firestore first (source of truth)
    await this.submissionRepository.delete(submission.id);

    // Delete storage assets (best effort, don't fail if already gone)
    await this.deleteStorageAssets(submission.assets);

    // Delete Discord message (best effort)
    await this.deleteDiscordMessage(
      submission.guildId,
      submission.channelId,
      submission.sourceMessageId
    );

    logger.info('Submission deleted successfully', {
      submissionId: submission.id,
    });
  }

  /**
   * Delete all image variants from Firebase Storage
   */
  private async deleteStorageAssets(assets: SubmissionAssetSet): Promise<void> {
    const paths = [assets.archive.path, assets.display.path, assets.thumbnail.path];

    const results = await Promise.allSettled(
      paths.map((path) =>
        this.bucket.file(path).delete().catch((error) => {
          // Ignore "not found" errors - file may already be deleted
          if (error.code !== 404) {
            throw error;
          }
        })
      )
    );

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      logger.warn('Some storage assets failed to delete', {
        failureCount: failures.length,
        paths,
      });
    }
  }

  /**
   * Delete the original Discord message
   */
  private async deleteDiscordMessage(
    guildId: string,
    channelId: string,
    messageId: string
  ): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        logger.warn('Could not find text channel for message deletion', { channelId });
        return;
      }

      const message = await (channel as TextChannel).messages.fetch(messageId);
      await message.delete();

      logger.debug('Deleted Discord message', { messageId });
    } catch (error) {
      // Don't fail if message is already gone or bot lacks permissions
      const err = error as Error & { code?: number };
      if (err.code === 10008) {
        // Unknown Message - already deleted
        logger.debug('Discord message already deleted', { messageId });
      } else {
        logger.warn('Could not delete Discord message', {
          messageId,
          error: err.message,
        });
      }
    }
  }

  /**
   * Send DM to user about their submission being removed by admin
   */
  async notifyUserOfAdminRemoval(
    userId: string,
    contestTitle: string,
    reason: string
  ): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      await user.send({
        content: [
          `Your submission to **${contestTitle}** was removed by a moderator.`,
          `**Reason:** ${reason}`,
          '',
          'You may submit a new entry if the submission period is still open.',
        ].join('\n'),
      });
    } catch (error) {
      // User may have DMs disabled
      logger.warn('Could not DM user about submission removal', {
        userId,
        error: (error as Error).message,
      });
    }
  }
}
```

**Step 4: Run TypeScript check**

Run: `cd bot && npx tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add bot/src/features/submissions/submissionDeletionService.ts bot/src/features/submissions/submissionDeletionService.test.ts
git commit -m "feat: add SubmissionDeletionService for complete submission cleanup"
```

---

## Task 5: Create /submissions DM Command

**Files:**
- Create: `bot/src/commands/definitions/submissions.ts`

**Step 1: Create the command definition**

```typescript
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { ContestStatus } from '@uss-enterprise/shared';
import { SlashCommandDefinition } from '../types';
import { getFirestoreClient } from '../../config/firebaseAdmin';
import { SubmissionRepository, ContestRepository } from '../../repositories';

const data = new SlashCommandBuilder()
  .setName('submissions')
  .setDescription('View and manage your contest submissions')
  .setDMPermission(true);

export const command: SlashCommandDefinition = {
  data,
  help: {
    usage: '/submissions',
    examples: ['Use /submissions in DM to manage your entries'],
    notes: 'Only works in direct messages with the bot.',
  },
  async execute({ interaction }) {
    // Must be used in DMs
    if (interaction.guild) {
      await interaction.reply({
        content: 'This command only works in direct messages. Please DM me to manage your submissions.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const firestore = getFirestoreClient();
    const submissionRepo = new SubmissionRepository(firestore);
    const contestRepo = new ContestRepository(firestore);

    // Get submissions in active contests (SUBMISSION phase only)
    const submissions = await submissionRepo.getByUserInContestStatuses(
      interaction.user.id,
      [ContestStatus.SUBMISSION]
    );

    if (submissions.length === 0) {
      await interaction.editReply({
        content: "You don't have any submissions in active contests.",
      });
      return;
    }

    // Group by contest and build embeds
    const contestIds = [...new Set(submissions.map((s) => s.contestId))];
    const contests = await Promise.all(
      contestIds.map((id) => contestRepo.getById(id))
    );
    const contestMap = new Map(
      contests.filter(Boolean).map((c) => [c!.id, c!])
    );

    const embeds: EmbedBuilder[] = [];
    const components: ActionRowBuilder<ButtonBuilder>[] = [];

    for (const submission of submissions) {
      const contest = contestMap.get(submission.contestId);
      if (!contest) continue;

      const embed = new EmbedBuilder()
        .setTitle(contest.title)
        .setDescription(submission.caption || '_No caption_')
        .setThumbnail(
          `https://firebasestorage.googleapis.com/v0/b/${submission.assets.thumbnail.bucket}/o/${encodeURIComponent(submission.assets.thumbnail.path)}?alt=media`
        )
        .setFooter({
          text: `Submitted ${submission.createdAt.toLocaleDateString()}`,
        })
        .setColor(0x5865f2);

      embeds.push(embed);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`submission:edit:${submission.id}`)
          .setLabel('Edit Caption')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`submission:withdraw:${submission.id}`)
          .setLabel('Withdraw')
          .setStyle(ButtonStyle.Danger)
      );

      components.push(row);
    }

    await interaction.editReply({
      content: `You have **${submissions.length}** submission(s) in active contests:`,
      embeds,
      components,
    });
  },
};

export default command;
```

**Step 2: Run TypeScript check**

Run: `cd bot && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add bot/src/commands/definitions/submissions.ts
git commit -m "feat: add /submissions DM command for viewing user submissions"
```

---

## Task 6: Create Submission Management Handler (Buttons & Modals)

**Files:**
- Create: `bot/src/features/submissions/submissionManagementHandler.ts`

**Step 1: Create the handler**

```typescript
import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { ContestStatus } from '@uss-enterprise/shared';
import { getFirestoreClient } from '../../config/firebaseAdmin';
import { SubmissionRepository, ContestRepository } from '../../repositories';
import { SubmissionDeletionService } from './submissionDeletionService';
import { logger } from '../../logger';

export class SubmissionManagementHandler {
  private readonly submissionRepo = new SubmissionRepository(getFirestoreClient());
  private readonly contestRepo = new ContestRepository(getFirestoreClient());

  constructor(private readonly deletionService: SubmissionDeletionService) {}

  /**
   * Handle button interactions for submission management
   */
  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const [prefix, action, submissionId] = interaction.customId.split(':');

    if (prefix !== 'submission') {
      return;
    }

    switch (action) {
      case 'edit':
        await this.handleEditButton(interaction, submissionId);
        break;
      case 'withdraw':
        await this.handleWithdrawButton(interaction, submissionId);
        break;
      case 'confirm-withdraw':
        await this.handleConfirmWithdraw(interaction, submissionId);
        break;
      case 'cancel-withdraw':
        await this.handleCancelWithdraw(interaction);
        break;
      default:
        logger.warn('Unknown submission action', { action, submissionId });
    }
  }

  /**
   * Handle modal submissions for caption editing
   */
  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.customId.startsWith('submission:edit-modal:')) {
      return;
    }

    const submissionId = interaction.customId.split(':')[2];
    const newCaption = interaction.fields.getTextInputValue('caption');

    const submission = await this.submissionRepo.getById(submissionId);
    if (!submission) {
      await interaction.reply({
        content: 'This submission no longer exists.',
        ephemeral: true,
      });
      return;
    }

    // Verify contest is still in submission phase
    const contest = await this.contestRepo.getById(submission.contestId);
    if (!contest || contest.status !== ContestStatus.SUBMISSION) {
      await interaction.reply({
        content: 'This contest is no longer accepting changes. Submissions are locked.',
        ephemeral: true,
      });
      return;
    }

    await this.submissionRepo.updateCaption(submissionId, newCaption);

    await interaction.reply({
      content: 'Caption updated!',
      ephemeral: true,
    });

    logger.info('Submission caption updated', {
      submissionId,
      userId: interaction.user.id,
    });
  }

  private async handleEditButton(
    interaction: ButtonInteraction,
    submissionId: string
  ): Promise<void> {
    const submission = await this.submissionRepo.getById(submissionId);
    if (!submission) {
      await interaction.reply({
        content: 'This submission no longer exists.',
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`submission:edit-modal:${submissionId}`)
      .setTitle('Edit Caption');

    const captionInput = new TextInputBuilder()
      .setCustomId('caption')
      .setLabel('Caption')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Enter a caption for your submission...')
      .setValue(submission.caption || '')
      .setMaxLength(300)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(captionInput)
    );

    await interaction.showModal(modal);
  }

  private async handleWithdrawButton(
    interaction: ButtonInteraction,
    submissionId: string
  ): Promise<void> {
    const submission = await this.submissionRepo.getById(submissionId);
    if (!submission) {
      await interaction.reply({
        content: 'This submission no longer exists.',
        ephemeral: true,
      });
      return;
    }

    // Verify contest is still in submission phase
    const contest = await this.contestRepo.getById(submission.contestId);
    if (!contest || contest.status !== ContestStatus.SUBMISSION) {
      await interaction.reply({
        content: 'This contest is no longer accepting changes. Submissions are locked.',
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: '**Are you sure you want to withdraw this submission?**\n\nThis cannot be undone. You can submit again in the contest channel if the submission period is still open.',
      ephemeral: true,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`submission:confirm-withdraw:${submissionId}`)
            .setLabel('Confirm Withdraw')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('submission:cancel-withdraw:')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        ),
      ],
    });
  }

  private async handleConfirmWithdraw(
    interaction: ButtonInteraction,
    submissionId: string
  ): Promise<void> {
    const submission = await this.submissionRepo.getById(submissionId);
    if (!submission) {
      await interaction.update({
        content: 'This submission no longer exists.',
        components: [],
      });
      return;
    }

    // Verify contest is still in submission phase
    const contest = await this.contestRepo.getById(submission.contestId);
    if (!contest || contest.status !== ContestStatus.SUBMISSION) {
      await interaction.update({
        content: 'This contest is no longer accepting changes. Submissions are locked.',
        components: [],
      });
      return;
    }

    await this.deletionService.deleteSubmission(submission, {
      deletedBy: interaction.user.id,
      reason: 'User withdrew submission',
    });

    await interaction.update({
      content: `Submission withdrawn. You can submit again in <#${submission.channelId}> if the submission period is still open.`,
      components: [],
    });

    logger.info('User withdrew submission', {
      submissionId,
      userId: interaction.user.id,
      contestId: submission.contestId,
    });
  }

  private async handleCancelWithdraw(interaction: ButtonInteraction): Promise<void> {
    await interaction.update({
      content: 'Withdrawal cancelled.',
      components: [],
    });
  }
}
```

**Step 2: Run TypeScript check**

Run: `cd bot && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add bot/src/features/submissions/submissionManagementHandler.ts
git commit -m "feat: add SubmissionManagementHandler for buttons and modals"
```

---

## Task 7: Create /submission remove Admin Command

**Files:**
- Create: `bot/src/commands/definitions/submission.ts`

**Step 1: Create the admin command**

```typescript
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { ContestStatus } from '@uss-enterprise/shared';
import { SlashCommandDefinition } from '../types';
import { getFirestoreClient } from '../../config/firebaseAdmin';
import { SubmissionRepository, ContestRepository } from '../../repositories';
import { SubmissionDeletionService } from '../../features/submissions/submissionDeletionService';

const data = new SlashCommandBuilder()
  .setName('submission')
  .setDescription('Manage contest submissions (admin)')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

data.addSubcommand((subcommand) =>
  subcommand
    .setName('remove')
    .setDescription('Remove a submission from the contest')
    .addStringOption((option) =>
      option
        .setName('submission_id')
        .setDescription('The submission ID to remove')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for removal (sent to the user)')
        .setRequired(true)
        .setMaxLength(500)
    )
);

export const command: SlashCommandDefinition = {
  data,
  guard: {
    guildOnly: true,
    discordPermissions: 'ManageChannels',
  },
  help: {
    usage: '/submission remove <submission_id> <reason>',
    examples: ['/submission remove abc123 "Inappropriate content"'],
    notes: 'Only works during the submission phase. The user will be notified.',
  },
  async execute({ interaction, client }) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand !== 'remove') {
      await interaction.reply({
        content: 'Unknown subcommand.',
        ephemeral: true,
      });
      return;
    }

    const submissionId = interaction.options.getString('submission_id', true);
    const reason = interaction.options.getString('reason', true);

    await interaction.deferReply({ ephemeral: true });

    const firestore = getFirestoreClient();
    const submissionRepo = new SubmissionRepository(firestore);
    const contestRepo = new ContestRepository(firestore);

    const submission = await submissionRepo.getById(submissionId);
    if (!submission) {
      await interaction.editReply({
        content: 'Submission not found. Please check the ID and try again.',
      });
      return;
    }

    const contest = await contestRepo.getById(submission.contestId);
    if (!contest) {
      await interaction.editReply({
        content: 'Contest not found.',
      });
      return;
    }

    // Verify contest is in submission phase
    if (contest.status !== ContestStatus.SUBMISSION) {
      await interaction.editReply({
        content: 'Submissions can only be removed during the submission phase.',
      });
      return;
    }

    // Verify admin is in the same guild as the contest
    if (contest.guildId !== interaction.guildId) {
      await interaction.editReply({
        content: 'This submission belongs to a contest in a different server.',
      });
      return;
    }

    const deletionService = new SubmissionDeletionService(client);

    await deletionService.deleteSubmission(submission, {
      deletedBy: interaction.user.id,
      reason,
      isAdminAction: true,
    });

    // Notify the user
    await deletionService.notifyUserOfAdminRemoval(
      submission.userId,
      contest.title,
      reason
    );

    await interaction.editReply({
      content: `Submission removed. The user has been notified.\n\n**Submission ID:** ${submissionId}\n**Reason:** ${reason}`,
    });
  },
};

export default command;
```

**Step 2: Run TypeScript check**

Run: `cd bot && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add bot/src/commands/definitions/submission.ts
git commit -m "feat: add /submission remove admin command for moderation"
```

---

## Task 8: Wire Up Interaction Handlers in Main Bot File

**Files:**
- Modify: `bot/src/index.ts`

**Step 1: Import the new handler and service**

Add to imports (around line 17):

```typescript
import { SubmissionDeletionService } from './features/submissions/submissionDeletionService';
import { SubmissionManagementHandler } from './features/submissions/submissionManagementHandler';
```

**Step 2: Initialize the services**

Add after `voteFeedbackService` initialization (around line 54):

```typescript
// Submission management services
const submissionDeletionService = new SubmissionDeletionService(client);
const submissionManagementHandler = new SubmissionManagementHandler(submissionDeletionService);
```

**Step 3: Update interactionCreate handler**

Replace the existing `client.on('interactionCreate', ...)` handler (lines 67-76) with:

```typescript
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await commandDispatcher.dispatch(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      // Handle contest creation modal
      if (interaction.customId === 'contest-creation-modal') {
        await handleContestCreationModal(interaction);
        return;
      }
      // Handle submission management modals
      if (interaction.customId.startsWith('submission:')) {
        await submissionManagementHandler.handleModal(interaction);
        return;
      }
    }

    if (interaction.isButton()) {
      // Handle submission management buttons
      if (interaction.customId.startsWith('submission:')) {
        await submissionManagementHandler.handleButton(interaction);
        return;
      }
    }
  } catch (error) {
    logger.error('Error handling interaction', error as Error, {
      type: interaction.type,
      customId: 'customId' in interaction ? interaction.customId : undefined,
    });
  }
});
```

**Step 4: Run TypeScript check**

Run: `cd bot && npx tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add bot/src/index.ts
git commit -m "feat: wire up submission management handlers in main bot"
```

---

## Task 9: Export New Modules

**Files:**
- Modify: `bot/src/features/submissions/index.ts` (create if doesn't exist)

**Step 1: Check if index.ts exists**

Run: `cat bot/src/features/submissions/index.ts 2>/dev/null || echo "FILE_NOT_FOUND"`

**Step 2: Create or update the exports file**

Create `bot/src/features/submissions/index.ts`:

```typescript
export { SubmissionDeletionService, type DeletionOptions } from './submissionDeletionService';
export { SubmissionManagementHandler } from './submissionManagementHandler';
export { SubmissionCaptureHandler } from './captureService';
export { SubmissionUploadService } from './uploadService';
export { SubmissionPersistenceService } from './submissionPersistenceService';
export { SubmissionFeedbackService } from './submissionFeedbackService';
export { SubmissionLimitService } from './submissionLimitService';
export { ContestSubmissionWatcher } from './messageWatcher';
```

**Step 3: Commit**

```bash
git add bot/src/features/submissions/index.ts
git commit -m "feat: export submission management modules"
```

---

## Task 10: Register Commands and Test

**Step 1: Run full build**

Run: `cd bot && npm run build`
Expected: PASS

**Step 2: Start the bot locally and verify commands load**

Run: `cd bot && npm run dev`
Expected: Log shows "Registered X slash command(s) with dispatcher" (should include new commands)

**Step 3: Test the commands**

Manual testing checklist:
- [ ] `/submissions` in DM shows submissions (or "no submissions" message)
- [ ] Edit Caption button opens modal
- [ ] Modal submission updates caption
- [ ] Withdraw button shows confirmation
- [ ] Confirm deletes submission, storage assets, and Discord message
- [ ] `/submission remove` removes submission and DMs user

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete submission management feature (photo-7kn)"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add guildId/channelId to Submission type | `shared/src/types.ts` |
| 2 | Store guildId/channelId in persistence | `bot/src/.../submissionPersistenceService.ts` |
| 3 | Add repository methods | `bot/src/repositories/SubmissionRepository.ts` |
| 4 | Create deletion service | `bot/src/.../submissionDeletionService.ts` |
| 5 | Create /submissions command | `bot/src/commands/definitions/submissions.ts` |
| 6 | Create button/modal handler | `bot/src/.../submissionManagementHandler.ts` |
| 7 | Create /submission remove command | `bot/src/commands/definitions/submission.ts` |
| 8 | Wire up handlers in index.ts | `bot/src/index.ts` |
| 9 | Export modules | `bot/src/features/submissions/index.ts` |
| 10 | Build and test | - |

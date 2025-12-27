# Epic 9: Web Application Features

## Overview

Build web UI pages for contest functionality: landing page, galleries, voting, and results.

## Current State

**Already implemented (Epic 8):**
- Discord OAuth2 authentication (AuthContext, auth.ts)
- Theme system with dark mode (ThemeContext, ThemeToggle)
- Layout component with navigation
- MySubmissions page (photo-u61.3) - user's submissions list
- EditSubmission page (photo-u61.4) - caption and image editing
- SubmissionCard component
- Services: submissions.ts, imageUpload.ts

**Routes configured:**
- `/login` - Login page
- `/auth/callback` - OAuth callback
- `/` - MySubmissions (protected)
- `/submissions/:submissionId/edit` - Edit submission (protected)

## Remaining Tasks

### Task 1: Contest Service Layer
Create `web/src/services/contests.ts`:
- `getContest(id)` - full contest details
- `getActiveContests(guildId)` - list active contests
- `getSubmissionsByContest(contestId)` - all submissions for gallery

### Task 2: Vote Service Layer
Create `web/src/services/votes.ts`:
- `getUserVotes(userId, contestId)` - user's votes
- `castVote(userId, submissionId, contestId)` - add vote
- `removeVote(userId, submissionId)` - remove vote
- `getVoteCounts(contestId)` - vote counts (only for results)

### Task 3: Contest Landing Page (photo-u61.1)
Create `/contest/:contestId` route:
- Contest title, description
- Status badge (Submission/Voting/Results)
- Countdown timer to next deadline
- Links to gallery/voting/results based on status

### Task 4: Submission Gallery (photo-u61.2)
Create `/contest/:contestId/gallery` route:
- Grid of anonymous submissions
- Lazy-loaded images (thumbnail -> display)
- Click to view full size
- No usernames shown

### Task 5: Voting Page (photo-u61.5)
Create `/contest/:contestId/vote` route:
- Gallery with vote buttons
- Vote count indicator (X of Y used)
- Visual indicator for voted submissions
- Only available during VOTING status

### Task 6: Vote Management (photo-u61.6)
Add to voting page or separate section:
- List of user's current votes
- Remove vote button
- Instant feedback

### Task 7: Results Page (photo-u61.7)
Create `/contest/:contestId/results` route:
- Winner cards with photos and usernames
- Vote counts visible
- Statistics summary
- Only available during RESULTS status

### Task 8: Real-time Updates (photo-u61.8)
Add Firestore listeners:
- Contest status changes
- Vote count updates (after results)
- New submissions during submission period

### Task 9: Firebase Hosting Deploy (photo-u61.9)
- Configure firebase.json for SPA
- Build and deploy
- Set up CORS for storage

## Implementation Order

1. Services layer (contests.ts, votes.ts)
2. Contest Landing page
3. Gallery components (shared between gallery/voting/results)
4. Voting page
5. Results page
6. Real-time updates
7. Deploy

---

## Implementation Log

### Session 1 (2025-12-27)
- Reviewed existing codebase
- Created implementation plan

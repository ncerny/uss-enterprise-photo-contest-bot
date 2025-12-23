# photo-7ht.12: Implement Submission Editing Functionality

## Problem Statement

Users need the ability to edit their photo contest submissions through the web app. This includes updating captions and replacing images. When an image is replaced, the old files should be cleaned up from Firebase Storage.

## Acceptance Criteria

- Caption can be updated
- Image can be replaced (old one deleted from Storage)
- Edit timestamp tracked
- Validation applied to edits
- Changes reflected immediately

## Current State Analysis

### Existing Infrastructure (Ready)
- `editedAt` field already defined in `shared/src/types.ts`
- `SubmissionRepository.update()` method exists with auto `updatedAt`
- Firestore rules allow users to update their own submissions
- Storage rules allow deletion
- Image validation utilities exist in `bot/src/features/submissions/imageValidation.ts`
- Image processing pipeline in `bot/src/features/submissions/imageProcessor.ts`

### Missing Infrastructure
- Web app is empty shell (React app not initialized beyond package.json)
- No Firebase client configuration
- No Discord OAuth2 authentication flow
- No submission viewing/editing UI
- No client-side image upload service
- No old asset cleanup service

## Implementation Plan

### Phase 1: Web App Foundation (Required Infrastructure)

#### Step 1.1: Initialize React App Structure
Create core React app files:
- `web/src/main.tsx` - Entry point
- `web/src/App.tsx` - Root component with routing
- `web/src/index.css` - Base styles
- `web/index.html` - HTML template

#### Step 1.2: Firebase Client Configuration
- `web/src/config/firebase.ts` - Initialize Firebase app
- Environment variables for Firebase config

#### Step 1.3: Auth Context & Discord OAuth2
- `web/src/contexts/AuthContext.tsx` - Auth state management
- `web/src/services/auth.ts` - Discord OAuth2 flow
- `web/src/pages/LoginPage.tsx` - Login UI
- `web/src/pages/AuthCallback.tsx` - OAuth callback handler

### Phase 2: Submission Services

#### Step 2.1: Submission Data Service
- `web/src/services/submissions.ts` - Firestore CRUD operations
  - `getUserSubmissions(userId)` - Fetch user's submissions
  - `getSubmission(id)` - Fetch single submission
  - `updateSubmissionCaption(id, caption)` - Update caption only
  - `updateSubmissionImage(id, newAssets, oldAssets)` - Replace image

#### Step 2.2: Image Upload Service
- `web/src/services/imageUpload.ts` - Client-side image handling
  - `validateImage(file)` - Validate type, size, dimensions
  - `uploadImageVariants(contestId, uploadId, file)` - Upload to Storage
  - `deleteImageVariants(assets)` - Remove old files from Storage
  - `processAndUpload(contestId, file)` - Full pipeline

### Phase 3: Edit UI Components

#### Step 3.1: My Submissions Page
- `web/src/pages/MySubmissions.tsx` - List user's submissions
- `web/src/components/SubmissionCard.tsx` - Display submission with edit button

#### Step 3.2: Edit Submission Modal/Page
- `web/src/pages/EditSubmission.tsx` - Edit form
- `web/src/components/CaptionEditor.tsx` - Caption input with validation
- `web/src/components/ImageReplacer.tsx` - Image upload/preview with old image display

### Phase 4: Integration & Polish

#### Step 4.1: Real-time Updates
- Firestore listeners for immediate reflection of changes

#### Step 4.2: Loading & Error States
- Loading indicators during upload/save
- Error messages for validation failures
- Success confirmations

## Technical Design

### Caption Update Flow
```
User clicks "Edit" on submission
  → Opens edit form with current caption
  → User modifies caption
  → Client validates (≤500 chars)
  → Submit calls updateSubmissionCaption()
  → Firestore update: { caption, editedAt: serverTimestamp() }
  → UI reflects change
```

### Image Replacement Flow
```
User clicks "Replace Image"
  → File picker opens
  → User selects new image
  → Client-side validation (type, size, dimensions)
  → Generate new uploadId
  → processAndUpload() creates 3 variants
  → Upload variants to Storage: submissions/{contestId}/{newUploadId}/
  → Update Firestore: { assets: newAssets, editedAt: serverTimestamp() }
  → Delete old variants from Storage: submissions/{contestId}/{oldUploadId}/
  → UI shows new image
```

### Validation Rules (Matching Bot)
- File size: ≤10 MiB
- Dimensions: ≥256x256px
- Types: JPEG, PNG, WebP
- Caption: ≤500 characters

## File Structure

```
web/src/
├── main.tsx
├── App.tsx
├── index.css
├── config/
│   └── firebase.ts
├── contexts/
│   └── AuthContext.tsx
├── services/
│   ├── auth.ts
│   ├── submissions.ts
│   └── imageUpload.ts
├── pages/
│   ├── LoginPage.tsx
│   ├── AuthCallback.tsx
│   ├── MySubmissions.tsx
│   └── EditSubmission.tsx
├── components/
│   ├── SubmissionCard.tsx
│   ├── CaptionEditor.tsx
│   └── ImageReplacer.tsx
└── utils/
    └── imageValidation.ts
```

## Dependencies to Add

Already in package.json:
- react, react-dom, react-router-dom
- firebase (v10.7.0)
- vite, vitest

May need:
- Browser-side image processing (browser-image-resizer or similar)

## Risk Considerations

1. **Browser Image Processing**: Sharp doesn't run in browser. Need alternative for variant generation OR delegate to Cloud Function.
2. **Large File Uploads**: 10 MiB files need progress indicators and timeout handling.
3. **Race Conditions**: If user edits twice quickly, ensure proper sequencing.
4. **Auth State**: Must verify user owns submission before allowing edit.

## Decision: Image Processing Location

**Option A**: Process in browser using Canvas API
- Pros: No backend required, works on free tier
- Cons: Browser compatibility, less quality control

**Option B**: Upload original, process via Cloud Function
- Pros: Consistent with bot processing, uses Sharp
- Cons: Requires Cloud Function (has free tier though)

**Recommendation**: Start with Option A for simplicity, can migrate to Option B if quality issues arise.

---

## Implementation Log

### Session 1 - 2025-12-23

**Status**: Implementation complete, blocked on Cloud Function

**Context**: Task photo-7ht.12 was already marked in_progress. Codebase exploration revealed:
- Web app is empty shell (only package.json configured)
- Bot-side infrastructure is ready (editedAt field, repository methods, security rules)
- Need to build minimum viable web app to support editing

**Completed**:
1. Initialized React app structure with Vite, TypeScript, React Router
2. Set up Firebase client configuration
3. Implemented Discord OAuth2 auth flow (client-side)
4. Built submission services (CRUD operations, image upload/delete)
5. Created edit UI (MySubmissions, EditSubmission pages)

**Files Created**:
- `web/vite.config.ts`, `web/tsconfig.node.json`, `web/index.html`
- `web/src/main.tsx`, `web/src/App.tsx`, `web/src/index.css`
- `web/src/config/firebase.ts`
- `web/src/contexts/AuthContext.tsx`
- `web/src/services/auth.ts`, `web/src/services/submissions.ts`, `web/src/services/imageUpload.ts`
- `web/src/pages/LoginPage.tsx`, `web/src/pages/AuthCallback.tsx`, `web/src/pages/MySubmissions.tsx`, `web/src/pages/EditSubmission.tsx`
- `web/src/components/Layout.tsx`, `web/src/components/SubmissionCard.tsx`, `web/src/components/ErrorBoundary.tsx`
- CSS modules for each component

**Code Review Findings (Fixed)**:
- Fixed storage rules path mismatch (Critical)
- Fixed image replacement race condition with rollback (Critical)
- Added contest status validation in Firestore rules (Critical)
- Fixed memory leak in image preview URLs (Important)
- Fixed contest null check validation (Important)
- Fixed timestamp handling with proper validation (Important)
- Fixed N+1 query problem by batch-fetching contests (Important)
- Added Error Boundary component (Important)

**Blocker**:
- Missing `exchangeDiscordCode` Cloud Function (photo-3pn)
- Without this, users cannot authenticate with the web app

**Decision Made**:
- Used browser Canvas API for image processing (Option A)
- Works without Cloud Functions, simpler implementation


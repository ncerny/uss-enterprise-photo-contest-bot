#!/bin/bash
# Script to create all beads stories for USS Enterprise Photo Contest Bot
# Run from project root

set -e

echo "Creating Epic 1 tasks..."

# Epic 1 Research Spikes
bd create --parent=photo-9cx --title="Research Discord.js bot setup and best practices" --type=task --description="Research Discord.js v14 setup, bot application creation, required intents (MESSAGE_CONTENT, GUILDS), permission scopes, and bot hosting best practices. 

Acceptance Criteria:
- Document required Discord intents
- Identify bot permissions needed for channel creation and management
- Research hosting options (VM vs serverless)
- Document Discord.js v14 initialization pattern"

bd create --parent=photo-9cx --title="Research Firebase project setup and free tier optimization" --type=task --description="Research Firebase project creation, Firestore/Storage/Hosting configuration, and strategies to stay within free tier limits.

Acceptance Criteria:
- Document Firebase project setup steps
- Identify optimization strategies for free tier
- Research Firestore query patterns for minimal reads
- Document recommended Firebase SDK versions"

bd create --parent=photo-9cx --title="Research Discord OAuth2 integration for web app" --type=task --description="Research Discord OAuth2 flow, required scopes (identify), token handling, and security best practices.

Acceptance Criteria:
- Document OAuth2 flow implementation
- Identify required Discord application settings
- Research token refresh patterns
- Document security considerations"

bd create --parent=photo-9cx --title="Research image optimization libraries for Firebase constraints" --type=task --description="Research image resizing/compression libraries compatible with Node.js for optimizing uploads to Firebase Storage.

Acceptance Criteria:
- Identify suitable image processing libraries (sharp, jimp, etc.)
- Document compression strategies
- Calculate expected file size reductions
- Verify compatibility with Firebase Storage"

echo "Creating Epic 1 implementation tasks..."

bd create --parent=photo-9cx --title="Initialize project structure" --type=task --description="Create project directories (bot/, web/, functions/), initialize package.json files, configure TypeScript, and set up monorepo structure.

Acceptance Criteria:
- Directory structure created (bot/, web/, functions/, shared/)
- package.json with Node.js 18+ and TypeScript configured
- tsconfig.json for each workspace
- .gitignore configured for node_modules, .env, Firebase cache
- README with project structure documentation"

bd create --parent=photo-9cx --title="Set up Firebase project and configure services" --type=task --description="Create Firebase project, enable Firestore, Storage, and Hosting, and configure Firebase CLI.

Acceptance Criteria:
- Firebase project created
- Firestore database provisioned in free tier region
- Cloud Storage bucket created
- Hosting initialized
- firebase.json configured
- Firebase Admin SDK credentials generated"

bd create --parent=photo-9cx --title="Configure Discord bot application and permissions" --type=task --description="Create Discord bot application, configure required intents and permissions, and obtain bot token.

Acceptance Criteria:
- Discord application created
- Bot user created with token
- MESSAGE_CONTENT and GUILDS intents enabled
- OAuth2 application configured with redirect URIs
- Bot invite link generated with required permissions"

bd create --parent=photo-9cx --title="Set up development environment and tooling" --type=task --description="Configure ESLint, Prettier, husky git hooks, and development scripts.

Acceptance Criteria:
- ESLint configured with TypeScript support
- Prettier configured with project standards
- Husky pre-commit hooks for linting
- npm scripts for dev, build, test, lint
- VS Code settings.json with recommended extensions"

bd create --parent=photo-9cx --title="Configure CI/CD pipelines" --type=task --description="Set up GitHub Actions for automated testing, linting, and deployment.

Acceptance Criteria:
- GitHub Actions workflow for PR checks (lint, test)
- Deployment workflow for Firebase Hosting
- Deployment workflow for bot to VM (optional for MVP)
- Branch protection rules documented"

bd create --parent=photo-9cx --title="Set up environment variables and secrets management" --type=task --description="Configure .env files, document required environment variables, and set up secrets management.

Acceptance Criteria:
- .env.example files for bot and web
- Environment variables documented in README
- Discord bot token, Firebase credentials, OAuth secrets identified
- Secrets management strategy documented (GitHub Secrets, etc.)"

echo "Creating Epic 2 tasks..."

# Epic 2 Research Spikes
bd create --parent=photo-ovf --title="Research Firestore security rules best practices" --type=task --description="Research Firestore security rules patterns for authenticated access, read/write restrictions, and data validation.

Acceptance Criteria:
- Document authenticated vs unauthenticated access patterns
- Research Discord user ID as auth mechanism
- Identify validation rules for contest/submission/vote data
- Document testing strategies for security rules"

bd create --parent=photo-ovf --title="Research Firestore indexing for contest queries" --type=task --description="Research Firestore composite indexes needed for contest queries (by status, deadline, guild).

Acceptance Criteria:
- Identify required query patterns
- Document composite index requirements
- Research index creation via firestore.indexes.json
- Document index performance implications"

echo "Creating Epic 2 implementation tasks..."

bd create --parent=photo-ovf --title="Define Firestore schema" --type=task --description="Define collections and document schemas for Contest, Submission, and Vote with TypeScript interfaces.

Acceptance Criteria:
- TypeScript interfaces for Contest, Submission, Vote
- Field types and constraints documented
- Relationship mappings defined (FK references)
- Schema versioning strategy documented"

bd create --parent=photo-ovf --title="Implement data access layer with TypeScript interfaces" --type=task --description="Create repository pattern for Firestore operations with type-safe interfaces.

Acceptance Criteria:
- Repository classes for Contest, Submission, Vote
- CRUD operations implemented
- Type-safe query builders
- Error handling for Firestore operations
- Unit tests for repositories"

bd create --parent=photo-ovf --title="Create Firestore security rules" --type=task --description="Implement security rules ensuring users can only modify their own submissions/votes and admins can manage contests.

Acceptance Criteria:
- Users can read active contests
- Users can create/update/delete own submissions
- Users can create/delete own votes
- Admins can create/update contests
- Rules tested with Firebase emulator"

bd create --parent=photo-ovf --title="Set up Firestore indexes" --type=task --description="Create composite indexes for contest queries in firestore.indexes.json.

Acceptance Criteria:
- Indexes defined in firestore.indexes.json
- Indexes deployed to Firebase
- Query performance validated
- Index usage documented"

bd create --parent=photo-ovf --title="Create database migration utilities" --type=task --description="Build utilities for schema migrations and data seeding for development/testing.

Acceptance Criteria:
- Migration scripts for adding/modifying collections
- Seed script for test data
- Rollback capability documented
- Migration history tracked"

echo "Epic 2 complete!"
echo "Now creating Epic 3-11 tasks..."
echo "This script creates the foundational epics. Additional tasks will be created in next script."

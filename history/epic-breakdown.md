# Epic and Task Breakdown for USS Enterprise Photo Contest Bot

## Epic Structure

### Epic 1: Project Infrastructure & Setup
**Objective**: Establish foundational infrastructure for bot and web app

**Research Spikes:**
- RS-1.1: Research Discord.js bot setup and best practices
- RS-1.2: Research Firebase project setup and free tier optimization
- RS-1.3: Research Discord OAuth2 integration for web app
- RS-1.4: Research image optimization libraries for Firebase constraints

**Implementation Tasks:**
- T-1.1: Initialize project structure (bot/, web/, functions/)
- T-1.2: Set up Firebase project and configure services
- T-1.3: Configure Discord bot application and permissions
- T-1.4: Set up development environment and tooling
- T-1.5: Configure CI/CD pipelines
- T-1.6: Set up environment variables and secrets management

**Dependencies:** RS tasks block corresponding T tasks

---

### Epic 2: Data Models & Firestore Schema
**Objective**: Design and implement database schema and data access layer

**Research Spikes:**
- RS-2.1: Research Firestore security rules best practices
- RS-2.2: Research Firestore indexing for contest queries

**Implementation Tasks:**
- T-2.1: Define Firestore schema (Contest, Submission, Vote collections)
- T-2.2: Implement data access layer with TypeScript interfaces
- T-2.3: Create Firestore security rules
- T-2.4: Set up Firestore indexes
- T-2.5: Create database migration utilities

**Dependencies:** Epic 1 setup; RS tasks block T tasks

---

### Epic 3: Discord Bot Core
**Objective**: Build core Discord bot with slash command framework

**Research Spikes:**
- RS-3.1: Research Discord.js v14 slash command patterns
- RS-3.2: Research Discord modal forms and validation
- RS-3.3: Research Discord rate limiting and best practices

**Implementation Tasks:**
- T-3.1: Set up Discord bot client and event handlers
- T-3.2: Implement slash command registry
- T-3.3: Create command handler framework
- T-3.4: Implement error handling and logging
- T-3.5: Set up bot deployment to VM

**Dependencies:** Epic 1, Epic 2; RS tasks block T tasks

---

### Epic 4: Contest Creation & Management
**Objective**: Implement contest creation via slash commands and lifecycle management

**Implementation Tasks:**
- T-4.1: Implement `/contest create` slash command
- T-4.2: Build contest creation modal with validation
- T-4.3: Implement channel creation and permission setup
- T-4.4: Create contest welcome message with dynamic content
- T-4.5: Implement contest state transitions (Created → Submission → Voting → Results)
- T-4.6: Implement `/contest close` early closing command
- T-4.7: Implement `/contest cancel` and `/contest resume` commands
- T-4.8: Create contest scheduler for deadline triggers

**Dependencies:** Epic 2, Epic 3

**Acceptance Criteria:**
- Admin can create contest with all required fields
- Channel is created with normalized name
- Bot has proper permissions in contest channel
- Welcome message displays all contest details
- Contest transitions automatically at deadlines
- Admin can manually trigger transitions

---

### Epic 5: Submission System
**Objective**: Implement photo submission capture, storage, and management

**Research Spikes:**
- RS-5.1: Research Discord message attachment handling
- RS-5.2: Research Firebase Storage upload patterns and optimization
- RS-5.3: Research image resizing/compression for Firebase free tier

**Implementation Tasks:**
- T-5.1: Implement message watcher for contest channels
- T-5.2: Build image capture and validation logic
- T-5.3: Implement Firebase Storage upload with compression
- T-5.4: Create submission record in Firestore
- T-5.5: Implement message deletion after capture
- T-5.6: Build user feedback system (DMs with confirmation)
- T-5.7: Implement submission limit tracking and enforcement
- T-5.8: Update welcome message submission count
- T-5.9: Implement submission editing functionality

**Dependencies:** Epic 2, Epic 3; RS tasks block T tasks

**Acceptance Criteria:**
- User posts image in contest channel
- Bot captures image and metadata
- Original message is deleted
- User receives DM confirmation
- Submission count updates in welcome message
- Limits are enforced correctly
- Users can edit submissions

---

### Epic 6: Voting System
**Objective**: Implement anonymous voting with vote limits and management

**Research Spikes:**
- RS-6.1: Research Discord reaction-based voting patterns
- RS-6.2: Research vote tracking and deduplication strategies

**Implementation Tasks:**
- T-6.1: Implement voting period transition logic
- T-6.2: Create anonymous photo display system with randomization
- T-6.3: Implement reaction-based voting mechanism
- T-6.4: Build vote tracking in Firestore
- T-6.5: Implement vote limit enforcement
- T-6.6: Create vote management feedback (DMs)
- T-6.7: Implement vote visibility controls (hidden counts)

**Dependencies:** Epic 2, Epic 3, Epic 5; RS tasks block T tasks

**Acceptance Criteria:**
- Photos displayed anonymously in random order
- Users can vote via reactions
- Vote limits enforced correctly
- Vote counts hidden during voting
- Users receive feedback when limit reached

---

### Epic 7: Results & Winner Announcement
**Objective**: Implement vote tallying and winner announcement system

**Implementation Tasks:**
- T-7.1: Implement vote tallying algorithm
- T-7.2: Build winner ranking with tie handling
- T-7.3: Create winner announcement message formatting
- T-7.4: Implement results posting to channel
- T-7.5: Generate contest statistics summary
- T-7.6: Store final results in Firestore

**Dependencies:** Epic 6

**Acceptance Criteria:**
- Votes tallied correctly
- Ties handled with shared positions
- All tied winners displayed
- Winners announced with photos and usernames
- Statistics summary posted

---

### Epic 8: Web Application - Core
**Objective**: Build React web app with authentication and routing

**Research Spikes:**
- RS-8.1: Research React + Firebase best practices
- RS-8.2: Research Discord OAuth2 flow implementation
- RS-8.3: Research mobile-first responsive design patterns

**Implementation Tasks:**
- T-8.1: Initialize React app with Vite
- T-8.2: Set up Firebase SDK in web app
- T-8.3: Implement Discord OAuth2 authentication flow
- T-8.4: Create routing structure
- T-8.5: Build authentication context and guards
- T-8.6: Implement dark mode theme system
- T-8.7: Create responsive layout components

**Dependencies:** Epic 1, Epic 2; RS tasks block T tasks

---

### Epic 9: Web Application - Contest Features
**Objective**: Build web UI for contest participation and management

**Implementation Tasks:**
- T-9.1: Build Contest Landing page
- T-9.2: Create Submission Gallery view (anonymous)
- T-9.3: Build My Submissions management page
- T-9.4: Implement submission editing UI
- T-9.5: Create Voting Page with gallery
- T-9.6: Implement vote management UI
- T-9.7: Build Results/History page
- T-9.8: Implement real-time updates with Firestore listeners
- T-9.9: Deploy to Firebase Hosting

**Dependencies:** Epic 8

**Acceptance Criteria:**
- All pages functional and mobile-responsive
- Discord OAuth working
- Users can manage submissions
- Users can vote on web
- Real-time updates working
- Dark mode implemented

---

### Epic 10: Testing & Quality Assurance
**Objective**: Comprehensive testing of all systems

**Implementation Tasks:**
- T-10.1: Write unit tests for bot commands
- T-10.2: Write unit tests for data layer
- T-10.3: Write integration tests for contest lifecycle
- T-10.4: Create end-to-end tests for web app
- T-10.5: Test Firebase free tier limits and optimization
- T-10.6: Load testing for concurrent users
- T-10.7: Security audit of Firestore rules

**Dependencies:** All implementation epics

---

### Epic 11: Documentation
**Objective**: Create comprehensive documentation for users and developers

**Implementation Tasks:**
- T-11.1: Write user guide for contest organizers
- T-11.2: Write user guide for participants
- T-11.3: Create bot setup/deployment guide
- T-11.4: Document web app deployment
- T-11.5: Create API documentation for Firestore schema
- T-11.6: Write contribution guidelines

**Dependencies:** All implementation epics

---

## Parallelization Strategy

**Parallel Tracks:**
1. Infrastructure (Epic 1) → can be done first
2. Data Models (Epic 2) → depends on Epic 1, blocks others
3. Bot Core (Epic 3) → depends on Epic 1, 2
4. Contest Management (Epic 4) → depends on Epic 2, 3
5. Submission System (Epic 5) → depends on Epic 2, 3
6. Web Core (Epic 8) → can start after Epic 1, 2 in parallel with bot work
7. Voting (Epic 6) → depends on submission complete
8. Results (Epic 7) → depends on voting
9. Web Features (Epic 9) → depends on Epic 8, can parallel with Epic 6, 7
10. Testing (Epic 10) → ongoing, final pass at end
11. Documentation (Epic 11) → ongoing, final pass at end

**Research Spike Strategy:**
- All RS tasks can be created in parallel
- Each RS task blocks its corresponding implementation tasks

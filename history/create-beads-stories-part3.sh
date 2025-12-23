#!/bin/bash
# Script to create Epic 6-11 beads stories
# Run from project root

set -e

echo "Creating Epic 6 (Voting System) tasks..."

# Epic 6 Research Spikes
bd create --parent=photo-6sc --title="Research Discord reaction-based voting patterns" --type=task --description="Research Discord reaction events, reaction tracking, and handling reaction add/remove.

Acceptance Criteria:
- Document reaction event types
- Research reaction tracking strategies
- Identify rate limits for reactions
- Document reaction removal handling"

bd create --parent=photo-6sc --title="Research vote tracking and deduplication strategies" --type=task --description="Research Firestore patterns for vote deduplication and efficient vote counting.

Acceptance Criteria:
- Document composite key patterns
- Research vote count aggregation
- Identify unique constraint strategies
- Document query optimization for vote counts"

# Epic 6 Implementation Tasks
bd create --parent=photo-6sc --title="Implement voting period  transition logic" --type=task --description="Trigger voting period start at submission deadline with automated workflow.

Acceptance Criteria:
- Scheduler triggers at submission deadline
- Contest state changes to Voting
- Channel notified of transition
- Voting end time calculated and scheduled
- Transition logged"

bd create --parent=photo-6sc --title="Create anonymous photo display system with randomization" --type=task --description="Post all submissions anonymously in randomized order with voting numbers.

Acceptance Criteria:
- All submissions retrieved from Firestore
- Order randomized with seeded RNG
- Photos posted without user attribution
- Each photo assigned number (1, 2, 3...)
- Display order saved to submission records"

bd create --parent=photo-6sc --title="Implement reaction-based voting mechanism" --type=task --description="Add reaction to each photo and track reaction events for vote recording.

Acceptance Criteria:
- Bot adds thumbs-up reaction to each photo
- Reaction add events captured
- Reaction remove events captured
- Only thumbs-up counted as votes
- Other reactions ignored"

bd create --parent=photo-6sc --title="Build vote tracking in Firestore" --type=task --description="Record votes in Firestore with voter ID, submission ID, and timestamp.

Acceptance Criteria:
- Vote document created on reaction add
- Vote document deleted on reaction remove
- Duplicate votes prevented
- Voter and submission IDs recorded
- Vote count queryable"

bd create --parent=photo-6sc --title="Implement vote limit enforcement" --type=task --description="Check voter's vote count and prevent exceeding max votes per user.

Acceptance Criteria:
- Query counts voter's active votes
- Blocks vote if at limit
- Removes reaction if limit exceeded
- User receives DM about limit
- DM includes  management link"

bd create --parent=photo-6sc --title="Create vote management feedback (DMs)" --type=task --description="Send DMs to users about vote status and limit warnings.

Acceptance Criteria:
- DM sent when vote limit reached
- DM explains how to unvote
- Includes web app link for vote management
- Handles DMs disabled gracefully
- Styled with embeds"

bd create --parent=photo-6sc --title="Implement vote visibility controls (hidden counts)" --type=task --description="Ensure vote counts are hidden during voting period (no public display).

Acceptance Criteria:
- Reaction counts not displayed publicly
- No commands expose vote counts during voting
- Web app hides counts during voting
- Counts only shown after results
- Admin can optionally view counts (optional)"

echo "Creating Epic 7 (Results & Winner Announcement) tasks..."

bd create --parent=photo-f6z --title="Implement vote tallying algorithm" --type=task --description="Count all votes for each submission and calculate totals at voting deadline.

Acceptance Criteria:
- All votes queried from Firestore
- Votes aggregated by submission
- Vote counts calculated accurately
- Results cached for announcement
- Tallying logged"

bd create --parent=photo-f6z --title="Build winner ranking with tie handling" --type=task --description="Rank submissions by vote count with tie-aware positioning (shared placements).

Acceptance Criteria:
- Submissions sorted by vote count descending
- Ties share same position number
- Next position after tie skips appropriately (1st, 1st, 3rd)
- All tied winners included even if exceeds numberOfWinners
- Ranking algorithm tested with tie scenarios"

bd create --parent=photo-f6z --title="Create winner announcement message formatting" --type=task --description="Format winner cards with placement emoji, username, photo, and vote count.

Acceptance Criteria:
- 🥇🥈🥉 emojis for top 3 (or position numbers)
- Username displayed with @mention
- Photo embedded
- Vote count shown
- Multiple cards for ties"

bd create --parent=photo-f6z --title="Implement results posting to channel" --type=task --description="Post all winner cards and statistics to contest channel.

Acceptance Criteria:
- Winner cards posted in order
- All tied winners shown
- Statistics summary posted after winners
- Channel pinned to results (optional)
- Results posting logged"

bd create --parent=photo-f6z --title="Generate contest statistics summary" --type=task --description="Calculate and format statistics: total submissions, votes cast, unique voters, duration.

Acceptance Criteria:
- Total submissions counted
- Total votes counted
- Unique voter count calculated
- Contest duration computed
- Statistics formatted in embed"

bd create --parent=photo-f6z --title="Store final results in Firestore" --type=task --description="Save winner rankings and statistics to Firestore for historical access.

Acceptance Criteria:
- Contest status set to Results
- Winner rankings saved
- Vote totals saved with submissions
- Statistics saved to contest doc
- Results timestamp recorded"

echo "Creating Epic 8 (Web Application Core) tasks..."

# Epic 8 Research Spikes
bd create --parent=photo-471 --title="Research React + Firebase best practices" --type=task --description="Research React patterns for Firebase SDK integration and real-time listeners.

Acceptance Criteria:
- Document Firebase SDK initialization in React
- Research Firestore real-time listener hooks
- Identify React Query vs Firebase listeners tradeoff
- Document authentication context patterns"

bd create --parent=photo-471 --title="Research Discord OAuth2 flow implementation" --type=task --description="Research implementing Discord OAuth2 in React SPA with token handling.

Acceptance Criteria:
- Document OAuth2 authorization code flow
- Research token storage strategies (localStorage vs sessionStorage)
- Identify redirect URI configuration
- Document token refresh patterns"

bd create --parent=photo-471 --title="Research mobile-first responsive design patterns" --type=task --description="Research CSS frameworks and responsive design patterns for mobile-first development.

Acceptance Criteria:
- Evaluate Tailwind CSS vs vanilla CSS
- Document mobile breakpoints
- Research touch-friendly UI patterns
- Identify dark mode implementation strategies"

# Epic 8 Implementation Tasks
bd create --parent=photo-471 --title="Initialize React app with Vite" --type=task --description="Create React app using Vite build tool with TypeScript and routing.

Acceptance Criteria:
- Vite project created with React + TypeScript
- Development server running
- Production build configured
- Environment variables setup (.env.local)
- Vite config optimized for Firebase Hosting"

bd create --parent=photo-471 --title="Set up Firebase SDK in web app" --type=task --description="Initialize Firebase SDK with Firestore and Storage in React app.

Acceptance Criteria:
- Firebase SDK installed and configured
- Firebase config from environment variables
- Firestore and Storage initialized
- Firebase app singleton pattern
- SDK imports tree-shaken"

bd create --parent=photo-471 --title="Implement Discord OAuth2 authentication flow" --type=task --description="Build OAuth2 login flow with Discord including redirect handling and token storage.

Acceptance Criteria:
- Login button redirects to Discord OAuth
- Callback route handles authorization code
- Access token obtained and stored
- User identity fetched from Discord
- Logout functionality implemented"

bd create --parent=photo-471 --title="Create routing structure" --type=task --description="Set up React Router with routes for all app pages.

Acceptance Criteria:
- React Router configured
- Routes defined for all pages (landing, gallery, manage, vote, results)
- 404 page implemented
- Route transitions smooth
- Deep linking works"

bd create --parent=photo-471 --title="Build authentication context and guards" --type=task --description="Create React context for authentication state and route guards.

Acceptance Criteria:
- AuthContext provides user state
- useAuth hook for components
- Protected routes redirect to login
- Auth state persists on refresh
- Loading states handled"

bd create --parent=photo-471 --title="Implement dark mode theme system" --type=task --description="Build dark mode theme matching Discord's aesthetic with theme toggle.

Acceptance Criteria:
- Dark mode CSS variables defined
- Light mode also available
- Theme preference saved to localStorage
- Theme toggle component implemented
- Smooth theme transitions"

bd create --parent=photo-471 --title="Create responsive layout components" --type=task --description="Build reusable layout components (Header, Footer, Container) with mobile-first responsive design.

Acceptance Criteria:
- Header with navigation
- Container with max-width
- Footer with links
- Mobile hamburger menu
- Responsive breakpoints (mobile, tablet, desktop)"

echo "Creating Epic 9 (Web Application Features) tasks..."

bd create --parent=photo-u61 --title="Build Contest Landing page" --type=task --description="Create landing page showing active contest details, deadlines, and countdown timer.

Acceptance Criteria:
- Contest title and description displayed
- Submission and voting deadlines shown
- Countdown timer to next deadline
- Contest status badge (Submission/Voting/Results)
- Mobile responsive"

bd create --parent=photo-u61 --title="Create Submission Gallery view (anonymous)" --type=task --description="Build gallery page showing all submissions anonymously during voting.

Acceptance Criteria:
- All submissions displayed in grid
- Images lazy-loaded
- Anonymous (no usernames)
- Voting numbers displayed
- Click to view full size"

bd create --parent=photo-u61 --title="Build My Submissions management page" --type=task --description="Create page for users to view and manage their submissions.

Acceptance Criteria:
- Shows user's submissions for contest
- Displays submission count (X of Y)
- Edit and delete buttons
- Thumbnail previews
- Upload new submission (if under limit)"

bd create --parent=photo-u61 --title="Implement submission editing UI" --type=task --description="Build modal/form for editing submission caption and replacing image.

Acceptance Criteria:
- Caption text input
- Image upload/replace functionality
- Preview before save
- Validation and error handling
- Saves to Firestore and Storage"

bd create --parent=photo-u61 --title="Create Voting Page with gallery" --type=task --description="Build voting interface with gallery and vote indicators.

Acceptance Criteria:
- Gallery of all submissions
- Vote button on each submission
- Vote count indicator (X of Y)
- Shows which submissions user voted for
- Unvote functionality"

bd create --parent=photo-u61 --title="Implement vote management UI" --type=task --description="Allow users to see their votes and remove votes to free up vote slots.

Acceptance Criteria:
- List of user's votes shown
- Remove vote button
- Vote count updates immediately
- Redirects to gallery after remove
- Confirmation before removing (optional)"

bd create --parent=photo-u61 --title="Build Results/History page" --type=task --description="Create page displaying contest winners, statistics, and historical contests.

Acceptance Criteria:
- Winner cards displayed with photos
- Vote counts shown for all submissions
- Statistics summary displayed
- Contest history list (if multiple contests)
- Link to Discord channel"

bd create --parent=photo-u61 --title="Implement real-time updates with Firestore listeners" --type=task --description="Use Firestore onSnapshot listeners for live updates to contest data.

Acceptance Criteria:
- Active contest data updates in real-time
- Submission count updates live
- Vote changes reflected immediately
- State transitions trigger UI updates
- Listeners cleaned up on unmount"

bd create --parent=photo-u61 --title="Deploy to Firebase Hosting" --type=task --description="Configure Firebase Hosting and deploy production build of web app.

Acceptance Criteria:
- firebase.json configured for SPA routing
- Production build optimized
- Deployed to Firebase Hosting
- Custom domain configured (optional)
- HTTPS enabled"

echo "Creating Epic 10 (Testing & QA) tasks..."

bd create --parent=photo-3zm --title="Write unit tests for bot commands" --type=task --description="Create  unit tests for slash commands and command handlers.

Acceptance Criteria:
- Tests for /contest create command
- Tests for contest management commands
- Tests for submission handling
- Tests for voting logic
- 80%+ code coverage for commands"

bd create --parent=photo-3zm --title="Write unit tests for data layer" --type=task --description="Create unit tests for Firestore repositories and data access.

Acceptance Criteria:
- Tests for Contest repository
- Tests for Submission repository
- Tests for Vote repository
- Mocked Firestore operations
- 80%+ coverage for data layer"

bd create --parent=photo-3zm --title="Write integration tests for contest lifecycle" --type=task --description="Create end-to-end integration tests for full contest workflow.

Acceptance Criteria:
- Test creation → submission → voting → results
- Test early closing
- Test cancellation and resume
- Test concurrent user submissions
- Tests use Firebase emulator"

bd create --parent=photo-3zm --title="Create end-to-end tests for web app" --type=task --description="Build E2E tests for web app user flows with Playwright or Cypress.

Acceptance Criteria:
- Test OAuth login flow
- Test submission management
- Test voting flow
- Test responsive layouts
- Tests run in CI"

bd create --parent=photo-3zm --title="Test Firebase free tier limits and optimization" --type=task --description="Validate that image optimization and caching keep usage within free tier.

Acceptance Criteria:
- Image sizes measured before/after compression
- Firestore read/write counts tracked
- Storage usage monitored
- Optimization targets met
- Free tier projections documented"

bd create --parent=photo-3zm --title="Load testing for concurrent users" --type=task --description="Perform load testing for concurrent submissions and votes.

Acceptance Criteria:
- Test 50+ concurrent submissions
- Test 100+ concurrent votes
- Measure response times
- Identify bottlenecks
- Document performance limits"

bd create --parent=photo-3zm --title="Security audit of Firestore rules" --type=task --description="Audit Firestore security rules for vulnerabilities and unauthorized access.

Acceptance Criteria:
- Rules tested with Firebase emulator
- Unauthorized access attempts blocked
- User data isolation verified
- Admin-only operations protected
- Security test cases documented"

echo "Creating Epic 11 (Documentation) tasks..."

bd create --parent=photo-110 --title="Write user guide for contest organizers" --type=task --description="Create documentation for admins on creating and managing contests.

Acceptance Criteria:
- Step-by-step contest creation guide
- Management command reference
- Best practices for contest parameters
- Troubleshooting section
- Screenshots/examples included"

bd create --parent=photo-110 --title="Write user guide for participants" --type=task --description="Create documentation for participants on submitting and voting.

Acceptance Criteria:
- How to submit photos
- How to vote on Discord
- How to use web app
- Submission management guide
- FAQ section"

bd create --parent=photo-110 --title="Create bot setup/deployment guide" --type=task --description="Write documentation for deploying and configuring the bot.

Acceptance Criteria:
- Discord bot application setup
- Firebase project configuration
- Environment variables reference
- VM deployment instructions
- Troubleshooting guide"

bd create --parent=photo-110 --title="Document web app deployment" --type=task --description="Create guide for deploying web app to Firebase Hosting.

Acceptance Criteria:
- Build process documented
- Firebase Hosting setup
- OAuth configuration steps
- Domain setup (if applicable)
- Deployment checklist"

bd create --parent=photo-110 --title="Create API documentation for Firestore schema" --type=task --description="Document Firestore collections, document schemas, and query patterns.

Acceptance Criteria:
- Collection structure documented
- Document field types and constraints
- Relationship diagrams
- Example queries
- Security rules explained"

bd create --parent=photo-110 --title="Write contribution guidelines" --type=task --description="Create CONTRIBUTING.md with guidelines for contributors.

Acceptance Criteria:
- Code style guide
- Git workflow documented
- Testing requirements
- PR process explained
- Issue templates created"

echo "All Epic 6-11 tasks created successfully!"
echo "Total task creation complete!"

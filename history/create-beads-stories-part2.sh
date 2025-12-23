#!/bin/bash
# Script to create Epic 3-11 beads stories
# Run from project root

set -e

echo "Creating Epic 3 (Discord Bot Core) tasks..."

# Epic 3 Research Spikes
bd create --parent=photo-0fc --title="Research Discord.js v14 slash command patterns" --type=task --description="Research Discord.js v14 slash command registration, command builders, and interaction handling patterns.

Acceptance Criteria:
- Document slash command registration (global vs guild)
- Research command builder patterns
- Identify interaction reply best practices
- Document command deployment strategies"

bd create --parent=photo-0fc --title="Research Discord modal forms and validation" --type=task --description="Research Discord modal creation, field types, validation, and submission handling.

Acceptance Criteria:
- Document modal component types and limits
- Research client-side vs server-side validation
- Identify error handling patterns
- Document modal submission workflows"

bd create --parent=photo-0fc --title="Research Discord rate limiting and best practices" --type=task --description="Research Discord API rate limits, backoff strategies, and best practices for bot stability.

Acceptance Criteria:
- Document Discord API rate limits
- Research exponential backoff patterns
- Identify queue management strategies
- Document error recovery approaches"

# Epic 3 Implementation Tasks
bd create --parent=photo-0fc --title="Set up Discord bot client and event handlers" --type=task --description="Initialize Discord.js client with required intents and set up core event handlers (ready, interactionCreate).

Acceptance Criteria:
- Discord client initialized with MESSAGE_CONTENT and GUILDS intents
- ready event handler logs successful connection
- interactionCreate event handler routes to command handlers
- Graceful shutdown handling implemented
- Bot successfully connects to Discord"

bd create --parent=photo-0fc --title="Implement slash command registry" --type=task --description="Create command registry system for managing slash commands and their deployment.

Acceptance Criteria:
- Command registry class implemented
- Commands auto-discovered from commands/ directory
- Deploy script for registering commands with Discord
- Support for both global and guild-specific commands
- Command help/documentation auto-generated"

bd create --parent=photo-0fc --title="Create command handler framework" --type=task --description="Build framework for handling slash command execution with validation and error handling.

Acceptance Criteria:
- Command interface defined (execute, data, permissions)
- Command validation before execution
- Permission checking (admin vs user commands)
- Consistent response formatting
- Example command implemented as template"

bd create --parent=photo-0fc --title="Implement error handling and logging" --type=task --description="Set up centralized error handling, logging system with Winston, and Discord error reporting.

Acceptance Criteria:
- Winston logger configured with log levels
- Error handling middleware for commands
- Discord errors reported to error channel
- Log rotation configured
- Critical errors trigger alerts"

bd create --parent=photo-0fc --title="Set up bot deployment to VM" --type=task --description="Create deployment scripts and systemd service for running bot on VM with auto-restart.

Acceptance Criteria:
- Deployment script for VM setup
- systemd service file for auto-start
- Restart on failure configured
- Deployment documentation
- Health check endpoint (optional)"

echo "Creating Epic 4 (Contest Creation & Management) tasks..."

bd create --parent=photo-02d --title="Implement /contest create slash command" --type=task --description="Create /contest create command that opens modal for contest creation.

Acceptance Criteria:
- Command registered with Discord
- Command restricted to admin/moderator roles
- Opens modal on execution
- Error handling for permission denied
- Command appears in Discord UI"

bd create --parent=photo-02d --title="Build contest creation modal with validation" --type=task --description="Implement modal form for contest parameters with client and server validation.

Acceptance Criteria:
- All required fields present (title, description, deadlines, limits, winners)
- Date validation (voting after submission deadline)
- Number validation (within acceptable ranges)
- Field length validation
- User-friendly error messages"

bd create --parent=photo-02d --title="Implement channel creation and permission setup" --type=task --description="Create contest channel with normalized name and configure bot permissions.

Acceptance Criteria:
- Channel name normalized (lowercase, hyphens, no spaces)
- Bot has MANAGE_MESSAGES, SEND_MESSAGES permissions
- Channel created in appropriate category (optional)
- Duplicate name handling
- Channel settings saved to contest record"

bd create --parent=photo-02d --title="Create contest welcome message with dynamic content" --type=task --description="Generate and post welcome message with contest details and live submission count.

Acceptance Criteria:
- Message includes title, description, deadlines
- Submission count displayed and updated
- Instructions for submitting
- Message ID saved for future updates
- Message formatted with embeds"

bd create --parent=photo-02d --title="Implement contest state transitions" --type=task --description="Build state machine for contest lifecycle (Created → Submission → Voting → Results).

Acceptance Criteria:
- State enum defined (Created, Submission, Voting, Results, Cancelled)
- Transition validation (only valid state changes allowed)
- State change events trigger appropriate actions
- State persisted to Firestore
- State history tracked (optional)"

bd create --parent=photo-02d --title="Implement /contest close early closing command" --type=task --description="Create admin command to manually close submission or voting periods early.

Acceptance Criteria:
- Command restricted to admins
- Confirms action before proceeding
- Cancels scheduled transitions
- Triggers immediate state  transition
- Notifies channel of early close"

bd create --parent=photo-02d --title="Implement /contest cancel and /contest resume commands" --type=task --description="Create commands for cancelling and resuming contests.

Acceptance Criteria:
- /contest cancel stops monitoring, keeps data
- /contest resume reactivates monitoring
- Cancel preserves all submissions
- Resume validates contest can continue
- Both commands admin-only"

bd create --parent=photo-02d --title="Create contest scheduler for deadline triggers" --type=task --description="Implement scheduler that triggers contest state transitions at configured deadlines.

Acceptance Criteria:
- Scheduler checks deadlines every minute
- Triggers submission→voting transition
- Triggers voting→results transition
- Handles timezone conversion correctly
- Scheduler resilient to restarts"

echo "Creating Epic 5 (Submission System) tasks..."

# Epic 5 Research Spikes
bd create --parent=photo-7ht --title="Research Discord message attachment handling" --type=task --description="Research Discord attachment objects, download URLs, size limits, and supported image formats.

Acceptance Criteria:
- Document attachment object structure
- Identify supported image formats (jpg, png, gif, webp)
- Research file size limits
- Document attachment URL expiration"

bd create --parent=photo-7ht --title="Research Firebase Storage upload patterns and optimization" --type=task --description="Research Firebase Storage upload strategies, signed URLs, and optimization techniques.

Acceptance Criteria:
- Document upload methods (admin SDK vs client)
- Research resumable uploads
- Identify metadata strategies
- Document access control patterns"

bd create --parent=photo-7ht --title="Research image resizing/compression for Firebase free tier" --type=task --description="Research Sharp library for image optimization to minimize storage usage.

Acceptance Criteria:
- Document Sharp installation and usage
- Research optimal compression settings
- Calculate compression ratios
- Verify quality vs size tradeoffs"

# Epic 5 Implementation Tasks
bd create --parent=photo-7ht --title="Implement message watcher for contest channels" --type=task --description="Create message event handler that watches contest channels for new submissions.

Acceptance Criteria:
- Watches only active contest channels
- Filters for messages with image attachments
- Ignores bot messages
- Handles multiple attachments
- Rate limit aware"

bd create --parent=photo-7ht --title="Build image capture and validation logic" --type=task --description="Validate image attachments, check file types, sizes, and submission limits.

Acceptance Criteria:
- Validates image format (jpg, png, gif, webp)
- Checks file size limits
- Validates user submission count
- Checks contest is in submission phase
- Returns clear validation errors"

bd create --parent=photo-7ht --title="Implement Firebase Storage upload with compression" --type=task --description="Download Discord attachment, resize/compress with Sharp, upload to Firebase Storage.

Acceptance Criteria:
- Images resized to max 1920x1920
- Compression applied (quality 85%)
- Uploaded to Firebase Storage
- Storage path follows convention
- Upload failures handled gracefully"

bd create --parent=photo-7ht --title="Create submission record in Firestore" --type=task --description="Store submission metadata in Firestore with user ID, image URLs, and timestamp.

Acceptance Criteria:
- Document created in submissions collection
- All required fields populated
- Contest ID foreign key set
- User ID recorded
- Timestamp auto-generated"

bd create --parent=photo-7ht --title="Implement message deletion after capture" --type=task --description="Delete user's submission message after successfully capturing the image.

Acceptance Criteria:
- Message deleted only after successful storage
- Permission errors handled
- Deletion failures logged
- User notified if deletion fails"

bd create --parent=photo-7ht --title="Build user feedback system (DMs with confirmation)" --type=task --description="Send DM to user confirming submission with count and management link.

Acceptance Criteria:
- DM sent after successful submission
- Shows submission number (X of Y)
- Includes web app management link
- Handles users with DMs disabled
- Styled with embeds"

bd create --parent=photo-7ht --title="Implement submission limit tracking and enforcement" --type=task --description="Track user submission count and enforce max submissions per user.

Acceptance Criteria:
- Query counts user's submissions for contest
- Blocks submission if at limit
- Returns clear error message
- Offers management link when at limit
- Count updates in real-time"

bd create --parent=photo-7ht --title="Update welcome message submission count" --type=task --description="Update contest welcome message with current submission count after each submission.

Acceptance Criteria:
- Welcome message edited with new count
- Count displays total submissions (not per-user)
- Updates happen asynchronously
- Rate limited to avoid Discord limits
- Handles message deleted scenarios"

bd create --parent=photo-7ht --title="Implement submission editing functionality" --type=task --description="Allow users to edit submission caption and replace image via web app.

Acceptance Criteria:
- Caption can be updated
- Image can be replaced (old one deleted from Storage)
- Edit timestamp tracked
- Validation applied to edits
- Changes reflected immediately"

echo "Epic 3-5 tasks created successfully!"

# Agent Instructions for USS Enterprise Photo Contest Bot
**Read Me First:** All agent-facing instructions live in this file. Always review `AGENTS.md` before or along with any other guidance documents.

## Quick Start

```bash
bd prime              # Load workflow context
bd ready              # Find available work
bd show <id>          # Inspect the active bead
```

## Project Overview

**USS Enterprise Photo Contest Bot** is a Discord bot paired with a lightweight web app for managing photo contests. The bot accepts photo submissions from members, manages voting periods, displays photos anonymously during voting, and announces winners.

**Tech Stack:**

- Discord.js for the bot
- Firebase (Firestore + Storage + Hosting) - targeting free tier
- Node.js/TypeScript runtime
- Static web app for extended functionality

## Beads Usage (CRITICAL)

This project uses **beads** (`bd` command) for ALL task tracking.

### Before Starting Work

```bash
bd prime              # Load context from beads workflow
bd ready              # Show issues ready to work on
```

### Creating Issues

```bash
bd create --title="Title" --type=task|bug|feature
bd create --title="Subtask" --parent <epic-id>
```

### Working on Issues

```bash
bd update <id> --status in_progress   # Claim task
bd close <id> --reason "Done"         # Complete task
```

### Session End Protocol

```bash
git status                   # Check changes
git add <files>              # Stage changes
git commit -m "..."          # Commit changes
```

### CRITICAL RULES

- ✅ Use bd for ALL task tracking
- ✅ Check `bd ready` before asking "what should I work on?"
- ✅ Store AI planning docs in `history/` directory
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT duplicate tracking systems
- 🔧 Never wave off "pre-existing" failures. If it's a quick fix, do it immediately. Otherwise log a beads bug with clear reproduction steps so it can be picked up promptly.

## Key Documentation

| Document     | Location               | Purpose                                 |
| ------------ | ---------------------- | --------------------------------------- |
| PRD          | `docs/PRD.md`          | Product requirements and specifications |
| Architecture | `docs/ARCHITECTURE.md` | System design and diagrams              |

## Firebase Free Tier Limits (IMPORTANT)

Be mindful of these constraints when implementing:

### Firestore

- 1 GiB stored data
- 50,000 reads/day
- 20,000 writes/day
- 20,000 deletes/day
- 10 GiB egress/month

### Cloud Storage

- 1 GiB stored data
- 10 GB downloads/month

### Hosting

- 10 GB stored
- 10 GB transfer/month

## Project Structure

```
uss-enterprise-photo-contest-bot/
├── .beads/                 # Beads issue tracking
├── .github/                # GitHub integrations
│   └── copilot-instructions.md
├── .agent/                 # Agent workflows

## Quality Expectations

- Never dismiss issues as "pre-existing." If the fix is small, ship it immediately. Otherwise, open a beads bug with clear repro steps.
- Keep planning notes in `history/` and ensure they reflect the current bead in progress.
│   └── workflows/
├── docs/                   # Documentation
│   └── PRD.md
├── history/                # AI planning documents (ephemeral)
├── bot/                    # Discord bot source
├── web/                    # Web app source
├── functions/              # Firebase Cloud Functions (if needed)
| Beads Log    | `.beads/issues.jsonl`  | Source of truth for task tracking       |

## Discord Platform Constraints

- Guild setup requires channel creation permissions for the bot when provisioning contest artifacts.
- The bot must request the Message Content intent to watch submission channels reliably.
- Discord modals allow at most five fields and 4000 total characters—design commands/modals accordingly.
└── firebase/               # Firebase configuration
```

## Contest Lifecycle

1. **Creation** - Admin creates contest via slash command
2. **Submission Period** - Users submit photos to dedicated channel
3. **Voting Period** - Photos displayed anonymously, users vote
4. **Results** - Winners announced with attribution

## Development Guidelines

- Keep components loosely coupled
- Design for Firebase free tier limits
- Implement proper error handling
- Log important events for debugging
- Test with mock Discord events before deploying

## Development Workflow

**IMPORTANT**: Keep a summary of what we recently accomplished, we're working on, and what the next steps will be in a task-summy document located in `docs/tasks/<id>-summary.md`.  This document will be used to refresh context should we need it (either due to a compaction or starting a new session).  Keep a full plan in `docs/tasks/<id>.md` - this document should contain an always-up-to-date implementaiton plan, including steps and problem statements/prompts.  Below the plan, there should be a log of what we did in each step - the logs sections should be immutable - once we write them, we don't change them, and they should include any changes to the plan we made during that session.  This will be used both for context and history of our changes.

When picking up a beads task, first check to see if these documents exist, and read them for context.  If they do not exist, your first step should be to create and populate them, ensuring you create a implementation plan before taking any other steps.

```bash
# 1. Check for work
bd ready

# 2. Claim issue
bd update <id> --status=in_progress

# 3. Document our plan in `docs/tasks/<id>.md`

# 4. Make changes, update the plan-summary doc, test locally

# 5. update our plan document with implementation details as a seperate section - leave the plan intact.

# 6. Commit (trunk-based - direct to main)
git commit -m "type(scope): [photo-xxx] description"

# 7. Code Review - run a detailed analysis of all the code changes made since last commit.  Identify any critical bugs or logical flaws.  For critical and high bugs, immediately fix them.  For any other findings, log beads bugs, and create the context document with the findings (but not a plan).

# 8. Commit any bug fixes completed in step 7
git commit -m "type(scope): [photo-xxx] description"

# 9. Push our changes to origin
git push origin main

# 10. Close issue
bd close <id> --reason="description"

```
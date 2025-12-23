# USS Enterprise Photo Contest Bot

A Discord bot paired with a web application for managing photo contests. Automates the complete contest lifecycle: creation, submissions, anonymous voting, and winner announcements.

## Project Structure

```
uss-enterprise-photo-contest-bot/
├── bot/                    # Discord bot (Node.js + Discord.js)
│   └── src/
├── web/                    # Web app (React + Vite)
│   └── src/
├── functions/              # Firebase Cloud Functions (future)
│   └── src/
├── shared/                 # Shared TypeScript types
│   └── src/
├── docs/                   # Documentation
│   └── PRD.md             # Product Requirements Document
└── .beads/                # Issue tracking
```

## Tech Stack

- **Bot**: Discord.js v14, Firebase Admin SDK, Sharp (image optimization)
- **Web**: React 18, Vite, Firebase Client SDK
- **Database**: Firebase Firestore
- **Storage**: Firebase Cloud Storage
- **Hosting**: Firebase Hosting (web app)
- **Runtime**: Node.js 18+

## Prerequisites

- Node.js 18+ and npm 9+
- Discord bot application (see setup guide)
- Firebase project (Firestore + Storage + Hosting)
- Git

## Environment Variables

### Bot (`bot/.env`)

```env
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
```

### Web (`web/.env.local`)

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_DISCORD_CLIENT_ID=your_client_id
VITE_DISCORD_REDIRECT_URI=http://localhost:5173/auth/callback
```

## Installation

```bash
# Install all dependencies
npm install

# Install workspace dependencies
npm install --workspaces
```

## Development

```bash
# Run bot in development mode
npm run dev:bot

# Run web app in development mode
npm run dev:web

# Run both (use separate terminals)
npm run dev:bot & npm run dev:web
```

### Slash Command Management

```bash
# Generate docs/commands.md without touching Discord
npm run commands:docs

# Deploy slash commands (requires DISCORD_CLIENT_ID + DISCORD_BOT_TOKEN)
npm run commands:deploy
```

### Monitoring & Alerts

- Set `DISCORD_ERROR_CHANNEL_ID` in `bot/.env` so critical failures are mirrored to a private Discord channel.
- Adjust `LOG_LEVEL` or disable rotated file logs with `LOG_TO_FILES=false`; logs are written under `bot/logs/` by default.

## Building

```bash
# Build all workspaces
npm run build

# Build specific workspace
npm run build --workspace=bot
npm run build --workspace=web
```

## Testing

```bash
# Run all tests
npm test

# Run tests for specific workspace
npm test --workspace=bot
```

## Deployment

### Bot

Deploy to a VM or container service. See `docs/deployment/bot.md` for details (systemd service, deploy script, env setup).

### Web App

Deploy to Firebase Hosting:

```bash
cd web
npm run build
firebase deploy --only hosting
```

## Documentation

- [Product Requirements Document](docs/PRD.md)
- [Epic Breakdown](history/epic-summary.md)
- Issue tracking: Run `bd list` to see all tasks

## Contributing

This project uses [beads](https://github.com/steveyegge/beads) for issue tracking.

```bash
# See available work
bd ready

# Claim a task
bd update <task-id> --status in_progress

# Complete a task
bd close <task-id> --reason "Done"
```

## License

Private project - All rights reserved

## Firebase Free Tier Constraints

This project is designed to work within Firebase's free tier:

- Firestore: 1 GiB storage, 50K reads/day, 20K writes/day
- Cloud Storage: 1 GiB, 10 GB downloads/month
- Hosting: 10 GB storage, 10 GB transfer/month

See [PRD.md](docs/PRD.md) for optimization strategies.

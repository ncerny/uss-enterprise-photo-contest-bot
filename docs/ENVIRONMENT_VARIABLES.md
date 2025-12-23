# Environment Variables Documentation

This document describes all environment variables required for the USS Enterprise Photo Contest Bot.

## Bot Environment Variables

Create `bot/.env` with the following variables:

### Discord Configuration

- `DISCORD_BOT_TOKEN` - Bot token from Discord Developer Portal
  - Obtain from: https://discord.com/developers/applications
  - Navigate to: Your Application → Bot → Token
  - **CRITICAL**: Never commit this to version control

- `DISCORD_CLIENT_ID` - Application ID
  - Obtain from: Your Application → General Information → Application ID

- `DISCORD_CLIENT_SECRET` - OAuth2 client secret
  - Obtain from: Your Application → OAuth2 → Client Secret
  - Required for web app OAuth flow

### Firebase Configuration

- `FIREBASE_PROJECT_ID` - Your Firebase project ID
  - Format: `your-project-name`

- `FIREBASE_PRIVATE_KEY` - Service account private key
  - Obtain from: Firebase Console → Project Settings → Service Accounts → Generate New Private Key
  - **CRITICAL**: Store as single-line string with `\n` for newlines
  - Example: `"-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"`

- `FIREBASE_CLIENT_EMAIL` - Service account email
  - Format: `firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com`

### Optional

- `NODE_ENV` - Environment (development/production)
  - Default: `development`
- `DISCORD_ERROR_CHANNEL_ID` - Channel ID where critical bot errors are posted
  - Configure by creating a private channel and copying its ID
- `LOG_LEVEL` - Winston logger level (e.g., `info`, `debug`, `warn`)
  - Default: `info`
- `LOG_TO_FILES` - Set to `false` to disable rotated log files on disk
  - Default: `true`
## Web App Environment Variables

Create `web/.env.local` with the following variables:

### Firebase Client SDK

- `VITE_FIREBASE_API_KEY` - Web API key
  - Obtain from: Firebase Console → Project Settings → General → Web API Key

- `VITE_FIREBASE_AUTH_DOMAIN` - Auth domain
  - Format: `your-project.firebaseapp.com`

- `VITE_FIREBASE_PROJECT_ID` - Project ID (same as bot)

- `VITE_FIREBASE_STORAGE_BUCKET` - Storage bucket
  - Format: `your-project.appspot.com`

- `VITE_FIREBASE_MESSAGING_SENDER_ID` - Messaging sender ID

- `VITE_FIREBASE_APP_ID` - Firebase app ID

### Discord OAuth2

- `VITE_DISCORD_CLIENT_ID` - Same as bot's client ID

- `VITE_DISCORD_REDIRECT_URI` - OAuth2 callback URL
  - Development: `http://localhost:5173/auth/callback`
  - Production: `https://your-domain.com/auth/callback`

## GitHub Secrets (for CI/CD)

Configure these in GitHub repository settings → Secrets and variables → Actions:

### Firebase Deployment

- `FIREBASE_SERVICE_ACCOUNT` - Service account JSON (entire file content)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_DISCORD_CLIENT_ID`
- `VITE_DISCORD_REDIRECT_URI` (production URL)

## Security Best Practices

1. **Never commit** `.env` files to version control
2. **Use `.env.example`** templates for documentation
3. **Rotate secrets** regularly
4. **Limit permissions** on service accounts to minimum required
5. **Use different credentials** for development and production
6. **Store production secrets** in secure secret management (GitHub Secrets, etc.)

## Setup Checklist

- [ ] Copy `.env.example` to `.env` in bot/ and web/
- [ ] Fill in all required values
- [ ] Verify `.env` is in `.gitignore`
- [ ] Configure GitHub Secrets for CI/CD
- [ ] Test bot connection with Discord
- [ ] Test web app connection with Firebase

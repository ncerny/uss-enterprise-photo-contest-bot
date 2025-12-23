# photo-3pn: Implement exchangeDiscordCode Cloud Function

## Problem Statement

The web app requires a Cloud Function to complete the Discord OAuth2 authentication flow. The client cannot directly exchange the authorization code for tokens because it requires the Discord client secret, which must be kept server-side.

## Requirements

The function needs to:
1. Receive authorization code from client
2. Exchange code for Discord access token (requires client secret)
3. Fetch user info from Discord API
4. Create Firebase custom token with Discord user ID as UID
5. Return custom token and user info to client

## Client Contract

From `web/src/services/auth.ts`:
```typescript
const exchangeDiscordCode = httpsCallable<
  { code: string; redirectUri: string },
  { customToken: string; user: DiscordUser }
>(functions, 'exchangeDiscordCode');
```

Input:
- `code`: Discord authorization code
- `redirectUri`: OAuth redirect URI for validation

Output:
- `customToken`: Firebase custom token for sign-in
- `user`: Discord user info `{ id, username, discriminator, avatar }`

## Implementation Plan

### Step 1: Set Up Cloud Functions Project
- Create `functions/package.json` with dependencies
- Create `functions/tsconfig.json` for TypeScript
- Update `firebase.json` to include functions config

### Step 2: Implement exchangeDiscordCode Function
- Create callable function with proper typing
- Validate input parameters
- Exchange code for Discord access token
- Fetch Discord user info
- Create Firebase custom token
- Return token and user data

### Step 3: Environment Configuration
- Add Discord client secret to functions config
- Document required environment variables

### Step 4: Security Considerations
- Validate redirect URI against allowlist
- Rate limit the function
- Log authentication attempts for monitoring

## Technical Design

### Discord OAuth2 Token Exchange

```
POST https://discord.com/api/oauth2/token
Content-Type: application/x-www-form-urlencoded

client_id=...
client_secret=...
grant_type=authorization_code
code=...
redirect_uri=...
```

### Discord User Info

```
GET https://discord.com/api/users/@me
Authorization: Bearer {access_token}
```

### Firebase Custom Token

```typescript
import { getAuth } from 'firebase-admin/auth';

const customToken = await getAuth().createCustomToken(discordUserId, {
  username: user.username,
  avatarUrl: avatarUrl,
});
```

## File Structure

```
functions/
├── package.json
├── tsconfig.json
├── .env.example
└── src/
    └── index.ts          # Main exports
    └── auth/
        └── exchangeDiscordCode.ts
```

## Dependencies

- firebase-functions
- firebase-admin

## Environment Variables

- `DISCORD_CLIENT_ID` - Discord application client ID
- `DISCORD_CLIENT_SECRET` - Discord application client secret
- `ALLOWED_REDIRECT_URIS` - Comma-separated list of valid redirect URIs

---

## Implementation Log

### Session 1 - 2025-12-23

**Status**: Complete

**Context**: This function is required to unblock photo-7ht.12 (submission editing). The web app authentication flow is ready but cannot complete without this server-side component.

**Work completed**:

1. **Set up Cloud Functions project structure**
   - Created `functions/package.json` with firebase-admin and firebase-functions dependencies
   - Created `functions/tsconfig.json` targeting ES2022 for Node.js 20
   - Updated `firebase.json` with functions configuration
   - Created `functions/.env.example` documenting required environment variables

2. **Implemented exchangeDiscordCode callable function**
   - Created `functions/src/index.ts` with Firebase Admin SDK initialization
   - Created `functions/src/auth/exchangeDiscordCode.ts` with full OAuth flow

3. **Code review identified security issues, all fixed**:
   - **Redirect URI validation**: Changed from string comparison to URL-based comparison (origin + pathname)
   - **Input validation**: Added length checks for authorization code (20-128 chars)
   - **Request timeouts**: Added `fetchWithTimeout()` using AbortController (10s timeout)
   - **Token type validation**: Added check for bearer token type
   - **Bot account detection**: Added check for bot/system user flags
   - **Error logging**: Truncated error messages to 100 chars to prevent sensitive data leakage
   - **User-Agent header**: Added to Discord API requests

4. **Build verified**: `npm run build` passes with no errors

**Files created**:
- `functions/package.json`
- `functions/tsconfig.json`
- `functions/.env.example`
- `functions/src/index.ts`
- `functions/src/auth/exchangeDiscordCode.ts`

**Files modified**:
- `firebase.json` - Added functions configuration


import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { defineString, defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';

// Define parameters - these read from functions/.env file
const discordClientId = defineString('DISCORD_CLIENT_ID');
const allowedRedirectUris = defineString('ALLOWED_REDIRECT_URIS');

// Secret - stored in Google Cloud Secret Manager
const discordClientSecret = defineSecret('DISCORD_CLIENT_SECRET');

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCORD_TOKEN_URL = `${DISCORD_API_BASE}/oauth2/token`;
const DISCORD_USER_URL = `${DISCORD_API_BASE}/users/@me`;

// Timeout for external API calls (10 seconds)
const API_TIMEOUT_MS = 10000;

// Discord authorization codes are typically 30 characters
const MIN_CODE_LENGTH = 20;
const MAX_CODE_LENGTH = 128;

interface ExchangeCodeRequest {
  code: string;
  redirectUri: string;
}

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  global_name?: string | null;
  bot?: boolean;
  system?: boolean;
}

interface ExchangeCodeResponse {
  customToken: string;
  user: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
  };
}

function getDiscordAvatarUrl(userId: string, avatarHash: string | null): string {
  if (avatarHash) {
    // Support animated avatars for Nitro users
    const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}`;
  }
  // Discord uses new default avatar system based on user ID
  try {
    const defaultAvatarNumber = Number(BigInt(userId) >> 22n) % 6;
    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
  } catch {
    // Fallback for invalid user IDs
    return `https://cdn.discordapp.com/embed/avatars/0.png`;
  }
}

/**
 * Validates redirect URI against allowlist using URL-based comparison.
 * Compares origin and pathname, ignoring case differences.
 */
function isValidRedirectUri(uri: string): boolean {
  try {
    const redirectUrl = new URL(uri);

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(redirectUrl.protocol)) {
      return false;
    }

    const allowedRaw = allowedRedirectUris.value();
    logger.info('Redirect URI validation', {
      received: uri,
      allowedRaw,
    });

    const allowed = allowedRaw
      .split(',')
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    return allowed.some((allowedUri) => {
      try {
        const allowedUrl = new URL(allowedUri);
        // Compare origin and pathname (case-insensitive)
        return (
          redirectUrl.origin.toLowerCase() === allowedUrl.origin.toLowerCase() &&
          redirectUrl.pathname.toLowerCase() === allowedUrl.pathname.toLowerCase()
        );
      } catch {
        logger.warn('Invalid URI in allowlist', { allowedUri });
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * Creates a fetch request with timeout.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HttpsError('deadline-exceeded', 'Discord API request timed out');
    }
    throw error;
  }
}

async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<DiscordTokenResponse> {
  const params = new URLSearchParams({
    client_id: discordClientId.value(),
    client_secret: discordClientSecret.value(),
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetchWithTimeout(
    DISCORD_TOKEN_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'USS-Enterprise-Photo-Contest/0.1.0',
      },
      body: params.toString(),
    },
    API_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Discord token exchange failed', {
      status: response.status,
      // Truncate error to avoid logging sensitive data
      errorSummary: errorText.substring(0, 100),
    });
    throw new HttpsError(
      'unauthenticated',
      'Failed to exchange authorization code'
    );
  }

  const tokenResponse = (await response.json()) as DiscordTokenResponse;

  // Validate token type
  if (tokenResponse.token_type.toLowerCase() !== 'bearer') {
    logger.error('Unexpected token type from Discord', {
      tokenType: tokenResponse.token_type,
    });
    throw new HttpsError('internal', 'Invalid token type received');
  }

  return tokenResponse;
}

async function getDiscordUser(accessToken: string): Promise<DiscordUser> {
  const response = await fetchWithTimeout(
    DISCORD_USER_URL,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'USS-Enterprise-Photo-Contest/0.1.0',
      },
    },
    API_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Discord user fetch failed', {
      status: response.status,
      errorSummary: errorText.substring(0, 100),
    });
    throw new HttpsError('unauthenticated', 'Failed to fetch Discord user info');
  }

  return response.json() as Promise<DiscordUser>;
}

export const exchangeDiscordCode = onCall<
  ExchangeCodeRequest,
  Promise<ExchangeCodeResponse>
>(
  {
    // Allow unauthenticated calls since this is for initial login
    cors: true,
    maxInstances: 10,
    // Memory and timeout settings
    memory: '256MiB',
    timeoutSeconds: 30,
    // Make secret available at runtime
    secrets: [discordClientSecret],
  },
  async (request) => {
    const { code, redirectUri } = request.data;

    // Validate code input
    if (!code || typeof code !== 'string') {
      throw new HttpsError('invalid-argument', 'Missing or invalid code');
    }

    if (code.length < MIN_CODE_LENGTH || code.length > MAX_CODE_LENGTH) {
      throw new HttpsError('invalid-argument', 'Invalid authorization code format');
    }

    // Validate redirect URI input
    if (!redirectUri || typeof redirectUri !== 'string') {
      throw new HttpsError('invalid-argument', 'Missing or invalid redirectUri');
    }

    // Validate redirect URI format and against allowlist
    if (!isValidRedirectUri(redirectUri)) {
      logger.warn('Invalid redirect URI attempted', {
        redirectUri: redirectUri.substring(0, 100),
      });
      throw new HttpsError('invalid-argument', 'Invalid redirect URI');
    }

    logger.info('Processing Discord OAuth exchange', {
      redirectUri,
      codeLength: code.length,
      timestamp: new Date().toISOString(),
    });

    try {
      // Exchange code for Discord access token
      const tokenResponse = await exchangeCodeForToken(code, redirectUri);

      // Fetch Discord user info
      const discordUser = await getDiscordUser(tokenResponse.access_token);

      // Prevent bot accounts from authenticating
      if (discordUser.bot || discordUser.system) {
        logger.warn('Bot or system account attempted authentication', {
          userId: discordUser.id,
        });
        throw new HttpsError('permission-denied', 'Bot accounts cannot authenticate');
      }

      logger.info('Discord user authenticated', {
        userId: discordUser.id,
        username: discordUser.username,
      });

      // Create Firebase custom token with Discord user ID as UID
      // Include custom claims for user info
      const customToken = await getAuth().createCustomToken(discordUser.id, {
        username: discordUser.username,
        avatarUrl: getDiscordAvatarUrl(discordUser.id, discordUser.avatar),
      });

      return {
        customToken,
        user: {
          id: discordUser.id,
          username: discordUser.global_name || discordUser.username,
          discriminator: discordUser.discriminator,
          avatar: discordUser.avatar,
        },
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error('Unexpected error during Discord OAuth', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new HttpsError('internal', 'Authentication failed');
    }
  }
);

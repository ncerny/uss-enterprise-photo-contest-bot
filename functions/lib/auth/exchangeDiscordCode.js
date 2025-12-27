"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exchangeDiscordCode = void 0;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("firebase-admin/auth");
const params_1 = require("firebase-functions/params");
const v2_1 = require("firebase-functions/v2");
// Define parameters - these read from functions/.env file
const discordClientId = (0, params_1.defineString)('DISCORD_CLIENT_ID');
const allowedRedirectUris = (0, params_1.defineString)('ALLOWED_REDIRECT_URIS');
// Secret - stored in Google Cloud Secret Manager
const discordClientSecret = (0, params_1.defineSecret)('DISCORD_CLIENT_SECRET');
const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCORD_TOKEN_URL = `${DISCORD_API_BASE}/oauth2/token`;
const DISCORD_USER_URL = `${DISCORD_API_BASE}/users/@me`;
// Timeout for external API calls (10 seconds)
const API_TIMEOUT_MS = 10000;
// Discord authorization codes are typically 30 characters
const MIN_CODE_LENGTH = 20;
const MAX_CODE_LENGTH = 128;
function getDiscordAvatarUrl(userId, avatarHash) {
    if (avatarHash) {
        // Support animated avatars for Nitro users
        const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
        return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}`;
    }
    // Discord uses new default avatar system based on user ID
    try {
        const defaultAvatarNumber = Number(BigInt(userId) >> 22n) % 6;
        return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
    }
    catch {
        // Fallback for invalid user IDs
        return `https://cdn.discordapp.com/embed/avatars/0.png`;
    }
}
/**
 * Validates redirect URI against allowlist using URL-based comparison.
 * Compares origin and pathname, ignoring case differences.
 */
function isValidRedirectUri(uri) {
    try {
        const redirectUrl = new URL(uri);
        // Only allow http/https protocols
        if (!['http:', 'https:'].includes(redirectUrl.protocol)) {
            return false;
        }
        const allowedRaw = allowedRedirectUris.value();
        v2_1.logger.info('Redirect URI validation', {
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
                return (redirectUrl.origin.toLowerCase() === allowedUrl.origin.toLowerCase() &&
                    redirectUrl.pathname.toLowerCase() === allowedUrl.pathname.toLowerCase());
            }
            catch {
                v2_1.logger.warn('Invalid URI in allowlist', { allowedUri });
                return false;
            }
        });
    }
    catch {
        return false;
    }
}
/**
 * Creates a fetch request with timeout.
 */
async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    }
    catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new https_1.HttpsError('deadline-exceeded', 'Discord API request timed out');
        }
        throw error;
    }
}
async function exchangeCodeForToken(code, redirectUri) {
    const params = new URLSearchParams({
        client_id: discordClientId.value(),
        client_secret: discordClientSecret.value(),
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
    });
    const response = await fetchWithTimeout(DISCORD_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'USS-Enterprise-Photo-Contest/0.1.0',
        },
        body: params.toString(),
    }, API_TIMEOUT_MS);
    if (!response.ok) {
        const errorText = await response.text();
        v2_1.logger.error('Discord token exchange failed', {
            status: response.status,
            // Truncate error to avoid logging sensitive data
            errorSummary: errorText.substring(0, 100),
        });
        throw new https_1.HttpsError('unauthenticated', 'Failed to exchange authorization code');
    }
    const tokenResponse = (await response.json());
    // Validate token type
    if (tokenResponse.token_type.toLowerCase() !== 'bearer') {
        v2_1.logger.error('Unexpected token type from Discord', {
            tokenType: tokenResponse.token_type,
        });
        throw new https_1.HttpsError('internal', 'Invalid token type received');
    }
    return tokenResponse;
}
async function getDiscordUser(accessToken) {
    const response = await fetchWithTimeout(DISCORD_USER_URL, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'USS-Enterprise-Photo-Contest/0.1.0',
        },
    }, API_TIMEOUT_MS);
    if (!response.ok) {
        const errorText = await response.text();
        v2_1.logger.error('Discord user fetch failed', {
            status: response.status,
            errorSummary: errorText.substring(0, 100),
        });
        throw new https_1.HttpsError('unauthenticated', 'Failed to fetch Discord user info');
    }
    return response.json();
}
exports.exchangeDiscordCode = (0, https_1.onCall)({
    // Allow unauthenticated calls since this is for initial login
    cors: true,
    maxInstances: 10,
    // Memory and timeout settings
    memory: '256MiB',
    timeoutSeconds: 30,
    // Make secret available at runtime
    secrets: [discordClientSecret],
}, async (request) => {
    const { code, redirectUri } = request.data;
    // Validate code input
    if (!code || typeof code !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Missing or invalid code');
    }
    if (code.length < MIN_CODE_LENGTH || code.length > MAX_CODE_LENGTH) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid authorization code format');
    }
    // Validate redirect URI input
    if (!redirectUri || typeof redirectUri !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Missing or invalid redirectUri');
    }
    // Validate redirect URI format and against allowlist
    if (!isValidRedirectUri(redirectUri)) {
        v2_1.logger.warn('Invalid redirect URI attempted', {
            redirectUri: redirectUri.substring(0, 100),
        });
        throw new https_1.HttpsError('invalid-argument', 'Invalid redirect URI');
    }
    v2_1.logger.info('Processing Discord OAuth exchange', {
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
            v2_1.logger.warn('Bot or system account attempted authentication', {
                userId: discordUser.id,
            });
            throw new https_1.HttpsError('permission-denied', 'Bot accounts cannot authenticate');
        }
        v2_1.logger.info('Discord user authenticated', {
            userId: discordUser.id,
            username: discordUser.username,
        });
        // Create Firebase custom token with Discord user ID as UID
        // Include custom claims for user info
        const customToken = await (0, auth_1.getAuth)().createCustomToken(discordUser.id, {
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
    }
    catch (error) {
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        v2_1.logger.error('Unexpected error during Discord OAuth', {
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new https_1.HttpsError('internal', 'Authentication failed');
    }
});
//# sourceMappingURL=exchangeDiscordCode.js.map
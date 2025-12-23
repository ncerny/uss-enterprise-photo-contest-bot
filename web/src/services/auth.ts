import { signInWithCustomToken, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import { auth, app } from '../config/firebase';

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

export interface AuthUser {
  uid: string;
  discordId: string;
  username: string;
  avatarUrl: string;
}

const DISCORD_OAUTH_URL = 'https://discord.com/api/oauth2/authorize';
const DISCORD_SCOPES = ['identify'].join(' ');

function getDiscordAvatarUrl(userId: string, avatarHash: string | null): string {
  if (avatarHash) {
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png`;
  }
  // Default Discord avatar
  const defaultAvatarNumber = parseInt(userId) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
}

export function getDiscordOAuthUrl(): string {
  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error('Discord OAuth configuration missing');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DISCORD_SCOPES,
  });

  return `${DISCORD_OAUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<AuthUser> {
  const functions = getFunctions(app);
  const exchangeDiscordCode = httpsCallable<
    { code: string; redirectUri: string },
    { customToken: string; user: DiscordUser }
  >(functions, 'exchangeDiscordCode');

  const result = await exchangeDiscordCode({
    code,
    redirectUri: import.meta.env.VITE_DISCORD_REDIRECT_URI,
  });

  const { customToken, user } = result.data;

  // Sign in with the custom token
  await signInWithCustomToken(auth, customToken);

  return {
    uid: user.id,
    discordId: user.id,
    username: user.username,
    avatarUrl: getDiscordAvatarUrl(user.id, user.avatar),
  };
}

export function logout(): Promise<void> {
  return signOut(auth);
}

export function subscribeToAuthState(
  callback: (user: AuthUser | null) => void
): () => void {
  return onAuthStateChanged(auth, async (firebaseUser: User | null) => {
    if (firebaseUser) {
      // Get user info from custom claims or token
      const idTokenResult = await firebaseUser.getIdTokenResult();
      const claims = idTokenResult.claims;

      callback({
        uid: firebaseUser.uid,
        discordId: firebaseUser.uid, // UID is Discord ID
        username: (claims.username as string) || 'User',
        avatarUrl:
          (claims.avatarUrl as string) ||
          getDiscordAvatarUrl(firebaseUser.uid, null),
      });
    } else {
      callback(null);
    }
  });
}

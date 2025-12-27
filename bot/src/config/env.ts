import dotenv from 'dotenv';

dotenv.config();

const REQUIRED_KEYS = [
  'DISCORD_BOT_TOKEN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
] as const;

type RequiredKey = (typeof REQUIRED_KEYS)[number];

type EnvConfig = Record<RequiredKey, string> & {
  NODE_ENV: string;
  LOG_LEVEL: string;
  FIREBASE_STORAGE_BUCKET: string;
  DISCORD_ERROR_CHANNEL_ID?: string;
  WEB_APP_URL?: string;
};

function requireEnv(key: RequiredKey): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

const FIREBASE_PROJECT_ID = requireEnv('FIREBASE_PROJECT_ID');

export const env: EnvConfig = {
  DISCORD_BOT_TOKEN: requireEnv('DISCORD_BOT_TOKEN'),
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL: requireEnv('FIREBASE_CLIENT_EMAIL'),
  FIREBASE_PRIVATE_KEY: requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  FIREBASE_STORAGE_BUCKET:
    process.env.FIREBASE_STORAGE_BUCKET ?? `${FIREBASE_PROJECT_ID}.appspot.com`,
  DISCORD_ERROR_CHANNEL_ID: process.env.DISCORD_ERROR_CHANNEL_ID,
  WEB_APP_URL: process.env.WEB_APP_URL,
};

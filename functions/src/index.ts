import { initializeApp, getApps } from 'firebase-admin/app';

// Initialize Firebase Admin SDK
if (getApps().length === 0) {
  initializeApp();
}

// Export Cloud Functions
export { exchangeDiscordCode } from './auth/exchangeDiscordCode';

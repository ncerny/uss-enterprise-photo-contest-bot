import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { Bucket, getStorage } from 'firebase-admin/storage';
import { env } from './env';

let firestoreInstance: Firestore | null = null;
let storageBucket: Bucket | null = null;

function ensureFirebaseApp(): void {
  if (getApps().length > 0) {
    return;
  }

  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY,
    }),
  });
}

export function getFirestoreClient(): Firestore {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  ensureFirebaseApp();
  firestoreInstance = getFirestore();
  firestoreInstance.settings({ ignoreUndefinedProperties: true });
  return firestoreInstance;
}

export function getStorageBucket(): Bucket {
  if (storageBucket) {
    return storageBucket;
  }

  ensureFirebaseApp();
  storageBucket = getStorage().bucket(env.FIREBASE_STORAGE_BUCKET);
  return storageBucket;
}

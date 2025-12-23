#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires, no-console */
const path = require('path');
const dotenv = require('dotenv');
const admin = require('firebase-admin');

const COLLECTIONS = {
  CONTESTS: 'contests',
  SUBMISSIONS: 'submissions',
  VOTES: 'votes',
};

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function getCredential() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.credential.applicationDefault();
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  if (!privateKey || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PROJECT_ID) {
    throw new Error('Missing Firebase service account credentials in environment.');
  }

  return admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  });
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: getCredential(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const firestore = admin.firestore();

async function seed() {
  const contestId = `dev-contest-${Date.now()}`;
  const submissionDeadline = new Date(Date.now() + 1000 * 60 * 60 * 24);
  const votingDeadline = new Date(Date.now() + 1000 * 60 * 60 * 48);

  await firestore.collection(COLLECTIONS.CONTESTS).doc(contestId).set({
    title: 'Holodeck Photography Jam',
    description: 'Share your best shots from across the quadrant.',
    channelId: 'dev-channel',
    guildId: 'dev-guild',
    submissionDeadline,
    votingDeadline,
    maxSubmissionsPerUser: 3,
    maxVotesPerUser: 5,
    numberOfWinners: 3,
    status: 'submission',
    createdAt: new Date(),
    createdBy: 'dev-user',
    submissionCount: 0,
  });

  const submissions = [
    {
      userId: 'user-1',
      caption: 'Sunrise over Vulcan',
    },
    {
      userId: 'user-2',
      caption: 'Nebula reflections',
    },
    {
      userId: 'user-3',
      caption: 'Warp trails',
    },
  ];

  const submissionIds = [];
  for (const [index, submission] of submissions.entries()) {
    const docRef = await firestore.collection(COLLECTIONS.SUBMISSIONS).add({
      contestId,
      userId: submission.userId,
      imageUrls: [`https://example.com/image-${index + 1}.jpg`],
      caption: submission.caption,
      displayOrder: index + 1,
      createdAt: new Date(),
    });
    submissionIds.push(docRef.id);
  }

  for (const submissionId of submissionIds) {
    await firestore.collection(COLLECTIONS.VOTES).add({
      contestId,
      submissionId,
      voterId: 'user-99',
      createdAt: new Date(),
    });
  }

  await firestore.collection(COLLECTIONS.CONTESTS).doc(contestId).update({
    submissionCount: submissionIds.length,
  });

  console.log(`Seeded contest ${contestId} with ${submissionIds.length} submissions.`);
}

seed()
  .then(() => {
    console.log('Dev seed complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

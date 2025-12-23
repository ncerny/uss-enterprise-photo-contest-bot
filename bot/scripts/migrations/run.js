#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires, no-console */
const path = require('path');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const migrations = require('./migration-list');

const args = process.argv.slice(2);
const command = args[0];
const targetId = args[1];

if (!command) {
  console.error('Usage: node run.js <up|down|status> [migrationId]');
  process.exit(1);
}

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
const migrationsCollection = firestore.collection('__migrations');
const logger = console;
const context = {
  firestore,
  admin,
  FieldValue: admin.firestore.FieldValue,
  logger,
};

async function getAppliedMigrations() {
  const snapshot = await migrationsCollection.orderBy('id').get();
  return snapshot.docs.map((doc) => doc.id);
}

async function markApplied(id, name) {
  await migrationsCollection.doc(id).set({
    name,
    appliedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function unmarkApplied(id) {
  await migrationsCollection.doc(id).delete();
}

async function runUp() {
  const appliedIds = new Set(await getAppliedMigrations());
  const targetMigrations = targetId
    ? migrations.filter((migration) => migration.id === targetId)
    : migrations.filter((migration) => !appliedIds.has(migration.id));

  if (!targetMigrations.length) {
    logger.info('No pending migrations to run.');
    return;
  }

  for (const migration of targetMigrations) {
    if (appliedIds.has(migration.id)) {
      logger.info(`Skipping ${migration.id}; already applied.`);
      continue;
    }

    logger.info(`Running migration ${migration.id} - ${migration.name}`);
    await migration.up(context);
    await markApplied(migration.id, migration.name);
    logger.info(`✔ Migration ${migration.id} complete.`);
  }
}

async function runDown() {
  const applied = await getAppliedMigrations();

  if (!applied.length) {
    logger.info('No applied migrations to roll back.');
    return;
  }

  const target = targetId || applied[applied.length - 1];
  const migration = migrations.find((m) => m.id === target);

  if (!migration) {
    throw new Error(`Migration ${target} not found.`);
  }

  if (!applied.includes(target)) {
    logger.info(`Migration ${target} has not been applied; nothing to roll back.`);
    return;
  }

  logger.info(`Rolling back migration ${migration.id} - ${migration.name}`);
  await migration.down(context);
  await unmarkApplied(migration.id);
  logger.info(`✔ Migration ${migration.id} rolled back.`);
}

async function showStatus() {
  const applied = await getAppliedMigrations();
  logger.info('Applied migrations:');
  applied.forEach((id) => logger.info(` - ${id}`));

  const pending = migrations.filter((migration) => !applied.includes(migration.id));
  logger.info('Pending migrations:');
  pending.forEach((migration) => logger.info(` - ${migration.id}`));
}

(async () => {
  if (command === 'up') {
    await runUp();
  } else if (command === 'down') {
    await runDown();
  } else if (command === 'status') {
    await showStatus();
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

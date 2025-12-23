const COLLECTIONS = {
  CONTESTS: 'contests',
  SUBMISSIONS: 'submissions',
};

module.exports = {
  id: '0001_backfill_submission_counts',
  name: 'Backfill submissionCount on contest documents',
  async up({ firestore, logger }) {
    const contestSnapshot = await firestore.collection(COLLECTIONS.CONTESTS).get();

    logger.info(`Found ${contestSnapshot.size} contest(s) to backfill.`);

    for (const contestDoc of contestSnapshot.docs) {
      const submissionsCountSnap = await firestore
        .collection(COLLECTIONS.SUBMISSIONS)
        .where('contestId', '==', contestDoc.id)
        .count()
        .get();

      const submissionCount = submissionsCountSnap.data().count;
      await contestDoc.ref.update({ submissionCount });
      logger.info(`Updated contest ${contestDoc.id} with submissionCount=${submissionCount}`);
    }
  },
  async down({ firestore, FieldValue, logger }) {
    const contestSnapshot = await firestore.collection(COLLECTIONS.CONTESTS).get();

    logger.info(`Removing submissionCount from ${contestSnapshot.size} contest(s).`);

    for (const contestDoc of contestSnapshot.docs) {
      await contestDoc.ref.update({ submissionCount: FieldValue.delete() });
      logger.info(`Removed submissionCount from contest ${contestDoc.id}`);
    }
  },
};

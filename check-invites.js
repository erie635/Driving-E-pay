const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkAllBranches() {
  const branchesSnap = await db.collection('branches').get();
  if (branchesSnap.empty) {
    console.log('No branches found.');
    return;
  }

  console.log('Branches and their invitations:\n');
  for (const branchDoc of branchesSnap.docs) {
    const branchData = branchDoc.data();
    const branchId = branchDoc.id;
    const branchName = branchData.name || 'Unnamed';

    // Find the latest invitation for this branch
    const invitationsSnap = await db.collection('invitations')
      .where('branchId', '==', branchId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    console.log(`Branch: ${branchName} (ID: ${branchId})`);
    if (!invitationsSnap.empty) {
      const inv = invitationsSnap.docs[0].data();
      const token = inv.token;
      const password = inv.password || '(no password stored)';
      const expiresAt = inv.expiresAt?.toDate?.() || 'N/A';
      const link = `http://localhost:3000/branch-access?token=${token}`;
      console.log(`  Invitation link: ${link}`);
      console.log(`  Password: ${password}`);
      console.log(`  Expires: ${expiresAt}`);
    } else {
      console.log('  No invitation found for this branch.');
    }
    console.log();
  }
}

checkAllBranches().catch(console.error);
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function showBranchLinks() {
  const branchesSnap = await db.collection('branches').get();
  if (branchesSnap.empty) {
    console.log('No branches found.');
    return;
  }

  console.log('Branch name and invitation link (if any):\n');
  for (const branchDoc of branchesSnap.docs) {
    const branchData = branchDoc.data();
    const branchName = branchData.name || 'Unnamed';
    const branchId = branchDoc.id;

    // Get all invitations for this branch (no orderBy to avoid index requirement)
    const invitationsSnap = await db.collection('invitations')
      .where('branchId', '==', branchId)
      .get();

    if (!invitationsSnap.empty) {
      // Find the most recent invitation by createdAt timestamp
      let latest = null;
      invitationsSnap.forEach(doc => {
        const inv = doc.data();
        if (!latest || (inv.createdAt && inv.createdAt.toDate() > latest.createdAt.toDate())) {
          latest = inv;
        }
      });
      const token = latest.token;
      const link = `http://localhost:3000/branch-access?token=${token}`;
      console.log(`${branchName} → ${link}`);
    } else {
      console.log(`${branchName} → (no invitation link yet)`);
    }
  }
}

showBranchLinks().catch(console.error);
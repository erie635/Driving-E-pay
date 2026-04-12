// create-invitation.js
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
const crypto = require('crypto');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function createInvitation(branchId, password, expiresHours = 24) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000);
  const invitation = {
    branchId,
    token,
    password,
    createdAt: new Date(),
    expiresAt,
  };
  const docRef = await db.collection('invitations').add(invitation);
  console.log(`Invitation created for branch ${branchId}:`);
  console.log(`  Token: ${token}`);
  console.log(`  Link: http://localhost:3000/branch-access?token=${token}`);
  console.log(`  Document ID: ${docRef.id}`);
}

// Get branch ID from command line argument
const branchId = process.argv[2];
if (!branchId) {
  console.error('Usage: node create-invitation.js <branch-id>');
  console.log('Available branch IDs:');
  db.collection('branches').get().then(snapshot => {
    snapshot.forEach(doc => console.log(`  ${doc.id} → ${doc.data().name}`));
  });
  process.exit(1);
} else {
  createInvitation(branchId, 'manual-password').catch(console.error);
}
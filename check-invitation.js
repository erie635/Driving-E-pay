// check-invitation.js
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

// Initialize Admin SDK if not already
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkInvitation(token) {
  if (!token) {
    console.log('Usage: node check-invitation.js <token>');
    return;
  }

  const snapshot = await db.collection('invitations').where('token', '==', token).get();
  if (snapshot.empty) {
    console.log('No invitation found with token:', token);
  } else {
    console.log('Invitation found:');
    snapshot.forEach(doc => {
      console.log('Document ID:', doc.id);
      console.log('Data:', doc.data());
    });
  }
}

async function listBranches() {
  const snapshot = await db.collection('branches').get();
  console.log('All branches:');
  snapshot.forEach(doc => {
    console.log(`ID: ${doc.id} → Name: ${doc.data().name}`);
  });
}

const token = process.argv[2];
if (token) {
  checkInvitation(token);
} else {
  listBranches();
}
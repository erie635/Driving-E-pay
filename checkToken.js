const { adminDb } = require('@/lib/firebase/admin');

async function check() {
  const token = 'e76b68ac6e4f0cb7e80b6f7caf5d1163ee1ac0e9fbed7988';
  const snapshot = await adminDb.collection('branches').where('invitationToken', '==', token).get();
  if (snapshot.empty) {
    console.log('❌ No branch found with token:', token);
  } else {
    snapshot.forEach(doc => {
      console.log('✅ Branch found:', doc.id, doc.data().name);
      console.log('  - invitationToken:', doc.data().invitationToken);
      console.log('  - invitationPassword:', doc.data().invitationPassword);
    });
  }
  process.exit();
}
check();

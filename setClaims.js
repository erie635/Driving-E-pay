// scripts/setClaims.js
const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function setClaims(uid, role, branchId = null) {
  const claims = { role };
  if (role === 'branch_admin') claims.branchId = branchId;
  await admin.auth().setCustomUserClaims(uid, claims);
  console.log(`Claims for ${uid}:`, claims);
}

// Example usage (replace with real UIDs):
// setClaims('your-admin-uid', 'admin');
// setClaims('your-branch-admin-uid', 'branch_admin', 'pzx9y0vaz6DpMQuLGeAs');
const fs = require('fs');
const path = require('path');

const content = `import admin from 'firebase-admin';

// Validate required environment variables
const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(\`Missing environment variable: \${envVar}\`);
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\\\n/g, '\\n'),
    }),
  });
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export default admin;
`;

const filePath = path.join(__dirname, 'lib', 'firebase', 'admin.ts');
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ admin.ts has been fixed!');

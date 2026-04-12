import admin from 'firebase-admin';

// Hardcoded fallbacks (remove after .env.local is fixed)
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'harmflow-driving-school-test';
process.env.FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@harmflow-driving-school-test.iam.gserviceaccount.com';
process.env.FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY || "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCvcWnBNRiXUOei\nL2gAM5in3PWmFxQj6Y+IjKGnZMh/g7EmbWqFOH2Pay1G4WjFlYaQmud2I8/wJoqE\no6AufOuTHWhxtLCamlna1uFL/5nqZNK1GIqHC6uRgckiG04m+lPez1LHB1x6HFx4\nX2kKaUtl6wACXC5TPs37fa5Da/ISHHPn93Duq09QS/RYVFTos14jk/RoD0/j8VZU\n0wMcamnxOPbeVcjAEY3/bjlJkAlWo+1eqB6ER4mXQPRCAUbZSZH+IsdoMztmGkcS\nXUEqJiNBrPFYhv9ixW61kAhTJ5+IGcDkB/VGjm9jNXNFioTuIKb+z8VB+Ib2pocv\nvBFyh78rAgMBAAECggEAM2nLgZSzQ6iwcM1ur1xveIXesREjVFDeQLhhqSH2RbQM\nhoPbCvZeiVhxuMtWvkxO1nKmsO7WwXwx7KPczbLLAF5GXMgEVxIzkdeVx4U8kD2C\nqBJsih3H5gjALhANa4vBZ1KfYfcMyTYlfRsMt8HamB/xbT+hTcDicThICLcKBfc3\nYyofhyW65sDDPYwlWTkQ3Vri0x2B5kdWx/KdMqq9uStu1NZQPvg+zoeVjn2MhspM\n77RSv1/crXv6+vuD+iZdw28QhtXZVzjsK/aY1e07RG6qb1GicqmhTBrtwuOXTvMB\nqJEy+o5bNfC8jjXVjl13oolpcWBRNIXALar3Ah/B0QKBgQDVbAARRT/ULzOWIMpf\nTi50mEsy4eyRQCsINd+Wi1DiNrspeT6UKVu2u4Wl4JrNEFtYNAIDbtlGKznP5y15\nSe2ep5Rfr5L5WezILJFDqwBuu7qH3I/LwcEHFWDdKCasKxSkLGbIQIgOzU9dOGUA\nWjDC6vuYmmzaXj5RTG6/CadPGwKBgQDScbxazLFmebUmXmp7riXl+Qrx0RizYRBb\nQo4vOi941zHHBRAZhPScz8o1xOdOTgsp9sKf+6ZkrKyHR8C8Up5hG/0Zw83xS+Hz\nu3xBeF//zKrk8UH9cnuawS2vJVxSY5E16m/bJnbofUQ7iN9hjv+IehsFZSyqwFfH\neVSaqT+BMQKBgElVVeSZTehj267vT3pWC+JmXhh6xuXWDbNBh7Vb44wHUGJc1eLl\nHy132+F2ftqNj0WMgVCaqy/QNIo6nkZ535tPa81BMBhcDN9vaO6+eGSUPvDmGcbi\nqaf8cY8sd7VbDDmpRBv1CItFgsq+UP5A/1ZKle8GyPZzwaf/wmIEOCgXAoGACLYu\nnu+kVGKrbhgwfkg6R2fk3RfT1vEotS5vJmNZPb5i0CNUhEntumQbsdgh3yr56VXO\nvsKzI63GQp9kyib9aXW4J43kg52pj+ZuAWPTTYqSdIHMQoqvtTtUAdEhHkQC6eF3\nmfHgsEUnQvOqk6ZQy7yKS9HhZHwr5hUOvIxPFbECgYBru2Dqy2OdSrpM9YuRckY5\ncZtqAdSK4hvqbecP6o9riHbEzxZLV4pUxk/yLNw6IiWW9Vw4RgF3VioUD/EaAIAG\nZZDJzb9avlpw4DQ3MRNqHpd51BhrPPEHMW4UlBoINMQH5gtvxaxXUnlxGkqdoVoA\nbsItGNAnZ7ormKO0UeQVew==\n-----END PRIVATE KEY-----\n";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export default admin;

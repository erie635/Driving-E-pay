// app/dashboard/set-admin-claims/route.ts (or pages/api)
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export async function POST(req) {
  const { uid } = await req.json();
  await getAuth().setCustomUserClaims(uid, { admin: true });
  // Also optionally save to Firestore
  await getFirestore().collection('users').doc(uid).set({ role: 'admin' }, { merge: true });
  return Response.json({ success: true });
}
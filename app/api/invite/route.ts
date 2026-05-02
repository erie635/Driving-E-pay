import { adminDb } from '@/lib/firebase/admin';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  const { branchId, password } = await req.json();
  if (!branchId || !password) {
    return NextResponse.json({ error: 'Missing branchId or password' }, { status: 400 });
  }

  // Verify branch exists
  const branchRef = adminDb.collection('branches').doc(branchId);
  const branchSnap = await branchRef.get();
  if (!branchSnap.exists) {
    return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
  }

  // Revoke existing invitations for this branch (old link stops working)
  const existingInvitations = await adminDb
    .collection('branchInvitations')
    .where('branchId', '==', branchId)
    .get();
  const deletePromises = existingInvitations.docs.map((doc) =>
    adminDb.collection('branchInvitations').doc(doc.id).delete()
  );
  await Promise.all(deletePromises);

  // Generate new token
  const token = crypto.randomBytes(32).toString('hex');

  // Store invitation (no expiration)
  await adminDb.collection('branchInvitations').doc(token).set({
    branchId,
    password,
    createdAt: new Date(),
  });

  return NextResponse.json({ token });
}

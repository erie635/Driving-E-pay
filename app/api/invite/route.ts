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

  // Generate a unique token
  const token = crypto.randomBytes(32).toString('hex');

  // Store invitation (expires after 7 days)
  await adminDb.collection('branchInvitations').doc(token).set({
    branchId,
    password, // ⚠️ in production, hash this password!
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return NextResponse.json({ token });
}
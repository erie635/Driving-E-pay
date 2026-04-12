'use server';

import { adminDb } from '@/lib/firebase/admin';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';

export async function createBranch(formData: FormData) {
  const name = formData.get('name') as string;
  const location = formData.get('location') as string;
  const password = formData.get('password') as string;

  // Generate slug
  const slug = name.toLowerCase().replace(/\s+/g, '-');

  // Generate token and hash password
  const token = randomBytes(24).toString('hex');
  const passwordHash = await bcrypt.hash(password, 10);

  // Start a Firestore transaction to create branch and invitation
  const branchRef = adminDb.collection('branches').doc();
  const invitationRef = adminDb.collection('branchInvitations').doc();

  await adminDb.runTransaction(async (transaction) => {
    transaction.set(branchRef, {
      name,
      location: location || null,
      slug,
      createdAt: adminDb.Timestamp.now(),
    });
    transaction.set(invitationRef, {
      branchId: branchRef.id,
      token,
      passwordHash,
      expiresAt: adminDb.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      createdAt: adminDb.Timestamp.now(),
    });
  });

  // Redirect to confirmation page with token and branchName
  redirect(`/dashboard/admin/branch-created?token=${token}&branchName=${encodeURIComponent(name)}`);
}
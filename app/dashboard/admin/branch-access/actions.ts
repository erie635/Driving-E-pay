'use server';

import { adminDb } from '@/lib/firebase/admin';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function verifyBranchPassword(formData: FormData) {
  const token = formData.get('token') as string;
  const password = formData.get('password') as string;

  if (!token || !password) {
    return { success: false, error: 'Missing token or password.' };
  }

  // Find invitation by token
  const invitationSnapshot = await adminDb
    .collection('branchInvitations')
    .where('token', '==', token)
    .limit(1)
    .get();

  if (invitationSnapshot.empty) {
    return { success: false, error: 'Invalid invitation.' };
  }

  const invitation = invitationSnapshot.docs[0];
  const invitationData = invitation.data();
  const branchId = invitationData.branchId;
  const passwordHash = invitationData.passwordHash;
  const expiresAt = invitationData.expiresAt?.toDate();

  // Check expiration
  if (expiresAt && expiresAt < new Date()) {
    return { success: false, error: 'This invitation has expired.' };
  }

  // Verify password
  const isValid = await bcrypt.compare(password, passwordHash);
  if (!isValid) {
    return { success: false, error: 'Incorrect password.' };
  }

  // Get branch slug to redirect later
  const branchDoc = await adminDb.collection('branches').doc(branchId).get();
  if (!branchDoc.exists) {
    return { success: false, error: 'Branch not found.' };
  }
  const branchSlug = branchDoc.data()?.slug;

  // Set a session cookie (e.g., branch_session) with branchId and optionally expiration
  const cookieStore = await cookies();
  cookieStore.set('branch_session', JSON.stringify({ branchId, branchSlug }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });

  // Redirect to branch dashboard
  redirect(`/branch/${branchSlug}/dashboard`);
}
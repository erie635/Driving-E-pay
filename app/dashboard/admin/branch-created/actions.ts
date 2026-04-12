'use server';

import { adminDb } from '@/lib/firebase/admin';
import { randomBytes } from 'crypto';

export async function generateInvitation(branchId: string, password: string) {
  console.log('[ACTION] generateInvitation called with branchId:', branchId, 'password:', password);
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  try {
    // Test write to see if Admin SDK works
    const testRef = await adminDb.collection('test_actions').add({ test: true, timestamp: new Date() });
    console.log('[ACTION] Test write succeeded:', testRef.id);

    const docRef = await adminDb.collection('invitations').add({
      branchId,
      token,
      password,
      createdAt: new Date(),
      expiresAt,
    });
    console.log('[ACTION] Invitation saved with token:', token, 'docId:', docRef.id);
    const link = `/branch-access?token=${token}`;
    return { link };
  } catch (error) {
    console.error('[ACTION] Error saving invitation:', error);
    return { error: 'Failed to generate invitation' };
  }
}
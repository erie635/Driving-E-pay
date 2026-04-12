'use server';
import { adminDb } from '@/lib/firebase/admin';
import crypto from 'crypto';

export async function generateInvitation(branchId, password) {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    await adminDb.collection('branches').doc(branchId).update({
      invitationToken: token,
      invitationPassword: password,   // store plain (or hash later)
    });
    return { link: `/branch-access?token=${token}` };
  } catch (error) {
    console.error('Error generating invitation:', error);
    return { error: 'Failed to generate invitation' };
  }
}
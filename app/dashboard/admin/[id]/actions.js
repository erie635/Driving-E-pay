'use server';
import { adminDb } from '@/lib/firebase/admin';

export async function verifyInvitation(branchId, token, password) {
  try {
    const branchRef = adminDb.collection('branches').doc(branchId);
    const branchSnap = await branchRef.get();
    if (!branchSnap.exists) {
      return { success: false, error: 'Branch not found' };
    }
    const branch = branchSnap.data();

    if (branch.invitationToken !== token) {
      return { success: false, error: 'Invalid invitation link' };
    }
    if (branch.invitationPassword !== password) {
      return { success: false, error: 'Incorrect password' };
    }

    // (Optional) mark invitation as used
    // await branchRef.update({ invitationUsed: true });

    return { success: true };
  } catch (error) {
    console.error('Verification error:', error);
    return { success: false, error: 'Server error. Please try again.' };
  }
}
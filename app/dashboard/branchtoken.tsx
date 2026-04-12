import { adminDb } from '@/lib/firebase/admin';
import { redirect } from 'next/navigation';

export default async function BranchAccessPage({ searchParams }) {
  const token = searchParams.token;

  if (!token) {
    // No token – maybe redirect to login or home
    redirect('/');
  }

  // Find branch with this invitation token
  const snapshot = await adminDb.collection('branches')
    .where('invitationToken', '==', token)
    .limit(1)
    .get();

  if (snapshot.empty) {
    // Invalid token – show error or redirect
    return <div className="p-6">Invalid invitation link.</div>;
  }

  const branch = snapshot.docs[0];
  const branchId = branch.id;

  // Redirect to the branch dashboard, preserving the token
  redirect(`/dashboard/branch/${branchId}?token=${token}`);
}
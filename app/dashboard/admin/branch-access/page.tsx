import { adminDb } from '@/lib/firebase/admin';
import { redirect } from 'next/navigation';

export default async function BranchAccessPage({ searchParams }) {
  // searchParams is a Promise, must be awaited
  const params = await searchParams;
  const token = params.token;

  if (!token) {
    redirect('/');
  }

  // Look up the invitation in the 'invitations' collection
  const invitationsRef = adminDb.collection('invitations');
  const snapshot = await invitationsRef.where('token', '==', token).limit(1).get();

  if (snapshot.empty) {
    return <div className="p-6 text-red-500">Invalid invitation link.</div>;
  }

  const invitation = snapshot.docs[0].data();
  const branchId = invitation.branchId;

  // Optionally check expiry
  const now = new Date();
  if (invitation.expiresAt && invitation.expiresAt.toDate() < now) {
    return <div className="p-6 text-red-500">This invitation has expired.</div>;
  }

  // Redirect to the branch dashboard
  redirect(`/dashboard/branch/${branchId}?token=${token}`);
}
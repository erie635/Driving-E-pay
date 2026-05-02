import { adminDb } from '@/lib/firebase/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  try {
    const invitationRef = adminDb.collection('branchInvitations').doc(token);
    const invitationSnap = await invitationRef.get();

    if (!invitationSnap.exists) {
      return NextResponse.json({ error: 'Invalid or revoked invitation' }, { status: 404 });
    }

    const invitation = invitationSnap.data();
    const branchId = invitation.branchId;

    // Fetch branch document from Firestore to get the name and any other info
    const branchRef = adminDb.collection('branches').doc(branchId);
    const branchSnap = await branchRef.get();

    if (!branchSnap.exists) {
      // If branch not found, still return branchId but with a fallback name
      return NextResponse.json({
        branch: { id: branchId, name: branchId },
        password: invitation.password,
      });
    }

    const branchData = branchSnap.data();
    const branch = {
      id: branchId,
      name: branchData.name || branchId,
      // you can include additional fields if needed (e.g., address, slug)
    };

    // ✅ No expiration check – link is valid until revoked (deleted)
    return NextResponse.json({
      branch,
      password: invitation.password,
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
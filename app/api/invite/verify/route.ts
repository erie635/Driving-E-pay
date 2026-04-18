import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  try {
    const invitationRef = adminDb.collection('branchInvitations').doc(token);
    const invitationSnap = await invitationRef.get();

    if (!invitationSnap.exists) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
    }

    const invitation = invitationSnap.data();
    if (invitation.expiresAt.toDate() < new Date()) {
      return NextResponse.json({ error: 'Invitation expired' }, { status: 410 });
    }

    const branchRef = adminDb.collection('branches').doc(invitation.branchId);
    const branchSnap = await branchRef.get();

    if (!branchSnap.exists) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    return NextResponse.json({
      branch: {
        id: branchSnap.id,
        name: branchSnap.data()?.name || invitation.branchId,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(
  req: NextRequest,
  { params }: { params: { branchId: string } }
) {
  const branchId = params.branchId;
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }

  const invitationsSnap = await adminDb.collection('invitations')
    .where('token', '==', token)
    .limit(1)
    .get();

  if (invitationsSnap.empty) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const invitation = invitationsSnap.docs[0].data();
  if (invitation.branchId !== branchId) {
    return NextResponse.json({ error: 'Token does not match branch' }, { status: 403 });
  }

  // Fetch branch data
  const branchSnap = await adminDb.collection('branches').doc(branchId).get();
  if (!branchSnap.exists) {
    return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
  }
  const branch = { id: branchSnap.id, ...branchSnap.data() };

  // Fetch students
  const studentsSnap = await adminDb.collection('branches').doc(branchId).collection('students').get();
  const students = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  return NextResponse.json({ branch, students });
}
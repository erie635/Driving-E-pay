import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function POST(req: Request) {
  try {
    const cookies = req.headers.get('cookie') || '';
    const sessionCookie = cookies.split(';').find(c => c.trim().startsWith('__session='))?.split('=')[1];
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { studentId, fromBranchId, toBranchId, reason } = await req.json();
    if (!studentId || !fromBranchId || !toBranchId || !reason) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const requestRef = adminDb.collection('transferRequests').doc();
    await requestRef.set({
      studentId,
      fromBranchId,
      toBranchId,
      reason,
      status: 'pending',
      requestedBy: decoded.uid,
      requestedAt: new Date(),
    });

    return NextResponse.json({ success: true, requestId: requestRef.id });
  } catch (error: any) {
    console.error('Transfer request error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

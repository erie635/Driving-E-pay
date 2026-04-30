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

    const { requestId, action } = await req.json();
    if (!requestId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const requestDoc = await adminDb.collection('transferRequests').doc(requestId).get();
    if (!requestDoc.exists) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    const request = requestDoc.data();

    if (action === 'reject') {
      await requestDoc.ref.update({ status: 'rejected', processedAt: new Date(), processedBy: decoded.uid });
      return NextResponse.json({ success: true, status: 'rejected' });
    }

    const { studentId, fromBranchId, toBranchId } = request;
    const studentDoc = await adminDb.collection('branches').doc(fromBranchId).collection('students').doc(studentId).get();
    if (!studentDoc.exists) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }
    const studentData = studentDoc.data();
    const targetStudentRef = adminDb.collection('branches').doc(toBranchId).collection('students').doc(studentId);
    await targetStudentRef.set(studentData);

    const copySubcollection = async (subName: string) => {
      const snapshot = await adminDb.collection('branches').doc(fromBranchId).collection('students').doc(studentId).collection(subName).get();
      const batch = adminDb.batch();
      snapshot.docs.forEach(doc => {
        const newRef = targetStudentRef.collection(subName).doc(doc.id);
        batch.set(newRef, doc.data());
      });
      await batch.commit();
    };
    await copySubcollection('payments');
    await copySubcollection('lessons');

    const deleteSubcollection = async (subName: string) => {
      const snapshot = await adminDb.collection('branches').doc(fromBranchId).collection('students').doc(studentId).collection(subName).get();
      const batch = adminDb.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    };
    await deleteSubcollection('payments');
    await deleteSubcollection('lessons');
    await adminDb.collection('branches').doc(fromBranchId).collection('students').doc(studentId).delete();

    await requestDoc.ref.update({ status: 'approved', processedAt: new Date(), processedBy: decoded.uid });
    return NextResponse.json({ success: true, status: 'approved' });
  } catch (error: any) {
    console.error('Approve error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
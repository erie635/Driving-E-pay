import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');
    const studentId = searchParams.get('studentId');

    if (!branchId || !studentId) {
      return NextResponse.json({ error: 'Missing branchId or studentId' }, { status: 400 });
    }

    const studentDoc = await adminDb
      .collection('branches')
      .doc(branchId)
      .collection('students')
      .doc(studentId)
      .get();

    if (!studentDoc.exists) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const data = studentDoc.data();
    return NextResponse.json({
      name: data.name || 'Unknown',
      accountNumber: data.accountNumber || data.studentAccountId || 'N/A',
    });
  } catch (error: any) {
    console.error('Error in /api/students/get:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
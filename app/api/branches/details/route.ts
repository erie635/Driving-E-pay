import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');
    if (!branchId) return NextResponse.json({ error: 'Missing branchId' }, { status: 400 });

    const studentsSnapshot = await adminDb.collection('branches').doc(branchId).collection('students').get();
    const students = studentsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        accountNumber: data.accountNumber || data.studentAccountId,
        phone: data.phone,
        totalFee: data.totalFee || 0,
        feePaid: data.feePaid || 0,
        balance: (data.totalFee || 0) - (data.feePaid || 0),
        enrolledAt: data.createdAt?.toDate?.() || null,
      };
    });

    // also get total payments for the branch
    let totalPayments = 0;
    for (const student of students) {
      const paymentsSnapshot = await adminDb.collection('branches').doc(branchId).collection('students').doc(student.id).collection('payments').get();
      paymentsSnapshot.docs.forEach(p => {
        totalPayments += p.data().amount || 0;
      });
    }

    return NextResponse.json({ branchId, students, totalPayments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
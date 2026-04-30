import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET() {
  try {
    const branchesSnapshot = await adminDb.collection('branches').get();
    const branches = branchesSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name || doc.id }));

    const allStudents: any[] = [];

    for (const branch of branches) {
      const studentsSnapshot = await adminDb.collection('branches').doc(branch.id).collection('students').get();
      for (const studentDoc of studentsSnapshot.docs) {
        const data = studentDoc.data();
        let enrolledAt = data.createdAt;
        if (enrolledAt && typeof enrolledAt.toDate === 'function') {
          enrolledAt = enrolledAt.toDate().toISOString();
        } else if (enrolledAt instanceof Date) {
          enrolledAt = enrolledAt.toISOString();
        } else {
          enrolledAt = null;
        }

        allStudents.push({
          id: studentDoc.id,
          branchName: branch.name,
          name: data.name || 'Unknown',
          accountNumber: data.accountNumber || data.studentAccountId || 'N/A',
          phone: data.phone || '',
          totalFee: data.totalFee || 0,
          feePaid: data.feePaid || 0,
          balance: (data.totalFee || 0) - (data.feePaid || 0),
          enrolledAt: enrolledAt,
        });
      }
    }

    allStudents.sort((a, b) => {
      if (!a.enrolledAt) return 1;
      if (!b.enrolledAt) return -1;
      return new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime();
    });

    return NextResponse.json({ students: allStudents });
  } catch (error: any) {
    console.error('Error fetching all students:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

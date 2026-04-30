import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const toDate = (value: any): Date | null => {
      if (!value) return null;
      if (typeof value.toDate === 'function') return value.toDate();
      if (value instanceof Date) return value;
      return new Date(value);
    };

    // 1. Get all branches
    const branchesSnapshot = await adminDb.collection('branches').get();
    const branches = branchesSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name || doc.id }));

    let totalRevenue = 0;
    let totalOutstanding = 0;
    let totalStudents = 0;
    const branchStats: any[] = [];

    for (const branch of branches) {
      const studentsSnapshot = await adminDb.collection('branches').doc(branch.id).collection('students').get();
      let branchRevenue = 0;
      let branchOutstanding = 0;
      let branchStudentCount = 0;

      for (const studentDoc of studentsSnapshot.docs) {
        const data = studentDoc.data();
        const feePaid = Number(data.feePaid) || 0;
        const totalFee = Number(data.totalFee) || 0;
        const balance = totalFee - feePaid;

        branchRevenue += feePaid;
        branchOutstanding += balance > 0 ? balance : 0;
        branchStudentCount++;
      }

      totalRevenue += branchRevenue;
      totalOutstanding += branchOutstanding;
      totalStudents += branchStudentCount;

      branchStats.push({
        id: branch.id,
        name: branch.name,
        revenue: branchRevenue,
        outstanding: branchOutstanding,
        studentCount: branchStudentCount,
      });
    }

    // 2. Collections over time (monthly & yearly)
    const collectionsByMonth: Record<string, number> = {};
    const collectionsByYear: Record<string, number> = {};

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    // Use collection group query on 'payments'
    const paymentsSnapshot = await adminDb.collectionGroup('payments').get();
    for (const paymentDoc of paymentsSnapshot.docs) {
      const paymentData = paymentDoc.data();
      const paymentDate = toDate(paymentData.date);
      if (!paymentDate) continue;

      if (start && paymentDate < start) continue;
      if (end && paymentDate > end) continue;

      const year = paymentDate.getFullYear();
      const month = paymentDate.getMonth() + 1;
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`; // ✅ fixed line
      const yearKey = year.toString();

      const amount = Number(paymentData.amount) || 0;
      collectionsByMonth[monthKey] = (collectionsByMonth[monthKey] || 0) + amount;
      collectionsByYear[yearKey] = (collectionsByYear[yearKey] || 0) + amount;
    }

    // 3. Recent enrollments (latest 20 students)
    const allStudents: any[] = [];
    for (const branch of branches) {
      const studentsSnapshot = await adminDb
        .collection('branches')
        .doc(branch.id)
        .collection('students')
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();
      studentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        allStudents.push({
          id: doc.id,
          branchName: branch.name,
          name: data.name,
          accountNumber: data.accountNumber || data.studentAccountId,
          phone: data.phone,
          enrolledAt: toDate(data.createdAt) || new Date(),
        });
      });
    }
    allStudents.sort((a, b) => b.enrolledAt.getTime() - a.enrolledAt.getTime());
    const recentEnrollments = allStudents.slice(0, 20);

    return NextResponse.json({
      totalRevenue,
      totalOutstanding,
      totalStudents,
      totalBranches: branches.length,
      branchStats,
      collectionsByMonth,
      collectionsByYear,
      recentEnrollments,
    });
  } catch (error: any) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin'; // You'll need to set up Firebase Admin SDK

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get('branchId');

  try {
    let query = adminDb.collection('examRequests').orderBy('createdAt', 'desc');
    if (branchId && branchId !== 'all') {
      query = query.where('branchId', '==', branchId);
    }
    const snapshot = await query.get();
    const requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      approvedAt: doc.data().approvedAt?.toDate(),
      examDate: doc.data().examDate?.toDate(),
    }));
    return NextResponse.json({ requests });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }
}
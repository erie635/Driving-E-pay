// app/api/payments/mpesa/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase/client';

export async function POST(request: Request) {
  const body = await request.json();
  // Verify the callback (authentication, etc.)
  // Process the payment: update student balance, create payment record
  try {
    const { TransactionType, TransID, TransTime, TransAmount, BillRefNumber, MSISDN, FirstName } = body;

    // BillRefNumber could be student phone or account number
    const studentQuery = await adminDb.collection('students')
      .where('phone', '==', BillRefNumber)
      .limit(1)
      .get();
    if (studentQuery.empty) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }
    const studentDoc = studentQuery.docs[0];
    const student = studentDoc.data();

    // Calculate new balance
    const newBalance = student.balance - TransAmount;
    const isFullyPaid = newBalance <= 0;

    // Record payment
    await adminDb.collection('payments').add({
      studentId: studentDoc.id,
      branchId: student.branchId,
      amount: TransAmount,
      currency: 'KES',
      method: 'mpesa',
      reference: TransID,
      status: 'completed',
      timestamp: new Date(TransTime),
      recordedBy: 'system',
      balanceAfter: newBalance
    });

    // Update student
    await studentDoc.ref.update({
      balance: newBalance,
      isFullyPaid,
      lastActive: new Date()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('M-Pesa webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
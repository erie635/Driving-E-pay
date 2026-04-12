import { adminDb } from '@/lib/firebase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const snapshot = await adminDb.collection('branches').get();
    const branches = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      invitationToken: doc.data().invitationToken || null,
      invitationPassword: doc.data().invitationPassword ? 'SET' : null,
    }));
    return NextResponse.json(branches);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
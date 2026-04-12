import { NextResponse } from 'next/server';
import admin from '@/lib/firebase/admin'; // your admin config

export async function POST(req: Request) {
  try {
    const { uid } = await req.json();

    await admin.auth().setCustomUserClaims(uid, {
      admin: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
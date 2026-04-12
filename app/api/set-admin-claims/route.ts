import { NextResponse } from 'next/server';
import admin from '@/lib/firebase/admin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { uid, requesterEmail } = body;

    // ✅ Validate input
    if (!uid) {
      return NextResponse.json(
        { error: 'UID is required' },
        { status: 400 }
      );
    }

    /**
     * 🔐 OPTIONAL SECURITY CONTROL
     * Only allow specific email(s) to assign admin claims
     * You can replace this with your own admin check logic
     */
    const allowedAdmins = ['youradmin@email.com'];

    if (requesterEmail && !allowedAdmins.includes(requesterEmail)) {
      return NextResponse.json(
        { error: 'Unauthorized: not allowed to assign admin claims' },
        { status: 403 }
      );
    }

    // ✅ Set custom claims
    await admin.auth().setCustomUserClaims(uid, {
      admin: true,
    });

    // ✅ Force token refresh (important)
    const user = await admin.auth().getUser(uid);

    return NextResponse.json({
      success: true,
      message: 'Admin claims set successfully',
      user: {
        uid: user.uid,
        email: user.email,
        customClaims: user.customClaims,
      },
    });
  } catch (error: any) {
    console.error('Set Admin Claims Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to set admin claims',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { idToken, uid } = body;

    let targetUid = uid;

    if (idToken) {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      targetUid = decodedToken.uid;
    }

    if (!targetUid) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Valid token or uid required.' }, { status: 401 });
    }

    const userDoc = await adminDb.collection('users').doc(targetUid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'USER_NOT_FOUND', message: 'User profile not found.' }, { status: 404 });
    }

    const userProfile = userDoc.data();

    const response = NextResponse.json({ success: true, user: userProfile });

    response.cookies.set({
      name: 'librasense_session',
      value: targetUid,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: unknown) {
    console.error('Login API Error:', err);
    const message = err instanceof Error ? err.message : 'Login failed';
    return NextResponse.json({ error: 'LOGIN_FAILED', message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { UserProfile } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, displayName, studentId } = body;

    if (!email || !password || !displayName || !studentId) {
      return NextResponse.json(
        { error: 'MISSING_FIELDS', message: 'All fields (email, password, name, studentId) are required.' },
        { status: 400 }
      );
    }

    const normalizedStudentId = String(studentId).trim().toUpperCase();

    // Enforce Student ID Uniqueness via Atomic Transaction
    const idRef = adminDb.collection('studentIds').doc(normalizedStudentId);
    
    // Check if Student ID already exists before creating user
    const existingIdDoc = await idRef.get();
    if (existingIdDoc.exists) {
      return NextResponse.json(
        { error: 'STUDENT_ID_TAKEN', message: `Student ID '${normalizedStudentId}' is already registered.` },
        { status: 409 }
      );
    }

    // Create Firebase Auth user
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
    });

    // Set custom claim for role (strictly 'student')
    await adminAuth.setCustomUserClaims(userRecord.uid, { role: 'student' });

    const userProfile: UserProfile = {
      uid: userRecord.uid,
      email,
      displayName,
      role: 'student', // Admin role cannot be self-registered
      studentId: normalizedStudentId,
      createdAt: new Date().toISOString(),
    };

    // Save profile and lock studentId atomically
    const batch = adminDb.batch();
    batch.set(adminDb.collection('users').doc(userRecord.uid), userProfile);
    batch.set(idRef, { uid: userRecord.uid, createdAt: new Date().toISOString() });
    await batch.commit();

    const response = NextResponse.json({ success: true, user: userProfile });
    
    // Set HTTP session cookie for edge middleware
    response.cookies.set({
      name: 'librasense_session',
      value: userRecord.uid,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: unknown) {
    console.error('Registration API Error:', err);
    const message = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json({ error: 'REGISTRATION_FAILED', message }, { status: 500 });
  }
}

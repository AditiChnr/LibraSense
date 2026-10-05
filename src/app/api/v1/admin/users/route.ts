import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { verifyAdminRequest, logAuditEvent } from '@/lib/services/adminAuth';
import { UserProfile, UserRole } from '@/types';

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: auth.error }, { status: auth.status });
  }

  try {
    const usersSnap = await adminDb.collection('users').get();
    const users: Partial<UserProfile>[] = [];

    usersSnap.forEach((doc) => {
      const data = doc.data();
      // Enforce minimal personal information disclosure
      users.push({
        uid: doc.id,
        displayName: data.displayName || 'Unknown User',
        email: data.email || 'No email',
        role: data.role || 'student',
        studentId: data.studentId || 'N/A',
        totalStudySeconds: data.totalStudySeconds || 0,
        completedSessionsCount: data.completedSessionsCount || 0,
        createdAt: data.createdAt || new Date().toISOString(),
      });
    });

    return NextResponse.json({ success: true, users });
  } catch (err) {
    console.error('Admin Users GET Error:', err);
    return NextResponse.json({ error: 'SERVER_ERROR', message: 'Failed to fetch users.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { targetUid, newRole } = body as { targetUid: string; newRole: UserRole };

    if (!targetUid || !newRole || !['student', 'admin'].includes(newRole)) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'targetUid and valid newRole (student | admin) required.' },
        { status: 400 }
      );
    }

    // Safety guard: Admin cannot demote themselves to prevent lockout
    if (targetUid === auth.adminUid && newRole !== 'admin') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Self-demotion is prevented to avoid administrative lockout.' },
        { status: 403 }
      );
    }

    const userRef = adminDb.collection('users').doc(targetUid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Target user does not exist.' }, { status: 404 });
    }

    const previousRole = userDoc.data()?.role || 'student';

    // Update Firestore User doc
    await userRef.update({
      role: newRole,
      roleUpdatedAt: new Date().toISOString(),
      roleUpdatedBy: auth.adminUid,
    });

    // Update Auth Custom Claims
    try {
      await adminAuth.setCustomUserClaims(targetUid, { role: newRole });
    } catch (claimErr) {
      console.warn('Could not set custom user claim:', claimErr);
    }

    // Write audit event
    await logAuditEvent(
      auth.adminUid!,
      'USER_ROLE_UPDATED',
      targetUid,
      {
        targetEmail: userDoc.data()?.email,
        previousRole,
        newRole,
      }
    );

    return NextResponse.json({
      success: true,
      targetUid,
      newRole,
      message: `User role successfully updated to ${newRole}.`,
    });
  } catch (err) {
    console.error('Admin Users POST Error:', err);
    return NextResponse.json({ error: 'SERVER_ERROR', message: 'Failed to update user role.' }, { status: 500 });
  }
}

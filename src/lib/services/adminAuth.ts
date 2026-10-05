import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { AuditLog } from '@/types';

export interface AdminAuthResult {
  authorized: boolean;
  adminUid?: string;
  adminEmail?: string;
  error?: string;
  status: number;
}

/**
 * Server-authoritative Admin verification helper.
 * Checks Firebase ID token and verifies role === 'admin' from custom claims or Firestore profile.
 */
export async function verifyAdminRequest(request: Request): Promise<AdminAuthResult> {
  try {
    const authHeader = request.headers.get('Authorization');
    const sessionCookie = request.headers.get('cookie')?.split('librasense_session=')[1]?.split(';')[0];

    let tokenUid = '';
    let tokenEmail = '';
    let tokenRole: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      if (!token) {
        return { authorized: false, error: 'Malformed authorization token.', status: 401 };
      }
      const decoded = await adminAuth.verifyIdToken(token);
      tokenUid = decoded.uid;
      tokenEmail = decoded.email || '';
      tokenRole = decoded.role as string | undefined;
    } else if (sessionCookie) {
      tokenUid = sessionCookie;
    }

    if (!tokenUid) {
      return { authorized: false, error: 'Authentication required.', status: 401 };
    }

    // 1. Check custom claim first if available
    if (tokenRole === 'admin') {
      return { authorized: true, adminUid: tokenUid, adminEmail: tokenEmail, status: 200 };
    }

    // 2. Authoritative check in Firestore /users/{uid}
    const userDoc = await adminDb.collection('users').doc(tokenUid).get();
    if (!userDoc.exists) {
      return { authorized: false, error: 'User account not found.', status: 404 };
    }

    const userData = userDoc.data();
    if (userData?.role !== 'admin') {
      return { authorized: false, error: 'Forbidden: Administrator privileges required.', status: 403 };
    }

    return {
      authorized: true,
      adminUid: tokenUid,
      adminEmail: userData.email || tokenEmail,
      status: 200,
    };
  } catch (err) {
    console.error('Admin Auth Verification Error:', err);
    return { authorized: false, error: 'Invalid or expired authorization credentials.', status: 401 };
  }
}

/**
 * Writes an administrative audit event to Firestore /auditLogs
 */
export async function logAuditEvent(
  actorUid: string,
  action: string,
  targetId: string,
  details: Record<string, unknown>,
  ipAddress?: string
): Promise<string> {
  try {
    const logRef = adminDb.collection('auditLogs').doc();
    const auditRecord: AuditLog = {
      id: logRef.id,
      actorUid,
      action,
      targetId,
      details,
      ipAddress: ipAddress || 'server-internal',
      timestamp: new Date().toISOString(),
    };
    await logRef.set(auditRecord);
    return logRef.id;
  } catch (err) {
    console.error('Failed to write audit log:', err);
    return '';
  }
}

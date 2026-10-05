import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAdminRequest } from '@/lib/services/adminAuth';
import { AuditLog } from '@/types';

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    const snapshot = await adminDb
      .collection('auditLogs')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const auditLogs: AuditLog[] = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as AuditLog)
    );

    return NextResponse.json({ success: true, auditLogs });
  } catch (err) {
    console.error('Admin Audit Logs GET Error:', err);
    return NextResponse.json({ error: 'SERVER_ERROR', message: 'Failed to fetch audit logs.' }, { status: 500 });
  }
}

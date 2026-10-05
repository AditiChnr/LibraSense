import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAdminRequest, logAuditEvent } from '@/lib/services/adminAuth';
import { SystemConfig } from '@/types';

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: auth.error }, { status: auth.status });
  }

  try {
    const configDoc = await adminDb.collection('systemSettings').doc('config').get();
    const config = configDoc.exists
      ? (configDoc.data() as SystemConfig)
      : {
          maxActiveReservations: 2,
          maxFutureReservations: 5,
          maxDurationMinutes: 240,
          minBookingLeadMinutes: 15,
          maxBookingLeadDays: 7,
          defaultGracePeriodMinutes: 15,
          minCancellationNoticeMinutes: 30,
          hardwareModeEnabled: true,
          simulationActive: false,
        };

    return NextResponse.json({ success: true, config });
  } catch (err) {
    console.error('Admin Config GET Error:', err);
    return NextResponse.json({ error: 'SERVER_ERROR', message: 'Failed to fetch config.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as Partial<SystemConfig>;

    // Bounds and validity validation
    if (
      (body.maxActiveReservations !== undefined && (body.maxActiveReservations < 1 || body.maxActiveReservations > 10)) ||
      (body.maxDurationMinutes !== undefined && (body.maxDurationMinutes < 15 || body.maxDurationMinutes > 720)) ||
      (body.defaultGracePeriodMinutes !== undefined && (body.defaultGracePeriodMinutes < 5 || body.defaultGracePeriodMinutes > 60)) ||
      (body.maxBookingLeadDays !== undefined && (body.maxBookingLeadDays < 1 || body.maxBookingLeadDays > 30))
    ) {
      return NextResponse.json(
        { error: 'INVALID_CONFIG_BOUNDS', message: 'One or more configuration parameters are out of acceptable operational bounds.' },
        { status: 400 }
      );
    }

    const configRef = adminDb.collection('systemSettings').doc('config');
    const existingDoc = await configRef.get();
    const previousConfig = existingDoc.exists ? existingDoc.data() : {};

    const updatedConfig: SystemConfig = {
      ...(previousConfig as SystemConfig),
      ...body,
    };

    await configRef.set(updatedConfig, { merge: true });

    // Write audit event
    await logAuditEvent(
      auth.adminUid!,
      'SYSTEM_CONFIG_UPDATED',
      'config',
      {
        previous: previousConfig,
        updatedFields: body,
      }
    );

    return NextResponse.json({
      success: true,
      config: updatedConfig,
      message: 'System configuration updated successfully.',
    });
  } catch (err) {
    console.error('Admin Config POST Error:', err);
    return NextResponse.json({ error: 'SERVER_ERROR', message: 'Failed to update configuration.' }, { status: 500 });
  }
}

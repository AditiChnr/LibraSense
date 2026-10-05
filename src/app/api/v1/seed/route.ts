import { NextResponse } from 'next/server';
import { seedDatabase } from '@/lib/services/seedService';
import { adminAuth } from '@/lib/firebase/admin';

export async function POST(request: Request) {
  try {
    const isDev = process.env.NODE_ENV !== 'production';
    const seedSecret = process.env.SEED_SECRET;
    const authHeader = request.headers.get('Authorization');
    const customSeedHeader = request.headers.get('X-Seed-Secret');

    let isAuthorized = false;

    // 1. Check custom seed secret header
    if (seedSecret && customSeedHeader === seedSecret) {
      isAuthorized = true;
    }

    // 2. Check Admin auth token
    if (!isAuthorized && authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      try {
        const decoded = await adminAuth.verifyIdToken(token!);
        if (decoded.role === 'admin') {
          isAuthorized = true;
        }
      } catch (err) {
        console.warn('Invalid token for seed route:', err);
      }
    }

    // 3. Allow in local development mode for setup convenience
    if (!isAuthorized && isDev) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Seeding database requires admin authorization or valid SEED_SECRET.' },
        { status: 403 }
      );
    }

    const result = await seedDatabase();
    return NextResponse.json({ success: true, message: 'Database seeded successfully', data: result });
  } catch (err: unknown) {
    console.error('Seed API error:', err);
    const message = err instanceof Error ? err.message : 'Database seed failed';
    return NextResponse.json({ error: 'SEED_FAILED', message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}

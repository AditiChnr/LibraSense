import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'librasense-demo';
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || 'firebase-adminsdk@librasense-demo.iam.gserviceaccount.com';
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  // Only pass cert if privateKey is a valid OpenSSL RSA PEM key string
  const isValidPem = privateKey.includes('-----BEGIN PRIVATE KEY-----') && !privateKey.includes('MOCK_KEY_FOR_LOCAL_DEVELOPMENT') && privateKey.length > 200;

  try {
    if (isValidPem) {
      return initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } else {
      return initializeApp({
        projectId,
      });
    }
  } catch (err) {
    console.warn('Firebase Admin init fallback warning:', err);
    return initializeApp({ projectId });
  }
}

const adminApp = getAdminApp();

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);

export default adminApp;

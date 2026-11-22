import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  googleProvider.addScope(scope);
}

// Strictly in-memory OAuth access token cache (never stored in localStorage/sessionStorage)
let cachedDriveAccessToken: string | null = null;
let isSigningIn = false;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
if (import.meta.env.DEV) {
  void testConnection();
}

export function subscribeAuth(
  onUserChange: (user: User | null, hasDriveToken: boolean) => void,
) {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedDriveAccessToken = null;
      onUserChange(null, false);
      return;
    }
    if (!isSigningIn) {
      onUserChange(user, Boolean(cachedDriveAccessToken));
    }
  });
}

export async function signInWithGoogle(
  requestDriveConsent = true,
): Promise<{ user: User; accessToken: string | null }> {
  try {
    isSigningIn = true;
    const provider = new GoogleAuthProvider();
    if (requestDriveConsent) {
      for (const scope of SCOPES) {
        provider.addScope(scope);
      }
      provider.setCustomParameters({ prompt: 'select_account' });
    }
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedDriveAccessToken = credential.accessToken;
    }
    return { user: result.user, accessToken: cachedDriveAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export function getGoogleDriveAccessToken(): string | null {
  return cachedDriveAccessToken;
}

export function clearGoogleDriveAccessToken(): void {
  cachedDriveAccessToken = null;
}

export async function signOutGoogle(): Promise<void> {
  cachedDriveAccessToken = null;
  await signOut(auth);
}

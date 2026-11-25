import { initializeApp } from 'firebase/app';
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { isTauriDesktop, startDesktopAuthSession } from './desktopFontActivator';

export const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Strictly in-memory OAuth access token cache (never stored in localStorage/sessionStorage)
let cachedDriveAccessToken: string | null = null;
let isSigningIn = false;
let redirectResultChecked = false;

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

function isTopLevelWindow(): boolean {
  try {
    return window.self === window.top;
  } catch {
    return false;
  }
}

export function subscribeAuth(
  onUserChange: (user: User | null, hasDriveToken: boolean) => void,
) {
  if (!redirectResultChecked) {
    redirectResultChecked = true;
    void getRedirectResult(auth)
      .then((result) => {
        if (!result) return;
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedDriveAccessToken = credential.accessToken;
        }
        onUserChange(result.user, Boolean(cachedDriveAccessToken));
      })
      .catch(() => {
        // Ignore stale or missing redirect state
      });
  }

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

export interface GoogleSignInResult {
  user: User | null;
  accessToken: string | null;
  redirected?: boolean;
}

export async function signInWithGoogle(
  requestDriveConsent = false,
): Promise<GoogleSignInResult> {
  // In the Tauri desktop app (macOS/Windows), complete Google OAuth in the user's real system
  // browser via a one-shot localhost callback, then hydrate Firebase Auth with signInWithCredential.
  if (isTauriDesktop()) {
    try {
      isSigningIn = true;
      const tokens = await startDesktopAuthSession(requestDriveConsent);
      const cred = GoogleAuthProvider.credential(
        tokens.idToken,
        tokens.accessToken ?? undefined,
      );
      const result = await signInWithCredential(auth, cred);
      if (tokens.accessToken) {
        cachedDriveAccessToken = tokens.accessToken;
      }
      return { user: result.user, accessToken: cachedDriveAccessToken };
    } finally {
      isSigningIn = false;
    }
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  if (requestDriveConsent) {
    for (const scope of SCOPES) {
      provider.addScope(scope);
    }
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedDriveAccessToken = credential.accessToken;
    }
    return { user: result.user, accessToken: cachedDriveAccessToken };
  } catch (err) {
    const code = (err as { code?: string })?.code ?? '';

    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      // Automatically fall back to redirect sign-in on top-level tabs when popups are blocked
      if (isTopLevelWindow()) {
        await signInWithRedirect(auth, provider);
        return { user: null, accessToken: null, redirected: true };
      }
      throw new Error(
        'Pop-up was blocked by your browser. Allow pop-ups for this site and click Sign in with Google again.',
      );
    }

    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new Error('Google sign-in was cancelled.');
    }

    if (code === 'auth/unauthorized-domain') {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      throw new Error(
        `Domain "${host}" is not authorized in Firebase Console → Authentication → Settings → Authorized domains.`,
      );
    }

    throw err;
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

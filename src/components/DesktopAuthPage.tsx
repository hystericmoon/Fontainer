import React, { useEffect, useMemo, useState } from 'react';
import {
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { GoogleSignInButton } from './CloudConnectionsModal';
import { auth, SCOPES } from '../services/firebase';

const DESKTOP_AUTH_STORAGE_KEY = 'fontainer-desktop-auth-session';

interface DesktopAuthParams {
  port: number | null;
  state: string | null;
  requestDrive: boolean;
}

function readParamsFromUrlOrStorage(): DesktopAuthParams {
  const sp = new URLSearchParams(window.location.search);
  const portNum = Number(sp.get('port'));
  const validPort =
    Number.isInteger(portNum) && portNum >= 1024 && portNum <= 65535 ? portNum : null;
  const rawState = (sp.get('state') ?? '').trim();
  const validState = /^[a-fA-F0-9]{16,64}$/.test(rawState) ? rawState : null;
  const requestDrive = sp.get('drive') === '1';

  if (validPort && validState) {
    try {
      window.sessionStorage.setItem(
        DESKTOP_AUTH_STORAGE_KEY,
        JSON.stringify({ port: validPort, state: validState, requestDrive }),
      );
    } catch {
      // ignore storage restrictions
    }
    return { port: validPort, state: validState, requestDrive };
  }

  // After a signInWithRedirect round-trip, restore the saved loopback port & nonce
  try {
    const raw = window.sessionStorage.getItem(DESKTOP_AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DesktopAuthParams>;
      const savedPort =
        typeof parsed.port === 'number' &&
        Number.isInteger(parsed.port) &&
        parsed.port >= 1024 &&
        parsed.port <= 65535
          ? parsed.port
          : null;
      const savedState =
        typeof parsed.state === 'string' && /^[a-fA-F0-9]{16,64}$/.test(parsed.state)
          ? parsed.state
          : null;
      if (savedPort && savedState) {
        return {
          port: savedPort,
          state: savedState,
          requestDrive: Boolean(parsed.requestDrive),
        };
      }
    }
  } catch {
    // ignore storage errors
  }

  return { port: null, state: null, requestDrive: false };
}

function clearSavedAuthParams(): void {
  try {
    window.sessionStorage.removeItem(DESKTOP_AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function submitLoopbackForm(port: number, fields: Record<string, string>): void {
  clearSavedAuthParams();
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `http://127.0.0.1:${port}/callback`;
  form.style.display = 'none';

  for (const [key, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}

export const DesktopAuthPage: React.FC = () => {
  const params = useMemo(() => readParamsFromUrlOrStorage(), []);

  const [busy, setBusy] = useState(false);
  const [checkingRedirect, setCheckingRedirect] = useState(true);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  // Complete sign-in automatically when returning from signInWithRedirect
  useEffect(() => {
    let active = true;
    void getRedirectResult(auth)
      .then((result) => {
        if (!active) return;
        if (!result) {
          setCheckingRedirect(false);
          return;
        }
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (!credential?.idToken) {
          setError('Google sign-in did not return an ID token. Please try again.');
          setCheckingRedirect(false);
          return;
        }
        if (!params.port || !params.state) {
          setError('Desktop sign-in session expired. Please click Sign in again inside Fontainer.');
          setCheckingRedirect(false);
          return;
        }
        setSent(true);
        submitLoopbackForm(params.port, {
          state: params.state,
          idToken: credential.idToken,
          accessToken: credential.accessToken ?? '',
        });
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to finish Google sign-in.');
        setCheckingRedirect(false);
      });

    return () => {
      active = false;
    };
  }, [params.port, params.state]);

  const buildProvider = () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    if (params.requestDrive) {
      for (const scope of SCOPES) {
        provider.addScope(scope);
      }
    }
    return provider;
  };

  const handleContinue = async () => {
    if (!params.port || !params.state) return;
    setBusy(true);
    setError('');
    const provider = buildProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.idToken) {
        throw new Error('Google sign-in did not return an ID token. Please try again.');
      }

      setSent(true);
      submitLoopbackForm(params.port, {
        state: params.state,
        idToken: credential.idToken,
        accessToken: credential.accessToken ?? '',
      });
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';

      // Safari & strict browsers block popups by default — automatically use full-page redirect
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          window.sessionStorage.setItem(DESKTOP_AUTH_STORAGE_KEY, JSON.stringify(params));
        } catch {
          // ignore
        }
        await signInWithRedirect(auth, provider);
        return;
      }

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Sign-in popup was closed. Click below to try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Google sign-in failed.');
      }
      setBusy(false);
    }
  };

  const handleCancel = () => {
    if (!params.port || !params.state) return;
    submitLoopbackForm(params.port, {
      state: params.state,
      error: 'Google sign-in was cancelled.',
    });
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-[#F6F6F6] dark:bg-[#161616] text-[#1b1b1b] dark:text-[#f1f1f1] p-6">
      <section className="w-full max-w-md rounded-2xl bg-white dark:bg-[#222222] border border-black/10 dark:border-white/10 shadow-xl p-7 text-center space-y-5">
        <div className="w-11 h-11 rounded-xl bg-[#1b1b1b] dark:bg-[#f1f1f1] text-white dark:text-[#111111] font-bold text-[18px] inline-flex items-center justify-center mx-auto">
          F
        </div>

        <div className="space-y-1.5">
          <h1 className="text-[18px] font-semibold tracking-tight">
            Sign in to Fontainer Desktop
          </h1>
          <p className="text-[13px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
            {params.requestDrive
              ? 'Connect your Google account and read-only Google Drive access so activated fonts auto-sync across Mac & Windows.'
              : 'Sign in with Google to sync your activated fonts, lists, and preferences across Mac, Windows, and Web.'}
          </p>
        </div>

        {!params.port || !params.state ? (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-[12px]">
            This desktop sign-in link is missing required parameters. Please start sign-in from the
            Fontainer desktop app.
          </div>
        ) : sent ? (
          <div className="py-3 flex flex-col items-center gap-2 text-emerald-700 dark:text-emerald-400 text-[13px] font-medium">
            <CheckCircle2 className="w-6 h-6" />
            <span>Sending session back to Fontainer Desktop…</span>
          </div>
        ) : checkingRedirect || busy ? (
          <div className="inline-flex items-center justify-center gap-2 h-9 px-4 text-[13px] text-neutral-600 dark:text-neutral-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{checkingRedirect ? 'Checking sign-in status…' : 'Redirecting to Google…'}</span>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <div className="flex flex-col items-center gap-2.5">
              <GoogleSignInButton
                onClick={() => void handleContinue()}
                label={
                  params.requestDrive
                    ? 'Continue with Google & Drive'
                    : 'Continue with Google'
                }
              />
              <button
                type="button"
                onClick={handleCancel}
                className="text-[12px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
            {error && (
              <p className="text-[12px] text-red-600 dark:text-red-400 leading-relaxed">{error}</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
};

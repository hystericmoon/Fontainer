import './index.css';
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { isTauriDesktop } from './services/desktopFontActivator';

const DesktopAuthPage = lazy(() =>
  import('./components/DesktopAuthPage').then((m) => ({ default: m.DesktopAuthPage })),
);
const LegalPage = lazy(() =>
  import('./components/LegalPage').then((m) => ({ default: m.LegalPage })),
);

if (!isTauriDesktop()) {
  registerSW({ immediate: true });
}

type AppRoute = '/' | '/privacy' | '/terms' | '/desktop-auth';

function normalizeRoute(pathname: string): AppRoute {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  if (clean === '/privacy' || clean === '/privacy-policy') return '/privacy';
  if (clean === '/terms' || clean === '/terms-of-service') return '/terms';
  if (clean === '/desktop-auth') return '/desktop-auth';
  return '/';
}

const RootRouter: React.FC = () => {
  const [route, setRoute] = useState<AppRoute>(() =>
    normalizeRoute(window.location.pathname),
  );

  useEffect(() => {
    const onPopState = () => {
      setRoute(normalizeRoute(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = (path: string) => {
    const next = normalizeRoute(path);
    if (window.location.pathname !== next) {
      window.history.pushState({}, '', next);
    }
    setRoute(next);
  };

  if (route === '/desktop-auth') {
    return (
      <Suspense fallback={null}>
        <DesktopAuthPage />
      </Suspense>
    );
  }
  if (route === '/privacy') {
    return (
      <Suspense fallback={null}>
        <LegalPage page="privacy" onNavigate={navigateTo} />
      </Suspense>
    );
  }
  if (route === '/terms') {
    return (
      <Suspense fallback={null}>
        <LegalPage page="terms" onNavigate={navigateTo} />
      </Suspense>
    );
  }
  return <App />;
};

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <RootRouter />
  </ErrorBoundary>,
);

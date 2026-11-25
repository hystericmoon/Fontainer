import './index.css';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { DesktopAuthPage } from './components/DesktopAuthPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LegalPage } from './components/LegalPage';
import { isTauriDesktop } from './services/desktopFontActivator';

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
    return <DesktopAuthPage />;
  }
  if (route === '/privacy') {
    return <LegalPage page="privacy" onNavigate={navigateTo} />;
  }
  if (route === '/terms') {
    return <LegalPage page="terms" onNavigate={navigateTo} />;
  }
  return <App />;
};

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <RootRouter />
  </ErrorBoundary>,
);

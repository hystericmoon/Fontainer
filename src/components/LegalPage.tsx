import React, { useEffect } from 'react';
import { ArrowLeft, ShieldCheck, FileText } from 'lucide-react';

export type LegalPageType = 'privacy' | 'terms';

interface LegalPageProps {
  page: LegalPageType;
  onNavigate?: (path: string) => void;
}

const LAST_UPDATED = 'November 22, 2026';

export const LegalPage: React.FC<LegalPageProps> = ({ page, onNavigate }) => {
  const isPrivacy = page === 'privacy';

  useEffect(() => {
    document.title = isPrivacy
      ? 'Privacy Policy — Fontainer'
      : 'Terms of Service — Fontainer';
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [isPrivacy]);

  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!onNavigate) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(href);
  };

  return (
    <div className="min-h-screen bg-[var(--color-background-body)] text-[var(--color-text-primary)] antialiased">
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-background-surface)]/95 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <a
            href="/"
            onClick={(e) => handleNav(e, '/')}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Fontainer</span>
          </a>

          <nav aria-label="Legal navigation" className="flex items-center gap-4 text-[12.5px]">
            <a
              href="/privacy"
              onClick={(e) => handleNav(e, '/privacy')}
              className={
                isPrivacy
                  ? 'font-semibold text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors'
              }
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              onClick={(e) => handleNav(e, '/terms')}
              className={
                !isPrivacy
                  ? 'font-semibold text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors'
              }
            >
              Terms of Service
            </a>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-[#1b1b1b] dark:bg-[#f1f1f1] text-white dark:text-[#111111] flex items-center justify-center font-bold text-[15px] tracking-tight shrink-0">
            F
          </div>
          <div>
            <div className="text-[12px] font-medium text-[var(--color-text-secondary)] flex items-center gap-1.5">
              {isPrivacy ? <ShieldCheck className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
              <span>Fontainer Legal</span>
            </div>
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--color-text-primary)] leading-tight">
              {isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
            </h1>
          </div>
        </div>

        <p className="text-[12.5px] text-[var(--color-text-secondary)] mb-8 pb-6 border-b border-[var(--color-border)]">
          Effective date: {LAST_UPDATED} · Applies to Fontainer web app and macOS desktop app.
        </p>

        {isPrivacy ? (
          <article className="space-y-7 text-[14px] leading-relaxed text-[var(--color-text-primary)]">
            <section className="space-y-2.5">
              <h2 className="text-[16px] font-semibold tracking-tight">1. Overview</h2>
              <p className="text-[var(--color-text-secondary)]">
                Fontainer is a font manager for web and macOS built with a local-first architecture. You can
                browse Google Fonts, preview local font files, organize lists, and inspect glyphs without
                creating an account. Signing in with Google is optional and used only to sync your font
                organization metadata across devices or read font files from your Google Drive when you
                explicitly request it.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-[16px] font-semibold tracking-tight">2. Information We Collect &amp; Store</h2>
              <ul className="list-disc pl-5 space-y-2 text-[var(--color-text-secondary)]">
                <li>
                  <strong className="text-[var(--color-text-primary)]">Google Account Profile (Optional Sign-In):</strong>{' '}
                  When you sign in with Google via Firebase Authentication, we receive your basic account
                  identifier (UID), display name, email address, and profile photo URL solely to authenticate
                  your session and display your account in the sidebar.
                </li>
                <li>
                  <strong className="text-[var(--color-text-primary)]">Workspace &amp; Organization Data (Optional Cloud Sync):</strong>{' '}
                  When signed in, Fontainer stores your custom Font Lists, Smart Lists, connected Adobe Fonts
                  Project IDs, font tags, notes, starred/activated flags, and workspace preferences in your
                  private Firestore user space so your library stays synced across devices.
                </li>
                <li>
                  <strong className="text-[var(--color-text-primary)]">Local &amp; Imported Font Files:</strong>{' '}
                  Font files you drag-and-drop or import from your computer (<code>.ttf</code>, <code>.otf</code>,{' '}
                  <code>.woff</code>, <code>.woff2</code>) are parsed locally in your browser/app memory using OpenType.js
                  and stored locally on your device. Your local font binaries are never uploaded to Fontainer servers.
                </li>
                <li>
                  <strong className="text-[var(--color-text-primary)]">AI Font Pairing Requests:</strong>{' '}
                  When you click <em>Suggest Pairings</em> in the Inspector, Fontainer sends only the selected
                  font’s metadata (family name, classification, weight list, chosen layout context, and any
                  optional mood notes you type) to our server-side Gemini API proxy to generate complementary
                  typography recommendations.
                </li>
              </ul>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-[16px] font-semibold tracking-tight">3. Google Drive Data &amp; Limited Use Compliance</h2>
              <p className="text-[var(--color-text-secondary)]">
                If you explicitly choose to connect Google Drive inside <em>Sources → Cloud Drives</em>,
                Fontainer requests read-only access (<code>https://www.googleapis.com/auth/drive.readonly</code>)
                exclusively to:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-[var(--color-text-secondary)]">
                <li>Search your Drive for font files (<code>.ttf</code>, <code>.otf</code>, <code>.woff</code>, <code>.woff2</code>).</li>
                <li>Download only the specific font files you choose to import directly into your local browser/app session for preview and inspection.</li>
              </ul>
              <p className="text-[var(--color-text-secondary)]">
                Your Google Drive OAuth access token is kept strictly in ephemeral in-memory state during your
                active session and is never written to cookies, local storage, or backend databases. Fontainer’s
                use and transfer to any other app of information received from Google APIs adheres to the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-[var(--color-text-primary)]"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements. We never sell, share, or use Google user data for
                advertising or model training.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-[16px] font-semibold tracking-tight">4. Third-Party Services</h2>
              <ul className="list-disc pl-5 space-y-1.5 text-[var(--color-text-secondary)]">
                <li><strong className="text-[var(--color-text-primary)]">Google Firebase:</strong> Authentication and per-user Firestore cloud sync.</li>
                <li><strong className="text-[var(--color-text-primary)]">Google Fonts &amp; Adobe Fonts (Typekit):</strong> Live webfont catalog metadata and font stylesheets loaded on demand.</li>
                <li><strong className="text-[var(--color-text-primary)]">Google Gemini API:</strong> Server-side typographic pairing analysis when triggered by the user.</li>
              </ul>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-[16px] font-semibold tracking-tight">5. Data Retention, Control &amp; Deletion</h2>
              <p className="text-[var(--color-text-secondary)]">
                You can reset local workspace data at any time from <em>Preferences</em>, revoke Fontainer’s
                Google access anytime via your{' '}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-[var(--color-text-primary)]"
                >
                  Google Account Permissions
                </a>
                , or request complete deletion of your synced cloud records by contacting us below.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-[16px] font-semibold tracking-tight">6. Contact</h2>
              <p className="text-[var(--color-text-secondary)]">
                For privacy questions or data deletion requests, contact the Fontainer developer at{' '}
                <a
                  href="mailto:idontwantyoutomailme@gmail.com"
                  className="underline text-[var(--color-text-primary)]"
                >
                  idontwantyoutomailme@gmail.com
                </a>
                .
              </p>
            </section>
          </article>
        ) : (
          <article className="space-y-7 text-[14px] leading-relaxed text-[var(--color-text-primary)]">
            <section className="space-y-2.5">
              <h2 className="text-[16px] font-semibold tracking-tight">1. Acceptance of Terms</h2>
              <p className="text-[var(--color-text-secondary)]">
                By accessing or using Fontainer (web application or macOS desktop application), you agree to
                these Terms of Service. If you do not agree, please discontinue use of the application.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-[16px] font-semibold tracking-tight">2. Font Licensing &amp; Intellectual Property</h2>
              <p className="text-[var(--color-text-secondary)]">
                Fontainer is a font management and preview utility and does not grant commercial or
                redistribution licenses for third-party typefaces. You are solely responsible for complying
                with the license terms of any fonts you preview, activate, import from your local device or
                Google Drive, or connect via Google Fonts (e.g., SIL OFL / Apache 2.0) or Adobe Fonts
                (Typekit Web Projects).
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-[16px] font-semibold tracking-tight">3. Acceptable Use</h2>
              <ul className="list-disc pl-5 space-y-1.5 text-[var(--color-text-secondary)]">
                <li>Do not abuse, scrape, or bypass rate limits on Fontainer’s API proxies or AI Font Pairing endpoint.</li>
                <li>Do not attempt to access another user’s cloud sync workspace or interfere with service stability.</li>
                <li>AI-generated font pairing suggestions are provided as creative guidance and may be reviewed before production use.</li>
              </ul>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-[16px] font-semibold tracking-tight">4. Availability &amp; Disclaimer</h2>
              <p className="text-[var(--color-text-secondary)]">
                Fontainer is provided on an “as is” and “as available” basis without warranties of any kind,
                express or implied. Third-party services including Google Fonts, Adobe Fonts, Google Drive,
                Firebase, and Gemini API are subject to their respective availability and terms.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-[16px] font-semibold tracking-tight">5. Limitation of Liability</h2>
              <p className="text-[var(--color-text-secondary)]">
                To the maximum extent permitted by law, Fontainer and its developers are not liable for any
                indirect, incidental, or consequential damages, including loss of local font files or design
                project assets. Always maintain backups of your original font files.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-[16px] font-semibold tracking-tight">6. Contact</h2>
              <p className="text-[var(--color-text-secondary)]">
                Questions about these Terms may be directed to{' '}
                <a
                  href="mailto:idontwantyoutomailme@gmail.com"
                  className="underline text-[var(--color-text-primary)]"
                >
                  idontwantyoutomailme@gmail.com
                </a>
                .
              </p>
            </section>
          </article>
        )}

        <footer className="mt-12 pt-6 border-t border-[var(--color-border)] flex items-center justify-between text-[12px] text-[var(--color-text-secondary)]">
          <span>© {new Date().getFullYear()} Fontainer</span>
          <div className="flex items-center gap-4">
            <a
              href="/privacy"
              onClick={(e) => handleNav(e, '/privacy')}
              className="hover:text-[var(--color-text-primary)] transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              onClick={(e) => handleNav(e, '/terms')}
              className="hover:text-[var(--color-text-primary)] transition-colors"
            >
              Terms of Service
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
};

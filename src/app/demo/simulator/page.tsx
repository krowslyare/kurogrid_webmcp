import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dual-Screen Live Parity Simulator · Kuro Agent",
  description: "Synchronized dual-surface WebMCP demonstration: Customer in-browser booking on left, Clinic Owner Copilot on right.",
};

export default function LiveParitySimulatorPage() {
  return (
    <div className="simulator-shell">
      <header className="simulator-topbar">
        <div className="simulator-brand-group">
          <Link href="/" className="simulator-home-link" aria-label="Back to home">
            <span className="simulator-mark" aria-hidden="true" />
            <strong>Kuro Agent</strong>
          </Link>
          <span className="simulator-divider" aria-hidden="true">/</span>
          <span className="simulator-page-title">Live Parity Simulator</span>
          <span className="simulator-sync-badge">
            <span className="simulator-sync-dot" />
            Real-time WebMCP Sync
          </span>
        </div>

        <div className="simulator-top-actions">
          <Link
            href="/sites/mimo-01"
            target="_blank"
            rel="noopener noreferrer"
            className="simulator-action-link"
          >
            Customer tab
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />
            </svg>
          </Link>
          <Link
            href="/demo"
            target="_blank"
            rel="noopener noreferrer"
            className="simulator-action-link"
          >
            Owner tab
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />
            </svg>
          </Link>
          <Link href="/demo" className="simulator-exit-btn">
            Exit to Demo Hub
          </Link>
        </div>
      </header>

      <div className="simulator-stage">
        <div className="simulator-pane simulator-pane-left">
          <div className="simulator-pane-bar">
            <div className="simulator-pane-info">
              <span className="simulator-pane-tag customer">Public Site</span>
              <span className="simulator-pane-url">/sites/mimo-01</span>
            </div>
            <span className="simulator-pane-role">Customer WebMCP · Talk to Mimo</span>
          </div>
          <iframe
            src="/sites/mimo-01"
            className="simulator-frame"
            title="Mimo Customer Website & WebMCP In-Browser Agent"
          />
        </div>

        <div className="simulator-stage-divider" aria-hidden="true">
          <span className="simulator-divider-handle" />
        </div>

        <div className="simulator-pane simulator-pane-right">
          <div className="simulator-pane-bar">
            <div className="simulator-pane-info">
              <span className="simulator-pane-tag clinic">Clinic Workspace</span>
              <span className="simulator-pane-url">/demo (Access: webmcphackaton)</span>
            </div>
            <span className="simulator-pane-role">Authenticated Owner · Mimo Copilot</span>
          </div>
          <iframe
            src="/demo"
            className="simulator-frame"
            title="Mimo Clinic Workspace & Owner Copilot"
          />
        </div>
      </div>
    </div>
  );
}

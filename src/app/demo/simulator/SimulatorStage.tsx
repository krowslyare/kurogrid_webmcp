"use client";

import Link from "next/link";
import { useState } from "react";

export function SimulatorStage() {
  const [leftKey, setLeftKey] = useState(0);
  const [rightKey, setRightKey] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const reloadLeft = () => {
    setLeftKey((prev) => prev + 1);
  };

  const reloadRight = () => {
    setRightKey((prev) => prev + 1);
  };

  const reloadBoth = () => {
    setIsSyncing(true);
    setLeftKey((prev) => prev + 1);
    setRightKey((prev) => prev + 1);
    setTimeout(() => setIsSyncing(false), 800);
  };

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
            <span className={`simulator-sync-dot ${isSyncing ? "is-pulsing" : ""}`} />
            {isSyncing ? "Synchronizing..." : "Real-time WebMCP Sync"}
          </span>
        </div>

        <div className="simulator-top-actions">
          <button
            type="button"
            className="simulator-action-btn"
            onClick={reloadBoth}
            title="Reload both customer and clinic panes"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Sync both panes
          </button>
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
              <span className="simulator-pane-role">Customer WebMCP · Talk to Mimo</span>
            </div>
            <div className="simulator-pane-controls">
              <button
                type="button"
                className="simulator-pane-btn"
                onClick={reloadLeft}
                title="Reload customer site pane"
                aria-label="Reload customer pane"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                Reload
              </button>
              <Link
                href="/sites/mimo-01"
                target="_blank"
                rel="noopener noreferrer"
                className="simulator-pane-btn"
                title="Open customer site in new tab"
                aria-label="Open in new tab"
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />
                </svg>
              </Link>
            </div>
          </div>
          <iframe
            key={`left-${leftKey}`}
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
              <span className="simulator-pane-url">/demo (Code: webmcphackaton)</span>
              <span className="simulator-pane-role">Authenticated Owner · Mimo Copilot</span>
            </div>
            <div className="simulator-pane-controls">
              <button
                type="button"
                className="simulator-pane-btn"
                onClick={reloadRight}
                title="Reload clinic workspace pane"
                aria-label="Reload clinic pane"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                Reload
              </button>
              <Link
                href="/demo"
                target="_blank"
                rel="noopener noreferrer"
                className="simulator-pane-btn"
                title="Open clinic workspace in new tab"
                aria-label="Open in new tab"
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />
                </svg>
              </Link>
            </div>
          </div>
          <iframe
            key={`right-${rightKey}`}
            src="/demo"
            className="simulator-frame"
            title="Mimo Clinic Workspace & Owner Copilot"
          />
        </div>
      </div>
    </div>
  );
}

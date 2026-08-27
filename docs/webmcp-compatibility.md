# WebMCP compatibility

WebMCP is an evolving browser proposal. This project targets the imperative API
under `document.modelContext.registerTool()` and uses `AbortSignal` to remove
stale registrations.

Baseline compatibility review: upstream commit
`41d12f057167ccf5954dbcf49d99502cb6c84491` from 2026-08-27.

Implementation work must record the exact upstream WebMCP commit used for each
compatibility review. Feature detection is required; unsupported browsers keep
the human UI functional and report that native tools are unavailable.

No unofficial bridge or polyfill is part of P0 unless challenge evaluation
requires one. Authentication and authorization remain application concerns;
the presence of WebMCP does not grant additional access.

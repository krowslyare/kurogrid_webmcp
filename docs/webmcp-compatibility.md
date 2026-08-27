# WebMCP compatibility

WebMCP is an evolving browser proposal. This project targets the imperative API
under `document.modelContext.registerTool()` and uses `AbortSignal` to remove
stale registrations.

Baseline compatibility review: upstream commit
`41d12f057167ccf5954dbcf49d99502cb6c84491` from 2026-08-27.

Gate 4 was implemented against that commit. Its current imperative contract is
`registerTool(tool, { signal })`, an async `execute(input, { signal })`
callback, JSON Schema input, and plain JSON-serializable results. Aborting the
registration signal removes the stale tool and causes the browser's native
`toolchange` lifecycle before the current profile is registered.

Implementation work must record the exact upstream WebMCP commit used for each
compatibility review. Feature detection is required; unsupported browsers keep
the human UI functional and report that native tools are unavailable.

No unofficial bridge or polyfill is part of P0 unless challenge evaluation
requires one. Authentication and authorization remain application concerns;
the presence of WebMCP does not grant additional access.

On 2026-08-27 the human workflow passed in Chrome 151.0.0.0, but the tested
Chrome profile exposed neither the current `document.modelContext` API nor the
deprecated `navigator.modelContext` API. Native registration therefore remains
an explicit smoke gate after enabling
`chrome://flags/#enable-webmcp-testing` and relaunching Chrome, as documented by
[Chrome for Developers](https://developer.chrome.com/docs/ai/webmcp/). The
application correctly kept the human UI functional and reported the missing
capability.

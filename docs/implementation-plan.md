# Implementation plan

## Gate 0 — foundation

- Public-safe repository contract and explicit non-goals
- Current stable Next.js, React, Tailwind, TypeScript, and Supabase clients
- Local-only Supabase configuration with default-deny table exposure
- Reproducible checks and dependency policy

## Gate 1 — identity and isolation

- Minimal organization, membership, and audit schema
- Cookie-based Supabase SSR clients using verified JWT claims
- Owner/member workspace resolved through RLS
- RLS plus direct Data API negative tests across two organizations
- Two concurrently isolated demo sessions and defined exhaustion behavior

Current status: schema, SSR clients, role-aware workspace, pgTAP coverage, and
direct Data API isolation tests are implemented. Sandbox allocation and its
exhaustion contract remain for the demo-runtime gate.

## Gate 2 — evidence and planning

- Synthetic evidence fixtures
- Attention read, acknowledgement, and fixed three-step action plan
- Owner/member WebMCP capability refresh tests

Current status: the tenant-scoped evidence model, non-communicating lead
acknowledgement, and atomic/idempotent fixed Action Plan are implemented. Demo
fixtures and WebMCP lifecycle behavior remain deliberately outside this gate.

## Gate 3 — publication

- Structured drafts with revision conflicts
- Exact preview and one-shot approval
- Idempotent publish, canonical version parity, version listing, and rollback
- Public-site WebMCP tools derived only from the published version

Current status: structured drafts, optimistic revision checks, deterministic
consequence previews, exact one-shot Owner approval, immutable versions,
idempotent publish/rollback, and the published-only public read contract are
implemented. Native WebMCP registration remains isolated to the next gate.

## Gate 4 — release audit

- Browser and accessibility QA
- Secret, provenance, dependency, and license review
- Threat-model and tenant-isolation evidence
- Only then decide whether to change repository visibility or deploy

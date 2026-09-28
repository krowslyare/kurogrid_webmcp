# WebMCP test scope

Mimo is a fictional clinic used to test browser-native tool discovery,
execution, and refresh as authentication and resource state change. The public
website and tools read the same current service, slot, and appointment state.

## Customer path

A visitor can inspect services and hours, find appointment slots, prepare a
request, review the exact details, and explicitly send it. A clinic proposal
remains the customer's decision. The public page remains usable without native
WebMCP support.

## Clinic path

An authenticated Owner can read the schedule, prepare availability from weekly
rules and normalized external busy intervals, inspect affected bookings and
alternatives, and apply the exact plan. Members can read and prepare within
their role but cannot perform Owner-only actions. Editorial drafts, publication
versions, and rollback provide a secondary tool-refresh example.

Tool registration follows the current session, role, organization, and resource
state. Every tool execution checks authorization again on the server. See
[security](security.md) and [WebMCP compatibility](webmcp-compatibility.md).

## Out of scope

This testbed does not provide calendar OAuth, background synchronization,
billing, a generic workflow engine, or private Kurogrid Portal compatibility.
All demo data is synthetic.

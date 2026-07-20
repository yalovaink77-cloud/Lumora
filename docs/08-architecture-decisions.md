# Architecture Decisions (ADR)

This document records foundational architecture decisions using standard ADR format. Each entry states status, context, decision, and consequences only.

---

## ADR-001: Modular Monolith First

**Status:** Accepted

**Context:** Lumora is being rebuilt from documentation after a full project loss. The team needs a structure that supports the documented domains (Family, Users, Family Members, Pregnancy, Child, Timeline, Media, Health, Permissions) without premature operational complexity.

**Decision:** Build Lumora as a modular monolith, organized around clear domain boundaries, rather than starting with distributed services.

**Consequences:** Development stays simpler and faster during recovery and MVP phases. Domain boundaries must be respected internally to avoid unnecessary coupling. Future extraction into separate services remains possible if a documented need arises.

---

## ADR-002: Mobile-First Product

**Status:** Accepted

**Context:** Lumora's primary experience centers on a mother's daily use, which favors accessibility, immediacy, and personal use patterns typical of mobile contexts.

**Decision:** Design and prioritize the product experience for mobile first, with other surfaces considered secondary until documented otherwise.

**Consequences:** Product decisions, scope, and priorities favor mobile usability. Any non-mobile experience must be justified by a documented product need. Consistency of core experience across future surfaces must be preserved.

---

## ADR-003: Family as the Root Aggregate

**Status:** Accepted

**Context:** The domain model defines Family as the container that scopes Users, Family Members, Pregnancy, Child, Timeline, Media, Health, and Permissions.

**Decision:** Treat Family as the root aggregate and primary privacy and access boundary for all other domains.

**Consequences:** All sensitive domains are scoped through Family membership and permissions. Cross-family access must be explicit and justified, never implicit. This decision reinforces the documented privacy and access-control principles.

---

## ADR-004: Pregnancy and Child are Separate Domains

**Status:** Accepted

**Context:** Pregnancy and Child represent distinct lifecycle stages with different context, sensitivity, and relevance, though one may transition into the other.

**Decision:** Model Pregnancy and Child as separate domains, connected by an explicit relationship rather than treated as a single combined entity.

**Consequences:** Each domain can evolve independently with stage-appropriate responsibilities. The transition from Pregnancy to Child must be handled as an explicit, documented relationship. Timeline, Media, and Health continue to reference the appropriate domain for their context.

---

## ADR-005: Documentation Before Code

**Status:** Accepted

**Context:** The previous project was lost with no surviving source code. Rebuilding without a disciplined process risks repeating undocumented, unrecoverable decisions.

**Decision:** Require that every material product or architectural decision be documented in `/docs` before implementation begins.

**Consequences:** Implementation work depends on documentation being current and authoritative. Undocumented assumptions must not drive development. This decision is the foundation for all other rules and guides in this repository.

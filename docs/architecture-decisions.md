# Reflex Platform — Architecture Decision Records

> **Date:** 2026-03-27
> **Synthesized from:** Product transcript, Engineering Spec v1.0, Run 1 Risk Matrix (R1–R20), Run 2 research (cloud platform, data architecture, API/backend, frontend/UX)
> **Purpose:** Queryable reference for every significant architectural decision — what was decided, why, what was rejected, and what risks each decision addresses.

---

## How to Use This Document

Each ADR follows a consistent structure:

- **Decision**: The choice that was made
- **Context**: Why this decision was needed
- **Options Considered**: Alternatives evaluated
- **Decision Rationale**: Why this option won
- **Consequences**: What this enables and constrains
- **Risks Mitigated**: Links to specific risks from the Run 1 Risk Matrix (R1–R20)

---

## ADR-01: Cloud Platform — Azure over AWS

**Decision:** Azure-primary with cloud-agnostic services where cost or flexibility matters (Claude via direct Anthropic API, GitHub Actions for CI/CD).

**Context:** Reflex needs to deploy edge agents in refinery DMZs, connect to PI historian systems, integrate with Teams (the dominant messaging platform in oil & gas), and do all of this on a student budget. The cloud platform choice is the foundation for every downstream infrastructure decision.

**Options Considered:**

| Option | Strengths | Weaknesses |
|--------|-----------|------------|
| **Azure** | First-party OPC-UA Publisher, PI Integrator for Azure (official AVEVA product), Defender for IoT (Purdue Model-aware), native Teams integration, $100/yr student credits | Local dev experience weaker than AWS/LocalStack, Azure Data Explorer overkill at $90+/mo |
| **AWS** | Larger community, simpler security (GuardDuty), Bedrock for Claude | No official PI integration, no OPC-UA Publisher equivalent, Teams bots still require Azure AD, no direct student credits since ~2022 |
| **GCP** | Strong ML/data tooling | Weakest industrial IoT ecosystem, minimal refinery industry presence |

**Decision Rationale:** Azure wins on the single most important dimension — industrial IoT connectivity. This is Reflex's hardest technical problem. Azure IoT Edge has a first-party OPC-UA Publisher module, PI Integrator for Azure is an official AVEVA product, Microsoft Defender for IoT provides Purdue Model-aware OT monitoring, and refineries are overwhelmingly Microsoft 365 / Teams shops. Student credits ($100/year + Microsoft for Startups up to $150K) make it cost-effective for a pilot.

**Consequences:**
- *Enables:* Native PI historian integration, Purdue Model-compliant edge deployment, first-party Teams bot development, OT-specific security monitoring
- *Constrains:* Weaker local development experience (mitigated with Docker Compose for local services), team must learn Azure-specific services alongside cloud-agnostic patterns

**Risks Mitigated:**
- **R6 (OT Security, Score 80):** Defender for IoT provides Purdue Model-aware monitoring; IoT Edge deploys in DMZ with outbound-only HTTPS
- **R2 (Delivery Channel, Score 125):** Azure Bot Service + Adaptive Cards gives native Teams structured input
- **R12 (PI Integration, Score 45):** PI Integrator for Azure is an official AVEVA product

---

## ADR-02: Programming Language & Backend Framework — Python 3.12 + FastAPI

**Decision:** Python 3.12 with FastAPI as the backend framework.

**Context:** The team consists of 3–5 university students. The backend must integrate with Excel COM automation (pywin32), Claude API (first-class Python SDK), process data analysis (pandas/numpy), and provide auto-generated API documentation. The language choice affects hiring, library availability, and learning curve.

**Options Considered:**

| Option | Strengths | Weaknesses |
|--------|-----------|------------|
| **Python + FastAPI** | Team knows Python; async native; Claude SDK first-class; pywin32 for Excel COM; pandas/numpy for reconciliation; auto-generated OpenAPI docs | GIL limits CPU-bound concurrency (mitigated by Celery workers) |
| **TypeScript + NestJS** | End-to-end type safety with frontend; strong async patterns | Team would need to learn TypeScript; no Excel COM support; weaker data science ecosystem |
| **Go** | Excellent performance; strong concurrency model | No Excel COM support; steeper learning curve; weaker ML/data library ecosystem |

**Decision Rationale:** Python is the only language that satisfies all constraints: the team already knows it, pywin32 provides Excel COM automation, the Anthropic Claude SDK is first-class, and pandas/numpy handle coefficient reconciliation and data analysis. FastAPI's async support, automatic OpenAPI documentation, and Pydantic validation reduce boilerplate while maintaining type safety at API boundaries.

**Consequences:**
- *Enables:* Direct Excel COM integration, first-class Claude SDK, rich data analysis libraries, auto-generated API docs, fast team onboarding
- *Constrains:* CPU-bound operations need Celery workers (already required for LP solver), GIL means no true thread-level parallelism for compute tasks

**Risks Mitigated:**
- **R1 (Excel COM, Score 125):** pywin32 + safexl provide COM automation with DispatchEx isolation
- **R5 (LLM Hallucination, Score 80):** Anthropic SDK + pandas enable deterministic number extraction pipeline

---

## ADR-03: Database — Single PostgreSQL 16 + TimescaleDB for Everything

**Decision:** Use a single PostgreSQL 16 instance with the TimescaleDB extension for all relational and time-series data. No separate time-series database.

**Context:** Reflex needs both relational data (users, constraints, LP models, audit logs) and time-series data (sensor readings, market prices, crack spreads). Nearly every intelligence feature (coefficient reconciliation, opportunity cost tracking, drift detection) requires JOINing time-series data with relational data.

**Options Considered:**

| Option | Strengths | Weaknesses |
|--------|-----------|------------|
| **PostgreSQL + TimescaleDB (single DB)** | One DB to operate; full SQL JOINs across data types; 90%+ compression; LISTEN/NOTIFY for events; RLS for multi-tenancy; standard SQL | Slightly less optimized for pure time-series workloads than purpose-built TSDB |
| **PostgreSQL + InfluxDB Cloud** | InfluxDB free tier; Telegraf OPC-UA plugin | Two databases to manage; no JOINs across databases; cross-DB queries require data duplication; InfluxDB v3 maturity concerns |
| **PostgreSQL + Azure Data Explorer** | Excellent anomaly detection; KQL powerful | $90+/mo minimum cluster; overkill for 100 tags |
| **PostgreSQL + QuestDB** | High ingestion performance | Less mature ecosystem; limited extension support |

**Decision Rationale:** At 150 tags × 1 reading/second = 150 rows/second, TimescaleDB handles this easily (designed for 100K+ rows/second). One database eliminates operational overhead of running, monitoring, and backing up a second system. Full SQL JOINs between time-series and relational data are required for coefficient reconciliation, opportunity cost tracking, constraint pattern analysis, and drift detection — these would require cross-database data movement with a separate TSDB. Azure for Students provides free PostgreSQL hosting for 12 months. The Telegraf OPC-UA plugin advantage of InfluxDB is irrelevant since Reflex uses PI Web API, not OPC-UA.

**Consequences:**
- *Enables:* Standard SQL JOINs across all data; single backup/monitoring strategy; hypertable compression (90%+); continuous aggregates for dashboards; LISTEN/NOTIFY for event-driven processing; Row-Level Security for multi-tenancy
- *Constrains:* No purpose-built anomaly detection (available if migrating to ADX at 10+ sites in Phase 3+); team must learn TimescaleDB-specific concepts (hypertables, compression policies, continuous aggregates)

**Risks Mitigated:**
- **R9 (Alert Fatigue, Score 64):** Continuous aggregates power efficient drift detection and rolling baseline calculations
- **R8 (Union/Dashboard, Score 64):** RLS enforces audience separation — management role architecturally prevented from querying operator-level override data

**Storage Estimate:** ~140 MB/year per site at 1-minute sensor intervals with 90% compression. A $20–50/month managed PostgreSQL instance is more than sufficient.

---

## ADR-04: Architecture Pattern — Modular Monolith over Microservices

**Decision:** Build as a modular monolith for Phases 1–3 (1–5 customers), with one external Windows LP Worker process.

**Context:** Architecture must be right-sized for a team of 3–5 students serving 1–3 customers initially, while allowing future extraction of modules into services if scaling demands it.

**Options Considered:**

| Factor | Microservices | Modular Monolith |
|--------|--------------|-------------------|
| Team size (3–5 students) | Requires DevOps expertise for service mesh, distributed tracing, independent deployments | Single deployment, single repo, shared database |
| Customers (1–3) | Over-engineered for scale that doesn't exist | Right-sized for early stage |
| Operational overhead | N services × (logging + monitoring + deployment + versioning) | One service, one deployment pipeline |
| Debugging | Distributed tracing, correlation IDs, network partitions | Stack traces, local debugging, single process |
| Data consistency | Saga patterns, eventual consistency | ACID transactions across modules |
| Cost | N containers, service discovery, API gateway | One container, one database |

**Decision Rationale:** The only argument for microservices is the LP Orchestrator (Windows-only COM automation), which inherently runs on a separate machine. This is handled as a single external worker via Celery, not a full microservices architecture. Clean module boundaries (defined Python interfaces, each module owns its tables, internal event bus) allow extraction when needed.

**When to Extract:** When a module needs to scale independently (10+ concurrent LP solves), needs a different runtime (LP Worker already does), has different availability requirements, or when the team is large enough that independent deployment reduces coordination cost.

**Consequences:**
- *Enables:* ACID transactions across modules, in-process function calls (no network latency), simple debugging with stack traces, single deployment pipeline, minimal DevOps overhead
- *Constrains:* All modules must share a deployment schedule; cannot scale modules independently until extracted; language/runtime shared across modules (except LP Worker)

**Risks Mitigated:**
- **R4 (Team Credibility, Score 100):** Simpler architecture means faster iteration and fewer operational failures during critical early customer demos

---

## ADR-05: Edge/Cloud Split — Lightweight Python Edge Agent in Customer DMZ

**Decision:** Deploy a lightweight Python Docker container (~60 MB) in the customer's DMZ at Purdue Level 3.5. The edge agent reads from PI historian replicas via PI Web API and pushes data outbound via HTTPS. No inbound firewall rules ever required. Azure IoT Edge is the Phase 3+ migration target.

**Context:** Refineries enforce strict Purdue Model network segmentation (R6, Score 80). Cloud tools cannot directly connect to OT historians. All data must flow through a DMZ via historian replicas. Some sites use hardware data diodes (physically one-way). Security approval takes 6–18 months.

**Options Considered:**

| Option | Strengths | Weaknesses |
|--------|-----------|------------|
| **Lightweight Python Docker** | Simple to deploy and debug; ~60 MB image; minimal DMZ footprint; team already knows Python | No built-in module orchestration; manual updates |
| **Azure IoT Edge** | Module management at scale; nested edge support; OPC-UA Publisher; store-and-forward | Significant complexity for single-site pilot; heavier footprint; steeper learning curve |
| **Seeq as data layer** | Rich analytics capabilities | $100K+/year; overkill for data collection; adds vendor dependency for core data access |

**Decision Rationale:** The core data flow (PI Web API → validate → HTTPS push) doesn't need IoT Edge's module orchestration for 1–5 sites. A ~60 MB Python container is simpler to deploy and debug in a customer DMZ. IoT Edge becomes valuable at 10+ sites when module management, nested edge, and OPC-UA Publisher matter.

**Edge Agent Components:**
1. **PI Reader:** Polls PI Web API StreamSets every 30–60 seconds for all configured tags (one HTTPS request returns 100+ tag values)
2. **Data Quality Gateway:** Validates every reading (staleness, range, rate-of-change, digital states, compression artifacts)
3. **SQLite Buffer:** Store-and-forward for network resilience — readings buffer locally when cloud is unreachable
4. **Cloud Push:** Batches readings into HTTPS POST requests (outbound only)

**Consequences:**
- *Enables:* Simple deployment in restrictive DMZ environments; outbound-only HTTPS (data diode compatible); read-only historian access; minimal attack surface; fast iteration during pilot
- *Constrains:* Manual update process until IoT Edge migration; no built-in nested edge support; no OPC-UA Publisher (using PI Web API instead)

**Risks Mitigated:**
- **R6 (OT Security, Score 80):** Outbound-only HTTPS, read-only access, never writes to OT systems, data diode compatible
- **R12 (PI Integration, Score 45):** Direct PI Web API access via StreamSets endpoint for bulk reads
- **R13 (Historian Compression, Score 36):** Data Quality Gateway detects compression artifacts before data reaches trigger logic

---

## ADR-06: AI/LLM Provider — Claude API (Direct Anthropic) with Numbers Decoupled

**Decision:** Use Claude API via direct Anthropic SDK. Claude handles ONLY natural language formatting — all numbers are programmatically extracted and cross-validated. Deterministic template fallback for LLM downtime.

**Context:** The product transcript envisioned Claude "processing the raw mathematical output from the LP." Research revealed that LLMs repeat or fabricate numerical errors in up to 83% of cases when errors are present in source material (R5, Score 80). A single hallucinated number in a refinery context ("2.3 MBPD" misread as "23 MBPD") is dangerous and destroys trust permanently.

**Options Considered:**

| Option | Strengths | Weaknesses |
|--------|-----------|------------|
| **Direct Anthropic Claude API** | Provider-agnostic; no cloud lock-in; Haiku for routine (~$0.001/call), Sonnet for complex (~$0.005/call); first-class Python SDK | Separate billing from Azure; no native Azure monitoring |
| **Azure OpenAI (GPT-4)** | Native Azure integration; single billing | Locks to Azure; adds complexity; not committed to Claude; GPT-4 not demonstrably better for this use case |
| **AWS Bedrock (Claude)** | Single AWS billing; same Claude models | Locks to AWS; choosing Azure for other reasons |
| **No LLM (templates only)** | Zero hallucination risk; simplest | Loses natural language context; recommendations feel robotic |

**Decision Rationale:** Claude API works identically from both clouds. Reflex uses Claude for a simple pattern: receive pre-validated numbers + context → generate plain-English recommendation. This doesn't justify cloud lock-in. The critical architectural choice is decoupling numbers from the LLM entirely:

**Translation Pipeline:**
```
LP Output → Deterministic Number Extraction (Python) → Delta Calculation (Python)
  → Template Selection → Claude API Call → Number Cross-Validation → Recommendation
  → Template Fallback (if validation fails or API is down)
```

**Consequences:**
- *Enables:* Plain-English recommendations that operators can read in 30 seconds; natural language context ("crack spreads widened because Gulf Coast demand surged"); cloud-agnostic deployment
- *Constrains:* All numbers must be programmatically extracted before Claude sees them; every number in Claude's output must be cross-validated; template fallback must produce equivalent actionable information

**Cost Projection:**
| Scale | Monthly Cost | % of Revenue |
|-------|-------------|-------------|
| 1 site (pilot) | $7–18 | N/A |
| 10 sites | $70–180 | <0.03% of $750K+ ARR |
| 50 sites | $350–900 | <0.03% of $3.75M+ ARR |

**Risks Mitigated:**
- **R5 (LLM Hallucination, Score 80):** Numbers never touch the LLM; cross-validation catches any introduced errors; template fallback eliminates single point of failure
- **R14 (Algorithm Aversion, Score 36):** Deterministic numbers + validated prose prevents the "one bad recommendation" trust-destroying event

---

## ADR-07: Message Delivery Channel — Teams/Slack/Email with Structured Input

**Decision:** Three delivery channels: (1) Teams Adaptive Cards with structured 5-tap input for supervisors (primary), (2) Slack Block Kit for engineers/planners (alternative), (3) Email as universal fallback. Web dashboard for complex interactions. Primary user redefined as shift supervisor and process engineer — not field operator.

**Context:** The product transcript assumed "deliver recommendations directly to operators via Slack or Teams. No new software to log into, no training required." Three independent research threads (R2, Score 125) converged on the conclusion that this is physically impossible: control rooms run DCS consoles, not chat apps; process areas are ATEX hazardous zones where standard phones cannot be carried; chemical-resistant gloves make phone keyboards unusable; voice-to-text degrades to ~65% accuracy at industrial noise levels.

**Options Considered:**

| Option | Strengths | Weaknesses |
|--------|-----------|------------|
| **Slack/Teams for field operators** | Original concept; "no training required" | Physically impossible in ATEX zones; gloves prevent typing; WiFi spotty across 3–4 sq mile sites; Teams IT approval takes 2–8 weeks |
| **DCS console integration** | Reaches actual control room operators | Per-vendor integration (Honeywell, Yokogawa, Emerson); years of development; not MVP-viable |
| **Teams/Slack for supervisors + structured input** | Supervisors have desk + IT access; structured input eliminates NLP errors; email fallback ensures delivery | Doesn't reach field operators directly (mitigated: info flows through supervisor, which is how refineries already work) |

**Decision Rationale:** Redefining the primary user as the shift supervisor and process engineer (who works at a desk with IT network access) solves the delivery problem entirely. This matches how refineries actually work — supervisors relay decisions to field operators via existing channels (radio, DCS console, face-to-face). Structured 5-tap input (select unit → select constraint type → select severity → confirm) eliminates NLP extraction failures (46–85% accuracy) with 100% structured data accuracy.

**Consequences:**
- *Enables:* Reliable delivery via existing IT infrastructure; 100% accuracy on constraint capture; glove-compatible interaction (64px+ tiles); MOC-compliant onboarding
- *Constrains:* Field operators interact with Reflex indirectly through supervisors; DCS console integration deferred to Phase 3+; per-customer Teams IT approval required (budget 2–8 weeks)

**Risks Mitigated:**
- **R2 (Delivery Channel, Score 125):** Supervisors have desk + IT access; three delivery channels ensure at least one works
- **R5 (LLM/NLP, Score 80):** Structured input eliminates NLP extraction failures entirely
- **R7 (OSHA/MOC, Score 80):** Phased onboarding (shadow mode → guided → full) replaces "no training required" claim

---

## ADR-08: Excel Integration — COM Automation with Watchdog + Python LP Escape Hatch

**Decision:** Use safexl + pywin32 for Excel COM automation on a separate Windows VM, with a process-level watchdog for hang detection and zombie cleanup. Parallel investment in PuLP + HiGHS as a strategic escape hatch from Excel dependency.

**Context:** The entire Reflex value proposition requires automated, reliable, unattended Excel execution. But Microsoft explicitly does not support server-side Excel automation (R1, Score 125). Documented failure modes include modal dialog hangs, zombie processes, 50GB memory leaks, clipboard crashes, and deadlocks. 32-bit Excel (still common) caps at 2GB RAM.

**Options Considered:**

| Option | Strengths | Weaknesses |
|--------|-----------|------------|
| **safexl + pywin32 COM** | Works with existing customer Excel models; preserves years of LP model tuning; safexl context manager guarantees COM cleanup | Microsoft explicitly unsupported; modal dialog hangs; zombie processes; single-threaded |
| **xlwings** | Cleaner Python API; commercial support | Less control over COM lifecycle; still subject to same COM failures |
| **Replace Excel with Python LP** | Eliminates COM risk entirely; cross-platform; sub-second solves | Requires customers to migrate models; years of tuning lost; adoption barrier |
| **LibreOffice headless** | Open source; no COM | Cannot run VBA macros or Excel Solver add-ins; breaks customer models |

**Decision Rationale:** Customers have spent years (sometimes decades) tuning their Excel LP models. Requiring migration is an adoption barrier that kills deals. COM automation with robust safeguards (DispatchEx for isolation, DisplayAlerts=False, 5-minute hard timeout, watchdog, zombie cleanup, queue backpressure) makes it workable. The LP Worker runs on a separate Windows VM via Celery — isolated from the main Linux platform. PuLP + HiGHS investment begins in parallel as a strategic migration path offered as a professional service.

**LP Worker Safeguards:**
- DispatchEx for isolated COM instances
- DisplayAlerts = False (suppress all modal dialogs)
- Watchdog checks every 30 seconds for hung Excel
- 5-minute hard timeout per solve
- Zombie EXCEL.EXE cleanup every 60 seconds
- Max 3 consecutive failures before Excel restart
- Queue backpressure: coalesce when queue depth > 3

**Consequences:**
- *Enables:* Works with existing customer Excel LP models unchanged; preserves decades of tuning; no customer migration needed
- *Constrains:* Requires Windows VM (cannot containerize on Linux); single-threaded per VM; inherently fragile (mitigated by watchdog + fallback); solve time floor of 30s–7min

**Risks Mitigated:**
- **R1 (Excel COM, Score 125):** Watchdog, timeout, zombie cleanup, queue backpressure, process isolation
- **R3 (Proprietary LP Solvers, Score 100):** LP model config is JSONB-driven and solver-agnostic at the orchestration layer; can support PIMS/GRTMPS if market demands

---

## ADR-09: Historian Connectivity — Direct PI Web API over HTTPS

**Decision:** Connect directly to PI Web API over HTTPS with Basic Auth. Use StreamSets endpoint for bulk current-value reads (100+ tags per call). No Seeq dependency. No OPC-UA at the edge.

**Context:** Mid-size refineries overwhelmingly use OSIsoft PI (now AVEVA) as their process historian. The product transcript suggested connecting "through an integration layer like Seeq." Research revealed Seeq is an enterprise analytics layer costing $100K+/year — overkill for data collection.

**Options Considered:**

| Option | Strengths | Weaknesses |
|--------|-----------|------------|
| **PI Web API (REST, HTTPS, Basic Auth)** | Explicitly designed for DMZ access; StreamSets for bulk reads; well-documented; free (included with PI license) | Basic Auth requires HTTPS (always used); per-customer WebID resolution |
| **Seeq** | Rich analytics; pattern detection | $100K+/year; overkill for data collection; vendor dependency for core data access |
| **OPC-UA direct** | Industry standard; real-time | Lives at Purdue Level 2–3, not in DMZ; connecting directly to PLCs is against Reflex's read-only principle |
| **PI Integrator for Azure** | Official AVEVA product; streams to Event Hubs | Not all customers have it; adds dependency; available as optional enhancement |

**Decision Rationale:** PI Web API is the REST interface explicitly designed for DMZ access at Purdue Level 3.5. One HTTPS GET to the StreamSets endpoint returns all 100+ tag values in a single call. Basic Auth over TLS is simple and sufficient for DMZ deployments. Seeq integration can be added later as an optional analytics layer without architectural changes.

**Consequences:**
- *Enables:* Simple REST integration; bulk reads (100+ tags per call); works in any PI deployment with Web API enabled; zero licensing cost
- *Constrains:* Requires PI Web API to be enabled and accessible in DMZ (standard configuration); WebID resolution needed per deployment; Kerberos may be required in some Windows-domain environments

**Risks Mitigated:**
- **R6 (OT Security, Score 80):** PI Web API operates at Level 3.5 (DMZ); read-only access to historian replicas
- **R12 (PI Integration, Score 45):** Well-documented REST API with known patterns; avoids vendor lock-in

---

## ADR-10: Authentication Strategy — JWT + API Keys + RLS Multi-Tenancy

**Decision:** JWT tokens for user authentication (1-hour expiry, refresh tokens), per-agent API keys for edge agents, PostgreSQL Row-Level Security for multi-tenant data isolation.

**Context:** Reflex serves multiple refinery sites from a shared cloud infrastructure. Each site's data must be strictly isolated. Different user roles (admin, LP planner, shift supervisor, management) have different data access levels — critically, the management role must be architecturally prevented from seeing individual operator override costs (R8).

**Options Considered:**

| Option | Strengths | Weaknesses |
|--------|-----------|------------|
| **JWT + RLS** | Stateless auth; role claims in token; database-enforced isolation; API does not return restricted data | RLS adds query overhead (negligible at this scale); requires careful policy design |
| **Application-level filtering** | Simpler to implement initially | Bug in filtering = data leak; not architecturally enforced; harder to audit |
| **Separate databases per tenant** | Strongest isolation | Operational complexity; no cross-site analytics; overkill for 1–10 sites |

**Authentication Flows:**
1. Edge Agent → Cloud: API key (unique per agent, rotatable, stored in Key Vault)
2. User → Dashboard: JWT tokens (1-hour expiry, refresh tokens)
3. Dashboard → SSE: JWT on SSE endpoint
4. Bot → Teams/Slack: Azure Bot Service managed auth
5. Inter-module: In-process function calls (no auth needed within monolith)

**Role Matrix:**

| Role | Operations Dashboard | Analytics Dashboard | Admin | Constraint Input | Financial Data |
|------|---------------------|--------------------|----|-----------------|----------------|
| Admin | Full | Full | Full | Yes | Full |
| LP Planner | Full | Full | Trigger config only | Yes | Full |
| Shift Supervisor | Full | "Value captured" KPIs only | No | Yes | Gain-framed only |
| Management | View only | Full (by equipment, never by operator) | No | No | Full |

**Consequences:**
- *Enables:* Multi-tenant data isolation at the database level; role-based access control; architectural enforcement of R8 (management cannot see operator-level data); audit trail
- *Constrains:* JWT expiry means edge agents need key rotation strategy; RLS policies must be maintained alongside schema changes

**Risks Mitigated:**
- **R8 (Union/Dashboard, Score 64):** RLS + API design architecturally prevent management role from accessing individual operator override costs
- **R7 (OSHA/MOC, Score 80):** Complete audit trail (every event with timestamp, actor, details) supports MOC documentation

---

## ADR-11: Deployment Model — Azure Container Apps + GitHub Actions CI/CD

**Decision:** Azure Container Apps (always-free tier) for the main application. Separate Azure B2s Windows VM for LP Worker. GitHub Actions for CI/CD. Docker Compose for local development.

**Context:** The backend architecture research suggested Railway/Render for Phase 1–2 simplicity. The cloud platform recommendation proposed Azure Container Apps. Since Azure Bot Service (Teams integration) requires Azure anyway, and Container Apps has an always-free tier, starting on Azure avoids a migration.

**Options Considered:**

| Option | Strengths | Weaknesses |
|--------|-----------|------------|
| **Azure Container Apps** | Always-free tier (2M req + 180K vCPU-s/mo); student credits cover overages; no migration from Railway later; blue-green deploy via revisions | Azure-specific; slightly steeper initial setup |
| **Railway / Render** | Simpler initial deployment; better DX | Migration to Azure later; no free tier equivalent; Teams bot still needs Azure |
| **Azure Kubernetes Service** | Full Kubernetes flexibility | Massive overkill; operational complexity; expensive minimum |

**Deployment Pipeline:**
```
Developer pushes to GitHub → GitHub Actions CI
  → Lint (ruff) + Type check (mypy) + Unit tests (pytest)
  → Frontend: lint + type check + Vitest + Playwright E2E
  → Build Docker images
  → Merge to main → Auto-deploy to staging
  → Run integration tests → Manual promotion to production
```

**Consequences:**
- *Enables:* Zero-cost pilot infrastructure; blue-green deploys; same platform from pilot to production; GitHub Student Pack for CI minutes
- *Constrains:* Team must learn Azure Container Apps; Windows LP Worker requires separate VM management

**Risks Mitigated:**
- Cost risk mitigated: Year 1 total infrastructure $8–75/month, covered by student credits
- **R4 (Team Credibility, Score 100):** Professional deployment pipeline builds customer confidence during demos

---

## ADR-12: Frontend Framework — Next.js 15 + React 19 + TypeScript

**Decision:** Next.js 15 with React 19, TypeScript, and an industrial-grade component stack (Mantine v7 + Shadcn/ui for components, ECharts + Tremor for charting, TanStack Query + Zustand for state, Tailwind CSS for styling).

**Context:** The dashboard must render on potentially slow control-room network connections, display real-time data, follow ISA-101 High Performance HMI principles, and be buildable by a student team. Type safety is critical because a numerical display error in a safety-critical environment destroys trust (R5).

**Options Considered:**

| Option | Strengths | Weaknesses |
|--------|-----------|------------|
| **Next.js + React + TypeScript** | SSR for slow networks; App Router for multi-dashboard layout; Server Components reduce bundle; type safety prevents numerical display errors | Steeper than plain React |
| **Vue / Nuxt** | Simpler learning curve | Smaller ecosystem for industrial charting; fewer pre-built data-dense components |
| **SvelteKit** | Excellent performance | Smaller talent pool; minimal industrial dashboard precedent |
| **Plain React SPA** | Simplest | Loses SSR benefits; no built-in routing optimization |

**Design Principles (ISA-101 + ISA-18.2 compliance):**
- Greyscale backgrounds — color for deviation only
- 3-second rule — any screen conveys primary status without reading text
- Progressive disclosure — status → details → diagnostics
- Monospace numbers (JetBrains Mono / IBM Plex Mono) — prevents misreading
- Consistent spatial positioning — elements never reflow
- Target 1–2 recommendations per shift
- No color-blind-dependent information — shape + color + text label always

**Consequences:**
- *Enables:* Fast initial loads on slow networks (SSR); type safety from API response to rendered number; multi-monitor support (detachable routes); ISA-101 compliant design
- *Constrains:* Team must learn Next.js App Router patterns; TypeScript overhead; heavier toolchain than vanilla React

**Risks Mitigated:**
- **R5 (LLM Hallucination, Score 80):** TypeScript type safety from API to render; all numbers in monospace font, programmatically rendered (never LLM-generated)
- **R9 (Alert Fatigue, Score 64):** Operating mode as permanent first-class UI element; auto-suppress optimization during non-normal modes
- **R8 (Dashboard Blame, Score 64):** Role-based views architecturally enforced; management never sees individual operator data

---

## ADR-13: Real-Time Communication — SSE over WebSocket

**Decision:** Server-Sent Events (SSE) as the primary real-time channel, with HTTP polling fallback at 30-second intervals.

**Context:** The dashboard needs real-time updates for recommendations and operating mode changes, but the data flow is unidirectional (server → client). Operators submit constraints via HTTP POST, not through the streaming connection. Corporate proxies and firewalls in OT-adjacent IT networks frequently block WebSocket connections.

**Options Considered:**

| Option | Strengths | Weaknesses |
|--------|-----------|------------|
| **SSE** | Unidirectional (matches data flow); works through corporate proxies; built-in browser reconnection; HTTP/2 multiplexing; simpler to implement | No bidirectional communication (not needed) |
| **WebSocket** | Bidirectional; slightly lower latency | More complex; blocked by some corporate proxies; manual reconnection logic; overkill for 1–2 messages per shift |
| **HTTP Polling only** | Simplest; works everywhere | Higher latency; more server load; unnecessary requests |

**Update Strategy:**

| Data Type | Strategy | Rationale |
|-----------|----------|-----------|
| Live recommendations | SSE stream | Must be immediate; 1–2 per shift |
| Operating mode changes | SSE stream | Must propagate instantly |
| Constraint updates | SSE stream | Moderate frequency |
| Sensor health | HTTP polling (60s) | Monitoring cadence |
| Analytics data | HTTP polling (5m) | Not time-critical |
| Site config | On-demand fetch | Rarely changes |

**Consequences:**
- *Enables:* Real-time recommendation delivery; instant operating mode propagation; works through corporate proxies; built-in reconnection
- *Constrains:* Unidirectional only (all user input via HTTP POST); SSE heartbeat every 20 seconds to prevent firewall timeouts

**Risks Mitigated:**
- **R2 (Delivery Channel, Score 125):** SSE works through corporate proxies that block WebSocket — critical for OT-adjacent IT networks

---

## ADR-14: Trigger Engine Design — Percentage-Based, Mode-Gated, Debounced

**Decision:** Two trigger types (process drift and price movement) using percentage-based thresholds relative to trailing averages. All triggers gated by operating mode (suppressed during non-normal modes). Hysteresis, debounce (2-minute minimum persistence), and cooldown (60-minute minimum between triggers). Hard cap: 3 triggers per 12-hour shift.

**Context:** The product transcript proposed a fixed $2/bbl crack spread threshold that fires continuously. Research revealed this causes over-triggering in volatile markets (8–20% of normal spread but only ~5% of elevated spread) and generates meaningless recommendations during shutdowns/startups when operators are under maximum cognitive load (50% of safety incidents occur during these transitions).

**Options Considered:**

| Option | Strengths | Weaknesses |
|--------|-----------|------------|
| **Fixed dollar threshold** | Simple to understand | Over-triggers in volatile markets; under-triggers in stable markets; no mode awareness |
| **Percentage-based + mode-gated** | Adapts to market regime; suppresses during non-normal operations; debounce prevents transient spikes | More complex configuration; requires operating mode detection |
| **ML-based anomaly detection** | Adaptive; learns patterns | Black box; harder to explain to operators; requires training data; overkill for MVP |

**Trigger Configuration:**
```python
min_interval_minutes: 60        # no re-trigger within 60 min
max_triggers_per_shift: 3       # hard cap per 12-hour shift
coalesce_window_minutes: 5      # batch triggers within 5 min into one solve
mode_gate: [NORMAL]             # only fire in Normal mode
```

**Operating Modes (first-class concept):**
Normal | Startup | Shutdown | Upset | Turnaround | Emergency

Mode detection via: manual operator override (always respected), automatic detection (>30% sensors changing simultaneously, key unit status tags, rapid throughput decrease), and scheduled turnaround windows.

**Consequences:**
- *Enables:* Recommendations that operators actually trust; adapts to market conditions; prevents alert floods during critical transitions; traceable trigger logic
- *Constrains:* More complex configuration per site; operating mode detection requires tuning per deployment

**Risks Mitigated:**
- **R9 (Alert Fatigue, Score 64):** Mode-gated suppression, debounce, cooldown, and hard cap prevent alert storms
- **R14 (Algorithm Aversion, Score 36):** Avoiding false recommendations during the first shutdown event preserves operator trust
- **R1 (Excel COM, Score 125):** Queue backpressure and coalescing handle the case where solve time exceeds trigger interval

---

## ADR-15: Constraint Extraction — Structured 5-Tap Input over NLP

**Decision:** Replace free-text NLP constraint extraction with a structured 5-tap wizard: select unit (1 tap) → select constraint type (1 tap) → select specific constraint (1 tap) → select severity with predefined magnitudes (1 tap) → confirm (1 tap). NLP retained as fallback with mandatory human confirmation. Constraints never auto-applied.

**Context:** The product transcript envisioned operators typing free-text messages like "can't push unit 2, heat exchanger 201 is fouling" — Reflex would extract the constraint via NLP. Research revealed NLP constraint extraction achieves only 46–85% accuracy on complex industrial problems (R5), with the core problem being missing quantitative information — the operator didn't specify whether fouling means 5% or 35% capacity reduction. Additionally, chemical-resistant gloves make typing physically impossible.

**Options Considered:**

| Option | Strengths | Weaknesses |
|--------|-----------|------------|
| **Structured 5-tap wizard** | 100% accuracy; works with PPE/gloves (64px+ tiles); eliminates missing quantitative information; 15–30 seconds total | Less flexible than free-text; requires pre-configured constraint options per site |
| **Free-text NLP extraction** | Natural interaction; flexible | 46–85% accuracy; missing quantitative data; typing impossible in gloves; auto-applied constraints are dangerous |
| **Voice input** | Hands-free | 65% accuracy at industrial noise levels; accent/dialect challenges; still needs quantitative extraction |

**5-Tap Flow:**
1. Select unit (large tiles: Unit 2 CDU, Unit 3 FCC, Unit 4 HCU, etc.)
2. Select constraint type (Equipment Issue, Feed Quality, Safety/Environmental, Staffing)
3. Select specific constraint (filtered by unit + type: HX-201 Fouling, Feed pump cavitation, etc.)
4. Select severity (5%, 10%, 15%, 20%, Custom) + duration (This shift, 24h, Until cleared, Custom)
5. Confirm summary + optional photo or voice note

**Consequences:**
- *Enables:* 100% structured data accuracy vs. 46–85% NLP accuracy; works with PPE; solves "missing quantitative information" problem; 15–30 second interaction; full audit trail
- *Constrains:* Constraint options must be pre-configured per site (part of onboarding); less flexible for truly novel constraint types (mitigated by "Other" option with free-text + confirmation)

**Risks Mitigated:**
- **R5 (LLM/NLP Extraction, Score 80):** Structured input eliminates NLP failure modes entirely
- **R2 (Delivery Channel, Score 125):** 64px+ tiles are glove-compatible; works on any screen size
- **R7 (OSHA/MOC, Score 80):** Every constraint is timestamped, tagged, and has a clear severity — supports MOC audit requirements

---

## ADR-16: Multi-Tenancy Model — Single Database with Row-Level Security

**Decision:** All customer sites share a single PostgreSQL database with Row-Level Security (RLS) policies enforcing strict data isolation via `site_id` on every table. JWT tokens carry `site_ids` and roles.

**Context:** Reflex will serve 1–10+ refinery sites from shared cloud infrastructure. Each site's process data, constraints, and recommendations must be strictly isolated. Some user roles (fleet managers) may need cross-site access.

**Options Considered:**

| Option | Strengths | Weaknesses |
|--------|-----------|------------|
| **Single DB + RLS** | Simple to operate; enables cross-site analytics for fleet managers; standard PostgreSQL feature; audit-friendly | RLS policy maintenance; must be tested rigorously; shared resource contention at extreme scale |
| **Database-per-tenant** | Strongest isolation; independent scaling | Operational nightmare at 10+ tenants for a student team; no cross-site queries; backup/migration complexity |
| **Schema-per-tenant** | Good isolation within one DB | Migration complexity; connection pooling challenges; less tooling support |

**Decision Rationale:** At 1–10 sites, operational simplicity dominates. RLS is a mature PostgreSQL feature that enforces isolation at the database engine level — it cannot be bypassed by application bugs. Every table includes `site_id`, and RLS policies ensure users only see data for their authorized sites. Fleet managers get cross-site access by having multiple `site_ids` in their JWT claims.

**Consequences:**
- *Enables:* Simple operations; cross-site analytics; fleet-level dashboards; standard backup/restore; easy horizontal scaling of sites
- *Constrains:* Shared database resources; RLS policies must be maintained and tested; theoretical risk of noisy-neighbor (negligible at this data volume)

**Risks Mitigated:**
- **R8 (Union/Dashboard, Score 64):** RLS enforces audience separation at the database level — management queries physically cannot return operator-level override data

---

## ADR-17: Opportunity Cost Dashboard — Gain Framing, Equipment-Level, Audience-Separated

**Decision:** Track overrides by equipment/unit, NEVER by individual operator. Management sees financial summaries with "value captured" gain framing ("$1.2M captured, 82% capture rate"). Operators see recommendations and constraint status, never individual override costs. Override data contractually restricted from use in performance evaluation.

**Context:** The product transcript described "a rolling 30 or 90-day dashboard showing exactly how much money is bleeding out through the friction between the theoretical model and the physical operations." Research revealed this loss-framing approach decreases performance ~33% of the time (R8). The USW is actively bargaining over AI in refineries; NLRB's 2022 memo establishes that AI surveillance affecting working conditions is a mandatory bargaining subject.

**Options Considered:**

| Option | Strengths | Weaknesses |
|--------|-----------|------------|
| **Loss framing, operator-level tracking** | Most detailed data; maximum accountability | Decreases performance ~33% of the time; union grievance risk; NLRB complaint risk; operators follow AI blindly (safety risk) or disengage entirely |
| **Gain framing, equipment-level, audience-separated** | Positive behavioral change; union-compatible; safety-preserving; legally defensible | Less granular attribution; some management resistance to anonymized data |
| **No dashboard** | No risk | Loses key value proposition; no way to demonstrate ROI |

**Design Principles:**
- **Track by equipment, not operator:** `overrides` table has no `operator_id` field
- **Gain framing:** "$1.2M captured (82% capture rate)" — never "$450K lost from overrides"
- **Audience separation:** Management sees financials by equipment/unit; operators see "value captured" KPIs and upcoming recommendations
- **Architectural enforcement:** The API does not return operator-level financial data for the management role — this cannot be circumvented by UI changes
- **Contractual restriction:** Override data will never be used for performance evaluation, discipline, or termination

**Consequences:**
- *Enables:* Demonstrable ROI for customer business case; positive behavior reinforcement; union-compatible deployment; legal defensibility
- *Constrains:* Cannot identify which specific operator decisions cost the most money (by design — this is a feature, not a bug); management may push back on anonymization

**Risks Mitigated:**
- **R8 (Union/Dashboard Blame, Score 64):** Equipment-level tracking, gain framing, audience separation, contractual restrictions
- **R7 (OSHA/MOC, Score 80):** Full audit trail supports MOC without creating individual performance scorecards
- **R14 (Algorithm Aversion, Score 36):** Gain framing encourages engagement rather than creating fear of being tracked

---

## Cross-Reference: Risks → ADRs

| Risk ID | Risk Name | Score | Primary ADR(s) |
|---------|-----------|-------|----------------|
| R1 | Excel COM unsupported | 125 | ADR-08, ADR-14 |
| R2 | Delivery channel fails | 125 | ADR-07, ADR-15, ADR-13 |
| R3 | Proprietary LP solvers | 100 | ADR-08 |
| R4 | Team credibility gap | 100 | ADR-04, ADR-11 |
| R5 | LLM hallucination / NLP failures | 80 | ADR-06, ADR-15, ADR-12 |
| R6 | OT network security | 80 | ADR-01, ADR-05, ADR-09 |
| R7 | OSHA PSM / MOC | 80 | ADR-07, ADR-10, ADR-15, ADR-17 |
| R8 | Union / dashboard blame | 64 | ADR-03, ADR-10, ADR-16, ADR-17 |
| R9 | Alert fatigue / trigger calibration | 64 | ADR-14, ADR-03, ADR-12 |
| R10 | Brutal sales cycle | 75 | ADR-04 (simple = fast iteration) |
| R11 | Sensor glitches | 48 | ADR-05 (Data Quality Gateway) |
| R12 | PI System integration | 45 | ADR-01, ADR-09 |
| R13 | Historian compression | 36 | ADR-05 (Data Quality Gateway) |
| R14 | Algorithm aversion | 36 | ADR-06, ADR-14, ADR-17 |

---

*This document should be updated when architectural decisions change, typically after Phase 0 validation (LP tool landscape survey), first design partner engagement, or any risk reassessment.*

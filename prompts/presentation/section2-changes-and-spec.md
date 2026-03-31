# Sections 3-4: What Changed & Engineering Specification

---

## SECTION 3: What Changed — Original Plan vs Research Reality

---SLIDE---
type: divider
title: "How Research Changed Our Plan"
subtitle: "13 assumptions tested. 13 adjustments made. Zero surprises left."
speaker_notes: "This section walks through the major shifts between our original product concept and the engineering spec we built after two rounds of deep research. The theme here is simple: research made our plan better. Every change below was driven by a specific finding, not guesswork. We went in with a strong vision and came out with a stronger architecture."
---END---

---SLIDE---
type: two-column
title: "Shift 1: Who Actually Receives Recommendations"
subtitle: "The user we designed for doesn't exist on the plant floor"
left_column:
  - "Original: Field operators receive Slack messages on the plant floor"
  - "Operators type feedback like 'can't push unit 2, heat exchanger 201 is fouling'"
  - "Assumed: phones + chat apps + typing = viable in a refinery"
right_column:
  - "New: Shift supervisors & process engineers at desks with IT access"
  - "Field operators get info through existing channels (DCS, radio, supervisor handoff)"
  - "Feedback flows through the supervisor, not directly through field operators"
speaker_notes: "This was the single most important shift. Three independent research threads converged on the same conclusion: control rooms run DCS consoles, not chat apps. Process areas are ATEX hazardous zones where standard phones can't even be carried. Chemical-resistant gloves make phone keyboards physically unusable. Voice-to-text degrades to about 65% accuracy at industrial noise levels. WiFi is spotty across 3-4 square mile sites. We found zero published case studies showing Slack or Teams used by frontline refinery operators on shift. If the user can't receive or respond to recommendations, the feedback loop — our core differentiator — doesn't exist. Redefining the user was a prerequisite for a viable product."
deep_dive: "ENGINEERING-SPEC.md"
---END---

---SLIDE---
type: two-column
title: "Shift 2: How Operators Give Feedback"
subtitle: "Free-text chat replaced by structured 5-tap interface"
left_column:
  - "Original: Operators reply in Slack with free text"
  - "'Can't push unit 2, heat exchanger 201 is fouling'"
  - "Reflex extracts constraints via NLP"
  - "NLP accuracy: 46-85% on industrial text"
right_column:
  - "New: Structured 5-tap wizard in Teams/Slack"
  - "Select unit -> type -> constraint -> severity -> confirm"
  - "15-30 seconds total, fully glove-compatible"
  - "100% structured data accuracy"
speaker_notes: "The original plan had operators typing constraints in natural language, with an NLP model extracting the structured data. Research showed this achieves only 46-85% accuracy — and critically, the operator never specified quantitative information. 'Heat exchanger is fouling' doesn't tell you whether that means 5% or 35% capacity reduction. The 5-tap wizard solves both problems: it's 100% accurate because the data is structured from the start, it works with PPE gloves because you're tapping large buttons not typing, and it forces quantitative severity selection. Free-text is retained as an optional note field, but NLP-extracted constraints are never auto-applied — they always require confirmation through structured options."
deep_dive: "ENGINEERING-SPEC.md"
---END---

---SLIDE---
type: two-column
title: "Shift 3: What the AI Actually Does"
subtitle: "Claude formats words, not numbers — because LLMs can't be trusted with math"
left_column:
  - "Original: 'Claude processes the raw mathematical output from the LP'"
  - "'Extracts the exact delta from the Excel model's hard outputs'"
  - "AI handles both numbers and language"
right_column:
  - "New: ALL numbers extracted by deterministic Python code"
  - "Claude receives pre-validated numbers, formats natural language only"
  - "Cross-validation on every output; template fallback if validation fails"
  - "Cost: ~$7-18/month per site (Haiku + Sonnet blend)"
speaker_notes: "This is a safety-critical change. Research shows LLMs repeat or fabricate numerical errors in up to 83% of cases when errors are present in source material. In a refinery, misreading '2.3 MBPD' as '23 MBPD' or inverting increase versus decrease is genuinely dangerous. A single hallucinated number resets months of trust-building with operators. Our new approach: deterministic code extracts all numbers from LP output into a structured JSON. Claude receives those pre-validated numbers with strict instructions to use only what's provided. Every number in Claude's output is cross-validated against the source. If anything mismatches, we fall back to a deterministic template that produces the same actionable information without any LLM involvement. This cost about one week of extra engineering to design but eliminates the highest-impact failure mode entirely."
deep_dive: "ENGINEERING-SPEC.md"
---END---

---SLIDE---
type: two-column
title: "Shift 4: Smart Triggers Replace Fixed Thresholds"
subtitle: "Mode-aware, percentage-based, debounced — targeting 1-2 recs per shift"
left_column:
  - "Original: Fixed $2/bbl crack spread threshold"
  - "Triggers fire continuously, no awareness of plant state"
  - "No protection during shutdowns or upsets"
right_column:
  - "New: Percentage-based thresholds (10% of trailing 20-day avg)"
  - "Operating mode state machine: Normal / Startup / Shutdown / Upset / Turnaround / Emergency"
  - "All optimization suppressed during non-Normal modes"
  - "Debounce (2 min), cooldown (60 min), max 3 triggers per 12-hr shift"
speaker_notes: "The original $2 per barrel threshold sounds reasonable, but it represents 8-20% of a normal spread and only about 5% of an elevated spread. This causes over-triggering in volatile markets and under-triggering in stable markets. More critically, during plant shutdowns and startups — when 50% of safety incidents occur — nearly all sensors change dramatically. The original design would flood operators with meaningless recommendations at the exact moment they're under maximum cognitive load. Our research found that alert fatigue from false recommendations during the first shutdown event will permanently destroy operator trust. The new design uses percentage-based thresholds that adapt to market conditions, and treats operating mode as a first-class system concept. All optimization triggers are auto-suppressed during non-normal modes."
deep_dive: "ENGINEERING-SPEC.md"
---END---

---SLIDE---
type: two-column
title: "Other Key Adjustments"
subtitle: "Research drove 9 more shifts — here are the highlights"
left_column:
  - "Data connector: Seeq ($100K+/yr) -> Direct PI Web API (free)"
  - "Dashboard framing: 'Money lost from overrides' -> 'Value captured by equipment'"
  - "Market data: Buy OPIS/Platts ($10-50K/yr) -> 'Bring Your Own Data' ($0)"
  - "Training: 'No training required' -> MOC-compliant phased onboarding with shadow mode"
right_column:
  - "Target market: 80-120 sites -> 60-70 sites (beachhead: 12-24)"
  - "Revenue plan: $8-15M ARR -> $2-3M ARR Year 3 (honest projection)"
  - "LP tools: Excel assumed -> Must validate (many use PIMS/GRTMPS)"
  - "Team credibility: Not addressed -> Non-negotiable: recruit industry veteran"
speaker_notes: "Each of these deserves its own discussion, but the pattern is consistent. Seeq was eliminated because it's an enterprise analytics layer costing $100K+ per year — overkill for data collection when PI Web API is free and designed for DMZ access. The dashboard shifted from loss framing to gain framing because research shows loss framing decreases performance 33% of the time, and the USW union is actively bargaining over AI surveillance. Market data shifted to 'bring your own' because refineries already have OPIS and Platts subscriptions. The 'no training required' claim directly conflicts with OSHA PSM Management of Change regulations — the 2005 Texas City explosion was partly attributed to MOC failures. And the honest market sizing: EIA data shows exactly 60 mid-size US refineries in our target range, not 80-120. Planning for realistic revenue prevents undercapitalization."
deep_dive: "ENGINEERING-SPEC.md"
---END---

---

## SECTION 4: Engineering Specification

---SLIDE---
type: divider
title: "Engineering Specification"
subtitle: "Architecture decisions driven by 20 identified risks"
speaker_notes: "Now we'll walk through the engineering specification that synthesizes all of our research. Every architectural decision you'll see traces back to a specific risk from our risk matrix. This isn't a theoretical design — it's built to address the real obstacles we identified. The spec covers cloud platform, data architecture, service design, AI integration, frontend UX, security, and risk mitigations."
---END---

---SLIDE---
type: two-column
title: "Cloud Platform: Azure-Primary"
subtitle: "Industrial IoT connectivity is Reflex's hardest problem — Azure solves it"
left_column:
  - "Why Azure wins:"
  - "1. First-party OPC-UA Publisher for PI historian access"
  - "2. PI Integrator for Azure — official AVEVA product"
  - "3. Defender for IoT — Purdue Model-aware OT monitoring"
  - "4. Teams is dominant messaging in oil & gas"
  - "5. $100/yr student credits + up to $150K startup credits"
right_column:
  - "Cloud-agnostic where it makes sense:"
  - "Claude API direct from Anthropic (no lock-in)"
  - "GitHub Actions for CI/CD (free 2000 min/mo)"
  - "TimescaleDB on PostgreSQL (not Azure-specific ADX)"
  - ""
  - "Year 1 cost: $8-75/month ($100-900/year)"
  - "Covered by Azure for Students credits"
speaker_notes: "The cloud decision came down to one factor: industrial IoT connectivity is Reflex's hardest technical problem, and Azure is materially better at it. Azure IoT Edge has a first-party OPC-UA Publisher module that's open source and Microsoft-maintained. AWS requires custom OPC-UA integration. PI Integrator for Azure is an official AVEVA product that streams PI historian data directly into Azure Event Hubs — no equivalent exists for AWS. Microsoft Defender for IoT provides Purdue Model-aware OT network monitoring. And since refineries are overwhelmingly Microsoft 365 shops, Teams integration is native. But we're not all-in on Azure — we use the direct Anthropic API for Claude to avoid cloud lock-in, GitHub Actions for CI/CD, and TimescaleDB instead of Azure Data Explorer because ADX costs $90+ per month minimum, which is overkill for 100 sensor tags."
deep_dive: "research/run2/cloud-platform-recommendation.md"
---END---

---SLIDE---
type: visual
title: "System Architecture Overview"
subtitle: "End-to-end data flow from refinery floor to operator screen"
visual_description: "Left-to-right flow diagram with 7 main components connected by arrows. GROUP 1 (left, grey box labeled 'Refinery DMZ'): Rectangle 'Edge Agent' containing 'PI Reader -> Data Quality Gateway -> SQLite Buffer'. Arrow labeled 'HTTPS outbound only' pointing right through a vertical dashed line labeled 'Firewall'. GROUP 2 (center, blue box labeled 'Reflex Cloud - Azure'): Large rectangle containing stacked modules: 'Data Ingestion' at top receiving arrow from Edge Agent. Below it 'Trigger Engine' with arrow from Data Ingestion. 'LP Orchestrator' below with arrow from Trigger Engine. Side arrow from LP Orchestrator going right to separate box 'Windows LP Worker (Excel COM)' and returning. 'AI Translation (Claude API)' below LP Orchestrator. 'Messaging Service' below AI Translation. Side components: 'Constraint Registry' box connected bidirectionally to Messaging Service. 'PostgreSQL + TimescaleDB' cylinder at bottom connected to all modules. GROUP 3 (right): Three output boxes from Messaging Service: 'Teams Adaptive Cards', 'Slack Block Kit', 'Email Fallback'. GROUP 4 (bottom right): 'Next.js Dashboard' box with arrow from PostgreSQL, containing 'Operations | Analytics | Admin'. All boxes use neutral grey backgrounds with blue accent borders."
speaker_notes: "Here's the full system architecture. Starting on the left: the Edge Agent sits in the customer's DMZ at Purdue Level 3.5. It reads from a read-only PI Data Archive replica via PI Web API, validates data quality, and pushes outbound via HTTPS — no inbound firewall rules ever required. In the cloud, the FastAPI modular monolith receives data, runs trigger evaluations, orchestrates LP solves on a separate Windows VM for Excel COM automation, translates results through Claude API, and delivers via Teams, Slack, or email. The Constraint Registry is the feedback loop — operator responses flow back in and update the LP model bounds. Everything stores in a single PostgreSQL instance with TimescaleDB for time-series data."
deep_dive: "ENGINEERING-SPEC.md"
---END---

---SLIDE---
type: table
title: "Technology Stack"
subtitle: "Every choice traced to a reason — no resume-driven development"
table:
  headers: ["Component", "Technology", "Why Chosen", "Alternative Considered"]
  rows:
    - ["Backend", "Python 3.12 + FastAPI", "Team knows Python; async native; Claude SDK first-class; pywin32 for Excel COM", "NestJS (new language), Go (no COM support)"]
    - ["Frontend", "Next.js 15 + React 19 + TypeScript", "SSR for slow control-room networks; type safety prevents numerical display errors", "Vue/Nuxt (smaller industrial charting ecosystem)"]
    - ["Database", "PostgreSQL 16 + TimescaleDB", "Single DB for relational + time-series; full SQL JOINs; 90%+ compression", "InfluxDB (separate DB, no JOINs)"]
    - ["Cache/Broker", "Redis 7 + Celery", "Task queue for LP solves; pub/sub for module events; simple to operate", "RabbitMQ (more complex)"]
    - ["Edge Agent", "Python Docker (~60 MB)", "Lightweight; store-and-forward; runs on Linux or Windows in DMZ", "Azure IoT Edge (overkill for MVP)"]
    - ["LLM", "Claude API (direct Anthropic)", "Provider-agnostic; Haiku ~$3/mo routine, Sonnet for complex; no lock-in", "Azure OpenAI (adds complexity)"]
    - ["Charting", "ECharts + Tremor", "60fps Canvas for analytics; Tremor for KPI cards; both dark-mode native", "D3 (too low-level), Plotly (heavier)"]
    - ["Messaging", "Azure Bot Service + Adaptive Cards", "Teams-native structured input; 64px+ buttons for glove compatibility", "Custom webhooks (lose structured cards)"]
speaker_notes: "Every technology choice here was made for a specific reason, not because it's trendy. Python and FastAPI because the team knows Python and we need pywin32 for Excel COM automation. Next.js because SSR matters for potentially slow control-room network connections, and TypeScript's type safety prevents the class of numerical display errors that Risk 5 targets. The big database decision: we chose TimescaleDB on PostgreSQL instead of running separate InfluxDB and PostgreSQL instances. Nearly every intelligence feature — coefficient reconciliation, opportunity cost tracking, constraint pattern analysis — requires joining time-series data with relational data. With TimescaleDB, that's a standard SQL JOIN. With separate databases, it's a cross-database nightmare."
deep_dive: "ENGINEERING-SPEC.md"
---END---

---SLIDE---
type: content
title: "Data Architecture: PostgreSQL for Everything"
subtitle: "One database, two data models, zero operational overhead"
bullets:
  - "TimescaleDB hypertables for time-series: sensor readings, market prices, crack spreads"
  - "Regular PostgreSQL tables for relational: constraints, overrides, audit logs, users, LP configs"
  - "Continuous aggregates auto-compute 5-minute rollups for dashboards"
  - "90%+ compression after 7 days; 2-year retention on raw data, 7 years on audit logs"
  - "Storage estimate: ~140 MB/year per site at 1-minute intervals with compression"
  - "Cost: $20-50/month managed PostgreSQL — sufficient for 5+ sites"
  - "LISTEN/NOTIFY for real-time events between modules (no separate message broker needed at pilot scale)"
speaker_notes: "The data architecture principle is radical simplicity: PostgreSQL for everything. TimescaleDB is a PostgreSQL extension, not a separate product, so we get time-series capabilities — hypertables, automatic compression, continuous aggregates, retention policies — while keeping full PostgreSQL functionality like JOINs, foreign keys, transactions, and JSONB. This matters because nearly every intelligence feature requires joining time-series data with relational data. Coefficient reconciliation needs actual yields over time joined with LP model predictions. Opportunity cost tracking needs production rates joined with recommendation and override history. With a single database, these are trivial SQL queries. With separate InfluxDB and PostgreSQL, each query requires cross-database data movement. Storage is tiny — about 140 MB per year per site with compression. A $20-50/month managed instance handles everything."
deep_dive: "research/run2/data-architecture.md"
---END---

---SLIDE---
type: content
title: "Service Architecture: Modular Monolith"
subtitle: "Right-sized for a student team with 1-5 customers"
bullets:
  - "Single FastAPI application with 11 internal modules, clean boundaries"
  - "Only external process: Windows LP Worker (Excel COM can't run on Linux)"
  - "Modules communicate via defined Python interfaces — never reach into each other's internals"
  - "Each module owns its database tables — no cross-module direct table access"
  - "Internal event bus (Redis pub/sub) for loose coupling between modules"
  - "ACID transactions across modules — no saga patterns or eventual consistency"
  - "When to extract a service: independent scaling needed, different runtime, team grows large enough"
speaker_notes: "We chose a modular monolith over microservices for a simple reason: a team of 3-5 students cannot manage N services times logging plus monitoring plus deployment plus versioning. A single deployment, single repo, with ACID transactions across modules, in-process function calls, and stack traces for debugging is dramatically simpler to build and operate. The only argument for a separate service is the LP Orchestrator, which inherently runs on a separate Windows machine due to Excel COM requirements. That's handled as a single Celery worker, not a full microservices architecture. The key design choice: module boundaries are enforced through Python interfaces, owned tables, and event-driven communication. This means if we ever need to extract a module — say the LP Orchestrator needs to scale independently at 10+ concurrent solves — we can do it without rewriting the whole system."
deep_dive: "research/run2/api-backend-architecture.md"
---END---

---SLIDE---
type: content
title: "AI/LLM Integration: Claude as Translator, Not Calculator"
subtitle: "Numbers are sacred — the LLM never touches them"
bullets:
  - "Pipeline: LP Output -> Python extracts numbers -> Delta calculation -> Claude formats English -> Cross-validate -> Deliver"
  - "Routine translation: Claude Haiku (~$0.001/call, 50-100 calls/day)"
  - "Complex constraint interpretation: Claude Sonnet (~$0.005/call, 10-20 calls/day)"
  - "Total cost: $7-18/month per site; $350-900/month at 50 sites (<0.03% of revenue)"
  - "Every number cross-validated against source data before delivery"
  - "Deterministic template fallback if Claude is down or validation fails"
  - "NLP-extracted constraints always require structured confirmation — never auto-applied"
speaker_notes: "Claude's role is tightly scoped: take pre-validated numerical deltas and write a clear, concise English recommendation that a shift supervisor can act on in 30 seconds. It turns a structured JSON of numbers into a sentence like 'Crack spreads widened $1.80 per barrel. Model recommends increasing naphtha yield by 8% on units 3 and 4. Estimated margin impact: plus $44,000 at current throughput.' The critical safety rail: every number in Claude's output is verified against the source data. Direction words like increase and decrease are verified against the sign of the delta. Any mismatch triggers the template fallback, which produces identical actionable information without prose. Operators can always tell which version they're seeing. The cost is negligible — about $7-18/month per site, which is less than 0.03% of revenue at scale."
deep_dive: "ENGINEERING-SPEC.md"
---END---

---SLIDE---
type: content
title: "Frontend & Operator UX"
subtitle: "Designed for 2AM, 12-hour shifts, fatigued supervisors, upset conditions"
bullets:
  - "ISA-101 High Performance HMI: greyscale backgrounds, color for deviation only (green/amber/red)"
  - "3-second rule: any screen conveys primary status without reading text"
  - "5-tap constraint wizard: 64px+ touch targets, glove-compatible, 15-30 seconds"
  - "Audience-separated dashboards: operators see 'value captured', management sees equipment-level financials"
  - "Shadow mode UX for first 2-4 weeks: 'Note Agreement/Disagreement' not 'Acknowledge/Dismiss'"
  - "SSE for real-time recommendations; HTTP polling for analytics — works through corporate proxies"
  - "Tech: Next.js 15, ECharts (analytics), Tremor (KPIs), Mantine + Shadcn/ui, TanStack Query + Zustand"
speaker_notes: "The frontend follows ISA-101 High Performance HMI and ISA-18.2 alarm management standards. These aren't nice-to-haves — SCADA operators experience cognitive load 340% above baseline during peak operations. One recorded industrial incident had 275 alarms in 11 minutes. Interface simplicity is a safety requirement. The design is built for worst case: 2AM, 12-hour shift, fatigued supervisor, upset conditions. Greyscale backgrounds with color used only for status deviation. The 3-second rule means any dashboard screen conveys its primary status at a glance. Progressive disclosure shows conclusions by default — details on demand, diagnostics behind explicit drill-down. The audience separation is architecturally enforced: the API literally does not return individual operator override costs for the management role. Shadow mode during the first 2-4 weeks shows recommendations alongside existing workflows, using language like 'Note Agreement' instead of 'Acknowledge' — letting operators build calibrated trust before the system asks them to act."
deep_dive: "research/run2/frontend-ux-architecture.md"
---END---

---SLIDE---
type: content
title: "Security Architecture: OT/IT Boundary"
subtitle: "Read-only, outbound-only, never touch the control system"
bullets:
  - "Edge Agent in DMZ (Purdue Level 3.5) — reads from PI Data Archive replica, never the primary"
  - "All communication outbound HTTPS only — no inbound firewall rules, ever"
  - "Read-only: Reflex never writes to any OT system"
  - "Data diode compatible (physically one-way communication)"
  - "Auth: API keys for edge agents, JWT for users, Entra ID for Teams bots"
  - "Encryption: TDE at rest (PostgreSQL), TLS 1.2+ in transit, certificate pinning on edge"
  - "Compliance: ISA/IEC 62443 (OT security), OSHA PSM/MOC, SOC 2 Type II (Phase 2), NLRB/USW considerations"
speaker_notes: "Security is existential for Reflex. If a refinery CISO doesn't trust our architecture, the deal is dead. Our approach: the Edge Agent sits in the DMZ at Purdue Level 3.5, reads from a read-only replica of the PI Data Archive via PI Web API, and communicates outbound only via HTTPS. No inbound firewall rules are ever required. The edge agent never writes to any OT system — it is strictly read-only. This design is compatible with hardware data diodes, which are physically one-way network devices. On the compliance side, ISA/IEC 62443 is the industrial cybersecurity standard and our Purdue Model architecture aligns directly. OSHA PSM requires Management of Change documentation, which we include as a pre-built package in every sales engagement. SOC 2 Type II certification begins in Phase 2. And we've designed the override tracking system to avoid NLRB exposure by tracking overrides by equipment, never by individual operator."
deep_dive: "ENGINEERING-SPEC.md"
---END---

---SLIDE---
type: table
title: "Risk Mitigations Built Into Architecture"
subtitle: "Top risks mapped to specific architectural decisions"
table:
  headers: ["Risk", "Score", "Architectural Mitigation"]
  rows:
    - ["R1: Excel COM unsupported", "125", "safexl/pywin32 with watchdog, 5-min timeout, zombie cleanup. Separate Windows VM via Celery. Migration path to PuLP + HiGHS."]
    - ["R2: Delivery channel fails", "125", "Redefined user to desk-based supervisor. 5-tap structured input. Three channels: Teams, Slack, email fallback."]
    - ["R4: Team credibility gap", "100", "Non-negotiable: recruit industry veteran. Advisor-led sales. Advisory board with former refinery managers."]
    - ["R5: LLM hallucination", "80", "Numbers extracted by code, not AI. Cross-validation on every output. Deterministic template fallback."]
    - ["R6: OT network security", "80", "Edge in DMZ, outbound-only HTTPS, read-only access, Defender for IoT, data diode compatible."]
    - ["R8: Dashboard blame / union", "64", "Overrides by equipment NEVER by operator. Gain framing. API prevents operator-level data for management role."]
    - ["R9: Alert fatigue", "64", "6-mode operating state machine. Suppression during non-Normal. Percentage thresholds. Max 3 triggers per 12-hr shift."]
speaker_notes: "This table shows how our architecture directly addresses the highest-scored risks. Notice the pattern: the top two risks both scored 125 and both required fundamental design changes, not just features. Excel COM automation is unsupported by Microsoft — we built extensive guardrails and a migration path to open-source solvers. The delivery channel risk required redefining our entire user persona. Team credibility isn't a technical problem at all — it's solved by recruiting the right person. LLM hallucination is eliminated by never letting the LLM handle numbers. OT security is addressed by a clean Purdue Model architecture. The union and dashboard blame risk is handled at the database schema level — there is literally no operator_id field in the overrides table. And alert fatigue is prevented by a mode-aware trigger system that auto-suppresses during the most dangerous operational periods."
deep_dive: "ENGINEERING-SPEC.md"
---END---

---SLIDE---
type: content
title: "Cost Projections: Infrastructure"
subtitle: "Year 1 costs covered by student credits"
bullets:
  - "Year 1 (1 pilot site, ~100 tags): $8-75/month ($100-900/year)"
  - "Azure Container Apps, Functions, Bot Service, Key Vault: all $0 (free tiers)"
  - "PostgreSQL + TimescaleDB: $0 (12 months free with student credits)"
  - "Claude API: $7-18/month (blended Haiku + Sonnet)"
  - "Covered by: Azure for Students ($100/yr) + Microsoft for Startups (up to $150K)"
  - ""
  - "Year 2 (10 sites, ~1,000 tags): $220-580/month ($2,600-7,000/year)"
  - "At $75K/site x 10 sites = $750K ARR — cloud costs are <1% of revenue"
speaker_notes: "Infrastructure costs are not a meaningful concern at any realistic scale. In Year 1, nearly everything runs on free tiers. Azure Container Apps has an always-free tier with 2 million requests per month. Functions, Bot Service, Key Vault — all free. PostgreSQL is free for 12 months with student credits. The only real costs are Claude API at $7-18/month and potentially $15/month for the Windows VM if student credits don't cover it. At 10 sites in Year 2, total cloud costs are $2,600 to $7,000 per year — less than 1% of the $750K in annual recurring revenue those sites generate. Cloud infrastructure is definitively not a cost driver for this business."
deep_dive: "research/run2/cloud-platform-recommendation.md"
---END---

---SLIDE---
type: content
title: "Full Specification Reference"
subtitle: "Everything documented, everything traceable"
bullets:
  - "ENGINEERING-SPEC.md — Complete engineering specification (synthesizes all research)"
  - "research/run1/EXECUTIVE-SUMMARY.md — Risk analysis and feasibility assessment"
  - "research/run2/cloud-platform-recommendation.md — Azure vs AWS detailed comparison"
  - "research/run2/data-architecture.md — Database design, schemas, data flows"
  - "research/run2/api-backend-architecture.md — Service boundaries, API contracts, module design"
  - "research/run2/frontend-ux-architecture.md — Dashboard specs, ISA-101 compliance, component hierarchy"
  - "Every architectural decision traces to a specific risk from our 20-risk matrix"
  - "13 documented shifts from original plan — all with rationale and research backing"
speaker_notes: "Every detail we've covered today is documented and traceable. The engineering spec synthesizes findings from two full research rounds — Run 1 identified 20 risks across technical, business, and adoption domains; Run 2 produced deep-dive architecture recommendations for cloud platform, data, backend, and frontend. Every decision traces to a specific risk. If anyone on the team wants to understand why we chose TimescaleDB over InfluxDB, or why the trigger engine uses percentage thresholds, or why the dashboard tracks overrides by equipment — the answer is in the spec with the specific research finding that drove it. This isn't a theoretical architecture document. It's a build plan."
deep_dive: "ENGINEERING-SPEC.md"
---END---

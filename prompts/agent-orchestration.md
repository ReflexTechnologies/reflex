# Reflex - Multi-Agent Orchestration Playbook

> **What is Reflex?** A lightweight workflow tool for mid-size oil refineries that connects live process historian data + market feeds to existing Excel-based LP (Linear Program) optimization models, uses AI (Claude) to translate outputs into plain-English recommendations delivered via Slack/Teams, and captures operator feedback into a constraint registry. Target: $75K-$125K/site/year for 80-120 mid-market sites priced out of enterprise RTO ($300K-$800K/yr).

> **IMPORTANT**: The full product transcript is at `/Users/ianrowe/git/Reflex/docs/product-transcript.md`. Every agent prompt below references this file so agents deeply understand the product before researching.

---

## Run 1: Exhaustive Weak Spot Analysis

**Goal**: Identify every technical, business, regulatory, and operational risk that could prevent Reflex from succeeding. Each agent researches independently, then a final agent synthesizes all findings.

**Agents in this run**: 3 parallel research agents + 1 sequential synthesis agent

---

### Agent 1A: Technical & Integration Risk Analyst

**Terminal tab name**: `run1-technical-risks`

```
You are a senior systems engineer and devil's advocate. Your job is to find EVERY technical weak spot in the Reflex platform concept. Use web search extensively to research real-world constraints.

FIRST: Read the full product transcript at /Users/ianrowe/git/Reflex/docs/product-transcript.md — this explains the complete Reflex concept, market opportunity, technical architecture, operator workflow, feedback loops, and business model. Read it thoroughly before starting your research. You must deeply understand the product to identify meaningful risks.

## Your Research Tasks
Research and document risks in these categories. USE WEB SEARCH for each:

1. **Historian Integration Complexity**: Research OSIsoft PI, Aveva Historian, Honeywell PHD APIs. How hard is it actually to connect? What auth/networking/firewall issues exist at refineries? Is Seeq the right abstraction layer? What about OPC-UA?
2. **Excel LP Model Automation**: Research how refinery LP models actually work in Excel. Can you programmatically feed data into and extract results from complex Excel models? Research openpyxl, xlwings, COM automation limitations. What about models with VBA macros, solver add-ins, or proprietary plugins?
3. **Market Data Feed Access**: Research OPIS and Platts API access. What do they cost? Are there student/startup-friendly alternatives? What about latency and reliability?
4. **LLM Translation Reliability**: Research risks of using Claude to interpret LP outputs. What happens when the model hallucinates context? How do you validate the translation is accurate? What about latency for real-time recommendations?
5. **Messaging Platform Limitations**: Research Slack/Teams bot API limits, rate limiting, message formatting constraints, and enterprise IT policies at industrial facilities
6. **Real-time Data Pipeline Reliability**: What happens when the historian connection drops? When sensors go offline? Research edge cases in industrial data pipelines
7. **Security & Network Architecture**: Refineries have air-gapped or heavily firewalled OT networks. How does a cloud tool access historian data safely? Research ISA/IEC 62443, Purdue model for industrial network security
8. **Scaling the Excel Bottleneck**: Excel is single-threaded and has memory limits. If you're running models every time a trigger fires, what are the performance implications?

Write your findings to: /Users/ianrowe/git/Reflex/research/run1/technical-risks.md

Format as a ranked list from highest to lowest severity, with each risk having: Description, Severity (Critical/High/Medium/Low), Evidence (from your research), and Suggested Mitigation.
```

---

### Agent 1B: Business, Market & Competitive Risk Analyst

**Terminal tab name**: `run1-business-risks`

```
You are a startup strategist and market analyst. Your job is to find EVERY business, market, and competitive weak spot in the Reflex platform concept. Use web search extensively.

FIRST: Read the full product transcript at /Users/ianrowe/git/Reflex/docs/product-transcript.md — this explains the complete Reflex concept, market opportunity, pricing strategy, competitive landscape, business model, and exit strategy. Read it thoroughly before starting your research. You must deeply understand the business case to identify meaningful risks.

## Your Research Tasks
Research and document risks in these categories. USE WEB SEARCH for each:

1. **Market Size Validation**: Research the actual number of mid-size US refineries. Is 80-120 accurate? Cross-reference EIA refinery data. What's the real TAM? Are these refineries actually using Excel for LP, or is this an exaggeration?
2. **Competitive Landscape Deep Dive**: Research AspenTech PIMS, Honeywell RPMS, Yokogawa, AVEVA, Schneider Electric. Are any of them launching lightweight/cloud versions for mid-market? Research Seeq's own optimization features. Are there other startups in this space?
3. **Pricing Validation**: Is $75K-$125K/year realistic for mid-size refineries? Research typical software budgets at these facilities. What do they currently spend on process optimization tools?
4. **Sales Cycle Reality**: Research how long it takes to sell software to refineries. What compliance, procurement, and IT security hurdles exist? How long is a typical pilot?
5. **Customer Concentration Risk**: With only 80-120 potential customers, what happens if 5-10 early adopters churn? How do you build a sustainable business on such a small addressable market?
6. **Regulatory & Compliance**: Research EPA, OSHA, and state-level regulations that affect how refineries can adopt new optimization software. Are there process safety management (PSM) implications?
7. **Energy Transition Risk**: Research the long-term outlook for mid-size US refineries. Are they being consolidated, shut down, or converted? What does the 10-year horizon look like?
8. **The "Good Enough" Problem**: If refineries have survived decades with Excel, what's the actual urgency to switch? Research change management challenges in heavy industry
9. **Acquisition Exit Feasibility**: Research recent acquisitions in industrial software. Is $100-250M realistic for a company with $8-15M ARR? What multiples are common?
10. **Team Risk**: This is being built by students. Research what domain expertise is actually needed to sell to and implement at refineries. What credibility gap exists?

Write your findings to: /Users/ianrowe/git/Reflex/research/run1/business-risks.md

Format as a ranked list from highest to lowest severity, with each risk having: Description, Severity (Critical/High/Medium/Low), Evidence (from your research), and Suggested Mitigation.
```

---

### Agent 1C: Operator Experience & Adoption Risk Analyst

**Terminal tab name**: `run1-adoption-risks`

```
You are a UX researcher and industrial operations expert. Your job is to find EVERY weak spot related to operator adoption, trust, usability, and the human factors of the Reflex platform. Use web search extensively.

FIRST: Read the full product transcript at /Users/ianrowe/git/Reflex/docs/product-transcript.md — this explains the complete operator workflow, feedback loops, constraint registry, alert fatigue solution, human-in-the-loop design, and the two-path feedback system. Read it thoroughly before starting your research. You must deeply understand the operator experience to identify meaningful adoption risks.

## Your Research Tasks

1. **Alert Fatigue Research**: Research actual alert fatigue studies in process industries. Does the trigger-based approach (process drift + price movement) actually solve this, or does it create new fatigue patterns? What trigger thresholds are appropriate?
2. **Operator Trust in AI**: Research studies on operator trust in AI decision support in high-consequence environments (refining, aviation, nuclear). What are the actual adoption curves? What makes operators reject tools?
3. **Slack/Teams as an Industrial Tool**: Research whether refinery operators actually use Slack or Teams on shift. Many plants have restricted phone/device policies. Is this the right delivery channel?
4. **Constraint Registry UX**: How does an operator at 2AM, in PPE, on a phone, effectively communicate a constraint via text? Research industrial HMI and UX patterns for process industries
5. **Feedback Loop Validity**: Research whether the two-path feedback system (quantifiable re-model + qualitative logging) actually captures enough information. What gets lost in translation when operators type free-text constraints?
6. **NLP Constraint Extraction**: Research the difficulty of extracting mathematical constraints from natural language. "Heat exchanger 201 is fouling" needs to become a specific capacity bound. How reliable is this with LLMs?
7. **Shift Handover Integration**: Research how shift handovers work at refineries. Does the constraint registry integrate with existing shift handover processes?
8. **Dashboard Fatigue**: Research whether opportunity cost dashboards actually drive behavior change in industrial settings, or if they become "furniture" that nobody looks at
9. **Training & Onboarding**: The transcript claims "no training required" because it's just Slack messages. Research whether this is realistic for a tool that changes operational decision-making
10. **Union & Workforce Concerns**: Research how unionized refinery workers respond to AI optimization tools. Are there labor relations risks?

Write your findings to: /Users/ianrowe/git/Reflex/research/run1/adoption-risks.md

Format as a ranked list from highest to lowest severity, with each risk having: Description, Severity (Critical/High/Medium/Low), Evidence (from your research), and Suggested Mitigation.
```

---

### Agent 1D: Risk Synthesis Agent (RUN AFTER 1A, 1B, 1C COMPLETE)

**Terminal tab name**: `run1-synthesis`

**Wait for**: Agents 1A, 1B, 1C to complete

```
You are a strategic advisor synthesizing risk research for the Reflex platform. Three research agents have already completed their analysis.

FIRST: Read the full product transcript at /Users/ianrowe/git/Reflex/docs/product-transcript.md to understand the original Reflex concept in full detail. Then read the three risk reports below. Your job is to:

1. Read all three risk reports:
   - /Users/ianrowe/git/Reflex/research/run1/technical-risks.md
   - /Users/ianrowe/git/Reflex/research/run1/business-risks.md
   - /Users/ianrowe/git/Reflex/research/run1/adoption-risks.md

2. Create a unified risk matrix at /Users/ianrowe/git/Reflex/research/run1/RISK-MATRIX.md that:
   - Deduplicates overlapping risks across all three reports
   - Ranks ALL risks by a combined score of (Severity x Likelihood x Impact on Timeline)
   - Identifies the TOP 10 "must-solve-before-building" risks
   - Identifies risks that are acceptable to defer
   - Maps risk interdependencies (e.g., "if we can't solve historian integration, the Excel automation risk becomes moot")
   - Provides a GO/NO-GO assessment for each major system component
   - Creates a "Risk-Adjusted Architecture" section that recommends design changes based on the identified risks

3. Create an executive summary at /Users/ianrowe/git/Reflex/research/run1/EXECUTIVE-SUMMARY.md that:
   - Lists the top 5 existential risks in plain language
   - Lists the top 5 "easy wins" that derisk the project
   - Gives an honest assessment of feasibility for a student team
   - Recommends a phased approach to tackle risks incrementally
```

---

## Run 2: Engineering Specification

**Goal**: Create a complete engineering specification for Reflex, including cloud platform recommendation (Azure vs AWS given student budget + AI integration needs), system architecture, data models, API contracts, and implementation roadmap.

**Agents in this run**: 4 parallel research agents + 1 sequential assembly agent

**Prerequisite**: Run 1 complete. All agents in Run 2 should read BOTH Run 1 outputs first:
- `/Users/ianrowe/git/Reflex/research/run1/RISK-MATRIX.md` — full risk matrix with severity rankings and interdependencies
- `/Users/ianrowe/git/Reflex/research/run1/EXECUTIVE-SUMMARY.md` — top existential risks, easy wins, feasibility assessment, and recommended phased approach

These documents define the constraints that should shape every design decision in Run 2.

---

### Agent 2A: Cloud Platform & Infrastructure Architect

**Terminal tab name**: `run2-cloud-infra`

```
You are a cloud infrastructure architect. Your task is to research and recommend the optimal cloud platform (Azure vs AWS) for the Reflex platform, given these constraints:
- Team: University students (cost is critical)
- Need: AI/LLM integration (Claude API), real-time data pipelines, time-series data storage, messaging integrations
- Scale: Start with 1-3 pilot refineries, scale to 80-120 sites
- Security: Must support ISA/IEC 62443 principles for connecting to industrial OT networks

FIRST: Read the full product transcript at /Users/ianrowe/git/Reflex/docs/product-transcript.md to deeply understand the Reflex platform — its data flows, integrations, operator workflow, and business model.
THEN: Read BOTH Run 1 research outputs to understand the constraints your design must address:
- /Users/ianrowe/git/Reflex/research/run1/RISK-MATRIX.md (full risk matrix with severity rankings and GO/NO-GO assessments)
- /Users/ianrowe/git/Reflex/research/run1/EXECUTIVE-SUMMARY.md (top existential risks, easy wins, feasibility for a student team, and recommended phased approach)

Your architecture decisions should directly address the risks and constraints identified in these documents.

## Research Tasks (USE WEB SEARCH for each):

1. **Azure vs AWS Cost Comparison for Students**:
   - Research Azure for Students ($100 credit + free services), GitHub Student Dev Pack Azure benefits
   - Research AWS Educate, AWS Academy, and startup credits (AWS Activate)
   - Compare free tiers for: compute, managed databases, time-series storage, message queues, API gateways, serverless functions
   - Calculate estimated monthly costs for a pilot deployment (1 refinery, ~100 sensor tags, market data polling every 5 min)

2. **AI/LLM Integration**:
   - Claude API is provider-agnostic (HTTP calls), so compare how each cloud handles: API gateway for Claude calls, caching/batching strategies, prompt management
   - Research Azure OpenAI Service vs using Claude API directly on either platform
   - Research if either cloud has better tooling for prompt versioning, A/B testing, monitoring LLM calls

3. **Time-Series Data**:
   - Compare: Azure Time Series Insights / Azure Data Explorer vs AWS Timestream / InfluxDB on AWS
   - Which handles industrial historian data patterns better?
   - Research InfluxDB Cloud as a cloud-agnostic alternative

4. **Real-Time Data Pipeline**:
   - Compare: Azure Event Hubs + Stream Analytics vs AWS Kinesis + Lambda
   - Compare: Azure Functions vs AWS Lambda for trigger-based processing
   - Which is simpler to set up and cheaper at low scale?

5. **Industrial Connectivity**:
   - Research Azure IoT Hub vs AWS IoT Core for OPC-UA connectivity
   - Research Azure's partnership with industrial companies (Siemens, Rockwell) vs AWS IoT SiteWise
   - Which has better edge gateway support for bridging OT/IT networks?

6. **Messaging Integration**:
   - Both support Slack/Teams bots. But Azure has native Teams integration advantages. Research this.

7. **Overall Recommendation**:
   - Provide a clear, justified recommendation
   - Include a cost projection table for Year 1 (pilot) and Year 2 (10 sites)
   - Include architecture diagram description (what services connect to what)

Write your findings to: /Users/ianrowe/git/Reflex/research/run2/cloud-platform-recommendation.md
```

---

### Agent 2B: Data Architecture & Pipeline Engineer

**Terminal tab name**: `run2-data-architecture`

```
You are a data architect specializing in industrial IoT and time-series systems. Design the complete data architecture for Reflex.

FIRST: Read the full product transcript at /Users/ianrowe/git/Reflex/docs/product-transcript.md to deeply understand the Reflex platform — every data flow, integration point, feedback loop, and intelligence feature described.
THEN: Read BOTH Run 1 research outputs to understand the constraints your design must address:
- /Users/ianrowe/git/Reflex/research/run1/RISK-MATRIX.md (full risk matrix with severity rankings and GO/NO-GO assessments)
- /Users/ianrowe/git/Reflex/research/run1/EXECUTIVE-SUMMARY.md (top existential risks, easy wins, feasibility for a student team, and recommended phased approach)

Your data architecture should directly address the risks and constraints identified in these documents.

## Reflex Data Flows
1. Process historian data (100+ sensor tags, sampled every 1-60 seconds) -> Reflex
2. Market data feeds (OPIS/Platts crack spreads, crude prices, product prices) -> Reflex
3. Reflex -> Excel LP model (input injection + output extraction)
4. LP model output -> Claude API (translation to plain English)
5. Recommendation -> Slack/Teams
6. Operator feedback -> Constraint Registry
7. Actual vs predicted yields -> Coefficient Reconciliation engine
8. Sensor health monitoring -> Sensor Substitution registry
9. All overrides -> Opportunity Cost Tracker

## Research & Design Tasks (USE WEB SEARCH):

1. **Data Ingestion Layer**:
   - Design the historian connector architecture. Research Seeq REST API, OPC-UA client libraries (node-opcua, asyncua for Python), direct PI Web API
   - Design the market data connector. Research OPIS API, Platts API, and cheaper alternatives (CME Group, EIA open data)
   - Define data schemas for incoming sensor data and market data

2. **Data Storage**:
   - Design the time-series storage schema (sensor readings, market prices)
   - Design the relational schema (constraints, operator feedback, sensor substitutions, audit logs, user management, site configuration)
   - Design the document store schema (LP model configs, recommendation history, coefficient reconciliation snapshots)
   - Recommend specific database technologies with justification

3. **Trigger Engine**:
   - Design the trigger evaluation system that watches for process drift and price movement thresholds
   - Define the trigger configuration schema (per-site, per-unit thresholds)
   - Design the debouncing/cooldown logic to prevent trigger storms

4. **Excel Integration Layer**:
   - Research and design the approach for programmatic Excel interaction
   - Define the data contract between Reflex and Excel models (input cells, output cells, solve trigger)
   - Design for different Excel model architectures (simple formulas, Solver, VBA macros, third-party add-ins)
   - Address the "Excel is single-threaded" scaling concern

5. **Feedback Processing Pipeline**:
   - Design the NLP pipeline for extracting constraints from operator messages
   - Define the constraint data model (quantifiable vs qualitative, expiration, scope, status)
   - Design the re-solve workflow when a quantifiable constraint is received

6. **Complete Data Model**:
   - Provide full ER diagram description
   - Define all database tables/collections with fields, types, relationships, and indexes

Write your findings to: /Users/ianrowe/git/Reflex/research/run2/data-architecture.md
```

---

### Agent 2C: API & Backend Services Architect

**Terminal tab name**: `run2-api-backend`

```
You are a backend architect. Design the complete API layer and backend services for Reflex.

FIRST: Read the full product transcript at /Users/ianrowe/git/Reflex/docs/product-transcript.md to deeply understand the Reflex platform — the trigger system, LP orchestration, AI translation, feedback loops, constraint registry, and all intelligence features.
THEN: Read BOTH Run 1 research outputs to understand the constraints your design must address:
- /Users/ianrowe/git/Reflex/research/run1/RISK-MATRIX.md (full risk matrix with severity rankings and GO/NO-GO assessments)
- /Users/ianrowe/git/Reflex/research/run1/EXECUTIVE-SUMMARY.md (top existential risks, easy wins, feasibility for a student team, and recommended phased approach)

Your service architecture should directly address the risks and constraints identified in these documents.

## Research & Design Tasks (USE WEB SEARCH):

1. **Service Architecture**:
   - Design the service boundaries (monolith-first or microservices? justify your choice)
   - Define each service/module: Data Ingestion, Trigger Engine, LP Orchestrator, AI Translation, Messaging, Feedback Processor, Constraint Registry, Reconciliation Engine, Dashboard API, Auth/Admin
   - Design inter-service communication (sync REST vs async message queue vs event-driven)
   - Recommend tech stack: language (Python/TypeScript/Go?), framework, ORM, etc.

2. **API Design**:
   - Design the REST API contract for each service boundary
   - Define endpoints, request/response schemas, auth requirements
   - Design the WebSocket API for real-time dashboard updates
   - Design the Slack/Teams bot webhook and interaction endpoints

3. **AI Translation Service**:
   - Design the Claude API integration layer
   - Define prompt templates for: LP output translation, constraint extraction from operator messages, pattern detection in constraint registry, coefficient drift explanation
   - Design the validation layer (how to verify Claude's output matches actual LP numbers)
   - Design caching strategy for repeated similar translations
   - Design fallback behavior when Claude API is unavailable

4. **Authentication & Multi-tenancy**:
   - Design auth for: admin dashboard users, API access for historian connectors, Slack/Teams bot verification
   - Design multi-site tenant isolation
   - Define role-based access: plant manager, LP planner, operator, admin

5. **Error Handling & Reliability**:
   - Design retry logic for each integration point (historian, market feed, Excel, Claude, Slack)
   - Design circuit breaker patterns
   - Design the audit trail for all recommendations and operator interactions

6. **Deployment Architecture**:
   - Design the deployment model (containerized services, serverless, hybrid?)
   - Design the edge component that sits inside the refinery network vs cloud components
   - Define the CI/CD pipeline

Write your findings to: /Users/ianrowe/git/Reflex/research/run2/api-backend-architecture.md
```

---

### Agent 2D: Frontend, Dashboard & UX Architect

**Terminal tab name**: `run2-frontend-ux`

```
You are a frontend architect and UX designer for industrial applications. Design the complete frontend architecture for Reflex.

FIRST: Read the full product transcript at /Users/ianrowe/git/Reflex/docs/product-transcript.md to deeply understand the Reflex platform — the operator experience, Slack/Teams delivery, constraint feedback, dashboards (opportunity cost, coefficient reconciliation, sensor health), and the human-in-the-loop design philosophy.
THEN: Read BOTH Run 1 research outputs to understand the constraints your design must address:
- /Users/ianrowe/git/Reflex/research/run1/RISK-MATRIX.md (full risk matrix with severity rankings and GO/NO-GO assessments)
- /Users/ianrowe/git/Reflex/research/run1/EXECUTIVE-SUMMARY.md (top existential risks, easy wins, feasibility for a student team, and recommended phased approach)

Your frontend and UX decisions should directly address the risks and constraints identified in these documents — especially any adoption risks flagged around operator trust, alert fatigue, and messaging channel suitability.

## Reflex Frontend Components
1. **Admin Dashboard**: Site configuration, historian connection setup, trigger threshold management, user management
2. **Operations Dashboard**: Real-time view of active recommendations, operator responses, constraint registry status
3. **Analytics Dashboard**: Opportunity cost tracking (30/90-day), coefficient reconciliation trends, sensor health overview
4. **Slack/Teams Bot UI**: Message formatting, interactive buttons for common responses, constraint input forms

## Research & Design Tasks (USE WEB SEARCH):

1. **Tech Stack Selection**:
   - Recommend frontend framework (React/Next.js, Vue/Nuxt, or SvelteKit) with justification
   - Recommend charting library for time-series visualization (research: Recharts, D3, Apache ECharts, Plotly, TradingView lightweight-charts)
   - Recommend real-time update strategy (WebSocket, SSE, polling)
   - Recommend UI component library suitable for data-dense industrial dashboards

2. **Dashboard Designs** (describe layouts, key components, data flows):
   - Admin: Site onboarding wizard, historian connection health, trigger config UI
   - Operations: Live recommendation feed, constraint registry browser, active override summary
   - Analytics: Opportunity cost waterfall chart, coefficient drift timelines, sensor health matrix
   - Design for both desktop (control room monitors) and tablet (field operators)

3. **Slack/Teams Bot UX**:
   - Design the message templates (recommendation format, follow-up prompts)
   - Design interactive components (approve/reject buttons, constraint input shortcuts, escalation flows)
   - Research Slack Block Kit and Teams Adaptive Cards capabilities and limitations

4. **Accessibility & Industrial Context**:
   - Research UX patterns for control room environments (high contrast, glanceable data, alarm-style UI)
   - Design for shift workers (dark mode default, large touch targets, minimal cognitive load)
   - Design for glove-friendly tablet interaction

5. **State Management & Data Flow**:
   - Design the client-side state management approach
   - Define the API data fetching strategy (real-time subscriptions vs polling for each dashboard)

Write your findings to: /Users/ianrowe/git/Reflex/research/run2/frontend-ux-architecture.md
```

---

### Agent 2E: Engineering Spec Assembler (RUN AFTER 2A-2D COMPLETE)

**Terminal tab name**: `run2-spec-assembler`

**Wait for**: Agents 2A, 2B, 2C, 2D to complete

```
You are the lead architect responsible for assembling the complete Reflex Engineering Specification. Four research agents have completed their analyses. Your job is to synthesize everything into a single, coherent engineering specification.

## Read ALL of these files first:
- /Users/ianrowe/git/Reflex/docs/product-transcript.md (ORIGINAL product concept — read this first to understand the baseline before comparing)
- /Users/ianrowe/git/Reflex/research/run1/RISK-MATRIX.md (risk context)
- /Users/ianrowe/git/Reflex/research/run1/EXECUTIVE-SUMMARY.md (risk summary)
- /Users/ianrowe/git/Reflex/research/run2/cloud-platform-recommendation.md
- /Users/ianrowe/git/Reflex/research/run2/data-architecture.md
- /Users/ianrowe/git/Reflex/research/run2/api-backend-architecture.md
- /Users/ianrowe/git/Reflex/research/run2/frontend-ux-architecture.md

## Create the Engineering Specification

Write to: /Users/ianrowe/git/Reflex/ENGINEERING-SPEC.md

Structure:

### 1. Executive Summary
- One-paragraph product description
- Key technical decisions summary
- Cloud platform recommendation (with rationale from Agent 2A)

### 1.5. Changes & Shifts from Original Plan
- Compare the original Reflex concept (from the transcript) against what the research revealed
- Document EVERY place where the engineering spec diverges from the original idea and WHY
- Examples: "The transcript assumed Seeq as the historian connector, but research showed X is better because Y", "The transcript assumed Slack/Teams delivery, but research revealed operators don't use these tools on shift, so we added Z", "The original pricing of $75-125K may need adjustment because..."
- For each change: Original Assumption -> Research Finding -> New Approach -> Justification
- This section is critical for the team to understand how the vision evolved through research

### 2. System Architecture Overview
- High-level component diagram (described in text/ASCII)
- Data flow diagram showing all integrations
- Network architecture (OT/IT boundary, edge vs cloud components)

### 3. Technology Stack
- Consolidated, justified tech stack decisions (resolve any conflicts between agent recommendations)
- For each technology: what it does, why it was chosen, alternatives considered

### 4. Data Architecture
- Complete data model (from Agent 2B)
- Storage strategy per data type
- Data retention policies

### 5. Service Architecture
- Service boundaries and responsibilities (from Agent 2C)
- API contracts (key endpoints)
- Inter-service communication patterns
- Authentication and authorization model

### 6. Frontend Architecture
- Component hierarchy (from Agent 2D)
- Dashboard specifications
- Slack/Teams bot design

### 7. AI/LLM Integration
- Claude API usage patterns
- Prompt templates (summarized)
- Validation and safety rails
- Cost projections for API usage

### 8. Infrastructure & Deployment
- Cloud architecture (from Agent 2A)
- Deployment pipeline
- Environment strategy (dev, staging, production)
- Cost projections (Year 1 pilot, Year 2 scale)

### 9. Security Architecture
- OT/IT network boundary design
- Authentication flows
- Data encryption strategy
- Compliance requirements (ISA/IEC 62443, OSHA PSM)

### 10. Risk Mitigations Built Into Architecture
- Map top 10 risks from Run 1 to specific architectural decisions that mitigate them

### 11. Implementation Roadmap
- Phase 1 (MVP): What to build first for a single pilot site
- Phase 2 (Beta): Scale to 3-5 sites
- Phase 3 (GA): Production-ready for 80+ sites
- Estimated effort per phase (in weeks, not hours)

### 12. Open Questions & Decisions Needed
- List any unresolved conflicts between agent recommendations
- List decisions that require more information or customer input

Ensure the spec is internally consistent - resolve any contradictions between the four input documents. Where agents disagreed, pick the better approach and note why.

CRITICAL REQUIREMENT: The "Changes & Shifts from Original Plan" section (1.5) is essential. The team needs to clearly see where research caused the engineering spec to deviate from the original transcript's assumptions. Read the original concept carefully (Reflex connects to historian via Seeq, uses Excel LPs, Claude translates, Slack/Teams delivery, constraint registry, coefficient reconciliation, sensor substitution, opportunity cost tracking, priced at $75-125K/site/year for 80-120 sites). Then compare against what ALL the research agents found. Document every shift, no matter how small.
```

---

## Run 3: Architecture Visualization & Interactive Q&A

**Goal**: Create visual architecture diagrams and a knowledge base that can be queried to understand every architectural decision.

**Agents in this run**: 2 parallel agents

**Prerequisite**: Run 2 complete.

---

### Agent 3A: Architecture Diagram Generator

**Terminal tab name**: `run3-diagrams`

```
You are a technical documentation specialist and visual communication expert. Your job is to create comprehensive, highly readable architecture diagrams for Reflex using Mermaid diagram syntax (renderable in GitHub, VS Code, and most markdown viewers).

## Visual Design Principles — FOLLOW THESE FOR EVERY DIAGRAM

Readability is the #1 priority. Someone unfamiliar with the project should be able to glance at any diagram and understand the system within 30 seconds. Apply these rules:

1. **Color coding**: Use consistent `style` and `classDef` directives to color-code by category (e.g., blue for external systems, green for Reflex services, orange for data stores, red for security boundaries, purple for AI/LLM components). Define a legend/key at the top of the file.
2. **Subgraphs for grouping**: Use Mermaid `subgraph` blocks to visually cluster related components (e.g., "Refinery Network", "Cloud", "External APIs", "Operator Touchpoints"). Label subgraphs clearly.
3. **Descriptive edge labels**: Every arrow/connection must have a short label explaining WHAT flows (e.g., "sensor readings every 30s", "plain-English recommendation", "operator constraint via Slack"). Never leave an arrow unlabeled.
4. **Left-to-right flow**: Use `graph LR` for most diagrams so data flows naturally left-to-right. Use `graph TD` only for hierarchical/layered diagrams.
5. **Node shapes for semantics**: Use different Mermaid node shapes to indicate type — rectangles for services, cylinders for databases, diamonds for decisions, rounded boxes for users/actors, hexagons for external systems.
6. **Whitespace and spacing**: Keep diagrams uncluttered. If a diagram has more than ~12 nodes, split it into sub-diagrams with a "zoom in" callout rather than cramming everything into one.
7. **Annotations**: Add Mermaid `note` blocks to highlight non-obvious decisions, gotchas, or key constraints (e.g., "Note: Excel runs on edge server inside refinery firewall, never in cloud").
8. **Font-friendly labels**: Keep node labels short (2-4 words max). Use the description text above each diagram for full context.
9. **Sequence diagram clarity**: For sequence diagrams, use `activate`/`deactivate` to show processing time, `alt`/`opt` blocks for branching, and `note over` for context. Group related messages with `rect` backgrounds.

FIRST: Read the full product transcript at /Users/ianrowe/git/Reflex/docs/product-transcript.md to understand the original Reflex vision.
THEN: Read /Users/ianrowe/git/Reflex/ENGINEERING-SPEC.md thoroughly to understand the final engineered architecture.

## Create the following diagrams

Write ALL diagrams to: /Users/ianrowe/git/Reflex/docs/architecture-diagrams.md

1. **System Context Diagram (C4 Level 1)**:
   - Mermaid diagram showing Reflex as a system in context with: Process Historian, Market Data Feeds, Excel LP Models, Slack/Teams, Claude API, Operators, LP Planners, Plant Management
   - Show data flow directions and labels

2. **Container Diagram (C4 Level 2)**:
   - Mermaid diagram showing all containers/services within Reflex: Data Ingestion Service, Trigger Engine, LP Orchestrator, AI Translation Service, Messaging Service, Feedback Processor, Constraint Registry, Reconciliation Engine, Dashboard API, Frontend App, Databases
   - Show inter-service communication

3. **Data Flow Diagram**:
   - Mermaid sequence diagram showing the complete happy-path flow:
     Historian -> Ingestion -> Trigger fires -> LP Orchestrator -> Excel model -> AI Translation -> Slack message -> Operator approves
   - Second sequence diagram for the feedback path:
     Operator rejects -> Feedback Processor -> Constraint extracted -> LP re-solve -> Revised recommendation

4. **Network Architecture Diagram**:
   - Mermaid diagram showing the OT/IT network boundary
   - Edge component inside refinery network
   - Cloud components
   - Secure tunnel/VPN between them

5. **Database Schema Diagram**:
   - Mermaid ER diagram for the relational database schema
   - Show key tables, relationships, and cardinality

6. **Deployment Architecture**:
   - Mermaid diagram showing cloud deployment topology
   - Show the specific cloud services (from the engineering spec's recommendation)
   - Show scaling boundaries

7. **User Journey Flows**:
   - Mermaid flowchart for: LP Planner configuring a new site
   - Mermaid flowchart for: Operator receiving and responding to a recommendation
   - Mermaid flowchart for: Manager reviewing opportunity cost dashboard

8. **Implementation Phasing**:
   - Mermaid Gantt chart showing the three implementation phases from the engineering spec

For EVERY diagram:
- Add a brief description above it explaining what it shows and key things to notice
- Apply the color coding, subgraph grouping, labeled edges, and node shape rules from the Visual Design Principles above
- Test that the Mermaid syntax is valid (no broken references, matching subgraph open/close)
- If a diagram is too dense, split it into a summary view + detailed zoom-in views
```

---

### Agent 3B: Architecture Decision Record & Q&A Knowledge Base

**Terminal tab name**: `run3-knowledge-base`

```
You are a technical writer and architecture decision record (ADR) specialist. Create a comprehensive, queryable knowledge base for every architectural decision made in the Reflex engineering spec.

FIRST: Read the full product transcript at /Users/ianrowe/git/Reflex/docs/product-transcript.md to understand the original Reflex vision.
THEN: Read these files thoroughly:
- /Users/ianrowe/git/Reflex/ENGINEERING-SPEC.md
- /Users/ianrowe/git/Reflex/research/run1/RISK-MATRIX.md
- /Users/ianrowe/git/Reflex/research/run2/cloud-platform-recommendation.md
- /Users/ianrowe/git/Reflex/research/run2/data-architecture.md
- /Users/ianrowe/git/Reflex/research/run2/api-backend-architecture.md
- /Users/ianrowe/git/Reflex/research/run2/frontend-ux-architecture.md

## Create Two Documents

### Document 1: Architecture Decision Records
Write to: /Users/ianrowe/git/Reflex/docs/architecture-decisions.md

For EVERY significant decision in the engineering spec, create an ADR entry with:
- **Decision**: What was decided
- **Context**: Why this decision was needed
- **Options Considered**: What alternatives existed
- **Decision Rationale**: Why this option was chosen (cost, complexity, risk, scalability, student-friendliness)
- **Consequences**: What this decision enables and constrains
- **Risk It Mitigates**: Link to specific risks from Run 1

Cover at minimum:
- Cloud platform choice (Azure vs AWS)
- Programming language / framework
- Database technology selection (each one)
- Monolith vs microservices
- Edge vs cloud split architecture
- AI/LLM provider and usage pattern
- Message delivery channel (Slack/Teams)
- Excel integration approach
- Historian connectivity approach
- Authentication strategy
- Deployment model
- Frontend framework
- Real-time communication pattern
- Trigger engine design
- Constraint extraction approach (NLP)
- Multi-tenancy model

### Document 2: Q&A Reference
Write to: /Users/ianrowe/git/Reflex/docs/architecture-qa.md

Create a comprehensive FAQ organized by topic. Write 50+ questions and detailed answers that someone unfamiliar with the project might ask. Include:

**General**:
- What is Reflex?
- Who are the users?
- How does it make money?
- What problem does it solve?

**Technical Architecture**:
- Why [cloud platform]?
- Why not the other cloud?
- How does it connect to the refinery?
- How does it handle the OT/IT network boundary?
- What happens when the cloud is unreachable?
- How does the trigger system work?
- How does it interact with Excel?
- Why not replace Excel entirely?

**AI/LLM**:
- Why Claude specifically?
- What if Claude hallucinates?
- How do you validate AI output?
- What are the AI cost projections?
- How do you handle prompt versioning?

**Data & Security**:
- Where is data stored?
- How is data encrypted?
- What about data sovereignty?
- How does multi-tenancy work?
- What compliance standards does it meet?

**Business & Operations**:
- How does pricing work?
- What does implementation look like?
- How long to onboard a new site?
- What's the MVP vs full product?

**For the Student Team**:
- What should we build first?
- What can we skip for the MVP?
- How do we test without a real refinery?
- What skills do we need to learn?
- How do we simulate historian data?
- How do we stay under budget?
```

---

## Run 4: Team Presentation Deck

**Goal**: Create a comprehensive PowerPoint presentation that walks you and your teammate through everything produced in Runs 1-3, in a logical narrative order, with references to the source files for deep dives.

**Agents in this run**: 4 parallel content agents + 1 sequential assembler

**Prerequisite**: Runs 1, 2, and 3 complete.

Each content agent reads its relevant source files, then writes a structured markdown file with slide-ready content (titles, bullet points, speaker notes, deep-dive refs). The assembler takes all four content files and builds the final PPTX.

---

### Shared Design Rules (referenced by all agents below)

All content agents must follow these formatting rules when writing their slide content files:

```
SLIDE CONTENT FORMAT — use this exact structure for every slide:

---SLIDE---
type: [title | divider | content | table | visual | two-column]
title: "Slide Title Here"
subtitle: "(optional subtitle)"
bullets:
  - "Bullet point 1"
  - "Bullet point 2"
  - "Bullet point 3"
table: (optional, for table slides)
  headers: ["Col1", "Col2", "Col3"]
  rows:
    - ["val1", "val2", "val3"]
    - ["val1", "val2", "val3"]
left_column: (optional, for two-column slides)
  - "Left bullet 1"
  - "Left bullet 2"
right_column: (optional, for two-column slides)
  - "Right bullet 1"
  - "Right bullet 2"
speaker_notes: "Talking points for the presenter — what to say, context to share, how to transition to next slide"
deep_dive: "relative/path/to/source/file.md"
visual_description: "(optional) Description of a diagram or visual to build with python-pptx shapes — include nodes, connections, labels, and layout direction"
---END---
```

Rules for content quality:
- One key idea per slide — don't cram
- Bullets must be punchy, max 8 words each where possible
- Speaker notes should be conversational — this is what you'd SAY while presenting
- Every slide that references research must have a deep_dive path
- Use "two-column" type for before/after comparisons (e.g., Original Plan vs New Approach)
- Use "visual" type when a diagram would be more effective than bullets — include a visual_description the assembler can use to build shapes
- Use "table" type for risk matrices, tech stack comparisons, ADR summaries
```

---

### Agent 4A: Opportunity & Risk Slides

**Terminal tab name**: `run4-opportunity-risks`

```
You are a presentation content strategist specializing in startup pitch narratives and risk communication. Your job is to create slide content for Sections 1-2 of the Reflex team walkthrough presentation.

FIRST: Read these files thoroughly:
- /Users/ianrowe/git/Reflex/docs/product-transcript.md (original vision — this is the narrative backbone for Section 1)
- /Users/ianrowe/git/Reflex/research/run1/technical-risks.md
- /Users/ianrowe/git/Reflex/research/run1/business-risks.md
- /Users/ianrowe/git/Reflex/research/run1/adoption-risks.md
- /Users/ianrowe/git/Reflex/research/run1/RISK-MATRIX.md
- /Users/ianrowe/git/Reflex/research/run1/EXECUTIVE-SUMMARY.md

## Your Sections

Write slide content to: /Users/ianrowe/git/Reflex/presentation/section1-opportunity-and-risks.md

Use the exact SLIDE CONTENT FORMAT defined below for every slide.

### Section 1: The Opportunity (5-7 slides)
Create slides for:
1. Title slide: "Reflex — Team Walkthrough" with date (March 2026)
2. The Problem: Mid-size refineries running multi-million-dollar operations on Excel spreadsheets. Make this visceral — the contrast between 800-degree reactors and a guy typing into a spreadsheet
3. The Daily Pain: LP planner's morning routine — manual data pull, type into Excel, run model, email results. By noon it's already wrong. Include the "Google Maps with manual GPS coordinates" analogy
4. The Market Gap: Enterprise RTO costs $300K-$800K/yr → mid-market (80-120 sites) completely priced out → $180M opportunity sitting on the table
5. Our Solution: Reflex in one sentence. High-level visual description showing: Historian → Reflex → Excel LP → Claude → Slack → Operator. Emphasize "we're building the wire, not reinventing the math"
6. Business Model: $75-125K/site/year, 80-120 target sites, $8-15M ARR potential, acquisition exit $100-250M
7. Why Us, Why Now: AI translation layer (Claude) didn't exist 3 years ago, Seeq-style integration layers are maturing, mid-market still completely ignored
- Deep dive ref on all: docs/product-transcript.md

### Section 2: Risk Research — What Could Kill This (8-10 slides)
Create slides for:
8. Section divider: "Risk Analysis — What Could Kill This"
9. Top 5 Existential Risks: One slide with the 5 scariest findings from the executive summary. Make them blunt and honest.
10-11. Technical Risks (2 slides): Distill the top findings — historian integration complexity, Excel automation limits, OT/IT security firewalls, Excel single-threaded bottleneck. Use a table or severity-ranked list.
    - deep_dive: research/run1/technical-risks.md
12-13. Business & Market Risks (2 slides): Market size validation (is 80-120 accurate?), competitive landscape (are incumbents going downmarket?), sales cycle reality (18+ months?), team credibility gap (students selling to refineries)
    - deep_dive: research/run1/business-risks.md
14-15. Adoption Risks (2 slides): Operator trust in AI, Slack/Teams viability on shift, alert fatigue despite triggers, NLP constraint extraction reliability, union concerns
    - deep_dive: research/run1/adoption-risks.md
16. Risk Matrix: Table slide showing top 10 must-solve-before-building risks with columns: Risk | Severity | Likelihood | Component Affected | GO/NO-GO
    - deep_dive: research/run1/RISK-MATRIX.md
17. Easy Wins: Top 5 things that derisk the project quickly and cheaply
    - deep_dive: research/run1/EXECUTIVE-SUMMARY.md

### Speaker Notes Guidance
- Section 1 speaker notes should be enthusiastic but grounded — you're selling the opportunity to your teammate
- Section 2 speaker notes should be honest and direct — "here's what could go wrong and we need to talk about it"
- Include transition notes between sections: "Now that we've seen the opportunity, let's look at what could kill it"

SLIDE CONTENT FORMAT — use this exact structure for every slide:

---SLIDE---
type: [title | divider | content | table | visual | two-column]
title: "Slide Title Here"
subtitle: "(optional)"
bullets:
  - "Bullet 1"
  - "Bullet 2"
table: (optional)
  headers: ["Col1", "Col2"]
  rows:
    - ["val1", "val2"]
left_column: (optional, for two-column)
  - "Left 1"
right_column: (optional, for two-column)
  - "Right 1"
speaker_notes: "What to say while presenting"
deep_dive: "relative/path/to/file.md"
visual_description: "(optional) Diagram to build with shapes"
---END---
```

---

### Agent 4B: Plan Changes & Engineering Spec Slides

**Terminal tab name**: `run4-changes-spec`

```
You are a presentation content strategist specializing in technical architecture communication. Your job is to create slide content for Sections 3-4 of the Reflex team walkthrough presentation.

FIRST: Read these files thoroughly:
- /Users/ianrowe/git/Reflex/docs/product-transcript.md (original vision — needed to understand what changed)
- /Users/ianrowe/git/Reflex/ENGINEERING-SPEC.md (especially Section 1.5 "Changes & Shifts")
- /Users/ianrowe/git/Reflex/research/run2/cloud-platform-recommendation.md
- /Users/ianrowe/git/Reflex/research/run2/data-architecture.md
- /Users/ianrowe/git/Reflex/research/run2/api-backend-architecture.md
- /Users/ianrowe/git/Reflex/research/run2/frontend-ux-architecture.md
- /Users/ianrowe/git/Reflex/research/run1/EXECUTIVE-SUMMARY.md (for risk context that drove changes)

## Your Sections

Write slide content to: /Users/ianrowe/git/Reflex/presentation/section2-changes-and-spec.md

Use the exact SLIDE CONTENT FORMAT (same as Agent 4A — see below).

### Section 3: What Changed — Original Plan vs Research Reality (3-5 slides)
Create slides for:
1. Section divider: "How Research Changed Our Plan"
2-5. For EACH major shift from the engineering spec's Section 1.5, create a two-column slide:
   - Left column: "Original Assumption" — what the transcript/original plan said
   - Right column: "New Approach" — what research revealed and how the spec adapted
   - Speaker notes: explain WHY this changed and what research finding drove it
   - deep_dive: ENGINEERING-SPEC.md
   - If there are more than 4 major shifts, group smaller ones into a single "Other Adjustments" slide

### Section 4: Engineering Specification (10-12 slides)
Create slides for:
6. Section divider: "Engineering Specification"
7. Cloud Platform Recommendation: Which cloud was chosen, the 3 strongest reasons why, cost projection for Year 1 (students). Use a two-column comparison if the decision was close.
   - deep_dive: research/run2/cloud-platform-recommendation.md
8. System Architecture Overview: Visual slide — describe the high-level component diagram for the assembler to build with python-pptx shapes. Show: Data Ingestion → Trigger Engine → LP Orchestrator → AI Translation → Messaging, with Constraint Registry and Dashboards as side flows
9. Technology Stack: Table slide with columns: Component | Technology | Why Chosen | Alternative Considered
10. Data Architecture: Key data flows, storage choices (time-series vs relational vs document), database technologies
    - deep_dive: research/run2/data-architecture.md
11. Service Architecture: Service boundaries diagram description, monolith-first vs microservices decision, communication patterns
    - deep_dive: research/run2/api-backend-architecture.md
12. AI/LLM Integration: How Claude is used (translation, constraint extraction, pattern detection), validation approach, what happens when Claude is wrong, cost projections
13. Frontend & Operator UX: Dashboard overview, Slack/Teams bot design, industrial UX considerations (dark mode, glove-friendly, control room readability)
    - deep_dive: research/run2/frontend-ux-architecture.md
14. Security Architecture: OT/IT boundary, edge vs cloud split, encryption, compliance (ISA/IEC 62443)
15. Risk Mitigations Built In: Table slide mapping top 5-7 risks → specific architectural decisions that address them
16. Full spec reference slide
    - deep_dive: ENGINEERING-SPEC.md

### Speaker Notes Guidance
- Section 3 notes should frame changes positively: "research made our plan better" not "we were wrong"
- Section 4 notes should explain decisions simply — assume your teammate hasn't read the full spec. Focus on the WHY behind each choice, not just the WHAT

SLIDE CONTENT FORMAT — use this exact structure for every slide:

---SLIDE---
type: [title | divider | content | table | visual | two-column]
title: "Slide Title Here"
subtitle: "(optional)"
bullets:
  - "Bullet 1"
  - "Bullet 2"
table: (optional)
  headers: ["Col1", "Col2"]
  rows:
    - ["val1", "val2"]
left_column: (optional, for two-column)
  - "Left 1"
right_column: (optional, for two-column)
  - "Right 1"
speaker_notes: "What to say while presenting"
deep_dive: "relative/path/to/file.md"
visual_description: "(optional) Diagram to build with shapes"
---END---
```

---

### Agent 4C: Architecture Visuals & Decisions Slides

**Terminal tab name**: `run4-arch-visuals`

```
You are a presentation content strategist specializing in architecture visualization and decision communication. Your job is to create slide content for Sections 5-6 of the Reflex team walkthrough presentation.

FIRST: Read these files thoroughly:
- /Users/ianrowe/git/Reflex/docs/architecture-diagrams.md (all Mermaid diagrams)
- /Users/ianrowe/git/Reflex/docs/architecture-decisions.md (all ADRs)
- /Users/ianrowe/git/Reflex/ENGINEERING-SPEC.md (for context)

## Your Sections

Write slide content to: /Users/ianrowe/git/Reflex/presentation/section3-architecture-visuals.md

Use the exact SLIDE CONTENT FORMAT (same as other agents — see below).

### Section 5: Architecture Visuals (5-7 slides)
Since Mermaid can't render natively in PowerPoint, your job is to translate the key diagrams into visual_description fields that the assembler agent can use to build simplified diagrams with python-pptx shapes (rectangles, arrows, rounded boxes, cylinders).

Create slides for:
1. Section divider: "Architecture Diagrams"
2. System Context Diagram: Translate the C4 Level 1 Mermaid diagram into a visual_description. List every node (shape, label, color), every connection (from → to, label), and the layout direction. Group nodes into subgraphs (e.g., "Refinery Side", "Cloud", "External"). Keep it to 8-10 nodes max for readability.
   - deep_dive: docs/architecture-diagrams.md
3. Data Flow — Happy Path: Translate the sequence diagram into a simplified left-to-right flow visual_description. Show the key steps: Historian data arrives → Trigger evaluates → LP model runs → Claude translates → Slack delivers → Operator acts. Label each arrow with what flows.
   - deep_dive: docs/architecture-diagrams.md
4. Data Flow — Feedback Path: Translate the feedback sequence diagram. Show: Operator rejects → Constraint extracted → LP re-solves → Revised recommendation delivered. Highlight the constraint registry as a persistent store.
   - deep_dive: docs/architecture-diagrams.md
5. Network Architecture: Translate the OT/IT boundary diagram. Show the refinery firewall, edge component, secure tunnel, and cloud components. Use red/orange for security boundaries.
   - deep_dive: docs/architecture-diagrams.md
6. Implementation Phases: Translate the Gantt chart into a simplified 3-row timeline visual_description showing Phase 1 (MVP), Phase 2 (Beta), Phase 3 (GA) with key milestones and what's in each phase.
   - deep_dive: docs/architecture-diagrams.md

For each visual_description, be EXTREMELY specific:
- Name every node: "Rectangle, label='Trigger Engine', color=#27AE60, position=center-left"
- Name every arrow: "Arrow from 'Trigger Engine' to 'LP Orchestrator', label='trigger event', style=solid"
- Specify layout: "Left to right, 3 rows"
- Specify grouping: "Subgraph box around nodes X, Y, Z labeled 'Refinery Network', border=dashed red"

### Section 6: Architecture Decisions (3-4 slides)
Create slides for:
7. Section divider: "Key Architecture Decisions"
8-10. Create table slides summarizing the most impactful ADRs. Group them by theme:
    - Slide 1: Infrastructure Decisions (cloud platform, deployment model, edge vs cloud, monolith vs microservices)
    - Slide 2: Data & Integration Decisions (database choices, historian connector, Excel integration, market data source)
    - Slide 3: AI & UX Decisions (LLM provider, constraint extraction approach, messaging channel, frontend framework)
    - Table columns: Decision | What We Chose | Key Reason | Risk It Addresses
    - deep_dive: docs/architecture-decisions.md

### Speaker Notes Guidance
- For diagram slides: speaker notes should walk through the diagram step by step, as if pointing at each component
- For ADR slides: speaker notes should highlight the most surprising or counterintuitive decisions — "you might expect us to use X, but we chose Y because..."

SLIDE CONTENT FORMAT — use this exact structure for every slide:

---SLIDE---
type: [title | divider | content | table | visual | two-column]
title: "Slide Title Here"
subtitle: "(optional)"
bullets:
  - "Bullet 1"
  - "Bullet 2"
table: (optional)
  headers: ["Col1", "Col2"]
  rows:
    - ["val1", "val2"]
left_column: (optional, for two-column)
  - "Left 1"
right_column: (optional, for two-column)
  - "Right 1"
speaker_notes: "What to say while presenting"
deep_dive: "relative/path/to/file.md"
visual_description: "(optional) DETAILED description of diagram to build with python-pptx shapes — include every node, arrow, label, color, position, and grouping"
---END---
```

---

### Agent 4D: Roadmap, Open Questions & File Index Slides

**Terminal tab name**: `run4-roadmap-next`

```
You are a presentation content strategist specializing in implementation planning and actionable next steps. Your job is to create slide content for Sections 7-8 of the Reflex team walkthrough presentation.

FIRST: Read these files thoroughly:
- /Users/ianrowe/git/Reflex/ENGINEERING-SPEC.md (Section 11: Implementation Roadmap, Section 12: Open Questions)
- /Users/ianrowe/git/Reflex/research/run1/EXECUTIVE-SUMMARY.md (phased approach recommendations)
- /Users/ianrowe/git/Reflex/docs/architecture-qa.md (especially the "For the Student Team" section)

Also scan all files in the repo to build the complete file index:
- /Users/ianrowe/git/Reflex/docs/product-transcript.md
- /Users/ianrowe/git/Reflex/research/run1/ (all files)
- /Users/ianrowe/git/Reflex/research/run2/ (all files)
- /Users/ianrowe/git/Reflex/docs/ (all files)
- /Users/ianrowe/git/Reflex/ENGINEERING-SPEC.md

## Your Sections

Write slide content to: /Users/ianrowe/git/Reflex/presentation/section4-roadmap-and-next.md

Use the exact SLIDE CONTENT FORMAT (same as other agents — see below).

### Section 7: Implementation Roadmap (4-5 slides)
Create slides for:
1. Section divider: "What We Build & When"
2. Phase 1 — MVP: What's in scope (single pilot site), key deliverables, success criteria, timeline estimate. What do we build FIRST? What can we skip?
   - deep_dive: ENGINEERING-SPEC.md
3. Phase 2 — Beta: Scale to 3-5 sites, new features added, what changes from MVP architecture
4. Phase 3 — GA: Production-ready for 80+ sites, full feature set, what scales
5. Visual timeline: Create a visual_description for a horizontal timeline showing all 3 phases with key milestones, deliverables at each stage, and a "you are here" marker at Phase 1 start

### Section 8: Open Questions & Next Steps (4-5 slides)
Create slides for:
6. Section divider: "Open Questions & Next Steps"
7. Open Questions: The top unresolved decisions that need team discussion or external input. Frame each as a clear question with the options and tradeoffs. These should spark discussion during the walkthrough.
8. Immediate Next Steps: What the team should do THIS WEEK and THIS MONTH after the walkthrough. Be concrete — "Set up AWS account with student credits", "Build historian data simulator", "Write first Claude prompt template", etc.
9. Skills Gap & Learning Plan: Based on the architecture-qa.md "For the Student Team" section, what skills does the team need to learn? Suggest specific resources or areas to focus on.
10. Complete File Index: Create a table slide listing EVERY file generated across all runs with columns: File Path (relative) | What It Contains | When To Read It
    - List files in the order you'd want to read them (narrative order, not alphabetical)
    - This is the "table of contents" for all the research and specs

### Speaker Notes Guidance
- Roadmap slides: frame as "here's how we eat the elephant — one bite at a time"
- Open questions: frame as discussion prompts — "we need to decide this together"
- Next steps: be motivating — "here's what we can start on tomorrow"
- File index: "bookmark this slide — it's your map to everything we produced"

SLIDE CONTENT FORMAT — use this exact structure for every slide:

---SLIDE---
type: [title | divider | content | table | visual | two-column]
title: "Slide Title Here"
subtitle: "(optional)"
bullets:
  - "Bullet 1"
  - "Bullet 2"
table: (optional)
  headers: ["Col1", "Col2"]
  rows:
    - ["val1", "val2"]
left_column: (optional, for two-column)
  - "Left 1"
right_column: (optional, for two-column)
  - "Right 1"
speaker_notes: "What to say while presenting"
deep_dive: "relative/path/to/file.md"
visual_description: "(optional) Diagram to build with shapes"
---END---
```

---

### Agent 4E: PPTX Assembler (RUN AFTER 4A-4D COMPLETE)

**Terminal tab name**: `run4-assembler`

**Wait for**: Agents 4A, 4B, 4C, 4D to complete

```
You are a PowerPoint engineer. Your job is to read four structured slide content files and assemble them into a single, polished, professional PowerPoint presentation using python-pptx.

Install python-pptx first: pip install python-pptx

## Read ALL slide content files in order:
1. /Users/ianrowe/git/Reflex/presentation/section1-opportunity-and-risks.md (Sections 1-2: Opportunity + Risks)
2. /Users/ianrowe/git/Reflex/presentation/section2-changes-and-spec.md (Sections 3-4: Changes + Eng Spec)
3. /Users/ianrowe/git/Reflex/presentation/section3-architecture-visuals.md (Sections 5-6: Diagrams + ADRs)
4. /Users/ianrowe/git/Reflex/presentation/section4-roadmap-and-next.md (Sections 7-8: Roadmap + Next Steps)

Also read for context if needed:
- /Users/ianrowe/git/Reflex/docs/architecture-diagrams.md (Mermaid source for diagram slides)

## Output
Write the .pptx to: /Users/ianrowe/git/Reflex/Reflex-Team-Walkthrough.pptx

## Design Specification

### Color Scheme
- Slide background: Dark navy (#1B2A4A)
- Primary text: White (#FFFFFF)
- Subtitle/secondary text: Light gray (#B0BEC5)
- Accent/highlights: Gold (#D4A843)
- Risk/danger: Red (#C0392B)
- Mitigation/positive: Green (#27AE60)
- Neutral info: Blue (#3498DB)
- Divider slides: Slightly lighter navy (#243B5E) to differentiate

### Typography
- Slide titles: 28pt, Bold, White
- Subtitles: 20pt, Regular, Light gray
- Body/bullets: 18pt, Regular, White
- Table headers: 16pt, Bold, Gold
- Table cells: 14pt, Regular, White
- Deep dive refs: 12pt, Italic, Light gray (#78909C), positioned at bottom-left of slide
- Speaker notes: 12pt, Regular (these go in the notes section, not on the slide)

### Layout Rules
- All slides: 16:9 aspect ratio (13.333" x 7.5")
- Slide numbers on every slide (bottom-right, 10pt, light gray)
- Content margins: 0.75" on all sides
- Title positioned at top with 0.2" padding below
- Deep dive reference: text box at bottom-left, 0.5" from bottom edge
- Maximum 6 bullets per slide
- Tables: alternating row shading (dark navy / slightly lighter navy)

### Slide Type Rendering

**title**: Large centered title (36pt), subtitle below (20pt), date at bottom
**divider**: Section number + title centered vertically (32pt, Gold text), dark background
**content**: Title at top, bullets below with consistent spacing
**table**: Title at top, table below with styled headers and alternating rows
**visual**: Title at top, then build the diagram described in visual_description using python-pptx shapes:
  - Use `MSO_SHAPE.ROUNDED_RECTANGLE` for services/components
  - Use `MSO_SHAPE.FLOWCHART_MAGNETIC_DISK` (cylinder) for databases
  - Use `MSO_SHAPE.DIAMOND` for decision points
  - Use `MSO_SHAPE.OVAL` for users/actors
  - Use `MSO_SHAPE.HEXAGON` for external systems
  - Use connectors (`add_connector`) with labels for arrows between shapes
  - Use dashed-border rectangles (no fill, dashed outline) for grouping subgraphs
  - Color shapes according to the visual_description, defaulting to the color scheme above
  - If a visual_description is too complex to render perfectly, simplify to the key components and add a note "See docs/architecture-diagrams.md for full detail"
**two-column**: Title at top, left column on left half, right column on right half, with a thin vertical divider line. Use contrasting subtle background tints if the content represents before/after.

### Quality Checks
After building the PPTX:
1. Verify total slide count is between 40-55
2. Verify every slide has a slide number
3. Verify every non-divider/title slide with research content has a deep_dive reference
4. Verify speaker notes are populated on every content slide
5. Verify no slide has more than 6 bullet points
6. Open and re-read the file to check for rendering issues

If any visual_description is too ambiguous to render as shapes, fall back to a clean bulleted description of the diagram with a prominent "Render at mermaid.live — see docs/architecture-diagrams.md" note.
```

---

## Run Summary

| Run | Agents | Parallel? | Estimated Duration | Output |
|-----|--------|-----------|-------------------|--------|
| **1** | 1A, 1B, 1C (parallel) then 1D (sequential) | Partially | 30-45 min | Risk matrix + executive summary |
| **2** | 2A, 2B, 2C, 2D (parallel) then 2E (sequential) | Partially | 45-60 min | Complete engineering spec |
| **3** | 3A, 3B (parallel) | Fully | 20-30 min | Diagrams + ADRs + Q&A knowledge base |
| **4** | 4A, 4B, 4C, 4D (parallel) then 4E (sequential) | Partially | 20-30 min | Team walkthrough PowerPoint deck |

## File Structure After All Runs

```
/Users/ianrowe/git/Reflex/
├── ENGINEERING-SPEC.md                          # Complete engineering specification
├── Reflex-Team-Walkthrough.pptx                 # Final presentation deck (Agent 4E)
├── agent-orchestration.md                       # This file
├── presentation/
│   ├── section1-opportunity-and-risks.md        # Agent 4A output (slide content)
│   ├── section2-changes-and-spec.md             # Agent 4B output (slide content)
│   ├── section3-architecture-visuals.md         # Agent 4C output (slide content)
│   └── section4-roadmap-and-next.md             # Agent 4D output (slide content)
├── docs/
│   ├── product-transcript.md                    # Original product deep-dive transcript (read by ALL agents)
│   ├── architecture-diagrams.md                 # Agent 3A output
│   ├── architecture-decisions.md                # Agent 3B output
│   └── architecture-qa.md                       # Agent 3B output
├── research/
│   ├── run1/
│   │   ├── technical-risks.md                   # Agent 1A output
│   │   ├── business-risks.md                    # Agent 1B output
│   │   ├── adoption-risks.md                    # Agent 1C output
│   │   ├── RISK-MATRIX.md                       # Agent 1D output (synthesis)
│   │   └── EXECUTIVE-SUMMARY.md                 # Agent 1D output (summary)
│   └── run2/
│       ├── cloud-platform-recommendation.md     # Agent 2A output
│       ├── data-architecture.md                 # Agent 2B output
│       ├── api-backend-architecture.md          # Agent 2C output
│       └── frontend-ux-architecture.md          # Agent 2D output
└── (docs/ listed above)
```

## Instructions for Dispatching

1. **Run 1**: Open 3 terminal tabs. Paste prompts for 1A, 1B, 1C. Let all three complete. Then open 1 tab for 1D.
2. **Run 2**: Open 4 terminal tabs. Paste prompts for 2A, 2B, 2C, 2D. Let all four complete. Then open 1 tab for 2E.
3. **Run 3**: Open 2 terminal tabs. Paste prompts for 3A, 3B. Both can run fully in parallel.
4. **Run 4**: Open 4 terminal tabs. Paste prompts for 4A, 4B, 4C, 4D. Let all four complete. Then open 1 tab for 4E (assembles the PPTX).

**Total terminal sessions**: 15 (across 4 runs, never more than 4 simultaneous)

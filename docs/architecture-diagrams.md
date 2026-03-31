# Reflex Platform — Architecture Diagrams

> All diagrams use Mermaid syntax and render in GitHub, VS Code, and most markdown viewers.

**Color Legend (consistent across all diagrams):**
| Color | Meaning |
|-------|---------|
| Green (`#2ecc71`) | Reflex-owned services & components |
| Blue (`#3498db`) | External systems & integrations |
| Orange (`#e67e22`) | Data stores & databases |
| Red (`#e74c3c`) | Security boundaries & critical paths |
| Purple (`#9b59b6`) | AI/LLM components |
| Grey (`#95a5a6`) | Human actors & manual processes |

---

## 1. System Context Diagram (C4 Level 1)

Shows Reflex as a system-in-context with all external actors and systems it interacts with. Key thing to notice: Reflex sits between three existing pillars (historian, LP model, operators) that are currently disconnected — it is the "wire" connecting them.



![Diagram 1](images/diagram_1.png)

<details>
<summary>View Mermaid source</summary>

```mermaid
graph LR
    %% Actors
    SS([Shift Supervisors]):::actor
    LP([LP Planners]):::actor
    MGT([Plant Management]):::actor

    %% External Systems
    PI[(PI Historian<br/>Process Data)]:::datastore
    MKT{{Market Data Feeds<br/>EIA / OPIS / Platts}}:::external
    EXCEL{{Excel LP Models<br/>Site-Specific Math}}:::external

    %% Reflex
    REFLEX[Reflex Platform<br/>Workflow Optimization]:::reflex

    %% Delivery Channels
    TEAMS{{Microsoft Teams}}:::external
    SLACK{{Slack}}:::external
    EMAIL{{Email}}:::external
    CLAUDE{{Claude API<br/>Anthropic}}:::ai

    %% Data flows into Reflex
    PI -->|"sensor readings<br/>every 30-60s"| REFLEX
    MKT -->|"spot prices &<br/>crack spreads"| REFLEX
    EXCEL -->|"LP solve results<br/>via COM automation"| REFLEX

    %% Reflex to delivery
    REFLEX -->|"plain-English<br/>recommendations"| TEAMS
    REFLEX -->|"plain-English<br/>recommendations"| SLACK
    REFLEX -->|"fallback<br/>notifications"| EMAIL
    REFLEX <-->|"natural language<br/>formatting only"| CLAUDE

    %% Delivery to actors
    TEAMS -->|"Adaptive Cards<br/>+ 5-tap input"| SS
    SLACK -->|"Block Kit<br/>messages"| LP
    EMAIL -->|"digest &<br/>alerts"| MGT

    %% Actor feedback
    SS -->|"structured constraints<br/>via 5-tap wizard"| REFLEX
    LP -->|"trigger config &<br/>model tuning"| REFLEX
    MGT -->|"dashboard views<br/>gain-framed KPIs"| REFLEX

    %% Styles
    classDef reflex fill:#2ecc71,stroke:#27ae60,color:#fff,stroke-width:2px
    classDef external fill:#3498db,stroke:#2980b9,color:#fff
    classDef datastore fill:#e67e22,stroke:#d35400,color:#fff
    classDef ai fill:#9b59b6,stroke:#8e44ad,color:#fff
    classDef actor fill:#95a5a6,stroke:#7f8c8d,color:#fff
```

</details>

---

## 2. Container Diagram (C4 Level 2)

Shows all containers and services within the Reflex platform. Key thing to notice: the cloud backend is a **modular monolith** — all modules run in one FastAPI process except the Windows LP Worker (separate due to Excel COM requirements).



![Diagram 2](images/diagram_2.png)

<details>
<summary>View Mermaid source</summary>

```mermaid
graph TD
    %% ── Refinery DMZ ──
    subgraph DMZ["Refinery DMZ (Purdue Level 3.5)"]
        PIWEB[(PI Web API<br/>Read-Only Replica)]:::datastore
        EDGE[Edge Agent<br/>Python Docker ~60MB]:::reflex
        SQLITE[(SQLite Buffer<br/>Store & Forward)]:::datastore

        PIWEB -->|"StreamSets bulk read<br/>100+ tags per call"| EDGE
        EDGE -->|"buffered writes<br/>if cloud unreachable"| SQLITE
        SQLITE -->|"retry queue<br/>on reconnect"| EDGE
    end

    %% ── Azure Cloud ──
    subgraph CLOUD["Reflex Cloud (Azure)"]

        subgraph INGRESS["Ingestion Layer"]
            IOT[Azure IoT Hub]:::external
            INGEST[Data Ingestion<br/>Module]:::reflex
        end

        subgraph CORE["FastAPI Modular Monolith"]
            DQG[Data Quality<br/>Gateway]:::reflex
            TRIGGER[Trigger Engine<br/>~200 rules]:::reflex
            LPORCH[LP Orchestrator]:::reflex
            AITRANS[AI Translation<br/>Service]:::reflex
            MSG[Messaging<br/>Service]:::reflex
            FEEDBACK[Feedback<br/>Processor]:::reflex
            CONSTR[Constraint<br/>Registry]:::reflex
            RECON[Reconciliation<br/>Engine]:::reflex
            DASH[Dashboard API<br/>REST + SSE]:::reflex
            AUTH[Auth & Admin<br/>JWT + RBAC]:::reflex
        end

        subgraph DATA["Data Layer"]
            PG[(PostgreSQL 16<br/>+ TimescaleDB)]:::datastore
            REDIS[(Redis 7<br/>Cache + Broker)]:::datastore
            BLOB[(Azure Blob<br/>LP Model Files)]:::datastore
        end

        subgraph FRONT["Frontend"]
            NEXT[Next.js 15 App<br/>Operations + Analytics<br/>+ Admin Dashboards]:::reflex
        end

        subgraph EXTERNAL["External Services"]
            CLAUDE[Claude API<br/>Haiku + Sonnet]:::ai
            BOT[Azure Bot Service<br/>Teams + Slack]:::external
            ACS[Azure Communication<br/>Services — Email]:::external
        end
    end

    %% ── Windows LP Worker (separate VM) ──
    subgraph LPVM["Windows VM (Azure B2s)"]
        LPWORKER[LP Worker<br/>Excel COM + safexl]:::reflex
    end

    %% ── Data flows ──
    EDGE -->|"HTTPS outbound only<br/>validated sensor batches"| IOT
    IOT -->|"event stream"| INGEST
    INGEST -->|"raw data write"| PG
    INGEST -->|"SensorDataReceived<br/>event via Redis"| DQG
    DQG -->|"ValidatedDataReady<br/>event"| TRIGGER
    DQG -->|"OperatingModeChanged<br/>event"| TRIGGER
    TRIGGER -->|"OptimizationTriggered<br/>event"| LPORCH
    LPORCH -->|"Celery task dispatch"| REDIS
    REDIS -->|"task pickup"| LPWORKER
    LPWORKER -->|"structured LP results<br/>via Celery"| LPORCH
    LPORCH -->|"SolveCompleted event"| AITRANS
    AITRANS -->|"pre-validated numbers<br/>+ prompt template"| CLAUDE
    CLAUDE -->|"plain-English text"| AITRANS
    AITRANS -->|"RecommendationReady<br/>event"| MSG
    MSG -->|"Adaptive Cards /<br/>Block Kit messages"| BOT
    MSG -->|"email fallback"| ACS
    MSG -->|"OperatorResponseReceived<br/>event"| FEEDBACK
    FEEDBACK -->|"ConstraintCreated<br/>event"| CONSTR
    FEEDBACK -->|"ResolveRequested<br/>event"| LPORCH
    RECON -->|"reads predicted vs actual"| PG
    DASH -->|"SSE live updates"| NEXT
    DASH -->|"REST queries"| NEXT
    AUTH -->|"JWT validation"| DASH

    %% Store interactions
    DQG -->|"quality events"| PG
    TRIGGER -->|"trigger events"| PG
    AITRANS -->|"recommendations<br/>+ deltas JSON"| PG
    CONSTR -->|"constraint lifecycle"| PG
    RECON -->|"coefficient snapshots"| PG

    %% Styles
    classDef reflex fill:#2ecc71,stroke:#27ae60,color:#fff,stroke-width:2px
    classDef external fill:#3498db,stroke:#2980b9,color:#fff
    classDef datastore fill:#e67e22,stroke:#d35400,color:#fff
    classDef ai fill:#9b59b6,stroke:#8e44ad,color:#fff
```

</details>

---

## 3a. Data Flow — Happy Path (Sequence Diagram)

Shows the complete end-to-end flow from a sensor reading change to a recommendation delivered to a shift supervisor. Key thing to notice: numbers are **never** generated by the LLM — they are programmatically extracted and cross-validated.



![Diagram 3](images/diagram_3.png)

<details>
<summary>View Mermaid source</summary>

```mermaid
sequenceDiagram
    autonumber
    participant PI as PI Historian
    participant EA as Edge Agent
    participant IH as Azure IoT Hub
    participant DI as Data Ingestion
    participant DQ as Data Quality Gateway
    participant TE as Trigger Engine
    participant LO as LP Orchestrator
    participant LW as Windows LP Worker
    participant AI as AI Translation
    participant CL as Claude API
    participant MS as Messaging Service
    participant SS as Shift Supervisor

    rect rgb(240, 248, 255)
        Note over PI,EA: Refinery DMZ (Purdue Level 3.5)
        PI->>EA: Sensor readings via PI Web API StreamSets
        activate EA
        EA->>EA: Data quality pre-check (range, staleness)
        EA->>EA: Buffer to SQLite (store-and-forward)
        EA->>IH: HTTPS POST — validated batch (outbound only)
        deactivate EA
    end

    rect rgb(240, 255, 240)
        Note over IH,DQ: Ingestion & Validation
        IH->>DI: Event stream delivery
        activate DI
        DI->>DI: Normalize, timestamp, persist to TimescaleDB
        DI-->>DQ: SensorDataReceived event (Redis pub/sub)
        deactivate DI
        activate DQ
        DQ->>DQ: Validate: staleness, range, rate-of-change,<br/>compression artifacts, digital states
        DQ->>DQ: Detect operating mode (Normal/Startup/Shutdown/Upset)
        DQ-->>TE: ValidatedDataReady event
        deactivate DQ
    end

    rect rgb(255, 248, 240)
        Note over TE,LW: Trigger & LP Solve
        activate TE
        TE->>TE: Evaluate ~200 rules against incoming data
        TE->>TE: Check: mode=Normal? Debounce 2min? Cooldown 60min?
        TE-->>LO: OptimizationTriggered (process drift or price move)
        deactivate TE
        activate LO
        LO->>LO: Coalesce triggers within 30s window
        LO->>LW: Celery task: write inputs to Excel, run Solver
        activate LW
        LW->>LW: COM automation via safexl/pywin32<br/>(5-min timeout, watchdog)
        LW-->>LO: Structured LP results (inputs, outputs, deltas)
        deactivate LW
        deactivate LO
    end

    rect rgb(248, 240, 255)
        Note over AI,CL: AI Translation (numbers decoupled from LLM)
        activate AI
        AI->>AI: Programmatic extraction: all numerical deltas
        AI->>AI: Store deltas in recommendations.deltas JSONB
        AI->>CL: Pre-validated numbers + prompt template
        activate CL
        CL-->>AI: Plain-English recommendation text
        deactivate CL
        AI->>AI: Cross-validate: every number matches source,<br/>direction words match delta signs
        alt Validation passes
            AI-->>MS: RecommendationReady (LLM text + verified numbers)
        else Validation fails or API down
            AI-->>MS: RecommendationReady (deterministic template fallback)
        end
        deactivate AI
    end

    rect rgb(255, 240, 240)
        Note over MS,SS: Delivery
        activate MS
        MS->>SS: Teams Adaptive Card with structured actions<br/>"Naphtha yield +8% on Units 3&4 — +$44K/day"
        deactivate MS
        Note over SS: Supervisor reviews in 30 seconds.<br/>Taps: Acknowledge | Add Constraint | Dismiss
    end
```

</details>

---

## 3b. Data Flow — Feedback & Constraint Path

Shows what happens when a shift supervisor disagrees with a recommendation. Key thing to notice: the system **never nags** — once a constraint is registered, conflicting recommendations are suppressed until a human explicitly clears it.



![Diagram 4](images/diagram_4.png)

<details>
<summary>View Mermaid source</summary>

```mermaid
sequenceDiagram
    autonumber
    participant SS as Shift Supervisor
    participant MS as Messaging Service
    participant FP as Feedback Processor
    participant CR as Constraint Registry
    participant LO as LP Orchestrator
    participant LW as Windows LP Worker
    participant AI as AI Translation
    participant SS2 as Shift Supervisor

    rect rgb(255, 240, 240)
        Note over SS,MS: Supervisor Disagrees
        SS->>MS: Taps "Add Constraint" on Adaptive Card
        MS->>SS: 5-tap wizard opens in Teams/Slack
        SS->>MS: Tap 1: Select unit (Unit 2)
        SS->>MS: Tap 2: Select type (Equipment Limit)
        SS->>MS: Tap 3: Select constraint (Heat Exchanger Fouling)
        SS->>MS: Tap 4: Select severity (Cap at 75% capacity)
        SS->>MS: Tap 5: Confirm
    end

    rect rgb(240, 255, 240)
        Note over MS,CR: Constraint Registration
        MS-->>FP: OperatorResponseReceived event
        activate FP
        FP->>FP: Parse structured input (100% accuracy — no NLP)
        FP->>CR: Create constraint: Unit 2 capped at 75%
        activate CR
        CR->>CR: Store by equipment ID (never by operator)
        CR->>CR: Set expiry: 72h default (supervisor can extend)
        CR-->>FP: ConstraintCreated event
        deactivate CR
        FP-->>LO: ResolveRequested (with new constraint bound)
        deactivate FP
    end

    rect rgb(248, 240, 255)
        Note over LO,AI: Re-Solve with Constraint
        activate LO
        LO->>LO: Apply Unit 2 cap to LP input parameters
        LO->>LW: Celery task: re-solve with updated bounds
        activate LW
        LW-->>LO: Revised LP results
        deactivate LW
        LO-->>AI: SolveCompleted (revised)
        deactivate LO
        activate AI
        AI->>AI: Extract revised deltas, translate via Claude
        AI-->>MS: Revised RecommendationReady
        deactivate AI
    end

    rect rgb(240, 248, 255)
        Note over MS,SS2: Revised Recommendation
        MS->>SS2: "With Unit 2 capped at 75%:<br/>increase diesel on Unit 6 instead.<br/>Revised margin: +$11,200/day"
        Note over SS2: System remembers constraint.<br/>Will NOT re-recommend Unit 2<br/>until constraint expires or is cleared.
    end
```

</details>

---

## 4. Network Architecture Diagram (OT/IT Boundary)

Shows the Purdue Model network segmentation. Key thing to notice: Reflex **never** accesses OT systems directly — the Edge Agent reads from a read-only PI replica in the DMZ and communicates outbound-only. No inbound firewall rules are ever required.



![Diagram 5](images/diagram_5.png)

<details>
<summary>View Mermaid source</summary>

```mermaid
graph LR
    subgraph OT["Purdue Level 0-2: Process Control (OT Network)"]
        DCS[DCS / PLCs<br/>Process Control]:::critical
        SENSORS[Sensors<br/>100+ Tags]:::critical
        PIARCH[(PI Data Archive<br/>Primary)]:::datastore
        DCS ---|"control signals"| SENSORS
        SENSORS -->|"readings every 1s"| PIARCH
    end

    subgraph DMZ["Purdue Level 3.5: Demilitarized Zone"]
        PIREP[(PI Archive<br/>Read-Only Replica)]:::datastore
        PIAPI[PI Web API<br/>IIS / HTTPS:443]:::external
        EDGE[Reflex Edge Agent<br/>Python Docker ~60MB<br/>+ SQLite Buffer]:::reflex

        PIREP -->|"REST API queries<br/>Basic Auth / TLS"| PIAPI
        PIAPI -->|"StreamSets bulk read<br/>100+ tags per call"| EDGE
    end

    subgraph CLOUD["Purdue Level 4-5: IT Network / Cloud"]
        IOT[Azure IoT Hub]:::external
        MONOLITH[Reflex Cloud<br/>FastAPI Monolith]:::reflex
        DB[(PostgreSQL<br/>+ TimescaleDB)]:::datastore

        IOT -->|"event stream"| MONOLITH
        MONOLITH -->|"read/write"| DB
    end

    %% Cross-boundary flows
    PIARCH -->|"replication<br/>(AVEVA managed)"| PIREP
    EDGE -->|"HTTPS outbound ONLY<br/>validated sensor batches"| IOT

    %% Firewall annotations
    FW1{{"FIREWALL<br/>OT ↔ DMZ"}}:::firewall
    FW2{{"FIREWALL<br/>DMZ ↔ IT/Cloud"}}:::firewall

    OT ~~~ FW1
    FW1 ~~~ DMZ
    DMZ ~~~ FW2
    FW2 ~~~ CLOUD

    %% Styles
    classDef reflex fill:#2ecc71,stroke:#27ae60,color:#fff,stroke-width:2px
    classDef external fill:#3498db,stroke:#2980b9,color:#fff
    classDef datastore fill:#e67e22,stroke:#d35400,color:#fff
    classDef critical fill:#e74c3c,stroke:#c0392b,color:#fff,stroke-width:2px
    classDef firewall fill:#e74c3c,stroke:#c0392b,color:#fff,stroke-width:3px
```

</details>

**Security highlights:**
- Edge Agent is **read-only** — never writes to OT systems
- All communication is **outbound HTTPS only** from DMZ to cloud
- Compatible with hardware **data diodes** (physically one-way)
- Edge Agent authenticates to PI Web API via Basic Auth over TLS
- Microsoft Defender for IoT provides Purdue Model-aware OT monitoring

---

## 5. Database Schema (ER Diagram)

Shows the complete relational schema from the engineering spec. Key thing to notice: overrides and opportunity costs are tracked by **equipment/unit**, never by individual operator — this is an architectural enforcement of the gain-framing design (Risk R8).



![Diagram 6](images/diagram_6.png)

<details>
<summary>View Mermaid source</summary>

```mermaid
erDiagram
    %% ── Core Configuration ──
    sites {
        uuid id PK
        string name
        string region
        int capacity_bpd
        string timezone
    }

    users {
        uuid id PK
        uuid site_id FK
        string email
        string role "admin|lp_planner|supervisor|management"
        string delivery_channel "teams|slack|email"
    }

    tag_config {
        uuid id PK
        uuid site_id FK
        string pi_web_id
        string tag_name
        float range_min
        float range_max
        string quality_rules "JSONB"
    }

    %% ── Trigger System ──
    trigger_rules {
        uuid id PK
        uuid site_id FK
        string trigger_type "process_drift|price_move|sensor_health"
        float threshold_pct
        int debounce_sec
        int cooldown_sec
        boolean enabled
    }

    operating_modes {
        uuid id PK
        uuid site_id FK
        string mode "Normal|Startup|Shutdown|Upset|Turnaround|Emergency"
        timestamp started_at
        timestamp ended_at
        uuid changed_by FK
    }

    %% ── LP System ──
    lp_models {
        uuid id PK
        uuid site_id FK
        string model_name
        string solver_type "excel_solver|pims|pulp_highs"
        string cell_mappings "JSONB — input/output cells"
        string blob_url "Azure Blob ref"
    }

    lp_runs {
        uuid id PK
        uuid site_id FK
        uuid lp_model_id FK
        uuid trigger_event_id FK
        string status "queued|running|completed|failed|timeout"
        string inputs "JSONB"
        string outputs "JSONB"
        int solve_time_ms
        timestamp created_at
    }

    %% ── Recommendations & Feedback ──
    recommendations {
        uuid id PK
        uuid site_id FK
        uuid lp_run_id FK
        string deltas "JSONB — programmatic numbers"
        string llm_text "Claude-generated prose"
        string template_text "deterministic fallback"
        boolean used_fallback
        float margin_delta_per_day
        string status "pending|acknowledged|constrained|dismissed"
        timestamp created_at
    }

    constraints {
        uuid id PK
        uuid site_id FK
        string equipment_id "by unit, NEVER by operator"
        string constraint_type
        string description
        float severity_value
        string source "structured_input|nlp_confirmed"
        timestamp expires_at
        boolean is_active
    }

    overrides {
        uuid id PK
        uuid site_id FK
        uuid recommendation_id FK
        string equipment_id "by unit, NEVER by operator"
        string response_type "acknowledged|constrained|dismissed"
        float margin_impact
        timestamp created_at
    }

    %% ── Analytics ──
    opportunity_costs {
        uuid id PK
        uuid site_id FK
        string equipment_id "by unit, NEVER by operator"
        float value_captured
        float value_identified
        date period_date
    }

    coefficient_snapshots {
        uuid id PK
        uuid site_id FK
        string unit_id
        string coefficients "JSONB — predicted vs actual yields"
        float max_drift_pct
        timestamp snapshot_at
    }

    sensor_substitutions {
        uuid id PK
        uuid site_id FK
        uuid original_tag_id FK
        uuid substitute_tag_id FK
        string reason
        boolean is_active
    }

    %% ── Audit ──
    audit_log {
        uuid id PK
        uuid site_id FK
        string event_type
        string actor "system|user_id"
        string details "JSONB"
        timestamp created_at
    }

    %% ── Relationships ──
    sites ||--o{ users : "has"
    sites ||--o{ tag_config : "monitors"
    sites ||--o{ trigger_rules : "configures"
    sites ||--o{ operating_modes : "tracks"
    sites ||--o{ lp_models : "owns"
    sites ||--o{ lp_runs : "executes"
    sites ||--o{ recommendations : "generates"
    sites ||--o{ constraints : "registers"
    sites ||--o{ overrides : "records"
    sites ||--o{ opportunity_costs : "measures"
    sites ||--o{ coefficient_snapshots : "reconciles"
    sites ||--o{ sensor_substitutions : "manages"
    sites ||--o{ audit_log : "audits"

    lp_models ||--o{ lp_runs : "solved by"
    lp_runs ||--o| recommendations : "produces"
    recommendations ||--o{ overrides : "responded to"
    tag_config ||--o{ sensor_substitutions : "original tag"
    tag_config ||--o{ sensor_substitutions : "substitute tag"
    users ||--o{ operating_modes : "changed by"
```

</details>

**Time-Series Tables** (TimescaleDB hypertables — not shown in ER diagram due to Mermaid limitations):

| Hypertable | Chunk Interval | Retention | Compression |
|---|---|---|---|
| `sensor_readings` (tag_id, value, quality, timestamp) | 1 day | 2 years | 90%+ after 7 days |
| `sensor_5min` (continuous aggregate) | Auto | 5 years | Auto |
| `market_prices` (commodity, price, source, timestamp) | 7 days | Indefinite | 90%+ after 30 days |
| `crack_spreads` (spread_type, value, timestamp) | 7 days | Indefinite | 90%+ after 30 days |

---

## 6. Deployment Architecture

Shows the Azure cloud deployment topology. Key thing to notice: the entire platform costs **$8-75/month** for a single pilot site using student credits and free tiers. The Windows LP Worker is the only component that cannot be containerized on Linux.



![Diagram 7](images/diagram_7.png)

<details>
<summary>View Mermaid source</summary>

```mermaid
graph TD
    subgraph SITE["Customer Refinery (per site)"]
        EDGE[Edge Agent<br/>Python Docker ~60MB<br/>+ SQLite Buffer]:::reflex
    end

    subgraph AZURE["Azure Cloud"]
        subgraph INGEST_LAYER["Ingestion"]
            IOTHUB[Azure IoT Hub<br/>Free: 8K msg/day]:::external
            FUNC[Azure Functions<br/>Free tier]:::external
        end

        subgraph COMPUTE["Compute (Azure Container Apps)"]
            API[FastAPI Monolith<br/>All 11 modules<br/>Free: 2M req/mo]:::reflex
            NEXTJS[Next.js 15 Frontend<br/>SSR + SSE]:::reflex
        end

        subgraph LPCOMPUTE["LP Compute (per 3-5 sites)"]
            WINVM[Windows VM — B2s<br/>Excel COM + safexl<br/>LP Worker via Celery]:::reflex
        end

        subgraph DATASTORES["Data Layer"]
            PGTS[(PostgreSQL 16<br/>+ TimescaleDB<br/>Free 12mo student)]:::datastore
            REDISCACHE[(Redis 7<br/>Cache + Broker<br/>+ Pub/Sub)]:::datastore
            BLOBSTORE[(Azure Blob Storage<br/>LP model files<br/>+ audit archives)]:::datastore
        end

        subgraph MESSAGING["Messaging & Delivery"]
            BOTSVC[Azure Bot Service<br/>Teams + Slack — Free]:::external
            ACSMAIL[Azure Communication<br/>Services — Email]:::external
        end

        subgraph SECURITY["Security & Monitoring"]
            KV[Azure Key Vault<br/>API keys + secrets]:::external
            DEFENDER[Microsoft Defender<br/>for IoT]:::critical
            MONITOR[Azure Monitor<br/>+ Log Analytics]:::external
        end
    end

    subgraph EXTERNAL_SVC["External Services (cloud-agnostic)"]
        CLAUDE[Claude API<br/>Anthropic Direct<br/>~$7-18/mo per site]:::ai
        GITHUB[GitHub Actions<br/>CI/CD — Free 2000 min/mo]:::external
        EIA[EIA Open Data API<br/>Free — daily prices]:::external
    end

    %% Flows
    EDGE -->|"HTTPS outbound<br/>sensor batches"| IOTHUB
    IOTHUB -->|"event stream"| FUNC
    FUNC -->|"writes to"| PGTS
    FUNC -->|"event to"| API
    API -->|"read/write"| PGTS
    API -->|"task broker +<br/>cache + pub/sub"| REDISCACHE
    API -->|"LP model storage"| BLOBSTORE
    REDISCACHE -->|"Celery task"| WINVM
    WINVM -->|"LP results"| REDISCACHE
    API <-->|"NL formatting"| CLAUDE
    API -->|"send messages"| BOTSVC
    API -->|"send email"| ACSMAIL
    API -->|"secrets"| KV
    NEXTJS -->|"SSE + REST"| API
    API -->|"market data"| EIA
    GITHUB -->|"deploy"| COMPUTE

    %% Styles
    classDef reflex fill:#2ecc71,stroke:#27ae60,color:#fff,stroke-width:2px
    classDef external fill:#3498db,stroke:#2980b9,color:#fff
    classDef datastore fill:#e67e22,stroke:#d35400,color:#fff
    classDef ai fill:#9b59b6,stroke:#8e44ad,color:#fff
    classDef critical fill:#e74c3c,stroke:#c0392b,color:#fff
```

</details>

**Scaling boundaries:**

| Component | Scaling Strategy |
|---|---|
| Edge Agent | 1 per refinery site (runs in customer DMZ) |
| FastAPI Monolith | Horizontal via Container Apps replicas (shared across sites) |
| Windows LP Worker | 1 VM per 3-5 sites (Excel COM is single-threaded per process) |
| PostgreSQL + TimescaleDB | Vertical scaling; ~140 MB/year per site with 90% compression |
| Redis | Single instance sufficient through 50+ sites |

---

## 7a. User Journey — LP Planner Configuring a New Site

Shows the onboarding wizard flow for an LP Planner setting up Reflex at a new refinery. This is the Phase 1 admin experience.



![Diagram 8](images/diagram_8.png)

<details>
<summary>View Mermaid source</summary>

```mermaid
flowchart TD
    START([LP Planner logs in]):::actor --> WIZARD[Site Onboarding Wizard]:::reflex

    WIZARD --> SITE_INFO[Step 1: Site Information<br/>Name, region, capacity BPD,<br/>timezone, shift schedule]:::reflex
    SITE_INFO --> PI_CONNECT[Step 2: PI Web API Connection<br/>URL, credentials, test connection]:::reflex

    PI_CONNECT --> TAG_SELECT[Step 3: Select PI Tags<br/>Browse available tags,<br/>select top 100-150 to monitor]:::reflex

    TAG_SELECT --> QUALITY[Step 4: Data Quality Rules<br/>Set range limits, staleness<br/>thresholds per tag]:::reflex

    QUALITY --> LP_CONFIG[Step 5: LP Model Upload<br/>Upload Excel model,<br/>map input/output cells]:::reflex

    LP_CONFIG --> TRIGGER_CONFIG[Step 6: Trigger Configuration<br/>Set process drift % thresholds,<br/>price movement % thresholds]:::reflex

    TRIGGER_CONFIG --> CHANNEL[Step 7: Delivery Channels<br/>Configure Teams channels,<br/>Slack workspaces, email lists]:::reflex

    CHANNEL --> USERS[Step 8: User Setup<br/>Invite supervisors, engineers,<br/>assign roles]:::reflex

    USERS --> REVIEW{Review Configuration}:::reflex
    REVIEW -->|"Looks good"| SHADOW[Deploy in Shadow Mode<br/>2-4 weeks observation]:::reflex
    REVIEW -->|"Needs changes"| WIZARD

    SHADOW --> METRICS{Shadow Mode Metrics<br/>>20 recs AND >75% accuracy<br/>AND <10% false positives?}:::reflex
    METRICS -->|"Criteria met"| GOLIVE[Transition to Active Mode<br/>+ MOC documentation filed]:::reflex
    METRICS -->|"Not yet"| TUNE[Tune thresholds &<br/>quality rules]:::reflex
    TUNE --> SHADOW

    GOLIVE --> DONE([Site is Live]):::actor

    %% Styles
    classDef reflex fill:#2ecc71,stroke:#27ae60,color:#fff
    classDef actor fill:#95a5a6,stroke:#7f8c8d,color:#fff
```

</details>

---

## 7b. User Journey — Shift Supervisor Responding to Recommendation

Shows the 5-tap structured constraint input flow. Key thing to notice: the entire interaction takes **15-30 seconds** and is fully **glove-compatible** (64px+ tap targets).



![Diagram 9](images/diagram_9.png)

<details>
<summary>View Mermaid source</summary>

```mermaid
flowchart TD
    NOTIF([Notification arrives<br/>in Teams / Slack]):::actor

    NOTIF --> CARD[Recommendation Card<br/>"Increase naphtha yield +8%<br/>on Units 3 & 4 — +$44K/day"]:::reflex

    CARD --> DECIDE{Supervisor Decision<br/>30-second review}:::reflex

    DECIDE -->|"Tap: Acknowledge"| ACK[Recommendation Accepted<br/>Logged to audit trail]:::reflex
    ACK --> DONE1([Done — margin captured]):::actor

    DECIDE -->|"Tap: Dismiss"| DISMISS[Recommendation Dismissed<br/>Logged by equipment,<br/>not by operator]:::reflex
    DISMISS --> DONE2([Done — noted, no action]):::actor

    DECIDE -->|"Tap: Add Constraint"| WIZARD[5-Tap Constraint Wizard Opens]:::reflex

    WIZARD --> TAP1[Tap 1: Select Unit<br/>Unit 2 / Unit 3 / Unit 4 / ...]:::reflex
    TAP1 --> TAP2[Tap 2: Constraint Type<br/>Equipment Limit / Feed Quality /<br/>Maintenance / Safety / Other]:::reflex
    TAP2 --> TAP3[Tap 3: Specific Constraint<br/>Fouling / Leak / Capacity /<br/>Temperature Limit / ...]:::reflex
    TAP3 --> TAP4[Tap 4: Severity<br/>Cap at 50% / 75% / 90% /<br/>Shut Down Unit]:::reflex
    TAP4 --> TAP5{Tap 5: Confirm<br/>Review summary}:::reflex

    TAP5 -->|"Confirm"| REGISTERED[Constraint Registered<br/>by equipment — 72h default expiry]:::reflex
    TAP5 -->|"Edit"| TAP1

    REGISTERED --> RESOLVE[LP re-solves with<br/>new constraint bound]:::reflex
    RESOLVE --> REVISED[Revised Recommendation<br/>"With Unit 2 capped:<br/>+$11,200/day on Unit 6"]:::reflex
    REVISED --> DONE3([Done — alternative provided]):::actor

    %% Styles
    classDef reflex fill:#2ecc71,stroke:#27ae60,color:#fff
    classDef actor fill:#95a5a6,stroke:#7f8c8d,color:#fff
```

</details>

---

## 7c. User Journey — Manager Reviewing Dashboard

Shows the management analytics experience. Key thing to notice: all financial data uses **gain framing** ("$1.2M captured") and tracks by **equipment**, never by individual operator.



![Diagram 10](images/diagram_10.png)

<details>
<summary>View Mermaid source</summary>

```mermaid
flowchart TD
    LOGIN([Manager logs in<br/>to web dashboard]):::actor

    LOGIN --> LANDING[Analytics Dashboard<br/>Role: Management View]:::reflex

    LANDING --> OPP[Opportunity Cost Waterfall<br/>"$1.2M captured — 82% capture rate"<br/>Grouped by processing unit]:::reflex
    LANDING --> DRIFT[Coefficient Drift Timeline<br/>30/90-day view<br/>Flags when predicted != actual yields]:::reflex
    LANDING --> SENSOR[Sensor Health Matrix<br/>Heatmap by unit<br/>Click for substitution history]:::reflex
    LANDING --> PATTERNS[Constraint Pattern Analysis<br/>"HX-201 invoked 11 times in 60 days<br/>— recommend permanent model update"]:::reflex

    OPP --> DRILLDOWN{Drill into unit?}:::reflex
    DRILLDOWN -->|"Yes"| UNIT_DETAIL[Unit-Level Detail<br/>Value captured per recommendation<br/>Equipment constraints active<br/>Never shows individual operator data]:::reflex
    DRILLDOWN -->|"No"| EXPORT[Export Report<br/>PDF / CSV for capital planning]:::reflex

    DRIFT --> DRIFT_DETAIL{Coefficient flagged?}:::reflex
    DRIFT_DETAIL -->|"Yes"| FLAG[Alert LP Planner<br/>"Update naphtha yield coefficient<br/>from 8% to 4.2% for Unit 2"]:::reflex
    DRIFT_DETAIL -->|"No"| OK([Coefficients healthy]):::actor

    SENSOR --> SENSOR_CLICK{Broken sensor?}:::reflex
    SENSOR_CLICK -->|"Yes"| MAINT[Maintenance Priority List<br/>"Fix TI-201 — causing $12K/week<br/>in sub-optimal recommendations"]:::reflex
    SENSOR_CLICK -->|"No"| HEALTHY([Sensors healthy]):::actor

    PATTERNS --> PATTERN_ACT{Recurring constraint?}:::reflex
    PATTERN_ACT -->|"Yes — make permanent"| PERMANENT[Add as Permanent Constraint<br/>in LP Model]:::reflex
    PATTERN_ACT -->|"No — seasonal only"| SEASONAL[Mark as Seasonal<br/>Auto-activate next year]:::reflex

    %% Styles
    classDef reflex fill:#2ecc71,stroke:#27ae60,color:#fff
    classDef actor fill:#95a5a6,stroke:#7f8c8d,color:#fff
```

</details>

---

## 8. Implementation Phasing (Gantt Chart)

Shows the three implementation phases from the engineering spec. Key thing to notice: Phase 0 is a **go/no-go validation** gate — if the LP tool survey or domain expert recruitment fails, the project pauses before any production code is written.



![Diagram 11](images/diagram_11.png)

<details>
<summary>View Mermaid source</summary>

```mermaid
gantt
    title Reflex Implementation Roadmap
    dateFormat YYYY-MM-DD
    axisFormat %b %Y

    section Phase 0 — Validation
    LP tool landscape survey (10-15 refineries)       :p0a, 2026-04-01, 4w
    Excel COM 72-hour stress test                     :p0b, 2026-04-15, 3w
    Recruit domain expert (non-negotiable)            :crit, p0c, 2026-04-01, 8w
    Go / No-Go decision                              :milestone, p0m, after p0c, 0d

    section Phase 1 — MVP (Single Pilot Site)
    Edge Agent + PI Web API reader                    :p1a, 2026-06-01, 2w
    Cloud backend scaffold + TimescaleDB schema       :p1b, 2026-06-15, 2w
    Data Quality Gateway                              :p1c, after p1b, 1w
    Trigger Engine + operating mode state machine     :p1d, after p1c, 2w
    LP Orchestrator + Windows LP Worker               :p1e, after p1d, 2w
    AI Translation + Claude integration               :p1f, after p1e, 2w
    Messaging: Teams + Slack + email fallback         :p1g, after p1f, 2w
    Frontend: Operations dashboard + shadow mode      :p1h, after p1g, 2w
    Constraint Registry + shift handover              :p1i, after p1h, 2w
    Auth, RBAC, audit trail, admin dashboard          :p1j, after p1i, 2w
    Integration testing + shadow mode deploy          :crit, p1k, after p1j, 2w
    Shadow mode at design partner                     :milestone, p1m, after p1k, 0d

    section Phase 2 — Beta (3-5 Sites)
    Transition to active mode at design partner       :p2a, 2027-01-01, 3w
    Analytics dashboard (opportunity cost, drift)     :p2b, after p2a, 6w
    Coefficient reconciliation engine                 :p2c, after p2a, 4w
    Constraint pattern detection                      :p2d, after p2c, 3w
    Sensor substitution management                    :p2e, after p2d, 3w
    Onboard 2-4 additional pilot customers            :p2f, 2027-01-01, 24w
    Publish case study with quantified ROI            :p2g, after p2e, 2w
    Begin SOC 2 Type II preparation                   :p2h, 2027-03-01, 16w
    Measurable margin improvement proven              :milestone, p2m, 2027-06-15, 0d

    section Phase 3 — GA (Production-Ready)
    Standardized onboarding + MOC package             :p3a, 2027-07-01, 6w
    Multi-site management + fleet dashboards          :p3b, after p3a, 8w
    LP migration service (Excel to PuLP/HiGHS)        :p3c, after p3a, 10w
    Evaluate Azure IoT Edge migration                 :p3d, after p3b, 4w
    SOC 2 Type II certification                       :crit, p3e, 2027-07-01, 24w
    Tablet offline support (service worker)           :p3f, after p3b, 4w
    Hire customer success engineer                    :p3g, 2027-09-01, 4w
    Explore adjacent verticals                        :p3h, 2028-01-01, 12w
    8-12 paying customers, repeatable sales           :milestone, p3m, 2028-04-01, 0d
```

</details>

**Key milestones:**

| Milestone | Target Date | Success Criteria |
|---|---|---|
| Phase 0 Go/No-Go | Week 8 | LP tool survey complete, domain expert recruited, Excel COM validated |
| Phase 1 Shadow Deploy | Month 8 | Working system at 1 design partner in shadow mode |
| Phase 2 ROI Proven | Month 14 | $500K+ annual margin improvement demonstrated at a real site |
| Phase 3 GA | Month 24 | 8-12 paying customers, $600K-$1.5M ARR, repeatable sales process |

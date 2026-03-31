# Reflex Backend Architecture Specification

> **Date:** 2026-03-27
> **Author:** Backend Architecture Agent (Run 2C)
> **Inputs:** Product transcript, Risk Matrix (R1-R20), Executive Summary
> **Scope:** Service architecture, API contracts, tech stack, deployment model

---

## 1. Architecture Decision: Modular Monolith

### The Decision

Reflex will be built as a **modular monolith** for Phases 1-3 (1-5 customers), with explicit module boundaries designed to allow extraction into services later if needed.

### Why Not Microservices

| Factor | Microservices | Modular Monolith | Winner |
|--------|--------------|-------------------|--------|
| Team size (3-5 students) | Requires DevOps expertise for service mesh, distributed tracing, independent deployments | Single deployment, single repo, shared database | Monolith |
| Number of customers (1-3) | Over-engineered for scale that does not exist | Right-sized for early stage | Monolith |
| Operational overhead | N services x (logging + monitoring + deployment + versioning) | One service, one deployment pipeline | Monolith |
| Debugging distributed failures | Distributed tracing, correlation IDs, network partitions | Stack traces, local debugging, single process | Monolith |
| Data consistency | Saga patterns, eventual consistency, compensating transactions | ACID transactions across modules | Monolith |
| Cost | N containers, service discovery, API gateway | One container, one database | Monolith |
| Latency | Network hops between services | In-process function calls | Monolith |
| Future extraction | N/A | Clean module boundaries allow extraction when needed | Monolith |

The only argument for microservices is the **LP Orchestrator** (Windows-only COM automation), which inherently runs on a separate machine. This is handled as a single external worker, not a full microservices architecture.

### Module Boundary Rules

To keep the monolith extractable:
1. Modules communicate through **defined Python interfaces** (abstract base classes), never by reaching into another module's internals
2. Each module owns its database tables -- no cross-module direct table access
3. Async communication uses an **internal event bus** (in-process for now, replaceable with Redis pub/sub or a real message broker later)
4. Each module has its own directory with `api/`, `services/`, `models/`, `events/`

### When to Extract

Extract a module into a service when:
- It needs to scale independently (e.g., LP Orchestrator at 10+ concurrent solves)
- It needs a different runtime (LP Orchestrator already runs on Windows)
- It has fundamentally different availability requirements
- The team has grown large enough that independent deployment reduces coordination cost

At 1-5 customers, none of these apply except the LP Orchestrator.

---

## 2. Service/Module Boundaries

### Architecture Overview

```
                    REFINERY DMZ                          CLOUD
                 +-----------------+          +----------------------------------+
                 |                 |          |                                  |
                 |  Edge Agent     |--HTTPS-->|  Cloud API (FastAPI)             |
                 |  (Python)       |          |                                  |
                 |  - PI Web API   |          |  +----------------------------+  |
                 |    reader       |          |  | Data Ingestion Module      |  |
                 |  - Data buffer  |          |  +----------------------------+  |
                 |  - Heartbeat    |          |  | Data Quality Gateway       |  |
                 |                 |          |  +----------------------------+  |
                 +-----------------+          |  | Trigger Engine             |  |
                                             |  +----------------------------+  |
                 +-----------------+          |  | LP Orchestrator (queue)    |--+--> Windows LP Worker
                 |  Market Data    |--HTTPS-->|  +----------------------------+  |    (separate machine)
                 |  (customer      |          |  | AI Translation Service     |  |
                 |   push or       |          |  +----------------------------+  |
                 |   scheduled     |          |  | Messaging Service          |  |
                 |   pull)         |          |  +----------------------------+  |
                 +-----------------+          |  | Feedback Processor         |  |
                                             |  +----------------------------+  |
                                             |  | Constraint Registry         |  |
                                             |  +----------------------------+  |
                                             |  | Reconciliation Engine       |  |
                                             |  +----------------------------+  |
                                             |  | Dashboard API               |  |
                                             |  +----------------------------+  |
                                             |  | Auth & Admin                |  |
                                             |  +----------------------------+  |
                                             |                                  |
                                             |  PostgreSQL + TimescaleDB        |
                                             |  Redis (cache + task broker)     |
                                             |  Celery Workers                  |
                                             +----------------------------------+
```

### Module Definitions

#### 2.1 Data Ingestion Module

**Responsibility:** Receive sensor data from Edge Agents and market data from external sources. Normalize, timestamp, and store raw readings. Never interpret data -- just receive and persist.

**Owns tables:** `sensor_readings` (hypertable), `market_prices` (hypertable), `edge_agents`, `data_sources`

**Interfaces:**
- `POST /api/v1/ingest/sensors` -- Edge Agent pushes batched sensor readings
- `POST /api/v1/ingest/market-prices` -- Market data push endpoint
- Emits event: `SensorDataReceived`, `MarketPriceReceived`

**Key design:**
- Edge Agents authenticate via API key (unique per agent, rotatable)
- Accepts batched payloads (up to 1000 readings per request) to reduce HTTP overhead
- Idempotent ingestion -- deduplicates by (site_id, tag_id, timestamp)
- Writes directly to TimescaleDB hypertable for time-series data
- Stores raw values before any quality processing

```python
# POST /api/v1/ingest/sensors
# Headers: X-API-Key: <edge-agent-api-key>
{
    "site_id": "refinery-001",
    "agent_id": "edge-agent-001",
    "batch_id": "uuid-v4",
    "readings": [
        {
            "tag_id": "TI-3401",
            "value": 342.7,
            "unit": "degF",
            "timestamp": "2026-03-27T14:30:00.000Z",
            "quality": "good"
        },
        {
            "tag_id": "FI-2201",
            "value": 12450.0,
            "unit": "bpd",
            "timestamp": "2026-03-27T14:30:00.000Z",
            "quality": "good"
        }
    ]
}

# Response: 202 Accepted
{
    "batch_id": "uuid-v4",
    "accepted": 2,
    "duplicates": 0,
    "rejected": 0
}
```

---

#### 2.2 Data Quality Gateway

**Responsibility:** Validate all incoming sensor and market data before it reaches any downstream module. Detect staleness, out-of-range values, digital states, compression artifacts, and operating mode. Tag every reading with a quality score.

**Owns tables:** `quality_rules`, `quality_events`, `sensor_substitutions`, `operating_modes`

**Interfaces:**
- Listens to events: `SensorDataReceived`, `MarketPriceReceived`
- Emits events: `ValidatedDataReady`, `SensorHealthAlert`, `OperatingModeChanged`
- `GET /api/v1/quality/sensor-health/{site_id}` -- sensor health dashboard data
- `POST /api/v1/quality/substitutions` -- register a sensor substitution
- `PUT /api/v1/quality/operating-mode/{site_id}` -- manually set operating mode

**Quality checks (executed in order):**

| Check | Description | Action on Failure |
|-------|-------------|-------------------|
| Digital state | Value is not a PI digital state (e.g., "Shutdown", "I/O Timeout") | Mark as bad, do not propagate |
| Staleness | No new reading in >5x expected interval | Mark as stale, check for substitution |
| Range check | Value outside configured min/max for this tag | Mark as suspect, log alert |
| Rate of change | Value changed faster than physically possible | Mark as spike, apply median filter |
| Cross-signal | Redundant sensors disagree beyond threshold | Mark lower-confidence sensor |
| Operating mode | Detect Normal/Startup/Shutdown/Upset/Turnaround/Emergency | Set site operating mode, suppress triggers if non-Normal |

**Operating mode detection (addresses R9 -- alert fatigue):**

```python
# Operating mode state machine
class OperatingMode(str, Enum):
    NORMAL = "normal"
    STARTUP = "startup"
    SHUTDOWN = "shutdown"
    UPSET = "upset"
    TURNAROUND = "turnaround"
    EMERGENCY = "emergency"

# Mode transitions detected by:
# 1. Manual operator/supervisor override (always respected)
# 2. Automatic detection based on:
#    - Number of sensors changing simultaneously (>30% = likely mode change)
#    - Key unit status tags (compressor running, furnace firing, etc.)
#    - Rate of throughput change (rapid decrease = shutdown signature)
# 3. Scheduled turnaround windows from constraint registry
```

**Sensor substitution (from product transcript):**
```python
# POST /api/v1/quality/substitutions
{
    "site_id": "refinery-001",
    "failed_tag_id": "TI-3401",
    "substitute_tag_id": "TI-3402",
    "reason": "TI-3401 reading erratically since 2026-03-25",
    "created_by": "operator-jane",
    "expires_at": "2026-04-10T00:00:00Z"  # auto-expire after turnaround
}
```

---

#### 2.3 Trigger Engine

**Responsibility:** Watch validated data streams for meaningful process drift and price movements. Fire optimization triggers only during Normal operating mode. Enforce cooldown/debounce to prevent trigger storms.

**Owns tables:** `trigger_configs`, `trigger_events`, `trigger_cooldowns`

**Interfaces:**
- Listens to events: `ValidatedDataReady`, `OperatingModeChanged`
- Emits events: `OptimizationTriggered`
- `GET /api/v1/triggers/{site_id}` -- list trigger configs
- `PUT /api/v1/triggers/{site_id}/{trigger_id}` -- update trigger thresholds
- `GET /api/v1/triggers/{site_id}/history` -- trigger event history

**Trigger types:**

1. **Process drift trigger**: A monitored tag deviates from its baseline by more than a configured threshold
   - Baseline: rolling 4-hour average (configurable)
   - Threshold: percentage of normal range (e.g., 5% of operating range)
   - Must persist for minimum duration (e.g., 10 minutes) to avoid transient spikes

2. **Price movement trigger**: Crack spread or key price index moves by more than a configured percentage
   - Threshold: percentage of trailing 20-day average (addresses R9 -- volatility-adjusted, not fixed dollar amount)
   - Example: 10% of trailing average spread, not a fixed $2/bbl

3. **Scheduled trigger**: Time-based re-solve (e.g., beginning of each shift)

**Debounce and cooldown:**
```python
class TriggerConfig:
    min_interval_minutes: int = 60      # no re-trigger within 60 min
    max_triggers_per_shift: int = 3     # hard cap per 12-hour shift
    coalesce_window_minutes: int = 5    # batch triggers within 5 min into one solve
    mode_gate: list[OperatingMode] = [OperatingMode.NORMAL]  # only fire in Normal mode
```

**Key behavior:**
- When operating mode is not NORMAL, all optimization triggers are suppressed (logged but not fired)
- When LP Orchestrator reports backpressure (solve queue full), triggers are coalesced -- the most recent data wins
- Target: 1-2 recommendations per shift during normal operations

```python
# OptimizationTriggered event
{
    "event_id": "uuid-v4",
    "site_id": "refinery-001",
    "trigger_type": "price_movement",
    "trigger_reason": "Gasoline crack spread widened 12.3% (from $18.40 to $20.66) over trailing 20-day average",
    "triggered_tags": ["CRACK_GASOLINE", "CRACK_DIESEL"],
    "current_values": {"CRACK_GASOLINE": 20.66, "CRACK_DIESEL": 15.82},
    "baseline_values": {"CRACK_GASOLINE": 18.40, "CRACK_DIESEL": 15.10},
    "timestamp": "2026-03-27T14:35:00Z",
    "priority": "medium"
}
```

---

#### 2.4 LP Orchestrator

**Responsibility:** Queue optimization solve requests, dispatch them to Windows LP Workers, enforce timeouts and backpressure, extract results. This is the one module that communicates with an external process (the Windows machine running Excel COM automation).

**Owns tables:** `solve_requests`, `solve_results`, `lp_model_configs`

**Interfaces:**
- Listens to events: `OptimizationTriggered`, `ConstraintUpdated` (for re-solves)
- Emits events: `SolveCompleted`, `SolveFailed`
- `GET /api/v1/lp/solves/{site_id}` -- solve history
- `GET /api/v1/lp/solves/{solve_id}` -- specific solve result
- `POST /api/v1/lp/solves/{site_id}/manual` -- manual solve trigger (for LP planners)

**Architecture (addresses R1 -- Excel COM automation risk):**

The LP Orchestrator does NOT run Excel. It manages a queue of solve requests and dispatches them to a **Windows LP Worker** process that runs on a separate Windows machine (VM or physical). Communication between the orchestrator and the worker is via Celery task queue (Redis as broker).

```
Cloud (Linux)                           Windows VM
+---------------------+                +------------------------+
| LP Orchestrator     |                | LP Worker              |
|                     |    Celery      |                        |
| - Queues solves     |----tasks------>| - Excel COM automation |
| - Enforces timeouts |                | - pywin32 DispatchEx   |
| - Extracts results  |<---results-----| - Watchdog process     |
| - Backpressure      |                | - Zombie cleanup       |
+---------------------+                +------------------------+
```

**LP Worker design (directly addresses R1 risk mitigations):**

```python
# LP Worker runs on Windows, managed by Celery
class LPWorkerConfig:
    max_solve_time_seconds: int = 300       # 5 minute hard timeout
    watchdog_interval_seconds: int = 30     # check for hung Excel every 30s
    max_consecutive_failures: int = 3       # after 3 failures, restart Excel
    excel_display_alerts: bool = False      # suppress all modal dialogs
    excel_visible: bool = False             # headless operation
    zombie_check_interval: int = 60         # check for orphan EXCEL.EXE processes

# Solve request dispatched via Celery
@celery_app.task(bind=True, max_retries=2, soft_time_limit=280, time_limit=300)
def execute_lp_solve(self, solve_request: dict) -> dict:
    """
    1. Open Excel workbook via COM (DispatchEx for isolated instance)
    2. Write input values to configured cells
    3. Trigger Solver (or VBA macro)
    4. Wait for completion with timeout
    5. Read output values from configured cells
    6. Close workbook, release COM objects
    7. Return structured result
    """
    pass
```

**LP model configuration (per site):**
```python
# POST /api/v1/lp/models/{site_id}
{
    "site_id": "refinery-001",
    "model_name": "CDU_Optimization_v4.2",
    "file_path": "C:\\Models\\CDU_Opt_v4.2.xlsm",
    "solve_method": "solver",  # "solver" | "vba_macro" | "manual_recalc"
    "vba_macro_name": null,
    "input_mappings": [
        {"tag_id": "CRUDE_PRICE_WTI", "cell": "Inputs!B3", "type": "float"},
        {"tag_id": "CRACK_GASOLINE", "cell": "Inputs!B4", "type": "float"},
        {"tag_id": "FI-2201", "cell": "Inputs!B10", "type": "float"},
        {"tag_id": "TI-3401", "cell": "Inputs!B15", "type": "float"}
    ],
    "output_mappings": [
        {"name": "optimal_naphtha_yield", "cell": "Results!C5", "type": "float", "unit": "%"},
        {"name": "optimal_diesel_yield", "cell": "Results!C6", "type": "float", "unit": "%"},
        {"name": "total_margin_improvement", "cell": "Results!C20", "type": "float", "unit": "$/day"},
        {"name": "recommended_throughput", "cell": "Results!C8", "type": "float", "unit": "bpd"}
    ],
    "solve_trigger_cell": null,  # for models that use a "Run" button cell
    "timeout_seconds": 180
}
```

**Backpressure handling:**
- If a solve is already in progress for a site, new triggers are queued (not dropped)
- If queue depth exceeds 3 for a site, coalesce: drop intermediate requests, keep only the most recent
- If the LP Worker is down, solves are queued in Redis and processed when the worker recovers
- Dead letter queue for permanently failed solves (manual review)

---

#### 2.5 AI Translation Service

**Responsibility:** Translate raw LP solve results into plain-English recommendations. Programmatically extract all numbers from LP output (never let the LLM generate numbers). Use Claude for natural language context and framing only. Provide deterministic template fallback.

**Owns tables:** `recommendations`, `prompt_templates`, `translation_cache`

**Interfaces:**
- Listens to events: `SolveCompleted`
- Emits events: `RecommendationReady`
- `GET /api/v1/recommendations/{site_id}` -- recommendation history
- `GET /api/v1/recommendations/{recommendation_id}` -- specific recommendation

**Architecture (addresses R5 -- LLM hallucination risk):**

```
SolveCompleted event
       |
       v
+---------------------------+
| 1. Deterministic Number   |  Programmatic extraction from LP output
|    Extraction             |  No LLM involved. Pure code.
+---------------------------+
       |
       v
+---------------------------+
| 2. Delta Calculation      |  Compare current solve vs previous solve
|                           |  Calculate: what changed, by how much, $ impact
+---------------------------+
       |
       v
+---------------------------+
| 3. Template Selection     |  Choose prompt template based on trigger type
|                           |  and recommendation category
+---------------------------+
       |
       v
+---------------------------+
| 4. Claude API Call        |  Send: extracted numbers + context + template
|    (or template fallback) |  Receive: natural language recommendation
+---------------------------+
       |
       v
+---------------------------+
| 5. Number Cross-Validation|  Verify every number in Claude output matches
|                           |  the deterministically extracted values.
|                           |  Verify direction (increase/decrease).
|                           |  If mismatch: use template fallback instead.
+---------------------------+
       |
       v
+---------------------------+
| 6. Audience Framing       |  Operator view: recommendation + action items
|    (addresses R8)         |  Management view: financial summary
+---------------------------+
       |
       v
RecommendationReady event
```

**Deterministic number extraction (step 1-2):**
```python
class LPDelta:
    """Calculated programmatically, never by LLM."""
    trigger_type: str                    # "price_movement" | "process_drift"
    trigger_summary: str                 # "Gasoline crack spread widened 12.3%"
    changes: list[OutputChange]          # what the LP recommends changing
    total_margin_delta_per_day: float    # total $ impact
    confidence: str                      # "high" | "medium" | "low"

class OutputChange:
    parameter_name: str       # "Naphtha yield on Unit 3"
    current_value: float      # 22.0
    recommended_value: float  # 23.8
    delta: float              # +1.8
    unit: str                 # "%"
    margin_impact: float      # +44000.0 ($/day)
```

**Claude prompt template (step 3-4):**
```python
RECOMMENDATION_PROMPT = """
You are a process engineering communication assistant for an oil refinery.
Your job is to write a clear, concise recommendation for a shift supervisor.

RULES:
- Use ONLY the numbers provided below. Do not calculate, estimate, or round any numbers.
- Every number you write must appear exactly as given in the data below.
- Focus on WHAT changed, WHY it matters, and WHAT action to take.
- Keep it under 150 words.
- Use plain English, no jargon beyond standard refinery terms.
- Frame the financial impact as opportunity to capture, not loss to avoid.

TRIGGER: {trigger_summary}

RECOMMENDED CHANGES:
{formatted_changes}

TOTAL MARGIN OPPORTUNITY: ${margin_delta_per_day}/day (${margin_delta_per_day * 30}/month)

ACTIVE CONSTRAINTS FROM REGISTRY:
{active_constraints}

Write the recommendation now.
"""
```

**Template fallback (when Claude is unavailable or validation fails):**
```python
TEMPLATE_FALLBACK = """
**Optimization Opportunity Detected**

Trigger: {trigger_summary}

Recommended actions:
{for_each_change}
- Adjust {parameter_name} from {current_value}{unit} to {recommended_value}{unit} ({delta:+}{unit})
  Estimated impact: ${margin_impact:,.0f}/day
{end_for}

Total margin opportunity: ${total_margin_delta:,.0f}/day

Active constraints considered: {constraint_count}
"""
```

**Number cross-validation (step 5):**
```python
def validate_recommendation(claude_output: str, lp_delta: LPDelta) -> bool:
    """
    Extract all numbers from Claude's output.
    Verify each matches a number in lp_delta.
    Verify direction words (increase/decrease/raise/lower) match sign of delta.
    Return False if any mismatch found.
    """
    # Uses regex to find all numbers in Claude output
    # Compares against known-good values from lp_delta
    # Rejects if any number is fabricated or direction is wrong
    pass
```

**Caching:**
- Cache Claude API responses keyed by (prompt_template_version, trigger_type, rounded_delta_bucket)
- Similar triggers within the same shift can reuse translations with updated numbers injected
- Cache TTL: 4 hours (shift duration)

**Cost projection:**
- Claude API (Sonnet): ~$0.003 per 1K input tokens, ~$0.015 per 1K output tokens
- Average recommendation: ~800 input tokens, ~200 output tokens = ~$0.005 per recommendation
- At 2-4 recommendations/day per site: ~$0.30-$0.60/site/month
- At 50 sites: ~$15-$30/month total -- negligible

---

#### 2.6 Messaging Service

**Responsibility:** Deliver recommendations to operators/supervisors via Slack, Teams, and email. Handle structured feedback input (5-tap UI). Route responses back to Feedback Processor.

**Owns tables:** `message_deliveries`, `messaging_configs`, `channel_mappings`

**Interfaces:**
- Listens to events: `RecommendationReady`
- Emits events: `OperatorResponseReceived`
- `POST /api/v1/messaging/webhooks/slack` -- Slack interaction webhook
- `POST /api/v1/messaging/webhooks/teams` -- Teams interaction webhook
- `GET /api/v1/messaging/configs/{site_id}` -- messaging configuration

**Delivery channels (addresses R2 -- operator delivery channel):**

| Channel | Primary Audience | Latency | Reliability |
|---------|-----------------|---------|-------------|
| Slack | Process engineers, LP planners | Real-time | High (if installed) |
| Teams | Shift supervisors (enterprises) | Real-time | Medium (IT approval needed) |
| Email | Universal fallback, management summaries | Minutes | High |
| Dashboard push | Control room display | Real-time (WebSocket) | High |

**Structured constraint input (addresses R2, R5 -- replaces free-text):**

Slack Block Kit / Teams Adaptive Card with structured 5-tap interface:

```json
{
    "blocks": [
        {
            "type": "section",
            "text": "Crack spreads widened 12.3%. Model recommends increasing naphtha yield by 1.8% on Unit 3. Estimated opportunity: $44,000/day."
        },
        {
            "type": "actions",
            "elements": [
                {"type": "button", "text": "Accept", "value": "accept", "style": "primary"},
                {"type": "button", "text": "Accept Modified", "value": "accept_modified"},
                {"type": "button", "text": "Defer", "value": "defer"},
                {"type": "button", "text": "Cannot - Equipment", "value": "reject_equipment"},
                {"type": "button", "text": "Cannot - Other", "value": "reject_other"}
            ]
        }
    ]
}
```

When "Cannot - Equipment" is tapped, a follow-up structured form appears:
```
Select unit:        [Unit 2 v]     (dropdown, 1 tap)
Constraint type:    [Capacity limit v]  (dropdown, 1 tap)
Severity:           [50%] [75%] [90%] [Custom]  (buttons, 1 tap)
Duration:           [This shift] [24h] [Until cleared]  (buttons, 1 tap)
Optional note:      [________________]  (free text, optional)
```

Total: 4-5 taps to register a constraint. No free text required. Glove-compatible.

**Audience separation (addresses R8 -- blame culture):**

| Audience | Content | Framing |
|----------|---------|---------|
| Operators/Supervisors | Recommendation + action items + feedback buttons | "Opportunity to capture $X" |
| LP Planners | Full LP delta details + constraint context | Technical detail |
| Management | Daily/weekly financial summary by unit | "Value captured: $X (Y% capture rate)" |

Management never sees individual operator response data. Override tracking is by equipment/unit only.

---

#### 2.7 Feedback Processor

**Responsibility:** Process structured operator responses from the Messaging Service. For "Accept Modified" and equipment constraints, create or update entries in the Constraint Registry. For quantifiable constraints, trigger an LP re-solve.

**Owns tables:** `feedback_events` (audit trail of all responses)

**Interfaces:**
- Listens to events: `OperatorResponseReceived`
- Emits events: `ConstraintCreated`, `ConstraintUpdated`, `ResolvRequested`
- `GET /api/v1/feedback/{site_id}` -- feedback history

**Response processing logic:**

```python
def process_response(response: OperatorResponse):
    # Always log to feedback_events (audit trail)
    log_feedback_event(response)

    if response.action == "accept":
        # Log acceptance, update recommendation status
        mark_recommendation_accepted(response.recommendation_id)

    elif response.action == "accept_modified":
        # Operator accepted with modifications
        # Create temporary constraint from modifications
        create_constraint_from_modifications(response)
        request_resolve(response.site_id, reason="operator_modified")

    elif response.action in ("reject_equipment", "reject_other"):
        # Create constraint in registry from structured input
        constraint = create_constraint_from_structured_input(
            site_id=response.site_id,
            unit_id=response.selected_unit,
            constraint_type=response.selected_constraint_type,
            severity=response.selected_severity,
            duration=response.selected_duration,
            note=response.optional_note,
            created_by=response.operator_id
        )
        # Trigger re-solve with new constraint applied
        request_resolve(response.site_id, reason="new_constraint", constraint_id=constraint.id)

    elif response.action == "defer":
        # Log deferral, no constraint created, no re-solve
        mark_recommendation_deferred(response.recommendation_id)
```

**No NLP constraint extraction.** The structured input form (unit + type + severity + duration) provides all the information needed to create a mathematical constraint without any natural language processing. This eliminates the 15-54% NLP error rate identified in R5.

---

#### 2.8 Constraint Registry

**Responsibility:** Maintain the authoritative set of active constraints per site. Constraints are equipment-level bounds that modify LP model inputs. Constraints have expiry, audit trails, and version history. The LP Orchestrator reads active constraints before every solve.

**Owns tables:** `constraints`, `constraint_history`, `constraint_patterns`

**Interfaces:**
- Listens to events: `ConstraintCreated`, `ConstraintUpdated`
- Emits events: `ConstraintExpired`, `ConstraintPatternDetected`
- `GET /api/v1/constraints/{site_id}` -- active constraints
- `GET /api/v1/constraints/{site_id}/history` -- full constraint history
- `POST /api/v1/constraints/{site_id}` -- manually create constraint
- `DELETE /api/v1/constraints/{constraint_id}` -- clear/expire a constraint
- `GET /api/v1/constraints/{site_id}/patterns` -- detected patterns

**Constraint data model:**
```python
class Constraint(BaseModel):
    id: UUID
    site_id: str
    unit_id: str                          # e.g., "UNIT-3", "HX-201"
    constraint_type: ConstraintType       # capacity_limit, throughput_cap, yield_bound, temperature_limit, etc.
    parameter: str                        # LP model parameter affected
    bound_type: str                       # "upper" | "lower" | "fixed"
    bound_value: float                    # the numerical bound
    unit: str                             # engineering unit
    reason: str                           # structured reason from dropdown
    note: Optional[str]                   # optional free-text note
    created_by: str                       # operator/supervisor ID
    created_at: datetime
    expires_at: Optional[datetime]        # null = until manually cleared
    expiry_type: str                      # "end_of_shift" | "24h" | "until_cleared" | "custom"
    status: str                           # "active" | "expired" | "cleared" | "superseded"
    cleared_by: Optional[str]
    cleared_at: Optional[datetime]
    version: int                          # incremented on updates

class ConstraintType(str, Enum):
    CAPACITY_LIMIT = "capacity_limit"
    THROUGHPUT_CAP = "throughput_cap"
    YIELD_BOUND = "yield_bound"
    TEMPERATURE_LIMIT = "temperature_limit"
    PRESSURE_LIMIT = "pressure_limit"
    FEED_QUALITY = "feed_quality"
    EQUIPMENT_OFFLINE = "equipment_offline"
    MAINTENANCE_WINDOW = "maintenance_window"
    REGULATORY = "regulatory"
    OTHER = "other"
```

**Constraint expiry:**
- Background task runs every 5 minutes, expires constraints past their `expires_at`
- On expiry, emits `ConstraintExpired` event (can trigger a re-solve if configured)
- Expired constraints move to `constraint_history` (never deleted, full audit trail)

**Pattern detection (from product transcript -- "the AI starts to surface larger patterns"):**
- Weekly Celery task analyzes constraint history
- Flags constraints that recur >5 times in 60 days for the same equipment
- Generates recommendation: "HX-201 capacity constraint applied 11 times in 60 days. Consider making this a permanent seasonal constraint."
- This analysis uses Claude with structured data input (not free text), purely for generating the natural language summary of the pattern

---

#### 2.9 Reconciliation Engine

**Responsibility:** Compare LP-predicted yields/outputs against actual plant performance. Detect coefficient drift where the LP model no longer reflects physical reality. Flag discrepancies for LP planner review.

**Owns tables:** `reconciliation_snapshots`, `coefficient_drift_alerts`

**Interfaces:**
- Runs as scheduled Celery task (daily, or configurable)
- Emits events: `CoefficientDriftDetected`
- `GET /api/v1/reconciliation/{site_id}` -- latest reconciliation data
- `GET /api/v1/reconciliation/{site_id}/history` -- drift trends over time

**How it works:**
1. After each LP solve, record the predicted outputs (yields, throughputs)
2. Wait for actual data to materialize in the historian (4-8 hours lag)
3. Compare predicted vs actual for each output parameter
4. If discrepancy exceeds threshold (configurable, default 10% relative) for >7 consecutive days, flag as coefficient drift
5. Generate drift alert with context for LP planner

```python
class ReconciliationSnapshot:
    site_id: str
    solve_id: UUID
    timestamp: datetime
    comparisons: list[ParameterComparison]

class ParameterComparison:
    parameter_name: str          # "Naphtha yield Unit 3"
    predicted_value: float       # 8.0%
    actual_value: float          # 4.2%
    delta: float                 # -3.8%
    relative_error: float        # 47.5%
    consecutive_drift_days: int  # 12
    status: str                  # "within_tolerance" | "drifting" | "alert"
```

---

#### 2.10 Dashboard API

**Responsibility:** Serve data to the frontend dashboard. Aggregate opportunity cost, sensor health, constraint status, recommendation history, and system health into queryable endpoints. Support WebSocket for real-time updates.

**Owns tables:** `opportunity_cost_ledger`

**Interfaces:**
- `GET /api/v1/dashboard/{site_id}/overview` -- main dashboard data
- `GET /api/v1/dashboard/{site_id}/opportunity-cost` -- 30/90 day opportunity cost
- `GET /api/v1/dashboard/{site_id}/sensor-health` -- sensor health matrix
- `GET /api/v1/dashboard/{site_id}/constraints` -- active constraint summary
- `GET /api/v1/dashboard/{site_id}/reconciliation` -- coefficient drift summary
- `WS /api/v1/dashboard/{site_id}/live` -- WebSocket for real-time updates

**Opportunity cost tracking (addresses R8 -- audience separation):**

```python
# Management view (GET /api/v1/dashboard/{site_id}/opportunity-cost)
{
    "site_id": "refinery-001",
    "period": "30d",
    "total_value_captured": 1245000,        # $ captured from accepted recommendations
    "total_value_identified": 1520000,       # $ total opportunity identified
    "capture_rate": 0.819,                   # 81.9%
    "by_unit": [
        {
            "unit_id": "UNIT-3",
            "value_captured": 580000,
            "value_identified": 680000,
            "top_constraint_reasons": [
                {"reason": "HX-201 capacity limit", "count": 11, "impact": 72000},
                {"reason": "Feed quality variance", "count": 4, "impact": 28000}
            ]
        }
    ],
    "trend": [
        {"date": "2026-03-01", "captured": 41000, "identified": 48000},
        {"date": "2026-03-02", "captured": 39000, "identified": 52000}
    ]
}
```

Note: No individual operator attribution. All tracking is by equipment/unit. Framing is "value captured" not "value lost."

---

#### 2.11 Auth & Admin

**Responsibility:** Multi-tenant authentication, RBAC, API key management for Edge Agents, site configuration, user management.

**Owns tables:** `users`, `roles`, `sites`, `api_keys`, `audit_log`

**Interfaces:**
- `POST /api/v1/auth/login` -- JWT token issuance
- `POST /api/v1/auth/refresh` -- JWT refresh
- `GET /api/v1/admin/sites` -- list sites (super-admin)
- `POST /api/v1/admin/sites` -- create site
- `GET /api/v1/admin/sites/{site_id}/users` -- list site users
- `POST /api/v1/admin/sites/{site_id}/users` -- add user to site
- `POST /api/v1/admin/sites/{site_id}/api-keys` -- generate Edge Agent API key
- `GET /api/v1/admin/audit-log` -- system audit log

**Multi-tenancy model:**

Every table has a `site_id` column. All queries are filtered by site_id. Row-Level Security (RLS) in PostgreSQL enforces tenant isolation at the database level -- even a bug in application code cannot leak data across tenants.

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sensor_readings
    USING (site_id = current_setting('app.current_site_id'));
```

**Roles:**

| Role | Permissions |
|------|------------|
| `super_admin` | All sites, all operations, user management |
| `site_admin` | Single site, all operations, user management for that site |
| `lp_planner` | View/edit LP configs, constraints, reconciliation, full dashboard |
| `shift_supervisor` | View recommendations, respond, create/clear constraints |
| `operator` | View recommendations, respond via structured input |
| `management` | View dashboard (financial view), no operational access |
| `edge_agent` | API key auth only, can push sensor data for assigned site |

**JWT structure:**
```json
{
    "sub": "user-uuid",
    "email": "jane@refinery001.com",
    "site_ids": ["refinery-001"],
    "roles": {"refinery-001": "shift_supervisor"},
    "exp": 1711555200
}
```

---

## 3. Tech Stack

### Language & Framework: Python 3.12 + FastAPI

**Why Python:**
- The team are students -- Python is the most commonly known language
- Claude Python SDK (`anthropic`) is first-class, well-documented
- `xlwings` / `pywin32` for Excel COM automation (Windows LP Worker)
- `pandas`, `numpy` for data processing in reconciliation engine
- `asyncio` native support in FastAPI for concurrent request handling
- Largest ecosystem for data engineering and ML adjacent work
- FastAPI generates OpenAPI docs automatically -- reduces documentation burden

**Why FastAPI specifically:**
- Native async/await support
- Pydantic models for request/response validation (catches bugs at the boundary)
- Auto-generated Swagger UI at `/docs` (great for development and testing)
- WebSocket support built in (for dashboard live updates)
- Dependency injection for auth, database sessions, tenant context
- Performance comparable to Node.js/Go for I/O-bound workloads (which Reflex is)

**Why not NestJS/TypeScript:**
- Team would need to learn TypeScript
- Excel COM automation libraries are weaker in Node.js
- Data processing ecosystem (pandas, numpy) does not exist in TypeScript
- Claude SDK exists for TypeScript but Python SDK is more mature

**Why not Go:**
- Steeper learning curve for students
- No Excel COM automation support
- Weaker ecosystem for data processing
- Unnecessary performance for this workload (Reflex is I/O-bound, not CPU-bound)

### ORM / Database Access: SQLAlchemy 2.0 + Alembic

- SQLAlchemy 2.0 with async support (`asyncpg` driver)
- Type-safe query building
- Alembic for schema migrations (critical for iterating on data model during early development)
- Compatible with TimescaleDB extensions

### Database: PostgreSQL 16 + TimescaleDB

**Why PostgreSQL:**
- Single database engine for both relational and time-series data (via TimescaleDB extension)
- Row-Level Security for multi-tenant isolation
- JSONB columns for semi-structured data (LP model configs, trigger configs)
- Mature, well-documented, free
- Every cloud provider offers managed PostgreSQL

**Why TimescaleDB (extension, not separate product):**
- Hypertables for sensor_readings and market_prices (automatic time-based partitioning)
- Continuous aggregates for dashboard queries (pre-computed rollups)
- Compression for historical data (10-20x compression ratio for time-series)
- It is just a PostgreSQL extension -- no separate database to manage
- Free for self-hosted, managed option (Timescale Cloud) available

**Why not a separate time-series database (InfluxDB, etc.):**
- Additional database to operate, monitor, back up
- Cross-database joins become impossible (e.g., joining sensor readings to constraint history)
- TimescaleDB gives 90% of the benefit with 0% of the operational overhead

### Message Queue / Task Queue: Celery + Redis

**Why Celery:**
- Python-native task queue -- no language mismatch
- Supports task priorities, retries, timeouts, rate limiting
- Result backend for tracking solve status
- Scheduled tasks (Celery Beat) for reconciliation engine, constraint expiry, pattern detection
- The team only needs to learn one tool for all async work

**Why Redis as broker (not RabbitMQ):**
- Simpler to operate -- single binary, no Erlang runtime
- Also serves as the application cache (one fewer service to manage)
- Pub/sub for the internal event bus
- Session storage for dashboard WebSocket state
- At 1-5 sites, Redis handles all three roles (broker, cache, pub/sub) easily

**When to switch:** If task queue reliability becomes critical (lost tasks on Redis restart), move to RabbitMQ as the Celery broker while keeping Redis for cache/pub/sub. This is a config change, not a code change.

### Cache: Redis

- Cache Claude API responses (keyed by prompt template version + trigger fingerprint)
- Cache dashboard aggregations (opportunity cost summaries recomputed every 15 minutes)
- Cache active constraint sets (read on every LP solve)
- TTLs: recommendation cache 4h, dashboard cache 15min, constraint cache on invalidation

### Containerization

**Development:** Docker Compose

```yaml
services:
  api:
    build: .
    ports: ["8000:8000"]
    depends_on: [db, redis]

  celery-worker:
    build: .
    command: celery -A reflex.tasks worker -l info
    depends_on: [db, redis]

  celery-beat:
    build: .
    command: celery -A reflex.tasks beat -l info
    depends_on: [redis]

  db:
    image: timescale/timescaledb:latest-pg16
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

**Production (Phase 1-2):** Railway or Render

- Managed platform -- no Kubernetes, no ECS task definitions, no Terraform
- Railway: $5/month base, pay for usage. Supports Docker, PostgreSQL, Redis as managed add-ons.
- Render: Similar pricing, auto-deploy from GitHub
- Both support custom domains, HTTPS, environment variables, health checks
- The Windows LP Worker runs on a separate Windows VM (Azure VM or AWS EC2) -- this cannot be containerized on Linux

**Production (Phase 3+):** AWS ECS Fargate or Azure Container Apps

- When Railway/Render limits are hit (custom networking, VPC peering, compliance requirements)
- Fargate: serverless containers, no EC2 instances to manage
- Move database to AWS RDS or Azure Database for PostgreSQL (managed, automated backups, replicas)

---

## 4. Inter-Service Communication Patterns

### Synchronous (REST)

Used for: Request-response where the caller needs an immediate answer.

| Caller | Endpoint | Why Sync |
|--------|----------|----------|
| Edge Agent | `POST /ingest/sensors` | Agent needs confirmation of receipt |
| Dashboard UI | `GET /dashboard/*` | User is waiting for page load |
| Admin UI | `POST /admin/sites` | User expects immediate feedback |
| Messaging webhook | `POST /messaging/webhooks/slack` | Slack expects 3-second response |
| Manual solve trigger | `POST /lp/solves/{site_id}/manual` | Returns solve_id for status tracking |

### Asynchronous (Celery Tasks)

Used for: Work that takes seconds to minutes, where the caller should not block.

| Task | Queue | Why Async |
|------|-------|-----------|
| LP Solve execution | `lp_solves` (dedicated queue) | 30s-7min execution time |
| Claude API translation | `ai_translation` | 2-10s API call, may retry |
| Reconciliation batch | `reconciliation` | Processes hours of data |
| Constraint pattern detection | `analytics` | Weekly batch, not time-sensitive |

### Event-Driven (Redis Pub/Sub)

Used for: Loose coupling between modules where the emitter does not care who listens.

```
Events flow:

SensorDataReceived ──> Data Quality Gateway
MarketPriceReceived ──> Data Quality Gateway

ValidatedDataReady ──> Trigger Engine
OperatingModeChanged ──> Trigger Engine (to suppress/resume triggers)

OptimizationTriggered ──> LP Orchestrator (dispatches Celery task)

SolveCompleted ──> AI Translation Service (dispatches Celery task)
SolveFailed ──> Dashboard API (for error display)

RecommendationReady ──> Messaging Service (sends Slack/Teams/email)
                   ──> Dashboard API (WebSocket push to live dashboard)

OperatorResponseReceived ──> Feedback Processor

ConstraintCreated ──> LP Orchestrator (triggers re-solve)
                 ──> Dashboard API (WebSocket push)

ConstraintExpired ──> LP Orchestrator (may trigger re-solve)

CoefficientDriftDetected ──> Dashboard API (alert display)
```

**Implementation:**

In the modular monolith, events are dispatched via an in-process event bus (simple Python pub/sub). The event bus interface is designed so it can be swapped to Redis pub/sub or a real message broker when modules are extracted into services.

```python
# Internal event bus (in-process, replaceable with Redis pub/sub)
class EventBus:
    def __init__(self):
        self._handlers: dict[str, list[Callable]] = {}

    def subscribe(self, event_type: str, handler: Callable):
        self._handlers.setdefault(event_type, []).append(handler)

    async def publish(self, event_type: str, payload: dict):
        for handler in self._handlers.get(event_type, []):
            # In monolith: direct function call
            # In microservices: publish to Redis/NATS/Kafka
            await handler(payload)
```

### Message Queue Topology

```
Redis (broker)
├── Queue: "lp_solves"           # Dedicated queue, consumed by Windows LP Worker
│   └── Priority: high           # LP solves should not wait behind analytics
├── Queue: "ai_translation"      # Consumed by Celery workers (Linux)
│   └── Priority: normal
├── Queue: "reconciliation"      # Consumed by Celery workers (Linux)
│   └── Priority: low
├── Queue: "analytics"           # Pattern detection, batch jobs
│   └── Priority: low
├── Queue: "messaging"           # Slack/Teams/email delivery
│   └── Priority: high           # Operator-facing, time-sensitive
└── Queue: "dead_letter"         # Failed tasks for manual review
```

Celery workers are configured to consume from specific queues:
- **Linux Celery workers** (cloud): consume from `ai_translation`, `reconciliation`, `analytics`, `messaging`
- **Windows LP Worker**: consumes only from `lp_solves`

---

## 5. Deployment Architecture

### Edge Component

**What runs at the refinery:**

A single Python process running in a Docker container (or as a Windows service if Docker is not available in the DMZ) on a server in the refinery's DMZ (Purdue Level 3.5).

```
Refinery OT Network (Levels 0-3)
        |
    [Historian Replica]  (PI Server or AVEVA replica in DMZ)
        |
        | PI Web API (REST, read-only)
        |
+-------------------+
| Reflex Edge Agent  |  <-- Purdue Level 3.5 (DMZ)
|                    |
| - Reads historian  |
|   via PI Web API   |
| - Buffers data     |
|   locally (SQLite) |
| - Pushes batches   |
|   via HTTPS POST   |
| - Heartbeat every  |
|   60 seconds       |
| - Runs data quality|
|   pre-checks       |
+-------------------+
        |
        | HTTPS outbound only (port 443)
        | No inbound firewall rules required
        |
    [Customer Firewall]
        |
        v
    Cloud API
```

**Edge Agent capabilities:**
- Authenticates to PI Web API using Kerberos (via service account) or Basic Auth
- Reads configured tag list on configurable interval (default: 60 seconds)
- Buffers readings locally in SQLite if cloud is unreachable (up to 72 hours)
- Pushes batches to cloud endpoint when connectivity is available
- Reports heartbeat and basic health metrics (CPU, memory, disk, tag read success rate)
- Self-updating via signed binary download from cloud (optional, some sites will not permit this)
- Configurable via cloud API (tag list, polling interval, batch size)

**Edge Agent security:**
- API key authentication (unique per agent, rotatable from cloud admin)
- TLS 1.3 for all outbound connections
- No inbound listening ports
- No write access to historian or any OT system
- Agent binary is signed
- Configuration changes require cloud-side admin approval

### Cloud Component

**Recommended cloud provider: AWS**

Rationale:
- AWS Activate provides $1,000-$100,000 in credits for startups (student team qualifies)
- Broadest managed service ecosystem
- Best documentation and community support (students learning)
- EC2 Windows instances for LP Worker
- RDS PostgreSQL with TimescaleDB extension support
- ElastiCache for Redis
- More cost-effective at low scale than Azure for compute

However, the architecture is cloud-agnostic by design. All cloud dependencies are behind interfaces. Railway/Render for Phase 1, AWS/Azure for Phase 3+.

**Phase 1-2 deployment (Railway/Render):**

```
Railway Project
├── Service: reflex-api (FastAPI, 1 instance)
├── Service: reflex-celery-worker (1 instance)
├── Service: reflex-celery-beat (1 instance)
├── Database: PostgreSQL (managed, TimescaleDB plugin)
├── Database: Redis (managed)
└── (External) Windows VM on Azure/AWS for LP Worker
```

Estimated cost: ~$25-50/month on Railway + ~$80-120/month for Windows VM = ~$100-170/month total for Phase 1.

**Phase 3+ deployment (AWS):**

```
AWS Account
├── VPC
│   ├── ECS Fargate Cluster
│   │   ├── Service: reflex-api (2 tasks, ALB)
│   │   ├── Service: reflex-celery-worker (2 tasks)
│   │   └── Service: reflex-celery-beat (1 task)
│   ├── RDS PostgreSQL (db.t3.medium, Multi-AZ)
│   ├── ElastiCache Redis (cache.t3.micro)
│   └── EC2 Windows (t3.medium per site, in ASG)
├── ALB (Application Load Balancer)
├── Route 53 (DNS)
├── ACM (TLS certificates)
├── CloudWatch (logging, monitoring, alerts)
├── S3 (LP model file storage, backups)
└── Secrets Manager (API keys, DB credentials)
```

### CI/CD Pipeline

**Tool: GitHub Actions** (free for public repos, generous free tier for private)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: timescale/timescaledb:latest-pg16
      redis:
        image: redis:7-alpine
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r requirements.txt
      - run: pytest --cov=reflex tests/
      - run: ruff check reflex/

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # Phase 1: Railway deployment
      - uses: railwayapp/deploy@v1
        with:
          railway-token: ${{ secrets.RAILWAY_TOKEN }}
      # Phase 3: Docker build + push to ECR + ECS deploy
```

**Branch strategy:**
- `main` -- production, auto-deploys
- `dev` -- staging, auto-deploys to staging environment
- Feature branches -- PR required, tests must pass

---

## 6. Database Schema

### Core Relational Tables

```sql
-- ============================================================
-- MULTI-TENANCY & AUTH
-- ============================================================

CREATE TABLE sites (
    id TEXT PRIMARY KEY,                    -- e.g., "refinery-001"
    name TEXT NOT NULL,
    location TEXT,
    timezone TEXT NOT NULL DEFAULT 'America/Chicago',
    operating_mode TEXT NOT NULL DEFAULT 'normal',
    config JSONB NOT NULL DEFAULT '{}',     -- site-specific configuration
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    site_id TEXT NOT NULL REFERENCES sites(id),
    role TEXT NOT NULL,                     -- super_admin, site_admin, lp_planner, shift_supervisor, operator, management
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id TEXT NOT NULL REFERENCES sites(id),
    key_hash TEXT NOT NULL,                 -- bcrypt hash of the API key
    name TEXT NOT NULL,                     -- e.g., "Edge Agent 1"
    role TEXT NOT NULL DEFAULT 'edge_agent',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- ============================================================
-- TIME-SERIES DATA (TimescaleDB hypertables)
-- ============================================================

CREATE TABLE sensor_readings (
    time TIMESTAMPTZ NOT NULL,
    site_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    value DOUBLE PRECISION,
    quality TEXT NOT NULL DEFAULT 'good',   -- good, suspect, bad, stale, substituted
    raw_value DOUBLE PRECISION,             -- original value before substitution
    batch_id UUID
);
SELECT create_hypertable('sensor_readings', 'time');
CREATE INDEX idx_sensor_readings_site_tag ON sensor_readings (site_id, tag_id, time DESC);

CREATE TABLE market_prices (
    time TIMESTAMPTZ NOT NULL,
    site_id TEXT NOT NULL,
    price_id TEXT NOT NULL,                 -- e.g., "WTI_CRUDE", "CRACK_GASOLINE", "CRACK_DIESEL"
    value DOUBLE PRECISION NOT NULL,
    unit TEXT NOT NULL,                     -- "$/bbl", "$/gal"
    source TEXT NOT NULL                    -- "eia", "customer_push", "manual"
);
SELECT create_hypertable('market_prices', 'time');
CREATE INDEX idx_market_prices_site_price ON market_prices (site_id, price_id, time DESC);

-- Continuous aggregates for dashboard queries
CREATE MATERIALIZED VIEW sensor_readings_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    site_id, tag_id,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    COUNT(*) AS reading_count
FROM sensor_readings
GROUP BY bucket, site_id, tag_id;

-- ============================================================
-- DATA QUALITY
-- ============================================================

CREATE TABLE quality_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id TEXT NOT NULL REFERENCES sites(id),
    tag_id TEXT NOT NULL,
    min_value DOUBLE PRECISION,
    max_value DOUBLE PRECISION,
    max_rate_of_change DOUBLE PRECISION,    -- per minute
    max_stale_seconds INTEGER NOT NULL DEFAULT 300,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX idx_quality_rules_site_tag ON quality_rules (site_id, tag_id);

CREATE TABLE sensor_substitutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id TEXT NOT NULL REFERENCES sites(id),
    failed_tag_id TEXT NOT NULL,
    substitute_tag_id TEXT NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE operating_mode_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id TEXT NOT NULL REFERENCES sites(id),
    mode TEXT NOT NULL,
    previous_mode TEXT NOT NULL,
    source TEXT NOT NULL,                   -- "manual", "auto_detected"
    changed_by UUID REFERENCES users(id),
    reason TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TABLE trigger_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id TEXT NOT NULL REFERENCES sites(id),
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,             -- "process_drift", "price_movement", "scheduled"
    config JSONB NOT NULL,                  -- type-specific config (thresholds, tags, schedule)
    min_interval_minutes INTEGER NOT NULL DEFAULT 60,
    max_per_shift INTEGER NOT NULL DEFAULT 3,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE trigger_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id TEXT NOT NULL,
    trigger_config_id UUID REFERENCES trigger_configs(id),
    trigger_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    data JSONB NOT NULL,                    -- trigger context (tags, values, baselines)
    was_suppressed BOOLEAN NOT NULL DEFAULT FALSE,  -- true if suppressed by mode/cooldown
    suppression_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trigger_events_site ON trigger_events (site_id, created_at DESC);

-- ============================================================
-- LP ORCHESTRATION
-- ============================================================

CREATE TABLE lp_model_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id TEXT NOT NULL REFERENCES sites(id),
    model_name TEXT NOT NULL,
    file_path TEXT NOT NULL,                -- path on Windows LP Worker
    solve_method TEXT NOT NULL,             -- "solver", "vba_macro", "manual_recalc"
    vba_macro_name TEXT,
    input_mappings JSONB NOT NULL,          -- [{tag_id, cell, type}]
    output_mappings JSONB NOT NULL,         -- [{name, cell, type, unit}]
    timeout_seconds INTEGER NOT NULL DEFAULT 180,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE solve_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id TEXT NOT NULL,
    model_config_id UUID REFERENCES lp_model_configs(id),
    trigger_event_id UUID REFERENCES trigger_events(id),
    reason TEXT NOT NULL,                   -- "trigger", "re_solve_constraint", "manual"
    input_data JSONB NOT NULL,              -- snapshot of all input values
    active_constraints JSONB NOT NULL,      -- snapshot of active constraints at solve time
    status TEXT NOT NULL DEFAULT 'queued',  -- queued, running, completed, failed, timeout
    celery_task_id TEXT,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT
);
CREATE INDEX idx_solve_requests_site ON solve_requests (site_id, queued_at DESC);

CREATE TABLE solve_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solve_request_id UUID NOT NULL REFERENCES solve_requests(id),
    site_id TEXT NOT NULL,
    outputs JSONB NOT NULL,                 -- raw LP output values
    deltas JSONB NOT NULL,                  -- calculated deltas vs previous solve
    total_margin_delta DOUBLE PRECISION,    -- $/day
    solver_status TEXT,                     -- "optimal", "infeasible", "unbounded"
    solve_time_seconds DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RECOMMENDATIONS & MESSAGING
-- ============================================================

CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id TEXT NOT NULL,
    solve_result_id UUID NOT NULL REFERENCES solve_results(id),
    content_operator TEXT NOT NULL,         -- plain English for operators/supervisors
    content_management TEXT NOT NULL,       -- financial summary for management
    content_template TEXT NOT NULL,         -- deterministic template fallback (always generated)
    source TEXT NOT NULL,                   -- "claude" or "template_fallback"
    prompt_template_version TEXT NOT NULL,
    validation_passed BOOLEAN NOT NULL,     -- did cross-validation pass?
    margin_opportunity DOUBLE PRECISION,    -- $/day
    status TEXT NOT NULL DEFAULT 'pending', -- pending, delivered, accepted, rejected, deferred, expired
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE message_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES recommendations(id),
    site_id TEXT NOT NULL,
    channel TEXT NOT NULL,                  -- "slack", "teams", "email", "dashboard"
    recipient_id UUID REFERENCES users(id),
    external_message_id TEXT,               -- Slack ts, Teams activity ID
    status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, delivered, failed
    sent_at TIMESTAMPTZ,
    error_message TEXT
);

-- ============================================================
-- FEEDBACK & CONSTRAINTS
-- ============================================================

CREATE TABLE feedback_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id TEXT NOT NULL,
    recommendation_id UUID NOT NULL REFERENCES recommendations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,                   -- "accept", "accept_modified", "defer", "reject_equipment", "reject_other"
    structured_input JSONB,                 -- unit, constraint_type, severity, duration (if reject)
    note TEXT,                              -- optional free text
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_feedback_events_site ON feedback_events (site_id, created_at DESC);

CREATE TABLE constraints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id TEXT NOT NULL,
    unit_id TEXT NOT NULL,
    constraint_type TEXT NOT NULL,
    parameter TEXT NOT NULL,                -- LP parameter affected
    bound_type TEXT NOT NULL,               -- "upper", "lower", "fixed"
    bound_value DOUBLE PRECISION NOT NULL,
    unit TEXT NOT NULL,
    reason TEXT NOT NULL,
    note TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    feedback_event_id UUID REFERENCES feedback_events(id),
    status TEXT NOT NULL DEFAULT 'active',  -- active, expired, cleared, superseded
    expires_at TIMESTAMPTZ,
    expiry_type TEXT NOT NULL,              -- "end_of_shift", "24h", "until_cleared", "custom"
    cleared_by UUID REFERENCES users(id),
    cleared_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_constraints_site_active ON constraints (site_id) WHERE status = 'active';
CREATE INDEX idx_constraints_unit ON constraints (site_id, unit_id);

CREATE TABLE constraint_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    constraint_id UUID NOT NULL,
    site_id TEXT NOT NULL,
    unit_id TEXT NOT NULL,
    constraint_type TEXT NOT NULL,
    action TEXT NOT NULL,                   -- "created", "updated", "expired", "cleared"
    data JSONB NOT NULL,                    -- full constraint snapshot at time of action
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_constraint_history_site ON constraint_history (site_id, changed_at DESC);

-- ============================================================
-- RECONCILIATION
-- ============================================================

CREATE TABLE reconciliation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id TEXT NOT NULL,
    solve_request_id UUID REFERENCES solve_requests(id),
    comparisons JSONB NOT NULL,            -- [{parameter, predicted, actual, delta, relative_error}]
    drift_alerts JSONB,                    -- parameters exceeding drift threshold
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- OPPORTUNITY COST
-- ============================================================

CREATE TABLE opportunity_cost_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id TEXT NOT NULL,
    recommendation_id UUID NOT NULL REFERENCES recommendations(id),
    unit_id TEXT NOT NULL,
    identified_value DOUBLE PRECISION NOT NULL,  -- what the LP said we could capture
    outcome TEXT NOT NULL,                        -- "captured", "partially_captured", "not_captured"
    captured_value DOUBLE PRECISION,              -- estimated actual capture (from reconciliation)
    constraint_reasons JSONB,                     -- why value was not captured
    date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_opp_cost_site_date ON opportunity_cost_ledger (site_id, date DESC);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id TEXT,
    user_id UUID,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_log_site ON audit_log (site_id, created_at DESC);
```

### Key Indexes Summary

| Table | Index | Purpose |
|-------|-------|---------|
| sensor_readings | (site_id, tag_id, time DESC) | Fast lookup of latest reading for a tag |
| market_prices | (site_id, price_id, time DESC) | Fast lookup of latest price |
| constraints | (site_id) WHERE active | Fast active constraint lookup per site |
| constraints | (site_id, unit_id) | Constraint lookup by equipment |
| solve_requests | (site_id, queued_at DESC) | Solve history |
| feedback_events | (site_id, created_at DESC) | Feedback history |
| opportunity_cost_ledger | (site_id, date DESC) | Dashboard queries |

### Data Retention

| Data Type | Hot (full resolution) | Warm (aggregated) | Cold (archived) |
|-----------|----------------------|-------------------|-----------------|
| Sensor readings | 30 days | 1 year (hourly avg) | 7 years (daily avg, compressed) |
| Market prices | 90 days | 2 years | 7 years |
| Recommendations | 1 year | Permanent | N/A |
| Constraints | Permanent | N/A | N/A |
| Feedback events | Permanent | N/A | N/A |
| Audit log | 2 years | Permanent (compressed) | N/A |

TimescaleDB compression policies handle hot-to-warm transitions automatically.

---

## 7. Project Structure

```
reflex/
├── alembic/                        # Database migrations
│   └── versions/
├── reflex/
│   ├── __init__.py
│   ├── main.py                     # FastAPI application entry point
│   ├── config.py                   # Settings (pydantic-settings, env vars)
│   ├── database.py                 # SQLAlchemy engine, session factory
│   ├── events.py                   # Internal event bus
│   ├── dependencies.py             # FastAPI dependency injection (auth, db session, tenant)
│   │
│   ├── auth/                       # Auth & Admin module
│   │   ├── api.py                  # REST endpoints
│   │   ├── services.py             # Business logic
│   │   ├── models.py               # SQLAlchemy models (users, api_keys, sites)
│   │   └── schemas.py              # Pydantic request/response schemas
│   │
│   ├── ingestion/                  # Data Ingestion module
│   │   ├── api.py
│   │   ├── services.py
│   │   ├── models.py
│   │   └── schemas.py
│   │
│   ├── quality/                    # Data Quality Gateway module
│   │   ├── api.py
│   │   ├── services.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── checks.py              # Individual quality check implementations
│   │
│   ├── triggers/                   # Trigger Engine module
│   │   ├── api.py
│   │   ├── services.py
│   │   ├── models.py
│   │   └── schemas.py
│   │
│   ├── lp/                         # LP Orchestrator module
│   │   ├── api.py
│   │   ├── services.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── tasks.py               # Celery tasks for LP solve dispatch
│   │
│   ├── translation/                # AI Translation Service module
│   │   ├── api.py
│   │   ├── services.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── prompts.py             # Prompt templates
│   │   ├── validation.py          # Number cross-validation
│   │   └── tasks.py               # Celery tasks for Claude API calls
│   │
│   ├── messaging/                  # Messaging Service module
│   │   ├── api.py
│   │   ├── services.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── slack.py               # Slack Block Kit builder + webhook handler
│   │   └── teams.py               # Teams Adaptive Card builder + webhook handler
│   │
│   ├── feedback/                   # Feedback Processor module
│   │   ├── api.py
│   │   ├── services.py
│   │   ├── models.py
│   │   └── schemas.py
│   │
│   ├── constraints/                # Constraint Registry module
│   │   ├── api.py
│   │   ├── services.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── tasks.py               # Celery tasks for expiry + pattern detection
│   │
│   ├── reconciliation/             # Reconciliation Engine module
│   │   ├── api.py
│   │   ├── services.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── tasks.py               # Celery scheduled reconciliation task
│   │
│   └── dashboard/                  # Dashboard API module
│       ├── api.py
│       ├── services.py
│       ├── models.py
│       ├── schemas.py
│       └── websocket.py           # WebSocket handler for live updates
│
├── edge_agent/                     # Separate package, deployed at refinery
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── historian.py               # PI Web API client
│   ├── buffer.py                  # SQLite local buffer
│   ├── uploader.py                # HTTPS push to cloud
│   └── health.py                  # Heartbeat and self-monitoring
│
├── lp_worker/                      # Separate package, deployed on Windows VM
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── excel_automation.py        # COM automation via pywin32
│   ├── watchdog.py                # Hang detection + zombie cleanup
│   └── tasks.py                   # Celery task definitions
│
├── tests/
│   ├── conftest.py
│   ├── test_ingestion/
│   ├── test_quality/
│   ├── test_triggers/
│   ├── test_lp/
│   ├── test_translation/
│   ├── test_messaging/
│   ├── test_feedback/
│   ├── test_constraints/
│   ├── test_reconciliation/
│   └── test_dashboard/
│
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.edge
├── Dockerfile.lp-worker            # Windows container or deployment script
├── requirements.txt
├── alembic.ini
├── pyproject.toml
└── .github/
    └── workflows/
        └── deploy.yml
```

---

## 8. Error Handling & Reliability

### Retry Policies

| Integration | Max Retries | Backoff | Circuit Breaker |
|-------------|-------------|---------|-----------------|
| PI Web API (edge) | 5 | Exponential (1s, 2s, 4s, 8s, 16s) | Open after 10 consecutive failures, half-open after 60s |
| Claude API | 3 | Exponential (2s, 4s, 8s) | Open after 5 failures, fallback to template immediately |
| Slack API | 3 | Exponential (1s, 2s, 4s) | Open after 10 failures, fallback to email |
| Teams API | 3 | Exponential (1s, 2s, 4s) | Open after 10 failures, fallback to email |
| Excel COM | 2 | Fixed 10s (restart Excel between retries) | After 3 consecutive, restart Windows service |
| PostgreSQL | 3 | Exponential (0.5s, 1s, 2s) | N/A (if DB is down, everything is down) |

### Graceful Degradation

| Component Down | Impact | Degraded Behavior |
|---------------|--------|-------------------|
| Claude API | Cannot generate natural language | Use deterministic template fallback (always pre-generated) |
| Slack/Teams | Cannot deliver to chat | Deliver via email + dashboard |
| LP Worker (Windows) | Cannot run solves | Queue requests, surface "solve pending" on dashboard, alert admin |
| Edge Agent | No new sensor data | Dashboard shows "data stale since X", triggers pause, last-known values used |
| Redis | No cache, no task queue | API still serves from PostgreSQL, tasks fail (manual restart required) |

---

## 9. Security Architecture

### Authentication Flows

1. **Dashboard users**: Email/password -> JWT (access token 15min + refresh token 7 days)
2. **Edge Agents**: API key in `X-API-Key` header -> validated against bcrypt hash in `api_keys` table
3. **Slack/Teams webhooks**: Request signature verification (Slack signing secret / Teams HMAC)
4. **Inter-module**: In monolith, function calls (no auth needed). When extracted, service-to-service JWT with `system` role.

### Data Encryption

| Layer | Method |
|-------|--------|
| In transit (edge to cloud) | TLS 1.3, certificate pinning optional |
| In transit (internal) | TLS termination at load balancer |
| At rest (database) | PostgreSQL TDE or cloud-managed encryption (RDS default) |
| At rest (backups) | AES-256 encrypted S3 |
| Secrets | Environment variables via cloud secrets manager (never in code/config files) |
| API keys | bcrypt hashed in database, raw key shown once at creation |

### Tenant Isolation

- PostgreSQL Row-Level Security on all tenant-scoped tables
- Application-level middleware sets `app.current_site_id` from JWT claims
- API key maps to exactly one site_id
- No cross-site queries possible even via SQL injection
- Separate S3 prefixes per site for LP model files

---

## 10. Key API Endpoint Summary

### Data Ingestion
```
POST   /api/v1/ingest/sensors              # Edge Agent pushes sensor data
POST   /api/v1/ingest/market-prices        # Market data push
```

### Data Quality
```
GET    /api/v1/quality/sensor-health/{site_id}      # Sensor health overview
POST   /api/v1/quality/substitutions                  # Register sensor substitution
PUT    /api/v1/quality/operating-mode/{site_id}       # Set operating mode
GET    /api/v1/quality/operating-mode/{site_id}       # Get current mode
```

### Triggers
```
GET    /api/v1/triggers/{site_id}                     # List trigger configs
PUT    /api/v1/triggers/{site_id}/{trigger_id}        # Update trigger
GET    /api/v1/triggers/{site_id}/history             # Trigger event history
```

### LP Orchestration
```
GET    /api/v1/lp/models/{site_id}                    # List LP model configs
POST   /api/v1/lp/models/{site_id}                    # Create/update model config
POST   /api/v1/lp/solves/{site_id}/manual             # Manual solve trigger
GET    /api/v1/lp/solves/{site_id}                    # Solve history
GET    /api/v1/lp/solves/{solve_id}                   # Specific solve result
```

### Recommendations
```
GET    /api/v1/recommendations/{site_id}              # Recommendation history
GET    /api/v1/recommendations/{recommendation_id}    # Specific recommendation
```

### Messaging
```
POST   /api/v1/messaging/webhooks/slack               # Slack interaction webhook
POST   /api/v1/messaging/webhooks/teams               # Teams interaction webhook
GET    /api/v1/messaging/configs/{site_id}            # Messaging config
PUT    /api/v1/messaging/configs/{site_id}            # Update messaging config
```

### Feedback
```
GET    /api/v1/feedback/{site_id}                     # Feedback history
```

### Constraints
```
GET    /api/v1/constraints/{site_id}                  # Active constraints
POST   /api/v1/constraints/{site_id}                  # Create constraint manually
DELETE /api/v1/constraints/{constraint_id}             # Clear/expire constraint
GET    /api/v1/constraints/{site_id}/history           # Full constraint history
GET    /api/v1/constraints/{site_id}/patterns          # Detected patterns
```

### Reconciliation
```
GET    /api/v1/reconciliation/{site_id}               # Latest reconciliation
GET    /api/v1/reconciliation/{site_id}/history        # Drift trends
```

### Dashboard
```
GET    /api/v1/dashboard/{site_id}/overview            # Main dashboard
GET    /api/v1/dashboard/{site_id}/opportunity-cost    # Opportunity cost (30/90d)
GET    /api/v1/dashboard/{site_id}/sensor-health       # Sensor health matrix
GET    /api/v1/dashboard/{site_id}/system-status       # System health
WS     /api/v1/dashboard/{site_id}/live                # WebSocket live updates
```

### Auth & Admin
```
POST   /api/v1/auth/login                             # Get JWT
POST   /api/v1/auth/refresh                           # Refresh JWT
GET    /api/v1/admin/sites                             # List sites
POST   /api/v1/admin/sites                             # Create site
GET    /api/v1/admin/sites/{site_id}/users             # List users
POST   /api/v1/admin/sites/{site_id}/users             # Add user
POST   /api/v1/admin/sites/{site_id}/api-keys          # Generate API key
GET    /api/v1/admin/audit-log                         # Audit log
```

---

## 11. Scaling Considerations & Bottlenecks

### Known Bottlenecks

| Bottleneck | Trigger Point | Mitigation |
|------------|--------------|------------|
| Excel COM (single-threaded) | >1 solve per 5 min per site | One Windows VM per site; backpressure coalescing |
| PostgreSQL connections | >100 concurrent connections | Connection pooling (PgBouncer or SQLAlchemy pool) |
| TimescaleDB write throughput | >100K inserts/sec | Batch inserts from edge (already designed), compression |
| Claude API rate limits | >60 req/min (Tier 1) | Response caching, template fallback, rate limit in Celery |
| Redis memory | >1GB cache | TTL policies, LRU eviction |

### Horizontal Scaling Path

| Component | Scaling Strategy |
|-----------|-----------------|
| FastAPI | Add container replicas behind load balancer (stateless) |
| Celery workers | Add worker instances (automatic task distribution) |
| LP Workers | 1 Windows VM per site (natural partitioning) |
| PostgreSQL | Read replicas for dashboard queries; vertical scaling for writes |
| Redis | Redis Cluster if >1GB (unlikely before 50+ sites) |

At 1-5 sites (Phase 1-2), everything runs on single instances. No scaling engineering is needed.

---

## 12. Development Priorities (Build Order)

For a student team building Phase 1 MVP:

| Week | Module | Why This Order |
|------|--------|---------------|
| 1-2 | Auth + Admin + Database schema | Foundation. Cannot build anything without multi-tenancy and auth. |
| 3-4 | Data Ingestion + Edge Agent (simulator mode) | Build a sensor data simulator. No need for a real historian yet. |
| 5-6 | Data Quality Gateway | Validate data before anything touches it. |
| 7-8 | Trigger Engine | Watch validated data, fire triggers. Test with simulated data. |
| 9-11 | LP Orchestrator + Windows LP Worker | The hardest, riskiest piece. Validate with a real Excel model. |
| 12-13 | AI Translation Service | Claude integration + template fallback + cross-validation. |
| 14-15 | Messaging Service | Slack delivery + structured input. |
| 16-17 | Feedback Processor + Constraint Registry | Close the feedback loop. |
| 18-19 | Dashboard API | Serve data to frontend. |
| 20 | Reconciliation Engine | Phase 2 feature, but schema is in place from day 1. |

This ordering front-loads the riskiest component (LP Orchestrator) to weeks 9-11, after the data pipeline is working, so you have real simulated data flowing through the system to test LP automation against.

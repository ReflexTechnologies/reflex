# Reflex Platform — Data Architecture

> **Date:** 2026-03-27
> **For:** Founding team engineering decisions
> **Based on:** Product transcript analysis, Run 1 risk matrix (20 risks), cloud platform recommendation (Run 2 Agent 2A), and targeted research into historian APIs, time-series databases, trigger engines, Excel automation, NLP pipelines, and event architectures
> **Addresses risks:** R1 (Excel COM), R2 (Delivery Channel), R5 (LLM/NLP), R6 (OT Security), R9 (Alert Fatigue), R11 (Sensor Glitches), R13 (Compression Artifacts)

---

## Executive Summary

Reflex's data architecture is built on a single principle: **PostgreSQL for everything.** By using TimescaleDB (a PostgreSQL extension), all time-series sensor data, relational application data, event queues, and trigger logic run on one database. This eliminates the operational overhead of running separate time-series and relational databases, costs $20-65/month total, and is well within the capabilities of a student team.

| Component | Technology | Cost |
|-----------|-----------|------|
| Historian access | PI Web API StreamSets + Basic Auth | Free (included with PI) |
| Edge agent | Python Docker container with SQLite store-and-forward | Free |
| Market data | EIA API v2 (daily) + OilPriceAPI (intra-day) | $0-15/mo |
| Database | TimescaleDB on managed PostgreSQL | $20-50/mo |
| Trigger engine | Pure Python in-memory evaluator | Free (no external engine) |
| Event queue | PostgreSQL LISTEN/NOTIFY + table-based job queue | Free (same database) |
| NLP extraction | Claude API tool calling | <$0.01/day |
| Excel automation | safexl + pywin32 on Windows VM (short-term) | Covered by Azure credits |
| LP solver (long-term) | PuLP + HiGHS | Free (MIT/BSD licensed) |

### Divergence from Cloud Platform Recommendation

The cloud platform recommendation (Agent 2A) chose **InfluxDB Cloud** for time-series and **Azure PostgreSQL** for relational data. This document recommends **replacing InfluxDB with TimescaleDB** on the same PostgreSQL instance. Rationale:

1. **One database instead of two.** Operating, monitoring, backing up, and paying for a single PostgreSQL instance is simpler than managing PostgreSQL + InfluxDB.
2. **Full SQL with JOINs.** Coefficient reconciliation, drift detection, and opportunity cost tracking all require joining time-series data with relational data (constraints, LP runs, recommendations). TimescaleDB supports this natively; InfluxDB requires cross-database queries or data duplication.
3. **Zero new query language.** TimescaleDB uses standard PostgreSQL SQL. InfluxDB v3 has SQL but it's a new engine with maturity concerns.
4. **Comparable performance at this scale.** At 150 tags × 1 reading/second = 150 rows/second ingestion, TimescaleDB handles this easily (it's designed for 100K+ rows/second).
5. **90%+ compression** with automated hot/cold tiering via compression policies.

The InfluxDB choice is defensible for its free tier and Telegraf OPC-UA plugin, but since Reflex uses PI Web API (not OPC-UA) for data collection, and Azure for Students provides free PostgreSQL hosting for 12 months, TimescaleDB is the stronger choice.

---

## 1. Data Ingestion Layer

### 1.1 Historian Connector Architecture

**Technology:** PI Web API over HTTPS with Basic Auth

Mid-size refineries overwhelmingly use OSIsoft PI (now AVEVA) as their process historian. PI Web API is the REST interface explicitly designed for DMZ access — it's the only historian API that operates cleanly at Purdue Level 3.5.

**Data retrieval pattern:**

```
Step 1 (one-time): Resolve tag names to WebIDs
  GET /piwebapi/points?path=\\PISERVER\TAG001
  → returns WebID (cached indefinitely)

Step 2 (every 30-60 seconds): Bulk read current values via StreamSets
  GET /piwebapi/streamsets/value?webid={id1}&webid={id2}&...&webid={idN}
  → returns all current values in one call (up to ~400 tags per request)

Step 3 (on-demand): Historical data for drift detection / reconciliation
  GET /piwebapi/streams/{webId}/interpolated?startTime=*-1h&endTime=*&interval=30s
  → returns evenly-spaced interpolated values
```

**Key API details:**

| Endpoint | Purpose | Use Case |
|----------|---------|----------|
| `GET /streamsets/value?webid=X&webid=Y...` | Bulk current values | Real-time monitoring (100+ tags/call) |
| `POST /batch` | Multiple sub-requests in one call | >400 tags or complex queries |
| `GET /streams/{webId}/recorded` | Compressed/event-driven values | Audit trails, actual state changes |
| `GET /streams/{webId}/interpolated` | Uniform-interval values | Correlation, ML, consistent storage |
| `GET /streams/{webId}/summary` | Aggregations (Avg, Min, Max) | Roll-up queries |

**Authentication:** Basic Auth over HTTPS in the DMZ. Kerberos is preferred in corporate networks but requires Active Directory domain membership that DMZ machines often lack. Basic Auth is simpler and sufficient when traffic is encrypted via TLS.

**Libraries:** `pip install requests` (core), `pip install requests-kerberos requests-ntlm` (if needed for specific deployments).

**Why not Seeq?** Seeq is an enterprise analytics layer on top of PI with enterprise pricing. It adds value for pattern detection and advanced analytics but is overkill for data collection. Go direct to PI Web API.

**Why not OPC-UA?** OPC-UA endpoints live at the DCS/SCADA level (Purdue Level 2-3), not in the DMZ. PI Web API is explicitly designed for DMZ access. OPC-UA is only relevant if connecting directly to PLCs, which Reflex should never do.

### 1.2 Edge Agent Architecture

**Technology:** Python application in a Docker container (~50-80 MB)

The edge agent deploys in the customer's DMZ (Purdue Level 3.5), reads from the PI Data Archive replica via PI Web API, and pushes data outbound to Reflex cloud via HTTPS. It never requires inbound firewall rules — directly addressing R6 (OT Security).

```
REFINERY (OT Network)              DMZ                        CLOUD
┌──────────────────┐    ┌──────────────────────┐    ┌──────────────────┐
│ PI Data Archive  │───▶│ PI Data Archive      │    │                  │
│ (primary)        │rep │ (read-only replica)  │    │ Reflex Backend   │
│                  │    │         │             │    │                  │
│ DCS / PLCs       │    │ PI Web API (IIS)     │    │ POST /ingest     │
│ Sensors (100+)   │    │    HTTPS/443         │    │                  │
└──────────────────┘    │         │             │    └──────────────────┘
                        │  ┌──────▼───────────┐│           ▲
                        │  │ Reflex Edge Agent ││           │
                        │  │ (Docker)          ││───────────┘
                        │  │                   ││  HTTPS outbound only
                        │  │ ┌───────────────┐ ││
                        │  │ │ PI Reader     │ ││
                        │  │ │ (requests)    │ ││
                        │  │ ├───────────────┤ ││
                        │  │ │ Data Quality  │ ││
                        │  │ │ Gateway       │ ││
                        │  │ ├───────────────┤ ││
                        │  │ │ SQLite Buffer │ ││
                        │  │ │ (store & fwd) │ ││
                        │  │ └───────────────┘ ││
                        │  └──────────────────┘│
                        └──────────────────────┘
```

**Core components:**

1. **PI Reader**: Polls PI Web API StreamSets every 30-60 seconds for all configured tags. One HTTPS request returns all 100+ tag values.
2. **Data Quality Gateway** (R11, R13 mitigation): Validates every reading before forwarding:
   - Staleness check: reject readings older than 2× poll interval
   - Range check: reject values outside physical limits (per-tag configurable)
   - Rate-of-change check: flag readings that change faster than physically possible
   - Digital state detection: convert PI digital states (e.g., "Bad", "Shutdown") to quality flags
   - Compression artifact detection: flag suspiciously flat readings that suggest PI compression is masking changes
3. **SQLite Buffer**: Store-and-forward for network resilience. If the cloud API is unreachable, readings buffer locally and flush when connectivity returns. Prevents data loss during outages.
4. **Cloud Push**: Batches readings into HTTPS POST requests to Reflex cloud. Outbound only — no inbound ports required.

**Deployment options:**

| Scenario | Deployment | Auth |
|----------|-----------|------|
| Linux DMZ host | Docker container | Basic Auth (avoid keytab complexity) |
| Windows Server (already running PI Web API) | Windows Service via NSSM | Native NTLM/Kerberos |

**Data Quality Gateway detail** (addresses R11 and R13):

```python
# Per-tag quality configuration (stored in PostgreSQL, loaded at startup)
{
    "tag": "TI-201.PV",
    "display_name": "Reactor 201 Inlet Temp",
    "unit": "degF",
    "min_physical": 100,        # Below this = sensor failure
    "max_physical": 900,        # Above this = sensor failure
    "max_rate_of_change": 50,   # degF/minute — faster = suspect
    "stale_threshold_sec": 120, # No update in 2 min = stale
    "substitution_tag": null    # If set, use this tag when primary fails
}
```

Quality check results are stored alongside the reading value as a quality flag:

| Quality | Value | Meaning |
|---------|-------|---------|
| 0 | GOOD | Passed all checks |
| 1 | STALE | No update within threshold |
| 2 | RANGE_VIOLATION | Outside physical limits |
| 3 | RATE_VIOLATION | Changed too fast |
| 4 | DIGITAL_STATE | PI returned a digital state, not a number |
| 5 | SUBSTITUTED | Primary sensor failed; using substitute tag |
| 6 | COMPRESSION_SUSPECT | Flat reading may be compression artifact |

### 1.3 Market Data Connector

**Primary: EIA Open Data API v2 (FREE)**

The U.S. Energy Information Administration provides free daily spot prices for all crack spread components.

| Series Code | Description | Frequency |
|-------------|-------------|-----------|
| `PET.RWTC.D` | WTI Cushing Spot Price ($/bbl) | Daily |
| `PET.RBRTE.D` | Brent Spot Price ($/bbl) | Daily |
| `PET.EER_EPMRU_PF4_Y35NY_DPG.D` | NY Harbor RBOB Gasoline ($/gal) | Daily |
| `PET.EER_EPLLPA_PF4_Y35NY_DPG.D` | NY Harbor ULSD Diesel ($/gal) | Daily |

**API query pattern:**
```
GET https://api.eia.gov/v2/petroleum/pri/spt/data
    ?api_key=YOUR_KEY
    &data[]=value
    &facets[series][]=RWTC
    &frequency=daily
    &sort[0][column]=period
    &sort[0][direction]=desc
    &length=30
```

**Crack spread calculation (3:2:1 Gulf Coast):**
```
Crack Spread ($/bbl) = [(2 × Gasoline_$/gal × 42) + (1 × Diesel_$/gal × 42) - (3 × Crude_$/bbl)] / 3
```

**Supplement: OilPriceAPI ($0-15/mo)**

For intra-day updates (every 5 minutes): WTI, Brent, RBOB Gasoline, ULSD Diesel, Heating Oil, Jet Fuel. REST API with token auth. Add only if intra-day price trigger resolution is needed.

**Customer-supplied data ("Bring Your Own Data" — R17 mitigation):**

Refineries already have OPIS and Platts subscriptions. Reflex ingests their data via CSV upload, email parsing, or API forwarding — never redistributes raw pricing. This eliminates $10K-$50K/year licensing costs and redistribution legal risk.

### 1.4 Ingestion Data Schemas

**Sensor reading (edge agent → cloud):**
```json
{
    "site_id": "site_valero_houston",
    "batch_timestamp": "2026-03-27T14:30:00Z",
    "readings": [
        {
            "tag": "TI-201.PV",
            "value": 347.2,
            "timestamp": "2026-03-27T14:29:58Z",
            "quality": 0
        },
        {
            "tag": "FI-101.PV",
            "value": 42500.0,
            "timestamp": "2026-03-27T14:29:59Z",
            "quality": 0
        }
    ]
}
```

**Market data (EIA/OilPriceAPI → cloud):**
```json
{
    "source": "eia",
    "fetched_at": "2026-03-27T15:00:00Z",
    "prices": [
        {
            "commodity": "WTI",
            "price": 72.45,
            "unit": "$/bbl",
            "period": "2026-03-26",
            "series_id": "PET.RWTC.D"
        },
        {
            "commodity": "RBOB_GASOLINE",
            "price": 2.31,
            "unit": "$/gal",
            "period": "2026-03-26",
            "series_id": "PET.EER_EPMRU_PF4_Y35NY_DPG.D"
        }
    ],
    "computed": {
        "crack_spread_321": 18.73,
        "unit": "$/bbl",
        "formula": "3:2:1 Gulf Coast"
    }
}
```

---

## 2. Data Storage

### 2.1 Database Technology: TimescaleDB on PostgreSQL

**Single database for everything.** TimescaleDB is a PostgreSQL extension that adds time-series capabilities (hypertables, compression, continuous aggregates, retention policies) while keeping full PostgreSQL functionality (JOINs, foreign keys, transactions, JSONB, LISTEN/NOTIFY).

**Why this matters for Reflex:** Nearly every intelligence feature requires joining time-series data with relational data:

| Feature | Time-Series Data Needed | Relational Data Needed |
|---------|------------------------|----------------------|
| Coefficient reconciliation | Actual yields over time | LP model predicted yields |
| Opportunity cost tracking | Actual production rates | Recommendation + override history |
| Sensor substitution | Sensor readings + quality flags | Substitution registry |
| Drift detection | Tag values over time windows | Threshold rules, operating mode |
| Constraint pattern analysis | Constraint frequency over time | Constraint details, equipment |

With TimescaleDB, these are standard SQL JOINs. With separate InfluxDB + PostgreSQL, each query requires cross-database data movement.

**Storage estimation:**

| Scenario | Raw Data | With 90% Compression |
|----------|---------|---------------------|
| 150 tags × 1 reading/sec × 90 days (hot) | 9.3 GB | ~930 MB |
| 150 tags × 1 reading/sec × 2 years (cold) | 75 GB | ~7.5 GB |
| **Total** | **84 GB** | **~8.4 GB** |
| At 1-min intervals (more realistic) | 1.4 GB | **~140 MB** |

At these volumes, a $20-50/month managed PostgreSQL instance is more than sufficient.

### 2.2 Time-Series Schema

```sql
-- ============================================
-- TIME-SERIES: Sensor Readings (hypertable)
-- ============================================
CREATE TABLE sensor_readings (
    time            TIMESTAMPTZ     NOT NULL,
    site_id         INTEGER         NOT NULL,
    tag_name        TEXT            NOT NULL,
    value           DOUBLE PRECISION,
    quality         SMALLINT        DEFAULT 0  -- 0=GOOD, 1=STALE, 2=RANGE, etc.
);

SELECT create_hypertable('sensor_readings', 'time',
    chunk_time_interval => INTERVAL '1 day'
);

-- Compression: compress chunks older than 7 days (90%+ space reduction)
ALTER TABLE sensor_readings SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'site_id, tag_name',
    timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('sensor_readings', INTERVAL '7 days');

-- Retention: drop chunks older than 2 years
SELECT add_retention_policy('sensor_readings', INTERVAL '2 years');

-- Indexes
CREATE INDEX idx_sensor_readings_tag ON sensor_readings (site_id, tag_name, time DESC);

-- ============================================
-- TIME-SERIES: 5-Minute Continuous Aggregate
-- ============================================
-- Auto-refreshing materialized view for dashboards and drift detection
CREATE MATERIALIZED VIEW sensor_5min
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', time)  AS bucket,
    site_id,
    tag_name,
    avg(value)                      AS avg_val,
    min(value)                      AS min_val,
    max(value)                      AS max_val,
    last(value, time)               AS last_val,
    count(*)                        AS sample_count
FROM sensor_readings
GROUP BY bucket, site_id, tag_name;

SELECT add_continuous_aggregate_policy('sensor_5min',
    start_offset    => INTERVAL '1 hour',
    end_offset      => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '5 minutes'
);

-- ============================================
-- TIME-SERIES: Market Prices (hypertable)
-- ============================================
CREATE TABLE market_prices (
    time            TIMESTAMPTZ     NOT NULL,
    source          TEXT            NOT NULL,  -- 'eia', 'oilpriceapi', 'customer_opis'
    commodity       TEXT            NOT NULL,  -- 'WTI', 'BRENT', 'RBOB_GASOLINE', 'ULSD_DIESEL'
    price           DOUBLE PRECISION NOT NULL,
    unit            TEXT            NOT NULL   -- '$/bbl', '$/gal'
);

SELECT create_hypertable('market_prices', 'time',
    chunk_time_interval => INTERVAL '7 days'
);

CREATE INDEX idx_market_prices_commodity ON market_prices (commodity, time DESC);

-- ============================================
-- TIME-SERIES: Computed Crack Spreads (hypertable)
-- ============================================
CREATE TABLE crack_spreads (
    time            TIMESTAMPTZ     NOT NULL,
    site_id         INTEGER         NOT NULL,
    formula         TEXT            NOT NULL,  -- '3:2:1', '5:3:2', custom
    spread_value    DOUBLE PRECISION NOT NULL,
    unit            TEXT            DEFAULT '$/bbl',
    crude_price     DOUBLE PRECISION,
    gasoline_price  DOUBLE PRECISION,
    diesel_price    DOUBLE PRECISION
);

SELECT create_hypertable('crack_spreads', 'time',
    chunk_time_interval => INTERVAL '7 days'
);
```

### 2.3 Relational Schema

```sql
-- ============================================
-- CORE: Sites
-- ============================================
CREATE TABLE sites (
    id              SERIAL          PRIMARY KEY,
    name            TEXT            NOT NULL UNIQUE,
    display_name    TEXT            NOT NULL,
    region          TEXT,                          -- 'gulf_coast', 'midwest', etc.
    timezone        TEXT            DEFAULT 'America/Chicago',
    crude_capacity_bpd INTEGER,                   -- barrels per day
    config          JSONB           DEFAULT '{}',  -- site-specific settings
    created_at      TIMESTAMPTZ     DEFAULT now(),
    updated_at      TIMESTAMPTZ     DEFAULT now()
);

-- ============================================
-- CORE: Users
-- ============================================
CREATE TABLE users (
    id              SERIAL          PRIMARY KEY,
    site_id         INTEGER         REFERENCES sites(id),
    email           TEXT            NOT NULL UNIQUE,
    name            TEXT            NOT NULL,
    role            TEXT            NOT NULL,       -- 'shift_supervisor', 'process_engineer', 'lp_planner', 'manager', 'admin'
    delivery_channel TEXT           DEFAULT 'teams', -- 'teams', 'slack', 'email'
    channel_id      TEXT,                           -- Teams/Slack user/channel ID
    is_active       BOOLEAN         DEFAULT true,
    created_at      TIMESTAMPTZ     DEFAULT now()
);

-- ============================================
-- CORE: Tag Configuration
-- ============================================
CREATE TABLE tag_config (
    id              SERIAL          PRIMARY KEY,
    site_id         INTEGER         NOT NULL REFERENCES sites(id),
    tag_name        TEXT            NOT NULL,       -- 'TI-201.PV'
    display_name    TEXT,                           -- 'Reactor 201 Inlet Temp'
    unit            TEXT,                           -- 'degF', 'BPD', 'psig'
    process_unit    TEXT,                           -- 'Unit 2', 'CDU', 'FCC'
    tag_type        TEXT            DEFAULT 'process', -- 'process', 'safety', 'environmental'
    min_physical    DOUBLE PRECISION,               -- below = sensor failure
    max_physical    DOUBLE PRECISION,               -- above = sensor failure
    max_rate_of_change DOUBLE PRECISION,            -- per minute
    stale_threshold_sec INTEGER     DEFAULT 120,
    pi_webid        TEXT,                           -- cached PI Web API WebID
    is_active       BOOLEAN         DEFAULT true,
    created_at      TIMESTAMPTZ     DEFAULT now(),
    UNIQUE(site_id, tag_name)
);

-- ============================================
-- SENSOR HEALTH: Substitution Registry
-- ============================================
CREATE TABLE sensor_substitutions (
    id              SERIAL          PRIMARY KEY,
    site_id         INTEGER         NOT NULL REFERENCES sites(id),
    primary_tag     TEXT            NOT NULL,       -- the broken sensor
    substitute_tag  TEXT            NOT NULL,       -- the replacement
    reason          TEXT,                           -- 'fouled', 'offline', 'reading_erratic'
    activated_by    INTEGER         REFERENCES users(id),
    activated_at    TIMESTAMPTZ     DEFAULT now(),
    deactivated_at  TIMESTAMPTZ,                   -- NULL = still active
    impact_score    DOUBLE PRECISION,               -- estimated $ impact of using substitute
    UNIQUE(site_id, primary_tag, activated_at)
);

-- ============================================
-- OPERATING MODE: State Machine
-- ============================================
-- Addresses R9 (Alert Fatigue) — suppresses optimization triggers during non-normal modes
CREATE TABLE operating_modes (
    id              SERIAL          PRIMARY KEY,
    site_id         INTEGER         NOT NULL REFERENCES sites(id),
    mode            TEXT            NOT NULL,       -- 'normal', 'startup', 'shutdown', 'upset', 'turnaround', 'emergency'
    started_at      TIMESTAMPTZ     DEFAULT now(),
    ended_at        TIMESTAMPTZ,                   -- NULL = current mode
    set_by          INTEGER         REFERENCES users(id),
    set_method      TEXT            DEFAULT 'manual', -- 'manual', 'auto_detected'
    reason          TEXT
);

CREATE INDEX idx_operating_modes_current ON operating_modes (site_id, ended_at)
    WHERE ended_at IS NULL;

-- ============================================
-- TRIGGER ENGINE: Threshold Rules
-- ============================================
CREATE TABLE trigger_rules (
    id              SERIAL          PRIMARY KEY,
    site_id         INTEGER         NOT NULL REFERENCES sites(id),
    rule_name       TEXT            NOT NULL,
    rule_type       TEXT            NOT NULL,       -- 'process_drift', 'price_movement', 'sensor_health'
    tag_name        TEXT,                           -- for process triggers
    commodity       TEXT,                           -- for price triggers
    operator        TEXT            NOT NULL,       -- 'gt', 'lt', 'gte', 'lte', 'pct_change'
    threshold       DOUBLE PRECISION NOT NULL,
    hysteresis      DOUBLE PRECISION DEFAULT 0,    -- deadband for clearing
    debounce_sec    INTEGER         DEFAULT 60,    -- must persist for N seconds
    cooldown_sec    INTEGER         DEFAULT 300,   -- min time between alerts
    severity        TEXT            DEFAULT 'info', -- 'info', 'warning', 'critical'
    suppressed_modes TEXT[]         DEFAULT ARRAY['startup','shutdown','upset','turnaround','emergency'],
    is_active       BOOLEAN         DEFAULT true,
    created_at      TIMESTAMPTZ     DEFAULT now(),
    updated_at      TIMESTAMPTZ     DEFAULT now()
);

-- ============================================
-- LP MODEL: Configuration & Runs
-- ============================================
CREATE TABLE lp_models (
    id              SERIAL          PRIMARY KEY,
    site_id         INTEGER         NOT NULL REFERENCES sites(id),
    name            TEXT            NOT NULL,       -- 'CDU_Optimizer_v3.2'
    model_type      TEXT            NOT NULL,       -- 'excel_solver', 'pims', 'grtmps', 'pulp_highs'
    file_path       TEXT,                           -- path on Windows VM for Excel models
    input_mapping   JSONB           NOT NULL,       -- maps Reflex tags → Excel cells
    output_mapping  JSONB           NOT NULL,       -- maps Excel cells → Reflex outputs
    solve_trigger   JSONB,                          -- how to invoke Solver/macro
    version         TEXT,
    is_active       BOOLEAN         DEFAULT true,
    created_at      TIMESTAMPTZ     DEFAULT now(),
    updated_at      TIMESTAMPTZ     DEFAULT now()
);

-- Example input_mapping:
-- {
--   "tags": {
--     "TI-201.PV": {"cell": "B5", "sheet": "Inputs", "transform": null},
--     "FI-101.PV": {"cell": "B6", "sheet": "Inputs", "transform": "bpd_to_mbpd"}
--   },
--   "market": {
--     "WTI": {"cell": "C3", "sheet": "Pricing"},
--     "RBOB_GASOLINE": {"cell": "C4", "sheet": "Pricing"}
--   }
-- }

-- Example output_mapping:
-- {
--   "objective_value": {"cell": "F2", "sheet": "Results", "unit": "$/day"},
--   "product_yields": {
--     "naphtha": {"cell": "F5", "sheet": "Results", "unit": "%"},
--     "diesel":  {"cell": "F6", "sheet": "Results", "unit": "%"},
--     "jet":     {"cell": "F7", "sheet": "Results", "unit": "%"}
--   },
--   "unit_rates": {
--     "unit_2_feed": {"cell": "F10", "sheet": "Results", "unit": "BPD"},
--     "unit_3_feed": {"cell": "F11", "sheet": "Results", "unit": "BPD"}
--   }
-- }

CREATE TABLE lp_runs (
    id              SERIAL          PRIMARY KEY,
    site_id         INTEGER         NOT NULL REFERENCES sites(id),
    model_id        INTEGER         NOT NULL REFERENCES lp_models(id),
    triggered_at    TIMESTAMPTZ     DEFAULT now(),
    trigger_reason  TEXT            NOT NULL,       -- 'process_drift: TI-201 > 350F', 'price_movement: crack +$2.10'
    trigger_tags    TEXT[],                         -- which tags/prices triggered this
    status          TEXT            DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'coalesced'
    coalesced_count INTEGER         DEFAULT 1,     -- how many triggers were batched
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    duration_ms     INTEGER,
    input_snapshot  JSONB,                          -- exact values pushed to model
    output_snapshot JSONB,                          -- exact values extracted from model
    objective_value DOUBLE PRECISION,               -- $/day from LP solution
    solver_status   TEXT,                           -- 'optimal', 'infeasible', 'unbounded'
    error_message   TEXT,
    previous_run_id INTEGER         REFERENCES lp_runs(id)  -- for delta computation
);

CREATE INDEX idx_lp_runs_status ON lp_runs (site_id, status, triggered_at DESC);

-- ============================================
-- RECOMMENDATIONS
-- ============================================
CREATE TABLE recommendations (
    id              SERIAL          PRIMARY KEY,
    site_id         INTEGER         NOT NULL REFERENCES sites(id),
    lp_run_id       INTEGER         NOT NULL REFERENCES lp_runs(id),
    created_at      TIMESTAMPTZ     DEFAULT now(),
    -- Programmatically extracted deltas (R5 mitigation — numbers never touch LLM)
    deltas          JSONB           NOT NULL,
    -- {
    --   "trigger_summary": "Crack spread widened $1.80/bbl in 2 hours",
    --   "changes": [
    --     {"unit": "Unit 3", "variable": "naphtha_yield", "from": 22.0, "to": 30.0, "unit": "%"},
    --     {"unit": "Unit 4", "variable": "feed_rate", "from": 45000, "to": 48500, "unit": "BPD"}
    --   ],
    --   "margin_impact_daily": 44000,
    --   "margin_impact_unit": "$/day"
    -- }
    plain_english   TEXT            NOT NULL,       -- LLM-generated natural language
    llm_model       TEXT,                           -- 'claude-haiku-4-5', 'claude-sonnet-4-6'
    llm_validated   BOOLEAN         DEFAULT false,  -- cross-validation passed
    template_fallback BOOLEAN       DEFAULT false,  -- true if LLM was unavailable
    delivered_via   TEXT,                           -- 'teams', 'slack', 'email'
    delivered_at    TIMESTAMPTZ,
    delivered_to    INTEGER[]                       -- user IDs
);

-- ============================================
-- OPERATOR FEEDBACK: Constraint Registry
-- ============================================
-- Addresses R8 (no individual tracking) and R7 (full audit trail for MOC)
CREATE TABLE constraints (
    id              SERIAL          PRIMARY KEY,
    site_id         INTEGER         NOT NULL REFERENCES sites(id),
    recommendation_id INTEGER       REFERENCES recommendations(id),
    -- What
    equipment_id    TEXT,                           -- 'HX-201', 'P-101A'
    process_unit    TEXT,                           -- 'Unit 2', 'CDU'
    constraint_type TEXT            NOT NULL,       -- 'fouling', 'capacity_limit', 'maintenance', 'feed_quality', 'environmental', 'safety', 'turnaround', 'other'
    -- Quantitative (if extractable)
    is_quantifiable BOOLEAN         DEFAULT false,
    limit_value     DOUBLE PRECISION,               -- e.g., 80
    limit_unit      TEXT,                           -- '%', 'degF', 'BPD'
    limit_type      TEXT,                           -- 'max', 'min', 'fixed'
    lp_bound_applied BOOLEAN        DEFAULT false,  -- was this applied to LP model?
    -- Qualitative context
    description     TEXT,                           -- original operator message or structured input
    extraction_method TEXT          DEFAULT 'structured', -- 'structured', 'nlp_claude', 'manual'
    extraction_confidence DOUBLE PRECISION,
    -- Lifecycle
    status          TEXT            DEFAULT 'active', -- 'active', 'expired', 'cleared', 'superseded'
    created_at      TIMESTAMPTZ     DEFAULT now(),
    expires_at      TIMESTAMPTZ,                   -- auto-expire (e.g., +24 hours for temporary constraints)
    cleared_at      TIMESTAMPTZ,
    cleared_by      INTEGER         REFERENCES users(id),
    clear_reason    TEXT,
    -- Audit (R7: MOC traceability, R8: by equipment, not operator)
    source_channel  TEXT,                           -- 'teams_adaptive_card', 'slack_structured', 'api'
    shift           TEXT,                           -- 'day', 'night', 'swing'
    acknowledged_by INTEGER[]                       -- user IDs who saw this constraint
);

CREATE INDEX idx_constraints_active ON constraints (site_id, status, process_unit)
    WHERE status = 'active';
CREATE INDEX idx_constraints_equipment ON constraints (site_id, equipment_id, created_at DESC);

-- ============================================
-- OVERRIDES: Recommendation Responses
-- ============================================
-- Tracks what happened to each recommendation (R8: by equipment, not by operator)
CREATE TABLE overrides (
    id              SERIAL          PRIMARY KEY,
    recommendation_id INTEGER       NOT NULL REFERENCES recommendations(id),
    site_id         INTEGER         NOT NULL REFERENCES sites(id),
    action          TEXT            NOT NULL,       -- 'accepted', 'partially_accepted', 'rejected', 'no_response'
    constraint_id   INTEGER         REFERENCES constraints(id), -- if rejection created a constraint
    response_at     TIMESTAMPTZ     DEFAULT now(),
    response_latency_sec INTEGER,                  -- seconds from delivery to response
    -- Equipment-level tracking only (R8 mitigation)
    affected_units  TEXT[],                        -- which units were affected
    -- NO operator_id field — overrides are tracked by equipment, never by individual
    notes           TEXT
);

-- ============================================
-- OPPORTUNITY COST TRACKING
-- ============================================
-- Aggregated by equipment/unit, never by operator (R8 mitigation)
CREATE TABLE opportunity_costs (
    id              SERIAL          PRIMARY KEY,
    site_id         INTEGER         NOT NULL REFERENCES sites(id),
    recommendation_id INTEGER       NOT NULL REFERENCES recommendations(id),
    override_id     INTEGER         REFERENCES overrides(id),
    period_start    TIMESTAMPTZ     NOT NULL,
    period_end      TIMESTAMPTZ     NOT NULL,
    -- What the LP recommended vs. what actually happened
    recommended_margin DOUBLE PRECISION,            -- $/day from LP
    actual_margin   DOUBLE PRECISION,               -- $/day from actual production
    delta           DOUBLE PRECISION,               -- recommended - actual
    -- Attribution by equipment/unit (never by person)
    process_unit    TEXT,
    root_cause      TEXT,                           -- 'equipment_constraint', 'safety', 'maintenance', 'market_moved', 'no_response'
    constraint_id   INTEGER         REFERENCES constraints(id)
);

CREATE INDEX idx_opportunity_costs_period ON opportunity_costs (site_id, period_start DESC);

-- ============================================
-- COEFFICIENT RECONCILIATION
-- ============================================
CREATE TABLE coefficient_snapshots (
    id              SERIAL          PRIMARY KEY,
    site_id         INTEGER         NOT NULL REFERENCES sites(id),
    snapshot_at     TIMESTAMPTZ     DEFAULT now(),
    -- Predicted vs. actual yield comparison
    comparisons     JSONB           NOT NULL,
    -- {
    --   "naphtha": {"predicted_pct": 8.0, "actual_pct": 4.2, "deviation": -3.8, "periods_compared": 30},
    --   "diesel":  {"predicted_pct": 32.0, "actual_pct": 31.1, "deviation": -0.9, "periods_compared": 30},
    --   ...
    -- }
    flagged_coefficients JSONB,                     -- coefficients with deviation > threshold
    -- {
    --   "naphtha": {"severity": "high", "recommendation": "Reduce naphtha yield coefficient from 8.0% to 4.5%"}
    -- }
    methodology     TEXT            DEFAULT 'trailing_30day_average',
    reviewed_by     INTEGER         REFERENCES users(id),
    reviewed_at     TIMESTAMPTZ,
    applied_to_model BOOLEAN        DEFAULT false
);

-- ============================================
-- AUDIT LOG
-- ============================================
-- Complete audit trail for MOC compliance (R7)
CREATE TABLE audit_log (
    id              BIGSERIAL       PRIMARY KEY,
    site_id         INTEGER         NOT NULL REFERENCES sites(id),
    timestamp       TIMESTAMPTZ     DEFAULT now(),
    event_type      TEXT            NOT NULL,
    -- Event types: 'recommendation_generated', 'recommendation_delivered',
    -- 'constraint_created', 'constraint_cleared', 'constraint_expired',
    -- 'override_recorded', 'lp_run_started', 'lp_run_completed',
    -- 'mode_changed', 'sensor_substituted', 'coefficient_flagged',
    -- 'trigger_rule_updated', 'user_login', 'config_changed'
    entity_type     TEXT,                           -- 'recommendation', 'constraint', 'lp_run', etc.
    entity_id       INTEGER,
    details         JSONB,                          -- event-specific payload
    actor_type      TEXT            DEFAULT 'system', -- 'system', 'user', 'edge_agent'
    actor_id        INTEGER                         -- user ID if actor_type = 'user'
);

CREATE INDEX idx_audit_log_site_time ON audit_log (site_id, timestamp DESC);
CREATE INDEX idx_audit_log_entity ON audit_log (entity_type, entity_id);
```

---

## 3. Trigger Engine

### 3.1 Architecture

No external CEP engine (Flink, Esper) is needed. At ~200 rules evaluating ~100 sensor readings/second, a pure Python in-memory evaluator is sufficient. Rules are stored in PostgreSQL, loaded into memory on startup, and refreshed via LISTEN/NOTIFY when modified.

```
Sensor Data ──INSERT──▶ sensor_readings (TimescaleDB)
                              │
                        LISTEN/NOTIFY
                              │
                              ▼
                    Python Rule Evaluator
                    (in-memory, ~200 rules)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        Process Trigger  Price Trigger   Sensor Health
        (tag drift)      (spread move)   (quality fail)
              │               │               │
              └───────┬───────┘               │
                      ▼                       ▼
              Solve Queue                Alert Only
              (coalesce 30s)           (no LP solve)
                      │
                      ▼
                LP Solve Job
```

### 3.2 Trigger Types

**Process triggers** fire when a key sensor tag drifts outside its normal operating window:

```python
# Example rules (loaded from trigger_rules table)
{
    "rule_name": "Reactor_201_High_Temp",
    "rule_type": "process_drift",
    "tag_name": "TI-201.PV",
    "operator": "gt",
    "threshold": 350.0,        # degF
    "hysteresis": 5.0,         # clears at 345F (prevents flapping)
    "debounce_sec": 120,       # must be >350F for 2 full minutes
    "cooldown_sec": 600,       # max 1 alert per 10 minutes
    "suppressed_modes": ["startup", "shutdown", "upset", "turnaround", "emergency"]
}
```

**Price triggers** fire when crack spreads move materially. Per the Run 1 recommendation (R9), use percentage-based thresholds instead of fixed dollar amounts:

```python
{
    "rule_name": "Crack_Spread_Movement",
    "rule_type": "price_movement",
    "commodity": "crack_spread_321",
    "operator": "pct_change",
    "threshold": 10.0,         # 10% change from trailing 20-day average
    "debounce_sec": 300,       # sustained for 5 minutes
    "cooldown_sec": 3600,      # max 1 price trigger per hour
    "suppressed_modes": ["shutdown", "turnaround", "emergency"]
}
```

**Sensor health triggers** fire when the Data Quality Gateway detects failures, but these never trigger LP solves — they generate alerts only:

```python
{
    "rule_name": "Sensor_201_Health",
    "rule_type": "sensor_health",
    "tag_name": "TI-201.PV",
    "operator": "quality_neq",
    "threshold": 0,            # anything other than GOOD quality
    "debounce_sec": 60,
    "cooldown_sec": 1800       # max 1 health alert per 30 minutes
}
```

### 3.3 Industrial Alerting Patterns

Three patterns prevent false positives and alert fatigue:

1. **Hysteresis (deadband):** Different thresholds for triggering vs. clearing. If alarm triggers at 350°F, it clears at 345°F (not 350°F). Prevents rapid on/off cycling when a value oscillates near the setpoint. Borrowed from Schmitt trigger design in electronics.

2. **Debounce timer:** Violation must persist for N seconds before firing. Filters out transient sensor spikes that self-correct. A 2-minute debounce eliminates most false positives from process noise.

3. **Cooldown period:** After an alert fires, suppress re-alerting for N minutes. Operators see one actionable alert, not 50 repetitions. Target: 1-2 recommendations per shift during normal operations (per R9).

### 3.4 Operating Mode Detection (R9 Mitigation)

Operating mode is a first-class system concept. All optimization triggers are automatically suppressed during non-normal modes. Safety alerts remain active regardless of mode.

| Mode | Optimization Triggers | Safety Alerts | Set By |
|------|----------------------|---------------|--------|
| Normal | Active | Active | Auto-detect or manual |
| Startup | **Suppressed** | Active | Manual (shift supervisor) |
| Shutdown | **Suppressed** | Active | Manual (shift supervisor) |
| Upset | **Suppressed** | Active | Auto-detect (multiple simultaneous alarms) |
| Turnaround | **Suppressed** | Active | Manual (planned weeks ahead) |
| Emergency | **Suppressed** | Active | Auto-detect or manual |

Auto-detection heuristic: If >30% of monitored tags change by >2 standard deviations within 5 minutes, auto-transition to "upset" mode. Require manual confirmation to return to "normal."

### 3.5 Trigger Configuration Schema

Trigger rules are stored in the `trigger_rules` table (defined in Section 2.3) and loaded into memory at startup. When an admin modifies a rule via the dashboard:

1. Rule is updated in PostgreSQL
2. PostgreSQL fires `NOTIFY trigger_rules_changed`
3. Python evaluator receives notification and reloads rules from database

This avoids polling and ensures rule changes take effect within seconds.

---

## 4. Excel Integration Layer

### 4.1 Short-Term: COM Automation (safexl + pywin32)

Microsoft explicitly does not support server-side Excel automation. Documented failure modes include modal dialog hangs, zombie processes, memory leaks, and deadlocks. Despite this, COM automation is the only path that supports real customer LP models with Solver + VBA + COM add-ins.

**Mitigation strategy:**

| Risk | Mitigation |
|------|-----------|
| Zombie Excel processes | safexl context manager guarantees cleanup |
| Modal dialog hangs | `DisplayAlerts = False`, `ScreenUpdating = False` |
| Memory leaks | Use `DispatchEx` for isolated instances; restart process after every N solves |
| Deadlocks | Run Excel in a separate `multiprocessing.Process` with timeout; kill process on hang |
| 32-bit Excel (2GB RAM limit) | Require 64-bit Excel on solver VMs |

**Solver invocation sequence:**

```python
from safexl import application

async def run_lp_solve(model_path: str, inputs: dict, input_mapping: dict, output_mapping: dict) -> dict:
    """Execute LP solve in Excel. Runs in a separate process for isolation."""

    with application(kill_after=True, maximize=False) as app:
        app.ScreenUpdating = False
        app.DisplayAlerts = False
        app.Calculation = -4135  # xlCalculationManual

        wb = app.Workbooks.Open(model_path)

        # Step 1: Write inputs to mapped cells
        for tag, value in inputs.items():
            mapping = input_mapping["tags"].get(tag)
            if mapping:
                sheet = wb.Sheets(mapping["sheet"])
                sheet.Range(mapping["cell"]).Value = value

        # Step 2: Write market prices
        for commodity, value in inputs.get("market", {}).items():
            mapping = input_mapping["market"].get(commodity)
            if mapping:
                sheet = wb.Sheets(mapping["sheet"])
                sheet.Range(mapping["cell"]).Value = value

        # Step 3: Recalculate
        app.Calculation = -4105  # xlCalculationAutomatic
        app.CalculateFullRebuild()

        # Step 4: Run Solver
        app.Run("SolverSolve", True)  # True = don't show dialog

        # Step 5: Extract outputs
        results = {}
        for key, mapping in output_mapping.items():
            if isinstance(mapping, dict) and "cell" in mapping:
                sheet = wb.Sheets(mapping["sheet"])
                results[key] = sheet.Range(mapping["cell"]).Value
            elif isinstance(mapping, dict):
                results[key] = {}
                for sub_key, sub_mapping in mapping.items():
                    sheet = wb.Sheets(sub_mapping["sheet"])
                    results[key][sub_key] = sheet.Range(sub_mapping["cell"]).Value

        wb.Close(SaveChanges=False)
        return results
```

### 4.2 Long-Term: PuLP + HiGHS

The strategic escape hatch from Excel is translating customer LP models into PuLP (modeling API) + HiGHS (solver engine). This is offered as a professional service during onboarding.

| Factor | Excel COM | PuLP + HiGHS |
|--------|-----------|-------------|
| Reliability | Unsupported by Microsoft, fragile | Production-grade, MIT licensed |
| Performance | 30s-7min per solve | Sub-second for most LP models |
| Concurrency | Single-threaded per Excel process | Multi-threaded, parallelizable |
| Platform | Windows only | Cross-platform (Linux, macOS, Windows) |
| Cost | Requires Excel license + Windows VM | Free |
| Customer effort | Zero (use existing model) | Requires model translation (professional service) |

### 4.3 Data Contract (Input/Output Mapping)

The `lp_models` table stores the mapping between Reflex data and Excel cells as JSONB. This mapping is configured during site onboarding — Reflex staff work with the LP planner to identify:

1. **Input cells:** Which cells receive live sensor values and market prices
2. **Output cells:** Which cells contain the optimized results (yields, rates, margins)
3. **Solve trigger:** How to invoke the solver (VBA macro name, Solver API call, or recalculation)
4. **Constraints sheet:** Where to apply operator-submitted constraints as additional bounds

The mapping is version-controlled — every change creates a new version with a diff log in the audit table.

### 4.4 Solve Queue with Coalescing

Multiple threshold violations may fire within seconds. The solve queue coalesces them into a single LP solve:

```
Trigger A (t=0s) ──┐
Trigger B (t=5s) ──┤──▶ [30-second coalesce window] ──▶ Single LP Solve
Trigger C (t=12s) ─┘    (reasons merged, tags merged)    (captures all 3 triggers)
```

Implementation uses the `solve_queue` table (defined in `lp_runs`) with `FOR UPDATE SKIP LOCKED` to safely claim jobs. If a solve is already running when a new trigger fires, the new trigger queues behind it.

**Backpressure rule:** If solve time consistently exceeds trigger interval, automatically widen the coalesce window and log a warning. At 2-5 solves/day expected volume, this is unlikely to be an issue.

---

## 5. Feedback Processing Pipeline

### 5.1 Constraint Capture (Two Paths)

**Path 1: Structured Input (Primary — R2, R5 mitigation)**

Replace free-text Slack/Teams messages with structured Adaptive Cards:

```
┌─────────────────────────────────────────────┐
│  REFLEX: New Recommendation for Unit 2      │
│                                             │
│  "Crack spread widened $1.80/bbl.           │
│   Increase naphtha yield 8% on Units 3&4.  │
│   Estimated impact: +$44,000/day"           │
│                                             │
│  [✓ Accept]  [✗ Can't Do This]  [⏰ Later]  │
└─────────────────────────────────────────────┘

         ▼ (if "Can't Do This")

┌─────────────────────────────────────────────┐
│  What's preventing this?                    │
│                                             │
│  Unit:  [▼ Unit 2 / Unit 3 / Unit 4 / ...] │
│                                             │
│  Reason: [▼ Equipment Fouling              ]│
│          [  Capacity Limit                 ]│
│          [  Safety Concern                 ]│
│          [  Maintenance Planned            ]│
│          [  Feed Quality Issue             ]│
│          [  Other                          ]│
│                                             │
│  Equipment: [HX-201________]  (optional)    │
│                                             │
│  How much can you do?                       │
│  [● 0%] [● 25%] [● 50%] [● 75%] [● Other] │
│                                             │
│  Note: [________________________] (optional)│
│                                             │
│  [Submit Constraint]                        │
└─────────────────────────────────────────────┘
```

This works with chemical-resistant gloves (large tap targets), requires zero typing, and produces 100% structured data — eliminating the 15-54% NLP extraction error rate.

**Path 2: NLP Extraction (Fallback for free-text messages)**

When operators do send free-text messages (via Slack, Teams, or voice-to-text), Claude API with tool calling extracts structured constraints:

```python
tools = [{
    "name": "extract_constraint",
    "description": "Extract operational constraint from operator message",
    "input_schema": {
        "type": "object",
        "properties": {
            "equipment_id":    {"type": "string", "description": "Equipment tag (HX-201, P-101A)"},
            "constraint_type": {"type": "string", "enum": ["fouling","capacity_limit","maintenance","feed_quality","environmental","safety","other"]},
            "affected_unit":   {"type": "string", "description": "Process unit (Unit 2, CDU, FCC)"},
            "limit_value":     {"type": "number", "description": "Numerical limit if specified"},
            "limit_unit":      {"type": "string", "description": "Unit (%, degF, BPD)"},
            "limit_type":      {"type": "string", "enum": ["max","min","fixed","unknown"]},
            "severity":        {"type": "string", "enum": ["hard","soft","advisory"]},
            "confidence":      {"type": "number", "description": "Extraction confidence 0-1"}
        },
        "required": ["equipment_id", "constraint_type", "severity"]
    }
}]
```

**Critical rule (R5 mitigation):** NLP-extracted constraints are NEVER auto-applied. The system always presents its interpretation back with structured options for confirmation:

```
┌─────────────────────────────────────────────┐
│  I understood: "HX-201 is fouling"          │
│                                             │
│  Interpreted as:                            │
│  Equipment: HX-201 (Heat Exchanger 201)     │
│  Constraint: Reduce max throughput          │
│  On: Unit 2                                 │
│                                             │
│  By how much?                               │
│  [5%] [10%] [15%] [20%] [Other]             │
│                                             │
│  [✓ Apply] [✗ Not What I Meant]             │
└─────────────────────────────────────────────┘
```

### 5.2 Constraint Lifecycle

```
Created ──▶ Active ──┬──▶ Cleared (by operator/supervisor)
                     ├──▶ Expired (auto-expire after TTL)
                     └──▶ Superseded (new constraint replaces it)
```

- **Active** constraints are applied as bounds in LP solves. The LP model never recommends a move that conflicts with an active constraint.
- **Expired** constraints auto-clear after a configurable TTL (default: 24 hours for temporary constraints, no expiry for equipment issues).
- **Cleared** constraints require explicit action by a supervisor. The clearing is logged in the audit trail (R7 MOC compliance).

### 5.3 Re-Solve Workflow

When a quantifiable constraint is received (e.g., "cap Unit 2 feed at 80%"):

1. Constraint is stored in the `constraints` table with `is_quantifiable = true`
2. Constraint is formatted as an LP bound (e.g., `unit_2_feed <= 0.80 * max_capacity`)
3. A new solve is triggered with the constraint applied
4. LP runs with the additional bound
5. Revised recommendation is generated: "With Unit 2 capped at 80%, revised recommendation: increase diesel on Unit 6. Revised margin: +$11,200/day"
6. Revised recommendation is delivered to the same operator/supervisor

---

## 6. Complete Data Model

### 6.1 Entity-Relationship Diagram

```
                                    ┌──────────────┐
                                    │    sites     │
                                    │──────────────│
                                    │ id (PK)      │
                                    │ name         │
                                    │ display_name │
                                    │ region       │
                                    │ timezone     │
                                    │ crude_cap    │
                                    │ config (JSON)│
                                    └──────┬───────┘
                                           │
              ┌────────────┬───────────┬───┴───┬──────────┬─────────────┬──────────────┐
              │            │           │       │          │             │              │
              ▼            ▼           ▼       ▼          ▼             ▼              ▼
        ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌───────────┐ ┌────────────┐ ┌───────────────┐
        │  users   │ │tag_config│ │lp_model│ │trigger │ │operating  │ │sensor_sub  │ │ audit_log     │
        │──────────│ │──────────│ │────────│ │_rules  │ │_modes     │ │stitutions  │ │───────────────│
        │ id (PK)  │ │ id (PK)  │ │ id (PK)│ │────────│ │───────────│ │────────────│ │ id (PK)       │
        │ site_id  │ │ site_id  │ │ site_id│ │ id (PK)│ │ id (PK)   │ │ id (PK)    │ │ site_id (FK)  │
        │ email    │ │ tag_name │ │ name   │ │ site_id│ │ site_id   │ │ site_id    │ │ timestamp     │
        │ name     │ │ display  │ │ type   │ │ rule_  │ │ mode      │ │ primary_   │ │ event_type    │
        │ role     │ │ unit     │ │ input_ │ │   name │ │ started_at│ │   tag      │ │ entity_type   │
        │ channel  │ │ min/max  │ │ mapping│ │ tag/   │ │ ended_at  │ │ substitute │ │ entity_id     │
        │ channel_ │ │ rate_chg │ │ output_│ │ commod │ │ set_by    │ │   _tag     │ │ details (JSON)│
        │   id     │ │ stale_th │ │ mapping│ │ thresh │ │ set_method│ │ reason     │ │ actor_type    │
        └──────────┘ │ pi_webid │ │ solve_ │ │ hyster │ │ reason    │ │ activated_ │ │ actor_id      │
                     └──────────┘ │ trigger│ │ deboun │ └───────────┘ │   by (FK)  │ └───────────────┘
                                  └───┬────┘ │ cooldwn│               │ impact_    │
                                      │      │ suppres│               │   score    │
                                      │      │ _modes │               └────────────┘
                                      │      └────────┘
                                      │
                                      ▼
                                ┌──────────────┐
                                │   lp_runs    │
                                │──────────────│
                                │ id (PK)      │
                                │ site_id (FK) │
                                │ model_id (FK)│
                                │ trigger_reas │
                                │ status       │
                                │ coalesced_cnt│
                                │ input_snap   │
                                │ output_snap  │
                                │ objective_val│
                                │ solver_status│
                                │ prev_run (FK)│
                                └──────┬───────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │ recommendations  │
                              │─────────────────│
                              │ id (PK)          │
                              │ site_id (FK)     │
                              │ lp_run_id (FK)   │
                              │ deltas (JSON)    │
                              │ plain_english    │
                              │ llm_model        │
                              │ llm_validated    │
                              │ template_fallback│
                              │ delivered_via    │
                              │ delivered_to[]   │
                              └──────┬───────────┘
                                     │
                        ┌────────────┴────────────┐
                        ▼                         ▼
                 ┌────────────┐           ┌──────────────┐
                 │ overrides  │           │ constraints  │
                 │────────────│           │──────────────│
                 │ id (PK)    │           │ id (PK)      │
                 │ rec_id (FK)│◀──────── │ rec_id (FK)  │
                 │ site_id    │           │ site_id (FK) │
                 │ action     │           │ equipment_id │
                 │ constraint │───────▶  │ process_unit │
                 │   _id (FK) │           │ type         │
                 │ affected_  │           │ is_quantifia │
                 │   units[]  │           │ limit_value  │
                 │ response_at│           │ status       │
                 │ notes      │           │ expires_at   │
                 └────────────┘           │ cleared_by   │
                        │                 └──────────────┘
                        ▼                         │
                ┌─────────────────┐               │
                │opportunity_costs│               │
                │─────────────────│               │
                │ id (PK)         │               │
                │ site_id (FK)    │               │
                │ rec_id (FK)     │               │
                │ override_id(FK) │               │
                │ recommended_    │               │
                │   margin        │               │
                │ actual_margin   │◀──────────────┘
                │ delta           │  (root cause
                │ process_unit    │   constraint)
                │ root_cause      │
                │ constraint_id   │
                └─────────────────┘

        TIME-SERIES (TimescaleDB Hypertables)
        ┌─────────────────┐  ┌───────────────┐  ┌───────────────┐
        │ sensor_readings │  │ market_prices │  │ crack_spreads │
        │─────────────────│  │───────────────│  │───────────────│
        │ time            │  │ time          │  │ time          │
        │ site_id         │  │ source        │  │ site_id       │
        │ tag_name        │  │ commodity     │  │ formula       │
        │ value           │  │ price         │  │ spread_value  │
        │ quality         │  │ unit          │  │ crude_price   │
        └─────────────────┘  └───────────────┘  │ gasoline_price│
              │                                  │ diesel_price  │
              ▼                                  └───────────────┘
        ┌─────────────────┐
        │ sensor_5min     │  (Continuous Aggregate)
        │─────────────────│
        │ bucket (5min)   │
        │ site_id         │
        │ tag_name        │
        │ avg/min/max/last│
        │ sample_count    │
        └─────────────────┘

        RECONCILIATION
        ┌──────────────────────┐
        │coefficient_snapshots │
        │──────────────────────│
        │ id (PK)              │
        │ site_id (FK)         │
        │ snapshot_at          │
        │ comparisons (JSON)   │
        │ flagged_coeff (JSON) │
        │ reviewed_by (FK)     │
        │ applied_to_model     │
        └──────────────────────┘
```

### 6.2 Table Summary

| Table | Type | Purpose | Est. Rows/Site/Year |
|-------|------|---------|-------------------|
| `sensor_readings` | Hypertable | Raw sensor values from historian | ~5M (at 1-min intervals) |
| `sensor_5min` | Continuous Aggregate | 5-minute rollups for dashboards | ~1M |
| `market_prices` | Hypertable | Commodity spot prices | ~10K |
| `crack_spreads` | Hypertable | Computed crack spreads | ~10K |
| `sites` | Relational | Site configuration | 1-5 |
| `users` | Relational | User accounts and delivery preferences | 20-50 |
| `tag_config` | Relational | Per-tag quality rules and PI WebIDs | 100-200 |
| `trigger_rules` | Relational | Threshold rules for process/price triggers | 100-300 |
| `operating_modes` | Relational | Operating mode state machine history | ~200 |
| `lp_models` | Relational | LP model config and cell mappings | 1-3 per site |
| `lp_runs` | Relational | LP solve execution history | 500-2,000 |
| `recommendations` | Relational | Generated recommendations with deltas | 500-2,000 |
| `constraints` | Relational | Operator feedback constraint registry | 500-5,000 |
| `overrides` | Relational | Recommendation response tracking | 500-2,000 |
| `opportunity_costs` | Relational | Value captured/lost by equipment | 500-2,000 |
| `sensor_substitutions` | Relational | Broken sensor → substitute tag mapping | 10-50 |
| `coefficient_snapshots` | Relational | Predicted vs. actual yield comparisons | 12-52 |
| `audit_log` | Relational | Complete MOC-ready audit trail | 10K-50K |

### 6.3 Key Indexes

```sql
-- Time-series queries (most frequent)
CREATE INDEX idx_sensor_readings_tag       ON sensor_readings (site_id, tag_name, time DESC);
CREATE INDEX idx_market_prices_commodity   ON market_prices (commodity, time DESC);

-- Active constraint lookup (every LP solve checks these)
CREATE INDEX idx_constraints_active        ON constraints (site_id, status, process_unit)
    WHERE status = 'active';

-- Equipment-level analytics (constraint pattern analysis)
CREATE INDEX idx_constraints_equipment     ON constraints (site_id, equipment_id, created_at DESC);

-- Current operating mode (every trigger evaluation checks this)
CREATE INDEX idx_operating_modes_current   ON operating_modes (site_id, ended_at)
    WHERE ended_at IS NULL;

-- Solve queue processing
CREATE INDEX idx_lp_runs_status            ON lp_runs (site_id, status, triggered_at DESC);

-- Audit trail queries
CREATE INDEX idx_audit_log_site_time       ON audit_log (site_id, timestamp DESC);
CREATE INDEX idx_audit_log_entity          ON audit_log (entity_type, entity_id);

-- Opportunity cost dashboard (30/90-day rollups)
CREATE INDEX idx_opportunity_costs_period  ON opportunity_costs (site_id, period_start DESC);
```

---

## 7. Data Flow Verification

Cross-referencing the 9 data flows from the prompt against the architecture:

| # | Data Flow | Ingestion | Storage | Processing |
|---|-----------|-----------|---------|-----------|
| 1 | Historian → Reflex | Edge agent → PI Web API StreamSets | `sensor_readings` hypertable | Data Quality Gateway validates |
| 2 | Market data → Reflex | EIA API / OilPriceAPI / customer CSV | `market_prices` + `crack_spreads` hypertables | Crack spread computed on ingest |
| 3 | Reflex → Excel LP | `lp_models.input_mapping` drives cell writes | `lp_runs.input_snapshot` captures exact inputs | safexl + pywin32 COM automation |
| 4 | LP output → Claude | `lp_runs.output_snapshot` + delta computation | `recommendations.deltas` (numbers) + `plain_english` (LLM) | Deterministic number extraction → Claude formats |
| 5 | Recommendation → Slack/Teams | `recommendations.delivered_via` | `recommendations.delivered_at/to` | Azure Bot Service Adaptive Cards |
| 6 | Operator feedback → Constraints | Structured cards or NLP extraction | `constraints` table (equipment-level) | Lifecycle: active → cleared/expired |
| 7 | Actual vs predicted → Reconciliation | `sensor_readings` JOIN `lp_runs.output_snapshot` | `coefficient_snapshots` with deviation analysis | Trailing 30-day average comparison |
| 8 | Sensor health → Substitution | Data Quality Gateway flags | `sensor_substitutions` registry | Auto-substitute when configured |
| 9 | All overrides → Opportunity Cost | `overrides` tracks every response | `opportunity_costs` by equipment/unit | Rolling 30/90-day dashboard |

---

## 8. Risk Mitigation Verification

| Risk | Score | How This Architecture Addresses It |
|------|-------|------------------------------------|
| **R1** (Excel COM) | 125 | safexl + DispatchEx with process isolation, watchdog, queue backpressure. Strategic migration path to PuLP + HiGHS. |
| **R2** (Delivery channel) | 125 | Structured Adaptive Cards for shift supervisors (not field operators). 5-tap input works with gloves. Email fallback. |
| **R5** (LLM hallucination) | 80 | Numbers programmatically extracted from LP output, stored in `recommendations.deltas`. Claude only formats natural language. Cross-validation on every output. Template fallback if API fails. NLP-extracted constraints never auto-applied. |
| **R6** (OT security) | 80 | Edge agent in DMZ reads PI Web API over HTTPS. All traffic outbound only. Read-only historian access. Never writes to OT systems. |
| **R7** (OSHA PSM/MOC) | 80 | Complete `audit_log` table captures every recommendation, override, constraint change, and mode transition with timestamps and actor IDs. Designed for MOC documentation. |
| **R8** (Union/dashboard blame) | 64 | `overrides` and `opportunity_costs` tracked by equipment/unit, never by individual operator. "Value captured" framing. Separate management vs. operator views. |
| **R9** (Alert fatigue) | 64 | `operating_modes` as first-class concept. All optimization triggers suppressed during non-normal modes. Hysteresis + debounce + cooldown on all rules. Target: 1-2 recommendations per shift. Percentage-based price triggers. |
| **R11** (Sensor glitches) | 48 | Data Quality Gateway checks every reading: staleness, range, rate-of-change, digital states, compression artifacts. Quality flag stored with every reading. |
| **R13** (Historian compression) | 36 | Compression artifact detection in Data Quality Gateway. Use interpolated data mode for consistency. Flag suspiciously flat readings. |

---

## 9. Technology Summary

| Layer | Technology | License | Cost |
|-------|-----------|---------|------|
| **Edge agent** | Python 3.12 + Docker | MIT/Apache | Free |
| **Historian access** | PI Web API (REST) | Included with PI | Free |
| **Store-and-forward** | SQLite (in edge agent) | Public domain | Free |
| **Database** | PostgreSQL 16 + TimescaleDB | Apache 2.0 | $20-50/mo managed |
| **Market data (daily)** | EIA Open Data API v2 | US Government | Free |
| **Market data (intra-day)** | OilPriceAPI | Commercial | $0-15/mo |
| **Trigger engine** | Python in-memory evaluator | — | Free |
| **Event queue** | PostgreSQL LISTEN/NOTIFY | — | Free (same DB) |
| **NLP extraction** | Claude API tool calling | Commercial | <$0.01/day |
| **LLM translation** | Claude API (Haiku/Sonnet) | Commercial | $7-18/mo/site |
| **Excel automation** | safexl + pywin32 | BSD/PSF | Free (needs Excel license) |
| **LP solver (future)** | PuLP + HiGHS | BSD/MIT | Free |

**Total infrastructure cost: $27-83/month per site**

---

## Sources

### Historian & Edge Architecture
- [PI Web API Reference — AVEVA](https://docs.aveva.com/bundle/pi-web-api-reference/page/help.html)
- [PI Web API Authentication Methods — AVEVA](https://docs.aveva.com/bundle/pi-web-api/page/1023024.html)
- [PI Web API Performance Boost — Cuurios](https://www.cuurios.com/blog/how-to-achieve-a-performance-boost-with-the-pi-web-api)
- [PI Web API Batch Support — AVEVA](https://docs.aveva.com/bundle/pi-web-api/page/1023110.html)
- [PI System DMZ Architecture — ITI Group](https://www.itigroup.com/pi-system-blog-building-compliant-ot-architecture-with-modern-components/)
- [asyncua on PyPI](https://pypi.org/project/asyncua/)
- [node-opcua on npm](https://www.npmjs.com/package/node-opcua)
- [Litmus Edge + AVEVA PI Integration](https://litmus.io/blog/empower-your-industrial-data-strategy-integrate-litmus-edge-with-aveva-pi)
- [Cisco Industrial DMZ White Paper](https://www.cisco.com/c/en/us/solutions/collateral/internet-of-things/idmz-hybrid-cloud-arch-wp.html)

### Market Data
- [EIA Open Data API v2](https://www.eia.gov/opendata/)
- [EIA Petroleum Spot Prices](https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm)
- [OilPriceAPI Documentation](https://docs.oilpriceapi.com/)
- [S&P Global Platts Developer Portal](https://developer.spglobal.com/)

### Time-Series Databases
- [TimescaleDB on GitHub](https://github.com/timescale/timescaledb)
- [TimescaleDB Hypertable Optimization](https://www.youngju.dev/blog/database/2026-03-07-database-timescaledb-time-series-hypertable-optimization.en)
- [QuestDB vs InfluxDB vs TimescaleDB](https://questdb.com/blog/comparing-influxdb-timescaledb-questdb-time-series-databases/)
- [ClickHouse vs TimescaleDB vs InfluxDB Benchmarks](https://sanj.dev/post/clickhouse-timescaledb-influxdb-time-series-comparison)

### Excel Automation & LP Solvers
- [Microsoft — Unattended Office Automation](https://learn.microsoft.com/en-us/office/client-developer/integration/considerations-unattended-automation-office-microsoft-365-for-unattended-rpa)
- [safexl on PyPI](https://pypi.org/project/safexl/)
- [HiGHS LP Solver](https://highs.dev/)
- [PuLP on PyPI](https://pypi.org/project/PuLP/)
- [PuLP vs Pyomo vs OR-Tools for Crude Oil Blending](https://medium.com/@kyle-t-jones/comparing-pyomo-pulp-and-or-tools-for-constrained-optimization-problems-to-find-optimal-crude-oil-385ad1931694)

### Trigger Engines & Event Architecture
- [Debounce Algorithms in IoT](https://nostdahl.com/2019/08/28/debounce-algorithms-in-iot/)
- [PGQueuer — PostgreSQL Job Queue](https://github.com/janbjorge/pgqueuer)
- [PostgreSQL LISTEN/NOTIFY with asyncio](https://gist.github.com/kissgyorgy/beccba1291de962702ea9c237a900c79)

### NLP & Claude API
- [Claude Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Claude Tool Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)

---

*This document should be revisited after the LP tool landscape survey (R3 validation) and first design partner engagement. If most target customers use PIMS/GRTMPS rather than Excel Solver, the Excel automation sections (4.1, 4.3) will need to be rearchitected, but the rest of the data architecture remains valid.*

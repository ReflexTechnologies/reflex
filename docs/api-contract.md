# Reflex Platform -- Complete API Contract

> **Version:** 1.0.0-draft
> **Date:** 2026-03-27
> **Status:** Pre-implementation design
> **Audience:** Engineering team, design partners, security reviewers

---

## Table of Contents

1. [Conventions and Standards](#1-conventions-and-standards)
2. [Edge Agent to Cloud API](#2-edge-agent-to-cloud-api)
3. [Dashboard REST API](#3-dashboard-rest-api)
4. [WebSocket API](#4-websocket-api)
5. [Slack/Teams Webhook and Interaction API](#5-slackteams-webhook-and-interaction-api)
6. [Internal Service APIs](#6-internal-service-apis)

---

## 1. Conventions and Standards

### 1.1 Base URL

```
Production:  https://api.reflexoptimize.com/v1
Staging:     https://api.staging.reflexoptimize.com/v1
```

API version is embedded in the URL path. Breaking changes increment the major version (`/v2`). Non-breaking additions (new optional fields, new endpoints) do not require a version bump.

### 1.2 Authentication Schemes

| Scheme | Used By | Mechanism |
|--------|---------|-----------|
| `edge-api-key` | Edge Agent | `X-API-Key` header. One key per edge agent. Key is a 256-bit random token stored as SHA-256 hash server-side. Optional mTLS overlay where customer's OT security policy requires certificate-based auth. |
| `jwt-bearer` | Dashboard users, service accounts | `Authorization: Bearer <token>` header. JWT issued by Reflex auth service. Contains `sub` (user ID), `site_ids` (array), `role`, `exp`. RS256 signed. 15-minute access token + 7-day refresh token. |
| `hmac-signature` | Slack/Teams webhooks | Platform-specific signature verification. Slack: `X-Slack-Signature` with HMAC-SHA256 of request body using signing secret. Teams: JWT in `Authorization` header validated against Microsoft public keys. |
| `service-token` | Internal service-to-service | `Authorization: Bearer <token>` with short-lived JWT (5-minute expiry) issued by internal auth. Audience claim (`aud`) scoped to target service. |

### 1.3 Multi-Tenancy

Every resource belongs to a `site_id`. Tenant isolation is enforced at three levels:

1. **Path parameter**: Most endpoints include `/sites/{site_id}/` in the path.
2. **JWT claim**: The `site_ids` array in the JWT limits which sites a user can access. Requests to a site not in the claim return `403`.
3. **Database**: All queries include a `site_id` predicate. No cross-site queries exist except for admin endpoints scoped to `role: platform_admin`.

### 1.4 Role-Based Access Control

| Role | Scope | Permissions |
|------|-------|-------------|
| `platform_admin` | All sites | Full CRUD on all resources, user management, API key management |
| `site_admin` | Assigned sites | Site configuration, user assignment, trigger config, constraint management |
| `lp_planner` | Assigned sites | View/edit recommendations, constraints, coefficient reconciliation, full analytics |
| `shift_supervisor` | Assigned sites | View recommendations, submit structured feedback, view constraint registry |
| `operator` | Assigned sites | View recommendations, submit structured feedback (limited) |
| `viewer` | Assigned sites | Read-only access to dashboards and analytics |

### 1.5 Pagination

**Cursor-based** (default for time-series, audit logs, recommendations):

```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJjcmVhdGVkX2F0IjoiMjAyNi0wMy0yN1QxMDowMDowMFoiLCJpZCI6ImFiYzEyMyJ9",
    "has_more": true,
    "limit": 50
  }
}
```

Query parameters: `?limit=50&cursor=<opaque_string>`

**Offset-based** (for small, bounded collections like sites, equipment, users):

```json
{
  "data": [...],
  "pagination": {
    "total": 42,
    "offset": 0,
    "limit": 25
  }
}
```

Query parameters: `?limit=25&offset=0`

### 1.6 Error Format (RFC 7807)

All errors return a consistent Problem Details envelope:

```json
{
  "type": "https://api.reflexoptimize.com/errors/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "Field 'cooldown_minutes' must be a positive integer.",
  "instance": "/v1/sites/site_abc/triggers/trg_001",
  "errors": [
    {
      "field": "cooldown_minutes",
      "code": "invalid_type",
      "message": "Expected positive integer, got string"
    }
  ],
  "request_id": "req_7f3a2b1c"
}
```

Standard HTTP status codes: `200` OK, `201` Created, `204` No Content, `400` Bad Request, `401` Unauthorized, `403` Forbidden, `404` Not Found, `409` Conflict, `422` Unprocessable Entity, `429` Too Many Requests, `500` Internal Server Error, `503` Service Unavailable.

### 1.7 Rate Limiting

Rate limits are returned in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 97
X-RateLimit-Reset: 1711540800
Retry-After: 30
```

| Tier | Limit | Applied To |
|------|-------|-----------|
| `edge-ingest` | 60 requests/minute per agent | Edge agent data ingestion |
| `edge-config` | 10 requests/minute per agent | Edge agent config sync, heartbeat |
| `dashboard-read` | 120 requests/minute per user | Dashboard GET requests |
| `dashboard-write` | 30 requests/minute per user | Dashboard POST/PUT/DELETE |
| `webhook` | 100 requests/minute per workspace | Slack/Teams incoming webhooks |
| `admin` | 30 requests/minute per user | Admin endpoints |

When a client exceeds the limit, the API returns `429 Too Many Requests` with `Retry-After` header.

### 1.8 Common Types

```
Timestamp:    ISO 8601 string, always UTC.  "2026-03-27T14:30:00Z"
ID:           Prefixed string.  "site_abc123", "rec_def456", "con_ghi789"
Money:        Object with cents integer + currency.  {"cents": 4400000, "currency": "USD"}
Duration:     ISO 8601 duration.  "PT30M" (30 minutes), "P7D" (7 days)
```

---

## 2. Edge Agent to Cloud API

The Edge Agent is a lightweight process deployed in the customer's DMZ (Purdue Level 3.5). It reads from historian replicas via PI Web API or OPC-UA and pushes data outbound over HTTPS. It never accepts inbound connections. All communication is agent-initiated.

**Base path:** `/v1/edge`
**Auth:** `edge-api-key` (required). mTLS overlay (optional, recommended).

---

### 2.1 POST /v1/edge/ingest

Batch upload of sensor readings from the historian. The edge agent buffers readings locally and pushes in batches (every 10-60 seconds depending on configuration).

**Auth:** `edge-api-key`
**Rate limit:** `edge-ingest` (60 req/min)

**Request:**

```json
{
  "agent_id": "agent_valero_memphis_01",
  "site_id": "site_valero_memphis",
  "batch_id": "batch_20260327_143000_001",
  "source": "pi_web_api",
  "collected_at": "2026-03-27T14:30:00Z",
  "readings": [
    {
      "tag": "FCC.REACTOR.TEMP.PV",
      "value": 982.4,
      "unit": "degF",
      "quality": "good",
      "timestamp": "2026-03-27T14:29:55Z"
    },
    {
      "tag": "CDU.FEED.RATE.PV",
      "value": 85200.0,
      "unit": "bpd",
      "quality": "good",
      "timestamp": "2026-03-27T14:29:57Z"
    },
    {
      "tag": "HX201.OUTLET.TEMP.PV",
      "value": -459.67,
      "unit": "degF",
      "quality": "bad_sensor",
      "timestamp": "2026-03-27T14:29:58Z"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agent_id` | string | yes | Unique identifier for this edge agent instance |
| `site_id` | string | yes | Site this agent belongs to. Must match API key's bound site. |
| `batch_id` | string | yes | Client-generated idempotency key. Duplicate batch_ids are silently accepted (at-least-once delivery). |
| `source` | enum | yes | `"pi_web_api"`, `"opcua"`, `"aveva_historian"`, `"manual_csv"` |
| `collected_at` | timestamp | yes | When the agent assembled this batch |
| `readings` | array | yes | 1 to 5000 readings per batch |
| `readings[].tag` | string | yes | Historian tag name, dot-delimited |
| `readings[].value` | number | yes | Sensor value |
| `readings[].unit` | string | yes | Engineering unit |
| `readings[].quality` | enum | yes | `"good"`, `"bad_sensor"`, `"stale"`, `"substituted"`, `"uncertain"` |
| `readings[].timestamp` | timestamp | yes | Source timestamp from historian |

**Response (202 Accepted):**

```json
{
  "batch_id": "batch_20260327_143000_001",
  "accepted": 3,
  "rejected": 0,
  "quality_flags": [
    {
      "tag": "HX201.OUTLET.TEMP.PV",
      "flag": "out_of_range",
      "message": "Value -459.67 degF is below absolute zero threshold for this tag"
    }
  ],
  "server_time": "2026-03-27T14:30:01Z"
}
```

**Why 202:** Data is accepted into the ingestion queue for async processing by the Data Quality Gateway. The `quality_flags` array provides immediate feedback so the edge agent can log issues locally.

---

### 2.2 POST /v1/edge/ingest/market

Batch upload of market data. Used when the customer supplies their own OPIS/Platts data via a local feed ("bring your own data" model).

**Auth:** `edge-api-key`
**Rate limit:** `edge-ingest`

**Request:**

```json
{
  "agent_id": "agent_valero_memphis_01",
  "site_id": "site_valero_memphis",
  "batch_id": "mkt_20260327_143000",
  "source": "customer_opis_feed",
  "prices": [
    {
      "symbol": "USGC_ULSD",
      "value": 2.4350,
      "unit": "usd_per_gallon",
      "timestamp": "2026-03-27T14:25:00Z",
      "source_label": "OPIS USGC Ultra Low Sulfur Diesel"
    },
    {
      "symbol": "WTI_CUSHING",
      "value": 71.82,
      "unit": "usd_per_barrel",
      "timestamp": "2026-03-27T14:25:00Z",
      "source_label": "WTI Cushing Spot"
    },
    {
      "symbol": "USGC_CRACK_321",
      "value": 18.45,
      "unit": "usd_per_barrel",
      "timestamp": "2026-03-27T14:25:00Z",
      "source_label": "USGC 3-2-1 Crack Spread"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prices` | array | yes | 1 to 200 price points per batch |
| `prices[].symbol` | string | yes | Normalized symbol from site configuration |
| `prices[].value` | number | yes | Price value |
| `prices[].unit` | string | yes | `"usd_per_gallon"`, `"usd_per_barrel"`, `"usd_per_mt"` |
| `prices[].timestamp` | timestamp | yes | Price timestamp from source |
| `prices[].source_label` | string | no | Human-readable source description |

**Response (202 Accepted):**

```json
{
  "batch_id": "mkt_20260327_143000",
  "accepted": 3,
  "rejected": 0,
  "server_time": "2026-03-27T14:30:01Z"
}
```

---

### 2.3 POST /v1/edge/heartbeat

Periodic health report from the edge agent. Expected every 60 seconds. If no heartbeat is received for 5 minutes, the cloud marks the agent as `degraded`. After 15 minutes, `offline`.

**Auth:** `edge-api-key`
**Rate limit:** `edge-config` (10 req/min)

**Request:**

```json
{
  "agent_id": "agent_valero_memphis_01",
  "site_id": "site_valero_memphis",
  "timestamp": "2026-03-27T14:30:00Z",
  "status": "healthy",
  "version": "0.4.2",
  "uptime_seconds": 86400,
  "metrics": {
    "readings_buffered": 0,
    "readings_sent_last_minute": 312,
    "readings_failed_last_minute": 0,
    "historian_connection": "connected",
    "historian_latency_ms": 45,
    "market_feed_connection": "connected",
    "disk_usage_percent": 12.4,
    "memory_usage_mb": 128,
    "cpu_percent": 3.2,
    "queue_depth": 0,
    "oldest_unsent_reading_age_seconds": 0
  },
  "errors": []
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | enum | yes | `"healthy"`, `"degraded"`, `"error"` |
| `version` | string | yes | Agent software version (semver) |
| `uptime_seconds` | integer | yes | Seconds since agent process started |
| `metrics.readings_buffered` | integer | yes | Readings queued locally waiting to send |
| `metrics.historian_connection` | enum | yes | `"connected"`, `"disconnected"`, `"reconnecting"` |
| `metrics.queue_depth` | integer | yes | Number of unsent batches |
| `metrics.oldest_unsent_reading_age_seconds` | integer | yes | Staleness of oldest buffered reading. 0 means fully caught up. |
| `errors` | array | no | Array of `{"code": string, "message": string, "timestamp": string}` for recent errors |

**Response (200 OK):**

```json
{
  "ack": true,
  "server_time": "2026-03-27T14:30:01Z",
  "commands": []
}
```

The `commands` array allows the cloud to send instructions back to the agent during heartbeat (pull-based command pattern, since we never push to the agent):

```json
{
  "commands": [
    {
      "command": "update_config",
      "config_version": "cfg_v12"
    },
    {
      "command": "restart",
      "reason": "New agent version available"
    }
  ]
}
```

Supported commands: `"update_config"`, `"restart"`, `"flush_buffer"`, `"run_diagnostics"`.

---

### 2.4 GET /v1/edge/config

Retrieve current configuration for this edge agent. The agent polls this endpoint on startup and when it receives an `update_config` command via heartbeat.

**Auth:** `edge-api-key`
**Rate limit:** `edge-config`

**Request:** No body. Query parameter: `?current_version=cfg_v11` (returns 304 Not Modified if unchanged).

**Response (200 OK):**

```json
{
  "config_version": "cfg_v12",
  "site_id": "site_valero_memphis",
  "agent_id": "agent_valero_memphis_01",
  "updated_at": "2026-03-27T10:00:00Z",
  "historian": {
    "type": "pi_web_api",
    "base_url": "https://piwebapi.valero-memphis.local/piwebapi",
    "auth_method": "kerberos",
    "poll_interval_seconds": 15,
    "timeout_ms": 5000,
    "retry_attempts": 3
  },
  "tags": [
    {
      "tag": "FCC.REACTOR.TEMP.PV",
      "description": "FCC Reactor Temperature",
      "unit": "degF",
      "poll_interval_seconds": 15,
      "expected_range": {"min": 900.0, "max": 1050.0},
      "stale_after_seconds": 120
    },
    {
      "tag": "CDU.FEED.RATE.PV",
      "description": "Crude Distillation Unit Feed Rate",
      "unit": "bpd",
      "poll_interval_seconds": 30,
      "expected_range": {"min": 50000.0, "max": 110000.0},
      "stale_after_seconds": 300
    }
  ],
  "market_feed": {
    "enabled": true,
    "source": "customer_opis_feed",
    "poll_interval_seconds": 300,
    "symbols": ["USGC_ULSD", "WTI_CUSHING", "USGC_CRACK_321"]
  },
  "buffering": {
    "max_buffer_size_mb": 500,
    "max_batch_size": 5000,
    "flush_interval_seconds": 30,
    "retry_backoff_base_seconds": 5,
    "retry_backoff_max_seconds": 300
  }
}
```

**Response (304 Not Modified):** Empty body when `current_version` matches.

---

### 2.5 POST /v1/edge/operating-mode

Report the current operating mode of the site. This is a critical signal: the cloud suppresses all optimization triggers during non-normal modes. The edge agent detects mode from historian signals or receives it from operator input.

**Auth:** `edge-api-key`
**Rate limit:** `edge-config`

**Request:**

```json
{
  "agent_id": "agent_valero_memphis_01",
  "site_id": "site_valero_memphis",
  "mode": "normal",
  "previous_mode": "startup",
  "changed_at": "2026-03-27T14:00:00Z",
  "source": "auto_detected",
  "confidence": 0.95,
  "notes": "All unit temperatures stabilized within normal bands for 30+ minutes"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | enum | yes | `"normal"`, `"startup"`, `"shutdown"`, `"upset"`, `"turnaround"`, `"emergency"` |
| `previous_mode` | enum | no | Previous mode for audit trail |
| `changed_at` | timestamp | yes | When the mode transition occurred |
| `source` | enum | yes | `"auto_detected"`, `"manual_override"`, `"dcs_signal"` |
| `confidence` | number | no | 0.0 to 1.0 for auto-detected modes |

**Response (200 OK):**

```json
{
  "acknowledged": true,
  "mode": "normal",
  "triggers_active": true,
  "message": "Optimization triggers re-enabled for site_valero_memphis"
}
```

---

## 3. Dashboard REST API

Used by the web dashboard and any programmatic integrations. All endpoints require JWT authentication.

**Base path:** `/v1`
**Auth:** `jwt-bearer` (required)

---

### 3.1 Sites and Configuration

#### GET /v1/sites

List all sites the authenticated user has access to.

**Auth:** `jwt-bearer` (any role)
**Rate limit:** `dashboard-read`

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "site_valero_memphis",
      "name": "Valero Memphis Refinery",
      "location": {
        "city": "Memphis",
        "state": "TN",
        "country": "US"
      },
      "capacity_bpd": 195000,
      "status": "active",
      "deployment_phase": "active",
      "operating_mode": "normal",
      "edge_agent_status": "healthy",
      "last_data_received_at": "2026-03-27T14:30:00Z",
      "created_at": "2026-01-15T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "offset": 0,
    "limit": 25
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | enum | `"onboarding"`, `"shadow_mode"`, `"active"`, `"paused"`, `"decommissioned"` |
| `deployment_phase` | enum | `"shadow_mode"`, `"guided_adoption"`, `"active"`. Reflects MOC-compliant phased onboarding. |
| `operating_mode` | enum | Current mode from edge agent. `"normal"`, `"startup"`, `"shutdown"`, `"upset"`, `"turnaround"`, `"emergency"` |
| `edge_agent_status` | enum | `"healthy"`, `"degraded"`, `"offline"`, `"not_configured"` |

---

#### POST /v1/sites

Create a new site. Initiates the onboarding flow.

**Auth:** `jwt-bearer` (role: `platform_admin`)
**Rate limit:** `admin`

**Request:**

```json
{
  "name": "Valero Memphis Refinery",
  "location": {
    "city": "Memphis",
    "state": "TN",
    "country": "US"
  },
  "capacity_bpd": 195000,
  "timezone": "America/Chicago",
  "contact": {
    "name": "Mike Johnson",
    "email": "mjohnson@valero.com",
    "role": "LP Planning Manager"
  }
}
```

**Response (201 Created):**

```json
{
  "id": "site_valero_memphis",
  "name": "Valero Memphis Refinery",
  "status": "onboarding",
  "deployment_phase": "shadow_mode",
  "api_key": {
    "key_id": "key_vm_001",
    "secret": "rfx_live_a1b2c3d4e5f6...",
    "note": "This is the only time the full secret is returned. Store it securely."
  },
  "created_at": "2026-03-27T15:00:00Z"
}
```

The API key is generated for the edge agent. It is shown exactly once.

---

#### GET /v1/sites/{site_id}

Get detailed site information.

**Auth:** `jwt-bearer` (any role with site access)
**Rate limit:** `dashboard-read`

**Response (200 OK):**

```json
{
  "id": "site_valero_memphis",
  "name": "Valero Memphis Refinery",
  "location": {
    "city": "Memphis",
    "state": "TN",
    "country": "US"
  },
  "capacity_bpd": 195000,
  "timezone": "America/Chicago",
  "status": "active",
  "deployment_phase": "active",
  "operating_mode": "normal",
  "operating_mode_changed_at": "2026-03-27T14:00:00Z",
  "edge_agent": {
    "agent_id": "agent_valero_memphis_01",
    "status": "healthy",
    "version": "0.4.2",
    "last_heartbeat_at": "2026-03-27T14:30:00Z",
    "last_data_received_at": "2026-03-27T14:30:00Z",
    "tags_configured": 112,
    "tags_reporting": 109,
    "tags_degraded": 3
  },
  "statistics": {
    "recommendations_today": 4,
    "active_constraints": 7,
    "margin_captured_30d": {"cents": 128000000, "currency": "USD"},
    "recommendation_acceptance_rate_30d": 0.78
  },
  "created_at": "2026-01-15T00:00:00Z",
  "updated_at": "2026-03-27T10:00:00Z"
}
```

---

#### PUT /v1/sites/{site_id}

Update site configuration.

**Auth:** `jwt-bearer` (role: `site_admin` or `platform_admin`)
**Rate limit:** `dashboard-write`

**Request:** Partial update. Only include fields to change.

```json
{
  "name": "Valero Memphis Refinery",
  "capacity_bpd": 200000,
  "deployment_phase": "active"
}
```

**Response (200 OK):** Full site object (same as GET).

---

#### GET /v1/sites/{site_id}/equipment

List equipment units at a site.

**Auth:** `jwt-bearer` (any role with site access)
**Rate limit:** `dashboard-read`

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "equip_fcc_01",
      "site_id": "site_valero_memphis",
      "name": "FCC Unit 1",
      "type": "fcc",
      "description": "Fluid Catalytic Cracker - Main",
      "design_capacity": 65000,
      "design_capacity_unit": "bpd",
      "status": "operating",
      "tags_count": 28,
      "active_constraints_count": 2,
      "created_at": "2026-01-15T00:00:00Z"
    },
    {
      "id": "equip_cdu_01",
      "site_id": "site_valero_memphis",
      "name": "CDU Unit 1",
      "type": "cdu",
      "description": "Crude Distillation Unit",
      "design_capacity": 110000,
      "design_capacity_unit": "bpd",
      "status": "operating",
      "tags_count": 45,
      "active_constraints_count": 1,
      "created_at": "2026-01-15T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 8,
    "offset": 0,
    "limit": 25
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | enum | `"cdu"`, `"fcc"`, `"reformer"`, `"hydrocracker"`, `"hydrotreater"`, `"coker"`, `"alkylation"`, `"isomerization"`, `"blending"`, `"utilities"`, `"storage"`, `"other"` |
| `status` | enum | `"operating"`, `"shutdown"`, `"turnaround"`, `"decommissioned"` |

---

#### POST /v1/sites/{site_id}/equipment

Create an equipment unit.

**Auth:** `jwt-bearer` (role: `site_admin`)
**Rate limit:** `dashboard-write`

**Request:**

```json
{
  "name": "FCC Unit 1",
  "type": "fcc",
  "description": "Fluid Catalytic Cracker - Main",
  "design_capacity": 65000,
  "design_capacity_unit": "bpd"
}
```

**Response (201 Created):** Full equipment object.

---

#### GET /v1/sites/{site_id}/tags

List sensor tags configured for a site. Supports filtering.

**Auth:** `jwt-bearer` (any role with site access)
**Rate limit:** `dashboard-read`

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `equipment_id` | string | Filter by equipment unit |
| `health` | enum | `"good"`, `"degraded"`, `"bad"`, `"stale"` |
| `limit` | integer | Default 50, max 200 |
| `cursor` | string | Pagination cursor |

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "tag_fcc_reactor_temp",
      "site_id": "site_valero_memphis",
      "equipment_id": "equip_fcc_01",
      "tag_name": "FCC.REACTOR.TEMP.PV",
      "description": "FCC Reactor Temperature",
      "unit": "degF",
      "expected_range": {"min": 900.0, "max": 1050.0},
      "poll_interval_seconds": 15,
      "stale_after_seconds": 120,
      "health": "good",
      "last_value": 982.4,
      "last_value_at": "2026-03-27T14:29:55Z",
      "substitution": null,
      "created_at": "2026-01-15T00:00:00Z"
    },
    {
      "id": "tag_hx201_outlet_temp",
      "site_id": "site_valero_memphis",
      "equipment_id": "equip_fcc_01",
      "tag_name": "HX201.OUTLET.TEMP.PV",
      "description": "Heat Exchanger 201 Outlet Temperature",
      "unit": "degF",
      "expected_range": {"min": 350.0, "max": 550.0},
      "poll_interval_seconds": 15,
      "stale_after_seconds": 120,
      "health": "bad",
      "last_value": -459.67,
      "last_value_at": "2026-03-27T14:29:58Z",
      "substitution": {
        "substitute_tag": "HX201.INLET.TEMP.PV",
        "method": "upstream_proxy",
        "offset": -45.0,
        "set_by": "user_mike_j",
        "set_at": "2026-03-20T08:00:00Z",
        "reason": "Thermocouple failed, waiting for turnaround to replace"
      },
      "created_at": "2026-01-15T00:00:00Z"
    }
  ],
  "pagination": {
    "next_cursor": "eyJ0YWdfbmFtZSI6IkhYMjAxLk9VVExFVC5URU1QLlBWIn0=",
    "has_more": true,
    "limit": 50
  }
}
```

---

#### PUT /v1/sites/{site_id}/tags/{tag_id}/substitution

Set or clear a sensor substitution.

**Auth:** `jwt-bearer` (role: `lp_planner` or `site_admin`)
**Rate limit:** `dashboard-write`

**Request (set substitution):**

```json
{
  "substitute_tag": "HX201.INLET.TEMP.PV",
  "method": "upstream_proxy",
  "offset": -45.0,
  "reason": "Thermocouple failed, waiting for turnaround to replace"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `substitute_tag` | string | yes | Tag name to use as substitute |
| `method` | enum | yes | `"upstream_proxy"`, `"downstream_proxy"`, `"historical_average"`, `"manual_value"` |
| `offset` | number | no | Static offset applied to substitute value |
| `reason` | string | yes | Audit trail reason for substitution |

**Request (clear substitution):**

```json
{
  "substitute_tag": null,
  "reason": "Thermocouple replaced during turnaround"
}
```

**Response (200 OK):** Full tag object with updated substitution.

---

#### GET /v1/sites/{site_id}/operating-mode

Get current operating mode and recent history.

**Auth:** `jwt-bearer` (any role with site access)
**Rate limit:** `dashboard-read`

**Response (200 OK):**

```json
{
  "current": {
    "mode": "normal",
    "since": "2026-03-27T14:00:00Z",
    "source": "auto_detected",
    "set_by": null,
    "triggers_active": true
  },
  "history": [
    {
      "mode": "startup",
      "from": "2026-03-27T06:00:00Z",
      "to": "2026-03-27T14:00:00Z",
      "source": "manual_override",
      "set_by": "user_mike_j",
      "duration_minutes": 480
    },
    {
      "mode": "shutdown",
      "from": "2026-03-26T22:00:00Z",
      "to": "2026-03-27T06:00:00Z",
      "source": "manual_override",
      "set_by": "user_mike_j",
      "duration_minutes": 480
    }
  ]
}
```

---

#### PUT /v1/sites/{site_id}/operating-mode

Manually set operating mode (overrides auto-detection).

**Auth:** `jwt-bearer` (role: `shift_supervisor`, `lp_planner`, or `site_admin`)
**Rate limit:** `dashboard-write`

**Request:**

```json
{
  "mode": "turnaround",
  "reason": "Scheduled FCC turnaround beginning March 28",
  "expected_duration": "P14D"
}
```

**Response (200 OK):**

```json
{
  "mode": "turnaround",
  "since": "2026-03-27T15:00:00Z",
  "source": "manual_override",
  "set_by": "user_mike_j",
  "triggers_active": false,
  "message": "All optimization triggers suppressed. Safety alerts remain active."
}
```

---

### 3.2 Trigger Configuration

#### GET /v1/sites/{site_id}/triggers

List all trigger configurations for a site.

**Auth:** `jwt-bearer` (role: `lp_planner`, `site_admin`)
**Rate limit:** `dashboard-read`

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "trg_process_fcc_temp",
      "site_id": "site_valero_memphis",
      "type": "process",
      "name": "FCC Reactor Temperature Drift",
      "description": "Triggers when FCC reactor temp drifts more than 15F from setpoint",
      "enabled": true,
      "suppressed_in_modes": ["shutdown", "startup", "turnaround", "emergency", "upset"],
      "conditions": {
        "tag": "FCC.REACTOR.TEMP.PV",
        "reference": "setpoint",
        "setpoint_tag": "FCC.REACTOR.TEMP.SP",
        "threshold": 15.0,
        "threshold_unit": "degF",
        "direction": "both",
        "sustained_seconds": 300
      },
      "cooldown": {
        "minutes": 120,
        "last_fired_at": "2026-03-27T10:15:00Z"
      },
      "statistics": {
        "fires_7d": 3,
        "fires_30d": 11,
        "avg_recommendation_value_cents": 2200000
      },
      "created_at": "2026-01-20T00:00:00Z",
      "updated_at": "2026-03-15T00:00:00Z"
    },
    {
      "id": "trg_price_crack_spread",
      "site_id": "site_valero_memphis",
      "type": "price",
      "name": "3-2-1 Crack Spread Movement",
      "description": "Triggers when crack spread moves more than 10% from trailing 20-day average",
      "enabled": true,
      "suppressed_in_modes": ["shutdown", "turnaround", "emergency"],
      "conditions": {
        "symbol": "USGC_CRACK_321",
        "reference": "trailing_average",
        "trailing_days": 20,
        "threshold_percent": 10.0,
        "direction": "both"
      },
      "cooldown": {
        "minutes": 240,
        "last_fired_at": "2026-03-27T08:30:00Z"
      },
      "statistics": {
        "fires_7d": 2,
        "fires_30d": 6,
        "avg_recommendation_value_cents": 4400000
      },
      "created_at": "2026-01-20T00:00:00Z",
      "updated_at": "2026-03-10T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 14,
    "offset": 0,
    "limit": 25
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | enum | `"process"` (sensor drift) or `"price"` (market movement) |
| `conditions.reference` | enum | `"setpoint"` (deviation from SP), `"absolute"` (fixed range), `"trailing_average"` (% from rolling mean) |
| `conditions.direction` | enum | `"above"`, `"below"`, `"both"` |
| `conditions.sustained_seconds` | integer | Signal must persist this long before trigger fires (debouncing) |
| `cooldown.minutes` | integer | Minimum minutes between consecutive fires of this trigger |
| `suppressed_in_modes` | array of enum | Operating modes where this trigger is automatically suppressed |

---

#### POST /v1/sites/{site_id}/triggers

Create a new trigger configuration.

**Auth:** `jwt-bearer` (role: `lp_planner`, `site_admin`)
**Rate limit:** `dashboard-write`

**Request:**

```json
{
  "type": "process",
  "name": "CDU Feed Rate Drop",
  "description": "Triggers when CDU feed rate drops more than 10% from design capacity",
  "enabled": true,
  "conditions": {
    "tag": "CDU.FEED.RATE.PV",
    "reference": "absolute",
    "threshold_low": 49500.0,
    "threshold_unit": "bpd",
    "direction": "below",
    "sustained_seconds": 600
  },
  "cooldown": {
    "minutes": 180
  },
  "suppressed_in_modes": ["shutdown", "startup", "turnaround", "emergency", "upset"]
}
```

**Response (201 Created):** Full trigger object.

---

#### PUT /v1/sites/{site_id}/triggers/{trigger_id}

Update an existing trigger configuration.

**Auth:** `jwt-bearer` (role: `lp_planner`, `site_admin`)
**Rate limit:** `dashboard-write`

**Request:** Partial update.

```json
{
  "cooldown": {
    "minutes": 240
  },
  "enabled": false
}
```

**Response (200 OK):** Full trigger object.

---

#### DELETE /v1/sites/{site_id}/triggers/{trigger_id}

Delete a trigger configuration.

**Auth:** `jwt-bearer` (role: `site_admin`)
**Rate limit:** `dashboard-write`

**Response (204 No Content)**

---

### 3.3 Recommendations and Overrides

#### GET /v1/sites/{site_id}/recommendations

List recommendations with filters. Cursor-based pagination ordered by `created_at` descending.

**Auth:** `jwt-bearer` (any role with site access)
**Rate limit:** `dashboard-read`

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | enum | `"pending"`, `"accepted"`, `"rejected"`, `"expired"`, `"superseded"` |
| `equipment_id` | string | Filter by affected equipment |
| `trigger_type` | enum | `"process"`, `"price"` |
| `from` | timestamp | Start of date range (inclusive) |
| `to` | timestamp | End of date range (inclusive) |
| `limit` | integer | Default 25, max 100 |
| `cursor` | string | Pagination cursor |

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "rec_20260327_001",
      "site_id": "site_valero_memphis",
      "status": "accepted",
      "trigger": {
        "id": "trg_price_crack_spread",
        "type": "price",
        "name": "3-2-1 Crack Spread Movement",
        "fired_at": "2026-03-27T08:30:00Z"
      },
      "summary": "Crack spreads widened $1.80/bbl in the last 2 hours. Recommend increasing naphtha yield by 8% on FCC Units 1 and 2.",
      "estimated_margin_impact": {"cents": 4400000, "currency": "USD"},
      "estimated_margin_impact_period": "P1D",
      "confidence": "high",
      "affected_equipment": ["equip_fcc_01", "equip_fcc_02"],
      "lp_solve_id": "solve_20260327_083005",
      "created_at": "2026-03-27T08:31:00Z",
      "responded_at": "2026-03-27T08:45:00Z",
      "responded_by": "user_mike_j",
      "response_channel": "slack"
    }
  ],
  "pagination": {
    "next_cursor": "eyJjcmVhdGVkX2F0IjoiMjAyNi0wMy0yN1QwODozMTowMFoifQ==",
    "has_more": true,
    "limit": 25
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | enum | `"pending"` -- awaiting response. `"accepted"` -- operator agreed. `"rejected"` -- operator rejected (feedback submitted). `"expired"` -- no response within configured window. `"superseded"` -- a newer recommendation replaced this one. |
| `confidence` | enum | `"high"` (all inputs validated), `"medium"` (some substituted sensors), `"low"` (significant data quality issues) |
| `estimated_margin_impact_period` | duration | Time period for the margin estimate (typically P1D for one day) |
| `response_channel` | enum | `"slack"`, `"teams"`, `"dashboard"`, `"email"` |

---

#### GET /v1/sites/{site_id}/recommendations/{recommendation_id}

Get full recommendation detail including LP model output, translated text, and all actions taken.

**Auth:** `jwt-bearer` (any role with site access)
**Rate limit:** `dashboard-read`

**Response (200 OK):**

```json
{
  "id": "rec_20260327_001",
  "site_id": "site_valero_memphis",
  "status": "accepted",
  "trigger": {
    "id": "trg_price_crack_spread",
    "type": "price",
    "name": "3-2-1 Crack Spread Movement",
    "fired_at": "2026-03-27T08:30:00Z",
    "trigger_data": {
      "symbol": "USGC_CRACK_321",
      "previous_value": 16.65,
      "current_value": 18.45,
      "change_percent": 10.8,
      "trailing_20d_average": 16.20
    }
  },
  "lp_solve": {
    "id": "solve_20260327_083005",
    "started_at": "2026-03-27T08:30:05Z",
    "completed_at": "2026-03-27T08:30:38Z",
    "duration_seconds": 33,
    "status": "optimal",
    "objective_value": 1284500.00,
    "previous_objective_value": 1240100.00,
    "delta": 44400.00,
    "key_changes": [
      {
        "variable": "FCC1_NAPHTHA_YIELD",
        "previous": 0.32,
        "recommended": 0.40,
        "unit": "fraction",
        "equipment_id": "equip_fcc_01"
      },
      {
        "variable": "FCC2_NAPHTHA_YIELD",
        "previous": 0.33,
        "recommended": 0.41,
        "unit": "fraction",
        "equipment_id": "equip_fcc_02"
      }
    ],
    "active_constraints_applied": ["con_hx201_fouling", "con_cat_regen_limit"],
    "sensor_substitutions_active": ["tag_hx201_outlet_temp"]
  },
  "translation": {
    "summary": "Crack spreads widened $1.80/bbl in the last 2 hours. Recommend increasing naphtha yield by 8% on FCC Units 1 and 2.",
    "detail": "The USGC 3-2-1 crack spread has moved from $16.65/bbl to $18.45/bbl (up 10.8%) over the past 2 hours, now well above the 20-day trailing average of $16.20/bbl. The LP model recommends shifting FCC naphtha yield targets from 32-33% up to 40-41% on both FCC units to capture the improved gasoline margin. This accounts for the current Heat Exchanger 201 fouling constraint and catalyst regeneration limit. At current throughput of 85,200 bpd, the estimated additional margin is $44,400 per day.",
    "estimated_margin_impact": {"cents": 4400000, "currency": "USD"},
    "estimated_margin_impact_period": "P1D",
    "confidence": "high",
    "confidence_notes": "All primary sensor readings validated. 1 substituted sensor (HX-201 outlet temp) -- substitution has been stable for 7 days.",
    "validation": {
      "numbers_cross_validated": true,
      "delta_matches_lp_output": true,
      "direction_validated": true,
      "template_fallback_used": false
    }
  },
  "actions": [
    {
      "action": "created",
      "at": "2026-03-27T08:31:00Z",
      "by": "system"
    },
    {
      "action": "delivered_slack",
      "at": "2026-03-27T08:31:05Z",
      "channel": "#memphis-ops",
      "message_ts": "1711525865.001234"
    },
    {
      "action": "delivered_email",
      "at": "2026-03-27T08:31:10Z",
      "recipients": ["mjohnson@valero.com"]
    },
    {
      "action": "accepted",
      "at": "2026-03-27T08:45:00Z",
      "by": "user_mike_j",
      "channel": "slack",
      "notes": null
    }
  ],
  "feedback": null,
  "opportunity_cost": null,
  "created_at": "2026-03-27T08:31:00Z",
  "expires_at": "2026-03-27T20:31:00Z"
}
```

The `lp_solve.key_changes` array contains the deterministically extracted numerical outputs. The `translation` section contains the LLM-generated text, and `translation.validation` confirms all numbers were cross-validated against the LP output (never trusting the LLM for numerical values).

---

#### POST /v1/sites/{site_id}/recommendations/{recommendation_id}/respond

Submit a structured response to a recommendation. This replaces free-text Slack feedback with a structured input flow.

**Auth:** `jwt-bearer` (role: `shift_supervisor`, `lp_planner`, `operator`)
**Rate limit:** `dashboard-write`

**Request (accept):**

```json
{
  "response": "accept",
  "notes": "Will implement on next DCS adjustment cycle"
}
```

**Request (reject with structured constraint):**

```json
{
  "response": "reject",
  "constraint": {
    "equipment_id": "equip_fcc_01",
    "constraint_type": "capacity_limit",
    "severity": "hard",
    "parameter": "throughput",
    "limit_value": 55000,
    "limit_unit": "bpd",
    "reason_category": "equipment_issue",
    "reason_detail": "Heat exchanger 201 fouling - reduced heat transfer",
    "expires_at": "2026-04-15T00:00:00Z"
  },
  "request_revised_recommendation": true
}
```

**Request (reject, qualitative -- no re-solve possible):**

```json
{
  "response": "reject",
  "constraint": {
    "equipment_id": "equip_fcc_01",
    "constraint_type": "operational",
    "severity": "soft",
    "reason_category": "planned_maintenance",
    "reason_detail": "FCC turnaround scheduled in 3 weeks, limiting unit stress",
    "expires_at": "2026-04-15T00:00:00Z"
  },
  "request_revised_recommendation": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `response` | enum | yes | `"accept"`, `"reject"`, `"defer"` |
| `constraint` | object | no (required if reject) | Structured constraint data |
| `constraint.equipment_id` | string | yes | Which equipment unit is constrained |
| `constraint.constraint_type` | enum | yes | `"capacity_limit"`, `"temperature_limit"`, `"pressure_limit"`, `"feed_quality"`, `"product_quality"`, `"operational"`, `"environmental"`, `"safety"` |
| `constraint.severity` | enum | yes | `"hard"` (quantifiable, can re-model) or `"soft"` (qualitative, log only) |
| `constraint.parameter` | string | no | LP variable name affected (for hard constraints) |
| `constraint.limit_value` | number | no | Numeric bound (for hard constraints) |
| `constraint.limit_unit` | string | no | Engineering unit for limit_value |
| `constraint.reason_category` | enum | yes | `"equipment_issue"`, `"planned_maintenance"`, `"feed_quality"`, `"weather"`, `"safety_concern"`, `"regulatory"`, `"operator_judgment"`, `"other"` |
| `constraint.reason_detail` | string | yes | Free-text explanation (for audit log and planning team) |
| `constraint.expires_at` | timestamp | no | When this constraint should auto-expire. Null means no expiry (must be manually cleared). |
| `request_revised_recommendation` | boolean | no | If true and constraint is hard, triggers an LP re-solve with the new constraint applied |

**Response (200 OK):**

```json
{
  "recommendation_id": "rec_20260327_001",
  "status": "rejected",
  "constraint_created": {
    "id": "con_hx201_fouling_002",
    "status": "active"
  },
  "revised_recommendation": {
    "id": "rec_20260327_002",
    "status": "pending",
    "message": "LP re-solve initiated with new constraint. Revised recommendation will be delivered shortly."
  }
}
```

When `request_revised_recommendation` is true and the constraint is hard (quantifiable), the system initiates a new LP solve with the constraint applied. The revised recommendation is a new recommendation object linked to the original.

---

### 3.4 Constraint Registry

#### GET /v1/sites/{site_id}/constraints

List constraints. Defaults to active constraints.

**Auth:** `jwt-bearer` (any role with site access)
**Rate limit:** `dashboard-read`

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | enum | `"active"`, `"expired"`, `"cleared"`, `"all"`. Default: `"active"` |
| `equipment_id` | string | Filter by equipment unit |
| `constraint_type` | enum | Filter by type |
| `severity` | enum | `"hard"`, `"soft"` |
| `limit` | integer | Default 50, max 200 |
| `cursor` | string | Pagination cursor |

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "con_hx201_fouling",
      "site_id": "site_valero_memphis",
      "equipment_id": "equip_fcc_01",
      "equipment_name": "FCC Unit 1",
      "constraint_type": "capacity_limit",
      "severity": "hard",
      "parameter": "throughput",
      "limit_value": 55000,
      "limit_unit": "bpd",
      "reason_category": "equipment_issue",
      "reason_detail": "Heat exchanger 201 fouling - reduced heat transfer",
      "status": "active",
      "source": "operator_feedback",
      "source_recommendation_id": "rec_20260320_003",
      "created_by": "user_mike_j",
      "created_at": "2026-03-20T08:15:00Z",
      "expires_at": "2026-04-15T00:00:00Z",
      "cleared_at": null,
      "cleared_by": null,
      "times_applied": 11,
      "last_applied_at": "2026-03-27T08:30:38Z",
      "estimated_daily_cost": {"cents": 1120000, "currency": "USD"},
      "ai_insight": "This constraint has been invoked 11 times in 7 days. Consider making this a permanent seasonal constraint or prioritizing HX-201 repair during next turnaround."
    }
  ],
  "pagination": {
    "next_cursor": "eyJjcmVhdGVkX2F0IjoiMjAyNi0wMy0yMFQwODoxNTowMFoifQ==",
    "has_more": false,
    "limit": 50
  }
}
```

The `ai_insight` field is populated asynchronously by the AI Translation service when it detects patterns (e.g., a constraint being applied frequently). This is Claude analyzing the constraint registry to surface institutional knowledge.

---

#### POST /v1/sites/{site_id}/constraints

Create a constraint directly (not from a recommendation response). Used by LP planners to proactively set constraints.

**Auth:** `jwt-bearer` (role: `lp_planner`, `site_admin`)
**Rate limit:** `dashboard-write`

**Request:**

```json
{
  "equipment_id": "equip_fcc_01",
  "constraint_type": "capacity_limit",
  "severity": "hard",
  "parameter": "throughput",
  "limit_value": 55000,
  "limit_unit": "bpd",
  "reason_category": "planned_maintenance",
  "reason_detail": "Reducing FCC throughput ahead of April turnaround",
  "expires_at": "2026-04-15T00:00:00Z"
}
```

**Response (201 Created):** Full constraint object.

---

#### PUT /v1/sites/{site_id}/constraints/{constraint_id}

Update a constraint (e.g., adjust limit value, extend expiry).

**Auth:** `jwt-bearer` (role: `lp_planner`, `site_admin`, `shift_supervisor`)
**Rate limit:** `dashboard-write`

**Request:**

```json
{
  "limit_value": 50000,
  "expires_at": "2026-04-30T00:00:00Z",
  "reason_detail": "Fouling worsened. Extending constraint until turnaround."
}
```

**Response (200 OK):** Full constraint object.

---

#### POST /v1/sites/{site_id}/constraints/{constraint_id}/clear

Clear (deactivate) a constraint. This makes it available for the LP to optimize through again.

**Auth:** `jwt-bearer` (role: `lp_planner`, `site_admin`, `shift_supervisor`)
**Rate limit:** `dashboard-write`

**Request:**

```json
{
  "reason": "HX-201 cleaned during turnaround. Full capacity restored."
}
```

**Response (200 OK):**

```json
{
  "id": "con_hx201_fouling",
  "status": "cleared",
  "cleared_at": "2026-03-27T16:00:00Z",
  "cleared_by": "user_mike_j",
  "clear_reason": "HX-201 cleaned during turnaround. Full capacity restored."
}
```

---

#### GET /v1/sites/{site_id}/constraints/{constraint_id}/history

Audit history for a specific constraint: all modifications, applications, and clearing events.

**Auth:** `jwt-bearer` (any role with site access)
**Rate limit:** `dashboard-read`

**Response (200 OK):**

```json
{
  "constraint_id": "con_hx201_fouling",
  "events": [
    {
      "event": "created",
      "at": "2026-03-20T08:15:00Z",
      "by": "user_mike_j",
      "data": {
        "limit_value": 55000,
        "reason_detail": "Heat exchanger 201 fouling"
      }
    },
    {
      "event": "applied_to_solve",
      "at": "2026-03-20T10:30:00Z",
      "solve_id": "solve_20260320_103000"
    },
    {
      "event": "updated",
      "at": "2026-03-25T09:00:00Z",
      "by": "user_mike_j",
      "data": {
        "limit_value_before": 55000,
        "limit_value_after": 50000,
        "reason_detail": "Fouling worsened"
      }
    },
    {
      "event": "ai_insight_generated",
      "at": "2026-03-27T06:00:00Z",
      "insight": "This constraint has been invoked 11 times in 7 days. Consider making permanent or prioritizing repair."
    },
    {
      "event": "cleared",
      "at": "2026-03-27T16:00:00Z",
      "by": "user_mike_j",
      "reason": "HX-201 cleaned during turnaround"
    }
  ]
}
```

---

### 3.5 Analytics and Dashboard

#### GET /v1/sites/{site_id}/analytics/opportunity-cost

Opportunity cost summary. Shows margin captured vs. margin available, broken down by equipment unit.

**Important design note:** This endpoint serves the management-facing view. It frames data as "value captured" not "value lost." It groups by equipment, never by individual operator (per R8 risk mitigation).

**Auth:** `jwt-bearer` (role: `lp_planner`, `site_admin`, `viewer`)
**Rate limit:** `dashboard-read`

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `period` | enum | `"7d"`, `"30d"`, `"90d"`, `"ytd"`, `"custom"`. Default: `"30d"` |
| `from` | timestamp | Required if period is `"custom"` |
| `to` | timestamp | Required if period is `"custom"` |
| `group_by` | enum | `"equipment"`, `"trigger_type"`, `"day"`, `"week"`. Default: `"equipment"` |

**Response (200 OK):**

```json
{
  "site_id": "site_valero_memphis",
  "period": {
    "from": "2026-02-25T00:00:00Z",
    "to": "2026-03-27T00:00:00Z",
    "days": 30
  },
  "summary": {
    "total_margin_available": {"cents": 168000000, "currency": "USD"},
    "total_margin_captured": {"cents": 128000000, "currency": "USD"},
    "capture_rate": 0.762,
    "recommendations_generated": 42,
    "recommendations_accepted": 33,
    "recommendations_rejected": 7,
    "recommendations_expired": 2,
    "top_constraint_categories": [
      {"category": "equipment_issue", "count": 14, "uncaptured": {"cents": 22400000, "currency": "USD"}},
      {"category": "planned_maintenance", "count": 5, "uncaptured": {"cents": 11200000, "currency": "USD"}},
      {"category": "operator_judgment", "count": 3, "uncaptured": {"cents": 6400000, "currency": "USD"}}
    ]
  },
  "breakdown": [
    {
      "group": "equip_fcc_01",
      "group_label": "FCC Unit 1",
      "margin_available": {"cents": 78000000, "currency": "USD"},
      "margin_captured": {"cents": 56000000, "currency": "USD"},
      "capture_rate": 0.718,
      "recommendations": 18,
      "accepted": 13,
      "rejected": 4,
      "expired": 1,
      "top_constraint": "HX-201 fouling (11 occurrences, $224K uncaptured)"
    },
    {
      "group": "equip_cdu_01",
      "group_label": "CDU Unit 1",
      "margin_available": {"cents": 54000000, "currency": "USD"},
      "margin_captured": {"cents": 48000000, "currency": "USD"},
      "capture_rate": 0.889,
      "recommendations": 12,
      "accepted": 11,
      "rejected": 1,
      "expired": 0,
      "top_constraint": "Feed quality variation (1 occurrence, $60K uncaptured)"
    }
  ]
}
```

Note: The response uses "capture_rate" and "margin_captured" framing, not "lost margin" or "override cost." This prevents the blame-culture dynamic identified in R8.

---

#### GET /v1/sites/{site_id}/analytics/coefficient-reconciliation

Coefficient reconciliation status. Shows where LP model predictions diverge from actual plant outcomes.

**Auth:** `jwt-bearer` (role: `lp_planner`, `site_admin`)
**Rate limit:** `dashboard-read`

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `period` | enum | `"7d"`, `"30d"`, `"90d"`. Default: `"30d"` |
| `equipment_id` | string | Filter by equipment |
| `threshold_percent` | number | Only show coefficients drifted beyond this percent. Default: 5.0 |

**Response (200 OK):**

```json
{
  "site_id": "site_valero_memphis",
  "period": "30d",
  "coefficients": [
    {
      "id": "coeff_fcc1_naphtha_yield",
      "equipment_id": "equip_fcc_01",
      "equipment_name": "FCC Unit 1",
      "coefficient_name": "Naphtha Yield",
      "lp_predicted": 0.080,
      "actual_measured": 0.042,
      "drift_percent": -47.5,
      "drift_direction": "underperforming",
      "drift_trend": "worsening",
      "first_detected_at": "2026-02-15T00:00:00Z",
      "consecutive_days_drifted": 40,
      "estimated_daily_impact": {"cents": 850000, "currency": "USD"},
      "suggested_correction": 0.045,
      "ai_explanation": "FCC1 naphtha yield has been consistently 47% below LP prediction for 40 days. This pattern correlates with catalyst age -- the FCC catalyst was last changed 14 months ago. Typical catalyst cycle is 12-18 months. Recommend updating the LP coefficient to 4.5% and evaluating catalyst replacement during the April turnaround.",
      "status": "flagged"
    }
  ],
  "summary": {
    "total_coefficients_tracked": 34,
    "within_tolerance": 28,
    "flagged": 4,
    "critical": 2,
    "total_estimated_daily_impact": {"cents": 2200000, "currency": "USD"}
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `drift_trend` | enum | `"stable"`, `"improving"`, `"worsening"` |
| `status` | enum | `"normal"`, `"flagged"` (drift > threshold), `"critical"` (drift > 2x threshold), `"corrected"` (LP updated) |

---

#### GET /v1/sites/{site_id}/analytics/sensor-health

Sensor health report. Shows which sensors are degraded and their impact on optimization.

**Auth:** `jwt-bearer` (any role with site access)
**Rate limit:** `dashboard-read`

**Response (200 OK):**

```json
{
  "site_id": "site_valero_memphis",
  "summary": {
    "total_tags": 112,
    "good": 97,
    "degraded": 8,
    "bad": 4,
    "stale": 3,
    "substituted": 3
  },
  "degraded_tags": [
    {
      "tag_id": "tag_hx201_outlet_temp",
      "tag_name": "HX201.OUTLET.TEMP.PV",
      "equipment_id": "equip_fcc_01",
      "equipment_name": "FCC Unit 1",
      "health": "bad",
      "issue": "Reading absolute zero -- thermocouple failure",
      "since": "2026-03-18T00:00:00Z",
      "days_degraded": 9,
      "substitution_active": true,
      "substitute_tag": "HX201.INLET.TEMP.PV",
      "optimization_impact": "medium",
      "optimization_impact_detail": "Used in 3 active triggers. Substitution provides adequate proxy but reduces recommendation confidence.",
      "estimated_daily_cost_of_degradation": {"cents": 180000, "currency": "USD"},
      "recommended_action": "Replace thermocouple during April turnaround. Priority: HIGH based on optimization impact."
    }
  ],
  "maintenance_priority_list": [
    {
      "rank": 1,
      "tag_id": "tag_hx201_outlet_temp",
      "tag_name": "HX201.OUTLET.TEMP.PV",
      "estimated_monthly_cost": {"cents": 5400000, "currency": "USD"},
      "days_degraded": 9
    },
    {
      "rank": 2,
      "tag_id": "tag_reformer_inlet_press",
      "tag_name": "REFORM.INLET.PRESS.PV",
      "estimated_monthly_cost": {"cents": 2100000, "currency": "USD"},
      "days_degraded": 22
    }
  ]
}
```

---

#### GET /v1/sites/{site_id}/analytics/system-health

System health overview: edge agent status, data pipeline health, queue depths.

**Auth:** `jwt-bearer` (any role with site access)
**Rate limit:** `dashboard-read`

**Response (200 OK):**

```json
{
  "site_id": "site_valero_memphis",
  "timestamp": "2026-03-27T14:35:00Z",
  "edge_agent": {
    "agent_id": "agent_valero_memphis_01",
    "status": "healthy",
    "version": "0.4.2",
    "last_heartbeat_at": "2026-03-27T14:34:30Z",
    "uptime": "P1D",
    "historian_connection": "connected",
    "historian_latency_ms": 45,
    "market_feed_connection": "connected",
    "readings_per_minute": 312,
    "queue_depth": 0,
    "oldest_unsent_age_seconds": 0
  },
  "data_pipeline": {
    "ingestion_rate_per_minute": 312,
    "data_quality_pass_rate": 0.973,
    "last_quality_failure_at": "2026-03-27T14:29:58Z",
    "trigger_evaluations_per_minute": 12,
    "active_triggers": 14,
    "triggers_in_cooldown": 3
  },
  "lp_engine": {
    "status": "idle",
    "last_solve_at": "2026-03-27T08:30:38Z",
    "last_solve_duration_seconds": 33,
    "solves_today": 6,
    "average_solve_time_seconds": 28,
    "queue_depth": 0
  },
  "ai_translation": {
    "status": "healthy",
    "claude_api_latency_ms": 1200,
    "translations_today": 6,
    "validation_pass_rate": 1.0,
    "template_fallback_used_today": 0
  },
  "messaging": {
    "slack_connected": true,
    "teams_connected": false,
    "email_configured": true,
    "messages_delivered_today": 12,
    "delivery_failures_today": 0
  }
}
```

---

### 3.6 Admin

#### GET /v1/admin/users

List all users. Platform admins see all users; site admins see users for their sites.

**Auth:** `jwt-bearer` (role: `site_admin` or `platform_admin`)
**Rate limit:** `admin`

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `site_id` | string | Filter by site access |
| `role` | enum | Filter by role |
| `limit` | integer | Default 25, max 100 |
| `offset` | integer | Offset for pagination |

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "user_mike_j",
      "email": "mjohnson@valero.com",
      "name": "Mike Johnson",
      "role": "lp_planner",
      "site_ids": ["site_valero_memphis"],
      "status": "active",
      "last_login_at": "2026-03-27T08:00:00Z",
      "created_at": "2026-01-15T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 12,
    "offset": 0,
    "limit": 25
  }
}
```

---

#### POST /v1/admin/users

Create a user.

**Auth:** `jwt-bearer` (role: `site_admin` or `platform_admin`)
**Rate limit:** `admin`

**Request:**

```json
{
  "email": "srodriguez@valero.com",
  "name": "Sarah Rodriguez",
  "role": "shift_supervisor",
  "site_ids": ["site_valero_memphis"]
}
```

**Response (201 Created):**

```json
{
  "id": "user_sarah_r",
  "email": "srodriguez@valero.com",
  "name": "Sarah Rodriguez",
  "role": "shift_supervisor",
  "site_ids": ["site_valero_memphis"],
  "status": "invited",
  "invite_link": "https://app.reflexoptimize.com/invite/tok_abc123...",
  "invite_expires_at": "2026-04-03T15:00:00Z",
  "created_at": "2026-03-27T15:00:00Z"
}
```

---

#### PUT /v1/admin/users/{user_id}

Update a user's role or site access.

**Auth:** `jwt-bearer` (role: `site_admin` or `platform_admin`)
**Rate limit:** `admin`

**Request:**

```json
{
  "role": "lp_planner",
  "site_ids": ["site_valero_memphis", "site_valero_houston"]
}
```

**Response (200 OK):** Full user object.

---

#### DELETE /v1/admin/users/{user_id}

Deactivate a user. Does not delete -- sets `status: "deactivated"` and revokes all tokens.

**Auth:** `jwt-bearer` (role: `platform_admin`)
**Rate limit:** `admin`

**Response (204 No Content)**

---

#### GET /v1/admin/api-keys

List API keys for edge agents.

**Auth:** `jwt-bearer` (role: `site_admin` or `platform_admin`)
**Rate limit:** `admin`

**Response (200 OK):**

```json
{
  "data": [
    {
      "key_id": "key_vm_001",
      "site_id": "site_valero_memphis",
      "agent_id": "agent_valero_memphis_01",
      "prefix": "rfx_live_a1b2...",
      "status": "active",
      "last_used_at": "2026-03-27T14:30:00Z",
      "created_at": "2026-01-15T00:00:00Z",
      "created_by": "user_admin"
    }
  ],
  "pagination": {
    "total": 1,
    "offset": 0,
    "limit": 25
  }
}
```

The full secret is never returned after creation.

---

#### POST /v1/admin/api-keys

Generate a new API key for an edge agent.

**Auth:** `jwt-bearer` (role: `platform_admin`)
**Rate limit:** `admin`

**Request:**

```json
{
  "site_id": "site_valero_memphis",
  "agent_id": "agent_valero_memphis_02",
  "label": "Memphis secondary agent"
}
```

**Response (201 Created):**

```json
{
  "key_id": "key_vm_002",
  "secret": "rfx_live_x9y8z7w6...",
  "site_id": "site_valero_memphis",
  "agent_id": "agent_valero_memphis_02",
  "status": "active",
  "note": "This is the only time the full secret is returned. Store it securely.",
  "created_at": "2026-03-27T15:00:00Z"
}
```

---

#### DELETE /v1/admin/api-keys/{key_id}

Revoke an API key immediately.

**Auth:** `jwt-bearer` (role: `platform_admin`)
**Rate limit:** `admin`

**Response (204 No Content)**

---

#### GET /v1/admin/audit-log

Platform-wide audit log. Every state-changing action is logged.

**Auth:** `jwt-bearer` (role: `site_admin` or `platform_admin`)
**Rate limit:** `admin`

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `site_id` | string | Filter by site |
| `user_id` | string | Filter by actor |
| `action` | string | Filter by action type (e.g., `"constraint.created"`, `"recommendation.responded"`) |
| `from` | timestamp | Start of date range |
| `to` | timestamp | End of date range |
| `limit` | integer | Default 50, max 200 |
| `cursor` | string | Pagination cursor |

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "audit_001",
      "timestamp": "2026-03-27T08:45:00Z",
      "site_id": "site_valero_memphis",
      "actor": {
        "type": "user",
        "id": "user_mike_j",
        "name": "Mike Johnson"
      },
      "action": "recommendation.responded",
      "resource": {
        "type": "recommendation",
        "id": "rec_20260327_001"
      },
      "details": {
        "response": "accepted",
        "channel": "slack"
      },
      "ip_address": "10.0.1.45"
    },
    {
      "id": "audit_002",
      "timestamp": "2026-03-27T08:31:00Z",
      "site_id": "site_valero_memphis",
      "actor": {
        "type": "system",
        "id": "trigger_engine"
      },
      "action": "recommendation.created",
      "resource": {
        "type": "recommendation",
        "id": "rec_20260327_001"
      },
      "details": {
        "trigger_id": "trg_price_crack_spread",
        "trigger_type": "price"
      },
      "ip_address": null
    }
  ],
  "pagination": {
    "next_cursor": "eyJ0aW1lc3RhbXAiOiIyMDI2LTAzLTI3VDA4OjMxOjAwWiJ9",
    "has_more": true,
    "limit": 50
  }
}
```

---

### 3.7 Authentication Endpoints

#### POST /v1/auth/login

Authenticate a dashboard user and receive tokens.

**Auth:** Public
**Rate limit:** 5 requests/minute per IP

**Request:**

```json
{
  "email": "mjohnson@valero.com",
  "password": "..."
}
```

**Response (200 OK):**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "rfx_ref_a1b2c3d4...",
  "token_type": "Bearer",
  "expires_in": 900,
  "user": {
    "id": "user_mike_j",
    "email": "mjohnson@valero.com",
    "name": "Mike Johnson",
    "role": "lp_planner",
    "site_ids": ["site_valero_memphis"]
  }
}
```

---

#### POST /v1/auth/refresh

Refresh an expired access token.

**Auth:** Public (refresh token in body)
**Rate limit:** 10 requests/minute per IP

**Request:**

```json
{
  "refresh_token": "rfx_ref_a1b2c3d4..."
}
```

**Response (200 OK):** Same shape as login response with new tokens.

---

#### POST /v1/auth/logout

Revoke the refresh token.

**Auth:** `jwt-bearer`
**Rate limit:** `dashboard-write`

**Request:**

```json
{
  "refresh_token": "rfx_ref_a1b2c3d4..."
}
```

**Response (204 No Content)**

---

## 4. WebSocket API

Real-time push channel for the dashboard. Delivers recommendation notifications, operating mode changes, and edge agent status updates without polling.

**Endpoint:** `wss://api.reflexoptimize.com/v1/ws`

**Connection:** Client connects with JWT as query parameter or in the first message:

```
wss://api.reflexoptimize.com/v1/ws?token=eyJhbGciOiJSUzI1NiIs...
```

Alternatively, send auth as the first message after connection:

```json
{
  "type": "auth",
  "token": "eyJhbGciOiJSUzI1NiIs..."
}
```

Server responds:

```json
{
  "type": "auth_ack",
  "user_id": "user_mike_j",
  "site_ids": ["site_valero_memphis"],
  "server_time": "2026-03-27T14:35:00Z"
}
```

### 4.1 Message Envelope

All WebSocket messages use a consistent JSON envelope:

```json
{
  "type": "<message_type>",
  "site_id": "<site_id>",
  "timestamp": "<ISO 8601 UTC>",
  "payload": { ... },
  "metadata": {
    "sequence": 42,
    "correlation_id": "corr_abc123"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Message type identifier |
| `site_id` | string | Which site this message belongs to. Client only receives messages for sites in their JWT. |
| `timestamp` | timestamp | Server timestamp when message was generated |
| `payload` | object | Type-specific data |
| `metadata.sequence` | integer | Monotonically increasing sequence number per connection. Client can detect gaps. |
| `metadata.correlation_id` | string | Links related messages (e.g., a recommendation and its subsequent response) |

### 4.2 Server to Client Message Types

#### `recommendation.new`

Pushed when a new recommendation is generated.

```json
{
  "type": "recommendation.new",
  "site_id": "site_valero_memphis",
  "timestamp": "2026-03-27T08:31:00Z",
  "payload": {
    "id": "rec_20260327_001",
    "trigger_type": "price",
    "trigger_name": "3-2-1 Crack Spread Movement",
    "summary": "Crack spreads widened $1.80/bbl in the last 2 hours. Recommend increasing naphtha yield by 8% on FCC Units 1 and 2.",
    "estimated_margin_impact": {"cents": 4400000, "currency": "USD"},
    "confidence": "high",
    "affected_equipment": ["equip_fcc_01", "equip_fcc_02"],
    "status": "pending",
    "expires_at": "2026-03-27T20:31:00Z"
  },
  "metadata": {
    "sequence": 42,
    "correlation_id": "corr_rec_20260327_001"
  }
}
```

#### `recommendation.updated`

Pushed when a recommendation status changes (accepted, rejected, expired, superseded).

```json
{
  "type": "recommendation.updated",
  "site_id": "site_valero_memphis",
  "timestamp": "2026-03-27T08:45:00Z",
  "payload": {
    "id": "rec_20260327_001",
    "previous_status": "pending",
    "status": "accepted",
    "responded_by": "user_mike_j",
    "response_channel": "slack"
  },
  "metadata": {
    "sequence": 43,
    "correlation_id": "corr_rec_20260327_001"
  }
}
```

#### `recommendation.revised`

Pushed when a revised recommendation is generated after a constraint rejection.

```json
{
  "type": "recommendation.revised",
  "site_id": "site_valero_memphis",
  "timestamp": "2026-03-27T09:05:00Z",
  "payload": {
    "id": "rec_20260327_002",
    "original_recommendation_id": "rec_20260327_001",
    "summary": "With FCC Unit 1 capped at 55,000 bpd, revised recommendation: increase diesel mode on CDU Unit 1. Estimated margin impact: $11,200/day.",
    "estimated_margin_impact": {"cents": 1120000, "currency": "USD"},
    "confidence": "high",
    "affected_equipment": ["equip_cdu_01"],
    "status": "pending",
    "constraint_applied": "con_hx201_fouling"
  },
  "metadata": {
    "sequence": 44,
    "correlation_id": "corr_rec_20260327_001"
  }
}
```

#### `operating_mode.changed`

Pushed when the site operating mode changes.

```json
{
  "type": "operating_mode.changed",
  "site_id": "site_valero_memphis",
  "timestamp": "2026-03-27T14:00:00Z",
  "payload": {
    "previous_mode": "startup",
    "mode": "normal",
    "source": "auto_detected",
    "triggers_active": true,
    "message": "All optimization triggers re-enabled"
  },
  "metadata": {
    "sequence": 45,
    "correlation_id": null
  }
}
```

#### `edge_agent.status_changed`

Pushed when edge agent health status changes.

```json
{
  "type": "edge_agent.status_changed",
  "site_id": "site_valero_memphis",
  "timestamp": "2026-03-27T14:40:00Z",
  "payload": {
    "agent_id": "agent_valero_memphis_01",
    "previous_status": "healthy",
    "status": "degraded",
    "reason": "Historian connection lost. Agent is buffering readings locally.",
    "historian_connection": "disconnected",
    "queue_depth": 450,
    "oldest_unsent_age_seconds": 120
  },
  "metadata": {
    "sequence": 46,
    "correlation_id": null
  }
}
```

#### `constraint.changed`

Pushed when a constraint is created, updated, or cleared.

```json
{
  "type": "constraint.changed",
  "site_id": "site_valero_memphis",
  "timestamp": "2026-03-27T16:00:00Z",
  "payload": {
    "id": "con_hx201_fouling",
    "action": "cleared",
    "equipment_id": "equip_fcc_01",
    "equipment_name": "FCC Unit 1",
    "constraint_type": "capacity_limit",
    "cleared_by": "user_mike_j",
    "reason": "HX-201 cleaned during turnaround"
  },
  "metadata": {
    "sequence": 47,
    "correlation_id": null
  }
}
```

### 4.3 Client to Server Message Types

#### `subscribe`

Subscribe to specific message types or sites (within the user's access scope).

```json
{
  "type": "subscribe",
  "channels": [
    "recommendation.*",
    "operating_mode.changed",
    "edge_agent.status_changed"
  ],
  "site_ids": ["site_valero_memphis"]
}
```

Response:

```json
{
  "type": "subscribe_ack",
  "channels": ["recommendation.*", "operating_mode.changed", "edge_agent.status_changed"],
  "site_ids": ["site_valero_memphis"]
}
```

#### `ping`

Client-initiated keepalive. Server responds with `pong`. If no ping or other activity for 60 seconds, the server closes the connection.

```json
{"type": "ping"}
```

```json
{"type": "pong", "server_time": "2026-03-27T14:35:00Z"}
```

---

## 5. Slack/Teams Webhook and Interaction API

Reflex delivers recommendations to shift supervisors and process engineers via Slack and/or Teams. These endpoints handle both outbound message delivery (internal) and inbound interaction callbacks (from Slack/Teams platforms).

### 5.1 Slack Integration

#### POST /v1/webhooks/slack/interactions

Handles all Slack interactive message callbacks (button clicks, dropdown selections, modal submissions). Slack sends these when a user interacts with a Block Kit message.

**Auth:** `hmac-signature` (Slack signing secret verification)
**Rate limit:** `webhook` (100 req/min per workspace)

Slack sends `application/x-www-form-urlencoded` with a `payload` field containing JSON.

**Inbound Payload (button click -- accept recommendation):**

```json
{
  "type": "block_actions",
  "user": {
    "id": "U0123456789",
    "name": "mjohnson"
  },
  "trigger_id": "123456.789",
  "actions": [
    {
      "action_id": "rec_accept",
      "block_id": "rec_actions_20260327_001",
      "value": "rec_20260327_001",
      "type": "button"
    }
  ],
  "channel": {
    "id": "C0123MEMPHIS",
    "name": "memphis-ops"
  },
  "message": {
    "ts": "1711525865.001234"
  }
}
```

**Processing:** The webhook handler maps the Slack user to a Reflex user, extracts the recommendation ID from the action value, and calls the internal recommendation response API.

**Response (200 OK):** Slack requires a 200 response within 3 seconds. The handler acknowledges immediately and processes asynchronously.

```json
{
  "response_type": "in_channel",
  "replace_original": true,
  "text": "Recommendation accepted by Mike Johnson"
}
```

---

**Inbound Payload (button click -- reject, opens constraint modal):**

When the user clicks "Reject / Add Constraint", Slack opens a modal for structured constraint input.

```json
{
  "type": "block_actions",
  "user": {"id": "U0123456789", "name": "mjohnson"},
  "trigger_id": "123456.789",
  "actions": [
    {
      "action_id": "rec_reject_start",
      "value": "rec_20260327_001",
      "type": "button"
    }
  ]
}
```

The handler responds by opening a Slack modal via `views.open`:

```json
{
  "trigger_id": "123456.789",
  "view": {
    "type": "modal",
    "callback_id": "constraint_input",
    "title": {"type": "plain_text", "text": "Add Constraint"},
    "submit": {"type": "plain_text", "text": "Submit"},
    "private_metadata": "{\"recommendation_id\":\"rec_20260327_001\"}",
    "blocks": [
      {
        "type": "section",
        "text": {"type": "mrkdwn", "text": "*Rejecting recommendation:* Increase naphtha yield by 8% on FCC Units 1 and 2"}
      },
      {
        "type": "input",
        "block_id": "equipment_select",
        "label": {"type": "plain_text", "text": "Which equipment is constrained?"},
        "element": {
          "type": "static_select",
          "action_id": "equipment_id",
          "options": [
            {"text": {"type": "plain_text", "text": "FCC Unit 1"}, "value": "equip_fcc_01"},
            {"text": {"type": "plain_text", "text": "FCC Unit 2"}, "value": "equip_fcc_02"},
            {"text": {"type": "plain_text", "text": "CDU Unit 1"}, "value": "equip_cdu_01"}
          ]
        }
      },
      {
        "type": "input",
        "block_id": "constraint_type_select",
        "label": {"type": "plain_text", "text": "Constraint type"},
        "element": {
          "type": "static_select",
          "action_id": "constraint_type",
          "options": [
            {"text": {"type": "plain_text", "text": "Capacity limit"}, "value": "capacity_limit"},
            {"text": {"type": "plain_text", "text": "Temperature limit"}, "value": "temperature_limit"},
            {"text": {"type": "plain_text", "text": "Pressure limit"}, "value": "pressure_limit"},
            {"text": {"type": "plain_text", "text": "Feed quality issue"}, "value": "feed_quality"},
            {"text": {"type": "plain_text", "text": "Safety concern"}, "value": "safety"},
            {"text": {"type": "plain_text", "text": "Planned maintenance"}, "value": "planned_maintenance"},
            {"text": {"type": "plain_text", "text": "Other operational"}, "value": "operational"}
          ]
        }
      },
      {
        "type": "input",
        "block_id": "severity_select",
        "label": {"type": "plain_text", "text": "Can this be quantified for re-modeling?"},
        "element": {
          "type": "static_select",
          "action_id": "severity",
          "options": [
            {"text": {"type": "plain_text", "text": "Yes - I can specify a limit (re-solve with new constraint)"}, "value": "hard"},
            {"text": {"type": "plain_text", "text": "No - just log it for the planning team"}, "value": "soft"}
          ]
        }
      },
      {
        "type": "input",
        "block_id": "reason_input",
        "label": {"type": "plain_text", "text": "Brief reason"},
        "element": {
          "type": "plain_text_input",
          "action_id": "reason_detail",
          "placeholder": {"type": "plain_text", "text": "e.g., Heat exchanger 201 fouling"}
        }
      },
      {
        "type": "input",
        "block_id": "expiry_select",
        "label": {"type": "plain_text", "text": "How long should this constraint last?"},
        "optional": true,
        "element": {
          "type": "static_select",
          "action_id": "expiry",
          "options": [
            {"text": {"type": "plain_text", "text": "This shift only"}, "value": "8h"},
            {"text": {"type": "plain_text", "text": "24 hours"}, "value": "24h"},
            {"text": {"type": "plain_text", "text": "1 week"}, "value": "7d"},
            {"text": {"type": "plain_text", "text": "Until next turnaround"}, "value": "turnaround"},
            {"text": {"type": "plain_text", "text": "Until I clear it"}, "value": "indefinite"}
          ]
        }
      }
    ]
  }
}
```

This is the structured 5-tap constraint input flow from the risk mitigations. Equipment, type, severity, reason, and duration -- all selectable without a keyboard, usable with gloves on a phone or tablet.

---

**Inbound Payload (modal submission):**

```json
{
  "type": "view_submission",
  "user": {"id": "U0123456789", "name": "mjohnson"},
  "view": {
    "callback_id": "constraint_input",
    "private_metadata": "{\"recommendation_id\":\"rec_20260327_001\"}",
    "state": {
      "values": {
        "equipment_select": {"equipment_id": {"selected_option": {"value": "equip_fcc_01"}}},
        "constraint_type_select": {"constraint_type": {"selected_option": {"value": "capacity_limit"}}},
        "severity_select": {"severity": {"selected_option": {"value": "hard"}}},
        "reason_input": {"reason_detail": {"value": "Heat exchanger 201 fouling - reduced heat transfer"}},
        "expiry_select": {"expiry": {"selected_option": {"value": "turnaround"}}}
      }
    }
  }
}
```

**Processing:** The handler creates the constraint via the internal API and, if severity is "hard", prompts for the numeric limit via a follow-up message:

```json
{
  "channel": "C0123MEMPHIS",
  "text": "Constraint logged for FCC Unit 1. Since this is a quantifiable constraint, what throughput limit should we use?",
  "blocks": [
    {
      "type": "section",
      "text": {"type": "mrkdwn", "text": "*FCC Unit 1 - Capacity Limit*\nWhat throughput limit should the LP model use?"}
    },
    {
      "type": "actions",
      "block_id": "limit_select_con_hx201_fouling_002",
      "elements": [
        {"type": "button", "text": {"type": "plain_text", "text": "50,000 bpd"}, "value": "50000", "action_id": "set_limit_50000"},
        {"type": "button", "text": {"type": "plain_text", "text": "55,000 bpd"}, "value": "55000", "action_id": "set_limit_55000"},
        {"type": "button", "text": {"type": "plain_text", "text": "60,000 bpd"}, "value": "60000", "action_id": "set_limit_60000"},
        {"type": "button", "text": {"type": "plain_text", "text": "Other..."}, "value": "custom", "action_id": "set_limit_custom"}
      ]
    }
  ]
}
```

The limit options are pre-calculated based on the equipment's design capacity and historical constraint values. This avoids requiring the operator to type a number.

---

#### Recommendation Delivery Format (Slack Block Kit)

The outbound recommendation message sent to Slack:

```json
{
  "channel": "C0123MEMPHIS",
  "text": "New optimization recommendation: Increase naphtha yield by 8% on FCC Units 1 and 2. Est. impact: +$44,000/day",
  "blocks": [
    {
      "type": "header",
      "text": {"type": "plain_text", "text": "Optimization Recommendation"}
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Trigger:* 3-2-1 Crack Spread widened 10.8% ($16.65 -> $18.45/bbl)\n*Confidence:* High"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "Crack spreads widened $1.80/bbl in the last 2 hours. Recommend increasing naphtha yield by 8% on FCC Units 1 and 2.\n\n*Estimated margin impact: +$44,000/day* at current throughput of 85,200 bpd."
      }
    },
    {
      "type": "context",
      "elements": [
        {"type": "mrkdwn", "text": "Accounts for: HX-201 fouling constraint | Cat regen limit"},
        {"type": "mrkdwn", "text": "1 sensor substituted (HX-201 outlet temp)"}
      ]
    },
    {
      "type": "divider"
    },
    {
      "type": "actions",
      "block_id": "rec_actions_20260327_001",
      "elements": [
        {
          "type": "button",
          "text": {"type": "plain_text", "text": "Accept"},
          "style": "primary",
          "action_id": "rec_accept",
          "value": "rec_20260327_001"
        },
        {
          "type": "button",
          "text": {"type": "plain_text", "text": "Reject / Add Constraint"},
          "style": "danger",
          "action_id": "rec_reject_start",
          "value": "rec_20260327_001"
        },
        {
          "type": "button",
          "text": {"type": "plain_text", "text": "Defer"},
          "action_id": "rec_defer",
          "value": "rec_20260327_001"
        },
        {
          "type": "button",
          "text": {"type": "plain_text", "text": "View Details"},
          "action_id": "rec_view_detail",
          "value": "rec_20260327_001",
          "url": "https://app.reflexoptimize.com/sites/site_valero_memphis/recommendations/rec_20260327_001"
        }
      ]
    },
    {
      "type": "context",
      "elements": [
        {"type": "mrkdwn", "text": "Expires in 12 hours | <https://app.reflexoptimize.com/sites/site_valero_memphis/recommendations|View all recommendations>"}
      ]
    }
  ]
}
```

---

### 5.2 Teams Integration

#### POST /v1/webhooks/teams/messages

Handles incoming messages and card action callbacks from Microsoft Teams.

**Auth:** `hmac-signature` (Microsoft Bot Framework JWT validation against `https://login.botframework.com/v1/.well-known/openidconfiguration`)
**Rate limit:** `webhook`

**Inbound Payload (Adaptive Card action -- accept):**

```json
{
  "type": "invoke",
  "name": "adaptiveCard/action",
  "value": {
    "action": "rec_accept",
    "recommendation_id": "rec_20260327_001"
  },
  "from": {
    "id": "29:1abc...",
    "name": "Mike Johnson",
    "aadObjectId": "aad-object-id-123"
  },
  "channelData": {
    "tenant": {"id": "valero-tenant-id"}
  }
}
```

**Response (200 OK):**

```json
{
  "statusCode": 200,
  "type": "application/vnd.microsoft.card.adaptive",
  "value": {
    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
    "type": "AdaptiveCard",
    "version": "1.5",
    "body": [
      {
        "type": "TextBlock",
        "text": "Recommendation accepted by Mike Johnson",
        "weight": "Bolder"
      }
    ]
  }
}
```

---

#### Recommendation Delivery Format (Teams Adaptive Card)

```json
{
  "type": "message",
  "attachments": [
    {
      "contentType": "application/vnd.microsoft.card.adaptive",
      "content": {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard",
        "version": "1.5",
        "body": [
          {
            "type": "TextBlock",
            "text": "Optimization Recommendation",
            "weight": "Bolder",
            "size": "Large"
          },
          {
            "type": "FactSet",
            "facts": [
              {"title": "Trigger", "value": "3-2-1 Crack Spread widened 10.8%"},
              {"title": "Confidence", "value": "High"},
              {"title": "Affected Units", "value": "FCC Unit 1, FCC Unit 2"}
            ]
          },
          {
            "type": "TextBlock",
            "text": "Crack spreads widened $1.80/bbl in the last 2 hours. Recommend increasing naphtha yield by 8% on FCC Units 1 and 2.",
            "wrap": true
          },
          {
            "type": "TextBlock",
            "text": "**Estimated margin impact: +$44,000/day**",
            "weight": "Bolder",
            "color": "Good"
          },
          {
            "type": "TextBlock",
            "text": "Accounts for: HX-201 fouling constraint | Cat regen limit. 1 sensor substituted.",
            "size": "Small",
            "isSubtle": true,
            "wrap": true
          }
        ],
        "actions": [
          {
            "type": "Action.Execute",
            "title": "Accept",
            "verb": "rec_accept",
            "data": {"recommendation_id": "rec_20260327_001"},
            "style": "positive"
          },
          {
            "type": "Action.Execute",
            "title": "Reject / Add Constraint",
            "verb": "rec_reject_start",
            "data": {"recommendation_id": "rec_20260327_001"},
            "style": "destructive"
          },
          {
            "type": "Action.Execute",
            "title": "Defer",
            "verb": "rec_defer",
            "data": {"recommendation_id": "rec_20260327_001"}
          },
          {
            "type": "Action.OpenUrl",
            "title": "View Details",
            "url": "https://app.reflexoptimize.com/sites/site_valero_memphis/recommendations/rec_20260327_001"
          }
        ]
      }
    }
  ]
}
```

The Teams constraint input flow follows the same structured pattern as Slack, using Adaptive Card `Input.ChoiceSet` elements for equipment, constraint type, severity, and duration selections.

---

### 5.3 Email Fallback

For sites where neither Slack nor Teams is available, or as a universal fallback.

#### Internal: POST /v1/internal/messaging/email

Sends a recommendation summary email. Not a public endpoint.

**Auth:** `service-token`

**Request:**

```json
{
  "recommendation_id": "rec_20260327_001",
  "site_id": "site_valero_memphis",
  "recipients": ["mjohnson@valero.com", "srodriguez@valero.com"],
  "subject": "Reflex Recommendation: Increase naphtha yield on FCC Units 1 & 2 (+$44K/day)",
  "action_url": "https://app.reflexoptimize.com/sites/site_valero_memphis/recommendations/rec_20260327_001"
}
```

The email contains a summary and a link to the dashboard where the user can respond via the web UI.

---

## 6. Internal Service APIs

These APIs are used for service-to-service communication within the Reflex backend. They are not exposed publicly. All use `service-token` authentication.

**Base path:** `/v1/internal`

### 6.1 Trigger Engine to LP Orchestrator

#### POST /v1/internal/lp/solve

Request an LP model solve. Called by the Trigger Engine when a process or price trigger fires.

**Auth:** `service-token` (audience: `lp-orchestrator`)

**Request:**

```json
{
  "solve_id": "solve_20260327_083005",
  "site_id": "site_valero_memphis",
  "trigger": {
    "id": "trg_price_crack_spread",
    "type": "price",
    "fired_at": "2026-03-27T08:30:00Z",
    "data": {
      "symbol": "USGC_CRACK_321",
      "previous_value": 16.65,
      "current_value": 18.45,
      "change_percent": 10.8
    }
  },
  "inputs": {
    "process_data": {
      "snapshot_at": "2026-03-27T08:29:55Z",
      "tags": {
        "FCC.REACTOR.TEMP.PV": {"value": 982.4, "quality": "good"},
        "CDU.FEED.RATE.PV": {"value": 85200.0, "quality": "good"},
        "HX201.OUTLET.TEMP.PV": {"value": 485.0, "quality": "substituted", "substitute_source": "HX201.INLET.TEMP.PV"}
      }
    },
    "market_data": {
      "snapshot_at": "2026-03-27T08:25:00Z",
      "prices": {
        "USGC_CRACK_321": 18.45,
        "WTI_CUSHING": 71.82,
        "USGC_ULSD": 2.4350
      }
    },
    "active_constraints": [
      {
        "id": "con_hx201_fouling",
        "parameter": "FCC1_THROUGHPUT",
        "bound_type": "upper",
        "value": 55000,
        "unit": "bpd"
      },
      {
        "id": "con_cat_regen_limit",
        "parameter": "FCC1_CAT_REGEN_RATE",
        "bound_type": "upper",
        "value": 0.85,
        "unit": "fraction"
      }
    ]
  },
  "priority": "normal",
  "callback_url": "/v1/internal/trigger-engine/solve-complete"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `solve_id` | string | Unique solve identifier for tracing |
| `inputs.process_data` | object | Validated, quality-checked sensor snapshot from the Data Quality Gateway |
| `inputs.market_data` | object | Latest market prices |
| `inputs.active_constraints` | array | All active constraints from the Constraint Registry, translated into LP variable bounds |
| `priority` | enum | `"normal"`, `"high"` (operator-requested re-solve), `"low"` (background reconciliation) |
| `callback_url` | string | Where to POST the result when the solve completes |

**Response (202 Accepted):**

```json
{
  "solve_id": "solve_20260327_083005",
  "status": "queued",
  "estimated_duration_seconds": 30,
  "queue_position": 0
}
```

---

#### POST /v1/internal/trigger-engine/solve-complete

Callback from LP Orchestrator when a solve completes.

**Auth:** `service-token` (audience: `trigger-engine`)

**Request:**

```json
{
  "solve_id": "solve_20260327_083005",
  "site_id": "site_valero_memphis",
  "status": "optimal",
  "started_at": "2026-03-27T08:30:05Z",
  "completed_at": "2026-03-27T08:30:38Z",
  "duration_seconds": 33,
  "result": {
    "objective_value": 1284500.00,
    "previous_objective_value": 1240100.00,
    "delta": 44400.00,
    "delta_meaningful": true,
    "key_changes": [
      {
        "variable": "FCC1_NAPHTHA_YIELD",
        "previous": 0.32,
        "recommended": 0.40,
        "unit": "fraction",
        "equipment_id": "equip_fcc_01",
        "description": "FCC Unit 1 Naphtha Yield Target"
      },
      {
        "variable": "FCC2_NAPHTHA_YIELD",
        "previous": 0.33,
        "recommended": 0.41,
        "unit": "fraction",
        "equipment_id": "equip_fcc_02",
        "description": "FCC Unit 2 Naphtha Yield Target"
      }
    ],
    "binding_constraints": ["con_hx201_fouling", "con_cat_regen_limit"],
    "solver_iterations": 142,
    "solver_status": "optimal"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | enum | `"optimal"`, `"infeasible"`, `"unbounded"`, `"timeout"`, `"error"` |
| `result.delta_meaningful` | boolean | Whether the delta exceeds the configured minimum threshold (avoids trivial recommendations) |
| `result.key_changes` | array | Deterministically extracted variable changes. These are the hard numbers that the AI Translation service must preserve exactly. |
| `result.binding_constraints` | array | Which constraints from the registry were binding (active at their limit) in the solution |

---

### 6.2 LP Orchestrator to AI Translation

#### POST /v1/internal/ai/translate

Translate LP solve results into plain-English recommendation text. The key design principle: all numerical values are passed in structured fields and must be preserved exactly. The LLM generates only the natural language context.

**Auth:** `service-token` (audience: `ai-translation`)

**Request:**

```json
{
  "solve_id": "solve_20260327_083005",
  "site_id": "site_valero_memphis",
  "trigger": {
    "type": "price",
    "name": "3-2-1 Crack Spread Movement",
    "data": {
      "symbol": "USGC_CRACK_321",
      "previous_value": 16.65,
      "current_value": 18.45,
      "change_percent": 10.8,
      "trailing_average": 16.20
    }
  },
  "lp_result": {
    "delta": 44400.00,
    "key_changes": [
      {
        "variable": "FCC1_NAPHTHA_YIELD",
        "previous": 0.32,
        "recommended": 0.40,
        "unit": "fraction",
        "equipment_id": "equip_fcc_01",
        "description": "FCC Unit 1 Naphtha Yield Target"
      },
      {
        "variable": "FCC2_NAPHTHA_YIELD",
        "previous": 0.33,
        "recommended": 0.41,
        "unit": "fraction",
        "equipment_id": "equip_fcc_02",
        "description": "FCC Unit 2 Naphtha Yield Target"
      }
    ],
    "binding_constraints": ["con_hx201_fouling", "con_cat_regen_limit"]
  },
  "context": {
    "current_throughput_bpd": 85200,
    "active_constraints": [
      {"id": "con_hx201_fouling", "description": "HX-201 fouling - FCC1 capped at 55,000 bpd"},
      {"id": "con_cat_regen_limit", "description": "Catalyst regeneration rate limited"}
    ],
    "sensor_substitutions": [
      {"tag": "HX201.OUTLET.TEMP.PV", "substituted_with": "HX201.INLET.TEMP.PV", "days_active": 9}
    ],
    "operating_mode": "normal",
    "site_timezone": "America/Chicago"
  }
}
```

**Response (200 OK):**

```json
{
  "solve_id": "solve_20260327_083005",
  "translation": {
    "summary": "Crack spreads widened $1.80/bbl in the last 2 hours. Recommend increasing naphtha yield by 8% on FCC Units 1 and 2.",
    "detail": "The USGC 3-2-1 crack spread has moved from $16.65/bbl to $18.45/bbl (up 10.8%) over the past 2 hours, now well above the 20-day trailing average of $16.20/bbl. The LP model recommends shifting FCC naphtha yield targets from 32-33% up to 40-41% on both FCC units to capture the improved gasoline margin. This accounts for the current Heat Exchanger 201 fouling constraint and catalyst regeneration limit. At current throughput of 85,200 bpd, the estimated additional margin is $44,400 per day.",
    "estimated_margin_impact": {"cents": 4400000, "currency": "USD"},
    "confidence": "high",
    "confidence_notes": "All primary sensor readings validated. 1 substituted sensor (HX-201 outlet temp) -- substitution has been stable for 9 days."
  },
  "validation": {
    "passed": true,
    "checks": [
      {"check": "delta_matches", "passed": true, "detail": "Translation mentions $44,400 which matches LP delta of 44400.00"},
      {"check": "direction_correct", "passed": true, "detail": "Translation says 'increasing' naphtha yield, matches positive delta"},
      {"check": "equipment_ids_correct", "passed": true, "detail": "FCC Units 1 and 2 mentioned, matches key_changes"},
      {"check": "no_fabricated_numbers", "passed": true, "detail": "All numbers in translation trace to source data"}
    ]
  },
  "prompt_version": "rec_translate_v3.2",
  "model": "claude-sonnet-4-20250514",
  "tokens_used": {"input": 842, "output": 312},
  "latency_ms": 1200
}
```

The `validation` section is critical. Every number in the translation is cross-validated against the source LP output and trigger data. If any validation check fails, the system falls back to a deterministic template.

---

#### POST /v1/internal/ai/extract-constraint

Extract structured constraint data from free-text operator input (used as a supplementary path when operators provide additional context beyond the structured form).

**Auth:** `service-token` (audience: `ai-translation`)

**Request:**

```json
{
  "site_id": "site_valero_memphis",
  "text": "Heat exchanger 201 is fouling badly, can only run FCC at about 55k",
  "source_user_id": "user_mike_j",
  "context": {
    "related_recommendation_id": "rec_20260327_001",
    "equipment_catalog": [
      {"id": "equip_fcc_01", "name": "FCC Unit 1", "design_capacity": 65000, "capacity_unit": "bpd"},
      {"id": "equip_fcc_02", "name": "FCC Unit 2", "design_capacity": 60000, "capacity_unit": "bpd"}
    ]
  }
}
```

**Response (200 OK):**

```json
{
  "extraction": {
    "confidence": 0.88,
    "equipment_id": "equip_fcc_01",
    "constraint_type": "capacity_limit",
    "severity": "hard",
    "parameter": "throughput",
    "extracted_limit": 55000,
    "extracted_limit_unit": "bpd",
    "reason_category": "equipment_issue",
    "reason_detail": "Heat exchanger 201 fouling",
    "interpretation": "I interpreted 'about 55k' as a throughput limit of 55,000 bpd on FCC Unit 1 due to HX-201 fouling."
  },
  "confirmation_required": true,
  "suggested_options": [
    {"label": "50,000 bpd", "value": 50000},
    {"label": "55,000 bpd", "value": 55000},
    {"label": "60,000 bpd", "value": 60000}
  ],
  "prompt_version": "constraint_extract_v2.1",
  "model": "claude-sonnet-4-20250514",
  "tokens_used": {"input": 520, "output": 180}
}
```

`confirmation_required` is always `true`. Extracted constraints are never auto-applied. The `suggested_options` array is presented back to the operator as button choices.

---

### 6.3 AI Translation to Messaging Service

#### POST /v1/internal/messaging/deliver

Deliver a recommendation to the configured messaging channels for a site.

**Auth:** `service-token` (audience: `messaging-service`)

**Request:**

```json
{
  "recommendation_id": "rec_20260327_001",
  "site_id": "site_valero_memphis",
  "translation": {
    "summary": "Crack spreads widened $1.80/bbl in the last 2 hours. Recommend increasing naphtha yield by 8% on FCC Units 1 and 2.",
    "detail": "...",
    "estimated_margin_impact": {"cents": 4400000, "currency": "USD"},
    "confidence": "high"
  },
  "channels": [
    {
      "type": "slack",
      "workspace_id": "T0123VALERO",
      "channel_id": "C0123MEMPHIS"
    },
    {
      "type": "email",
      "recipients": ["mjohnson@valero.com"]
    }
  ],
  "priority": "normal",
  "expires_at": "2026-03-27T20:31:00Z"
}
```

**Response (202 Accepted):**

```json
{
  "recommendation_id": "rec_20260327_001",
  "deliveries": [
    {
      "channel": "slack",
      "status": "sent",
      "message_id": "1711525865.001234",
      "delivered_at": "2026-03-27T08:31:05Z"
    },
    {
      "channel": "email",
      "status": "queued",
      "estimated_delivery": "2026-03-27T08:31:30Z"
    }
  ]
}
```

---

### 6.4 Reconciliation Engine (Internal)

#### POST /v1/internal/reconciliation/evaluate

Called periodically (daily or after each LP solve) to compare predicted vs. actual yields and flag coefficient drift.

**Auth:** `service-token` (audience: `reconciliation-engine`)

**Request:**

```json
{
  "site_id": "site_valero_memphis",
  "solve_id": "solve_20260327_083005",
  "evaluation_window": {
    "from": "2026-03-27T00:00:00Z",
    "to": "2026-03-27T08:00:00Z"
  },
  "predictions": [
    {
      "coefficient_id": "coeff_fcc1_naphtha_yield",
      "variable": "FCC1_NAPHTHA_YIELD",
      "predicted": 0.080,
      "equipment_id": "equip_fcc_01"
    }
  ],
  "actuals": [
    {
      "coefficient_id": "coeff_fcc1_naphtha_yield",
      "variable": "FCC1_NAPHTHA_YIELD",
      "measured": 0.042,
      "measurement_source": "lab_analysis",
      "measurement_timestamp": "2026-03-27T06:00:00Z"
    }
  ]
}
```

**Response (200 OK):**

```json
{
  "results": [
    {
      "coefficient_id": "coeff_fcc1_naphtha_yield",
      "drift_percent": -47.5,
      "status": "critical",
      "previous_status": "flagged",
      "consecutive_days": 40,
      "suggested_correction": 0.045,
      "ai_explanation_requested": true
    }
  ]
}
```

---

## Appendix A: Database Schema Summary

For reference, the key entities and their relationships:

```
sites
  |-- equipment_units (1:N)
  |     |-- sensor_tags (1:N)
  |     |-- constraints (1:N)
  |
  |-- triggers (1:N)
  |-- recommendations (1:N)
  |     |-- recommendation_actions (1:N)
  |     |-- recommendation_feedback (1:1)
  |
  |-- constraints (1:N)
  |     |-- constraint_history (1:N)
  |
  |-- coefficients (1:N)
  |     |-- coefficient_evaluations (1:N)
  |
  |-- edge_agents (1:N)
  |     |-- heartbeats (1:N, time-series)
  |
  |-- users (N:M via site_access)
  |-- api_keys (1:N)
  |-- audit_log (1:N, append-only)

Time-series (separate store):
  |-- sensor_readings (tag, timestamp, value, quality)
  |-- market_prices (symbol, timestamp, value)
```

---

## Appendix B: Endpoint Summary Table

| # | Method | Path | Auth | Rate Tier |
|---|--------|------|------|-----------|
| **Edge Agent** | | | | |
| 1 | POST | `/v1/edge/ingest` | edge-api-key | edge-ingest |
| 2 | POST | `/v1/edge/ingest/market` | edge-api-key | edge-ingest |
| 3 | POST | `/v1/edge/heartbeat` | edge-api-key | edge-config |
| 4 | GET | `/v1/edge/config` | edge-api-key | edge-config |
| 5 | POST | `/v1/edge/operating-mode` | edge-api-key | edge-config |
| **Auth** | | | | |
| 6 | POST | `/v1/auth/login` | public | 5/min/IP |
| 7 | POST | `/v1/auth/refresh` | public | 10/min/IP |
| 8 | POST | `/v1/auth/logout` | jwt-bearer | dashboard-write |
| **Sites** | | | | |
| 9 | GET | `/v1/sites` | jwt-bearer | dashboard-read |
| 10 | POST | `/v1/sites` | jwt-bearer (platform_admin) | admin |
| 11 | GET | `/v1/sites/{site_id}` | jwt-bearer | dashboard-read |
| 12 | PUT | `/v1/sites/{site_id}` | jwt-bearer (site_admin+) | dashboard-write |
| 13 | GET | `/v1/sites/{site_id}/equipment` | jwt-bearer | dashboard-read |
| 14 | POST | `/v1/sites/{site_id}/equipment` | jwt-bearer (site_admin) | dashboard-write |
| 15 | GET | `/v1/sites/{site_id}/tags` | jwt-bearer | dashboard-read |
| 16 | PUT | `/v1/sites/{site_id}/tags/{tag_id}/substitution` | jwt-bearer (lp_planner+) | dashboard-write |
| 17 | GET | `/v1/sites/{site_id}/operating-mode` | jwt-bearer | dashboard-read |
| 18 | PUT | `/v1/sites/{site_id}/operating-mode` | jwt-bearer (shift_supervisor+) | dashboard-write |
| **Triggers** | | | | |
| 19 | GET | `/v1/sites/{site_id}/triggers` | jwt-bearer (lp_planner+) | dashboard-read |
| 20 | POST | `/v1/sites/{site_id}/triggers` | jwt-bearer (lp_planner+) | dashboard-write |
| 21 | PUT | `/v1/sites/{site_id}/triggers/{trigger_id}` | jwt-bearer (lp_planner+) | dashboard-write |
| 22 | DELETE | `/v1/sites/{site_id}/triggers/{trigger_id}` | jwt-bearer (site_admin) | dashboard-write |
| **Recommendations** | | | | |
| 23 | GET | `/v1/sites/{site_id}/recommendations` | jwt-bearer | dashboard-read |
| 24 | GET | `/v1/sites/{site_id}/recommendations/{id}` | jwt-bearer | dashboard-read |
| 25 | POST | `/v1/sites/{site_id}/recommendations/{id}/respond` | jwt-bearer (operator+) | dashboard-write |
| **Constraints** | | | | |
| 26 | GET | `/v1/sites/{site_id}/constraints` | jwt-bearer | dashboard-read |
| 27 | POST | `/v1/sites/{site_id}/constraints` | jwt-bearer (lp_planner+) | dashboard-write |
| 28 | PUT | `/v1/sites/{site_id}/constraints/{id}` | jwt-bearer (shift_supervisor+) | dashboard-write |
| 29 | POST | `/v1/sites/{site_id}/constraints/{id}/clear` | jwt-bearer (shift_supervisor+) | dashboard-write |
| 30 | GET | `/v1/sites/{site_id}/constraints/{id}/history` | jwt-bearer | dashboard-read |
| **Analytics** | | | | |
| 31 | GET | `/v1/sites/{site_id}/analytics/opportunity-cost` | jwt-bearer (lp_planner+) | dashboard-read |
| 32 | GET | `/v1/sites/{site_id}/analytics/coefficient-reconciliation` | jwt-bearer (lp_planner+) | dashboard-read |
| 33 | GET | `/v1/sites/{site_id}/analytics/sensor-health` | jwt-bearer | dashboard-read |
| 34 | GET | `/v1/sites/{site_id}/analytics/system-health` | jwt-bearer | dashboard-read |
| **Admin** | | | | |
| 35 | GET | `/v1/admin/users` | jwt-bearer (site_admin+) | admin |
| 36 | POST | `/v1/admin/users` | jwt-bearer (site_admin+) | admin |
| 37 | PUT | `/v1/admin/users/{user_id}` | jwt-bearer (site_admin+) | admin |
| 38 | DELETE | `/v1/admin/users/{user_id}` | jwt-bearer (platform_admin) | admin |
| 39 | GET | `/v1/admin/api-keys` | jwt-bearer (site_admin+) | admin |
| 40 | POST | `/v1/admin/api-keys` | jwt-bearer (platform_admin) | admin |
| 41 | DELETE | `/v1/admin/api-keys/{key_id}` | jwt-bearer (platform_admin) | admin |
| 42 | GET | `/v1/admin/audit-log` | jwt-bearer (site_admin+) | admin |
| **Webhooks** | | | | |
| 43 | POST | `/v1/webhooks/slack/interactions` | hmac-signature | webhook |
| 44 | POST | `/v1/webhooks/teams/messages` | hmac-signature | webhook |
| **Internal** | | | | |
| 45 | POST | `/v1/internal/lp/solve` | service-token | (internal) |
| 46 | POST | `/v1/internal/trigger-engine/solve-complete` | service-token | (internal) |
| 47 | POST | `/v1/internal/ai/translate` | service-token | (internal) |
| 48 | POST | `/v1/internal/ai/extract-constraint` | service-token | (internal) |
| 49 | POST | `/v1/internal/messaging/deliver` | service-token | (internal) |
| 50 | POST | `/v1/internal/messaging/email` | service-token | (internal) |
| 51 | POST | `/v1/internal/reconciliation/evaluate` | service-token | (internal) |
| **WebSocket** | | | | |
| 52 | WSS | `/v1/ws` | jwt-bearer (query param) | per-connection |

---

## Appendix C: Risk Mitigation Traceability

Every major API design decision traces to a specific risk from Run 1.

| Risk | Mitigation in API Design |
|------|--------------------------|
| R1 (Excel COM) | LP Orchestrator is async with callback pattern, queue backpressure, and timeout handling. Solve requests return 202 with estimated duration. |
| R2 (Delivery channel) | Multi-channel delivery (Slack + Teams + email fallback). Structured 5-tap constraint input in Slack modals and Teams Adaptive Cards. No free-text dependency. |
| R5 (LLM hallucination) | AI Translation response includes `validation` block. All numbers programmatically extracted in `lp_result.key_changes`. LLM generates only natural language. `confirmation_required: true` on all constraint extractions. |
| R6 (OT security) | Edge Agent API is outbound-only (agent pushes via POST). No inbound connections. Config sync is pull-based via GET. Commands delivered via heartbeat response. |
| R7 (OSHA/MOC) | `deployment_phase` field on sites tracks shadow_mode -> guided_adoption -> active. Operating mode is a first-class API concept with trigger suppression. |
| R8 (Union/blame) | Opportunity cost analytics group by equipment, never by operator. `capture_rate` framing, not "lost" framing. Audit log tracks actions but recommendation responses are attributed to the responding user only for workflow routing, not for scoring. |
| R9 (Alert fatigue) | Operating mode endpoint suppresses triggers during non-normal modes. Triggers have cooldown periods. `sustained_seconds` debouncing prevents transient spikes from firing. |
| R17 (Market data cost) | Separate `/edge/ingest/market` endpoint for customer-supplied data. No dependency on Reflex-purchased market feeds. |

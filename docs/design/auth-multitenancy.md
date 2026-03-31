# Authentication & Multi-Tenancy Design

> Subsystem of Reflex: governs user identity, tenant isolation, role-based access,
> edge agent authentication, and audit trail for a multi-site refinery platform.

---

## 1. Auth Strategy

### 1.1 Auth Flows Overview

Reflex has four distinct authentication surfaces, each with different trust models:

```
+---------------------+-------------------+----------------------------+
| Surface             | Auth Method       | Token/Credential Type      |
+---------------------+-------------------+----------------------------+
| Dashboard (web UI)  | JWT (OAuth 2.0)   | Short-lived access token   |
| Edge Agent          | API key + mTLS    | Rotating API key           |
| Slack bot           | Slack signatures  | HMAC signing secret        |
| Teams bot           | Azure Bot Svc     | JWT from Bot Framework     |
+---------------------+-------------------+----------------------------+
```

### 1.2 Dashboard User Authentication (JWT)

**Flow:** Authorization Code with PKCE (since the frontend is a SPA).

```
User Browser                Reflex Auth API           Identity Provider (optional)
     |                           |                           |
     |-- GET /login ------------>|                           |
     |                           |-- (if SSO) redirect ----->|
     |                           |<-- auth code -------------|
     |                           |                           |
     |<-- Set httpOnly cookies --|                           |
     |   (access_token,          |                           |
     |    refresh_token)         |                           |
```

For the MVP (1-5 sites), Reflex manages credentials directly (email + password with
bcrypt). No external IdP dependency. When customers require SSO (which larger refineries
will), add SAML 2.0 / OIDC support as a paid feature.

**Token format (JWT claims):**

```json
{
  "sub": "usr_a1b2c3d4",
  "email": "jane.smith@valero.com",
  "tenant_id": "tn_valero_memphis",
  "role": "lp_planner",
  "permissions": [
    "recommendations:read",
    "constraints:read",
    "constraints:write",
    "triggers:read",
    "triggers:write",
    "lp_config:read",
    "lp_config:write",
    "analytics:read"
  ],
  "site_ids": ["site_valero_memphis"],
  "iat": 1711540800,
  "exp": 1711544400,
  "iss": "reflex-auth"
}
```

**Token lifetimes:**

| Token | Lifetime | Storage |
|-------|----------|---------|
| Access token | 1 hour | httpOnly, Secure, SameSite=Strict cookie |
| Refresh token | 7 days | httpOnly, Secure, SameSite=Strict cookie |
| Refresh token (remember me) | 30 days | Same as above |

Refresh tokens are stored server-side in the database (hashed) to enable revocation.
On each refresh, the old refresh token is invalidated and a new one issued (rotation).

**Password requirements:**
- Minimum 12 characters
- Bcrypt with cost factor 12
- Breached password check against HaveIBeenPwned k-anonymity API
- Account lockout after 5 failed attempts (15-minute cooldown)

### 1.3 Edge Agent Authentication (API Key + mTLS)

Edge agents run on-premises at the refinery, pushing data to the Reflex cloud API.
They use a two-layer auth model:

**Layer 1 -- mTLS (transport security):**
- Each edge agent has a unique client certificate signed by the Reflex CA
- The Reflex API gateway validates the client cert on every TLS handshake
- Certificates are provisioned during site onboarding (see Section 4)
- Certificate lifetime: 1 year, with 30-day overlap for rotation

**Layer 2 -- API key (application-level auth):**
- Each edge agent has a unique API key that identifies the tenant
- API key is sent as `Authorization: Bearer reflex_edge_<key>` header
- The API key is validated against the database and mapped to a tenant_id
- API key lifetime: 90 days, with manual or automated rotation

Both layers must pass. mTLS alone is not sufficient (compromised cert without valid API
key is rejected). API key alone is not sufficient (no mTLS means the connection is refused
at the load balancer).

### 1.4 Slack Verification

Slack signs every request with a shared signing secret (HMAC-SHA256). Reflex verifies:

```python
def verify_slack_request(request, signing_secret: str) -> bool:
    timestamp = request.headers["X-Slack-Request-Timestamp"]
    # Reject requests older than 5 minutes (replay protection)
    if abs(time.time() - int(timestamp)) > 300:
        return False

    sig_basestring = f"v0:{timestamp}:{request.body}"
    expected = "v0=" + hmac.new(
        signing_secret.encode(), sig_basestring.encode(), hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected, request.headers["X-Slack-Signature"])
```

Each Slack workspace is mapped to a tenant_id in the `slack_integrations` table.
The Slack user ID is mapped to a Reflex user via the `user_slack_mappings` table, which
determines the user's role and permissions for any actions taken through Slack.

### 1.5 Teams Verification

Microsoft Teams uses Azure Bot Framework, which issues JWTs. Reflex validates:

1. JWT signature against Microsoft's public keys (fetched from the OpenID metadata endpoint)
2. `iss` claim matches `https://api.botframework.com`
3. `aud` claim matches the Reflex bot's app ID
4. Token is not expired

Each Teams tenant (Azure AD tenant ID) is mapped to a Reflex tenant_id.

### 1.6 Session Management

- Dashboard sessions are stateless (JWT-based). No server-side session store needed.
- Refresh tokens are the only server-side state, stored in the `refresh_tokens` table.
- "Log out everywhere" revokes all refresh tokens for a user.
- Admin can revoke all sessions for a specific user (e.g., when an employee leaves).
- Edge agent sessions are stateless (API key validated per request).

---

## 2. Multi-Tenancy Model

### 2.1 Decision: Shared Database with tenant_id Column

**Chosen approach:** Single database, shared tables, `tenant_id` column on every
tenant-scoped table, enforced at the ORM/middleware level.

**Why not separate databases per tenant?**
- At 1-50 sites, the operational overhead of managing 50 separate database instances
  (migrations, backups, monitoring, connection pooling) is prohibitive for a student team
- Cross-tenant analytics (e.g., aggregate platform metrics for Reflex's own business
  intelligence) become expensive cross-database queries
- Cost: 50 separate managed database instances would cost 50x a single instance

**Why not separate schemas?**
- Same migration overhead problem as separate databases
- PostgreSQL schema isolation is weaker than it appears (shared buffer pool,
  shared pg_catalog, cross-schema queries are trivially easy to write by accident)
- No meaningful security benefit over tenant_id with proper enforcement

**Why shared tables with tenant_id works at this scale:**
- 50 sites, each with ~100 sensor tags polled every 60 seconds = ~432M rows/year of
  time-series data. This is well within PostgreSQL's capabilities with partitioning.
- Row-level security (RLS) in PostgreSQL provides database-level enforcement as a
  second line of defense behind application middleware
- Single migration path, single backup strategy, single monitoring dashboard
- When (if) Reflex reaches 200+ sites, revisit with sharding by tenant_id

### 2.2 Tenant Isolation Enforcement (Three Layers)

**Layer 1 -- Middleware (primary enforcement):**

Every API request passes through tenant-scoping middleware that:
1. Extracts tenant_id from the JWT (dashboard) or API key (edge agent)
2. Injects it into the request context
3. All ORM queries automatically filter by tenant_id

```python
# Middleware pseudocode
class TenantMiddleware:
    async def __call__(self, request, call_next):
        # Extract tenant from auth token
        tenant_id = extract_tenant_from_auth(request)
        if tenant_id is None:
            return Response(status=401)

        # Set tenant context for this request
        request.state.tenant_id = tenant_id

        # All database queries in this request will be scoped
        with tenant_scope(tenant_id):
            response = await call_next(request)
        return response
```

**Layer 2 -- ORM scoping (defense in depth):**

The ORM (SQLAlchemy) uses a custom query class that automatically appends
`WHERE tenant_id = :current_tenant` to every SELECT, UPDATE, and DELETE.

```python
class TenantScopedQuery(Query):
    def get(self, ident):
        # Override get() to include tenant filter
        obj = super().get(ident)
        if obj and obj.tenant_id != get_current_tenant_id():
            return None  # Treat as not found
        return obj

    def __iter__(self):
        # Automatically add tenant filter to all queries
        self = self.filter_by(tenant_id=get_current_tenant_id())
        return super().__iter__()
```

**Layer 3 -- PostgreSQL Row-Level Security (last resort):**

Even if the application code has a bug that bypasses middleware and ORM scoping,
RLS prevents cross-tenant data access at the database level.

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON recommendations
    USING (tenant_id = current_setting('app.current_tenant_id')::text);

-- The application sets this at connection start:
-- SET app.current_tenant_id = 'tn_valero_memphis';
```

### 2.3 Tables That Are Tenant-Scoped vs Global

| Scope | Tables |
|-------|--------|
| **Tenant-scoped** (has tenant_id) | users, recommendations, constraints, lp_snapshots, lp_deltas, sensor_readings (partitioned), market_data, trigger_configs, equipment, cell_maps, audit_log, feedback, coefficient_reconciliations, sensor_substitutions, opportunity_costs, slack_integrations, teams_integrations |
| **Global** (no tenant_id) | platform_config, prompt_templates, prompt_versions, claude_usage_log (has tenant_id for billing but readable by platform admins), migration_history |

---

## 3. RBAC Model

### 3.1 Role Definitions

```
+---------------------+------------------------------------------------------+
| Role                | Description                                          |
+---------------------+------------------------------------------------------+
| site_admin          | Full site configuration, user management             |
| plant_manager       | All dashboards, constraint management, financials    |
| lp_planner          | Trigger config, LP model settings, recommendations   |
| process_engineer    | Recommendations, constraints, analytics              |
| operator_supervisor | Recommendations, structured feedback                 |
+---------------------+------------------------------------------------------+
```

### 3.2 Permission Matrix

Permissions are stored as a flat list of strings in the JWT. The API checks permissions,
not roles, so that custom roles can be created later without changing authorization logic.

```
Permission                  | site_admin | plant_mgr | lp_planner | proc_eng | oper_sup
----------------------------|------------|-----------|------------|----------|---------
users:read                  |     X      |           |            |          |
users:write                 |     X      |           |            |          |
users:invite                |     X      |    X      |            |          |
site_config:read            |     X      |    X      |     X      |          |
site_config:write           |     X      |           |            |          |
equipment:read              |     X      |    X      |     X      |    X     |    X
equipment:write             |     X      |           |     X      |          |
triggers:read               |     X      |    X      |     X      |    X     |
triggers:write              |     X      |           |     X      |          |
lp_config:read              |     X      |    X      |     X      |          |
lp_config:write             |     X      |           |     X      |          |
recommendations:read        |     X      |    X      |     X      |    X     |    X
constraints:read            |     X      |    X      |     X      |    X     |    X
constraints:write           |     X      |    X      |     X      |    X     |    X
constraints:clear           |     X      |    X      |     X      |          |
analytics:read              |     X      |    X      |     X      |    X     |
analytics:financial         |     X      |    X      |            |          |
feedback:write              |     X      |    X      |     X      |    X     |    X
feedback:read               |     X      |    X      |     X      |    X     |
coefficients:read           |     X      |    X      |     X      |    X     |
coefficients:write          |     X      |           |     X      |          |
sensor_substitutions:read   |     X      |    X      |     X      |    X     |    X
sensor_substitutions:write  |     X      |           |     X      |    X     |
audit:read                  |     X      |    X      |            |          |
audit:export                |     X      |           |            |          |
```

### 3.3 Role-to-Permission Mapping (Database)

```sql
CREATE TABLE roles (
    id          TEXT PRIMARY KEY,               -- e.g., 'lp_planner'
    tenant_id   TEXT NOT NULL REFERENCES tenants(id),
    name        TEXT NOT NULL,                  -- e.g., 'LP Planner'
    description TEXT,
    is_default  BOOLEAN DEFAULT FALSE,          -- one of the 5 built-in roles
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE role_permissions (
    role_id     TEXT NOT NULL REFERENCES roles(id),
    permission  TEXT NOT NULL,                  -- e.g., 'recommendations:read'
    PRIMARY KEY (role_id, permission)
);

CREATE TABLE user_roles (
    user_id     TEXT NOT NULL REFERENCES users(id),
    role_id     TEXT NOT NULL REFERENCES roles(id),
    tenant_id   TEXT NOT NULL REFERENCES tenants(id),
    granted_by  TEXT NOT NULL REFERENCES users(id),
    granted_at  TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, role_id, tenant_id)
);
```

A user can have multiple roles at the same site (e.g., both lp_planner and process_engineer).
Permissions are unioned across all roles. A user can have roles at multiple sites if they
work across facilities (e.g., a regional LP coordinator).

### 3.4 Authorization Middleware

```python
def require_permission(permission: str):
    """Decorator for API endpoints that checks the caller has the required permission."""
    def decorator(func):
        @wraps(func)
        async def wrapper(request, *args, **kwargs):
            user_permissions = request.state.auth.permissions  # from JWT
            if permission not in user_permissions:
                return Response(
                    status=403,
                    body={"error": "forbidden", "required": permission}
                )
            return await func(request, *args, **kwargs)
        return wrapper
    return decorator

# Usage:
@router.post("/api/v1/triggers")
@require_permission("triggers:write")
async def create_trigger(request):
    ...
```

---

## 4. Edge Agent Authentication

### 4.1 API Key Lifecycle

**Generation:**

```python
def generate_edge_api_key(tenant_id: str, site_id: str) -> EdgeAPIKey:
    # Generate a cryptographically random key
    raw_key = secrets.token_urlsafe(32)  # 256 bits of entropy
    key_id = f"reflex_edge_{secrets.token_hex(4)}"

    # Store the hash, never the raw key
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

    db.insert("edge_api_keys", {
        "key_id": key_id,
        "key_hash": key_hash,
        "tenant_id": tenant_id,
        "site_id": site_id,
        "created_at": utcnow(),
        "expires_at": utcnow() + timedelta(days=90),
        "status": "active",
        "last_used_at": None,
        "created_by": get_current_user_id(),
    })

    # Return the raw key ONCE. It is never stored or retrievable.
    return EdgeAPIKey(
        key_id=key_id,
        raw_key=f"{key_id}:{raw_key}",  # Format: reflex_edge_a1b2c3d4:<secret>
        expires_at=utcnow() + timedelta(days=90),
    )
```

**Rotation:**

Keys are rotated every 90 days. The rotation process supports a 7-day overlap period:

1. Admin generates a new key via the dashboard (or automated cron triggers it)
2. New key is provisioned to the edge agent via the dashboard (copy-paste during setup)
   or via a secure key-delivery endpoint that the edge agent polls
3. Edge agent starts using the new key
4. Old key remains valid for 7 days (grace period)
5. Old key is automatically revoked after grace period

```
Day 0:  New key generated, old key still active
Day 1-7: Both keys valid (overlap period for deployment)
Day 7:  Old key revoked automatically
```

**Revocation:**

Immediate revocation for key compromise:

```python
def revoke_edge_key(key_id: str, reason: str):
    db.update("edge_api_keys",
        where={"key_id": key_id},
        set={"status": "revoked", "revoked_at": utcnow(), "revoke_reason": reason}
    )
    # Invalidate any cached key lookups
    cache.delete(f"edge_key:{key_id}")
    # Log to audit trail
    audit_log("edge_key_revoked", key_id=key_id, reason=reason)
    # Alert site admin
    notify_site_admins(tenant_id, f"Edge API key {key_id} revoked: {reason}")
```

### 4.2 mTLS Considerations

For the MVP (1-3 sites), mTLS adds significant complexity for marginal security benefit
when combined with API keys over HTTPS. The recommended approach:

**Phase 1 (MVP):** API key over HTTPS only. The edge agent connects to the Reflex API
via HTTPS (TLS 1.3, server cert validated). The API key provides application-level auth.
This is sufficient for pilot deployments where the edge agent sits in the customer's DMZ.

**Phase 2 (5+ sites):** Add mTLS. Each edge agent gets a unique client certificate.
The Reflex API gateway (e.g., nginx, Caddy, or cloud load balancer) validates client certs
before the request reaches the application. This provides transport-level authentication
that cannot be spoofed even if the API key leaks.

**Certificate provisioning (Phase 2):**
- Reflex operates a private CA (using cfssl or step-ca)
- During site onboarding, a CSR is generated on the edge agent
- The CSR is submitted to the Reflex CA via a one-time enrollment token
- The CA signs and returns the certificate (1-year validity)
- Auto-renewal: the edge agent requests a new cert 30 days before expiry

### 4.3 Key Compromise Response Plan

If an edge API key is suspected compromised:

1. **Immediate:** Revoke the compromised key (see revocation above)
2. **Immediate:** Generate a new key and provision it to the edge agent
3. **Within 1 hour:** Review audit logs for the compromised key -- look for:
   - Requests from unexpected IP addresses
   - Unusual request patterns (frequency, endpoints hit)
   - Any data that may have been exfiltrated
4. **Within 24 hours:** Notify the customer's IT security team
5. **Within 48 hours:** If mTLS is in use, also revoke and reissue the client certificate
6. **Post-incident:** Add the source IP(s) of unauthorized requests to the blocklist

---

## 5. Audit Trail

### 5.1 What Gets Logged

Every action that changes state or involves a decision is logged. The audit trail is
append-only -- entries cannot be modified or deleted (enforced by database triggers and
application-level immutability).

**Category A -- Recommendations (safety-critical, OSHA PSM relevant):**

| Event | Fields logged |
|-------|---------------|
| Recommendation generated | recommendation_id, delta_id, trigger_type, trigger_details, LP solve timestamp, Claude prompt hash, Claude response (full), validation result, template fallback used (y/n), delivery channel |
| Recommendation delivered | recommendation_id, delivery_channel, recipient_user_id, delivery_timestamp, delivery_status (sent/failed/retried) |
| Recommendation acknowledged | recommendation_id, user_id, action (approved/rejected/deferred), response_timestamp, response_latency_seconds |
| Recommendation overridden | recommendation_id, user_id, override_reason (structured), override_detail (text), constraint_id (if constraint created) |

**Category B -- Constraints (operational, OSHA PSM relevant):**

| Event | Fields logged |
|-------|---------------|
| Constraint submitted | constraint_id, user_id, equipment_id, constraint_type, severity, raw_input (verbatim), Claude interpretation (if used), interpretation_confirmed (y/n), final_parameters |
| Constraint activated | constraint_id, activated_by (user or system), LP re-solve triggered (y/n) |
| Constraint cleared | constraint_id, cleared_by_user_id, clear_reason, duration_active |
| Constraint expired | constraint_id, expiration_type (auto/manual) |

**Category C -- Configuration changes:**

| Event | Fields logged |
|-------|---------------|
| Trigger threshold changed | trigger_id, old_value, new_value, changed_by_user_id |
| Equipment config changed | equipment_id, field_changed, old_value, new_value, changed_by_user_id |
| Cell map updated | cell_map_version, changes_summary, changed_by_user_id |
| User role changed | target_user_id, old_roles, new_roles, changed_by_user_id |
| User invited/deactivated | target_user_id, action, by_user_id |
| Edge API key generated/revoked | key_id, action, by_user_id, reason |
| Sensor substitution configured | sensor_id, substitute_sensor_id, configured_by_user_id |

**Category D -- System events:**

| Event | Fields logged |
|-------|---------------|
| LP solve executed | solve_id, trigger_id, duration_ms, status (success/failure/timeout), error_detail |
| Claude API call | call_id, template_name, prompt_version, model_used, input_tokens, output_tokens, latency_ms, validation_result, cache_hit |
| Edge agent heartbeat | agent_id, last_data_timestamp, data_lag_seconds, status |
| Validation failure | call_id, failure_type, detail, fallback_used |

### 5.2 Audit Entry Schema

```sql
CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id),
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
    event_type      TEXT NOT NULL,           -- e.g., 'recommendation.generated'
    category        TEXT NOT NULL,           -- A, B, C, or D
    actor_type      TEXT NOT NULL,           -- 'user', 'edge_agent', 'system', 'cron'
    actor_id        TEXT,                    -- user_id, agent_id, or null for system
    resource_type   TEXT,                    -- 'recommendation', 'constraint', 'trigger', etc.
    resource_id     TEXT,                    -- ID of the affected resource
    equipment_id    TEXT,                    -- nullable; for equipment-scoped events
    summary         TEXT NOT NULL,           -- human-readable 1-line summary
    detail          JSONB NOT NULL,          -- full structured detail (varies by event_type)
    ip_address      INET,                   -- source IP
    user_agent      TEXT,                    -- source client
    request_id      TEXT,                    -- correlation ID for tracing

    -- Immutability enforcement: no UPDATE or DELETE triggers
    -- Partitioned by month for retention management
);

-- Partition by month
CREATE TABLE audit_log_2026_03 PARTITION OF audit_log
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- Indexes for common query patterns
CREATE INDEX idx_audit_tenant_time ON audit_log (tenant_id, timestamp DESC);
CREATE INDEX idx_audit_event_type ON audit_log (tenant_id, event_type, timestamp DESC);
CREATE INDEX idx_audit_resource ON audit_log (tenant_id, resource_type, resource_id);
CREATE INDEX idx_audit_actor ON audit_log (tenant_id, actor_id, timestamp DESC);
CREATE INDEX idx_audit_equipment ON audit_log (tenant_id, equipment_id, timestamp DESC)
    WHERE equipment_id IS NOT NULL;
```

### 5.3 Immutability Enforcement

```sql
-- Prevent any modification of audit entries
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries cannot be modified or deleted';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_immutable_update
    BEFORE UPDATE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER audit_immutable_delete
    BEFORE DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
```

Application-level: the audit_log ORM model has no `update()` or `delete()` methods.
The only public method is `append(event)`.

### 5.4 Retention Policy

| Category | Retention | Rationale |
|----------|-----------|-----------|
| A (Recommendations) | 7 years | OSHA PSM audits can look back 5 years; 7 provides margin |
| B (Constraints) | 7 years | Same as above; constraint decisions affect process safety |
| C (Config changes) | 5 years | Standard SOC 2 requirement |
| D (System events) | 1 year | Operational debugging; high volume, low compliance value |

Partitioning by month makes retention straightforward: drop partitions older than the
retention window. Category D partitions older than 13 months are dropped monthly via cron.
Categories A-C are archived to cold storage (S3/GCS) after 2 years and dropped from
the primary database after 7 years.

### 5.5 OSHA PSM Compliance Considerations

OSHA 29 CFR 1910.119 (Process Safety Management) requires:

1. **Management of Change (MOC):** Any change to process technology, equipment, or
   procedures requires documented review. Reflex recommendations that operators act on
   are arguably "procedure changes." The audit trail must capture:
   - What recommendation was made
   - What data drove it (the LP delta)
   - Who approved/executed it
   - When it was executed
   - What the actual outcome was

   Reflex's audit_log covers all of these. The recommendation -> acknowledgment ->
   outcome chain is fully traceable.

2. **Operating Procedures:** If Reflex becomes part of standard operating procedure
   (which it will after shadow mode), updates to Reflex's trigger thresholds or
   constraint rules may require MOC documentation. The config change audit trail
   (Category C) provides the evidence.

3. **Incident Investigation:** If a process incident occurs, investigators may ask
   whether Reflex made a recommendation in the hours leading up to the incident. The
   audit trail must support queries like:
   ```sql
   SELECT * FROM audit_log
   WHERE tenant_id = 'tn_valero_memphis'
     AND event_type LIKE 'recommendation.%'
     AND timestamp BETWEEN '2026-03-27T06:00:00Z' AND '2026-03-27T18:00:00Z'
   ORDER BY timestamp;
   ```

4. **Training Records:** OSHA requires documentation that operators were trained on any
   new tool. Reflex should track:
   - When each user first accessed the system
   - Whether they completed onboarding (if an onboarding flow exists)
   - When they first acknowledged a recommendation

   These are captured as system events (Category D) and user activity (Category A).

5. **Audit Access:** The `audit:read` and `audit:export` permissions (Section 3.2) allow
   site admins and plant managers to generate audit reports for PSM auditors. Export
   format: CSV with all fields, suitable for import into the customer's MOC tracking
   system.

---

## Appendix A: Database Schema for Auth Tables

```sql
-- Tenants
CREATE TABLE tenants (
    id              TEXT PRIMARY KEY,           -- e.g., 'tn_valero_memphis'
    name            TEXT NOT NULL,              -- e.g., 'Valero Memphis Refinery'
    slug            TEXT UNIQUE NOT NULL,       -- URL-safe identifier
    status          TEXT NOT NULL DEFAULT 'active',  -- active, suspended, decommissioned
    subscription_tier TEXT DEFAULT 'pilot',     -- pilot, standard, enterprise
    created_at      TIMESTAMPTZ DEFAULT now(),
    config          JSONB DEFAULT '{}'          -- site-level config overrides
);

-- Users
CREATE TABLE users (
    id              TEXT PRIMARY KEY,           -- e.g., 'usr_a1b2c3d4'
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,              -- bcrypt
    name            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active',  -- active, invited, deactivated
    created_at      TIMESTAMPTZ DEFAULT now(),
    last_login_at   TIMESTAMPTZ,
    failed_login_count INT DEFAULT 0,
    locked_until    TIMESTAMPTZ
);

-- User-tenant association (a user can belong to multiple tenants)
CREATE TABLE user_tenants (
    user_id         TEXT NOT NULL REFERENCES users(id),
    tenant_id       TEXT NOT NULL REFERENCES tenants(id),
    primary_tenant  BOOLEAN DEFAULT FALSE,
    joined_at       TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, tenant_id)
);

-- Roles (per tenant -- each tenant gets the 5 default roles + can create custom ones)
-- (See Section 3.3 for roles, role_permissions, user_roles tables)

-- Refresh tokens
CREATE TABLE refresh_tokens (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id),
    token_hash      TEXT NOT NULL,             -- SHA-256 of the token
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    revoked_at      TIMESTAMPTZ,
    replaced_by     TEXT REFERENCES refresh_tokens(id),  -- for rotation tracking
    ip_address      INET,
    user_agent      TEXT
);
CREATE INDEX idx_refresh_user ON refresh_tokens (user_id) WHERE revoked_at IS NULL;

-- Edge agent API keys
CREATE TABLE edge_api_keys (
    key_id          TEXT PRIMARY KEY,           -- e.g., 'reflex_edge_a1b2c3d4'
    key_hash        TEXT NOT NULL,              -- SHA-256 of the key
    tenant_id       TEXT NOT NULL REFERENCES tenants(id),
    site_id         TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active',  -- active, revoked, expired
    created_at      TIMESTAMPTZ DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    revoke_reason   TEXT,
    last_used_at    TIMESTAMPTZ,
    last_used_ip    INET,
    created_by      TEXT NOT NULL REFERENCES users(id)
);
CREATE INDEX idx_edge_keys_tenant ON edge_api_keys (tenant_id) WHERE status = 'active';

-- Slack integration mapping
CREATE TABLE slack_integrations (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id),
    slack_team_id   TEXT NOT NULL UNIQUE,       -- Slack workspace ID
    slack_team_name TEXT,
    signing_secret  TEXT NOT NULL,              -- encrypted at rest
    bot_token       TEXT NOT NULL,              -- encrypted at rest
    default_channel TEXT,                       -- channel for recommendations
    installed_at    TIMESTAMPTZ DEFAULT now(),
    installed_by    TEXT REFERENCES users(id)
);

-- Map Slack users to Reflex users
CREATE TABLE user_slack_mappings (
    user_id         TEXT NOT NULL REFERENCES users(id),
    tenant_id       TEXT NOT NULL REFERENCES tenants(id),
    slack_user_id   TEXT NOT NULL,
    slack_team_id   TEXT NOT NULL,
    mapped_at       TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (slack_user_id, slack_team_id)
);

-- Teams integration mapping
CREATE TABLE teams_integrations (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id),
    azure_tenant_id TEXT NOT NULL UNIQUE,       -- Azure AD tenant ID
    bot_app_id      TEXT NOT NULL,
    bot_app_secret  TEXT NOT NULL,              -- encrypted at rest
    service_url     TEXT,                       -- Bot Framework service URL
    installed_at    TIMESTAMPTZ DEFAULT now(),
    installed_by    TEXT REFERENCES users(id)
);
```

## Appendix B: Rate Limiting

To protect against abuse and accidental loops from edge agents:

| Endpoint group | Rate limit | Window | Scope |
|----------------|-----------|--------|-------|
| Auth (login, refresh) | 10 requests | 1 minute | Per IP |
| Dashboard API | 100 requests | 1 minute | Per user |
| Edge data push | 60 requests | 1 minute | Per API key |
| Slack/Teams webhooks | 30 requests | 1 minute | Per workspace |
| Claude translation (internal) | 20 requests | 1 minute | Per tenant |

Implemented via Redis sliding window counters. When a rate limit is exceeded, return
HTTP 429 with a `Retry-After` header.

Edge agent rate limiting is particularly important: a misconfigured polling loop
could flood the API. The 60 req/min limit allows 1 request per second, which is well
above the expected 1 request per 60 seconds for sensor data pushes.

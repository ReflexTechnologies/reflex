# Reflex Platform — Frontend, Dashboard & UX Architecture

> **Date:** 2026-03-27
> **Scope:** Complete frontend architecture specification for the Reflex industrial optimization platform
> **Inputs:** Product transcript, Run 1 risk matrix (R1-R20), Run 1 executive summary
> **Output for:** Agent 2E engineering spec assembly

---

## 1. Executive Summary

Reflex's frontend is designed around three non-negotiable principles derived from Run 1 risk analysis:

1. **Industrial-grade UX** following ISA-101 High Performance HMI and ISA-18.2 alarm management principles — every recommendation must be actionable, glanceable in under 3 seconds, and safe to use at 2AM on a 12-hour shift.
2. **Risk-driven audience separation** — management sees financial summaries by equipment/unit with "value captured" framing; operators never see individual override costs or loss-framed metrics (R8, Score 64).
3. **Structured interaction over free-text** — the 5-tap constraint input wizard replaces free-text Slack messages, eliminating PPE/glove impossibility and NLP extraction failures (R2, Score 125; R5, Score 80).

**Tech stack:** Next.js 15+ (React 19, TypeScript) | ECharts + Tremor | SSE + polling | Mantine + Shadcn/ui | TanStack Query + Zustand | Tailwind CSS

---

## 2. Design Philosophy & Industrial UX Principles

### 2.1 ISA-101 High Performance HMI Compliance

The visual language follows ISA-101.01-2015 and ASM Consortium HMI guidelines:

- **Greyscale backgrounds** — neutral dark grey (`#1A1B1E`) for dark mode (default), light grey (`#F5F5F5`) for light mode
- **Color for deviation only** — color is never decorative. It signals state:
  - Green: within range / healthy / captured value
  - Amber: approaching limit / warning / needs attention
  - Red: outside safe envelope / critical / requires immediate action
  - Grey/neutral: normal state, no attention needed
- **Information hierarchy** mirrors ISA-101 display levels:
  - Level 1: Site overview (all units at a glance)
  - Level 2: Unit overview (single unit, key parameters)
  - Level 3: Unit detail (full parameter set, trends)
  - Level 4: Diagnostic (trend analysis, coefficient reconciliation)

### 2.2 ISA-18.2 Alarm Management Alignment

Every recommendation Reflex delivers must be actionable per ISA-18.2 / IEC 62682 / EEMUA 191:

- If a recommendation requires no operator response, it must not appear in the feed
- Target: **1-2 recommendations per shift** during normal operations
- Track and display **actionability rate** (target >80% — the percentage of recommendations that operators act upon)
- Separate **safety alerts** (always active) from **economic optimization** (mode-gated)
- An "alarm flood" exceeding 10 recommendations in 10 minutes triggers automatic suppression with root-cause grouping

**Recommendation Priority Scheme:**

| Priority | Visual Treatment | Criteria | Example |
|----------|-----------------|----------|---------|
| Critical | Red background, white text | Safety-adjacent or >$100K/day impact | Pressure relief adjustment |
| High | Amber left border, bold text | >$50K/day impact, action needed this shift | Increase naphtha yield 8% |
| Medium | Cyan left border | $10-50K/day impact, can defer | Adjust diesel blend ratio |
| Advisory | Grey, muted text | <$10K/day, informational | Coefficient drift trending |

### 2.3 Cognitive Load Framework

Design for worst case: 2AM, 12-hour shift, fatigued operator, upset conditions.

- **3-second rule**: any dashboard screen must convey its primary status within 3 seconds without reading text
- **Progressive disclosure**: primary status visible by default → details on demand → diagnostics behind explicit drill-down
- **Maximum 5-7 information elements per screen zone** (Miller's law)
- **Pre-process information**: show conclusions, not raw data. Lead with the action ("Increase feed rate to 2,500 BPD"), not the analysis
- **Consistent spatial positioning**: elements never reflow or move — control room operators build spatial memory

Research context: SCADA operators experience cognitive load 340% above baseline during peak operations. During emergencies, one industrial incident recorded 275 alarms in 11 minutes. Interface simplicity is a safety requirement, not a preference.

### 2.4 Risk-Driven Design Decisions

Every frontend decision traces to a specific Run 1 risk:

| Risk | Score | Frontend Decision |
|------|-------|------------------|
| R2 (Delivery channel) | 125 | Primary user is shift supervisor at desk. Structured 5-tap constraint input. Slack/Teams for notifications + quick approvals; web dashboard for complex interactions. |
| R5 (LLM hallucination) | 80 | All numbers programmatically extracted and rendered in monospace. LLM generates context text only. Deterministic template fallback for LLM downtime. Every number cross-validated against source. |
| R8 (Dashboard blame) | 64 | Management dashboard shows financials by equipment/unit, never by operator. "Value captured" gain framing. Override data contractually restricted from performance evaluation. |
| R9 (Alert fatigue) | 64 | Operating mode as permanent first-class UI element. Auto-suppress optimization during non-normal modes. Percentage-based trigger thresholds. Target 1-2 recs/shift. |
| R14 (Algorithm aversion) | 36 | Shadow mode UX for first 2-4 weeks: recommendations shown alongside existing workflow. "Note Agreement/Disagreement" instead of "Acknowledge/Dismiss." |
| R15 (Shift handover) | 36 | Handover summary panel with acknowledgment flow. Active constraints persist through shift transitions. Integration with j5/ShiftConnector. |

---

## 3. Technology Stack

### 3.1 Framework: Next.js 15+ with React 19 and TypeScript

**Why Next.js:**
- **SSR** for fast initial dashboard loads on potentially slow control-room network connections
- **App Router** provides layout-based architecture matching the multi-dashboard structure
- **Server Components** reduce client bundle size (critical for thin-client control room terminals)
- **Built-in API routes** enable BFF (Backend-for-Frontend) pattern for proxying to backend services
- **React 19 Suspense** boundaries allow streaming dashboard sections independently

**Why not alternatives:**
- Vue/Nuxt: smaller ecosystem for industrial charting libraries; fewer pre-built data-dense component options
- SvelteKit: excellent performance but smaller talent pool for future hiring; minimal industrial dashboard precedent
- Plain React SPA: loses SSR benefits for initial load; no built-in routing optimization

**TypeScript rationale:** Type safety across the entire data pipeline — from API response to rendered number — prevents the class of numerical display errors that R5 targets. In a safety-critical domain, `number | undefined` catching a missing value at compile time is worth the overhead.

### 3.2 Charting: ECharts (Analytical) + Tremor (KPI Cards)

**ECharts** handles heavy analytical visualizations:
- Opportunity cost waterfall charts
- Coefficient drift timelines (30/90-day)
- Time-series process data overlays
- Sensor health heatmaps
- 60fps Canvas rendering, handles 10K+ data points
- Native dark mode theming
- React wrapper: `echarts-for-react`

**Tremor** handles KPI summary cards:
- Pre-built metric cards, gauges, simple sparklines
- "Show the data, hide the chrome" philosophy aligns with ISA-101
- Tailwind-native, seamless dark mode
- 35+ dashboard-oriented React components

**Why not alternatives:**
- D3: too low-level for a student team (20+ hours to intermediate proficiency)
- Recharts: SVG re-renders too slow for real-time streaming with 100+ data points
- Plotly: heavier bundle than ECharts; better for scientific/3D visualizations not needed here
- TradingView lightweight-charts: too specialized for financial candlestick charts

**Bundle strategy:** ECharts (~500KB) loaded only on analytical dashboard pages via dynamic import. Tremor (~150KB) available globally for KPI cards.

### 3.3 Real-Time Updates: SSE Primary, HTTP Polling Fallback

| Data Type | Strategy | Rationale |
|-----------|----------|-----------|
| Live recommendations | SSE stream | Must be immediate; 1-2 per shift is low volume |
| Operating mode changes | SSE stream | Mode changes must propagate instantly to all clients |
| Constraint registry updates | SSE stream | Moderate frequency; operators need current state |
| Sensor health | HTTP polling (60s) | Monitoring cadence; staleness acceptable |
| Analytics data | HTTP polling (5m) | Analytical, not time-critical |
| Site config | On-demand fetch | Rarely changes |

**Why SSE over WebSocket:**
- Unidirectional (server → client) matches the data flow — operators submit constraints via HTTP POST, not via the streaming connection
- Works through corporate proxies and firewalls better than WebSocket (critical for OT-adjacent IT networks)
- Built-in browser reconnection with configurable retry intervals
- Simpler to implement and debug
- HTTP/2 multiplexing support

**Fallback:** HTTP polling at 30-second intervals for environments where SSE is blocked. Recommendation updates are low-frequency (1-2/shift) so polling is fully acceptable.

**Implementation details:**
- SSE heartbeat every 20 seconds (prevents firewalls from terminating idle connections)
- Client-side offline queue via IndexedDB for constraint submissions during connectivity gaps
- JWT authentication on SSE endpoint
- "Last update: X seconds ago" badge visible on all dashboards

### 3.4 UI Component Library: Mantine v7 (Primary) + Shadcn/ui (Custom)

**Mantine** for the component foundation:
- Layout: AppShell, Grid, Stack, Group
- Navigation: NavLink, Tabs, Breadcrumbs
- Data display: Table (with sorting/filtering/pagination), Badge, Timeline, Progress
- Inputs: Select, NumberInput, SegmentedControl, Slider
- Feedback: Notification, Alert, Modal
- Built-in dark mode with theme provider
- WCAG AA+ accessibility compliance
- ~200KB bundle, lighter than Ant Design (~500KB)

**Shadcn/ui** for custom industrial components needing pixel-level control:
- Recommendation card (ISA-101 color compliance)
- Constraint input wizard (custom step flow)
- Operating mode indicator (custom color treatments)
- Copy-paste model = no runtime dependency, full styling control

**Why not Ant Design:** Heavier bundle, steeper learning curve, designed for large enterprise teams. Mantine's API is more accessible for a student team while covering the same functionality.

### 3.5 State Management: TanStack Query + Zustand

**TanStack Query (React Query)** for all server state:
- Automatic cache invalidation and background refetching
- Optimistic updates for constraint submissions (immediate UI feedback)
- Stale-while-revalidate for dashboard resilience during connectivity hiccups
- Configurable refetch intervals per data type (see Section 3.3 table)
- Server-side prefetching via Next.js for initial dashboard render

**Zustand** for UI-only state:
- Current dashboard view, active filters
- Sidebar collapsed/expanded
- Operating mode display state
- User preferences (theme, notification settings)
- Minimal API surface, no boilerplate — suitable for a student team

### 3.6 Styling: Tailwind CSS with ISA-101 Theme

Custom Tailwind configuration enforcing industrial design constraints:

```
Colors:     Grey/neutral scale (primary), status colors only (green/amber/red)
Spacing:    12px minimum gap between interactive elements
Font sizes: 14px minimum body text, 12px minimum metadata
Touch:      56px minimum interactive element height
```

Mantine integration via `@mantine/postcss-preset`. All ISA-101 color restrictions enforced at the theme token level — developers cannot accidentally use decorative color.

---

## 4. Application Architecture

### 4.1 Route Structure

```
/app
  /layout.tsx                 -- Root: auth, theme provider, SSE connection
  /(auth)/login               -- Authentication page
  /(dashboard)/layout.tsx     -- Dashboard shell: sidebar, header, mode banner
    /operations               -- Operations dashboard (default landing)
    /operations/feed          -- Recommendation feed (detachable for multi-monitor)
    /operations/constraints   -- Constraint registry (detachable for multi-monitor)
    /analytics                -- Analytics dashboard (management + LP planner)
    /analytics/opportunity    -- Opportunity cost detail (detachable)
    /analytics/coefficients   -- Coefficient drift detail (detachable)
    /analytics/sensors        -- Sensor health detail (detachable)
    /admin                    -- Admin dashboard (Admin role only)
      /sites                  -- Site management + onboarding wizard
      /users                  -- User management
      /connections            -- Historian / market data config
      /triggers               -- Trigger threshold config
```

Detachable routes (`/operations/feed`, `/operations/constraints`, etc.) support **multi-monitor control room setups** — each route renders a standalone panel that can be displayed on a separate monitor via separate browser windows.

### 4.2 Component Architecture

```
Shell Components
├── AppShell              -- Mantine AppShell with sidebar + header
├── Sidebar               -- Navigation, site selector, user menu
├── Header                -- Operating mode banner, shift info, connection health
├── OperatingModeBanner   -- Full-width mode indicator (Section 5.5)
└── ShiftContextBar       -- Current shift, time remaining, handover countdown

Page Components
├── OperationsDashboard   -- Recommendation feed + constraints + overrides
├── AnalyticsDashboard    -- Opportunity cost + coefficients + sensor health
└── AdminDashboard        -- Site config + connections + triggers + users

Feature Components
├── RecommendationFeed    -- SSE-driven live feed with priority sorting
├── RecommendationCard    -- Single recommendation with action buttons
├── ConstraintRegistry    -- Filterable/sortable constraint list by unit
├── ConstraintInputWizard -- 5-tap structured input flow (Section 5.2)
├── OpportunityCostChart  -- ECharts waterfall with gain framing
├── CoefficientDriftChart -- ECharts multi-line with drift threshold zones
├── SensorHealthMatrix    -- ECharts heatmap with click-to-detail
├── ShadowModeComparison  -- Side-by-side recommended vs. actual
├── ShiftHandoverPanel    -- Handover summary with acknowledgment flow
└── SiteOnboardingWizard  -- Multi-step admin setup flow

Shared Components
├── KPICard               -- Tremor metric card (value captured, actionability)
├── StatusBadge           -- Color-coded status indicator (shape + color + label)
├── TimeRangeSelector     -- 30d/90d/custom range picker
├── SiteSelector          -- Multi-site dropdown (admin/multi-site users)
├── ConfidenceIndicator   -- Low/Medium/High visual indicator
├── NumberDisplay         -- Monospace, programmatically rendered numbers (R5)
├── AuditTrailDrawer      -- Slide-out panel for constraint/recommendation history
└── ConnectionHealthDot   -- Green/amber/red dot with tooltip for system status
```

### 4.3 Data Fetching Strategy

| Data | Strategy | Cache TTL | Refetch | Why |
|------|----------|-----------|---------|-----|
| Active recommendations | SSE stream | N/A (real-time) | Continuous | Must be immediate |
| Operating mode | SSE stream | N/A | Continuous | Mode changes propagate instantly |
| Constraint registry | TanStack Query | 30s | 30s interval | Moderate frequency, brief staleness OK |
| Opportunity cost data | TanStack Query | 5m | 5m interval | Analytical, not time-critical |
| Coefficient drift | TanStack Query | 15m | 15m interval | Slow-moving trends |
| Sensor health | TanStack Query | 60s | 60s interval | Monitoring cadence |
| Site config / users | TanStack Query | Until mutation | On-demand | Rarely changes |

### 4.4 Authentication & Role-Based Access

Four roles with distinct dashboard access, enforced via Next.js middleware + server-side role check:

| Role | Operations | Analytics | Admin | Constraint Input | Financial Data |
|------|-----------|-----------|-------|-----------------|----------------|
| **Admin** | Full | Full | Full | Yes | Full |
| **LP Planner** | Full | Full | Trigger config only | Yes | Full |
| **Shift Supervisor** | Full | "Value captured" KPIs only | No | Yes | Gain-framed only |
| **Management** | View only | Full (by equipment, never by operator) | No | No | Full |

**R8 enforcement:** Management role sees financial summaries aggregated by equipment/unit. The system architecturally prevents individual operator override costs from appearing — the API does not return operator-level financial data for this role.

---

## 5. Dashboard Specifications

### 5.1 Operations Dashboard (Primary View)

Default landing page for shift supervisors and process engineers.

**Layout (1920x1080 minimum):**

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Site ▾] │ ● NORMAL │ Shift: Day (06:00-18:00) │ 4h 23m remaining │
├────────────────────────────────────┬────────────────────────────────┤
│                                    │  [Active Constraints]          │
│   RECOMMENDATION FEED              │  [Active Overrides]            │
│                                    │  [Shift Handover]              │
│   ┌──────────────────────────┐    │                                │
│   │ ▲ HIGH  14:23            │    │  Unit 2 — HX-201 Fouling      │
│   │ Increase naphtha yield   │    │    Set by: J. Martinez         │
│   │ by 8% on Units 3 and 4  │    │    Severity: -15% capacity     │
│   │                          │    │    Age: 3 days                 │
│   │ Est. margin: +$44,000    │    │    ─────────────────────       │
│   │                          │    │  Unit 6 — Catalyst aging       │
│   │ [Acknowledge] [Constrain]│    │    Set by: System (auto)       │
│   │ [Dismiss ▾]              │    │    Severity: -8% yield         │
│   └──────────────────────────┘    │    Age: 12 days                │
│                                    │                                │
│   ┌──────────────────────────┐    │                                │
│   │ ○ MEDIUM  11:07          │    │                                │
│   │ Adjust diesel blend...   │    │                                │
│   └──────────────────────────┘    │                                │
│                                    │                                │
├─────────┬──────────┬──────────┬───┴────────────────────────────────┤
│ Recs:2  │ Act: 85% │ Constr:7 │ Margin captured this shift: $67K  │
└─────────┴──────────┴──────────┴────────────────────────────────────┘
```

**Header bar:** Site selector, operating mode indicator (prominent, color-coded), current shift identifier, shift time remaining, connection health indicators (historian, market data, LP model, Claude API).

**Left panel (60%):** Live Recommendation Feed. Each card shows:
- Timestamp and trigger type icon (process drift / price movement)
- Priority badge with ISA-101 color treatment
- Plain-English recommendation (LLM-generated text)
- Key numbers in **monospace font, programmatically rendered** (per R5 — these are never LLM-generated)
- Estimated margin impact in **gain framing** ("Capture +$44,000")
- Confidence indicator (Low/Medium/High)
- Action buttons: **Acknowledge** | **Add Constraint** | **Dismiss** (with dropdown for reason)

**Right panel (40%, tabbed):**
- **Active Constraints**: Filterable list grouped by unit. Shows constraint type, severity, who set it, when, aging indicator. Constraints >36 hours get escalation badge.
- **Active Overrides**: Equipment-level view (never individual operator per R8) of current LP model overrides.
- **Shift Handover**: Constraints and recommendations from previous shift requiring acknowledgment.

**Bottom strip:** Tremor KPI cards — recommendations delivered this shift, actionability rate, active constraint count, margin captured (gain framing).

### 5.2 Constraint Input Wizard (5-Tap Structured Flow)

This component directly addresses R2 (Score 125). Replaces free-text Slack constraint input.

Implemented as a slide-up panel triggered by "Add Constraint" button on any recommendation card or the constraint registry.

**Flow:**

```
Step 1: SELECT UNIT                    Step 2: CONSTRAINT TYPE
┌─────────┐ ┌─────────┐ ┌────────┐   ┌──────────────────────────┐
│         │ │         │ │        │   │ ⚙ Equipment Issue        │
│ Unit 2  │ │ Unit 3  │ │ Unit 4 │   ├──────────────────────────┤
│  CDU    │ │  FCC    │ │  HCU   │   │ 🧪 Feed Quality          │
│         │ │         │ │        │   ├──────────────────────────┤
└─────────┘ └─────────┘ └────────┘   │ ⚠ Safety / Environmental │
┌─────────┐ ┌─────────┐ ┌────────┐   ├──────────────────────────┤
│ Unit 5  │ │ Unit 6  │ │ Blend  │   │ 👥 Staffing / Scheduling │
└─────────┘ └─────────┘ └────────┘   └──────────────────────────┘
    1 tap (64px+ tiles)                    1 tap (56px+ rows)

Step 3: SPECIFIC CONSTRAINT            Step 4: SEVERITY
(filtered by unit + type)              ┌──────────────────────────┐
┌──────────────────────────┐          │ Reduce capacity by:      │
│ HX-201 Fouling           │          │                          │
├──────────────────────────┤          │ [  5%  ] [ 10%  ] [15%] │
│ Feed pump cavitation     │          │ [ 20%  ] [ 25%  ] [Cust]│
├──────────────────────────┤          │                          │
│ Catalyst deactivation    │          │ Duration:                │
├──────────────────────────┤          │ [This shift] [24h] [Until│
│ Column flooding          │          │  cleared] [Custom]       │
└──────────────────────────┘          └──────────────────────────┘
    1 tap                                  1 tap

Step 5: CONFIRM
┌──────────────────────────────────────┐
│ SUMMARY                              │
│                                      │
│ Unit 2 (CDU) → Equipment Issue       │
│ HX-201 Fouling → Reduce by 15%      │
│ Duration: Until cleared              │
│                                      │
│ Optional: [📷 Photo] [🎤 Voice Note] │
│                                      │
│         [ SUBMIT CONSTRAINT ]        │
└──────────────────────────────────────┘
    1 tap
```

**Design requirements:**
- All tiles 64px+ height, 12px+ spacing between tiles
- Pre-populated options from site asset registry and historical constraint patterns
- Per R5: never require free-text number entry — present structured options with predefined magnitudes
- Offline-capable via service worker: queues submission for sync when connectivity returns
- Total time: 15-30 seconds, 5 taps, fully glove-compatible

### 5.3 Analytics Dashboard (Management View)

Accessible to Management and LP Planner roles. **Does NOT show individual operator override data (R8).**

**Opportunity Cost Waterfall Chart (ECharts):**
- Shows margin captured vs. total opportunity by time period (30/90-day selectable)
- **Gain framing**: leading bar is "Margin Captured" (green), secondary bar is "Additional Opportunity" (neutral grey)
- Never displayed as "money lost" or "value lost from overrides"
- Drill-down by unit shows root causes: equipment constraints, model drift, feed quality changes
- Example: "$1.2M captured (82% capture rate)" — not "$450K lost from overrides"

**Coefficient Drift Timeline (ECharts):**
- Multi-line chart showing predicted vs. actual yields per product over time
- When drift exceeds configurable threshold, the divergence zone highlights in amber
- Annotation badges suggest coefficient updates: "Naphtha yield coefficient has drifted 4.2% over 45 days. Consider updating from 8.0% to 7.66%."
- Time ranges: 30-day, 90-day, custom

**Sensor Health Matrix (ECharts Heatmap):**
- Grid of sensors organized by unit
- Cell color = reliability score (green → amber → red)
- Red cells = sensors with active substitutions
- Click a cell → detail panel shows: substitution history, estimated margin impact of unreliable sensor, recommended maintenance priority
- Feeds into maintenance prioritization per product transcript: "Management gets a list of which broken sensors are impacting profitability the most"

**Constraint Pattern Analysis (ECharts Bar/Timeline):**
- Most frequently invoked constraints over 60-day rolling window
- Surfaces the key feature from the product transcript: "Unit 2 feed cap has been invoked by operators 11 times in the last 60 days — consider making it a permanent seasonal constraint"
- Grouped by unit, sortable by frequency and total margin impact

**KPI Summary Cards (Tremor):**

| Card | Metric | Framing |
|------|--------|---------|
| Total margin captured | YTD and MTD | Gain: "$X captured" |
| Recommendation actionability | % acted upon | "85% actionability rate" |
| Constraint capture rate | % of operator feedback captured | "92% feedback captured" |
| LP model accuracy | Predicted vs. actual yield | "96.2% model accuracy" |
| Sensor health score | % sensors healthy | "87/100 sensors healthy" |

### 5.4 Admin Dashboard

Role-gated to Admin users.

**Site Onboarding Wizard:**
Multi-step guided setup for new refinery sites:
1. Basic site info (name, location, capacity, units)
2. Historian connection config (PI Web API endpoint, authentication credentials, tag mapping)
3. Market data source config ("bring your own" OPIS/Platts upload or API endpoint)
4. LP model registration (upload model, map input cells to historian tags, map output cells to recommendation fields)
5. Trigger threshold config (process drift %, price movement %, per-unit overrides)
6. User provisioning (invite users, assign roles)
7. Verification (test historian connection, test LP model execution, send test recommendation)

**Connection Health Monitor:**
Real-time status grid showing each integration point:

| Connection | Status | Last Data | Latency | Errors (24h) |
|------------|--------|-----------|---------|---------------|
| Historian (PI Web API) | 🟢 Connected | 3s ago | 120ms | 0 |
| Market Data (OPIS) | 🟢 Connected | 15m ago | 340ms | 2 |
| LP Model (Excel) | 🟡 Busy | Solving... | — | 0 |
| Claude API | 🟢 Connected | 2m ago | 890ms | 0 |
| Slack Bot | 🟢 Connected | 14m ago | 210ms | 0 |

**Trigger Threshold Configuration:**
- Per-unit, per-tag threshold editor with Mantine form controls
- Shows **historical trigger frequency** next to each threshold to help calibrate (addressing R9 miscalibration risk)
- Supports percentage-based and volatility-adjusted thresholds: "Trigger when spread moves >10% of trailing 20-day average" instead of fixed "$2/bbl"
- Preview mode: shows "this threshold would have triggered X times in the last 30 days"

**User Management:**
- CRUD for users with role assignment (Admin, LP Planner, Shift Supervisor, Management)
- Audit log of user actions (constraint submissions, recommendation acknowledgments, config changes)

### 5.5 Operating Mode System (First-Class UI Concept)

Addresses R9 (Score 64). Operating mode is the **single most prominent UI element** across all dashboards.

**Mode Banner (fixed position, top of every view):**

| Mode | Visual Treatment | Behavior |
|------|-----------------|----------|
| Normal | Thin green line, minimal visual weight | All optimization active |
| Startup | Amber banner: "STARTUP — Optimization Suppressed" | Optimization suppressed |
| Shutdown | Amber banner: "SHUTDOWN — Optimization Suppressed" | Optimization suppressed |
| Upset | Red banner: "UPSET — Optimization Suppressed, Safety Alerts Active" | Only safety alerts |
| Turnaround | Blue banner: "TURNAROUND — Optimization Suppressed" | All suppressed |
| Emergency | Pulsing red banner: "EMERGENCY — Safety Alerts Only" | Only safety alerts |

**Mode transitions:**
- Auto-detected from historian data patterns (configurable pattern matching) or manually set by authorized users
- Mode change triggers SSE event to all connected clients
- Recommendation feed during non-normal modes shows: "Optimization recommendations are suppressed during [mode]. Safety alerts remain active."

**Mode history:** Accessible from admin dashboard — timeline of all mode transitions with timestamps, triggers (auto vs. manual), and duration.

---

## 6. Slack/Teams Bot UI

### 6.1 Message Templates

Per R5, all numbers are **programmatically injected** into templates, never LLM-generated.

**Recommendation Message Structure:**

```
┌─────────────────────────────────────────────┐
│ ● NORMAL  |  📊 Price Movement Trigger      │
├─────────────────────────────────────────────┤
│                                             │
│ Crack spreads widened $1.80/bbl in the      │
│ last 2 hours. Model recommends increasing   │
│ naphtha yield by 8% on Units 3 and 4.       │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Parameter        Current  Recommended   │ │
│ │ Naphtha yield    32.1%    34.7%         │ │
│ │ Units affected   3, 4     3, 4          │ │
│ │ Margin impact    —        +$44,000/day  │ │
│ │ Confidence       —        HIGH          │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [✓ Acknowledge] [⚡ Add Constraint] [✕ Dismiss] │
└─────────────────────────────────────────────┘
```

**Template Fallback (R5 — LLM downtime):**
When Claude API is unavailable, the system uses a deterministic template:

```
TRIGGER: Price Movement — Crack spread +$1.80/bbl (2h)
ACTION: Increase naphtha yield by 8% on Units 3, 4
IMPACT: +$44,000/day at current throughput
CONFIDENCE: HIGH

[✓ Acknowledge] [⚡ Add Constraint] [✕ Dismiss]
```

The deterministic fallback is visually distinguishable (no prose paragraph) so operators know the difference, but contains identical actionable information.

### 6.2 Slack Block Kit Implementation

```
Message structure:
├── Header Block        — Operating mode badge + trigger type
├── Section Block       — LLM-generated recommendation text (or template fallback)
├── Section Block       — Rich text code block with programmatic numbers
├── Context Block       — Timestamp, trigger details, confidence level
├── Divider Block       — Visual separator
└── Actions Block       — Acknowledge / Add Constraint / Dismiss buttons
```

**Interactivity:** Button clicks POST to backend webhook → backend updates constraint registry → optionally triggers LP re-solve → sends follow-up message with revised recommendation.

**Constraint input via Slack:** "Add Constraint" button opens a **Slack modal** with the structured 5-tap flow adapted to Block Kit:
- Static select for unit
- Static select for constraint type
- Static select for specific constraint (options filtered server-side based on prior selections)
- Static select for severity magnitude
- Optional plain text input for notes

### 6.3 Teams Adaptive Cards Implementation

Adaptive Card v1.5 (maximum supported by Teams bots):

```json
{
  "type": "AdaptiveCard",
  "version": "1.5",
  "body": [
    { "type": "TextBlock", "text": "● NORMAL | Price Movement", "weight": "Bolder" },
    { "type": "TextBlock", "text": "Recommendation text...", "wrap": true },
    { "type": "FactSet", "facts": [
      { "title": "Naphtha yield", "value": "32.1% → 34.7%" },
      { "title": "Margin impact", "value": "+$44,000/day" },
      { "title": "Confidence", "value": "HIGH" }
    ]},
    { "type": "ActionSet", "actions": [
      { "type": "Action.Submit", "title": "✓ Acknowledge", "data": {"action": "ack"} },
      { "type": "Action.Submit", "title": "⚡ Add Constraint", "data": {"action": "constrain"} },
      { "type": "Action.Submit", "title": "✕ Dismiss", "data": {"action": "dismiss"} }
    ]}
  ]
}
```

**Teams-specific constraints:**
- Bot must be approved by customer IT admin (budget 2-8 weeks per R2)
- Multi-tenant bot creation deprecated (July 2025) — requires per-customer bot registration
- Adaptive Cards v1.5 maximum
- Email built as universal fallback for sites where Teams approval stalls

### 6.4 Structured Constraint Input via Messaging

When an operator clicks "Add Constraint" in Slack/Teams:

**Slack:** Opens a Block Kit modal with dropdown selects matching the 5-tap web flow. Each dropdown selection triggers a server-side callback to filter the next dropdown's options (e.g., selecting "Unit 2" filters constraint options to Unit 2's equipment).

**Teams:** Responds with a new Adaptive Card containing Input.ChoiceSet elements for each step. Form submission posts all selections in a single Action.Submit payload.

**Both channels:** Never allow free-text constraint definition as the sole input path. Free text is available as an optional note, but the constraint itself is always structured selection.

---

## 7. Shadow Mode UX (R14)

Addresses algorithm aversion risk during the first 2-4 weeks at each site.

### Visual Treatment

Recommendations in shadow mode use a distinct visual style:
- **"SHADOW MODE" badge** on every recommendation card (muted blue, non-alarming)
- Card shows Reflex recommendation alongside "Current Operation" for comparison
- **No action expected** — buttons show "Note Agreement" / "Note Disagreement" instead of "Acknowledge" / "Dismiss"
- Agreement/disagreement is low-commitment — operators build familiarity without pressure

### Dashboard Variant

Operations dashboard in shadow mode includes an additional comparison panel:

```
┌──────────────────────┬──────────────────────┐
│ REFLEX RECOMMENDED   │ WHAT ACTUALLY RAN    │
├──────────────────────┼──────────────────────┤
│ Naphtha yield: 34.7% │ Naphtha yield: 32.1% │
│ Impact: +$44K/day    │ Actual margin: $X    │
│                      │                      │
│ Result: Reflex was   │                      │
│ correct (+$38K delta)│                      │
└──────────────────────┴──────────────────────┘
```

After each shift completes, the system compares Reflex's recommendation vs. actual operations and calculates the hypothetical improvement. This builds calibrated trust through evidence, not authority.

### Transition Criteria

Admin dashboard displays a "Shadow Mode Readiness" gauge:
- Total recommendations delivered
- Agreement rate (operator noted agreement %)
- Accuracy rate (recommendation vs. actual outcome comparison)
- False positive rate
- Operator feedback summary

Suggests transition to active mode when: >20 recommendations delivered AND >75% accuracy rate AND <10% false positive rate.

---

## 8. Shift Handover Context

Addresses R15 (Score 36). Research shows 40% of plant incidents occur during shift handovers despite handovers occupying <5% of operational time.

### Handover Summary Panel

At configurable shift-change time (e.g., 30 minutes before shift end), the operations dashboard displays a **"Shift Handover Summary" overlay**:

```
┌──────────────────────────────────────────────┐
│ SHIFT HANDOVER SUMMARY — Day Shift → Night   │
├──────────────────────────────────────────────┤
│                                              │
│ ACTIVE CONSTRAINTS (3)                       │
│ ⚠ Unit 2 HX-201 Fouling — 15% cap (3 days) │
│ ⚠ Unit 6 Catalyst aging — 8% yield (12 days)│
│ ℹ Blend — Staffing constraint (this shift)   │
│                                              │
│ PENDING RECOMMENDATIONS (1)                  │
│ ○ Adjust diesel blend ratio — deferred       │
│                                              │
│ OPERATING MODE: Normal                       │
│ SENSOR SUBSTITUTIONS: 2 active               │
│                                              │
│ KEY EVENTS THIS SHIFT:                       │
│ • 14:23 — Naphtha yield rec acknowledged     │
│ • 11:07 — Diesel blend rec deferred          │
│ • 09:15 — HX-201 constraint confirmed        │
│                                              │
│         [ ACKNOWLEDGE HANDOVER ]             │
└──────────────────────────────────────────────┘
```

### Acknowledgment Flow

- Incoming shift supervisor must acknowledge active constraints before the handover panel dismisses
- Unacknowledged constraints after 30 minutes escalate to management via notification
- Acknowledgment is logged with timestamp and user for audit trail

### Integration Points

- REST/webhook integration with existing handover tools (j5, ShiftConnector, Yokogawa eLogBook)
- Active constraints pushed as structured data so they appear in existing handover workflows
- Reflex does not replace existing handover tools — it augments them

---

## 9. Responsive Design & Device Targets

### 9.1 Desktop — Control Room Monitors

- **Resolution:** 1920x1080 minimum, support up to 3840x2160 (4K control room displays)
- **Multi-monitor:** URL-addressable dashboard panels (e.g., `/operations/feed` on Monitor 1, `/operations/constraints` on Monitor 2, `/analytics/opportunity` on Monitor 3)
- **Fixed-layout grid** — no responsive reflow. Control room operators build spatial memory; elements must not move or resize unexpectedly.
- **Kiosk mode** (future): stripped-down, full-screen recommendation feed for dedicated always-on control room display

### 9.2 Tablet — Field Supervisor (iPad Pro 12.9")

- **Resolution:** 1024x1366
- **Simplified layout:** single-column recommendation feed, constraint input wizard, KPI cards
- **Touch targets:** 56px+ height, 16px+ font size, 12px+ element spacing
- **No hover states** — hover is invisible with gloves; all interactions via tap
- **Swipe gestures** where appropriate (swipe to dismiss, swipe between tabs) — less precise than tapping small targets
- **Offline support:** service worker caches active constraints and queues new constraint submissions for sync when connectivity returns (refinery WiFi coverage is spotty across 3-4 sq mile sites)

---

## 10. Accessibility & Industrial Context

### 10.1 Color & Contrast

- WCAG 2.1 AA minimum contrast ratios
- Dark mode (default): `#E0E0E0` text on `#1A1B1E` background = 12.6:1 contrast ratio (exceeds AAA)
- **No color-blind-dependent information**: all status indicators use **shape + color + text label** (e.g., triangle + red + "CRITICAL" rather than red alone)
- Tested for deuteranopia and protanopia
- ISA-101 meaningful color only enforced at theme token level

### 10.2 Typography

- **Monospace font** (`JetBrains Mono` or `IBM Plex Mono`) for all numerical values — ensures alignment, reduces misreading risk (R5)
- **Sans-serif** (`Inter` or `IBM Plex Sans`) for text
- Minimum 14px body text, 12px minimum for metadata/timestamps
- **Tabular number feature** (`font-variant-numeric: tabular-nums`) enabled for all numerical displays — digits align vertically in columns

### 10.3 Animation & Motion

- Minimal animation throughout
- `prefers-reduced-motion` media query respected (disables all animation)
- New recommendation entry: subtle slide-in (200ms ease-out)
- Mode transitions: 300ms background color fade
- **No continuous animations** — they distract in a control room environment
- No blinking or flashing elements (per ISA-101, flashing is reserved for the most critical unacknowledged alarms only)

### 10.4 Keyboard Navigation

- Full keyboard navigation with visible focus indicators
- Logical tab order through recommendation feed → action buttons → constraint registry
- Keyboard shortcuts for common actions:
  - `A` — Acknowledge selected recommendation
  - `C` — Open constraint wizard
  - `D` — Dismiss with reason
  - `M` — Toggle operating mode
  - `H` — Open handover panel

---

## 11. Performance Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| First Contentful Paint | <1.5s on 4G | Next.js SSR, minimal critical CSS |
| Time to Interactive | <3s | Server Components reduce client JS |
| Largest Contentful Paint | <2.5s | SSR + streaming for dashboard sections |
| Dashboard render (100 recs) | <500ms | Virtualized list (TanStack Virtual) |
| Constraint wizard step transition | <100ms | Client-side state, pre-loaded options |
| SSE reconnection | <5s | Browser EventSource auto-reconnect |
| Initial bundle (gzipped) | <500KB | Code splitting per route, dynamic imports |
| Analytics charts load | <1s | ECharts lazy loaded on analytics route only |

**Performance strategies:**
- Next.js code splitting per route — analytics charts don't load on operations dashboard
- ECharts dynamically imported only when analytics route is visited
- TanStack Virtual for recommendation feed virtualization (handle 100+ recommendations without DOM bloat)
- Server-side prefetch for initial dashboard state via TanStack Query
- Image/asset optimization via Next.js Image component
- Service worker for offline constraint caching

---

## 12. Testing Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Unit tests | Vitest + React Testing Library | Component behavior: constraint wizard flow, role-gated rendering, number formatting, mode transitions |
| Visual regression | Chromatic or Percy | ISA-101 color compliance verification — screenshot tests ensure no decorative color |
| E2E tests | Playwright | Critical flows: login → receive recommendation → submit constraint → view analytics |
| Accessibility | axe-core in CI | WCAG AA compliance on every PR |
| Performance | Lighthouse CI | Performance budget enforcement on every build |
| Glove testing | Manual QA | User testing with actual refinery glove types — error rates and task completion times |

**Testing priorities for MVP:**
1. Constraint wizard completes in 5 taps with correct data submission
2. Recommendation numbers match source data exactly (R5 validation)
3. Management role cannot see individual operator data (R8 enforcement)
4. Operating mode changes suppress recommendations correctly (R9)
5. SSE reconnection recovers gracefully after network interruption

---

## 13. Implementation Roadmap

### Phase 1: MVP (Weeks 1-6)

Focus: Operations dashboard + Slack bot — enough to deploy in shadow mode at 1 design partner.

| Week | Deliverable |
|------|-------------|
| 1 | Next.js project setup (TypeScript, Tailwind, Mantine). Auth flow. AppShell with sidebar + header. SSE server endpoint (mock data). |
| 2 | Recommendation feed component (SSE-driven, priority-sorted). Recommendation card with action buttons. Operating mode banner. |
| 3 | Constraint input wizard (5-tap flow). Constraint registry display (Mantine Table). |
| 4 | Slack bot: recommendation message template (Block Kit). Interactive buttons (Acknowledge/Constrain/Dismiss). Constraint input via Slack modal. |
| 5 | Shadow mode UX: comparison view, agreement/disagreement buttons, readiness gauge. Role-based access control. |
| 6 | Integration testing. Dark mode polish. Tablet responsive layout. Performance optimization. |

### Phase 2: Pilot Enhancement (Weeks 7-12)

Focus: Analytics dashboard + Teams support + handover.

| Week | Deliverable |
|------|-------------|
| 7-8 | Analytics dashboard: opportunity cost waterfall (ECharts), coefficient drift timeline, KPI cards (Tremor). Gain framing throughout. |
| 9 | Sensor health matrix (ECharts heatmap). Constraint pattern analysis chart. |
| 10 | Teams Adaptive Card support. Email fallback channel. |
| 11 | Shift handover summary panel with acknowledgment flow. |
| 12 | Admin dashboard: connection health monitor, trigger threshold config with historical frequency preview. |

### Phase 3: Scale (Weeks 13-20)

Focus: Admin tooling + multi-site + offline.

| Week | Deliverable |
|------|-------------|
| 13-14 | Site onboarding wizard (full 7-step flow). User management with audit log. |
| 15-16 | Multi-site selector. Cross-site analytics aggregation. |
| 17-18 | Tablet offline support (service worker, IndexedDB queue). Multi-monitor kiosk mode. |
| 19-20 | Performance optimization pass. Visual regression test suite. Accessibility audit. |

---

## 14. Open Questions

| # | Question | Impact | Decision Needed By |
|---|----------|--------|--------------------|
| 1 | **DCS console integration**: Should Reflex push advisory notifications to DCS (Honeywell Experion, Yokogawa CENTUM VP) as a future channel? | Reaches field operators directly but requires per-vendor OPC-UA integration. | Phase 2 planning |
| 2 | **Voice note transcription**: Should constraint input Step 5 voice notes be transcribed or stored as audio-only? | Transcription reintroduces NLP accuracy concerns from R5. | Phase 1 Week 3 |
| 3 | **Multi-language support**: European expansion requires i18n. | Architectural decision (i18n framework) is cheaper to make early. | Phase 2 planning |
| 4 | **Kiosk mode**: Dedicated always-on control room display with stripped-down recommendation feed. | Low effort, high adoption value for control rooms. | Phase 3 |
| 5 | **Mobile native app**: Should Reflex build a React Native app for supervisors, or is the responsive web app sufficient? | PWA may be sufficient; native app adds maintenance burden. | Post-Phase 3 |

---

## 15. Verification Plan

### How to test the frontend end-to-end:

1. **Recommendation flow**: Trigger a mock price movement → verify SSE delivers recommendation to dashboard → verify Slack/Teams bot sends formatted message → verify numbers match source data exactly (R5)
2. **Constraint input**: Submit a constraint via 5-tap wizard → verify it appears in constraint registry → verify LP model receives it → verify revised recommendation is generated
3. **Operating mode**: Switch to Shutdown mode → verify all optimization recommendations are suppressed → verify safety alerts remain → switch back to Normal → verify recommendations resume
4. **Role enforcement**: Log in as Management role → verify no individual operator data is visible → verify financial data uses gain framing (R8)
5. **Shadow mode**: Enable shadow mode → verify recommendations show comparison view → verify "Note Agreement/Disagreement" buttons instead of "Acknowledge/Dismiss" → verify readiness gauge tracks metrics
6. **Shift handover**: Trigger shift change → verify handover panel appears → verify incoming supervisor must acknowledge → verify escalation after 30 minutes
7. **Offline resilience**: Disconnect network → submit constraint → reconnect → verify constraint syncs correctly
8. **Performance**: Run Lighthouse CI → verify all targets met (FCP <1.5s, TTI <3s, bundle <500KB)

---

*This document should be revisited after the first design partner deployment (Phase 1) as real operator feedback will reshape dashboard layouts and interaction patterns.*

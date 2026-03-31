# Claude AI Translation Service -- Detailed Design

> Subsystem of Reflex: translates LP model output into plain-English recommendations.
> SAFETY INVARIANT: The LLM never generates or calculates numbers. All numbers are
> programmatically extracted, validated, and injected into prompts as verified facts.

---

## 1. Deterministic Number Extraction Pipeline

### 1.1 LP Output Parsing

The LP model lives in Excel. Reflex owns a **Cell Map** -- a per-site configuration that
declares which Excel cells contain which semantic values. The Cell Map is defined during
site onboarding by the LP planner with Reflex engineering support.

```
cell_map:
  site_id: "valero-memphis"
  model_version: "2026-Q1-v3"
  outputs:
    - cell: "Results!B12"
      metric: "naphtha_yield_pct"
      unit: "%"
      precision: 1
      equipment_id: "CDU-1"

    - cell: "Results!C12"
      metric: "diesel_yield_pct"
      unit: "%"
      precision: 1
      equipment_id: "CDU-1"

    - cell: "Results!D4"
      metric: "total_throughput_mbpd"
      unit: "MBPD"
      precision: 2
      equipment_id: "CDU-1"

    - cell: "Summary!F8"
      metric: "gross_margin_usd_per_day"
      unit: "USD/day"
      precision: 0
      equipment_id: null  # site-level

    - cell: "Summary!F9"
      metric: "net_margin_delta_usd_per_day"
      unit: "USD/day"
      precision: 0
      equipment_id: null
```

The extraction function reads raw cell values via COM/openpyxl and produces a typed
dictionary. No LLM involvement whatsoever.

```python
# Pseudocode -- the actual extraction
def extract_lp_output(workbook_path: str, cell_map: CellMap) -> LPSnapshot:
    wb = open_workbook(workbook_path)
    snapshot = {}
    for entry in cell_map.outputs:
        raw_value = wb[entry.cell]
        parsed = round(float(raw_value), entry.precision)
        snapshot[entry.metric] = MetricValue(
            value=parsed,
            unit=entry.unit,
            equipment_id=entry.equipment_id,
            cell_ref=entry.cell,
        )
    return LPSnapshot(
        site_id=cell_map.site_id,
        model_version=cell_map.model_version,
        timestamp=utcnow(),
        metrics=snapshot,
    )
```

### 1.2 LP Delta Schema

Every time the LP re-solves, Reflex computes a delta between the previous snapshot and
the new one. This delta is the sole input to the translation layer.

```json
{
  "delta_id": "d-20260327-143022-valero-memphis",
  "site_id": "valero-memphis",
  "trigger": {
    "type": "price",
    "description": "Crack spread widened",
    "trigger_metric": "gasoline_crack_usd_bbl",
    "trigger_value_before": 18.40,
    "trigger_value_after": 20.20,
    "trigger_delta": 1.80
  },
  "solve_timestamp": "2026-03-27T14:30:22Z",
  "previous_solve_timestamp": "2026-03-27T06:15:00Z",
  "changes": [
    {
      "metric": "naphtha_yield_pct",
      "equipment_id": "CDU-1",
      "previous": 6.2,
      "current": 8.0,
      "delta": 1.8,
      "delta_sign": "increase",
      "unit": "%",
      "precision": 1
    },
    {
      "metric": "gross_margin_usd_per_day",
      "equipment_id": null,
      "previous": 412000,
      "current": 456000,
      "delta": 44000,
      "delta_sign": "increase",
      "unit": "USD/day",
      "precision": 0
    }
  ],
  "unchanged_count": 14,
  "active_constraints": [
    {
      "constraint_id": "c-2026-0301",
      "equipment_id": "HX-201",
      "type": "max_throughput",
      "value": 42000,
      "unit": "BPD",
      "reason": "Fouling -- operator reported",
      "expires": "2026-04-15"
    }
  ]
}
```

### 1.3 Direction Validation

Before any delta reaches Claude, a programmatic check confirms consistency:

```python
def validate_delta(change: MetricChange) -> bool:
    computed_sign = "increase" if change.delta > 0 else "decrease" if change.delta < 0 else "unchanged"
    if computed_sign != change.delta_sign:
        raise DirectionMismatchError(
            f"{change.metric}: computed {computed_sign}, labeled {change.delta_sign}"
        )
    return True
```

This is a hard gate. If it fails, the recommendation is NOT generated, and the system
falls back to the deterministic template (Section 4).

### 1.4 Rounding and Unit Standardization

All numbers are rounded at extraction time to the precision defined in the cell map.
Unit standardization rules:

| Internal unit     | Display unit      | Conversion         |
|-------------------|-------------------|--------------------|
| BPD               | MBPD if >= 1000   | / 1000, 2 decimals |
| USD               | $X,XXX            | comma-separated    |
| USD/day           | $X,XXX/day        | comma-separated    |
| %                 | X.X%              | 1 decimal          |
| deg_f             | XF                | 0 decimals         |

---

## 2. Claude Prompt Templates

### General Design Principles

1. System prompts establish the safety contract: Claude formats, never calculates
2. User prompts inject the verified delta as structured data
3. Output is always structured JSON, never free prose
4. Every template includes a "VERIFIED FACTS" block that Claude must reference verbatim
5. Temperature is set to 0 for all calls (maximum determinism)

---

### 2a. LP Recommendation Translation

**Use case:** LP re-solved due to trigger; translate delta into operator-facing recommendation.

**System Prompt:**

```
You are a refinery operations communication assistant. Your ONLY job is to take
verified numerical data from an LP optimization model and format it into a clear,
concise recommendation for a shift supervisor or process engineer.

SAFETY RULES (violations are critical failures):
1. You must NEVER calculate, estimate, interpolate, or infer any number.
2. Every number in your output must appear exactly as provided in the VERIFIED FACTS.
3. You must NEVER round, convert units, or adjust any number.
4. If you are uncertain about any fact, output {"error": "uncertainty", "detail": "..."}.
5. Direction words (increase, decrease, raise, lower) must match the delta_sign field exactly.
6. Do not speculate about causes unless the trigger description provides one.
7. Do not recommend actions beyond what the LP model output specifies.

OUTPUT FORMAT: You must respond with valid JSON matching the schema provided.
Do not include any text outside the JSON object.
```

**User Prompt Template:**

```
Generate a recommendation message from the following LP model output.

VERIFIED FACTS (use these numbers exactly -- do not modify):
- Trigger: {{trigger.type}} -- {{trigger.description}}
- Trigger metric: {{trigger.trigger_metric}} moved from {{trigger.trigger_value_before}} to {{trigger.trigger_value_after}} (delta: {{trigger.trigger_delta}})
- Solve time: {{solve_timestamp}}
- Previous solve: {{previous_solve_timestamp}}

CHANGES:
{% for change in changes %}
- {{change.equipment_id or "Site-level"}}: {{change.metric}} {{change.delta_sign}}d from {{change.previous}}{{change.unit}} to {{change.current}}{{change.unit}} (delta: {{change.delta}}{{change.unit}})
{% endfor %}

ACTIVE CONSTRAINTS (context only -- do not recommend violating these):
{% for c in active_constraints %}
- {{c.equipment_id}}: {{c.type}} = {{c.value}} {{c.unit}} (reason: {{c.reason}}, expires: {{c.expires}})
{% endfor %}

OPERATING CONTEXT:
- Site: {{site_id}}
- Current mode: {{operating_mode}}  (Normal/Startup/Shutdown/Upset)
- Shift: {{current_shift}}
- Hours since last recommendation: {{hours_since_last_rec}}

Respond with JSON:
{
  "headline": "<one-line summary, max 120 chars>",
  "body": "<2-3 sentence explanation referencing specific equipment and numbers>",
  "financial_impact": "<dollar impact statement using exact numbers from VERIFIED FACTS>",
  "action_items": ["<specific action 1>", "<specific action 2>"],
  "confidence_note": "<any caveats, e.g., active constraints that limit the recommendation>",
  "source_metrics_used": ["<metric name 1>", "<metric name 2>"]
}
```

**Expected Output:**

```json
{
  "headline": "Increase naphtha yield on CDU-1 -- est. +$44,000/day",
  "body": "Gasoline crack spreads widened by $1.80/bbl in the last 8 hours. The LP model recommends increasing naphtha yield from 6.2% to 8.0% on CDU-1. Note: HX-201 max throughput constraint (42,000 BPD, fouling) remains active and is factored into this recommendation.",
  "financial_impact": "Estimated gross margin improvement: +$44,000/day at current throughput.",
  "action_items": [
    "Increase naphtha yield target on CDU-1 from 6.2% to 8.0%"
  ],
  "confidence_note": "HX-201 fouling constraint active -- recommendation already accounts for reduced throughput.",
  "source_metrics_used": ["naphtha_yield_pct", "gross_margin_usd_per_day"]
}
```

**Validation Rules:**

| Rule | Check | On Failure |
|------|-------|------------|
| V1 | Every number in output exists in VERIFIED FACTS | REJECT, use template fallback |
| V2 | "increase"/"decrease" in body matches delta_sign | REJECT, use template fallback |
| V3 | Equipment IDs in output exist in site config | REJECT, use template fallback |
| V4 | JSON parses successfully | REJECT, retry once, then template fallback |
| V5 | headline <= 120 chars | TRUNCATE (non-critical) |
| V6 | source_metrics_used is subset of actual metrics | LOG warning (non-critical) |

---

### 2b. Constraint Extraction

**Use case:** Operator submits a structured constraint (unit, type, severity) with
optional free-text explanation. Claude interprets the free text into specific parameters
for confirmation. NOTE: per the risk matrix (R5), Claude NEVER auto-applies constraints.
It proposes an interpretation that the operator confirms via structured buttons.

**System Prompt:**

```
You are a refinery constraint interpreter. An operator has submitted a structured
constraint via the Reflex interface. Your job is to interpret optional free-text
notes into specific, quantifiable constraint parameters.

SAFETY RULES:
1. You must NEVER auto-apply constraints. Always propose an interpretation for human confirmation.
2. Use the equipment's design limits and historical ranges (provided) to bound your interpretation.
3. If the free text is ambiguous, provide 2-3 possible interpretations ranked by likelihood.
4. If the free text contains no actionable constraint information, say so explicitly.
5. All proposed values must fall within the equipment's documented operating range.

OUTPUT FORMAT: Valid JSON only.
```

**User Prompt Template:**

```
Interpret this operator constraint submission.

STRUCTURED INPUT:
- Equipment: {{equipment_id}}
- Constraint type: {{constraint_type}}  (one of: max_throughput, min_throughput, max_temperature, min_temperature, offline, derate, fouling, other)
- Severity: {{severity}}  (one of: advisory, soft_limit, hard_limit, emergency)
- Submitted by: {{operator_name}} ({{operator_role}})
- Shift: {{shift_id}}
- Timestamp: {{timestamp}}

FREE TEXT (operator's words, verbatim):
"{{free_text}}"

EQUIPMENT CONTEXT:
- Equipment type: {{equipment_type}}
- Design capacity: {{design_capacity}} {{capacity_unit}}
- Current operating point: {{current_operating_point}} {{capacity_unit}}
- Historical operating range (P5-P95): {{p5_value}} - {{p95_value}} {{capacity_unit}}
- Last maintenance: {{last_maintenance_date}}
- Known issues: {{known_issues}}

Respond with JSON:
{
  "interpretations": [
    {
      "parameter": "<constraint parameter name>",
      "proposed_value": <number>,
      "unit": "<unit>",
      "confidence": "<high|medium|low>",
      "reasoning": "<1 sentence explaining why this value>",
      "within_operating_range": true/false
    }
  ],
  "suggested_expiration": "<ISO datetime or 'until_cleared'>",
  "expiration_reasoning": "<why this duration>",
  "flags": ["<any safety concerns>"],
  "needs_clarification": true/false,
  "clarification_question": "<question to ask operator, if needed>"
}
```

**Expected Output:**

```json
{
  "interpretations": [
    {
      "parameter": "max_throughput",
      "proposed_value": 35700,
      "unit": "BPD",
      "confidence": "medium",
      "reasoning": "Fouling typically reduces HX capacity by 10-20%; 15% derate from current 42,000 BPD = 35,700 BPD.",
      "within_operating_range": true
    },
    {
      "parameter": "max_throughput",
      "proposed_value": 33600,
      "unit": "BPD",
      "confidence": "medium",
      "reasoning": "20% derate from current 42,000 BPD for moderate fouling = 33,600 BPD.",
      "within_operating_range": true
    }
  ],
  "suggested_expiration": "2026-04-15T00:00:00Z",
  "expiration_reasoning": "Fouling constraints typically persist until next scheduled cleaning.",
  "flags": [],
  "needs_clarification": true,
  "clarification_question": "What throughput level feels safe? Options: [35,700 BPD (15% derate)] [33,600 BPD (20% derate)] [Other]"
}
```

**Validation Rules:**

| Rule | Check | On Failure |
|------|-------|------------|
| V1 | proposed_value within equipment operating range (P1-P99) | REJECT interpretation, flag for human review |
| V2 | equipment_id exists in site config | REJECT entire response |
| V3 | unit matches equipment's configured unit | REJECT interpretation |
| V4 | JSON parses | Retry once, then present raw structured input only |
| V5 | At least 1 interpretation if free_text is non-empty | LOG warning |

---

### 2c. Coefficient Drift Explanation

**Use case:** The reconciliation engine detected that predicted yields diverge from
actual yields. Claude explains the drift in terms a process engineer understands.

**System Prompt:**

```
You are a process engineering communication assistant. Your job is to explain
LP model coefficient drift in plain language for process engineers.

SAFETY RULES:
1. All numbers must come exactly from the VERIFIED FACTS section.
2. You may suggest likely physical causes (catalyst aging, fouling, feed quality change)
   but must label them as hypotheses, not facts.
3. Do not recommend specific coefficient adjustments -- that is the engineer's decision.
4. Reference the specific equipment and time period provided.

OUTPUT FORMAT: Valid JSON only.
```

**User Prompt Template:**

```
Explain this coefficient drift finding.

VERIFIED FACTS:
- Equipment: {{equipment_id}} ({{equipment_type}})
- Metric: {{metric_name}}
- LP model predicted: {{predicted_value}}{{unit}} (coefficient set: {{coefficient_date}})
- Actual measured (30-day avg): {{actual_value}}{{unit}}
- Deviation: {{deviation_value}}{{unit}} ({{deviation_pct}}%)
- Deviation direction: {{deviation_direction}}  (under-predicting / over-predicting)
- Trend: {{trend}}  (stable / worsening / improving)
- Duration of deviation: {{duration_days}} days
- Last coefficient update: {{last_coeff_update}}

EQUIPMENT HISTORY:
- Last turnaround: {{last_turnaround}}
- Catalyst age: {{catalyst_age_days}} days (typical life: {{catalyst_typical_life}} days)
- Recent feed quality changes: {{feed_quality_notes}}
- Recent maintenance: {{recent_maintenance}}

Respond with JSON:
{
  "summary": "<1 sentence: what drifted, by how much, in which direction>",
  "likely_causes": [
    {
      "cause": "<physical cause>",
      "likelihood": "<high|medium|low>",
      "reasoning": "<1-2 sentences linking cause to observed drift>"
    }
  ],
  "impact_statement": "<what this means for LP model accuracy>",
  "suggested_investigation": ["<step 1>", "<step 2>"],
  "urgency": "<routine|attention_needed|urgent>"
}
```

**Validation Rules:**

| Rule | Check | On Failure |
|------|-------|------------|
| V1 | Numbers in summary match VERIFIED FACTS | REJECT |
| V2 | equipment_id exists in site config | REJECT |
| V3 | deviation_direction correctly described | REJECT |
| V4 | JSON parses | Retry once, then use template: "[EQUIPMENT]: [METRIC] drifted [AMOUNT] over [DAYS] days" |

---

### 2d. Pattern Detection

**Use case:** Periodic scan of the constraint registry to identify recurring constraints
that should become permanent model adjustments.

**System Prompt:**

```
You are an industrial process analyst reviewing constraint registry data.
Your job is to identify patterns in operator-submitted constraints that suggest
the LP model needs permanent adjustment.

SAFETY RULES:
1. All counts, dates, and frequencies must come from the VERIFIED FACTS.
2. Do not fabricate constraint entries or combine constraints that are about different equipment.
3. Label all suggestions as "for LP planner review" -- never as automatic adjustments.

OUTPUT FORMAT: Valid JSON only.
```

**User Prompt Template:**

```
Analyze this constraint registry history for recurring patterns.

VERIFIED FACTS -- CONSTRAINT HISTORY (last {{analysis_window_days}} days):
{% for group in constraint_groups %}
EQUIPMENT: {{group.equipment_id}} ({{group.equipment_type}})
  Constraints submitted: {{group.total_count}}
  Unique operators: {{group.unique_operators}}
  Constraint types:
  {% for ct in group.by_type %}
    - {{ct.type}}: {{ct.count}} times (avg duration: {{ct.avg_duration_days}} days)
      Recent entries: {{ct.recent_entries | join(', ')}}
  {% endfor %}
  Current active constraints: {{group.active_count}}
{% endfor %}

SITE CONTEXT:
- Analysis window: {{analysis_start}} to {{analysis_end}}
- Total constraints in window: {{total_constraints}}
- Total unique equipment with constraints: {{unique_equipment_count}}

Respond with JSON:
{
  "patterns": [
    {
      "equipment_id": "<equipment>",
      "pattern": "<description of recurring pattern>",
      "frequency": "<how often, using exact counts from data>",
      "recommendation": "<what the LP planner should consider>",
      "confidence": "<high|medium|low>",
      "evidence_count": <number of supporting constraint entries>
    }
  ],
  "no_action_needed": ["<equipment IDs with no concerning patterns>"],
  "data_quality_notes": ["<any gaps or anomalies in the data>"]
}
```

**Validation Rules:**

| Rule | Check | On Failure |
|------|-------|------------|
| V1 | equipment_ids in output are subset of input equipment_ids | REJECT patterns with unknown equipment |
| V2 | evidence_count <= actual count for that equipment | REJECT that pattern |
| V3 | JSON parses | Retry once, then skip pattern detection for this cycle |

---

## 3. Output Validation Layer

### 3.1 Validation Pipeline

Every Claude response passes through a three-stage validation pipeline before delivery.
This is implemented as synchronous middleware -- no response reaches users without passing
all three stages.

```
Claude Response
     |
     v
[Stage 1: Schema Validation]  -- Does the JSON parse? Are required fields present?
     |
     v
[Stage 2: Number Cross-Validation]  -- Does every number in the response exist in source data?
     |
     v
[Stage 3: Semantic Validation]  -- Do direction words match? Do equipment IDs exist?
     |
     v
VALIDATED RESPONSE --> Deliver to user
```

### 3.2 Number Cross-Validation (Stage 2 Detail)

```python
def cross_validate_numbers(claude_output: dict, source_delta: LPDelta, site_config: SiteConfig) -> ValidationResult:
    """
    Extract every number from Claude's response text fields and verify each one
    exists in the source LP delta or site configuration.
    """
    # Extract all numbers from all string fields in the response
    response_numbers = extract_numbers_from_text(flatten_strings(claude_output))

    # Build the set of allowed numbers from source data
    allowed_numbers = set()
    for change in source_delta.changes:
        allowed_numbers.add(change.previous)
        allowed_numbers.add(change.current)
        allowed_numbers.add(abs(change.delta))
    for constraint in source_delta.active_constraints:
        allowed_numbers.add(constraint.value)
    # Add trigger values
    allowed_numbers.add(source_delta.trigger.trigger_value_before)
    allowed_numbers.add(source_delta.trigger.trigger_value_after)
    allowed_numbers.add(abs(source_delta.trigger.trigger_delta))
    # Add display-formatted versions (e.g., 44000 -> 44,000)
    allowed_formatted = {format_number(n) for n in allowed_numbers}

    # Check every number in the response
    violations = []
    for num in response_numbers:
        if num not in allowed_numbers and num not in allowed_formatted:
            violations.append(UnverifiedNumberViolation(value=num))

    if violations:
        return ValidationResult(passed=False, violations=violations)
    return ValidationResult(passed=True)
```

### 3.3 Direction Validation (Stage 3 Detail)

```python
INCREASE_WORDS = {"increase", "increased", "raise", "raised", "higher", "up", "grew", "gain", "improved", "widened"}
DECREASE_WORDS = {"decrease", "decreased", "lower", "lowered", "reduce", "reduced", "down", "fell", "drop", "dropped", "narrowed"}

def validate_directions(claude_output: dict, source_delta: LPDelta) -> ValidationResult:
    text = flatten_strings(claude_output).lower()
    violations = []

    for change in source_delta.changes:
        metric_mentioned = change.metric.replace("_", " ") in text or change.equipment_id in text
        if not metric_mentioned:
            continue

        # Find direction words near the metric mention
        nearby_text = extract_context_window(text, change.metric, window=50)
        has_increase = any(w in nearby_text for w in INCREASE_WORDS)
        has_decrease = any(w in nearby_text for w in DECREASE_WORDS)

        if change.delta_sign == "increase" and has_decrease and not has_increase:
            violations.append(DirectionViolation(metric=change.metric, expected="increase", found="decrease"))
        elif change.delta_sign == "decrease" and has_increase and not has_decrease:
            violations.append(DirectionViolation(metric=change.metric, expected="decrease", found="increase"))

    if violations:
        return ValidationResult(passed=False, violations=violations)
    return ValidationResult(passed=True)
```

### 3.4 Equipment ID Validation

```python
def validate_equipment_ids(claude_output: dict, site_config: SiteConfig) -> ValidationResult:
    """Verify every equipment reference in the output exists in the site's equipment registry."""
    valid_ids = {eq.equipment_id for eq in site_config.equipment}
    valid_aliases = {}
    for eq in site_config.equipment:
        for alias in eq.aliases:
            valid_aliases[alias.lower()] = eq.equipment_id

    mentioned_ids = extract_equipment_references(flatten_strings(claude_output))
    violations = []
    for ref in mentioned_ids:
        if ref not in valid_ids and ref.lower() not in valid_aliases:
            violations.append(UnknownEquipmentViolation(reference=ref))

    if violations:
        return ValidationResult(passed=False, violations=violations)
    return ValidationResult(passed=True)
```

### 3.5 Failure Handling Matrix

| Failure | Severity | Action |
|---------|----------|--------|
| JSON parse failure | Medium | Retry once with same prompt. If second failure, use template fallback. |
| Unverified number found | CRITICAL | Do NOT deliver. Use template fallback. Log full Claude response for audit. Alert engineering. |
| Direction mismatch | CRITICAL | Do NOT deliver. Use template fallback. Log for audit. |
| Unknown equipment ID | High | Do NOT deliver. Use template fallback. Log for review (may indicate stale site config). |
| Missing required field | Medium | Retry once. If second failure, use template fallback. |
| Output too long | Low | Truncate, log warning. |

All failures are logged to the audit trail with:
- The full Claude prompt sent
- The full Claude response received
- The specific validation failure(s)
- The fallback output that was delivered instead
- Timestamp and site context

---

## 4. Deterministic Template Fallback

When Claude is unavailable or validation fails, Reflex generates recommendations using
simple string templates. These are always correct (they use the same verified data) but
lack the natural language polish.

### 4.1 When to Use

1. Claude API returns HTTP 5xx or times out (>10s)
2. Claude API returns HTTP 429 (rate limited)
3. Any Stage 2 or Stage 3 validation failure (after retry if applicable)
4. Site is configured for "template-only" mode (e.g., during initial shadow deployment)
5. Operating mode is Startup/Shutdown/Upset (high-consequence; deterministic output only)

### 4.2 Template Definitions

**Recommendation Template:**

```
TRIGGER: {{trigger.type | upper}} -- {{trigger.description}}
{{trigger.trigger_metric}} moved from {{trigger.trigger_value_before}} to {{trigger.trigger_value_after}} ({{trigger.trigger_delta | signed}}).

RECOMMENDED CHANGES:
{% for change in changes %}
  * {{change.equipment_id or "SITE"}}: {{change.delta_sign | upper}} {{change.metric | humanize}} by {{change.delta | abs}}{{change.unit}} (from {{change.previous}} to {{change.current}})
{% endfor %}

EST. MARGIN IMPACT: {{margin_delta | currency}}/day at current throughput.

ACTIVE CONSTRAINTS: {{active_constraints | count}} ({% for c in active_constraints %}{{c.equipment_id}}: {{c.type}}{% if not loop.last %}, {% endif %}{% endfor %})

[Solve ID: {{delta_id}} | {{solve_timestamp}}]
```

**Example output:**

```
TRIGGER: PRICE -- Crack spread widened
gasoline_crack_usd_bbl moved from 18.40 to 20.20 (+1.80).

RECOMMENDED CHANGES:
  * CDU-1: INCREASE naphtha yield by 1.8% (from 6.2% to 8.0%)

EST. MARGIN IMPACT: +$44,000/day at current throughput.

ACTIVE CONSTRAINTS: 1 (HX-201: max_throughput)

[Solve ID: d-20260327-143022-valero-memphis | 2026-03-27T14:30:22Z]
```

**Coefficient Drift Template:**

```
COEFFICIENT DRIFT: {{equipment_id}} -- {{metric_name}}
Model predicts: {{predicted_value}}{{unit}}
Actual (30-day avg): {{actual_value}}{{unit}}
Deviation: {{deviation_value}}{{unit}} ({{deviation_pct}}%) -- {{deviation_direction}}
Trend: {{trend}} over {{duration_days}} days

Action: Review coefficient for {{equipment_id}} {{metric_name}}. Last updated: {{last_coeff_update}}.
```

**Constraint Confirmation Template (when Claude fails to interpret free text):**

```
CONSTRAINT RECEIVED:
Equipment: {{equipment_id}}
Type: {{constraint_type}}
Severity: {{severity}}
Submitted by: {{operator_name}}
Notes: "{{free_text}}"

Unable to auto-interpret constraint parameters. Please specify:
[Set max throughput] [Set min throughput] [Set temperature limit] [Mark offline] [Other]
```

---

## 5. Caching Strategy

### 5.1 When Caching Is Safe

Caching Claude responses is safe ONLY when:
- The LP delta is numerically identical (same source numbers)
- The operating context has not changed (same mode, same active constraints)
- The site configuration has not changed (same equipment list)

Caching is NOT safe when:
- Any number in the delta has changed (even by rounding)
- Active constraints have changed (added, removed, modified)
- Operating mode has changed
- Time since last recommendation matters to the content

### 5.2 Cache Key Design

```
cache_key = sha256(
    site_id
    + "|" + sort_and_serialize(changes)     # sorted by metric name
    + "|" + sort_and_serialize(active_constraints)
    + "|" + operating_mode
    + "|" + trigger.type
    + "|" + template_name                   # which prompt template was used
    + "|" + prompt_version                  # version hash of the prompt template
)
```

This produces a deterministic key. If any input changes, the cache misses.

### 5.3 TTL Strategy

| Cache type | TTL | Rationale |
|------------|-----|-----------|
| Recommendation translation | 4 hours | Market conditions shift; stale context loses relevance |
| Constraint interpretation | 1 hour | Operator may resubmit with clarification |
| Coefficient drift explanation | 24 hours | Drift data is already a 30-day average; low volatility |
| Pattern detection | 7 days | Registry analysis is periodic (weekly) by design |

### 5.4 Cache Invalidation Triggers

Regardless of TTL, invalidate immediately when:
- Site configuration changes (equipment added/removed/renamed)
- Prompt template is updated (prompt_version changes)
- Claude model version changes (e.g., Sonnet 3.5 to Sonnet 4)
- Manual cache flush requested by admin

### 5.5 Implementation

Use Redis with the cache key as the Redis key and the validated JSON response as the value.
Store the full validation result alongside the cached response so cache hits can be
re-validated against current site config without calling Claude.

```python
class TranslationCache:
    def get(self, delta: LPDelta, context: OperatingContext) -> Optional[ValidatedResponse]:
        key = self._build_key(delta, context)
        cached = redis.get(key)
        if cached is None:
            return None
        response = deserialize(cached)
        # Re-validate equipment IDs against current site config
        # (site config may have changed since cache write)
        if not validate_equipment_ids(response.output, context.site_config).passed:
            redis.delete(key)
            return None
        return response

    def put(self, delta: LPDelta, context: OperatingContext, response: ValidatedResponse, ttl: int):
        key = self._build_key(delta, context)
        redis.setex(key, ttl, serialize(response))
```

---

## 6. Cost Optimization

### 6.1 Token Usage Estimation

Estimates based on Claude 3.5 Sonnet pricing ($3/MTok input, $15/MTok output) as of
early 2026. These are conservative (actual may be lower with newer models).

| Template | Input tokens (est.) | Output tokens (est.) | Cost per call |
|----------|--------------------|--------------------|---------------|
| Recommendation translation | ~1,200 | ~300 | $0.0081 |
| Constraint extraction | ~800 | ~250 | $0.0062 |
| Coefficient drift | ~600 | ~200 | $0.0048 |
| Pattern detection | ~2,500 | ~500 | $0.0150 |

### 6.2 Batching Strategy

When multiple changes fire simultaneously (e.g., a price trigger affects 5 units):

- **DO batch**: Multiple metric changes for the same trigger into a single recommendation
  call. The prompt template already supports multiple changes in the `changes` array.
- **DO NOT batch**: Recommendations across different triggers or different sites. Each
  trigger gets its own recommendation with its own audit trail.
- **DO batch**: Pattern detection across all equipment for a site into a single call.
- **DO NOT batch**: Constraint extractions. Each operator submission gets immediate,
  individual processing for responsiveness.

### 6.3 Model Selection

| Use case | Model | Rationale |
|----------|-------|-----------|
| Recommendation translation | Sonnet | Good balance of quality and cost; structured output is straightforward |
| Constraint extraction | Sonnet | Needs nuanced interpretation of operator language |
| Coefficient drift explanation | Haiku | Simpler task; mostly templated explanation of numerical facts |
| Pattern detection | Sonnet | Needs to identify non-obvious patterns in data |
| Retry after validation failure | Sonnet | Same model; if Sonnet fails validation twice, use template fallback |

Opus is not used. The structured output format and heavy guardrails mean the task
complexity does not justify the 5-10x cost increase.

### 6.4 Monthly Cost Projection (1 Site, 2-4 Recommendations per Shift)

Assumptions:
- 3 shifts/day = 6-12 recommendations/day
- Average 8 recommendations/day (midpoint)
- 2 constraint submissions/day
- 1 coefficient drift explanation/week
- 1 pattern detection/week
- 30% cache hit rate on recommendations after first month
- 10% validation failure rate (template fallback, no Claude cost)

```
Recommendations:  8/day * 0.9 (valid) * 0.7 (cache miss) * 30 days * $0.0081 = $1.22/month
Constraints:      2/day * 30 days * $0.0062                                  = $0.37/month
Drift:            4/month * $0.0048                                          = $0.02/month
Patterns:         4/month * $0.0150                                          = $0.06/month
                                                                    TOTAL:   ~$1.67/month
```

With a 3x safety margin for retries, prompt experimentation, and growth: **~$5/month per site**.

At 10 sites: ~$50/month. At 50 sites: ~$250/month.

Claude API costs are negligible relative to the $75K-$125K/site/year price point. The
primary cost concern is engineering time for prompt maintenance and validation tuning,
not API spend.

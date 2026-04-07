import type {
  KPICardData,
  Recommendation,
  Constraint,
  ConnectionHealth,
  OptimizationQueueItem,
  HandoverEvent,
  WaterfallDataPoint,
  DriftDataPoint,
  SensorHealthCell,
  ConstraintPattern,
  CrudeSlate,
  UllageByProduct,
  ProductReady,
} from "@/types";

export const SITE = {
  name: "Valero Memphis",
  capacity: "105,000 BPD",
  shift: "Day Shift (06:00–18:00)",
  shiftRemaining: "4h 23m remaining",
  marginCaptured: 1247832,
  marginTrend: 14.2,
  captureRate: 82,
};

export const heroKPIs: KPICardData[] = [
  { label: "Throughput", value: 412.8, unit: "MBPD", precision: 1, sparkline: [390, 395, 400, 405, 412, 410, 412.8] },
  { label: "Energy Index", value: 88.4, unit: "EEI", precision: 1, sparkline: [85, 86, 87, 88, 88.4] },
  { label: "Safety Health", value: 0.98, precision: 2, sparkline: [0.95, 0.96, 0.97, 0.98, 0.98] },
  { label: "Emissions", value: 14.2, unit: "MT/d", precision: 1, sparkline: [15.1, 14.8, 14.5, 14.3, 14.2], status: "healthy" },
];

export const recommendations: Recommendation[] = [
  {
    id: "rec-1",
    priority: "high",
    timestamp: "14:23",
    triggerType: "Price Movement",
    summary:
      "Crack spreads widened $1.80/bbl in the last 2 hours. Model recommends increasing naphtha yield by 2.6 percentage points on Units 3 and 4.",
    deltas: [
      { parameter: "Naphtha yield", current: "32.1%", recommended: "34.7%", delta: "+2.6%" },
      { parameter: "Units", current: "3, 4", recommended: "3, 4" },
      { parameter: "Margin impact", current: "—", recommended: "+$44,000/day" },
      { parameter: "Confidence", current: "—", recommended: "HIGH" },
    ],
    marginImpact: "+$44,000/day",
    confidence: "HIGH",
  },
  {
    id: "rec-2",
    priority: "medium",
    timestamp: "11:07",
    triggerType: "Inventory Slack",
    summary:
      "Adjust diesel blend ratio on Unit 6. Current diesel-to-gasoline ratio is suboptimal given Argus pricing update. Estimated margin impact: +$18,200/day.",
    deltas: [
      { parameter: "Diesel ratio", current: "29.8%", recommended: "27.2%", delta: "-2.6%" },
      { parameter: "Margin impact", current: "—", recommended: "+$18,200/day" },
      { parameter: "Confidence", current: "—", recommended: "MEDIUM" },
    ],
    marginImpact: "+$18,200/day",
    confidence: "MEDIUM",
  },
];

export const constraints: Constraint[] = [
  {
    id: "c-1",
    unit: "Unit 2",
    equipment: "HX-201 Fouling",
    severity: "-15% capacity",
    age: "3 days",
    status: "active",
    description: "Performance declining — monitor outlet temperature.",
  },
  {
    id: "c-2",
    unit: "Unit 6",
    equipment: "Catalyst Aging",
    severity: "-8% yield",
    age: "12 days",
    status: "monitoring",
    description: "Yield coefficient drift detected. LP model updated.",
  },
  {
    id: "c-3",
    unit: "Blend",
    equipment: "Staffing Constraint",
    severity: "Manual override",
    age: "This shift",
    status: "temporary",
    description: "Expires at shift end. Night shift has full staffing.",
  },
];

export const connections: ConnectionHealth[] = [
  { name: "pi", label: "PI", status: "connected" },
  { name: "mkt", label: "MKT", status: "connected" },
  { name: "lp", label: "LP", status: "connected" },
  { name: "ai", label: "AI", status: "connected" },
];

export const optimizationQueue: OptimizationQueueItem[] = [
  { assetId: "BLNK-041-ALPHA", name: "Blending Unit Alpha", stability: 99.6, trend: "stable" },
  { assetId: "HEAT-204-BRAVO", name: "Heat Exchanger 204", stability: 92.1, trend: "down" },
  { assetId: "FCC-102-GAMMA", name: "FCC Reactor Gamma", stability: 97.3, trend: "up" },
];

export const flowNetworkData = [
  { unit: "CDU", performance: 94 },
  { unit: "FCC", performance: 88 },
  { unit: "HCU", performance: 91 },
  { unit: "REF", performance: 96 },
  { unit: "BLN", performance: 85 },
  { unit: "STR", performance: 93 },
];

export const handoverEvents: HandoverEvent[] = [
  { timestamp: "14:23", description: "Naphtha yield recommendation acknowledged by J. Martinez", type: "action" },
  { timestamp: "13:45", description: "HX-201 fouling constraint confirmed (previously flagged at 09:15)", type: "constraint" },
  { timestamp: "11:07", description: "Diesel blend recommendation deferred — awaiting feed quality results", type: "deferral" },
  { timestamp: "09:15", description: "HX-201 fouling constraint submitted by J. Martinez", type: "constraint" },
  { timestamp: "06:30", description: "Shift started. 2 constraints carried over from night shift.", type: "routine" },
];

// Analytics data
export const analyticsKPIs: KPICardData[] = [
  { label: "Total Margin Captured", value: 1.24, unit: "M", prefix: "$", precision: 2, trend: 12, trendLabel: "vs last quarter" },
  { label: "Capture Rate", value: 82, unit: "%", precision: 0 },
  { label: "Actionability", value: 85, unit: "%", precision: 0, trend: 3, trendLabel: "↑ high intent" },
  { label: "LP Model Accuracy", value: 96.2, unit: "%", precision: 1 },
  { label: "Sensor Health", value: 87, unit: "/100", precision: 0, status: "warning", trendLabel: "3 substitutions active" },
];

export const waterfallData: WaterfallDataPoint[] = [
  { name: "CDU", value: 420 },
  { name: "FCC", value: 380 },
  { name: "HCU", value: 260 },
  { name: "Blend", value: 180 },
];

export const driftData: DriftDataPoint[] = Array.from({ length: 90 }, (_, i) => ({
  date: `Day ${i + 1}`,
  predicted: 8.0,
  actual: 8.0 - (i > 30 ? ((i - 30) * 0.007) : 0),
}));

export const sensorHealthData: SensorHealthCell[] = [
  // CDU
  { unit: "CDU", sensorType: "Temp", status: "healthy" },
  { unit: "CDU", sensorType: "Pressure", status: "substituted" },
  { unit: "CDU", sensorType: "Flow", status: "healthy" },
  { unit: "CDU", sensorType: "Level", status: "healthy" },
  { unit: "CDU", sensorType: "Comp", status: "healthy" },
  // FCC
  { unit: "FCC", sensorType: "Temp", status: "healthy" },
  { unit: "FCC", sensorType: "Pressure", status: "degraded" },
  { unit: "FCC", sensorType: "Flow", status: "healthy" },
  { unit: "FCC", sensorType: "Level", status: "healthy" },
  { unit: "FCC", sensorType: "Comp", status: "degraded" },
  // HCU
  { unit: "HCU", sensorType: "Temp", status: "healthy" },
  { unit: "HCU", sensorType: "Pressure", status: "healthy" },
  { unit: "HCU", sensorType: "Flow", status: "healthy" },
  { unit: "HCU", sensorType: "Level", status: "healthy" },
  { unit: "HCU", sensorType: "Comp", status: "healthy" },
  // Reformer
  { unit: "Reformer", sensorType: "Temp", status: "healthy" },
  { unit: "Reformer", sensorType: "Pressure", status: "healthy" },
  { unit: "Reformer", sensorType: "Flow", status: "substituted" },
  { unit: "Reformer", sensorType: "Level", status: "degraded" },
  { unit: "Reformer", sensorType: "Comp", status: "healthy" },
  // Blend
  { unit: "Blend", sensorType: "Temp", status: "healthy" },
  { unit: "Blend", sensorType: "Pressure", status: "healthy" },
  { unit: "Blend", sensorType: "Flow", status: "healthy" },
  { unit: "Blend", sensorType: "Level", status: "healthy" },
  { unit: "Blend", sensorType: "Comp", status: "healthy" },
];

export const constraintPatterns: ConstraintPattern[] = [
  { name: "Unit 2 HX-201 Fouling", count: 11, annotation: "Consider permanent seasonal constraint" },
  { name: "Unit 6 Catalyst Aging", count: 8 },
  { name: "Blend Staffing", count: 6 },
  { name: "CDU Feed Quality", count: 4 },
  { name: "FCC Regen Pressure", count: 3 },
];

// Constraint wizard options
export const wizardUnits = [
  { id: "unit-2", label: "Unit 2 — CDU" },
  { id: "unit-3", label: "Unit 3 — FCC" },
  { id: "unit-4", label: "Unit 4 — HCU" },
  { id: "unit-6", label: "Unit 6 — Reformer" },
  { id: "blend", label: "Blend" },
];

export const wizardTypes = [
  { id: "equipment", label: "Equipment Issue" },
  { id: "feed", label: "Feed Quality" },
  { id: "safety", label: "Safety" },
  { id: "staffing", label: "Staffing" },
];

export const wizardConstraints: Record<string, { id: string; label: string }[]> = {
  "unit-2": [
    { id: "hx-201", label: "HX-201 Fouling" },
    { id: "pump-202", label: "Pump P-202 Vibration" },
    { id: "valve-203", label: "Valve V-203 Sticking" },
  ],
  "unit-3": [
    { id: "catalyst", label: "Catalyst Deactivation" },
    { id: "regen", label: "Regenerator Pressure" },
  ],
  "unit-4": [
    { id: "h2-supply", label: "H2 Supply Constraint" },
    { id: "reactor-temp", label: "Reactor Temperature Limit" },
  ],
  "unit-6": [
    { id: "catalyst-aging", label: "Catalyst Aging" },
    { id: "feed-quality", label: "Feed Quality Issue" },
  ],
  blend: [
    { id: "staffing", label: "Staffing Constraint" },
    { id: "tank-level", label: "Tank Level Limit" },
  ],
};

// Inventory breakdowns — per-slate crude and per-product ullage/ready
export const crudeSlates: CrudeSlate[] = [
  { slate: "Sour", barrels: 145000, daysOfSupply: 3.2 },
  { slate: "Yellow Wax", barrels: 62000, daysOfSupply: 1.4 },
  { slate: "Utica", barrels: 98000, daysOfSupply: 2.1 },
  { slate: "Bakken", barrels: 110000, daysOfSupply: 2.4 },
  { slate: "Sweet WTI", barrels: 220000, daysOfSupply: 4.8 },
];

export const ullageByProduct: UllageByProduct[] = [
  { product: "Crude", barrels: 215000 },
  { product: "Gasoline", barrels: 84000 },
  { product: "Diesel", barrels: 117000 },
  { product: "Jet", barrels: 88000 },
  { product: "Propane", barrels: 0 },
  { product: "Butane", barrels: 12000 },
  { product: "Asphalt", barrels: 34000 },
];

export const productReady: ProductReady[] = [
  { product: "Propane", barrels: 50000, ullageRemaining: 0, alert: "STORAGE FULL" },
  { product: "Butane", barrels: 22000, ullageRemaining: 12000 },
  { product: "Gasoline", barrels: 316000, ullageRemaining: 84000 },
  { product: "Diesel", barrels: 483000, ullageRemaining: 117000 },
  { product: "Jet", barrels: 112000, ullageRemaining: 88000 },
  { product: "Asphalt", barrels: 18000, ullageRemaining: 34000 },
];

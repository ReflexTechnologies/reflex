"use client";

import { KPICard } from "@/components/ui/KPICard";
import type { KPICardData } from "@/types";
import ReactECharts from "echarts-for-react";

/* ── Mock Data ────────────────────────────────────────────────── */

const kpis: KPICardData[] = [
  { label: "Active Risks", value: 4, precision: 0 },
  { label: "Critical", value: 1, precision: 0, status: "warning" },
  { label: "Avg Risk Score", value: 6.1, precision: 1, unit: "/ 10" },
  {
    label: "Mitigated This Month",
    value: 3,
    precision: 0,
    trend: 2,
    trendLabel: "vs last month",
  },
];

const impactLabels = ["Negligible", "Minor", "Moderate", "Major", "Catastrophic"];
const likelihoodLabels = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];

// [impact(x), likelihood(y), score]
const heatmapPoints: [number, number, number][] = [
  [4, 3, 9.2],  // RSK-041 — Catastrophic × Possible
  [4, 2, 6.9],  // RSK-033 — Catastrophic × Unlikely
  [1, 3, 5.1],  // RSK-030 — Minor × Possible
  [3, 1, 3.2],  // RSK-025 — Major × Rare
];

type RiskCategory = "Operational" | "Financial" | "Safety" | "Environmental";

interface Risk {
  id: string;
  description: string;
  category: RiskCategory;
  score: number;
  owner: string;
  status: "Open" | "Mitigating" | "Monitoring";
}

const risks: Risk[] = [
  { id: "RSK-041", description: "FCC regenerator catalyst attrition above threshold", category: "Operational", score: 9.2, owner: "M. Chen", status: "Open" },
  { id: "RSK-033", description: "Approaching 365-day SOX emissions cap — may force switch to lower-sulfur crude slate", category: "Environmental", score: 6.9, owner: "L. Garcia", status: "Mitigating" },
  { id: "RSK-030", description: "Reformer tube wall thinning above forecast", category: "Operational", score: 5.1, owner: "T. Nguyen", status: "Monitoring" },
  { id: "RSK-025", description: "CDU overhead corrosion rate exceeding inspection plan", category: "Operational", score: 3.2, owner: "M. Chen", status: "Monitoring" },
];

const categoryColor: Record<RiskCategory, { bg: string; text: string; border: string }> = {
  Operational: { bg: "bg-blue-50", text: "text-blue-700", border: "border-l-blue-500" },
  Financial: { bg: "bg-amber-50", text: "text-amber-700", border: "border-l-amber-500" },
  Safety: { bg: "bg-red-50", text: "text-red-700", border: "border-l-red-500" },
  Environmental: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-l-emerald-500" },
};

const statusPill: Record<string, string> = {
  Open: "bg-red-100 text-red-700",
  Mitigating: "bg-amber-100 text-amber-700",
  Monitoring: "bg-blue-100 text-blue-700",
};

const trendMonths = ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];
const trendScores = [52, 49, 51, 48, 46, 50, 47, 44, 43, 45, 42, 40];

/* ── Page Component ───────────────────────────────────────────── */

export default function RiskAssessmentPage() {
  /* Heatmap chart */
  const heatmapOption: Record<string, unknown> = {
    animation: true,
    animationDuration: 600,
    animationEasing: "cubicOut" as const,
    grid: { top: 20, right: 20, bottom: 40, left: 100 },
    xAxis: {
      type: "category",
      data: impactLabels,
      position: "bottom",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 10,
        color: "#9CA3AF",
      },
      splitArea: { show: true, areaStyle: { color: ["#FAFAFA", "#F5F5F5"] } },
    },
    yAxis: {
      type: "category",
      data: likelihoodLabels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 10,
        color: "#9CA3AF",
      },
      splitArea: { show: true, areaStyle: { color: ["#FAFAFA", "#F5F5F5"] } },
    },
    visualMap: {
      min: 0,
      max: 10,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      show: false,
      inRange: {
        color: ["#D1FAE5", "#FEF3C7", "#FEE2E2", "#DC2626"],
      },
    },
    tooltip: {
      trigger: "item",
      backgroundColor: "#111827",
      borderColor: "#111827",
      textStyle: {
        color: "#F9FAFB",
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 12,
      },
      formatter: (params: { value: [number, number, number] }) => {
        const [x, y, score] = params.value;
        return `Impact: ${impactLabels[x]}<br/>Likelihood: ${likelihoodLabels[y]}<br/>Score: ${score.toFixed(1)}`;
      },
    },
    series: [
      {
        type: "heatmap",
        data: heatmapPoints,
        label: {
          show: true,
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: 11,
          color: "#111827",
          formatter: (params: { value: [number, number, number] }) =>
            params.value[2].toFixed(1),
        },
        emphasis: {
          itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,0.2)" },
        },
        itemStyle: { borderColor: "#FFFFFF", borderWidth: 3, borderRadius: 4 },
      },
    ],
  };

  /* Trend chart */
  const trendOption: Record<string, unknown> = {
    animation: true,
    animationDuration: 600,
    animationEasing: "cubicOut" as const,
    grid: { top: 16, right: 20, bottom: 24, left: 50 },
    xAxis: {
      type: "category",
      data: trendMonths,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 11,
        color: "#9CA3AF",
      },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: true, lineStyle: { color: "#F3F4F6", type: "dashed" as const } },
      axisLabel: {
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 11,
        color: "#9CA3AF",
      },
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#111827",
      borderColor: "#111827",
      textStyle: {
        color: "#F9FAFB",
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 12,
      },
      formatter: (params: Array<{ name: string; value: number }>) =>
        `${params[0].name}: ${params[0].value} total risk score`,
    },
    series: [
      {
        type: "line",
        data: trendScores,
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { color: "#0D9488", width: 2 },
        itemStyle: { color: "#0D9488" },
        areaStyle: { color: "rgba(13, 148, 136, 0.06)" },
      },
    ],
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-headline text-xl font-bold text-[#111827]">Risk Assessment</h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-headline font-bold uppercase tracking-wider bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
            4 Active Risks
          </span>
        </div>
        <span className="text-xs font-mono text-[#9CA3AF]">Synced 12s ago</span>
      </div>

      {/* Scope note */}
      <p className="text-xs font-body text-[#6B7280] -mt-2">
        This view focuses on risks that affect LP model planning. Safety, HR, and compliance risks are tracked separately by their respective departments.
      </p>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} data={kpi} />
        ))}
      </div>

      {/* Two-column: Heatmap + Risk Table */}
      <div className="grid grid-cols-[55fr_45fr] gap-4">
        {/* Left: Heatmap */}
        <div className="bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
          <h2 className="text-xs font-headline uppercase tracking-wider text-[#9CA3AF] font-medium mb-3">
            Risk Heatmap
          </h2>
          <ReactECharts
            option={heatmapOption}
            style={{ height: 320, width: "100%" }}
            opts={{ renderer: "svg" }}
          />
        </div>

        {/* Right: Risk Table */}
        <div className="bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
          <h2 className="text-xs font-headline uppercase tracking-wider text-[#9CA3AF] font-medium mb-3">
            Active Risks
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                <th className="text-left py-2 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF] font-medium">ID</th>
                <th className="text-left py-2 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF] font-medium">Description</th>
                <th className="text-left py-2 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF] font-medium">Category</th>
                <th className="text-right py-2 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF] font-medium">Score</th>
                <th className="text-left py-2 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF] font-medium">Owner</th>
                <th className="text-left py-2 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF] font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r, i) => (
                <tr
                  key={r.id}
                  className={`border-b border-[#F3F4F6] last:border-0 border-l-4 ${categoryColor[r.category].border} ${i % 2 === 1 ? "bg-[#F9FAFB]" : ""}`}
                >
                  <td className="py-2 px-1 font-mono text-xs text-[#111827]">{r.id}</td>
                  <td className="py-2 px-1 font-body text-xs text-[#4B5563] max-w-[180px] truncate">{r.description}</td>
                  <td className="py-2 px-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-headline font-semibold uppercase tracking-wide ${categoryColor[r.category].bg} ${categoryColor[r.category].text}`}>
                      {r.category}
                    </span>
                  </td>
                  <td className="py-2 px-1 text-right font-mono text-xs text-[#111827]">{r.score.toFixed(1)}</td>
                  <td className="py-2 px-1 font-body text-xs text-[#4B5563]">{r.owner}</td>
                  <td className="py-2 px-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-headline font-semibold uppercase tracking-wide ${statusPill[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom: Risk Trend */}
      <div className="bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
        <h2 className="text-xs font-headline uppercase tracking-wider text-[#9CA3AF] font-medium mb-3">
          Risk Trend — Total Score (12 Months)
        </h2>
        <ReactECharts
          option={trendOption}
          style={{ height: 200, width: "100%" }}
          opts={{ renderer: "svg" }}
        />
      </div>
    </div>
  );
}

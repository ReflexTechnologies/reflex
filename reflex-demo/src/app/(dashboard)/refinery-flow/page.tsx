"use client";

import Link from "next/link";
import { KPICard } from "@/components/ui/KPICard";
import type { KPICardData } from "@/types";
import {
  sankeyNodes,
  sankeyLinks,
  refineryUnits,
} from "@/data/mock-data";
import ReactECharts from "echarts-for-react";

/* ------------------------------------------------------------------ */
/* KPI strip                                                          */
/* ------------------------------------------------------------------ */

const kpis: KPICardData[] = [
  {
    label: "Network Efficiency",
    value: 94.5,
    unit: "%",
    precision: 1,
    trend: 0.8,
    trendLabel: "vs target",
  },
  {
    label: "Active Units",
    value: 6,
    unit: "/6",
    precision: 0,
  },
  {
    label: "Plant Feed Rate",
    value: 105,
    unit: "K BPD",
    precision: 0,
    trend: 1.5,
    trendLabel: "vs plan",
  },
];

/* ------------------------------------------------------------------ */
/* Sankey color logic                                                 */
/* ------------------------------------------------------------------ */

const COLOR_RED = "#DC2626";
const COLOR_AMBER = "#D97706";
const COLOR_GREEN = "#0D9488";

function colorForRatio(ratio: number): string {
  if (ratio < 0.9) return COLOR_RED;
  if (ratio < 0.98) return COLOR_AMBER;
  if (ratio <= 1.05) return COLOR_GREEN;
  if (ratio <= 1.1) return COLOR_AMBER;
  return COLOR_RED;
}

/* ------------------------------------------------------------------ */
/* Sankey chart option                                                */
/* ------------------------------------------------------------------ */

const sankeyOption: Record<string, unknown> = {
  tooltip: {
    trigger: "item",
    triggerOn: "mousemove",
    backgroundColor: "#111827",
    borderColor: "#111827",
    textStyle: {
      color: "#F9FAFB",
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 12,
    },
    formatter: (params: {
      dataType?: string;
      name?: string;
      data: {
        source?: string;
        target?: string;
        value?: number;
        target_value?: number;
        name?: string;
      };
    }) => {
      if (params.dataType === "edge") {
        const { source, target, value, target_value } = params.data;
        const actual = value ?? 0;
        const planned = target_value ?? 0;
        const pct = planned > 0 ? Math.round((actual / planned) * 100) : 0;
        return `${source} → ${target}<br/>${actual} / ${planned} kbpd <span style="color:#9CA3AF">(${pct}%)</span>`;
      }
      return `<b>${params.name ?? params.data?.name ?? ""}</b>`;
    },
  },
  animation: true,
  animationDuration: 600,
  series: [
    {
      type: "sankey",
      layout: "none",
      emphasis: { focus: "adjacency" },
      nodeAlign: "justify",
      nodeGap: 12,
      nodeWidth: 20,
      lineStyle: {
        curveness: 0.5,
      },
      label: {
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 11,
        color: "#111827",
      },
      data: sankeyNodes,
      links: sankeyLinks.map((link) => ({
        ...link,
        lineStyle: {
          color: colorForRatio(link.value / link.target_value),
          opacity: 0.55,
          curveness: 0.5,
        },
      })),
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Page component                                                     */
/* ------------------------------------------------------------------ */

export default function RefineryFlowPage() {
  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-headline text-xl font-bold text-[#111827]">
            Refinery Flow
          </h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-headline font-bold uppercase tracking-wider bg-[#F0FDFA] text-[#0D9488] border border-[#CCFBF1]">
            All Units Online
          </span>
        </div>
        <span className="text-xs font-mono text-[#9CA3AF]">Synced 12s ago</span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} data={kpi} />
        ))}
      </div>

      {/* Sankey chart card */}
      <div className="bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-headline uppercase tracking-wider text-[#9CA3AF] font-medium">
            Material Flow Network
          </h2>
          <div className="flex items-center gap-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm bg-[#0D9488]" />
              On target
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm bg-[#D97706]" />
              ±2–10%
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm bg-[#DC2626]" />
              Off target
            </span>
          </div>
        </div>
        <ReactECharts
          option={sankeyOption}
          style={{ height: "400px", width: "100%" }}
          opts={{ renderer: "svg" }}
        />
      </div>

      {/* Unit Status section header */}
      <h2 className="text-xs font-headline uppercase tracking-wider text-[#9CA3AF] font-medium">
        Unit Status
      </h2>

      {/* Unit Status grid */}
      <div className="grid grid-cols-3 gap-3">
        {refineryUnits.map((unit) => (
          <Link
            key={unit.slug}
            href={`/units/${unit.slug}`}
            className={`block bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 border-l-4 hover:shadow-md hover:border-[#CBD5E1] transition-all ${
              unit.status === "Caution"
                ? "border-l-[#D97706]"
                : "border-l-[#0D9488]"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-headline font-semibold text-[#111827]">
                {unit.name}
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    unit.status === "Caution"
                      ? "bg-[#D97706]"
                      : "bg-[#0D9488]"
                  }`}
                />
                <span
                  className={`text-xs font-body ${
                    unit.status === "Caution"
                      ? "text-[#D97706]"
                      : "text-[#0D9488]"
                  }`}
                >
                  {unit.status}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-xs font-body text-[#9CA3AF]">
                  Throughput
                </span>
                <span className="text-xs font-mono text-[#111827]">
                  {unit.throughput} K BPD{" "}
                  <span className="text-[#9CA3AF]">
                    (target: {unit.throughputTarget})
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs font-body text-[#9CA3AF]">
                  Temperature
                </span>
                <span className="text-xs font-mono text-[#111827]">
                  {unit.temp} °F
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs font-body text-[#9CA3AF]">
                  Pressure
                </span>
                <span className="text-xs font-mono text-[#111827]">
                  {unit.pressure} psi
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

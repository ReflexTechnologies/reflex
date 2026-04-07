"use client";

import Link from "next/link";
import { useState } from "react";
import { KPICard } from "@/components/ui/KPICard";
import { DriftChart } from "@/components/analytics/DriftChart";
import {
  modelDriftByEquipment,
  modelDriftKPIs,
  type ModelDriftEquipmentRow,
} from "@/data/mock-data";

const statusBadge: Record<ModelDriftEquipmentRow["status"], string> = {
  ok: "bg-[#F0FDFA] text-[#0D9488] border border-[#CCFBF1]",
  watch: "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]",
  drift: "bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]",
};

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 60;
  const h = 18;
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 2) - 1}`
    )
    .join(" ");
  return (
    <svg width={w} height={h} className="inline-block align-middle">
      <polyline points={points} fill="none" stroke="#D97706" strokeWidth="1.5" />
    </svg>
  );
}

export default function ModelDriftPage() {
  const [activeArea, setActiveArea] = useState<string>(
    modelDriftByEquipment[0].area
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Header + breadcrumb */}
      <div>
        <Link
          href="/analytics"
          className="text-xs font-mono text-[#9CA3AF] hover:text-[#0D9488] transition-colors"
        >
          ← Back to Reports
        </Link>
        <div className="flex items-center gap-3 mt-1">
          <h1 className="font-headline text-xl font-bold text-[#111827]">
            Model Drift Detail
          </h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-headline font-bold uppercase tracking-wider bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
            Drift Detected
          </span>
        </div>
        <p className="text-xs font-body text-[#9CA3AF] mt-0.5">
          LP coefficient relationships diverging from real plant behavior
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {modelDriftKPIs.map((kpi) => (
          <KPICard key={kpi.label} data={kpi} />
        ))}
      </div>

      {/* Two-column: table + chart */}
      <div className="grid grid-cols-[55fr_45fr] gap-4">
        {/* Equipment-area breakdown */}
        <div className="bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
          <h3 className="text-sm font-headline font-semibold text-[#111827] mb-3">
            Equipment-Area Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  {["Area", "Predicted", "Actual", "Δ", "Δ %", "7-Day", "Status"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left py-2 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF] font-medium"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {modelDriftByEquipment.map((row) => {
                  const isActive = activeArea === row.area;
                  const deltaColor =
                    row.delta < 0 ? "text-[#D97706]" : "text-[#0D9488]";
                  return (
                    <tr
                      key={row.area}
                      onClick={() => setActiveArea(row.area)}
                      className={`border-b border-[#F3F4F6] last:border-0 cursor-pointer transition-colors ${
                        isActive ? "bg-[#F0FDFA]" : "hover:bg-[#F9FAFB]"
                      }`}
                    >
                      <td className="py-2 font-body text-[#111827]">{row.area}</td>
                      <td className="py-2 font-mono text-[#4B5563]">
                        {row.predicted}{" "}
                        <span className="text-[#9CA3AF]">{row.unit}</span>
                      </td>
                      <td className="py-2 font-mono text-[#4B5563]">{row.actual}</td>
                      <td className={`py-2 font-mono ${deltaColor}`}>
                        {row.delta > 0 ? "+" : ""}
                        {row.delta}
                      </td>
                      <td className={`py-2 font-mono ${deltaColor}`}>
                        {row.deltaPct > 0 ? "+" : ""}
                        {row.deltaPct.toFixed(2)}%
                      </td>
                      <td className="py-2">
                        <Sparkline data={row.trend7d} />
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-headline font-bold uppercase tracking-wider ${
                            statusBadge[row.status]
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Drift over time */}
        <div className="bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 flex flex-col min-h-[360px]">
          <div className="flex items-center justify-between mb-3 gap-3">
            <h3 className="text-sm font-headline font-semibold text-[#111827] truncate">
              Predicted vs Actual — {activeArea}
            </h3>
            <select
              value={activeArea}
              onChange={(e) => setActiveArea(e.target.value)}
              className="text-xs font-mono border border-[#E5E7EB] rounded px-2 py-1 text-[#4B5563] bg-white shrink-0"
            >
              {modelDriftByEquipment.map((r) => (
                <option key={r.area} value={r.area}>
                  {r.area}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-h-[260px]">
            <DriftChart equipmentArea={activeArea} hideHeader />
          </div>
        </div>
      </div>

      {/* Inline explainer */}
      <div className="bg-[#F0FDFA] border border-[#CCFBF1] rounded p-4">
        <h4 className="text-xs font-headline font-bold uppercase tracking-wider text-[#0D9488] mb-2">
          What is model drift?
        </h4>
        <p className="text-sm font-body text-[#4B5563] leading-relaxed">
          Model drift means the LP&apos;s coefficient relationships have diverged
          from real plant behavior — the model&apos;s predictions no longer match
          what the sensors observe. Pumps and valves are usually <em>not</em> the
          culprit. Drift typically lives in <strong>reactors</strong> (catalyst
          aging), <strong>heat exchangers</strong> (fouling),{" "}
          <strong>fractionators</strong> (composition shifts), and{" "}
          <strong>blenders</strong> (component property drift). When drift exceeds
          ~3% in a critical area, the LP should be recalibrated.
        </p>
      </div>
    </div>
  );
}

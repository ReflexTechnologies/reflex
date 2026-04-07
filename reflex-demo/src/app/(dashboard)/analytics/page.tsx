"use client";

import Link from "next/link";
import { KPICard } from "@/components/ui/KPICard";
import { WaterfallChart } from "@/components/analytics/WaterfallChart";
import { DriftChart } from "@/components/analytics/DriftChart";
import { SensorHealthMatrix } from "@/components/analytics/SensorHealthMatrix";
import { ConstraintBarChart } from "@/components/analytics/ConstraintBarChart";
import { analyticsKPIs, modelDriftByEquipment } from "@/data/mock-data";

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-headline text-xl font-bold text-[#111827]">
            Financial &amp; Model Health
          </h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-headline font-bold uppercase tracking-wider bg-[#F0FDFA] text-[#0D9488] border border-[#CCFBF1]">
            System Normal
          </span>
        </div>
        <span className="text-xs font-mono text-[#9CA3AF]">
          Synced 12s ago
        </span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-3">
        {analyticsKPIs.map((kpi) => (
          <KPICard key={kpi.label} data={kpi} />
        ))}
      </div>

      {/* 2x2 chart grid: 55/45 split */}
      <div className="grid grid-cols-[55fr_45fr] grid-rows-[360px_360px] gap-4">
        <div className="bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
          <WaterfallChart />
        </div>
        <div className="bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <Link
              href="/model-drift"
              className="text-sm font-headline font-semibold text-[#111827] hover:text-[#0D9488] transition-colors"
            >
              Model Drift — by Equipment
            </Link>
            <Link
              href="/model-drift"
              className="text-xs font-mono text-[#0D9488] hover:underline"
            >
              View detail →
            </Link>
          </div>
          <div className="flex-1 min-h-0">
            <DriftChart hideHeader />
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {modelDriftByEquipment.map((row) => {
              const deltaColor =
                row.status === "drift"
                  ? "text-[#DC2626]"
                  : row.status === "watch"
                    ? "text-[#D97706]"
                    : "text-[#0D9488]";
              return (
                <div
                  key={row.area}
                  className="flex flex-col gap-0.5 rounded border border-[#F3F4F6] bg-[#F9FAFB] px-2 py-1.5"
                >
                  <span className="text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF] truncate">
                    {row.area}
                  </span>
                  <span className="font-mono text-[11px] text-[#4B5563]">
                    {row.predicted}→{row.actual}
                  </span>
                  <span className={`font-mono text-[11px] ${deltaColor}`}>
                    {row.delta > 0 ? "+" : ""}
                    {row.delta} ({row.deltaPct > 0 ? "+" : ""}
                    {row.deltaPct.toFixed(1)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
          <SensorHealthMatrix />
        </div>
        <div className="bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
          <ConstraintBarChart />
        </div>
      </div>
    </div>
  );
}

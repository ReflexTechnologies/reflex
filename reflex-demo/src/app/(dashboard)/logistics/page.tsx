"use client";

import { KPICard } from "@/components/ui/KPICard";
import { AnimatedMetric } from "@/components/ui/AnimatedMetric";
import type { KPICardData } from "@/types";

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const kpis: KPICardData[] = [
  { label: "Outbound Today", value: 5, precision: 0, trend: 1, trendLabel: "vs yesterday" },
  { label: "Pipeline Throughput", value: 62, unit: "K BPD", precision: 0, trend: 3.5, trendLabel: "vs target" },
  { label: "On-Time Rate", value: 94, unit: "%", precision: 0, trend: 2.0, trendLabel: "30-day avg" },
];

const inbound = [
  { date: "Apr 05", source: "Permian Basin", volume: 35000, mode: "Pipeline" as const, status: "Delivered" as const, eta: "\u2014" },
  { date: "Apr 05", source: "Cushing Hub", volume: 42000, mode: "Pipeline" as const, status: "In Transit" as const, eta: "14:30" },
  { date: "Apr 05", source: "Eagle Ford", volume: 18000, mode: "Rail" as const, status: "In Transit" as const, eta: "16:45" },
  { date: "Apr 06", source: "Midland Terminal", volume: 28000, mode: "Pipeline" as const, status: "Scheduled" as const, eta: "08:00" },
  { date: "Apr 06", source: "Local Blend", volume: 5000, mode: "Truck" as const, status: "Scheduled" as const, eta: "10:30" },
  { date: "Apr 07", source: "Bakken Field", volume: 22000, mode: "Rail" as const, status: "Scheduled" as const, eta: "06:00" },
];

const TODAY_LABEL = "Apr 05";
const inboundTodayShipments = inbound.filter((r) => r.date === TODAY_LABEL);
const inboundTodayBarrels = inboundTodayShipments.reduce((sum, r) => sum + r.volume, 0);

const outbound = [
  { date: "Apr 05", destination: "Houston Terminal", product: "Gasoline", volume: 28000, mode: "Pipeline" as const, status: "In Transit" as const },
  { date: "Apr 05", destination: "Dallas Depot", product: "Diesel", volume: 15000, mode: "Truck" as const, status: "Delivered" as const },
  { date: "Apr 05", destination: "DFW Airport", product: "Jet Fuel", volume: 22000, mode: "Pipeline" as const, status: "In Transit" as const },
  { date: "Apr 06", destination: "Gulf Export", product: "Naphtha", volume: 18000, mode: "Pipeline" as const, status: "Scheduled" as const },
  { date: "Apr 06", destination: "Midwest Rail", product: "Gasoline", volume: 32000, mode: "Rail" as const, status: "Scheduled" as const },
];

const transportModes = [
  { mode: "Pipeline", pct: 62, volume: 38400, color: "#2563EB" },
  { mode: "Rail", pct: 28, volume: 17300, color: "#92400E" },
  { mode: "Truck", pct: 10, volume: 6200, color: "#0D9488" },
];

const modeColor: Record<string, string> = {
  Pipeline: "bg-[#2563EB]",
  Rail: "bg-[#92400E]",
  Truck: "bg-[#0D9488]",
};

const statusStyle: Record<string, string> = {
  Delivered: "bg-[#F0FDFA] text-[#0D9488]",
  "In Transit": "bg-blue-50 text-[#2563EB]",
  Scheduled: "bg-gray-100 text-[#4B5563]",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LogisticsPage() {
  return (
    <div className="flex flex-col gap-5">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-headline text-xl font-bold text-[#111827]">
            Logistics &amp; Scheduling
          </h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-headline font-bold uppercase tracking-wider bg-[#F0FDFA] text-[#0D9488] border border-[#CCFBF1]">
            On Schedule
          </span>
        </div>
        <span className="text-xs font-mono text-[#9CA3AF]">Synced 12s ago</span>
      </div>
      <p className="text-sm font-body text-[#6B7280] -mt-1">
        Logistics overview &mdash; shows where feedstock is coming from and where finished product is going.
      </p>

      {/* ---- KPI Strip ---- */}
      <div className="grid grid-cols-4 gap-3">
        {/* Custom Inbound Today card — barrels primary, shipment count secondary */}
        <div className="bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 flex flex-col gap-1">
          <span className="text-xs font-headline uppercase tracking-wider text-[#9CA3AF]">
            Inbound Today
          </span>
          <div className="flex items-baseline gap-2">
            <AnimatedMetric
              value={inboundTodayBarrels}
              precision={0}
              className="text-2xl font-semibold text-[#111827]"
            />
            <span className="text-xs font-body uppercase tracking-wider text-[#9CA3AF]">
              bbl
            </span>
          </div>
          <span className="text-xs font-mono text-[#9CA3AF]">
            {inboundTodayShipments.length} shipments scheduled
          </span>
        </div>
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} data={kpi} />
        ))}
      </div>

      {/* ---- Two-column: Inbound + Outbound ---- */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "55% 45%" }}>
        {/* Left column — Inbound Feedstock */}
        <div>
          <h2 className="text-xs font-headline uppercase tracking-wider text-[#9CA3AF] font-medium mb-3">
            Inbound Feedstock
          </h2>
          <div className="bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  <th className="text-left px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Date</th>
                  <th className="text-left px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Source</th>
                  <th className="text-right px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Volume (bbl)</th>
                  <th className="text-left px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Mode</th>
                  <th className="text-left px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">ETA</th>
                </tr>
              </thead>
              <tbody>
                {inbound.map((row, i) => (
                  <tr
                    key={`${row.source}-${row.date}`}
                    className={`border-b border-[#F3F4F6] last:border-0 ${i % 2 === 1 ? "bg-[#F9FAFB]" : ""}`}
                  >
                    <td className="px-4 py-2.5 text-sm font-body text-[#111827]">{row.date}</td>
                    <td className="px-4 py-2.5 text-sm font-body text-[#111827]">{row.source}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-[#111827]">
                      {row.volume.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block w-2 h-2 rounded-full ${modeColor[row.mode]}`} />
                        <span className="text-xs font-body text-[#4B5563]">{row.mode}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-[10px] font-headline uppercase tracking-wider px-1.5 py-0.5 rounded-full ${statusStyle[row.status]}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[#9CA3AF]">{row.eta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column — Outbound Shipments */}
        <div>
          <h2 className="text-xs font-headline uppercase tracking-wider text-[#9CA3AF] font-medium mb-3">
            Outbound Shipments
          </h2>
          <div className="bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  <th className="text-left px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Date</th>
                  <th className="text-left px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Destination</th>
                  <th className="text-left px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Product</th>
                  <th className="text-right px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Volume (bbl)</th>
                  <th className="text-left px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Mode</th>
                  <th className="text-left px-4 py-3 text-[10px] font-headline uppercase tracking-wider text-[#9CA3AF]">Status</th>
                </tr>
              </thead>
              <tbody>
                {outbound.map((row, i) => (
                  <tr
                    key={`${row.destination}-${row.date}`}
                    className={`border-b border-[#F3F4F6] last:border-0 ${i % 2 === 1 ? "bg-[#F9FAFB]" : ""}`}
                  >
                    <td className="px-4 py-2.5 text-sm font-body text-[#111827]">{row.date}</td>
                    <td className="px-4 py-2.5 text-sm font-body text-[#111827]">{row.destination}</td>
                    <td className="px-4 py-2.5 text-sm font-body text-[#111827]">{row.product}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-[#111827]">
                      {row.volume.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block w-2 h-2 rounded-full ${modeColor[row.mode]}`} />
                        <span className="text-xs font-body text-[#4B5563]">{row.mode}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-[10px] font-headline uppercase tracking-wider px-1.5 py-0.5 rounded-full ${statusStyle[row.status]}`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ---- Transport Mode Breakdown ---- */}
      <div>
        <h2 className="text-xs font-headline uppercase tracking-wider text-[#9CA3AF] font-medium mb-3">
          Transport Mode Breakdown
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {transportModes.map((tm) => (
            <div
              key={tm.mode}
              className="bg-white rounded border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: tm.color }}
                />
                <span className="text-sm font-headline font-semibold text-[#111827]">
                  {tm.mode}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-semibold font-mono text-[#111827]">
                  {tm.pct}%
                </span>
                <span className="text-xs font-body text-[#9CA3AF]">
                  {tm.volume.toLocaleString()} bbl/day
                </span>
              </div>
              {/* Bar indicator */}
              <div className="w-full h-2 bg-[#F3F4F6] rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${tm.pct}%`, backgroundColor: tm.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import ReactECharts from "echarts-for-react";
import { driftData, driftDataByEquipment } from "@/data/mock-data";

interface DriftChartProps {
  /** If set, use the per-equipment series from driftDataByEquipment instead of the default driftData. */
  equipmentArea?: string;
  /** Hide the internal header so the parent card can own the title and toolbar. */
  hideHeader?: boolean;
}

export function DriftChart({ equipmentArea, hideHeader }: DriftChartProps = {}) {
  const series = equipmentArea
    ? (driftDataByEquipment[equipmentArea] ?? driftData)
    : driftData;

  const driftStartIndex = series.findIndex(
    (d) => d.predicted - d.actual > 0.15
  );

  // Y-axis bounds adapt to whichever series is being plotted so non-percent
  // areas (e.g. Heat Exchanger °F) render with sensible padding.
  const allVals = series.flatMap((d) => [d.predicted, d.actual]);
  const dataMin = Math.min(...allVals);
  const dataMax = Math.max(...allVals);
  const padY = (dataMax - dataMin) * 0.15 || 0.5;
  const yMin = dataMin - padY;
  const yMax = dataMax + padY;

  const valueSuffix = equipmentArea ? "" : "%";

  const option: Record<string, unknown> = {
    animation: true,
    animationDuration: 600,
    animationEasing: "cubicOut" as const,
    grid: {
      top: 30,
      right: 20,
      bottom: 30,
      left: 50,
    },
    xAxis: {
      type: "category",
      data: series.map((d) => d.date),
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 11,
        color: "#9CA3AF",
        interval: Math.max(Math.floor(series.length / 4) - 1, 0),
      },
    },
    yAxis: {
      type: "value",
      min: yMin,
      max: yMax,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        show: true,
        lineStyle: { color: "#F3F4F6", type: "dashed" as const },
      },
      axisLabel: {
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 11,
        color: "#9CA3AF",
        formatter: (v: number) => `${v.toFixed(1)}${valueSuffix}`,
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
      formatter: (params: Array<{ seriesName: string; value: number; axisValue: string }>) => {
        const lines = params.map(
          (p) => `${p.seriesName}: ${Number(p.value).toFixed(2)}${valueSuffix}`
        );
        return `${params[0].axisValue}<br/>${lines.join("<br/>")}`;
      },
    },
    legend: {
      show: false,
    },
    series: [
      {
        name: "Predicted",
        type: "line",
        data: series.map((d) => d.predicted),
        smooth: true,
        symbol: "none",
        lineStyle: { color: "#0D9488", width: 2 },
        itemStyle: { color: "#0D9488" },
        markArea:
          driftStartIndex >= 0
            ? {
                silent: true,
                data: [
                  [
                    {
                      xAxis: series[driftStartIndex].date,
                      itemStyle: {
                        color: "rgba(217, 119, 6, 0.08)",
                      },
                    },
                    { xAxis: series[series.length - 1].date },
                  ],
                ],
              }
            : undefined,
      },
      {
        name: "Actual",
        type: "line",
        data: series.map((d) => Number(d.actual.toFixed(3))),
        smooth: true,
        symbol: "none",
        lineStyle: { color: "#9CA3AF", width: 2, type: "dashed" as const },
        itemStyle: { color: "#9CA3AF" },
      },
    ],
  };

  return (
    <div className="flex flex-col h-full relative">
      {!hideHeader && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-headline font-semibold text-[#111827]">
            Model Drift — Yield Prediction
          </h3>
          <div className="flex items-center gap-4 text-xs font-mono text-[#9CA3AF]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 bg-[#0D9488]" />
              Predicted
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 bg-[#9CA3AF] border-t border-dashed border-[#9CA3AF]" />
              Actual
            </span>
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0 relative">
        <ReactECharts
          option={option}
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "svg" }}
          notMerge
        />
        {driftStartIndex >= 0 && (
          <div
            className="absolute top-2 right-8 px-2 py-1 rounded text-[10px] font-headline font-bold uppercase tracking-wider text-[#D97706] bg-[#FFFBEB] border border-[#FDE68A]"
          >
            Drift Detected
          </div>
        )}
      </div>
    </div>
  );
}

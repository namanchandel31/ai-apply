import { useMemo } from "react";
import EChartsReactCore from "echarts-for-react/esm/core";
import * as echarts from "echarts/core";
import { SankeyChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import type { TrackerStatusSummary } from "@/lib/api";
import { buildTrackerStatusSankey } from "@/lib/trackerStatusChartColors";

echarts.use([SankeyChart, TooltipComponent, CanvasRenderer]);

type Props = {
  summary: TrackerStatusSummary;
  className?: string;
};

export function ApplicationsTrackerSankey({ summary, className }: Props) {
  const model = useMemo(() => buildTrackerStatusSankey(summary), [summary]);

  const option = useMemo<EChartsOption | null>(() => {
    if (!model) return null;

    const activeCountByName = model.countByName;

    const levels = Array.from({ length: model.maxDepth + 1 }, (_, depth) => ({
      depth,
      itemStyle: {
        borderWidth: 0,
        gap: 12,
      },
      lineStyle: {
        color: "gradient",
        opacity: 0.35,
      },
      label: {
        fontSize: 13,
        color: "#37352f",
        formatter: (params: { name?: string }) => {
          const name = params.name ?? "";
          const count = activeCountByName.get(name);
          return count != null ? `${name}  ${count}` : name;
        },
      },
    }));

    return {
      animation: false,
      tooltip: {
        trigger: "item",
        triggerOn: "mousemove",
        formatter: (params: unknown) => {
          const p = params as {
            dataType?: string;
            name?: string;
            data?: { source?: string; target?: string; value?: number };
          };
          if (p.dataType === "edge" && p.data) {
            return `${p.data.source} → ${p.data.target}<br/><strong>${p.data.value}</strong>`;
          }
          const count = activeCountByName.get(p.name ?? "");
          return count != null ? `${p.name}<br/><strong>${count}</strong>` : (p.name ?? "");
        },
      },
      series: [
        {
          type: "sankey",
          emphasis: { focus: "adjacency" },
          nodeAlign: "left",
          layoutIterations: 32,
          left: 12,
          right: 140,
          top: 16,
          bottom: 16,
          data: model.nodes,
          links: model.links,
          levels,
          lineStyle: {
            color: "gradient",
            curveness: 0.5,
            opacity: 0.4,
          },
          label: levels[0]?.label,
        },
      ],
    };
  }, [model, summary]);

  if (!option) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        No tracker status data yet. Assign statuses on your applications to see the flow.
      </div>
    );
  }

  return (
    <EChartsReactCore
      echarts={echarts}
      option={option}
      className={className}
      style={{ height: 400, width: "100%" }}
      notMerge
      lazyUpdate
    />
  );
}

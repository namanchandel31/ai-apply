import type { TrackerStatusColor } from "@/lib/trackerStatusColors";
import type { TrackerStatusSummary } from "@/lib/api";

/** Hex colors for ECharts Sankey nodes (Notion palette). */
export const TRACKER_STATUS_CHART_HEX: Record<TrackerStatusColor, string> = {
  gray: "#9B9A97",
  brown: "#64473A",
  orange: "#D9730D",
  yellow: "#DFAB01",
  green: "#0F7B6C",
  blue: "#0B6E99",
  purple: "#6940A5",
  pink: "#AD1A72",
  red: "#E03E3E",
};

const ROOT_NODE = "Applications";

function chartHex(color: string | undefined): string {
  if (color && color in TRACKER_STATUS_CHART_HEX) {
    return TRACKER_STATUS_CHART_HEX[color as TrackerStatusColor];
  }
  return TRACKER_STATUS_CHART_HEX.gray;
}

export type TrackerStatusSankeyModel = {
  nodes: Array<{ name: string; itemStyle?: { color: string }; depth?: number }>;
  links: Array<{ source: string; target: string; value: number }>;
  maxDepth: number;
  /** Label counts keyed by node name (cumulative for funnel stages). */
  countByName: Map<string, number>;
};

/**
 * Linear cumulative funnel: apps at stage N count toward all prior stages.
 * Custom / unassigned statuses branch from Applications at depth 1.
 */
export function buildTrackerStatusSankey(
  summary: TrackerStatusSummary
): TrackerStatusSankeyModel | null {
  const { total, funnel, sideBuckets } = summary;
  if (!total) return null;

  const activeFunnel = funnel.filter((s) => s.cumulativeCount > 0);
  const activeSide = sideBuckets.filter((b) => b.count > 0);
  if (!activeFunnel.length && !activeSide.length) return null;

  const nodes: TrackerStatusSankeyModel["nodes"] = [
    { name: ROOT_NODE, itemStyle: { color: "#0B6E99" }, depth: 0 },
  ];
  const links: TrackerStatusSankeyModel["links"] = [];
  const countByName = new Map<string, number>([[ROOT_NODE, total]]);
  let maxDepth = 0;

  for (let i = 0; i < activeFunnel.length; i++) {
    const stage = activeFunnel[i];
    const depth = i + 1;
    maxDepth = Math.max(maxDepth, depth);
    countByName.set(stage.name, stage.cumulativeCount);
    nodes.push({
      name: stage.name,
      itemStyle: { color: chartHex(stage.color) },
      depth,
    });

    const source = i === 0 ? ROOT_NODE : activeFunnel[i - 1].name;
    links.push({
      source,
      target: stage.name,
      value: stage.cumulativeCount,
    });
  }

  for (const bucket of activeSide) {
    maxDepth = Math.max(maxDepth, 1);
    countByName.set(bucket.name, bucket.count);
    nodes.push({
      name: bucket.name,
      itemStyle: { color: chartHex(bucket.color) },
      depth: 1,
    });
    links.push({
      source: ROOT_NODE,
      target: bucket.name,
      value: bucket.count,
    });
  }

  return { nodes, links, maxDepth, countByName };
}

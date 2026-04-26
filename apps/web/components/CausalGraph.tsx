"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { riskColor } from "@/lib/format";

export interface GraphNode {
  fqn: string;
  entityType: string;
  name: string;
  owner?: string | null;
  riskScore?: number | null;
  blastProb?: number | null;
}

export interface GraphEdge {
  from: string;
  to: string;
  fromColumn?: string | null;
  toColumn?: string | null;
  transformation?: string | null;
}

type Mode = "risk" | "blast" | "off";

interface SimNode extends d3.SimulationNodeDatum, GraphNode {
  id: string;
}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
  fromColumn?: string | null | undefined;
  toColumn?: string | null | undefined;
  transformation?: string | null | undefined;
}

const NODE_W = 140;
const NODE_H = 56;

export const CausalGraph: React.FC<{
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (n: GraphNode) => void;
  highlightedNodeId?: string | null;
  riskMode?: Mode;
  height?: number;
}> = ({ nodes, edges, onNodeClick, highlightedNodeId, riskMode = "risk", height = 560 }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dims, setDims] = useState({ w: 800, h: height });
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setDims({ w: e.contentRect.width, h: height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  const { simNodes, simLinks } = useMemo(() => {
    const sn: SimNode[] = nodes.map((n) => ({ id: n.fqn, ...n }));
    const sl: SimLink[] = edges.map((e) => ({
      source: e.from,
      target: e.to,
      fromColumn: e.fromColumn,
      toColumn: e.toColumn,
      transformation: e.transformation,
    }));
    return { simNodes: sn, simLinks: sl };
  }, [nodes, edges]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("class", "zoomable");

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on("zoom", (ev) => {
          g.attr("transform", ev.transform.toString());
        }),
    );

    // defs: arrowhead, gradients, glow filter
    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 10)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#6B7280");

    const nodeGrad = defs
      .append("linearGradient")
      .attr("id", "node-grad")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
    nodeGrad.append("stop").attr("offset", "0%").attr("stop-color", "#1A2235");
    nodeGrad.append("stop").attr("offset", "100%").attr("stop-color", "#0E1626");

    const glow = defs
      .append("filter")
      .attr("id", "node-glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    glow
      .append("feGaussianBlur")
      .attr("stdDeviation", "3")
      .attr("result", "coloredBlur");
    const merge = glow.append("feMerge");
    merge.append("feMergeNode").attr("in", "coloredBlur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    const link = g
      .append("g")
      .attr("stroke", "#4B5563")
      .attr("stroke-width", 1.4)
      .attr("stroke-opacity", 0.8)
      .attr("fill", "none")
      .selectAll<SVGPathElement, SimLink>("path")
      .data(simLinks)
      .enter()
      .append("path")
      .attr("marker-end", "url(#arrow)");

    link.append("title").text((d) => d.transformation ?? "");

    const node = g
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .enter()
      .append("g")
      .attr("cursor", "pointer")
      .on("click", (_, d) => onNodeClick?.(d));

    const strokeFor = (d: SimNode): string => {
      if (highlightedNodeId === d.id) return "#22D3EE";
      if (riskMode === "risk" && d.riskScore != null) return riskColor(d.riskScore);
      if (riskMode === "blast" && d.blastProb != null) return riskColor(d.blastProb);
      return "#374151";
    };

    // outer glow ring (only for highlighted / risky nodes)
    node
      .append("rect")
      .attr("width", NODE_W + 6)
      .attr("height", NODE_H + 6)
      .attr("rx", 12)
      .attr("ry", 12)
      .attr("x", -(NODE_W + 6) / 2)
      .attr("y", -(NODE_H + 6) / 2)
      .attr("fill", "none")
      .attr("stroke", (d) => strokeFor(d))
      .attr("stroke-opacity", (d) => {
        if (highlightedNodeId === d.id) return 0.5;
        const s =
          riskMode === "blast"
            ? d.blastProb ?? 0
            : riskMode === "risk"
              ? d.riskScore ?? 0
              : 0;
        return s > 0.4 ? 0.35 : 0;
      })
      .attr("stroke-width", 2)
      .attr("filter", "url(#node-glow)");

    node
      .append("rect")
      .attr("width", NODE_W)
      .attr("height", NODE_H)
      .attr("rx", 10)
      .attr("ry", 10)
      .attr("x", -NODE_W / 2)
      .attr("y", -NODE_H / 2)
      .attr("fill", "url(#node-grad)")
      .attr("stroke", (d) => strokeFor(d))
      .attr("stroke-width", (d) => (highlightedNodeId === d.id ? 2.5 : 1.5));

    // accent corner dot
    node
      .append("circle")
      .attr("cx", NODE_W / 2 - 8)
      .attr("cy", -NODE_H / 2 + 8)
      .attr("r", 3)
      .attr("fill", (d) => strokeFor(d));

    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", -2)
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .attr("fill", "#E5E7EB")
      .text((d) => (d.name.length > 18 ? d.name.slice(0, 17) + "…" : d.name));

    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 14)
      .attr("font-size", 10)
      .attr("fill", "#9CA3AF")
      .text((d) => d.entityType);

    const sim = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((n) => n.id)
          .distance(140)
          .strength(0.5),
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(-400))
      .force("center", d3.forceCenter(dims.w / 2, dims.h / 2))
      .force("collision", d3.forceCollide(NODE_W / 2 + 8));

    sim.on("tick", () => {
      link.attr("d", (d) => {
        const s = d.source as SimNode;
        const t = d.target as SimNode;
        if (s.x == null || t.x == null || s.y == null || t.y == null) return "";
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.2;
        return `M${s.x},${s.y}A${dr},${dr} 0 0,1 ${t.x},${t.y}`;
      });
      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on("start", (ev, d) => {
        if (!ev.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (ev, d) => {
        d.fx = ev.x;
        d.fy = ev.y;
      })
      .on("end", (ev, d) => {
        if (!ev.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    node.call(drag);

    return () => {
      sim.stop();
    };
  }, [simNodes, simLinks, dims, highlightedNodeId, riskMode, onNodeClick]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative rounded-2xl border border-border/70 bg-gradient-to-b from-bg to-[#070C17] overflow-hidden shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)]"
    >
      <svg
        ref={svgRef}
        width={dims.w}
        height={dims.h}
        role="img"
        aria-label="Causal graph"
      />
      <div className="absolute top-3 left-3 flex items-center gap-2 text-[11px] text-fg-muted bg-surface/70 border border-border/60 rounded-lg px-2.5 py-1.5 font-mono backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-accent pulse-dot" />
        causal DAG
      </div>
      <div className="absolute bottom-3 right-3 text-[11px] text-fg-muted bg-surface/70 border border-border/60 rounded-lg px-2.5 py-1.5 font-mono backdrop-blur">
        {nodes.length} nodes · {edges.length} edges · scroll-zoom · drag-pan
      </div>
    </div>
  );
};

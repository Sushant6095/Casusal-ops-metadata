import type { OmClient } from "./client.js";
import { LineageGraphSchema, type LineageGraph } from "./types.js";

export interface LineageDepthOptions {
  upstreamDepth?: number;
  downstreamDepth?: number;
}

const DEFAULT_DEPTH = 3;

/** Fetch table-level lineage graph rooted at the given FQN. */
export async function getTableLineage(
  client: OmClient,
  fqn: string,
  opts: LineageDepthOptions = {},
): Promise<LineageGraph> {
  const res = await client.http.get(
    `/lineage/table/name/${encodeURIComponent(fqn)}`,
    {
      params: {
        upstreamDepth: opts.upstreamDepth ?? DEFAULT_DEPTH,
        downstreamDepth: opts.downstreamDepth ?? DEFAULT_DEPTH,
      },
    },
  );
  return LineageGraphSchema.parse(res.data);
}

/** Fetch column-level lineage graph rooted at the given column FQN. */
export async function getColumnLineage(
  client: OmClient,
  columnFqn: string,
  opts: LineageDepthOptions = {},
): Promise<LineageGraph> {
  const res = await client.http.get(
    `/lineage/column/name/${encodeURIComponent(columnFqn)}`,
    {
      params: {
        upstreamDepth: opts.upstreamDepth ?? DEFAULT_DEPTH,
        downstreamDepth: opts.downstreamDepth ?? DEFAULT_DEPTH,
      },
    },
  );
  return LineageGraphSchema.parse(res.data);
}

import type { OmClient } from "./client.js";
import { TableSchema, PagingSchema, type Table, type Paging } from "./types.js";
import { z } from "zod";

export interface GetTableOptions {
  fields?: string[];
}

export interface ListTablesOptions {
  service?: string;
  database?: string;
  limit?: number;
  after?: string;
  fields?: string[];
}

const TableListSchema = z.object({
  data: z.array(TableSchema),
  paging: PagingSchema.optional(),
});

/** Fetch a table entity by fully qualified name. */
export async function getTable(
  client: OmClient,
  fqn: string,
  opts: GetTableOptions = {},
): Promise<Table> {
  const res = await client.http.get(
    `/tables/name/${encodeURIComponent(fqn)}`,
    { params: { fields: opts.fields?.join(",") } },
  );
  return TableSchema.parse(res.data);
}

/** Patch the `extension` field on a table using JSON Patch replace. */
export async function patchTableExtension(
  client: OmClient,
  fqn: string,
  extension: Record<string, unknown>,
): Promise<Table> {
  const patch = [{ op: "replace", path: "/extension", value: extension }];
  const res = await client.http.patch(
    `/tables/name/${encodeURIComponent(fqn)}`,
    patch,
    { headers: { "Content-Type": "application/json-patch+json" } },
  );
  return TableSchema.parse(res.data);
}

/** List tables with OM paging. */
export async function listTables(
  client: OmClient,
  opts: ListTablesOptions = {},
): Promise<{ data: Table[]; paging: Paging | undefined }> {
  const res = await client.http.get("/tables", {
    params: {
      service: opts.service,
      database: opts.database,
      limit: opts.limit ?? 50,
      after: opts.after,
      fields: opts.fields?.join(","),
    },
  });
  const parsed = TableListSchema.parse(res.data);
  return { data: parsed.data, paging: parsed.paging };
}

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";

type StoredRow = {
  payload: string;
  updated_at: string;
};

type AnalysisRow = {
  id: string;
  payload: string;
};

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  const { DB } = env as unknown as { DB?: D1Database };

  if (!DB) {
    throw new Error(
      "Banco D1 não configurado. Verifique o binding DB no wrangler.jsonc.",
    );
  }

  return DB;
}

export async function readRecord(id: string) {
  const db = await database();

  const row = await db
    .prepare("SELECT payload, updated_at FROM records WHERE id = ?")
    .bind(id)
    .first<StoredRow>();

  return row
    ? {
        value: JSON.parse(row.payload),
        updatedAt: row.updated_at,
      }
    : null;
}

export async function saveRecord(id: string, payload: unknown) {
  const db = await database();
  const serialized = JSON.stringify(payload);

  if (serialized === undefined) {
    throw new Error("Não é possível salvar um valor indefinido.");
  }

  await db
    .prepare(
      `INSERT INTO records (id, payload, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
    )
    .bind(id, serialized, new Date().toISOString())
    .run();
}

export async function readAnalyses() {
  const db = await database();

  const { results } = await db
    .prepare("SELECT id, payload FROM records WHERE id LIKE 'analysis:%'")
    .all<AnalysisRow>();

  return Object.fromEntries(
    results.map((row) => [
      row.id.slice("analysis:".length),
      JSON.parse(row.payload),
    ]),
  );
}

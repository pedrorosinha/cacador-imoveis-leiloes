import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
type StoredRow = { payload: string; updated_at: string };
const globalDB = globalThis as typeof globalThis & {
  garimpoDatabase?: DatabaseSync;
};
function database() {
  if (!globalDB.garimpoDatabase) {
    const folder = path.join(process.cwd(), ".local-data");
    mkdirSync(folder, { recursive: true });
    const connection = new DatabaseSync(path.join(folder, "garimpo.sqlite"));
    connection.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)",
    );
    globalDB.garimpoDatabase = connection;
  }
  return globalDB.garimpoDatabase;
}
export async function readRecord(id: string) {
  const row = database()
    .prepare("SELECT payload,updated_at FROM records WHERE id = ?")
    .get(id) as StoredRow | undefined;
  return row
    ? { value: JSON.parse(row.payload), updatedAt: row.updated_at }
    : null;
}
export async function saveRecord(id: string, payload: unknown) {
  database()
    .prepare(
      "INSERT INTO records (id,payload,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at",
    )
    .run(id, JSON.stringify(payload), new Date().toISOString());
}
export async function readAnalyses() {
  const rows = database()
    .prepare("SELECT id,payload FROM records WHERE id LIKE 'analysis:%'")
    .all() as { id: string; payload: string }[];
  return Object.fromEntries(
    rows.map((r) => [r.id.slice(9), JSON.parse(r.payload)]),
  );
}

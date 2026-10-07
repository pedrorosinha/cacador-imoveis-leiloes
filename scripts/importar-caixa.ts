import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { parseCaixa } from "../lib/properties";

const output = ".local-data/importar-caixa.sql";

mkdirSync(".local-data", { recursive: true });
rmSync(output, { force: true });

const input = process.argv[2];

if (!input) {
  throw new Error("Informe o caminho do CSV baixado da CAIXA.");
}

const bytes = readFileSync(input);

if (bytes.length > 20 * 1024 * 1024) {
  throw new Error("Arquivo maior que o limite de 20 MB.");
}

let csv: string;

try {
  csv = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
} catch {
  csv = new TextDecoder("windows-1252").decode(bytes);
}

if (/^\s*(?:<!doctype\s+html|<html\b|<head\b|<body\b)/i.test(csv)) {
  throw new Error("O arquivo contém HTML. Baixe o CSV pelo navegador.");
}

const properties = parseCaixa(csv).filter((property) => property.uf === "RS");

if (properties.length === 0) {
  throw new Error("Nenhum imóvel válido do RS encontrado.");
}

const payload = JSON.stringify({ properties });

if (Buffer.byteLength(payload, "utf8") > 1_800_000) {
  throw new Error("Lista grande demais para o modelo atual de cache.");
}

const quote = (value: string) => "'" + value.replace(/'/g, "''") + "'";
const temporaryId = quote(`import:caixa:${randomUUID()}`);
const updatedAt = quote(new Date().toISOString());

const statements = [
  `CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `INSERT INTO records (id, payload, updated_at)
   VALUES (${temporaryId}, '', ${updatedAt});`,
];

// Divide o conteúdo para respeitar o limite por comando SQL do D1.
for (const chunk of payload.match(/[\s\S]{1,5000}/gu) ?? []) {
  statements.push(
    `UPDATE records
     SET payload = payload || ${quote(chunk)}
     WHERE id = ${temporaryId};`,
  );
}

// Só substitui a lista atual após montar todo o conteúdo.
statements.push(
  `INSERT INTO records (id, payload, updated_at)
   SELECT 'caixa-feed:RS:v2', payload, updated_at
   FROM records WHERE id = ${temporaryId}
   ON CONFLICT(id) DO UPDATE SET
     payload = excluded.payload,
     updated_at = excluded.updated_at;`,
  `DELETE FROM records WHERE id = ${temporaryId};`,
);

writeFileSync(output, statements.join("\n"), "utf8");

console.log(`${properties.length} imóveis preparados.`);
console.log(`Data da lista: ${properties[0].sourceDate}`);
console.log(`Arquivo gerado: ${output}`);

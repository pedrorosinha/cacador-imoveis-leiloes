import { readRecord, saveRecord } from "@/lib/db";
import { parseCaixa, type Property } from "@/lib/properties";

const SOURCE_URL =
  "https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_RS.csv";

// Nova chave: não reutiliza o cache antigo limitado a Porto Alegre.
const CACHE_KEY = "caixa-feed:RS:v2";
const CACHE_DURATION = 60 * 60 * 1000;

type StoredFeed = {
  properties: Property[];
};

type FeedResult = {
  properties: Property[];
  updatedAt: string;
  stale: boolean;
  warning?: string;
};

let pending: Promise<FeedResult> | null = null;

async function collect(force: boolean): Promise<FeedResult> {
  const record = await readRecord(CACHE_KEY);
  const stored = record?.value as StoredFeed | undefined;

  const validCache =
    Array.isArray(stored?.properties) &&
    stored.properties.length > 0 &&
    stored.properties.every(
      (property) =>
        property.source === "CAIXA" &&
        property.uf === "RS" &&
        typeof property.city === "string" &&
        property.city.length > 0,
    );

  const cached: FeedResult | null =
    validCache && record && stored
      ? {
          properties: stored.properties,
          updatedAt: record.updatedAt,
          stale: false,
        }
      : null;

  if (cached && !force) {
    const age = Date.now() - Date.parse(cached.updatedAt);

    if (age >= 0 && age < CACHE_DURATION) {
      return cached;
    }
  }

  try {
    const response = await fetch(SOURCE_URL, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`A CAIXA respondeu HTTP ${response.status}.`);
    }

    const bytes = await response.arrayBuffer();

    if (bytes.byteLength > 20 * 1024 * 1024) {
      throw new Error("A lista ultrapassou o limite de tamanho.");
    }

    let csv: string;

    // Aceita UTF-8 e o Windows-1252 usado na lista da CAIXA.
    try {
      csv = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      csv = new TextDecoder("windows-1252").decode(bytes);
    }

    console.info(
      "CAIXA_RESPOSTA",
      JSON.stringify({
        status: response.status,
        urlFinal: response.url,
        tipo: response.headers.get("content-type"),
        tamanho: bytes.byteLength,
        inicio: csv.slice(0, 500),
      }),
    );

    if (/^\s*(?:<!doctype\s+html|<html\b|<head\b|<body\b)/i.test(csv)) {
      throw new Error("A CAIXA retornou uma página HTML em vez da lista CSV.");
    }

    const properties = parseCaixa(csv).filter(
      (property) => property.uf === "RS",
    );

    // Evita substituir o cache por uma resposta incompleta ou inválida.
    if (properties.length === 0) {
      throw new Error("A resposta não trouxe imóveis válidos do RS.");
    }

    await saveRecord(CACHE_KEY, { properties });

    return {
      properties,
      updatedAt: new Date().toISOString(),
      stale: false,
    };
  } catch (error) {
    console.error(
      "CAIXA_DIAGNOSTICO",
      JSON.stringify({
        nome: error instanceof Error ? error.name : typeof error,
        mensagem: error instanceof Error ? error.message : String(error),
        causa:
          error instanceof Error && error.cause !== undefined
            ? String(error.cause)
            : null,
        stack: error instanceof Error ? error.stack : null,
      }),
    );

    if (cached) {
      return {
        ...cached,
        stale: true,
        warning:
          "Não foi possível atualizar a CAIXA. Exibindo a última lista salva.",
      };
    }

    throw new Error(
      "Não foi possível consultar a CAIXA e ainda não existe uma lista salva. Tente novamente.",
    );
  }
}

export function getCaixaFeed(force = false): Promise<FeedResult> {
  // Requisições simultâneas compartilham a mesma consulta.
  if (pending) return pending;

  pending = collect(force).finally(() => {
    pending = null;
  });

  return pending;
}

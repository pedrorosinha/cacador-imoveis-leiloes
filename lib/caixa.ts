import { readRecord } from "@/lib/db";
import type { Property } from "@/lib/properties";

const CACHE_KEY = "caixa-feed:RS:v2";

// Ajusta estes limites se quiser.
const MAX_IMPORT_HOURS = 36;
const MAX_SOURCE_DAYS = 3;

type StoredFeed = {
  properties: Property[];
};

type FeedResult = {
  properties: Property[];
  updatedAt: string;
  stale: boolean;
  warning?: string;
};

function dateOnly(value: string): number | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.getTime();
}

export async function getCaixaFeed(): Promise<FeedResult> {
  const record = await readRecord(CACHE_KEY);
  const stored = record?.value as StoredFeed | undefined;

  if (
    !record ||
    !Array.isArray(stored?.properties) ||
    stored.properties.length === 0
  ) {
    throw new Error(
      "Ainda não há uma lista importada. Aguarde a atualização automática.",
    );
  }

  const properties = stored.properties;

  if (
    !properties.every(
      (property) =>
        property &&
        property.source === "CAIXA" &&
        property.uf === "RS" &&
        typeof property.city === "string" &&
        property.city.trim().length > 0,
    )
  ) {
    throw new Error(
      "A lista salva está inválida. Execute novamente a importação.",
    );
  }

  const warnings: string[] = [];
  const importAge = Date.now() - Date.parse(record.updatedAt);

  if (!Number.isFinite(importAge) || importAge < 0) {
    warnings.push(
      "A data da última importação não pôde ser validada.",
    );
  } else if (importAge > MAX_IMPORT_HOURS * 60 * 60 * 1000) {
    warnings.push(
      `A lista não é importada há mais de ${MAX_IMPORT_HOURS} horas.`,
    );
  }

  const today = dateOnly(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date()),
  );

  const sourceTime =
    typeof properties[0].sourceDate === "string"
      ? dateOnly(properties[0].sourceDate)
      : null;

  if (sourceTime === null || today === null || sourceTime > today) {
    warnings.push(
      "A data de geração da lista não pôde ser validada.",
    );
  } else if ((today - sourceTime) / 86_400_000 > MAX_SOURCE_DAYS) {
    warnings.push(
      `A lista da CAIXA foi gerada há mais de ${MAX_SOURCE_DAYS} dias. ` +
        "A última importação pode ter recebido o mesmo arquivo.",
    );
  }

  return {
    properties,
    updatedAt: record.updatedAt,
    stale: warnings.length > 0,
    ...(warnings.length > 0
      ? { warning: warnings.join(" ") }
      : {}),
  };
}
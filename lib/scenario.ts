import type { Property } from "./properties";

export const numericLabels = {
  buy: "Valor da compra",
  sale: "Revenda estimada",
  commission: "Comissão de compra",
  transfer: "ITBI / transferência",
  registry: "Registro e documentação",
  renovation: "Reforma",
  debts: "Débitos",
  legal: "Desocupação / jurídico",
  monthly: "Custo mensal",
  months: "Prazo até revender",
  broker: "Corretagem na revenda",
  tax: "Tributos na revenda",
  reserve: "Reserva para imprevistos",
} as const;

export type NumericField = keyof typeof numericLabels;
export type Scenario = Record<NumericField, number | null> & {
  schemaVersion?: 2;
  occupied: string;
  notes: string;
};

type Calculation =
  | {
      valid: false;
      missing: string[];
      purchase: null;
      selling: null;
      total: null;
      profit: null;
      roi: null;
    }
  | {
      valid: true;
      missing: string[];
      purchase: number;
      selling: number;
      total: number;
      profit: number;
      roi: number;
    };

const fields = Object.keys(numericLabels) as NumericField[];
const percentageFields: NumericField[] = ["commission", "transfer", "broker"];

export function defaults(property: Property): Scenario {
  return {
    schemaVersion: 2,
    buy: property.price,
    sale: null,
    commission: null,
    transfer: null,
    registry: null,
    renovation: null,
    debts: null,
    legal: null,
    monthly: null,
    months: null,
    broker: null,
    tax: null,
    reserve: null,
    occupied: "Não verificada",
    notes: "",
  };
}

// A migração acontece somente no formulário. O registro antigo permanece
// intacto no banco até o usuário revisar e salvar novamente.
export function prepareScenario(
  saved: Scenario | undefined,
  property: Property,
): Scenario {
  if (!saved) return defaults(property);
  if (saved.schemaVersion === 2) return { ...defaults(property), ...saved };

  const migrated = { ...defaults(property), ...saved };
  for (const key of fields) {
    if (key === "buy") continue;
    const value = saved[key];
    migrated[key] =
      typeof value === "number" && Number.isFinite(value) && value > 0
        ? value
        : null;
  }
  // Seis meses eram preenchidos automaticamente na versão anterior.
  migrated.months = null;
  migrated.schemaVersion = 2;
  return migrated;
}

export function calculate(scenario: Scenario): Calculation {
  const missing: string[] = [];
  for (const key of fields) {
    const value = scenario[key];
    const invalid =
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1e10 ||
      ((key === "buy" || key === "sale") && value <= 0) ||
      (percentageFields.includes(key) && value > 100) ||
      (key === "months" && (!Number.isInteger(value) || value > 600));
    if (invalid) missing.push(numericLabels[key]);
  }
  if (scenario.schemaVersion !== 2)
    missing.unshift("Revisar custos da análise antiga");

  // Nunca tratar campos desconhecidos como zero nem calcular resultado parcial.
  if (missing.length > 0) {
    return {
      valid: false,
      missing,
      purchase: null,
      selling: null,
      total: null,
      profit: null,
      roi: null,
    };
  }
  const s = scenario as Scenario & Record<NumericField, number>;
  const purchase =
    s.buy * (1 + (s.commission + s.transfer) / 100) +
    s.registry +
    s.renovation +
    s.debts +
    s.legal +
    s.monthly * s.months +
    s.reserve;
  const selling = (s.sale * s.broker) / 100 + s.tax;
  const profit = s.sale - selling - purchase;
  return {
    valid: true,
    missing: [],
    purchase,
    selling,
    total: purchase + selling,
    profit,
    roi: (profit / purchase) * 100,
  };
}

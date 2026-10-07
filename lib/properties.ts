export type Property = {
  id: string;
  source: string;
  neighborhood: string;
  address: string;
  type: string;
  price: number;
  appraisal: number | null;
  area: number | null;
  bedrooms: number | null;
  parking: number | null;
  description: string;
  mode: string;
  url: string;
  financing: string;
  date: string | null;
  sourceDate: string;
  image?: string;
  city: string;
  uf: string;
};
export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
export function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quote && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quote = !quote;
    } else if (c === ";" && !quote) {
      row.push(field.trim());
      field = "";
    } else if ((c === "\n" || c === "\r") && !quote) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function parseCaixa(text: string): Property[] {
  const rows = csvRows(text);
  const hi = rows.findIndex(
    (r) =>
      r.some((c) => norm(c) === "cidade") && r.some((c) => norm(c) === "preco"),
  );
  if (hi < 0) throw Error("A lista da CAIXA veio em formato inesperado.");
  const h = rows[hi].map(norm);
  const col = (r: string[], name: string) => r[h.indexOf(name)] ?? "";
  const br = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));
  const sourceDate =
    text.match(/Data de gera[çc][ãa]o:;\s*(\d{2}\/\d{2}\/\d{4})/)?.[1] ??
    "não informada";
  const seen = new Set<string>();
  return rows.slice(hi + 1).flatMap((r) => {
    const id = "caixa-" + r[0];
    if (seen.has(id)) return [];
    seen.add(id);
    const desc = col(r, "descricao"),
      price = br(col(r, "preco")),
      appraisal = br(col(r, "valor de avaliacao"));
    const url = col(r, "link de acesso");
    try {
      const u = new URL(url);
      if (
        u.protocol !== "https:" ||
        u.hostname !== "venda-imoveis.caixa.gov.br"
      )
        return [];
    } catch {
      return [];
    }
    if (!Number.isFinite(price) || price <= 0) return [];
    return [
      {
        id,
        source: "CAIXA",
        city: col(r, "cidade").trim().toUpperCase(),
        uf: col(r, "uf").trim().toUpperCase(),
        neighborhood: col(r, "bairro")
          .toLocaleLowerCase("pt-BR")
          .replace(/(^|\s)\S/g, (c) => c.toUpperCase()),
        address: col(r, "endereco"),
        type: desc.split(",")[0] || "Imóvel",
        price,
        appraisal: appraisal > 0 ? appraisal : null,
        area: Number(desc.match(/([\d.]+) de área privativa/)?.[1]) || null,
        bedrooms: Number(desc.match(/(\d+) qto/)?.[1]) || null,
        parking: Number(desc.match(/(\d+) vaga/)?.[1]) || null,
        description: desc,
        mode: col(r, "modalidade de venda"),
        url,
        financing: col(r, "financiamento") || "Não informado",
        date: null,
        sourceDate,
      },
    ];
  });
}

export type { Scenario, NumericField } from "./scenario";
export { defaults, calculate, prepareScenario } from "./scenario";
export const money = (value: number | null | undefined): string => {
  if (typeof value !== "number" || !Number.isFinite(value))
    return "Não informado";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
};

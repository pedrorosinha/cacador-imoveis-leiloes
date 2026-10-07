export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { saveRecord } from "@/lib/db";
import { calculate } from "@/lib/scenario";
import { z } from "zod";

const amount = z.number().finite().min(0).max(1e10);
const percentage = z.number().finite().min(0).max(100);
const schema = z.object({
  id: z
    .string()
    .regex(/^(caixa|zuk)-[\w-]+$/)
    .max(80),
  scenario: z.object({
    schemaVersion: z.literal(2),
    buy: amount.positive(),
    sale: amount.positive(),
    commission: percentage,
    transfer: percentage,
    registry: amount,
    renovation: amount,
    debts: amount,
    legal: amount,
    monthly: amount,
    months: z.number().int().min(0).max(600),
    broker: percentage,
    tax: amount,
    reserve: amount,
    occupied: z.enum(["Não verificada", "Ocupado", "Desocupado"]),
    notes: z.string().max(2000),
  }),
});

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(request.url).origin !== origin) {
    return Response.json({ error: "Origem inválida" }, { status: 403 });
  }

  try {
    const body = await request.text();
    if (body.length > 12000)
      return Response.json({ error: "Análise muito grande" }, { status: 413 });

    let input: unknown;
    try {
      input = JSON.parse(body);
    } catch {
      return Response.json({ error: "JSON inválido" }, { status: 400 });
    }

    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return Response.json(
        {
          error:
            "Preencha compra, revenda, prazo e todas as despesas. Informe zero somente para custos confirmados como inexistentes. Compra e revenda devem ser maiores que zero; percentuais entre 0 e 100.",
        },
        { status: 400 },
      );
    }

    const result = calculate(parsed.data.scenario);
    if (!result.valid)
      return Response.json(
        { error: `Preencha ou revise: ${result.missing.join(", ")}.` },
        { status: 400 },
      );

    await saveRecord("analysis:" + parsed.data.id, parsed.data.scenario);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        error:
          "Não foi possível salvar. Seus valores continuam nesta tela; tente novamente.",
      },
      { status: 503 },
    );
  }
}
